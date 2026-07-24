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

export interface PlotBuildingStub {
  /** Task 7 expands catalog; Task 6 uses apartment slots for rent capacity */
  kind: 'empty' | 'apartment' | 'home';
  tenantSlots?: number;
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
  rotation: number;
  layer: number;
  listPrice: number;
  forSale: boolean;
  /** Vacant after predatory leave — no rent until re-tenant */
  vacant: boolean;
}

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
    const income = rentIncomeForPad(p.listPrice, p.rentPolicy);
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
