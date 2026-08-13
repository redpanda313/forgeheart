/**
 * Labor market — housing as supply constraint for hireable humans.
 *
 * Soft start ~25–30 crew: baseline open labor covers early empire.
 * After that, player residential capacity expands the labor pool.
 * Tight market → hire cost / wages up; at hard cap hire fails.
 */

import type { PlotState, PlazaPlotsState } from './plazaPlots';
import type { NeighborState, NeighborLifeState } from './neighborLife';

/** Human crew size where housing starts mattering for labor. */
export const LABOR_HOUSING_SOFT_START = 25;
/** Open labor pool before housing development (covers early game ~25–30). */
export const LABOR_BASELINE_POOL = 30;
/** Each housing bed on player land adds this many hireable humans to supply. */
export const LABOR_PER_HOUSING_SLOT = 1;
/** Filled tenant households slightly deepen the local labor market. */
export const LABOR_PER_TENANT_BONUS = 0.35;
/** Wage/hire cost mul when fully tight (at supply). */
export const LABOR_TIGHT_WAGE_MUL = 2.4;
/** Soft warning band starts this many workers below supply. */
export const LABOR_PRESSURE_WARN_BELOW = 6;

export interface HousingCapacity {
  /** Total tenant beds on player residential builds */
  slots: number;
  /** Occupied beds (player plot tenants + player-owned neighbor pads) */
  occupied: number;
  vacant: number;
  homes: number;
  apartments: number;
}

export interface LaborMarketSnapshot {
  humanWorkers: number;
  robotWorkers: number;
  totalWorkers: number;
  housing: HousingCapacity;
  /** Max human workers sustainable at current housing */
  laborSupply: number;
  /** 0 = loose, 1 = at/over supply */
  tightness: number;
  /** Multiplier on human hire cost & wages */
  wageMul: number;
  hireCostMul: number;
  canHireHuman: boolean;
  /** One-line HUD / hire board */
  line: string;
  /** Soft-goal style coach when pressure bites */
  coach: string | null;
}

function buildingHousingSlots(kind: string, tenantSlots?: number): number {
  if (kind === 'apartment') return Math.max(1, tenantSlots ?? 2);
  if (kind === 'home') return Math.max(1, tenantSlots ?? 1);
  return 0;
}

/** Count residential capacity on player-owned plaza plots. */
export function countPlayerHousing(plots: PlazaPlotsState | PlotState[]): HousingCapacity {
  const list = Array.isArray(plots) ? plots : plots.plots;
  let slots = 0;
  let occupied = 0;
  let homes = 0;
  let apartments = 0;
  for (const p of list) {
    if (p.owner !== 'player') continue;
    let plotSlots = 0;
    for (const b of p.buildings ?? []) {
      const s = buildingHousingSlots(b.kind, b.tenantSlots);
      if (s <= 0) continue;
      plotSlots += s;
      if (b.kind === 'home') homes += 1;
      if (b.kind === 'apartment') apartments += 1;
    }
    // Legacy retailBound-only lots don't house
    if (plotSlots <= 0) continue;
    slots += plotSlots;
    if (p.tenantNeighborId && !p.vacant) {
      // One household per plot for v1 (even if apartment has 2 beds — second bed via vacant flag later)
      occupied += Math.min(plotSlots, 1);
    }
  }
  return {
    slots,
    occupied,
    vacant: Math.max(0, slots - occupied),
    homes,
    apartments,
  };
}

/** Neighbor pads the player owns that can house a tenant. */
export function countPlayerNeighborPadHousing(
  neighbors: NeighborState[],
): { slots: number; occupied: number } {
  let slots = 0;
  let occupied = 0;
  for (const n of neighbors) {
    if (n.homeOwner !== 'player') continue;
    // One home per neighbor pad entity
    slots += 1;
    if (n.isPlayerTenant && !n.vacated) occupied += 1;
  }
  return { slots, occupied };
}

export function totalHousingCapacity(
  plots: PlazaPlotsState,
  neighbors: NeighborState[],
): HousingCapacity {
  const plotH = countPlayerHousing(plots);
  const padH = countPlayerNeighborPadHousing(neighbors);
  const slots = plotH.slots + padH.slots;
  const occupied = plotH.occupied + padH.occupied;
  return {
    slots,
    occupied,
    vacant: Math.max(0, slots - occupied),
    homes: plotH.homes,
    apartments: plotH.apartments,
  };
}

/**
 * Labor supply = baseline open market + housing beds (developed capacity)
 * + small bonus for settled tenants (community attract).
 */
export function computeLaborSupply(housing: HousingCapacity): number {
  const fromHousing = Math.floor(housing.slots * LABOR_PER_HOUSING_SLOT);
  const fromTenants = Math.floor(housing.occupied * LABOR_PER_TENANT_BONUS);
  return Math.max(LABOR_BASELINE_POOL, LABOR_BASELINE_POOL + fromHousing + fromTenants);
}

export function isRobotWorkerLike(w: { kind?: string }): boolean {
  return w.kind === 'robot';
}

export function computeLaborMarket(opts: {
  workers: { kind?: string }[];
  plots: PlazaPlotsState;
  neighbors: NeighborState[];
}): LaborMarketSnapshot {
  const humanWorkers = opts.workers.filter((w) => !isRobotWorkerLike(w)).length;
  const robotWorkers = opts.workers.length - humanWorkers;
  const housing = totalHousingCapacity(opts.plots, opts.neighbors);
  const laborSupply = computeLaborSupply(housing);
  const tightness =
    laborSupply <= 0
      ? 1
      : Math.max(0, Math.min(1, humanWorkers / laborSupply));
  // Wage pressure ramps in the top third of utilization
  const pressure = Math.max(0, (tightness - 0.55) / 0.45);
  const wageMul = 1 + pressure * (LABOR_TIGHT_WAGE_MUL - 1);
  const hireCostMul = wageMul;
  const canHireHuman = humanWorkers < laborSupply;

  let line: string;
  if (humanWorkers < LABOR_HOUSING_SOFT_START && housing.slots === 0) {
    line = `Labor open · humans ${humanWorkers}/${laborSupply} (housing optional until ~${LABOR_HOUSING_SOFT_START})`;
  } else if (canHireHuman) {
    line = `Labor ${humanWorkers}/${laborSupply} humans · housing ${housing.occupied}/${housing.slots} beds · wage ×${wageMul.toFixed(2)}`;
  } else {
    line = `Labor tight · ${humanWorkers}/${laborSupply} humans — build housing to hire more · wage ×${wageMul.toFixed(2)}`;
  }

  let coach: string | null = null;
  if (!canHireHuman) {
    coach =
      'No free hands on the market. Develop apartments/homes on your pads so migrants move in — then hire.';
  } else if (
    humanWorkers >= LABOR_HOUSING_SOFT_START - LABOR_PRESSURE_WARN_BELOW &&
    housing.slots < Math.max(1, humanWorkers - LABOR_BASELINE_POOL + 4)
  ) {
    coach = `Crew is growing (${humanWorkers}). Build residential pads before wages spike and hiring freezes.`;
  } else if (tightness >= 0.8) {
    coach = 'Labor market is heating up — more housing lowers wages and opens hire slots.';
  }

  return {
    humanWorkers,
    robotWorkers,
    totalWorkers: opts.workers.length,
    housing,
    laborSupply,
    tightness,
    wageMul,
    hireCostMul,
    canHireHuman,
    line,
    coach,
  };
}

/** True if this NPC already holds a home (cannot take a second). */
export function npcAlreadyHasHome(
  n: NeighborState,
  plots: PlazaPlotsState,
  allNeighbors: NeighborState[],
): boolean {
  if (n.isPlayerTenant && !n.vacated) return true;
  if (n.homeless) return false;
  if (n.vacated) return false;
  // Self-owned or landlord pad still "their" home if not vacated
  if (
    (n.homeOwner === 'self' || n.homeOwner === 'npc_landlord' || n.homeOwner === 'city') &&
    !n.vacated
  ) {
    // Plaza homeowners / ring cast — one home
    return true;
  }
  if (n.homeOwner === 'player' && !n.vacated) return true;
  // Listed as tenant on any plot
  for (const p of plots.plots) {
    if (p.tenantNeighborId === n.id && !p.vacant) return true;
  }
  void allNeighbors;
  return false;
}

export function laborMarketFromInv(inv: {
  workers: { kind?: string }[];
  plazaPlots: PlazaPlotsState;
  neighborLife: NeighborLifeState;
}): LaborMarketSnapshot {
  return computeLaborMarket({
    workers: inv.workers,
    plots: inv.plazaPlots,
    neighbors: inv.neighborLife?.neighbors ?? [],
  });
}
