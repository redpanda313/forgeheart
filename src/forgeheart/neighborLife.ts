/**
 * Neighbor life depth + NPC landlord debt (Tasks 2–3).
 * Separate from romance: economic drama, hire, gift, buyout, rent.
 *
 * Avoids circular imports by accepting InventoryState-shaped bags and
 * injecting standing / hire helpers from the caller where needed — core
 * mutations live here and are re-exported through economy.
 */

import type { CommodityId } from './economy';

// ——— Types ———

export type DramaKind =
  | 'none'
  | 'behind_on_rent'
  | 'sick_relative'
  | 'broken_board'
  | 'workplace_fight'
  | 'lonely'
  | 'expansion_envy'
  | 'tax_warning';

export type RentPolicy = 'cheap' | 'fair' | 'predatory';

export type HomeOwnerKind = 'self' | 'npc_landlord' | 'player' | 'city';

export interface LandlordDef {
  id: string;
  name: string;
  /** Flavor for buyout dialogue */
  firmness: 'soft' | 'fair' | 'hard';
}

export interface LandlordDebt {
  landlordId: string;
  landlordName: string;
  amount: number;
  /** Virtual home key until plot grid ships */
  plotKey: string;
}

export interface NeighborDef {
  id: string;
  name: string;
  homeDistrictId: string;
  jobLabel: string;
  chatLines: string[];
  dramaLines: Partial<Record<DramaKind, string[]>>;
  /** Starting drama */
  startDrama: DramaKind;
  /** Starting home ownership fiction */
  startHomeOwner: HomeOwnerKind;
  startLandlordId?: string;
  startDebt?: number;
}

export interface NeighborState {
  id: string;
  affinity: number;
  drama: DramaKind;
  debt: LandlordDebt | null;
  homeOwner: HomeOwnerKind;
  landlordId: string | null;
  /** Living in their home as your tenant after buy */
  isPlayerTenant: boolean;
  rentPolicy: RentPolicy | null;
  /** Linked WorkerState id if hired onto crew */
  hiredAsWorkerId: string | null;
  known: boolean;
  /** Left after predatory rent */
  vacated: boolean;
  giftsGiven: number;
  /** Brass paid toward their debt via gifts (partial) */
  debtPaidToward: number;
}

export interface NeighborLifeState {
  neighbors: NeighborState[];
  /** City clock ticks since last rent collection */
  rentTickAcc: number;
}

export const LANDLORDS: LandlordDef[] = [
  { id: 'landlord_mira', name: 'Mira Coil', firmness: 'fair' },
  { id: 'landlord_dredge', name: 'Dockmaster Dredge', firmness: 'hard' },
  { id: 'landlord_city', name: 'City Lease Office', firmness: 'soft' },
];

export function landlordById(id: string): LandlordDef | undefined {
  return LANDLORDS.find((l) => l.id === id);
}

export const NEIGHBOR_DEFS: NeighborDef[] = [
  {
    id: 'neighbor_pip',
    name: 'Pip Harper',
    homeDistrictId: 'residential',
    jobLabel: 'Market runner',
    startDrama: 'behind_on_rent',
    startHomeOwner: 'npc_landlord',
    startLandlordId: 'landlord_mira',
    startDebt: 48,
    chatLines: [
      'Empire city! Lease stalls on many plazas — Spore Gardens & Aether Spire pay invent premiums.',
      'Expand your bay forever. Raise worker pay for long program lists.',
      'No roads between islands — only wind skyways. Q board and ride the cyan lanes.',
    ],
    dramaLines: {
      behind_on_rent: [
        'Mira Coil wants forty-eight brass by week’s end or I’m out on the ring walk.',
        'I can still work — I just can’t float rent and food. If you know a soft landlord…',
      ],
      none: ['Things are quiet for once. Thanks for looking in.'],
    },
  },
  {
    id: 'neighbor_sera',
    name: 'Sera Quinn',
    homeDistrictId: 'residential',
    jobLabel: 'Board courier',
    startDrama: 'lonely',
    startHomeOwner: 'self',
    chatLines: [
      'One board purchase forever. Q anywhere. Islands only connect by wind skyways.',
      'Invent at the city workshop or L3 bay, craft, stock premium plazas.',
    ],
    dramaLines: {
      lonely: [
        'The ring gets quiet after dark. I used to fly with a crew.',
        'Company helps more than brass sometimes — but brass never hurts.',
      ],
      broken_board: [
        'Rails cracked on the last reef run. I’m grounded until I can afford a deck patch.',
      ],
      none: ['Sky’s clear. Come by anytime.'],
    },
  },
  {
    id: 'neighbor_bolt',
    name: 'Bolt Voss',
    homeDistrictId: 'residential',
    jobLabel: 'Yard fitter',
    startDrama: 'workplace_fight',
    startHomeOwner: 'npc_landlord',
    startLandlordId: 'landlord_dredge',
    startDebt: 32,
    chatLines: [
      'Industrial slips west. Hire a crew, raise pay grades, run harvest→craft→stock programs.',
      'Shops tax upkeep — earn more than you burn with a retail network.',
    ],
    dramaLines: {
      workplace_fight: [
        'Had words with the slip foreman. Pay’s late and my hands are idle.',
        'If you’ve got a real hire board… I still know a wrench from a rivet.',
      ],
      behind_on_rent: [
        'Dredge doesn’t joke. Thirty-two brass or the pad padlocks.',
      ],
      expansion_envy: [
        'You keep growing the bay. Some of us are stuck on the same square of deck.',
      ],
      none: ['Yard’s honest work when the brass flows.'],
    },
  },
];

export function neighborDef(id: string): NeighborDef | undefined {
  return NEIGHBOR_DEFS.find((d) => d.id === id);
}

export function dramaLabel(d: DramaKind): string {
  switch (d) {
    case 'behind_on_rent':
      return 'Behind on rent';
    case 'sick_relative':
      return 'Family ill';
    case 'broken_board':
      return 'Broken board';
    case 'workplace_fight':
      return 'Work trouble';
    case 'lonely':
      return 'Lonely';
    case 'expansion_envy':
      return 'Wants more room';
    case 'tax_warning':
      return 'Tax warning';
    default:
      return 'No drama';
  }
}

export function emptyNeighborLife(): NeighborLifeState {
  return {
    neighbors: NEIGHBOR_DEFS.map(seedNeighborState),
    rentTickAcc: 0,
  };
}

function seedNeighborState(def: NeighborDef): NeighborState {
  const landlord = def.startLandlordId ? landlordById(def.startLandlordId) : undefined;
  const debt: LandlordDebt | null =
    def.startDrama === 'behind_on_rent' && landlord && def.startDebt
      ? {
          landlordId: landlord.id,
          landlordName: landlord.name,
          amount: def.startDebt,
          plotKey: `home_${def.id}`,
        }
      : def.startDebt && landlord
        ? {
            landlordId: landlord.id,
            landlordName: landlord.name,
            amount: def.startDebt,
            plotKey: `home_${def.id}`,
          }
        : null;
  // Bolt has debt fiction even if primary drama is workplace — optional secondary
  let drama = def.startDrama;
  let debtFinal = debt;
  if (def.id === 'neighbor_bolt' && landlord && def.startDebt) {
    debtFinal = {
      landlordId: landlord.id,
      landlordName: landlord.name,
      amount: def.startDebt,
      plotKey: `home_${def.id}`,
    };
    // Keep workplace drama as primary; debt still exists for clear-debt action
  }
  if (def.id === 'neighbor_pip') {
    drama = 'behind_on_rent';
  }
  return {
    id: def.id,
    affinity: 8,
    drama,
    debt: debtFinal,
    homeOwner: def.startHomeOwner,
    landlordId: def.startLandlordId ?? null,
    isPlayerTenant: false,
    rentPolicy: null,
    hiredAsWorkerId: null,
    known: false,
    vacated: false,
    giftsGiven: 0,
    debtPaidToward: 0,
  };
}

export function ensureNeighborLife(life: NeighborLifeState | null | undefined): NeighborLifeState {
  if (!life || !Array.isArray(life.neighbors) || life.neighbors.length === 0) {
    return emptyNeighborLife();
  }
  // Merge any new defs not in save
  const byId = new Map(life.neighbors.map((n) => [n.id, n]));
  for (const def of NEIGHBOR_DEFS) {
    if (!byId.has(def.id)) {
      life.neighbors.push(seedNeighborState(def));
    }
  }
  life.rentTickAcc = typeof life.rentTickAcc === 'number' ? life.rentTickAcc : 0;
  return life;
}

export function getNeighborState(
  life: NeighborLifeState,
  id: string,
): NeighborState | undefined {
  return ensureNeighborLife(life).neighbors.find((n) => n.id === id);
}

export function neighborStatusLine(n: NeighborState): string {
  const bits = [
    `Affinity ${Math.round(n.affinity)}`,
    dramaLabel(n.drama),
  ];
  if (n.debt && n.debt.amount > 0) {
    bits.push(`Debt ${n.debt.amount}b → ${n.debt.landlordName}`);
  }
  if (n.homeOwner === 'player') {
    bits.push(
      n.isPlayerTenant && n.rentPolicy
        ? `Your tenant · ${n.rentPolicy}`
        : 'You own their pad',
    );
  }
  if (n.hiredAsWorkerId) bits.push('On your crew');
  if (n.vacated) bits.push('Vacated');
  return bits.join(' · ');
}

export function neighborInteractLabel(n: NeighborState, name: string): string {
  if (n.vacated) return `${name} (vacant pad)`;
  if (n.drama !== 'none') return `${name} · ${dramaLabel(n.drama)}`;
  if (n.debt && n.debt.amount > 0) return `${name} · debt ${n.debt.amount}b`;
  return `Talk to ${name}`;
}

/** Goods useful as neighbor gifts (broader than romance) */
export const NEIGHBOR_GIFT_IDS: CommodityId[] = [
  'cloud_iron',
  'scrap_brass',
  'spore_silk',
  'sky_salt',
  'gear_blank',
  'flower_gift',
  'brass_charm',
  'silk_scarf',
  'bloom_brass',
  'bloom_sky',
  'bloom_spore',
  'bloom_harbor',
  'bloom_aether',
];

export function neighborLifeToSave(life: NeighborLifeState) {
  const L = ensureNeighborLife(life);
  return {
    rentTickAcc: L.rentTickAcc,
    neighbors: L.neighbors.map((n) => ({
      id: n.id,
      affinity: n.affinity,
      drama: n.drama,
      debt: n.debt
        ? {
            landlordId: n.debt.landlordId,
            landlordName: n.debt.landlordName,
            amount: n.debt.amount,
            plotKey: n.debt.plotKey,
          }
        : null,
      homeOwner: n.homeOwner,
      landlordId: n.landlordId,
      isPlayerTenant: n.isPlayerTenant,
      rentPolicy: n.rentPolicy,
      hiredAsWorkerId: n.hiredAsWorkerId,
      known: n.known,
      vacated: n.vacated,
      giftsGiven: n.giftsGiven,
      debtPaidToward: n.debtPaidToward,
    })),
  };
}

export function neighborLifeFromSave(raw: unknown): NeighborLifeState {
  if (!raw || typeof raw !== 'object') return emptyNeighborLife();
  const o = raw as Record<string, unknown>;
  const base = emptyNeighborLife();
  if (!Array.isArray(o.neighbors)) return base;
  const saved = new Map<string, Record<string, unknown>>();
  for (const row of o.neighbors as Record<string, unknown>[]) {
    if (row && typeof row.id === 'string') saved.set(row.id, row);
  }
  for (const n of base.neighbors) {
    const s = saved.get(n.id);
    if (!s) continue;
    if (typeof s.affinity === 'number') n.affinity = s.affinity;
    if (typeof s.drama === 'string') n.drama = s.drama as DramaKind;
    if (s.debt && typeof s.debt === 'object') {
      const d = s.debt as Record<string, unknown>;
      n.debt = {
        landlordId: String(d.landlordId ?? 'landlord_city'),
        landlordName: String(d.landlordName ?? 'Landlord'),
        amount: typeof d.amount === 'number' ? Math.max(0, d.amount) : 0,
        plotKey: String(d.plotKey ?? `home_${n.id}`),
      };
      if (n.debt.amount <= 0) n.debt = null;
    } else if (s.debt === null) {
      n.debt = null;
    }
    if (typeof s.homeOwner === 'string') n.homeOwner = s.homeOwner as HomeOwnerKind;
    n.landlordId = typeof s.landlordId === 'string' ? s.landlordId : n.landlordId;
    n.isPlayerTenant = !!s.isPlayerTenant;
    n.rentPolicy =
      s.rentPolicy === 'cheap' || s.rentPolicy === 'fair' || s.rentPolicy === 'predatory'
        ? s.rentPolicy
        : null;
    n.hiredAsWorkerId =
      typeof s.hiredAsWorkerId === 'string' ? s.hiredAsWorkerId : null;
    n.known = !!s.known;
    n.vacated = !!s.vacated;
    n.giftsGiven = typeof s.giftsGiven === 'number' ? s.giftsGiven : 0;
    n.debtPaidToward = typeof s.debtPaidToward === 'number' ? s.debtPaidToward : 0;
  }
  base.rentTickAcc = typeof o.rentTickAcc === 'number' ? o.rentTickAcc : 0;
  return base;
}

export const RENT_INCOME: Record<RentPolicy, number> = {
  cheap: 2,
  fair: 5,
  predatory: 9,
};

/** Chance tenant leaves on a rent tick under predatory policy */
export const PREDATORY_LEAVE_CHANCE = 0.18;
