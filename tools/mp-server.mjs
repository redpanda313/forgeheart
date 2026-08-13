#!/usr/bin/env node
/**
 * ForgeHeart multiplayer room host (Layer N vertical slice).
 *
 * Presence + join codes first. Economy authority comes later (Path A/B).
 *
 *   npm run mp
 *   cloudflared tunnel --url http://127.0.0.1:8790
 *
 * Env:
 *   FORGEHEART_MP_PORT   default 8790
 *   FORGEHEART_MP_HOST   default 0.0.0.0
 */

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.FORGEHEART_MP_PORT || 8790);
const HOST = process.env.FORGEHEART_MP_HOST || '0.0.0.0';
const PROTOCOL = 1;
const MAX_PLAYERS = 9;
const CODE_LEN = 5;

/** @typedef {{ id: string, name: string, x: number, y: number, z: number, yaw: number, homePad: number, ws: import('ws').WebSocket }} Seat */
/** @typedef {{ id: string, code: string, mode: 'coop'|'comp'|'sp', players: Map<string, Seat>, createdAt: number }} Room */

/** @type {Map<string, Room>} */
const roomsByCode = new Map();
/** @type {Map<string, Room>} */
const roomsById = new Map();

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const buf = randomBytes(CODE_LEN);
  for (let i = 0; i < CODE_LEN; i++) s += alphabet[buf[i] % alphabet.length];
  if (roomsByCode.has(s)) return makeCode();
  return s;
}

function makeId(prefix) {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    homePad: p.homePad,
  }));
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId) {
  const raw = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (exceptId && p.id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(raw);
  }
}

function createRoom(mode = 'coop') {
  const code = makeCode();
  const id = makeId('room');
  /** @type {Room} */
  const room = {
    id,
    code,
    mode: mode === 'comp' ? 'comp' : 'coop',
    players: new Map(),
    createdAt: Date.now(),
  };
  roomsByCode.set(code, room);
  roomsById.set(id, room);
  return room;
}

function nextHomePad(room) {
  const used = new Set([...room.players.values()].map((p) => p.homePad));
  for (let i = 0; i < MAX_PLAYERS; i++) {
    if (!used.has(i)) return i;
  }
  return 0;
}

function leaveRoom(seat) {
  if (!seat?.roomCode) return;
  const room = roomsByCode.get(seat.roomCode);
  if (!room) return;
  room.players.delete(seat.id);
  broadcast(room, { t: 'players', players: publicPlayers(room) });
  if (room.players.size === 0) {
    roomsByCode.delete(room.code);
    roomsById.delete(room.id);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'forgeheart-mp',
        protocol: PROTOCOL,
        rooms: roomsByCode.size,
        players: [...roomsByCode.values()].reduce((n, r) => n + r.players.size, 0),
      }),
    );
    return;
  }

  if (url.pathname === '/rooms' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        rooms: [...roomsByCode.values()].map((r) => ({
          code: r.code,
          mode: r.mode,
          players: r.players.size,
          max: MAX_PLAYERS,
        })),
      }),
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, msg: 'not found' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  /** @type {Seat | null} */
  let seat = null;

  send(ws, { t: 'hello', protocol: PROTOCOL, serverTime: Date.now() });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      send(ws, { t: 'error', code: 'bad_json', msg: 'Invalid JSON' });
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'ping') {
      send(ws, { t: 'pong', t0: msg.t0 ?? Date.now() });
      return;
    }

    if (msg.t === 'join') {
      if (seat) {
        send(ws, { t: 'error', code: 'already_joined', msg: 'Already in a room' });
        return;
      }
      const create = !!msg.create || !msg.code;
      let room;
      if (create) {
        room = createRoom(msg.mode === 'comp' ? 'comp' : 'coop');
      } else {
        const code = String(msg.code || '')
          .trim()
          .toUpperCase();
        room = roomsByCode.get(code);
        if (!room) {
          send(ws, { t: 'error', code: 'no_room', msg: `No room with code ${code}` });
          return;
        }
      }
      if (room.players.size >= MAX_PLAYERS) {
        send(ws, { t: 'error', code: 'full', msg: 'Room is full (max 9)' });
        return;
      }
      const id = makeId('p');
      const homePad = nextHomePad(room);
      // Residential ring spread — matches plan "1 pad per joiner"
      const angle = (homePad / MAX_PLAYERS) * Math.PI * 2;
      const radius = 28;
      seat = {
        id,
        name: String(msg.name || `Pilot ${homePad + 1}`).slice(0, 24),
        x: Math.sin(angle) * radius,
        y: 1.75,
        z: Math.cos(angle) * radius,
        yaw: angle + Math.PI,
        homePad,
        ws,
        roomCode: room.code,
      };
      room.players.set(id, seat);
      send(ws, {
        t: 'room',
        roomId: room.id,
        code: room.code,
        mode: room.mode,
        you: id,
        players: publicPlayers(room),
      });
      broadcast(room, { t: 'players', players: publicPlayers(room) }, id);
      console.log(`[mp] ${seat.name} joined ${room.code} (${room.players.size}/${MAX_PLAYERS}) mode=${room.mode}`);
      return;
    }

    if (!seat) {
      send(ws, { t: 'error', code: 'not_joined', msg: 'Join a room first' });
      return;
    }

    if (msg.t === 'pose') {
      seat.x = Number(msg.x) || 0;
      seat.y = Number(msg.y) || 1.75;
      seat.z = Number(msg.z) || 0;
      seat.yaw = Number(msg.yaw) || 0;
      const room = roomsByCode.get(seat.roomCode);
      if (room) {
        broadcast(
          room,
          {
            t: 'pose',
            id: seat.id,
            x: seat.x,
            y: seat.y,
            z: seat.z,
            yaw: seat.yaw,
          },
          seat.id,
        );
      }
      return;
    }

    if (msg.t === 'chat') {
      const text = String(msg.text || '').slice(0, 160);
      if (!text) return;
      const room = roomsByCode.get(seat.roomCode);
      if (room) {
        broadcast(room, {
          t: 'chat',
          id: seat.id,
          name: seat.name,
          text,
        });
      }
      return;
    }

    if (msg.t === 'leave') {
      leaveRoom(seat);
      seat = null;
    }
  });

  ws.on('close', () => {
    if (seat) {
      console.log(`[mp] ${seat.name} left ${seat.roomCode}`);
      leaveRoom(seat);
      seat = null;
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ForgeHeart MP server ws/http://${HOST}:${PORT}`);
  console.log(`  health: http://127.0.0.1:${PORT}/health`);
  console.log(`  tunnel: cloudflared tunnel --url http://127.0.0.1:${PORT}`);
  // Optional local hint file for dev clients
  try {
    const hint = path.join(ROOT, 'public', 'mp-api.local.json');
    fs.writeFileSync(
      hint,
      JSON.stringify({ url: `ws://127.0.0.1:${PORT}`, updatedAt: new Date().toISOString() }, null, 2),
    );
  } catch {
    /* ignore */
  }
});
