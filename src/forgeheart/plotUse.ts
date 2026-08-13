/**
 * Player land occupancy — NPCs / crew fill housing, retail, and factory pads.
 * Offers → accept → live use (rent name, shop stock, factory wage tick).
 */

import type { CommodityId } from './economy';
import type { RentPolicy } from './neighborLife';
import { rentIncomeForPad } from './neighborLife';
import type { PlotState, PlazaPlotsState, PlotBuildKind } from './plazaPlots';

function hasBuild(plot: PlotState, kind: PlotBuildKind): boolean {
  return (plot.buildings ?? []).some((b) => b.kind === kind);
}

export type PlotFillKind = 'housing' | 'retail' | 'factory';

export interface PlotFillOffer {
  id: string;
  plotId: string;
  kind: PlotFillKind;
  /** Neighbor id (housing/retail/npc factory) or worker id (crew factory) */
  applicantId: string;
  applicantKind: 'npc' | 'worker';
  applicantName: string;
  offeredPolicy?: RentPolicy;
  offeredRent?: number;
  pitch: string;
  /**
   * When set, accepting housing spawns a brand-new migrant NPC (one home only)
   * instead of reusing an existing resident who already has a pad.
   */
  migrantSeed?: string;
}

export interface PlotUseSnapshot {
  retailOperatorId: string | null;
  retailShelf: Partial<Record<CommodityId, number>>;
  factoryOperatorId: string | null;
  factoryOperatorKind: 'npc' | 'worker' | null;
}

export function emptyPlotUse(): PlotUseSnapshot {
  return {
    retailOperatorId: null,
    retailShelf: {},
    factoryOperatorId: null,
    factoryOperatorKind: null,
  };
}

/** Goods NPC shopkeepers can stock on player retail fronts. */
export const PLOT_RETAIL_STOCK_POOL: CommodityId[] = [
  'cloud_iron',
  'scrap_brass',
  'spore_silk',
  'sky_salt',
  'wire',
  'gear_blank',
  'glass_pane',
  'fuel_cell',
  'repair_kit',
  'flower_gift',
];

export function plotHasHousing(plot: PlotState): boolean {
  return hasBuild(plot, 'home') || hasBuild(plot, 'apartment');
}

export function plotHasRetail(plot: PlotState): boolean {
  return hasBuild(plot, 'retail') || !!plot.retailBound;
}

export function plotHasFactory(plot: PlotState): boolean {
  return hasBuild(plot, 'factory');
}

/** Live name for signs: tenant / shopkeeper / factory lead. */
export function plotOccupancyLabel(
  plot: PlotState,
  nameOf: (id: string) => string | undefined,
): string | null {
  if (plot.owner !== 'player') return null;
  if (plotHasHousing(plot) && plot.tenantNeighborId && !plot.vacant) {
    const n = nameOf(plot.tenantNeighborId);
    return n ? `${n}'s home` : 'Tenant home';
  }
  if (plotHasRetail(plot) && plot.retailOperatorId) {
    const n = nameOf(plot.retailOperatorId);
    return n ? `${n}'s shop` : 'Open shop';
  }
  if (plotHasFactory(plot) && plot.factoryOperatorId) {
    if (plot.factoryOperatorKind === 'worker') {
      return 'Crew works';
    }
    const n = nameOf(plot.factoryOperatorId);
    return n ? `${n}'s works` : 'Works open';
  }
  if (plotHasHousing(plot) && (plot.vacant || !plot.tenantNeighborId)) {
    return 'Vacant home';
  }
  if (plotHasRetail(plot) && !plot.retailOperatorId) {
    return 'Vacant shop';
  }
  if (plotHasFactory(plot) && !plot.factoryOperatorId) {
    return 'Vacant works';
  }
  return null;
}

export function ensurePlotUseFields(plot: PlotState): void {
  if (plot.retailOperatorId === undefined) plot.retailOperatorId = null;
  if (!plot.retailShelf || typeof plot.retailShelf !== 'object') plot.retailShelf = {};
  if (plot.factoryOperatorId === undefined) plot.factoryOperatorId = null;
  if (plot.factoryOperatorKind === undefined) plot.factoryOperatorKind = null;
}

export function plotUseToSave(plot: PlotState) {
  ensurePlotUseFields(plot);
  return {
    retailOperatorId: plot.retailOperatorId,
    retailShelf: { ...(plot.retailShelf ?? {}) },
    factoryOperatorId: plot.factoryOperatorId,
    factoryOperatorKind: plot.factoryOperatorKind,
  };
}

export function applyPlotUseFromSave(plot: PlotState, raw: Record<string, unknown>): void {
  plot.retailOperatorId =
    typeof raw.retailOperatorId === 'string' ? raw.retailOperatorId : null;
  plot.retailShelf = {};
  if (raw.retailShelf && typeof raw.retailShelf === 'object') {
    for (const [k, v] of Object.entries(raw.retailShelf as Record<string, unknown>)) {
      if (typeof v === 'number' && v > 0) {
        plot.retailShelf[k as CommodityId] = Math.floor(v);
      }
    }
  }
  plot.factoryOperatorId =
    typeof raw.factoryOperatorId === 'string' ? raw.factoryOperatorId : null;
  plot.factoryOperatorKind =
    raw.factoryOperatorKind === 'npc' || raw.factoryOperatorKind === 'worker'
      ? raw.factoryOperatorKind
      : null;
}

/** Restock a few units for open retail (NPC fiction supply). */
export function restockPlotRetail(plot: PlotState): number {
  ensurePlotUseFields(plot);
  if (!plot.retailOperatorId || !plotHasRetail(plot)) return 0;
  if (!plot.retailShelf) plot.retailShelf = {};
  let added = 0;
  const picks = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < picks; i++) {
    const id = PLOT_RETAIL_STOCK_POOL[Math.floor(Math.random() * PLOT_RETAIL_STOCK_POOL.length)]!;
    const cur = plot.retailShelf[id] ?? 0;
    if (cur >= 12) continue;
    const n = 1 + Math.floor(Math.random() * 2);
    plot.retailShelf[id] = cur + n;
    added += n;
  }
  return added;
}

/** Factory operated by NPC/crew — small brass yield per rent tick. */
export function factoryPlotIncome(plot: PlotState): number {
  if (!plotHasFactory(plot) || !plot.factoryOperatorId) return 0;
  if (plot.factoryOperatorKind === 'worker') return 14 + Math.floor(Math.random() * 10);
  return 8 + Math.floor(Math.random() * 8);
}

export function listFillablePlayerPlots(state: PlazaPlotsState): {
  plot: PlotState;
  kinds: PlotFillKind[];
}[] {
  const out: { plot: PlotState; kinds: PlotFillKind[] }[] = [];
  for (const p of state.plots) {
    if (p.owner !== 'player') continue;
    ensurePlotUseFields(p);
    const kinds: PlotFillKind[] = [];
    if (plotHasHousing(p) && (p.vacant || !p.tenantNeighborId)) kinds.push('housing');
    if (plotHasRetail(p) && !p.retailOperatorId) kinds.push('retail');
    if (plotHasFactory(p) && !p.factoryOperatorId) kinds.push('factory');
    if (kinds.length) out.push({ plot: p, kinds });
  }
  return out;
}

export function pendingOffersToSave(offers: PlotFillOffer[]) {
  return offers.map((o) => ({ ...o }));
}

export function pendingOffersFromSave(raw: unknown): PlotFillOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: PlotFillOffer[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.plotId !== 'string' || typeof r.applicantId !== 'string') continue;
    const kind = r.kind;
    if (kind !== 'housing' && kind !== 'retail' && kind !== 'factory') continue;
    const pol = r.offeredPolicy;
    out.push({
      id: typeof r.id === 'string' ? r.id : `fill_${r.plotId}_${r.applicantId}`,
      plotId: r.plotId,
      kind,
      applicantId: r.applicantId,
      applicantKind: r.applicantKind === 'worker' ? 'worker' : 'npc',
      applicantName: typeof r.applicantName === 'string' ? r.applicantName : 'Applicant',
      offeredPolicy:
        pol === 'cheap' || pol === 'fair' || pol === 'predatory' ? pol : undefined,
      offeredRent: typeof r.offeredRent === 'number' ? r.offeredRent : undefined,
      pitch: typeof r.pitch === 'string' ? r.pitch : 'Wants to use this pad.',
      migrantSeed: typeof r.migrantSeed === 'string' ? r.migrantSeed : undefined,
    });
  }
  return out;
}

export function defaultHousingOfferPolicy(): RentPolicy {
  const r = Math.random();
  if (r < 0.45) return 'cheap';
  if (r < 0.9) return 'fair';
  return 'predatory';
}

export function housingOfferRent(basePrice: number, policy: RentPolicy): number {
  return rentIncomeForPad(basePrice, policy);
}
