/**
 * Multiplayer wire protocol (Layer N).
 * JSON text frames over WebSocket. Keep small — presence first, economy later.
 */

import type { GameMode } from './mode';

export const MP_PROTOCOL_VERSION = 1;

export type MpServerMsg =
  | {
      t: 'hello';
      protocol: number;
      serverTime: number;
    }
  | {
      t: 'room';
      roomId: string;
      code: string;
      mode: GameMode;
      you: string;
      players: MpPlayerPublic[];
    }
  | {
      t: 'players';
      players: MpPlayerPublic[];
    }
  | {
      t: 'pose';
      id: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
    }
  | {
      t: 'chat';
      id: string;
      name: string;
      text: string;
    }
  | {
      t: 'error';
      code: string;
      msg: string;
    }
  | {
      t: 'pong';
      t0: number;
    };

export type MpClientMsg =
  | {
      t: 'join';
      code?: string;
      /** Create new room when true or when no code */
      create?: boolean;
      mode?: GameMode;
      name?: string;
      token?: string;
    }
  | {
      t: 'pose';
      x: number;
      y: number;
      z: number;
      yaw: number;
    }
  | {
      t: 'chat';
      text: string;
    }
  | {
      t: 'ping';
      t0: number;
    }
  | {
      t: 'leave';
    };

export interface MpPlayerPublic {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Residential home pad index 0–8 when assigned */
  homePad?: number;
}

export function parseClientMsg(raw: string): MpClientMsg | null {
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.t !== 'string') return null;
    return o as MpClientMsg;
  } catch {
    return null;
  }
}

export function encodeMsg(msg: MpServerMsg | MpClientMsg): string {
  return JSON.stringify(msg);
}
