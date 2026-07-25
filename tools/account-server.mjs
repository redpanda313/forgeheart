#!/usr/bin/env node
/**
 * ForgeHeart — lightest home-PC account server.
 *
 * - Username + password (any non-empty username; any password including empty)
 * - 3 save slots per account
 * - JSON file store on disk
 * - No email, no captcha, no word filters
 *
 * Run on your home machine, then expose with a tunnel (cloudflared / ngrok)
 * so the GitHub Pages client can reach it:
 *
 *   npm run accounts
 *   cloudflared tunnel --url http://127.0.0.1:8787
 *
 * Point the game at the tunnel URL (title screen field, or VITE_ACCOUNT_API_URL).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'accounts.json');
const PORT = Number(process.env.FORGEHEART_ACCOUNT_PORT || 8787);
const HOST = process.env.FORGEHEART_ACCOUNT_HOST || '0.0.0.0';
const SLOT_COUNT = 3;

// ——— Storage ———

function emptyDb() {
  return { users: {}, sessions: {} };
}

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return emptyDb();
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object') return emptyDb();
    return {
      users: raw.users && typeof raw.users === 'object' ? raw.users : {},
      sessions: raw.sessions && typeof raw.sessions === 'object' ? raw.sessions : {},
    };
  } catch {
    return emptyDb();
  }
}

function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

let db = loadDb();

// ——— Crypto ———

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password ?? ''), salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

function verifyPassword(password, saltHex, hashHex) {
  try {
    const { hash } = hashPassword(password, saltHex);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(hashHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

// ——— HTTP helpers ———

function send(res, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX = 8 * 1024 * 1024; // 8MB save ceiling
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function getBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(\S+)/i.exec(h);
  return m ? m[1] : null;
}

function userFromToken(token) {
  if (!token) return null;
  const username = db.sessions[token];
  if (!username || !db.users[username]) return null;
  return { username, user: db.users[username] };
}

function normalizeUsername(u) {
  // No word filters; only require non-empty string after trim of outer spaces
  if (typeof u !== 'string') return null;
  const s = u.trim();
  if (!s.length) return null;
  if (s.length > 64) return null;
  return s;
}

function ensureSlots(user) {
  if (!Array.isArray(user.slots) || user.slots.length !== SLOT_COUNT) {
    const prev = Array.isArray(user.slots) ? user.slots : [];
    user.slots = [0, 1, 2].map((i) => (prev[i] != null ? prev[i] : null));
  }
}

function slotMeta(data) {
  if (!data || typeof data !== 'object') {
    return { empty: true, label: 'Empty', sublabel: 'New game', savedAt: null, levelId: null };
  }
  const when = data.savedAt ? new Date(data.savedAt) : null;
  const time =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  return {
    empty: false,
    label: data.levelName || data.levelId || 'Save',
    sublabel: time || 'Saved',
    savedAt: data.savedAt ?? null,
    levelId: data.levelId ?? null,
  };
}

// ——— Routes ———

async function handle(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';
  const p = url.pathname.replace(/\/+$/, '') || '/';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  try {
    if (method === 'GET' && p === '/health') {
      return send(res, 200, {
        ok: true,
        service: 'forgeheart-accounts',
        users: Object.keys(db.users).length,
        slotCount: SLOT_COUNT,
      });
    }

    if (method === 'POST' && p === '/register') {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      // Password: any string, including empty — no strength rules
      const password = body.password == null ? '' : String(body.password);
      if (!username) {
        return send(res, 400, { ok: false, msg: 'Username required (any non-empty text).' });
      }
      if (db.users[username]) {
        return send(res, 409, { ok: false, msg: 'Username already taken.' });
      }
      const { salt, hash } = hashPassword(password);
      db.users[username] = {
        salt,
        hash,
        createdAt: Date.now(),
        slots: [null, null, null],
      };
      const token = newToken();
      db.sessions[token] = username;
      saveDb(db);
      return send(res, 201, {
        ok: true,
        msg: `Account “${username}” created.`,
        token,
        username,
      });
    }

    if (method === 'POST' && p === '/login') {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      const password = body.password == null ? '' : String(body.password);
      if (!username) {
        return send(res, 400, { ok: false, msg: 'Username required.' });
      }
      const user = db.users[username];
      if (!user || !verifyPassword(password, user.salt, user.hash)) {
        return send(res, 401, { ok: false, msg: 'Wrong username or password.' });
      }
      const token = newToken();
      db.sessions[token] = username;
      saveDb(db);
      return send(res, 200, {
        ok: true,
        msg: `Welcome back, ${username}.`,
        token,
        username,
      });
    }

    if (method === 'POST' && p === '/logout') {
      const token = getBearer(req);
      if (token && db.sessions[token]) {
        delete db.sessions[token];
        saveDb(db);
      }
      return send(res, 200, { ok: true, msg: 'Logged out.' });
    }

    if (method === 'GET' && p === '/me') {
      const auth = userFromToken(getBearer(req));
      if (!auth) return send(res, 401, { ok: false, msg: 'Not logged in.' });
      return send(res, 200, { ok: true, username: auth.username });
    }

    if (method === 'GET' && p === '/slots') {
      const auth = userFromToken(getBearer(req));
      if (!auth) return send(res, 401, { ok: false, msg: 'Not logged in.' });
      ensureSlots(auth.user);
      const slots = auth.user.slots.map((data, index) => ({
        index,
        ...slotMeta(data),
        // Include full save for client (needed to continue)
        data: data ?? null,
      }));
      return send(res, 200, { ok: true, username: auth.username, slots });
    }

    // PUT /slots/0 | /slots/1 | /slots/2
    const putMatch = /^\/slots\/([0-2])$/.exec(p);
    if (method === 'PUT' && putMatch) {
      const auth = userFromToken(getBearer(req));
      if (!auth) return send(res, 401, { ok: false, msg: 'Not logged in.' });
      const index = Number(putMatch[1]);
      const body = await readBody(req);
      const data = body.data ?? body.save ?? null;
      if (data !== null && (typeof data !== 'object' || Array.isArray(data))) {
        return send(res, 400, { ok: false, msg: 'Save data must be an object or null.' });
      }
      ensureSlots(auth.user);
      if (data && typeof data === 'object') {
        data.savedAt = Date.now();
      }
      auth.user.slots[index] = data;
      saveDb(db);
      return send(res, 200, {
        ok: true,
        msg: data ? `Slot ${index + 1} saved.` : `Slot ${index + 1} cleared.`,
        index,
        meta: slotMeta(data),
      });
    }

    return send(res, 404, { ok: false, msg: 'Not found.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'server error';
    if (msg === 'invalid json') return send(res, 400, { ok: false, msg: 'Invalid JSON body.' });
    if (msg === 'body too large') return send(res, 413, { ok: false, msg: 'Save too large.' });
    console.error(err);
    return send(res, 500, { ok: false, msg: 'Server error.' });
  }
}

const server = http.createServer((req, res) => {
  void handle(req, res);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('ForgeHeart account server');
  console.log(`  listening  http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
  console.log(`  data file  ${DB_PATH}`);
  console.log('');
  console.log('Endpoints: /health  /register  /login  /logout  /me  /slots  PUT /slots/0..2');
  console.log('');
  console.log('Expose to the internet (for GitHub Pages clients):');
  console.log('  cloudflared tunnel --url http://127.0.0.1:' + PORT);
  console.log('  # then paste the https://….trycloudflare.com URL into the game title screen');
  console.log('');
});
