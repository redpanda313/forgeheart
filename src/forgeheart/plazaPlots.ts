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
  /** @deprecated stripped on load — bridges removed */
  | 'bridge';

/** Plantable beds on a plot flower garden (player chooses held bloom types). */
export const GARDEN_SPOT_COUNT = 5;

export interface PlotBuildingStub {
  kind: PlotBuildKind;
  tenantSlots?: number;
  /** Local offset on platform (free placement) */
  lx?: number;
  lz?: number;
  /** Local yaw degrees — door/entry faces local +Z after this yaw */
  yaw?: number;
  /** Deck layer (0 = ground pad, 1 = upper deck) */
  layer?: number;
  /**
   * Garden only: up to GARDEN_SPOT_COUNT flower commodity ids (or null = empty bed).
   * Planting consumes 1 held flower; each bed harvests that type.
   */
  gardenSpots?: (string | null)[];
  /** @deprecated */
  facing?: number;
  /** @deprecated */
  bridgeToPlotId?: string | null;
  paid?: number;
}

/** Local XZ offsets for the 5 garden plant beds (relative to garden building center). */
export function gardenSpotLocalOffsets(
  cellSize: number,
): { lx: number; lz: number }[] {
  const r = cellSize * 0.16;
  return [
    { lx: 0, lz: 0 },
    { lx: r, lz: r * 0.35 },
    { lx: -r, lz: r * 0.35 },
    { lx: r * 0.55, lz: -r * 0.7 },
    { lx: -r * 0.55, lz: -r * 0.7 },
  ];
}

/** Ensure a garden building has exactly GARDEN_SPOT_COUNT bed slots. */
export function ensureGardenSpots(b: PlotBuildingStub): (string | null)[] {
  if (b.kind !== 'garden') return [];
  if (!Array.isArray(b.gardenSpots) || b.gardenSpots.length !== GARDEN_SPOT_COUNT) {
    const prev = Array.isArray(b.gardenSpots) ? b.gardenSpots : [];
    b.gardenSpots = Array.from({ length: GARDEN_SPOT_COUNT }, (_, i) => {
      const v = prev[i];
      return typeof v === 'string' && v.length ? v : null;
    });
  }
  return b.gardenSpots;
}

/** Task 10 — pad floor plan (default square). */
export type PlotShape = 'square' | 'octagon' | 'circle' | 'triangle';

export const PLOT_SHAPES: PlotShape[] = ['square', 'octagon', 'circle', 'triangle'];

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
  /** Task 10 pad plan */
  shape: PlotShape;
  /** Degrees — free rotation, UI snaps 90° for now */
  rotation: number;
  /**
   * Highest unlocked deck index (0 = ground only; up to MAX_PLOT_LAYER).
   * Task 11 multi-layer plots.
   */
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

/** Task 12 — player airway between two plots (same district). */
export interface PlotAirwayLink {
  fromId: string;
  toId: string;
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
];

/** Half-extents (local X / Z) of a building footprint for overlap & pad tests. */
export function buildingFootprintHalf(
  kind: PlotBuildKind,
  cellSize: number,
): { hw: number; hd: number } {
  switch (kind) {
    case 'home':
      return { hw: 3.5, hd: 3.1 };
    case 'apartment':
      return { hw: 4.5, hd: 4.0 };
    case 'retail':
      return { hw: 4.25, hd: 3.75 };
    case 'factory':
      return { hw: 4.5, hd: 4.0 };
    case 'garden': {
      const r = cellSize * 0.3;
      return { hw: r, hd: r };
    }
    case 'decor':
      return { hw: 0.45, hd: 0.45 };
    default:
      return { hw: 2, hd: 2 };
  }
}

function rotYaw(x: number, z: number, yawDeg: number): { x: number; z: number } {
  const r = (yawDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c + z * s, z: -x * s + z * c };
}

/** Axis-aligned bounds of a rotated footprint in plot-local XZ. */
export function footprintAabb(
  lx: number,
  lz: number,
  yawDeg: number,
  hw: number,
  hd: number,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const corners = [
    rotYaw(-hw, -hd, yawDeg),
    rotYaw(hw, -hd, yawDeg),
    rotYaw(hw, hd, yawDeg),
    rotYaw(-hw, hd, yawDeg),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of corners) {
    const x = lx + p.x;
    const z = lz + p.z;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** True if footprint still touches the pad (may hang off edges, not float free). */
export function footprintIntersectsPad(
  lx: number,
  lz: number,
  yawDeg: number,
  hw: number,
  hd: number,
  padHalf: number,
): boolean {
  const a = footprintAabb(lx, lz, yawDeg, hw, hd);
  const H = padHalf;
  return a.maxX >= -H && a.minX <= H && a.maxZ >= -H && a.minZ <= H;
}

/** True if two building footprints overlap (with small margin). */
export function footprintsOverlap(
  lx0: number,
  lz0: number,
  yaw0: number,
  hw0: number,
  hd0: number,
  lx1: number,
  lz1: number,
  yaw1: number,
  hw1: number,
  hd1: number,
  margin = 0.35,
): boolean {
  const a = footprintAabb(lx0, lz0, yaw0, hw0 + margin * 0.5, hd0 + margin * 0.5);
  const b = footprintAabb(lx1, lz1, yaw1, hw1 + margin * 0.5, hd1 + margin * 0.5);
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

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
  /**
   * One-time: snap all pad worldX/worldZ/rotation back to grid home
   * (clears free-move legacy saves after pad transform removal).
   */
  padsResetV1?: boolean;
  /** Task 12 player skyway links between owned pads */
  airways?: PlotAirwayLink[];
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

/**
 * Min open-air gap (rim-to-rim) before a bridge is allowed.
 * Above default diagonal rest gap so an unmoved 3×3 never bridges.
 */
export function bridgeMinGap(cellSize: number): number {
  return Math.max(3, cellSize * 0.55);
}

export function bridgeMaxGap(cellSize: number): number {
  return cellSize * 2.2;
}

/** How far a pad must drift from its grid home to count as “moved”. */
export function plotDisplaceEpsilon(cellSize: number): number {
  return cellSize * 0.12;
}

/** Short ends sit barely past the rim onto the deck (world units). */
export const BRIDGE_RIM_INSET = 0.75;

/** Default bridge deck width multiplier (short ends) — 4× prior island width. */
export const BRIDGE_WIDTH_MUL = 6;

/** True if the platform is away from its default grid cell center. */
export function plotIsDisplaced(
  plot: PlotState,
  d: { x: number; z: number; size: number },
): boolean {
  const home = plotWorldCenter(d, plot.cellX, plot.cellY);
  const live = plotLivePos(plot, d);
  return Math.hypot(live.x - home.x, live.z - home.z) > plotDisplaceEpsilon(home.cellSize);
}

/** One local side of a (possibly rotated) square pad. */
export interface PadSide {
  /** 0=+localX 1=+localZ 2=-localX 3=-localZ */
  id: 0 | 1 | 2 | 3;
  outwardX: number;
  outwardZ: number;
  tangentX: number;
  tangentZ: number;
  midX: number;
  midZ: number;
  half: number;
}

/** Local N/S/E/W edges after plot rotation (user: rotated W becomes new N, etc.). */
export function plotPadSides(
  plot: PlotState,
  d: { x: number; z: number; size: number },
): PadSide[] {
  const live = plotLivePos(plot, d);
  const half = plotPlatformHalf(live.cellSize);
  const r = ((plot.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  // Local axes in world XZ (Y-up yaw)
  const xAx = { x: cos, z: -sin };
  const zAx = { x: sin, z: cos };
  const mk = (
    id: 0 | 1 | 2 | 3,
    ox: number,
    oz: number,
    tx: number,
    tz: number,
  ): PadSide => ({
    id,
    outwardX: ox,
    outwardZ: oz,
    tangentX: tx,
    tangentZ: tz,
    midX: live.x + ox * half,
    midZ: live.z + oz * half,
    half,
  });
  return [
    mk(0, xAx.x, xAx.z, zAx.x, zAx.z),
    mk(1, zAx.x, zAx.z, xAx.x, xAx.z),
    mk(2, -xAx.x, -xAx.z, zAx.x, zAx.z),
    mk(3, -zAx.x, -zAx.z, xAx.x, xAx.z),
  ];
}

/** Attach point: slightly inset past the rim onto the pad, with lateral offset along the edge. */
export function sideAttachPoint(
  side: PadSide,
  lateral = 0,
  inset = BRIDGE_RIM_INSET,
): { x: number; z: number } {
  const lat = Math.max(-side.half * 0.7, Math.min(side.half * 0.7, lateral));
  return {
    x: side.midX - side.outwardX * inset + side.tangentX * lat,
    z: side.midZ - side.outwardZ * inset + side.tangentZ * lat,
  };
}

/**
 * Best opposite local sides for a cardinal bridge A↔B.
 * Rejects diagonals: both outsides must face each other along the connection.
 */
export function bestCardinalSidePair(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): { sideA: PadSide; sideB: PadSide; gap: number } | null {
  const pa = plotLivePos(a, d);
  const pb = plotLivePos(b, d);
  const dx = pb.x - pa.x;
  const dz = pb.z - pa.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return null;
  const toBx = dx / dist;
  const toBz = dz / dist;
  const sidesA = plotPadSides(a, d);
  const sidesB = plotPadSides(b, d);
  let best: { sideA: PadSide; sideB: PadSide; score: number; gap: number } | null =
    null;
  for (const sa of sidesA) {
    // A’s chosen face should look toward B
    const faceA = sa.outwardX * toBx + sa.outwardZ * toBz;
    if (faceA < 0.55) continue;
    for (const sb of sidesB) {
      // B’s face should look toward A (opposite)
      const faceB = sb.outwardX * -toBx + sb.outwardZ * -toBz;
      if (faceB < 0.55) continue;
      // Outward normals roughly opposite (not a diagonal skew pair)
      const opp = sa.outwardX * sb.outwardX + sa.outwardZ * sb.outwardZ;
      if (opp > -0.45) continue;
      // Rim-to-rim open air (before inset)
      const gap = Math.hypot(sb.midX - sa.midX, sb.midZ - sa.midZ);
      const score = faceA + faceB - opp;
      if (!best || score > best.score) {
        best = { sideA: sa, sideB: sb, score, gap };
      }
    }
  }
  return best ? { sideA: best.sideA, sideB: best.sideB, gap: best.gap } : null;
}

/** Edge-to-edge void between facing cardinal sides (≤0 / small = touching). */
export function platformEdgeGap(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): number {
  const pair = bestCardinalSidePair(a, b, d);
  if (!pair) {
    // Not a cardinal facing pair — treat as “no valid bridge gap”
    return -1;
  }
  return pair.gap;
}

/** True when pads face each other cardinally with open air for a rope bridge. */
export function platformsSeparatedForBridge(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): boolean {
  const cellSize = plotWorldCenter(d, 0, 0).cellSize;
  const gap = platformEdgeGap(a, b, d);
  return gap >= bridgeMinGap(cellSize) && gap <= bridgeMaxGap(cellSize);
}

/** Original grid orthogonal neighbors (share an edge on the 3×3 / edge grid). */
export function isOriginalOrthoNeighbor(a: PlotState, b: PlotState): boolean {
  if (a.districtId !== b.districtId) return false;
  return Math.abs(a.cellX - b.cellX) + Math.abs(a.cellY - b.cellY) === 1;
}

/**
 * Midpoint of the world-axis face that looks toward a neighbor (legacy helper).
 * Prefer plotPadSides / bestCardinalSidePair for rotated pads.
 */
export function platformFacingEdgeMid(
  cx: number,
  cz: number,
  half: number,
  towardX: number,
  towardZ: number,
): { x: number; z: number } {
  if (Math.abs(towardX) >= Math.abs(towardZ)) {
    return { x: cx + Math.sign(towardX || 1) * half, z: cz };
  }
  return { x: cx, z: cz + Math.sign(towardZ || 1) * half };
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

/** Soft aim radius for building centers (footprint may hang past pad rim). */
export function plotBuildPlaceRadius(cellSize: number): number {
  return cellSize * 0.52;
}

/** Build-bounds radius by shape (inset from visual pad edge). */
export function plotShapePlaceHalf(cellSize: number, shape: PlotShape): number {
  const h = plotPlatformHalf(cellSize);
  switch (shape) {
    case 'octagon':
      return h * 0.92;
    case 'circle':
      return h * 0.9;
    case 'triangle':
      return h * 0.78;
    default:
      return h;
  }
}

export function plotShapeLabel(shape: PlotShape): string {
  switch (shape) {
    case 'octagon':
      return 'Octagon';
    case 'circle':
      return 'Circle';
    case 'triangle':
      return 'Triangle';
    default:
      return 'Square';
  }
}

/** Brass cost to remodel pad plan (Task 10). */
export function quotePlotShapeChange(plot: PlotState, shape: PlotShape): number {
  if (plot.shape === shape) return 0;
  const base: Record<PlotShape, number> = {
    square: 0,
    octagon: 2_600,
    circle: 4_200,
    triangle: 3_400,
  };
  return Math.max(1_400, base[shape] ?? 2_800);
}

/** Highest deck index players can unlock (0..MAX = 8 total decks). */
export const MAX_PLOT_LAYER = 7;

/**
 * Cost to unlock the next deck layer (Task 11).
 * Soft ladder so multi-deck skyline stays reachable mid-game.
 */
export function quotePlotLayerUpgrade(plot: PlotState): number {
  const cur = plot.layer ?? 0;
  if (cur >= MAX_PLOT_LAYER) return 0;
  const next = cur + 1;
  // Was ~14k+ and ×1.38/layer — now ~2.2k floor, mild list + gentle growth
  const base = Math.max(2_200, Math.round(plot.listPrice * 0.04));
  return Math.round(base * Math.pow(1.18, next - 1));
}

/** Cost to open a player airway between two owned plots (Task 12). */
export function quotePlotAirwayLink(_a: PlotState, _b: PlotState): number {
  return 5_200;
}

/**
 * Apply pad shape change (caller must already charge brass).
 * Does not deduct currency — economy layer owns the wallet.
 */
export function setPlotShape(
  state: PlazaPlotsState,
  plotKey: string,
  shape: PlotShape,
): { ok: boolean; msg: string; cost: number } {
  const plot = getPlot(state, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to change its shape.', cost: 0 };
  }
  if (!PLOT_SHAPES.includes(shape)) {
    return { ok: false, msg: 'Unknown pad shape.', cost: 0 };
  }
  if (plot.shape === shape) {
    return { ok: false, msg: `Already ${plotShapeLabel(shape)}.`, cost: 0 };
  }
  const cost = quotePlotShapeChange(plot, shape);
  plot.shape = shape;
  return {
    ok: true,
    cost,
    msg: `Pad remodelled to ${plotShapeLabel(shape)} (−${cost.toLocaleString()}b).`,
  };
}

/**
 * Unlock next deck (caller must already charge brass).
 * Does not deduct currency — economy layer owns the wallet.
 */
export function unlockPlotUpperDeck(
  state: PlazaPlotsState,
  plotKey: string,
): { ok: boolean; msg: string; cost: number } {
  const plot = getPlot(state, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to add a deck.', cost: 0 };
  }
  const cur = plot.layer ?? 0;
  if (cur >= MAX_PLOT_LAYER) {
    return { ok: false, msg: `Already at max deck L${MAX_PLOT_LAYER}.`, cost: 0 };
  }
  const cost = quotePlotLayerUpgrade(plot);
  plot.layer = cur + 1;
  return {
    ok: true,
    cost,
    msg: `Deck L${plot.layer} + climb rails unlocked (−${cost.toLocaleString()}b).`,
  };
}

export function listPlotAirways(state: PlazaPlotsState): PlotAirwayLink[] {
  return state.airways ?? [];
}

export function hasPlotAirway(
  state: PlazaPlotsState,
  aId: string,
  bId: string,
): boolean {
  const links = listPlotAirways(state);
  return links.some(
    (l) =>
      (l.fromId === aId && l.toId === bId) || (l.fromId === bId && l.toId === aId),
  );
}

/**
 * Link two player-owned plots with a skyway (same district preferred).
 * Caller must already charge brass — does not deduct currency.
 */
export function linkPlotAirway(
  state: PlazaPlotsState,
  fromId: string,
  toId: string,
): { ok: boolean; msg: string; cost: number } {
  if (fromId === toId) return { ok: false, msg: 'Pick two different plots.', cost: 0 };
  const a = getPlot(state, fromId);
  const b = getPlot(state, toId);
  if (!a || !b || a.owner !== 'player' || b.owner !== 'player') {
    return { ok: false, msg: 'Both plots must be yours.', cost: 0 };
  }
  if (a.districtId !== b.districtId) {
    return { ok: false, msg: 'Airways link plots in the same district only (v1).', cost: 0 };
  }
  if (hasPlotAirway(state, fromId, toId)) {
    return { ok: false, msg: 'Airway already links these pads.', cost: 0 };
  }
  const cost = quotePlotAirwayLink(a, b);
  if (!state.airways) state.airways = [];
  state.airways.push({ fromId, toId });
  return {
    ok: true,
    cost,
    msg: `Skyway linked (−${cost.toLocaleString()}b). Board can ride it.`,
  };
}

/** Other owned plots in the same district that can receive an airway. */
export function listAirwayTargets(
  state: PlazaPlotsState,
  fromId: string,
): PlotState[] {
  const from = getPlot(state, fromId);
  if (!from || from.owner !== 'player') return [];
  return state.plots.filter(
    (p) =>
      p.owner === 'player' &&
      p.id !== fromId &&
      p.districtId === from.districtId &&
      !hasPlotAirway(state, fromId, p.id),
  );
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

/** Snap every pad back to its default grid center and clear free rotation. */
export function resetAllPadPlacements(
  state: PlazaPlotsState,
  districts: DistrictLite[],
): void {
  for (const p of state.plots) {
    const d = districts.find((x) => x.id === p.districtId);
    if (!d) continue;
    const home = plotWorldCenter(d, p.cellX, p.cellY);
    p.worldX = home.x;
    p.worldZ = home.z;
    p.rotation = 0;
  }
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
  // Always strip bridges (feature removed)
  clearAllPlacedBridges(state);
  state.bridgesClearedV1 = true;
  // One-time: undo free-moved / rotated pads from legacy saves
  if (!state.padsResetV1) {
    resetAllPadPlacements(state, districts);
    state.padsResetV1 = true;
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
    padsResetV1: !!state.padsResetV1,
    airways: listPlotAirways(state).map((a) => ({ ...a })),
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
      shape: p.shape ?? 'square',
      rotation: p.rotation,
      layer: p.layer ?? 0,
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
  const o = raw as {
    plots?: unknown[];
    bridgesClearedV1?: boolean;
    padsResetV1?: boolean;
    airways?: unknown[];
  };
  if (!Array.isArray(o.plots) || !o.plots.length) return emptyPlazaPlots(districts);
  // One-time: legacy saves without this flag still hold bad bridge placements
  const alreadyCleared = !!o.bridgesClearedV1;
  const padsAlreadyReset = !!o.padsResetV1;
  const plots: PlotState[] = [];
  for (const row of o.plots) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string') continue;
    let buildings: PlotBuildingStub[] = Array.isArray(r.buildings)
      ? (r.buildings as PlotBuildingStub[]).map((raw) => {
          const b: PlotBuildingStub = { ...raw };
          if (b.kind === 'garden') ensureGardenSpots(b);
          return b;
        })
      : [{ kind: 'empty' }];
    if (!alreadyCleared) {
      buildings = buildings.filter((b) => b.kind !== 'bridge');
      if (!buildings.length) buildings = [{ kind: 'empty' }];
    }
    const shapeRaw = String(r.shape ?? 'square');
    const shape: PlotShape = PLOT_SHAPES.includes(shapeRaw as PlotShape)
      ? (shapeRaw as PlotShape)
      : 'square';
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
      shape,
      rotation: Number(r.rotation) || 0,
      layer: Math.max(0, Math.min(MAX_PLOT_LAYER, Number(r.layer) || 0)),
      listPrice: typeof r.listPrice === 'number' ? r.listPrice : 10_000,
      forSale: r.forSale !== false,
      vacant: !!r.vacant,
      isEdge: !!r.isEdge,
      retailBound: !!r.retailBound,
      worldX: typeof r.worldX === 'number' ? r.worldX : undefined,
      worldZ: typeof r.worldZ === 'number' ? r.worldZ : undefined,
    });
  }
  const airways: PlotAirwayLink[] = [];
  if (Array.isArray(o.airways)) {
    for (const row of o.airways) {
      if (!row || typeof row !== 'object') continue;
      const a = row as Record<string, unknown>;
      if (typeof a.fromId === 'string' && typeof a.toId === 'string') {
        airways.push({ fromId: a.fromId, toId: a.toId });
      }
    }
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
    // Clamp legacy layer / shape
    p.layer = Math.max(0, Math.min(MAX_PLOT_LAYER, p.layer ?? 0));
    if (!PLOT_SHAPES.includes(p.shape)) p.shape = 'square';
  }
  // Drop airways that reference missing plots (save hygiene)
  const plotIds = new Set(plots.map((p) => p.id));
  const cleanAirways = airways.filter(
    (a) => plotIds.has(a.fromId) && plotIds.has(a.toId) && a.fromId !== a.toId,
  );
  return ensurePlazaPlots(
    {
      plots,
      airways: cleanAirways,
      bridgesClearedV1: true,
      // Unset → ensurePlazaPlots runs pad snap once for legacy free-move saves
      padsResetV1: padsAlreadyReset ? true : undefined,
    },
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

/** One of each primary (or décor) per deck layer is allowed. */
export function plotHasBuildOnLayer(
  plot: PlotState,
  kind: PlotBuildKind,
  layer: number,
): boolean {
  const L = Math.max(0, layer);
  return plot.buildings.some((b) => b.kind === kind && (b.layer ?? 0) === L);
}

export function plotPrimaryOnLayer(
  plot: PlotState,
  layer: number,
): PlotBuildingStub | undefined {
  const L = Math.max(0, layer);
  return plot.buildings.find(
    (b) => PRIMARY_KINDS.has(b.kind) && b.kind !== 'empty' && (b.layer ?? 0) === L,
  );
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
  opts?: { layer?: number },
): { ok: boolean; cost: number; offZone: boolean; msg?: string; def?: PlotBuildDef } {
  if (kind === 'bridge') {
    return { ok: false, cost: 0, offZone: false, msg: 'Bridges are no longer available.' };
  }
  const def = PLOT_BUILD_CATALOG.find((c) => c.kind === kind);
  if (!def) return { ok: false, cost: 0, offZone: false, msg: 'Unknown build.' };
  if (plot.owner !== 'player') {
    return { ok: false, cost: 0, offZone: false, msg: 'Own the plot first.' };
  }
  const layer = Math.max(0, Math.min(plot.layer ?? 0, opts?.layer ?? 0));
  if (layer > (plot.layer ?? 0)) {
    return { ok: false, cost: 0, offZone: false, msg: 'Unlock that deck first.' };
  }
  // Per-deck limits: each layer is a fresh round of buildings (full cost)
  if (kind === 'decor' && plotHasBuildOnLayer(plot, 'decor', layer)) {
    return {
      ok: false,
      cost: 0,
      offZone: false,
      msg: `Décor already on deck L${layer}.`,
    };
  }
  if (def.primary && plotHasBuildOnLayer(plot, kind, layer)) {
    return {
      ok: false,
      cost: 0,
      offZone: false,
      msg: `${def.name} already on deck L${layer}.`,
    };
  }
  const { mul, offZone } = zoningMultiplier(plot, def);
  const cost = Math.round(def.cost * mul);
  return { ok: true, cost, offZone, def };
}

/** Placement rules: touch pad, no overlap with existing buildings. */
export function validatePlotBuildingPlace(
  plot: PlotState,
  kind: PlotBuildKind,
  cellSize: number,
  lx: number,
  lz: number,
  yaw: number,
  placeLayer = 0,
): { ok: boolean; msg?: string } {
  if (kind === 'bridge' || kind === 'empty') {
    return { ok: false, msg: 'Cannot place that here.' };
  }
  if (placeLayer > (plot.layer ?? 0)) {
    return { ok: false, msg: 'Unlock the upper deck first.' };
  }
  const padH = plotShapePlaceHalf(cellSize, plot.shape ?? 'square');
  const fp = buildingFootprintHalf(kind, cellSize);
  if (!footprintIntersectsPad(lx, lz, yaw, fp.hw, fp.hd, padH)) {
    return {
      ok: false,
      msg: 'Building must stay on the pad (may hang off edges, not float free).',
    };
  }
  for (const other of plot.buildings) {
    if (other.kind === 'empty' || other.kind === 'bridge') continue;
    // Only collide with buildings on the same deck
    if ((other.layer ?? 0) !== placeLayer) continue;
    const ofp = buildingFootprintHalf(other.kind, cellSize);
    if (
      footprintsOverlap(
        lx,
        lz,
        yaw,
        fp.hw,
        fp.hd,
        other.lx ?? 0,
        other.lz ?? 0,
        other.yaw ?? 0,
        ofp.hw,
        ofp.hd,
      )
    ) {
      return { ok: false, msg: 'Overlaps another building on this pad.' };
    }
  }
  return { ok: true };
}

export function applyPlotBuild(
  plot: PlotState,
  kind: PlotBuildKind,
  opts?: {
    lx?: number;
    lz?: number;
    yaw?: number;
    cellSize?: number;
    layer?: number;
  },
): { ok: boolean; msg: string; cost: number; offZone: boolean } {
  const layer = Math.max(0, Math.min(plot.layer ?? 0, opts?.layer ?? 0));
  const q = quotePlotBuild(plot, kind, { layer });
  if (!q.ok || !q.def) return { ok: false, msg: q.msg ?? 'Cannot build.', cost: 0, offZone: false };

  const lx = opts?.lx ?? 0;
  const lz = opts?.lz ?? 0;
  const yaw = opts?.yaw ?? 0;
  const cellSize = opts?.cellSize ?? 20;
  const place = validatePlotBuildingPlace(plot, kind, cellSize, lx, lz, yaw, layer);
  if (!place.ok) {
    return { ok: false, msg: place.msg ?? 'Invalid placement.', cost: 0, offZone: false };
  }

  plot.buildings = plot.buildings.filter((b) => b.kind !== 'empty' && b.kind !== 'bridge');

  const b: PlotBuildingStub = {
    kind,
    tenantSlots: q.def.tenantSlots,
    lx,
    lz,
    yaw,
    layer,
    paid: q.cost,
  };
  if (kind === 'garden') {
    b.gardenSpots = Array.from({ length: GARDEN_SPOT_COUNT }, () => null);
  }
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
    msg: `Built ${q.def.name} @ (${lx.toFixed(1)}, ${lz.toFixed(1)}) yaw ${Math.round(yaw)}° (−${q.cost.toLocaleString()}b)${zoneBit}`,
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
 * Short ends inset onto facing local sides; long axis spans the gap.
 */
export interface AutoBridgeLink {
  fromId: string;
  toId: string;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  gap: number;
  sideA: 0 | 1 | 2 | 3;
  sideB: 0 | 1 | 2 | 3;
}

/**
 * Cardinal-only auto bridges after a pad is moved and a clear gap opens.
 * Prefer original grid N/S/E/W neighbors; otherwise free cardinal pairs.
 * Multiple bridges on one side are spaced evenly so short ends don’t overlap.
 */
export function computeAutoBridges(
  state: PlazaPlotsState,
  d: { id: string; x: number; z: number; size: number },
): AutoBridgeLink[] {
  const cellSize = plotWorldCenter(d, 0, 0).cellSize;
  const minGap = bridgeMinGap(cellSize);
  const maxGap = bridgeMaxGap(cellSize);
  const list = state.plots.filter((p) => p.districtId === d.id);
  if (!list.some((p) => plotIsDisplaced(p, d))) return [];

  // Approx short-end half-width for non-overlap packing on a side
  const halfW = 0.45 * BRIDGE_WIDTH_MUL;
  const minLateralSep = halfW * 2.15;

  type Raw = {
    a: PlotState;
    b: PlotState;
    sideA: PadSide;
    sideB: PadSide;
    gap: number;
    original: boolean;
    /** Preferred lateral on A’s side (projection of B) */
    prefLatA: number;
    prefLatB: number;
  };
  const raws: Raw[] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (!plotIsDisplaced(a, d) && !plotIsDisplaced(b, d)) continue;
      const hasPlayerBridge =
        a.buildings.some((x) => x.kind === 'bridge' && x.bridgeToPlotId === b.id) ||
        b.buildings.some((x) => x.kind === 'bridge' && x.bridgeToPlotId === a.id);
      if (hasPlayerBridge) continue;
      const pair = bestCardinalSidePair(a, b, d);
      if (!pair) continue;
      if (pair.gap < minGap || pair.gap > maxGap) continue;
      const pb = plotLivePos(b, d);
      const pa = plotLivePos(a, d);
      const prefLatA =
        (pb.x - pair.sideA.midX) * pair.sideA.tangentX +
        (pb.z - pair.sideA.midZ) * pair.sideA.tangentZ;
      const prefLatB =
        (pa.x - pair.sideB.midX) * pair.sideB.tangentX +
        (pa.z - pair.sideB.midZ) * pair.sideB.tangentZ;
      raws.push({
        a,
        b,
        sideA: pair.sideA,
        sideB: pair.sideB,
        gap: pair.gap,
        original: isOriginalOrthoNeighbor(a, b),
        prefLatA,
        prefLatB,
      });
    }
  }

  // Prefer original grid neighbors when both kinds exist for a pad-side
  const sideKey = (plotId: string, sideId: number) => `${plotId}:${sideId}`;
  const hasOriginalOnSide = new Set<string>();
  for (const r of raws) {
    if (!r.original) continue;
    hasOriginalOnSide.add(sideKey(r.a.id, r.sideA.id));
    hasOriginalOnSide.add(sideKey(r.b.id, r.sideB.id));
  }
  const filtered = raws.filter((r) => {
    if (r.original) return true;
    // Free cardinal only if that side has no original-neighbor candidate
    const aHas = hasOriginalOnSide.has(sideKey(r.a.id, r.sideA.id));
    const bHas = hasOriginalOnSide.has(sideKey(r.b.id, r.sideB.id));
    return !aHas && !bHas;
  });

  // Greedy: shortest gaps first; pack laterals on each pad-side without overlap
  filtered.sort((x, y) => {
    if (x.original !== y.original) return x.original ? -1 : 1;
    return x.gap - y.gap;
  });

  type Placed = {
    raw: Raw;
    latA: number;
    latB: number;
  };
  const placed: Placed[] = [];
  const usedA = new Map<string, number[]>(); // sideKey → laterals
  const usedB = new Map<string, number[]>();

  const canPack = (used: number[], lat: number) =>
    used.every((u) => Math.abs(u - lat) >= minLateralSep);

  const clampLat = (side: PadSide, lat: number) =>
    Math.max(-side.half * 0.65, Math.min(side.half * 0.65, lat));

  for (const r of filtered) {
    const ka = sideKey(r.a.id, r.sideA.id);
    const kb = sideKey(r.b.id, r.sideB.id);
    const listA = usedA.get(ka) ?? [];
    const listB = usedB.get(kb) ?? [];

    // Even packing: start from preferred projection; if blocked, step along edge
    let latA = clampLat(r.sideA, r.prefLatA);
    let latB = clampLat(r.sideB, r.prefLatB);
    const tryOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];
    let ok = false;
    for (const step of tryOffsets) {
      const ta = clampLat(r.sideA, r.prefLatA + step * minLateralSep * 0.55);
      const tb = clampLat(r.sideB, r.prefLatB + step * minLateralSep * 0.55);
      if (canPack(listA, ta) && canPack(listB, tb)) {
        latA = ta;
        latB = tb;
        ok = true;
        break;
      }
    }
    if (!ok) continue;

    listA.push(latA);
    listB.push(latB);
    usedA.set(ka, listA);
    usedB.set(kb, listB);
    placed.push({ raw: r, latA, latB });
  }

  // Optional even re-spread on sides with 2+ bridges
  const bySideA = new Map<string, Placed[]>();
  for (const p of placed) {
    const k = sideKey(p.raw.a.id, p.raw.sideA.id);
    const arr = bySideA.get(k) ?? [];
    arr.push(p);
    bySideA.set(k, arr);
  }
  for (const [, arr] of bySideA) {
    if (arr.length < 2) continue;
    arr.sort((u, v) => u.latA - v.latA);
    const half = arr[0]!.raw.sideA.half;
    const span = half * 1.2;
    for (let i = 0; i < arr.length; i++) {
      const t = arr.length === 1 ? 0.5 : i / (arr.length - 1);
      arr[i]!.latA = -span * 0.5 + t * span;
    }
  }
  const bySideB = new Map<string, Placed[]>();
  for (const p of placed) {
    const k = sideKey(p.raw.b.id, p.raw.sideB.id);
    const arr = bySideB.get(k) ?? [];
    arr.push(p);
    bySideB.set(k, arr);
  }
  for (const [, arr] of bySideB) {
    if (arr.length < 2) continue;
    arr.sort((u, v) => u.latB - v.latB);
    const half = arr[0]!.raw.sideB.half;
    const span = half * 1.2;
    for (let i = 0; i < arr.length; i++) {
      const t = arr.length === 1 ? 0.5 : i / (arr.length - 1);
      arr[i]!.latB = -span * 0.5 + t * span;
    }
  }

  return placed.map((p) => {
    const aPt = sideAttachPoint(p.raw.sideA, p.latA);
    const bPt = sideAttachPoint(p.raw.sideB, p.latB);
    return {
      fromId: p.raw.a.id,
      toId: p.raw.b.id,
      ax: aPt.x,
      az: aPt.z,
      bx: bPt.x,
      bz: bPt.z,
      gap: p.raw.gap,
      sideA: p.raw.sideA.id,
      sideB: p.raw.sideB.id,
    };
  });
}

/**
 * Short-end endpoints for a player bridge A→B (cardinal facing sides, inset onto pads).
 */
export function bridgeEdgePoints(
  a: PlotState,
  b: PlotState,
  d: { x: number; z: number; size: number },
): { ax: number; az: number; bx: number; bz: number; gap: number } {
  const pair = bestCardinalSidePair(a, b, d);
  if (!pair) {
    // Fallback: no cardinal pair — zero-length (caller should treat as invalid)
    const pa = plotLivePos(a, d);
    return { ax: pa.x, az: pa.z, bx: pa.x, bz: pa.z, gap: 0 };
  }
  const pb = plotLivePos(b, d);
  const pa = plotLivePos(a, d);
  const latA =
    (pb.x - pair.sideA.midX) * pair.sideA.tangentX +
    (pb.z - pair.sideA.midZ) * pair.sideA.tangentZ;
  const latB =
    (pa.x - pair.sideB.midX) * pair.sideB.tangentX +
    (pa.z - pair.sideB.midZ) * pair.sideB.tangentZ;
  const aPt = sideAttachPoint(pair.sideA, latA);
  const bPt = sideAttachPoint(pair.sideB, latB);
  return {
    ax: aPt.x,
    az: aPt.z,
    bx: bPt.x,
    bz: bPt.z,
    gap: pair.gap,
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

// ——— Task 13: recurring plot ownership costs (vacancy / bureaucracy / structure) ———

const BUILD_UPKEEP: Partial<Record<PlotBuildKind, number>> = {
  apartment: 6,
  home: 5,
  garden: 4,
  factory: 10,
  retail: 8,
  decor: 2,
};

const SHAPE_UPKEEP: Record<PlotShape, number> = {
  square: 0,
  octagon: 3,
  circle: 5,
  triangle: 4,
};

/** Empty holding: no primary structure and no paying tenant (land bank). */
export function plotIsEmptyHolding(plot: PlotState): boolean {
  if (plot.owner !== 'player') return false;
  const hasTenant = !!plot.tenantNeighborId && !plot.vacant;
  if (hasTenant) return false;
  return !plotPrimaryBuilding(plot);
}

/** Per-plot structure + layer + shape upkeep (excludes empty tax). */
export function plotStructureUpkeep(plot: PlotState): {
  building: number;
  layer: number;
  shape: number;
  total: number;
} {
  let building = 0;
  for (const b of plot.buildings) {
    if (b.kind === 'empty' || b.kind === 'bridge') continue;
    building += BUILD_UPKEEP[b.kind] ?? 3;
  }
  const layer = Math.max(0, plot.layer ?? 0) * 8;
  const shape = SHAPE_UPKEEP[plot.shape ?? 'square'] ?? 0;
  return { building, layer, shape, total: building + layer + shape };
}

/** Vacancy tax for a single empty player plot (soft land-bank sink). */
export function plotEmptyTax(plot: PlotState): number {
  if (!plotIsEmptyHolding(plot)) return 0;
  // ~0.12% of list / tick, floor so cheap pads still cost to sit idle
  return Math.max(14, Math.round(plot.listPrice * 0.0012));
}
