/**
 * Multiplayer mode + ownership adapters (Layer M / N).
 *
 * Pure types — usable from browser SP and Node room host.
 * SP uses mode 'sp' with a single wallet; co-op shares one team inv;
 * competitive maps playerId → private inv.
 */

export type GameMode = 'sp' | 'coop' | 'comp';

export type ActorRef =
  | { kind: 'solo' }
  | { kind: 'team' }
  | { kind: 'player'; playerId: string };

/** Who may mutate a stall / plot / crew for the current mode. */
export type OwnerRef =
  | { kind: 'solo' }
  | { kind: 'team' }
  | { kind: 'player'; playerId: string };

export function actorForMode(mode: GameMode, playerId?: string): ActorRef {
  if (mode === 'sp') return { kind: 'solo' };
  if (mode === 'coop') return { kind: 'team' };
  return { kind: 'player', playerId: playerId ?? 'unknown' };
}

export function ownersEqual(a: OwnerRef, b: OwnerRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'player' && b.kind === 'player') return a.playerId === b.playerId;
  return true;
}

/**
 * Reputation source for market attract.
 * Co-op: team standing aggregate (caller supplies summed values).
 * Comp / SP: per-player or solo inv standing.
 */
export interface ReputationView {
  empireStanding: number;
  districtStanding: number;
  avgKnownAffinity: number;
}

export function reputationViewFromSolo(inv: {
  empireStanding?: number;
  districtStanding?: Record<string, number>;
  neighborLife?: { neighbors?: { known?: boolean; affinity?: number }[] };
}, districtId?: string | null): ReputationView {
  const neighbors = inv.neighborLife?.neighbors ?? [];
  const known = neighbors.filter((n) => n.known);
  const avg =
    known.length > 0
      ? known.reduce((s, n) => s + (n.affinity ?? 0), 0) / known.length
      : 0;
  const ds =
    districtId && inv.districtStanding
      ? inv.districtStanding[districtId] ?? 0
      : 0;
  return {
    empireStanding: inv.empireStanding ?? 0,
    districtStanding: ds,
    avgKnownAffinity: avg,
  };
}

/** Co-op: average or max of member standings (v1 = average). */
export function aggregateTeamReputation(members: ReputationView[]): ReputationView {
  if (!members.length) {
    return { empireStanding: 0, districtStanding: 0, avgKnownAffinity: 0 };
  }
  const n = members.length;
  return {
    empireStanding: members.reduce((s, m) => s + m.empireStanding, 0) / n,
    districtStanding: members.reduce((s, m) => s + m.districtStanding, 0) / n,
    avgKnownAffinity: members.reduce((s, m) => s + m.avgKnownAffinity, 0) / n,
  };
}

/**
 * P2P / mode policy locks from MULTIPLAYER_PLAN M8.
 * Pure booleans for room authority checks.
 */
export const MODE_POLICY = {
  /** Poach employees within same co-op team */
  allowPoachWithinTeam: false,
  /** Teammates buy from team stall for brass (prefer warehouse withdraw) */
  allowTeamStallBuy: false,
  /** Pure co-op v1: listing plots for sale (no second team) */
  allowPlotListInSoloCoop: false,
  /** Competitive: full P2P plot / stall / poach */
  allowP2PInComp: true,
  maxPlayers: 9,
  talkAffinityCooldownMs: 60_000,
  giftAffinityCooldownMs: 30_000,
  poachCooldownMs: 5 * 60_000,
} as const;
