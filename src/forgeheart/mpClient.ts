/**
 * Multiplayer client (Layer N presence slice).
 * Connect to home-PC mp-server via WS (or tunnel wss).
 */

import {
  encodeMsg,
  type MpClientMsg,
  type MpPlayerPublic,
  type MpServerMsg,
  MP_PROTOCOL_VERSION,
} from './sim/protocol';
import type { GameMode } from './sim/mode';

const STORAGE_URL = 'forgeheart_mp_url';
const DEFAULT_LOCAL = 'ws://127.0.0.1:8790';

export type MpStatus = 'idle' | 'connecting' | 'joined' | 'error';

export interface MpSession {
  roomId: string;
  code: string;
  mode: GameMode;
  you: string;
  players: Map<string, MpPlayerPublic>;
}

export type MpListener = {
  onStatus?: (s: MpStatus, detail?: string) => void;
  onRoom?: (session: MpSession) => void;
  onPlayers?: (players: MpPlayerPublic[]) => void;
  onPose?: (id: string, x: number, y: number, z: number, yaw: number) => void;
  onChat?: (name: string, text: string) => void;
  onError?: (code: string, msg: string) => void;
};

export function getMpUrl(): string {
  try {
    const s = localStorage.getItem(STORAGE_URL);
    if (s) return s;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCAL;
}

export function setMpUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_URL, url.trim());
  } catch {
    /* ignore */
  }
}

/** Load bundled / public config (mp-api.json) if present. */
export async function loadMpApiConfig(): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const r = await fetch(`${base}mp-api.json`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { url?: string };
    if (j.url && typeof j.url === 'string') {
      setMpUrl(j.url);
      return j.url;
    }
  } catch {
    /* ignore */
  }
  // Dev hint written by mp-server
  try {
    const base = import.meta.env.BASE_URL || '/';
    const r = await fetch(`${base}mp-api.local.json`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { url?: string };
    if (j.url) {
      setMpUrl(j.url);
      return j.url;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function httpToWsUrl(httpUrl: string): string {
  const u = httpUrl.trim().replace(/\/$/, '');
  if (u.startsWith('ws://') || u.startsWith('wss://')) return u;
  if (u.startsWith('https://')) return 'wss://' + u.slice('https://'.length);
  if (u.startsWith('http://')) return 'ws://' + u.slice('http://'.length);
  return u;
}

export class MpClient {
  private ws: WebSocket | null = null;
  private listeners: MpListener = {};
  session: MpSession | null = null;
  status: MpStatus = 'idle';
  lastError = '';

  setListeners(l: MpListener) {
    this.listeners = l;
  }

  private setStatus(s: MpStatus, detail?: string) {
    this.status = s;
    this.listeners.onStatus?.(s, detail);
  }

  private send(msg: MpClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMsg(msg));
    }
  }

  connectAndJoin(opts: {
    url?: string;
    create?: boolean;
    code?: string;
    mode?: GameMode;
    name?: string;
  }): void {
    const url = httpToWsUrl(opts.url || getMpUrl());
    this.disconnect();
    this.setStatus('connecting', url);
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.lastError = String(e);
      this.setStatus('error', this.lastError);
      return;
    }

    this.ws.onopen = () => {
      this.send({
        t: 'join',
        create: opts.create ?? !opts.code,
        code: opts.code,
        mode: opts.mode === 'comp' ? 'comp' : 'coop',
        name: opts.name || 'Pilot',
      });
    };

    this.ws.onmessage = (ev) => {
      let msg: MpServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as MpServerMsg;
      } catch {
        return;
      }
      if (msg.t === 'hello') {
        if (msg.protocol !== MP_PROTOCOL_VERSION) {
          this.listeners.onError?.(
            'protocol',
            `Server protocol ${msg.protocol} ≠ client ${MP_PROTOCOL_VERSION}`,
          );
        }
        return;
      }
      if (msg.t === 'error') {
        this.lastError = msg.msg;
        this.setStatus('error', msg.msg);
        this.listeners.onError?.(msg.code, msg.msg);
        return;
      }
      if (msg.t === 'room') {
        this.session = {
          roomId: msg.roomId,
          code: msg.code,
          mode: msg.mode,
          you: msg.you,
          players: new Map(msg.players.map((p) => [p.id, p])),
        };
        this.setStatus('joined', msg.code);
        this.listeners.onRoom?.(this.session);
        this.listeners.onPlayers?.(msg.players);
        return;
      }
      if (msg.t === 'players' && this.session) {
        this.session.players = new Map(msg.players.map((p) => [p.id, p]));
        this.listeners.onPlayers?.(msg.players);
        return;
      }
      if (msg.t === 'pose') {
        const p = this.session?.players.get(msg.id);
        if (p) {
          p.x = msg.x;
          p.y = msg.y;
          p.z = msg.z;
          p.yaw = msg.yaw;
        }
        this.listeners.onPose?.(msg.id, msg.x, msg.y, msg.z, msg.yaw);
        return;
      }
      if (msg.t === 'chat') {
        this.listeners.onChat?.(msg.name, msg.text);
      }
    };

    this.ws.onerror = () => {
      this.lastError = 'WebSocket error';
      this.setStatus('error', 'WebSocket error — is mp-server running?');
    };

    this.ws.onclose = () => {
      if (this.status === 'joined') this.setStatus('idle', 'disconnected');
      this.ws = null;
      this.session = null;
    };
  }

  sendPose(x: number, y: number, z: number, yaw: number) {
    this.send({ t: 'pose', x, y, z, yaw });
  }

  sendChat(text: string) {
    this.send({ t: 'chat', text });
  }

  disconnect() {
    if (this.ws) {
      try {
        this.send({ t: 'leave' });
        this.ws.close();
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    this.session = null;
    this.setStatus('idle');
  }

  get remotes(): MpPlayerPublic[] {
    if (!this.session) return [];
    return [...this.session.players.values()].filter((p) => p.id !== this.session!.you);
  }
}

export const mpClient = new MpClient();
