/**
 * Plaza plot grid (Tasks 4–6) — 3×3 square plots per district,
 * ownership, lease-office buy flow, tenant rent.
 */

import type { RentPolicy } from './neighborLife';
import { rentIncomeForPad, PREDATORY_LEAVE_CHANCE, homeownerNeighborId } from './neighborLife';

export type PlotOwnerKind = 'city' | 'npc' | 'player';

export type ZoningHint =
  | 'residential'
  | 'retail'
  | 'industrial'
  | 'mixed'
  | 'garden';

/** Task 7 build catalog kinds */
export type PlotBuildKind =
  | 'empty'
  | 'home'
  | 'apartment'
  | 'decor'
  | 'garden'
  | 'factory'
  | 'retail'
  | 'bridge';

export interface PlotBuildingStub {
  kind: PlotBuildKind;
  tenantSlots?: number;
  /** Local offset on platform (free placement) */
  lx?: number;
  lz?: number;
  /** Local yaw degrees for the building */
  yaw?: number;
  /** Bridge facing: 0=+X 1=+Z 2=-X 3=-Z (legacy) */
  facing?: number;
  /** Player bridge: linked neighbor plot */
  bridgeToPlotId?: string | null;
  paid?: number;
}

export interface PlotState {
  id: string;
  districtId: string;
  cellX: number;
  cellY: number;
  /**
   * Free world XZ of the platform center.
   * Defaults from grid cell; move updates these (not locked to grid).
   */
  worldX?: number;
  worldZ?: number;
  owner: PlotOwnerKind;
  /** Neighbor / homeowner id when npc-owned or player tenant link */
  npcOwnerId: string | null;
  zoningHint: ZoningHint;
  buildings: PlotBuildingStub[];
  rentPolicy: RentPolicy | null;
  /** Neighbor id paying rent on this plot (if any) */
  tenantNeighborId: string | null;
  shape: 'square';
  /** Degrees — free rotation, UI snaps 90° for now */
  rotation: number;
  layer: number;
  listPrice: number;
  forSale: boolean;
  /** Vacant after predatory leave — no rent until re-tenant */
  vacant: boolean;
  /** Task 9: true if outside core 0..2 ring */
  isEdge?: boolean;
  /** Retail bound to district stall */
  retailBound?: boolean;
}

export interface PlotBuildDef {
  kind: PlotBuildKind;
  name: string;
  cost: number;
  blurb: string;
  preferredZoning: ZoningHint[];
  /** Replaces prior primary structure */
  primary?: boolean;
  tenantSlots?: number;
}

export const PLOT_BUILD_CATALOG: PlotBuildDef[] = [
  {
    kind: 'apartment',
    name: 'Apartment row',
    cost: 8_500,
    blurb: 'Tenant capacity · rent income',
    preferredZoning: ['residential', 'mixed'],
    primary: true,
    tenantSlots: 2,
  },
  {
    kind: 'decor',
    name: 'Plaza décor',
    cost: 1_800,
    blurb: 'Soft standing / foot traffic',
    preferredZoning: ['residential', 'retail', 'mixed', 'garden'],
  },
  {
    kind: 'garden',
    name: 'Flower garden',
    cost: 5_500,
    blurb: 'Harvest blooms on this plot',
    preferredZoning: ['residential', 'garden', 'mixed'],
    primary: true,
  },
  {
    kind: 'factory',
    name: 'Factory pad',
    cost: 18_000,
    blurb: 'Industrial waypoint (not bonded storage)',
    preferredZoning: ['industrial', 'mixed'],
    primary: true,
  },
  {
    kind: 'retail',
    name: 'Retail front',
    cost: 14_000,
    blurb: 'Bind district stall lease to this plot',
    preferredZoning: ['retail', 'mixed'],
    primary: true,
  },
  {
    kind: 'bridge',
    name: 'Bridge segment',
    cost: 3_500,
    blurb: 'Connect to an adjacent owned plot',
    preferredZoning: ['residential', 'retail', 'industrial', 'mixed', 'garden'],
  },
];

const PRIMARY_KINDS = new Set<PlotBuildKind>([
  'apartment',
  'garden',
  'factory',
  'retail',
  'home',
]);

export interface PlazaPlotsState {
  plots: PlotState[];
  /**
   * One-time migration: strip legacy/player bridge buildings once so
   * wrongly placed bridges disappear; new bridges can still be built later.
   */
  bridgesClearedV1?: boolean;
}

export interface DistrictLite {
  id: string;
  name: string;
  x: number;
  z: number;
  size: number;
  role: string;
  stallCost: number;
}

export const PLOT_GRID = 3;

/** Solid pad half-extent (matches skyCity). 0.5 → default 3×3 pads abut (no void). */
export const PLOT_PLATFORM_HALF_MUL = 0.5;

export function plotPlatformHalf(cellSize: number): number {
  return cellSize * PLOT_PLATFORM_HALF_MUL;
}

/** Min edge-to-edge air before a bridge is allowed (abutting pads stay bridgeless). */
export function bridgeMinGap(cellSize: number): number {
  return Math.max(2.5, cellSize * 0.28);
}

export function bridgeMaxGap(cellSize: number): number {
  return cellSize * 4.5;
}

/** Edge-to-edge void between two pads (≤0 = touching / overlapping). */
export function platformEdgeGap(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): number {
  const cellSize = plotWorldCenter(d, 0, 0).cellSize;
  const half = plotPlatformHalf(cellSize);
  const pa = plotLivePos(a, d);
  const pb = plotLivePos(b, d);
  return Math.hypot(pb.x - pa.x, pb.z - pa.z) - 2 * half;
}

/** True when there is open space between pads for a rope bridge. */
export function platformsSeparatedForBridge(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): boolean {
  const cellSize = plotWorldCenter(d, 0, 0).cellSize;
  const gap = platformEdgeGap(a, b, d);
  return gap >= bridgeMinGap(cellSize) && gap <= bridgeMaxGap(cellSize);
}

export function plotId(districtId: string, cellX: number, cellY: number): string {
  return `plot_${districtId}_${cellX}_${cellY}`;
}

export function zoningForDistrictRole(role: string): ZoningHint {
  switch (role) {
    case 'home':
      return 'residential';
    case 'market':
    case 'premium':
      return 'retail';
    case 'industrial':
      return 'industrial';
    case 'harbor':
      return 'mixed';
    case 'mixed':
      return 'mixed';
    default:
      return 'mixed';
  }
}

/** Grid home position for a cell (before free world offset) */
export function plotWorldCenter(
  d: { x: number; z: number; size: number },
  cellX: number,
  cellY: number,
): { x: number; z: number; cellSize: number } {
  const cellSize = d.size * 0.26;
  const originX = d.x - cellSize;
  const originZ = d.z - cellSize;
  return {
    x: originX + cellX * cellSize,
    z: originZ + cellY * cellSize,
    cellSize,
  };
}

/** Live platform center — free worldX/Z or grid default */
export function plotLivePos(
  plot: PlotState,
  d: { x: number; z: number; size: number },
): { x: number; z: number; cellSize: number } {
  const base = plotWorldCenter(d, plot.cellX, plot.cellY);
  return {
    x: typeof plot.worldX === 'number' ? plot.worldX : base.x,
    z: typeof plot.worldZ === 'number' ? plot.worldZ : base.z,
    cellSize: base.cellSize,
  };
}

/** How far a platform may drift from district center */
export function plotMoveLimits(d: { x: number; z: number; size: number }): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const r = d.size * 0.95;
  return {
    minX: d.x - r,
    maxX: d.x + r,
    minZ: d.z - r,
    maxZ: d.z + r,
  };
}

export function clampPlotWorld(
  d: { x: number; z: number; size: number },
  x: number,
  z: number,
): { x: number; z: number } {
  const lim = plotMoveLimits(d);
  return {
    x: Math.max(lim.minX, Math.min(lim.maxX, x)),
    z: Math.max(lim.minZ, Math.min(lim.maxZ, z)),
  };
}

/** Half-extent for free building placement on the platform pad */
export function plotBuildPlaceRadius(cellSize: number): number {
  return cellSize * 0.38;
}

export function clampLocalOnPlot(
  cellSize: number,
  lx: number,
  lz: number,
): { lx: number; lz: number } {
  const r = plotBuildPlaceRadius(cellSize);
  return {
    lx: Math.max(-r, Math.min(r, lx)),
    lz: Math.max(-r, Math.min(r, lz)),
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function listPriceForCell(
  d: DistrictLite,
  cellX: number,
  cellY: number,
): number {
  const roleMul: Record<string, number> = {
    home: 1.0,
    mixed: 1.1,
    harbor: 1.25,
    industrial: 1.2,
    market: 1.45,
    premium: 2.0,
  };
  const mul = roleMul[d.role] ?? 1.15;
  // Center cell premium; corners slightly cheaper
  const center = cellX === 1 && cellY === 1 ? 1.35 : 1;
  const edge =
    cellX === 0 || cellX === 2 || cellY === 0 || cellY === 2 ? 0.92 : 1;
  const raw = Math.round(d.stallCost * 200 * mul * center * edge);
  return Math.max(10_000, Math.min(200_000, raw));
}

export function emptyPlazaPlots(districts: DistrictLite[]): PlazaPlotsState {
  const plots: PlotState[] = [];
  for (const d of districts) {
    const zone = zoningForDistrictRole(d.role);
    const homeownerId = homeownerNeighborId(d.id);
    // Homeowner's deed cell — offset by district so not always center
    const h = hashStr(d.id);
    const homeCellX = h % 3;
    const homeCellY = (h >> 2) % 3;

    for (let cy = 0; cy < PLOT_GRID; cy++) {
      for (let cx = 0; cx < PLOT_GRID; cx++) {
        const id = plotId(d.id, cx, cy);
        const listPrice = listPriceForCell(d, cx, cy);
        const isHome = cx === homeCellX && cy === homeCellY;
        const roll = (h + cx * 19 + cy * 31) % 100;

        let owner: PlotOwnerKind = 'city';
        let npcOwnerId: string | null = null;
        let forSale = true;
        let buildings: PlotBuildingStub[] = [{ kind: 'empty' }];
        let tenantNeighborId: string | null = null;

        if (isHome) {
          owner = 'npc';
          npcOwnerId = homeownerId;
          forSale = true;
          buildings = [{ kind: 'home', tenantSlots: 1 }];
          tenantNeighborId = homeownerId;
        } else if (roll < 35) {
          // City vacant — for sale
          owner = 'city';
          forSale = true;
        } else if (roll < 70) {
          // NPC owned (portfolio / resident) — for sale at premium
          owner = 'npc';
          npcOwnerId = homeownerId;
          forSale = true;
          if (zone === 'residential' || zone === 'mixed') {
            buildings = [{ kind: 'apartment', tenantSlots: 1 }];
            tenantNeighborId = homeownerId;
          }
        } else {
          // City held, listed
          owner = 'city';
          forSale = true;
        }

        // Center plaza commons on premium markets: slightly pricier city lot
        if (cx === 1 && cy === 1 && d.role === 'market') {
          owner = 'city';
          npcOwnerId = null;
          tenantNeighborId = null;
          buildings = [{ kind: 'empty' }];
          forSale = true;
        }

        const home = plotWorldCenter(d, cx, cy);
        plots.push({
          id,
          districtId: d.id,
          cellX: cx,
          cellY: cy,
          worldX: home.x,
          worldZ: home.z,
          owner,
          npcOwnerId,
          zoningHint: zone,
          buildings,
          rentPolicy: null,
          tenantNeighborId: owner === 'npc' ? tenantNeighborId : null,
          shape: 'square',
          rotation: 0,
          layer: 0,
          listPrice,
          forSale,
          vacant: false,
        });
      }
    }
  }
  return { plots };
}

/** Strip every placed bridge building from plots (empty stubs if needed). */
export function clearAllPlacedBridges(state: PlazaPlotsState): number {
  let removed = 0;
  for (const p of state.plots) {
    const before = p.buildings.length;
    p.buildings = p.buildings.filter((b) => b.kind !== 'bridge');
    removed += before - p.buildings.length;
    if (!p.buildings.length) p.buildings = [{ kind: 'empty' }];
  }
  return removed;
}

export function ensurePlazaPlots(
  state: PlazaPlotsState | null | undefined,
  districts: DistrictLite[],
): PlazaPlotsState {
  if (!state?.plots?.length) return emptyPlazaPlots(districts);
  const have = new Set(state.plots.map((p) => p.id));
  const fresh = emptyPlazaPlots(districts);
  for (const p of fresh.plots) {
    if (!have.has(p.id)) state.plots.push(p);
  }
  // One-time: remove all previously placed bridges from save/live state
  if (!state.bridgesClearedV1) {
    clearAllPlacedBridges(state);
    state.bridgesClearedV1 = true;
  }
  return state;
}

export function getPlot(
  state: PlazaPlotsState,
  id: string,
): PlotState | undefined {
  return state.plots.find((p) => p.id === id);
}

export function plotsInDistrict(
  state: PlazaPlotsState,
  districtId: string,
): PlotState[] {
  return state.plots.filter((p) => p.districtId === districtId);
}

export function playerOwnedPlots(state: PlazaPlotsState): PlotState[] {
  return state.plots.filter((p) => p.owner === 'player');
}

/** Buy price: list + NPC premium − affinity discount (0–12%) */
export function quotePlotBuyPrice(
  plot: PlotState,
  opts?: { affinity?: number; clearedDebtWithOwner?: boolean },
): number {
  let price = plot.listPrice;
  if (plot.owner === 'npc') {
    price = Math.round(price * 1.1);
  }
  const aff = Math.max(0, Math.min(100, opts?.affinity ?? 0));
  price = Math.round(price * (1 - aff * 0.0012));
  if (opts?.clearedDebtWithOwner) {
    price = Math.round(price * 0.94);
  }
  return Math.max(8_000, price);
}

export function plazaPlotsToSave(state: PlazaPlotsState) {
  return {
    bridgesClearedV1: !!state.bridgesClearedV1,
    plots: state.plots.map((p) => ({
      id: p.id,
      districtId: p.districtId,
      cellX: p.cellX,
      cellY: p.cellY,
      owner: p.owner,
      npcOwnerId: p.npcOwnerId,
      zoningHint: p.zoningHint,
      buildings: p.buildings.map((b) => ({ ...b })),
      rentPolicy: p.rentPolicy,
      tenantNeighborId: p.tenantNeighborId,
      shape: p.shape,
      rotation: p.rotation,
      layer: p.layer,
      listPrice: p.listPrice,
      forSale: p.forSale,
      vacant: p.vacant,
      isEdge: !!p.isEdge,
      retailBound: !!p.retailBound,
      worldX: p.worldX,
      worldZ: p.worldZ,
    })),
  };
}

export function plazaPlotsFromSave(
  raw: unknown,
  districts: DistrictLite[],
): PlazaPlotsState {
  if (!raw || typeof raw !== 'object') return emptyPlazaPlots(districts);
  const o = raw as { plots?: unknown[]; bridgesClearedV1?: boolean };
  if (!Array.isArray(o.plots) || !o.plots.length) return emptyPlazaPlots(districts);
  // One-time: legacy saves without this flag still hold bad bridge placements
  const alreadyCleared = !!o.bridgesClearedV1;
  const plots: PlotState[] = [];
  for (const row of o.plots) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string') continue;
    let buildings: PlotBuildingStub[] = Array.isArray(r.buildings)
      ? (r.buildings as PlotBuildingStub[])
      : [{ kind: 'empty' }];
    if (!alreadyCleared) {
      buildings = buildings.filter((b) => b.kind !== 'bridge');
      if (!buildings.length) buildings = [{ kind: 'empty' }];
    }
    plots.push({
      id: r.id,
      districtId: String(r.districtId ?? ''),
      cellX: Number(r.cellX) || 0,
      cellY: Number(r.cellY) || 0,
      owner:
        r.owner === 'player' || r.owner === 'npc' || r.owner === 'city'
          ? r.owner
          : 'city',
      npcOwnerId: typeof r.npcOwnerId === 'string' ? r.npcOwnerId : null,
      zoningHint: (r.zoningHint as ZoningHint) || 'mixed',
      buildings,
      rentPolicy:
        r.rentPolicy === 'cheap' ||
        r.rentPolicy === 'fair' ||
        r.rentPolicy === 'predatory'
          ? r.rentPolicy
          : null,
      tenantNeighborId:
        typeof r.tenantNeighborId === 'string' ? r.tenantNeighborId : null,
      shape: 'square',
      rotation: Number(r.rotation) || 0,
      layer: Number(r.layer) || 0,
      listPrice: typeof r.listPrice === 'number' ? r.listPrice : 10_000,
      forSale: r.forSale !== false,
      vacant: !!r.vacant,
      isEdge: !!r.isEdge,
      retailBound: !!r.retailBound,
      worldX: typeof r.worldX === 'number' ? r.worldX : undefined,
      worldZ: typeof r.worldZ === 'number' ? r.worldZ : undefined,
    });
  }
  // Migrate missing world positions from grid
  for (const p of plots) {
    if (typeof p.worldX !== 'number' || typeof p.worldZ !== 'number') {
      const d = districts.find((x) => x.id === p.districtId);
      if (d) {
        const home = plotWorldCenter(d, p.cellX, p.cellY);
        p.worldX = home.x;
        p.worldZ = home.z;
      }
    }
  }
  return ensurePlazaPlots(
    { plots, bridgesClearedV1: true },
    districts,
  );
}

export function plotOwnerLabel(plot: PlotState): string {
  if (plot.owner === 'player') return 'You';
  if (plot.owner === 'city') return 'City';
  return plot.npcOwnerId?.replace(/^homeowner_/, '') ?? 'NPC';
}

export function plotMapColor(plot: PlotState): number {
  if (plot.owner === 'player') return 0xd4a017; // gold
  if (plot.forSale && plot.owner === 'city') return 0x44aa66; // green for sale
  if (plot.forSale && plot.owner === 'npc') return 0x66bb88;
  return 0x667788; // grey city/npc held
}

export interface PlotRentTickResult {
  collected: number;
  left: { plotId: string; tenantId: string }[];
  msgs: string[];
}

/**
 * Collect rent on player-owned plots with tenants (Task 6).
 * Uses listPrice as value base for rent % (same rates as neighbor pads).
 */
export function collectPlotRents(
  state: PlazaPlotsState,
  onBrass: (n: number) => void,
  onStanding?: (empire: number, districtId: string, districtDelta: number) => void,
): PlotRentTickResult {
  let collected = 0;
  const left: { plotId: string; tenantId: string }[] = [];
  const msgs: string[] = [];

  for (const p of state.plots) {
    if (p.owner !== 'player') continue;
    if (p.vacant || !p.rentPolicy || !p.tenantNeighborId) continue;
    const income = plotRentIncome(p);
    onBrass(income);
    collected += income;

    if (p.rentPolicy === 'predatory' && Math.random() < PREDATORY_LEAVE_CHANCE) {
      const tid = p.tenantNeighborId;
      p.vacant = true;
      p.tenantNeighborId = null;
      p.rentPolicy = null;
      left.push({ plotId: p.id, tenantId: tid });
      onStanding?.(-4, p.districtId, -6);
      msgs.push(`Tenant left plot ${p.districtId} (${p.cellX},${p.cellY}) — predatory rent.`);
    } else if (p.rentPolicy === 'cheap') {
      onStanding?.(0.2, p.districtId, 0.3);
    }
  }

  if (collected > 0 && !left.length) {
    msgs.push(`Plot rent +${collected.toLocaleString()}b.`);
  }
  return { collected, left, msgs };
}

// ——— Task 7 builds ———

export function plotPrimaryBuilding(plot: PlotState): PlotBuildingStub | undefined {
  return plot.buildings.find((b) => PRIMARY_KINDS.has(b.kind) && b.kind !== 'empty');
}

export function plotHasBuild(plot: PlotState, kind: PlotBuildKind): boolean {
  return plot.buildings.some((b) => b.kind === kind);
}

export function plotTenantSlots(plot: PlotState): number {
  let slots = 0;
  for (const b of plot.buildings) {
    if (b.tenantSlots) slots += b.tenantSlots;
    else if (b.kind === 'apartment') slots += 2;
    else if (b.kind === 'home') slots += 1;
  }
  return Math.max(slots, plot.tenantNeighborId ? 1 : 0);
}

export function zoningMultiplier(
  plot: PlotState,
  def: PlotBuildDef,
): { mul: number; offZone: boolean } {
  if (def.preferredZoning.includes(plot.zoningHint)) {
    return { mul: 1, offZone: false };
  }
  // Light zoning: allowed with surcharge
  return { mul: 1.35, offZone: true };
}

export function quotePlotBuild(
  plot: PlotState,
  kind: PlotBuildKind,
): { ok: boolean; cost: number; offZone: boolean; msg?: string; def?: PlotBuildDef } {
  const def = PLOT_BUILD_CATALOG.find((c) => c.kind === kind);
  if (!def) return { ok: false, cost: 0, offZone: false, msg: 'Unknown build.' };
  if (plot.owner !== 'player') {
    return { ok: false, cost: 0, offZone: false, msg: 'Own the plot first.' };
  }
  if (kind === 'decor' && plotHasBuild(plot, 'decor')) {
    return { ok: false, cost: 0, offZone: false, msg: 'Décor already placed.' };
  }
  if (kind === 'bridge') {
    // validated at apply time against adjacency
  } else if (def.primary && plotPrimaryBuilding(plot)?.kind === kind) {
    return { ok: false, cost: 0, offZone: false, msg: `${def.name} already on this plot.` };
  }
  const { mul, offZone } = zoningMultiplier(plot, def);
  const cost = Math.round(def.cost * mul);
  return { ok: true, cost, offZone, def };
}

export function applyPlotBuild(
  plot: PlotState,
  kind: PlotBuildKind,
  opts?: {
    bridgeFacing?: number;
    bridgeToPlotId?: string | null;
    lx?: number;
    lz?: number;
    yaw?: number;
    /** Nearby owned plot exists (distance-based) */
    nearbyOwned?: boolean;
  },
): { ok: boolean; msg: string; cost: number; offZone: boolean } {
  const q = quotePlotBuild(plot, kind);
  if (!q.ok || !q.def) return { ok: false, msg: q.msg ?? 'Cannot build.', cost: 0, offZone: false };

  if (kind === 'bridge') {
    if (!opts?.nearbyOwned && !opts?.bridgeToPlotId) {
      return {
        ok: false,
        msg: 'No nearby owned platform to bridge to — own another plot in range.',
        cost: 0,
        offZone: false,
      };
    }
  }

  // Multiple buildings allowed; primary replaces only same-kind primary, not free multi
  if (q.def.primary && kind !== 'bridge') {
    // Allow multiple apartments etc. — only strip empty stubs
    plot.buildings = plot.buildings.filter((b) => b.kind !== 'empty');
  } else {
    plot.buildings = plot.buildings.filter((b) => b.kind !== 'empty');
  }

  const b: PlotBuildingStub = {
    kind,
    tenantSlots: q.def.tenantSlots,
    lx: opts?.lx ?? 0,
    lz: opts?.lz ?? 0,
    yaw: opts?.yaw ?? 0,
    facing: kind === 'bridge' ? opts?.bridgeFacing ?? 0 : undefined,
    bridgeToPlotId: kind === 'bridge' ? opts?.bridgeToPlotId ?? null : undefined,
    paid: q.cost,
  };
  plot.buildings.push(b);

  if (kind === 'apartment' || kind === 'home') {
    if (!plot.tenantNeighborId) plot.vacant = true;
  }
  if (kind === 'retail') plot.retailBound = true;

  const zoneBit = q.offZone ? ' · off-zone surcharge' : '';
  const posBit =
    kind !== 'bridge'
      ? ` @ (${(b.lx ?? 0).toFixed(1)}, ${(b.lz ?? 0).toFixed(1)})`
      : opts?.bridgeToPlotId
        ? ' · linked platform'
        : '';
  return {
    ok: true,
    cost: q.cost,
    offZone: q.offZone,
    msg: `Built ${q.def.name}${posBit} (−${q.cost.toLocaleString()}b)${zoneBit}`,
  };
}

/** Distance between live centers of two plots (needs district for cellSize fallback) */
export function plotDistance(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): number {
  const pa = plotLivePos(a, d);
  const pb = plotLivePos(b, d);
  return Math.hypot(pa.x - pb.x, pa.z - pb.z);
}

/** Nearest other player-owned plot in same district within maxDist */
export function nearestOwnedPlot(
  state: PlazaPlotsState,
  plot: PlotState,
  d: { x: number; z: number; size: number },
  maxDist?: number,
): PlotState | null {
  const cellSize = plotWorldCenter(d, 0, 0).cellSize;
  const max = maxDist ?? cellSize * 5.5;
  const origin = plotLivePos(plot, d);
  let best: PlotState | null = null;
  let bestD = Infinity;
  for (const p of state.plots) {
    if (p.id === plot.id || p.owner !== 'player') continue;
    if (p.districtId !== plot.districtId) continue;
    const pos = plotLivePos(p, d);
    const dist = Math.hypot(pos.x - origin.x, pos.z - origin.z);
    if (dist < bestD && dist <= max && dist > 0.5) {
      bestD = dist;
      best = p;
    }
  }
  return best;
}

export function hasNearbyOwned(
  state: PlazaPlotsState,
  plot: PlotState,
  d: { x: number; z: number; size: number },
): boolean {
  return !!nearestOwnedPlot(state, plot, d);
}

/** @deprecated grid-adjacency — use hasNearbyOwned */
export function hasAdjacentOwned(
  state: PlazaPlotsState,
  plot: PlotState,
): boolean {
  // Fallback without district: any other player plot in same district
  return state.plots.some(
    (p) =>
      p.owner === 'player' &&
      p.districtId === plot.districtId &&
      p.id !== plot.id,
  );
}

// ——— Free transform ———

export function rotatePlayerPlot(
  state: PlazaPlotsState,
  plotKey: string,
  yaw?: number,
): { ok: boolean; msg: string } {
  const plot = getPlot(state, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to rotate it.' };
  }
  if (typeof yaw === 'number') {
    plot.rotation = ((yaw % 360) + 360) % 360;
  } else {
    plot.rotation = (plot.rotation + 90) % 360;
  }
  return { ok: true, msg: `Plot rotated to ${Math.round(plot.rotation)}°.` };
}

/**
 * Free-move platform within district limits (not grid-locked).
 */
export function movePlotFree(
  state: PlazaPlotsState,
  plotKey: string,
  worldX: number,
  worldZ: number,
  d: { x: number; z: number; size: number },
): { ok: boolean; msg: string } {
  const plot = getPlot(state, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to move it.' };
  }
  const c = clampPlotWorld(d, worldX, worldZ);
  plot.worldX = c.x;
  plot.worldZ = c.z;
  return {
    ok: true,
    msg: `Platform moved to (${c.x.toFixed(0)}, ${c.z.toFixed(0)}).`,
  };
}

/**
 * Auto connector across an open void (any owner).
 * Endpoints are pad rims — mesh lives only in empty air between platforms.
 */
export interface AutoBridgeLink {
  fromId: string;
  toId: string;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  gap: number;
}

/**
 * Auto bridges only when pads are clearly separated.
 * Default abutting 3×3 has gap≈0 → no bridges. Move a pad → void opens → bridge.
 */
export function computeAutoBridges(
  state: PlazaPlotsState,
  d: { id: string; x: number; z: number; size: number },
): AutoBridgeLink[] {
  const cellSize = plotWorldCenter(d, 0, 0).cellSize;
  const half = plotPlatformHalf(cellSize);
  const minGap = bridgeMinGap(cellSize);
  const maxGap = bridgeMaxGap(cellSize);
  const list = state.plots.filter((p) => p.districtId === d.id);
  const links: AutoBridgeLink[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const hasPlayerBridge =
        a.buildings.some((x) => x.kind === 'bridge' && x.bridgeToPlotId === b.id) ||
        b.buildings.some((x) => x.kind === 'bridge' && x.bridgeToPlotId === a.id);
      if (hasPlayerBridge) continue;
      const pa = plotLivePos(a, d);
      const pb = plotLivePos(b, d);
      const dx = pb.x - pa.x;
      const dz = pb.z - pa.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.01) continue;
      const gap = dist - 2 * half;
      if (gap < minGap || gap > maxGap) continue;
      const ux = dx / dist;
      const uz = dz / dist;
      // Exact facing rims — bridge hangs in the open space only
      links.push({
        fromId: a.id,
        toId: b.id,
        ax: pa.x + ux * half,
        az: pa.z + uz * half,
        bx: pb.x - ux * half,
        bz: pb.z - uz * half,
        gap,
      });
    }
  }
  return links;
}

/**
 * Rim endpoints A→B. Segment length equals the air gap when pads are separated.
 */
export function bridgeEdgePoints(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): { ax: number; az: number; bx: number; bz: number; gap: number } {
  const cellSize = plotWorldCenter(d, 0, 0).cellSize;
  const half = plotPlatformHalf(cellSize);
  const pa = plotLivePos(a, d);
  const pb = plotLivePos(b, d);
  const dx = pb.x - pa.x;
  const dz = pb.z - pa.z;
  const dist = Math.max(0.01, Math.hypot(dx, dz));
  const ux = dx / dist;
  const uz = dz / dist;
  return {
    ax: pa.x + ux * half,
    az: pa.z + uz * half,
    bx: pb.x - ux * half,
    bz: pb.z - uz * half,
    gap: dist - 2 * half,
  };
}

// ——— Task 9 edge growth ———

export interface EdgeCandidate {
  districtId: string;
  cellX: number;
  cellY: number;
  price: number;
  id: string;
}

export function listEdgeCandidates(
  state: PlazaPlotsState,
  districtId: string,
  d: DistrictLite,
): EdgeCandidate[] {
  const existing = new Set(
    state.plots.filter((p) => p.districtId === districtId).map((p) => `${p.cellX},${p.cellY}`),
  );
  const ownedOrAny = state.plots.filter((p) => p.districtId === districtId);
  const candidates = new Map<string, EdgeCandidate>();
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const p of ownedOrAny) {
    for (const [dx, dy] of dirs) {
      const cx = p.cellX + dx;
      const cy = p.cellY + dy;
      // Core 0..2 always exist; only propose outside or missing
      const key = `${cx},${cy}`;
      if (existing.has(key)) continue;
      // Limit growth ring: cells within -1..3 initially, expand further if already have edges
      if (cx < -2 || cy < -2 || cx > 4 || cy > 4) continue;
      const ring = Math.max(
        Math.abs(cx - 1),
        Math.abs(cy - 1),
      );
      const edgeCount = state.plots.filter(
        (x) => x.districtId === districtId && x.isEdge,
      ).length;
      const price = Math.round(
        Math.max(12_000, d.stallCost * 160) * (1.15 + ring * 0.35 + edgeCount * 0.08),
      );
      candidates.set(key, {
        districtId,
        cellX: cx,
        cellY: cy,
        price,
        id: plotId(districtId, cx, cy),
      });
    }
  }
  return [...candidates.values()].sort((a, b) => a.price - b.price);
}

export function createEdgePlot(
  state: PlazaPlotsState,
  d: DistrictLite,
  cellX: number,
  cellY: number,
): PlotState {
  const id = plotId(d.id, cellX, cellY);
  const existing = getPlot(state, id);
  if (existing) return existing;
  const home = plotWorldCenter(d, cellX, cellY);
  const plot: PlotState = {
    id,
    districtId: d.id,
    cellX,
    cellY,
    worldX: home.x,
    worldZ: home.z,
    owner: 'city',
    npcOwnerId: null,
    zoningHint: zoningForDistrictRole(d.role),
    buildings: [{ kind: 'empty' }],
    rentPolicy: null,
    tenantNeighborId: null,
    shape: 'square',
    rotation: 0,
    layer: 0,
    listPrice: listPriceForCell(d, Math.max(0, Math.min(2, cellX)), Math.max(0, Math.min(2, cellY))),
    forSale: true,
    vacant: true,
    isEdge: cellX < 0 || cellY < 0 || cellX > 2 || cellY > 2,
  };
  // Edge premium list
  if (plot.isEdge) {
    const ring = Math.max(Math.abs(cellX - 1), Math.abs(cellY - 1));
    plot.listPrice = Math.round(plot.listPrice * (1.2 + ring * 0.25));
  }
  state.plots.push(plot);
  return plot;
}

/** Rent scale by apartment capacity */
export function plotRentIncome(plot: PlotState): number {
  if (!plot.rentPolicy || !plot.tenantNeighborId || plot.vacant) return 0;
  const base = rentIncomeForPad(plot.listPrice, plot.rentPolicy);
  const slots = Math.max(1, plotTenantSlots(plot));
  // Base rent for 1 slot; +40% per extra slot
  return Math.round(base * (1 + (slots - 1) * 0.4));
}
