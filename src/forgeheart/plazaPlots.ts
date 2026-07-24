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
  /** Bridge facing: 0=+X 1=+Z 2=-X 3=-Z */
  facing?: number;
  paid?: number;
}

export interface PlotState {
  id: string;
  districtId: string;
  cellX: number;
  cellY: number;
  owner: PlotOwnerKind;
  /** Neighbor / homeowner id when npc-owned or player tenant link */
  npcOwnerId: string | null;
  zoningHint: ZoningHint;
  buildings: PlotBuildingStub[];
  rentPolicy: RentPolicy | null;
  /** Neighbor id paying rent on this plot (if any) */
  tenantNeighborId: string | null;
  shape: 'square';
  /** Degrees, multiples of 90 (Task 8) */
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

/** World XZ center of a plot cell on a district plaza */
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

        plots.push({
          id,
          districtId: d.id,
          cellX: cx,
          cellY: cy,
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
    })),
  };
}

export function plazaPlotsFromSave(
  raw: unknown,
  districts: DistrictLite[],
): PlazaPlotsState {
  if (!raw || typeof raw !== 'object') return emptyPlazaPlots(districts);
  const o = raw as { plots?: unknown[] };
  if (!Array.isArray(o.plots) || !o.plots.length) return emptyPlazaPlots(districts);
  const plots: PlotState[] = [];
  for (const row of o.plots) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string') continue;
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
      buildings: Array.isArray(r.buildings)
        ? (r.buildings as PlotBuildingStub[])
        : [{ kind: 'empty' }],
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
    });
  }
  return ensurePlazaPlots({ plots }, districts);
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
  opts?: { bridgeFacing?: number; adjacentOwned?: boolean },
): { ok: boolean; msg: string; cost: number; offZone: boolean } {
  const q = quotePlotBuild(plot, kind);
  if (!q.ok || !q.def) return { ok: false, msg: q.msg ?? 'Cannot build.', cost: 0, offZone: false };

  if (kind === 'bridge') {
    if (!opts?.adjacentOwned) {
      return {
        ok: false,
        msg: 'Bridge needs an adjacent owned plot.',
        cost: 0,
        offZone: false,
      };
    }
    if (plotHasBuild(plot, 'bridge')) {
      return { ok: false, msg: 'Bridge already placed.', cost: 0, offZone: false };
    }
  }

  // Replace prior primary if placing a new primary; keep décor + bridges
  if (q.def.primary) {
    plot.buildings = plot.buildings.filter(
      (b) => b.kind === 'decor' || b.kind === 'bridge',
    );
  } else {
    plot.buildings = plot.buildings.filter((b) => b.kind !== 'empty');
  }

  const b: PlotBuildingStub = {
    kind,
    tenantSlots: q.def.tenantSlots,
    facing: kind === 'bridge' ? opts?.bridgeFacing ?? 0 : undefined,
    paid: q.cost,
  };
  plot.buildings.push(b);

  if (kind === 'apartment' || kind === 'home') {
    if (!plot.tenantNeighborId) plot.vacant = true;
  }
  if (kind === 'retail') plot.retailBound = true;

  const zoneBit = q.offZone ? ' · off-zone surcharge' : '';
  return {
    ok: true,
    cost: q.cost,
    offZone: q.offZone,
    msg: `Built ${q.def.name} (−${q.cost.toLocaleString()}b)${zoneBit}`,
  };
}

export function hasAdjacentOwned(
  state: PlazaPlotsState,
  plot: PlotState,
): boolean {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of dirs) {
    const other = state.plots.find(
      (p) =>
        p.districtId === plot.districtId &&
        p.cellX === plot.cellX + dx &&
        p.cellY === plot.cellY + dy &&
        p.owner === 'player',
    );
    if (other) return true;
  }
  return false;
}

// ——— Task 8 transform ———

export function rotatePlayerPlot(
  state: PlazaPlotsState,
  plotKey: string,
): { ok: boolean; msg: string } {
  const plot = getPlot(state, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to rotate it.' };
  }
  plot.rotation = (plot.rotation + 90) % 360;
  return { ok: true, msg: `Plot rotated to ${plot.rotation}°.` };
}

/**
 * Swap this plot with an adjacent cell: either empty player lot or vacant city lot
 * you effectively re-slot onto (city cell must be forSale or empty ownership transfer).
 */
export function swapPlotWithAdjacent(
  state: PlazaPlotsState,
  plotKey: string,
  dir: 0 | 1 | 2 | 3,
): { ok: boolean; msg: string } {
  const plot = getPlot(state, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to move it.' };
  }
  const deltas: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const [dx, dy] = deltas[dir]!;
  const tx = plot.cellX + dx;
  const ty = plot.cellY + dy;
  const target = state.plots.find(
    (p) => p.districtId === plot.districtId && p.cellX === tx && p.cellY === ty,
  );
  if (!target) {
    return {
      ok: false,
      msg: 'No plot that way — buy an edge cell first (plaza growth).',
    };
  }
  if (target.owner === 'player') {
    // Swap cell coords
    const ax = plot.cellX;
    const ay = plot.cellY;
    plot.cellX = target.cellX;
    plot.cellY = target.cellY;
    target.cellX = ax;
    target.cellY = ay;
    // Fix ids to match cells for world lookup consistency
    rekeyPlotId(plot);
    rekeyPlotId(target);
    return { ok: true, msg: `Swapped with your plot (${tx},${ty}).` };
  }
  if (target.owner === 'city' && target.forSale && !target.tenantNeighborId) {
    // Move onto city lot: swap ownership+payload conceptually by swapping cells
    const ax = plot.cellX;
    const ay = plot.cellY;
    plot.cellX = target.cellX;
    plot.cellY = target.cellY;
    target.cellX = ax;
    target.cellY = ay;
    rekeyPlotId(plot);
    rekeyPlotId(target);
    return { ok: true, msg: `Moved plot to (${tx},${ty}).` };
  }
  return { ok: false, msg: 'Target cell is occupied or not free to swap.' };
}

function rekeyPlotId(plot: PlotState): void {
  plot.id = plotId(plot.districtId, plot.cellX, plot.cellY);
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
  const plot: PlotState = {
    id,
    districtId: d.id,
    cellX,
    cellY,
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
