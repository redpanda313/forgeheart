/**
 * Lightest cloud accounts client for home-PC account server.
 * Username + password · 3 slots · no email / OAuth.
 */

import type { ForgeSaveData } from './save';
import { SLOT_COUNT } from './save';

const TOKEN_KEY = 'forgeheart-account-token';
const USER_KEY = 'forgeheart-account-user';
const API_URL_KEY = 'forgeheart-account-api-url';

/** Filled once from public/account-api.json (GitHub Pages auto-default). */
let bundledApiUrl = '';

export interface AccountSlotInfo {
  index: number;
  empty: boolean;
  label: string;
  sublabel: string;
  savedAt: number | null;
  levelId: string | null;
  data: ForgeSaveData | null;
}

export interface AccountSession {
  token: string;
  username: string;
}

function trimUrl(u: string): string {
  return u.trim().replace(/\/+$/, '');
}

/**
 * Resolve API base, in order:
 * 1. localStorage (player override / last successful URL)
 * 2. public/account-api.json bundled with the site
 * 3. VITE_ACCOUNT_API_URL at build time
 * 4. localhost when playing on this machine
 */
export function getAccountApiUrl(): string {
  try {
    const stored = localStorage.getItem(API_URL_KEY);
    if (stored && stored.trim()) return trimUrl(stored);
  } catch {
    /* ignore */
  }
  if (bundledApiUrl) return bundledApiUrl;
  const env = (import.meta as ImportMeta & { env?: { VITE_ACCOUNT_API_URL?: string } }).env
    ?.VITE_ACCOUNT_API_URL;
  if (env && String(env).trim()) return trimUrl(String(env));
  // Local dev default
  if (typeof location !== 'undefined' && /localhost|127\.0\.0\.1/.test(location.hostname)) {
    return 'http://127.0.0.1:8787';
  }
  return '';
}

export function setAccountApiUrl(url: string): void {
  const u = trimUrl(url);
  try {
    if (u) localStorage.setItem(API_URL_KEY, u);
    else localStorage.removeItem(API_URL_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Load default server URL from the static site (account-api.json).
 * Safe to call multiple times; no-ops if already loaded or offline.
 */
export async function loadAccountApiConfig(): Promise<string> {
  // Already have a player override
  try {
    const stored = localStorage.getItem(API_URL_KEY);
    if (stored && stored.trim()) return trimUrl(stored);
  } catch {
    /* ignore */
  }

  try {
    const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL || './';
    const url = `${base}account-api.json`.replace(/([^:]\/)\/+/g, '$1');
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const j = (await res.json()) as { url?: string };
      if (j?.url && String(j.url).trim()) {
        bundledApiUrl = trimUrl(String(j.url));
      }
    }
  } catch {
    /* missing file / offline */
  }

  return getAccountApiUrl();
}

export function getSession(): AccountSession | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const username = localStorage.getItem(USER_KEY);
    if (!token || !username) return null;
    return { token, username };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

function setSession(token: string, username: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, username);
}

export function isLoggedIn(): boolean {
  return !!getSession();
}

async function api<T extends { ok: boolean; msg?: string }>(
  path: string,
  opts?: {
    method?: string;
    body?: unknown;
    auth?: boolean;
  },
): Promise<T> {
  const base = getAccountApiUrl();
  if (!base) {
    return { ok: false, msg: 'Set account server URL first (title screen).' } as T;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts?.auth !== false) {
    const s = getSession();
    if (s) headers.Authorization = `Bearer ${s.token}`;
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    if (!res.ok && data && typeof data === 'object' && !('ok' in data)) {
      return { ok: false, msg: `HTTP ${res.status}` } as T;
    }
    if (!res.ok && data?.ok !== false) {
      return { ...data, ok: false, msg: data.msg || `HTTP ${res.status}` };
    }
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error';
    return {
      ok: false,
      msg: `Cannot reach account server (${msg}). Is it running / is the URL a public tunnel?`,
    } as T;
  }
}

export async function pingAccountServer(): Promise<{ ok: boolean; msg: string }> {
  const base = getAccountApiUrl();
  if (!base) return { ok: false, msg: 'No server URL set.' };
  try {
    const res = await fetch(`${base}/health`, { method: 'GET' });
    const data = (await res.json()) as { ok?: boolean; service?: string };
    if (res.ok && data?.ok) {
      return { ok: true, msg: `Server online · ${data.service || 'accounts'}` };
    }
    return { ok: false, msg: `Server responded ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'offline';
    return { ok: false, msg: `Offline: ${msg}` };
  }
}

export async function registerAccount(
  username: string,
  password: string,
): Promise<{ ok: boolean; msg: string }> {
  const r = await api<{ ok: boolean; msg?: string; token?: string; username?: string }>(
    '/register',
    {
      method: 'POST',
      body: { username, password },
      auth: false,
    },
  );
  if (r.ok && r.token && r.username) {
    setSession(r.token, r.username);
  }
  return { ok: !!r.ok, msg: r.msg || (r.ok ? 'Registered.' : 'Register failed.') };
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<{ ok: boolean; msg: string }> {
  const r = await api<{ ok: boolean; msg?: string; token?: string; username?: string }>(
    '/login',
    {
      method: 'POST',
      body: { username, password },
      auth: false,
    },
  );
  if (r.ok && r.token && r.username) {
    setSession(r.token, r.username);
  }
  return { ok: !!r.ok, msg: r.msg || (r.ok ? 'Logged in.' : 'Login failed.') };
}

export async function logoutAccount(): Promise<void> {
  try {
    await api('/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  clearSession();
}

export async function fetchCloudSlots(): Promise<{
  ok: boolean;
  msg: string;
  slots: AccountSlotInfo[];
}> {
  const r = await api<{
    ok: boolean;
    msg?: string;
    slots?: AccountSlotInfo[];
  }>('/slots');
  if (!r.ok || !Array.isArray(r.slots)) {
    return { ok: false, msg: r.msg || 'Could not load slots.', slots: [] };
  }
  const slots = r.slots.map((s, i) => ({
    index: typeof s.index === 'number' ? s.index : i,
    empty: !!s.empty || !s.data,
    label: s.label || (s.data ? s.data.levelName : 'Empty'),
    sublabel: s.sublabel || `Slot ${(s.index ?? i) + 1}`,
    savedAt: s.savedAt ?? s.data?.savedAt ?? null,
    levelId: s.levelId ?? s.data?.levelId ?? null,
    data: (s.data as ForgeSaveData | null) ?? null,
  }));
  while (slots.length < SLOT_COUNT) {
    const i = slots.length;
    slots.push({
      index: i,
      empty: true,
      label: 'Empty',
      sublabel: `Slot ${i + 1}`,
      savedAt: null,
      levelId: null,
      data: null,
    });
  }
  return { ok: true, msg: 'ok', slots: slots.slice(0, SLOT_COUNT) };
}

/** Upload a full save blob to cloud slot (also keep local cache). */
export async function writeCloudSlot(
  index: number,
  data: ForgeSaveData | null,
): Promise<{ ok: boolean; msg: string }> {
  if (index < 0 || index >= SLOT_COUNT) {
    return { ok: false, msg: 'Bad slot.' };
  }
  if (!isLoggedIn()) return { ok: false, msg: 'Not logged in.' };
  const r = await api<{ ok: boolean; msg?: string }>(`/slots/${index}`, {
    method: 'PUT',
    body: { data },
  });
  return { ok: !!r.ok, msg: r.msg || (r.ok ? 'Saved.' : 'Save failed.') };
}

/**
 * First-time / empty-slot migrate: push this device’s local saves into
 * cloud slots that are empty. Never overwrites an occupied cloud slot.
 *
 * Call BEFORE applying cloud → local, so local progress isn’t wiped first.
 */
export async function migrateLocalSlotsToEmptyCloud(
  cloudSlots: AccountSlotInfo[],
  localSlots: { index: number; empty: boolean; data: ForgeSaveData | null }[],
): Promise<{ migrated: number; failed: number; slots: AccountSlotInfo[] }> {
  const out = cloudSlots.map((s) => ({ ...s }));
  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const cloud = out.find((s) => s.index === i) ?? out[i];
    const local = localSlots.find((s) => s.index === i) ?? localSlots[i];
    const cloudEmpty = !cloud || cloud.empty || !cloud.data;
    const localData = local && !local.empty ? local.data : null;
    if (!cloudEmpty || !localData) continue;

    const r = await writeCloudSlot(i, localData);
    if (!r.ok) {
      failed += 1;
      continue;
    }
    migrated += 1;
    const when = localData.savedAt ? new Date(localData.savedAt) : new Date();
    const time = when.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const next: AccountSlotInfo = {
      index: i,
      empty: false,
      label: localData.levelName || localData.levelId || 'Save',
      sublabel: `Slot ${i + 1} · ${time}`,
      savedAt: localData.savedAt ?? Date.now(),
      levelId: localData.levelId ?? null,
      data: localData,
    };
    const idx = out.findIndex((s) => s.index === i);
    if (idx >= 0) out[idx] = next;
    else out[i] = next;
  }

  return { migrated, failed, slots: out };
}
