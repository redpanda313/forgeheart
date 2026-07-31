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
  | 'tax_warning'
  /** Lost home after rent/livelihood failure — still talkable/hireable (Layer M) */
  | 'homeless';

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
  /**
   * List price for buying the pad (brass). Varies by quality/location.
   * Cheapest empire pads ~10k; premium pads 100k+.
   */
  basePrice: number;
  /** Short tier tag for UI (Ring walk / Courtyard / Foundry-view) */
  priceTierLabel: string;
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
  /** Left after predatory rent (or pad empty); homeless still interactable */
  vacated: boolean;
  giftsGiven: number;
  /** Brass paid toward their debt via gifts (partial) */
  debtPaidToward: number;
  /**
   * Layer M — lost home, wanders city. Interactable for hire/gift/clear debt.
   * Distinct from vacated-only (predatory leave with no rescue loop).
   */
  homeless?: boolean;
  /** Livelihood fail counter toward homeless (NPC wages/rent stress) */
  livelihoodFails?: number;
  /** Wall-clock ms of last talk/learn affinity grant (rate limit) */
  lastTalkAffinityMs?: number;
  /** Wall-clock ms of last meaningful gift affinity grant */
  lastGiftAffinityMs?: number;
  /**
   * Fiction: NPC runs a small stand in home district (same sales pipeline lite).
   * Closed when homeless or livelihood failure closes shop.
   */
  vendorOpen?: boolean;
  /** Soft wages earned from fictional stand (reduces fail pressure) */
  vendorEarned?: number;
}

/**
 * Prospective tenant offer on a vacant player-owned home (Layer M + RE).
 * NPC proposes a rent tier; player accepts or rejects.
 */
export interface TenantOffer {
  id: string;
  /** Neighbor id applying for housing */
  applicantId: string;
  /** neighbor_pad = ring/homeowner pad key (neighbor id); plot = plaza plot id */
  homeKind: 'neighbor_pad' | 'plot';
  homeKey: string;
  offeredPolicy: RentPolicy;
  offeredRent: number;
  pitch: string;
}

export interface NeighborLifeState {
  neighbors: NeighborState[];
  /** City clock ticks since last rent collection */
  rentTickAcc: number;
  /** Open applications for vacant player homes */
  pendingTenantOffers: TenantOffer[];
}

export const LANDLORDS: LandlordDef[] = [
  { id: 'landlord_mira', name: 'Mira Coil', firmness: 'fair' },
  { id: 'landlord_dredge', name: 'Dockmaster Dredge', firmness: 'hard' },
  { id: 'landlord_city', name: 'City Lease Office', firmness: 'soft' },
];

export function landlordById(id: string): LandlordDef | undefined {
  return LANDLORDS.find((l) => l.id === id);
}

/** Stable id for the named owner of each plaza HOME shell */
export function homeownerNeighborId(districtId: string): string {
  return `homeowner_${districtId}`;
}

/** Hand-authored residential-ring neighbors (starter drama cast) */
export const NEIGHBOR_RING_DEFS: NeighborDef[] = [
  {
    id: 'neighbor_pip',
    name: 'Pip Harper',
    homeDistrictId: 'residential',
    jobLabel: 'Market runner',
    startDrama: 'behind_on_rent',
    startHomeOwner: 'npc_landlord',
    startLandlordId: 'landlord_mira',
    /** Cheapest ring-walk pad — entry landlord play */
    basePrice: 10_000,
    priceTierLabel: 'Ring walk · modest',
    /** ~1.5 months fair rent behind */
    startDebt: 1_200,
    chatLines: [
      'Empire city! Lease stalls on many plazas — Spore Gardens & Aether Spire pay invent premiums.',
      'Expand your bay forever. Raise worker pay for long program lists.',
      'No roads between islands — only wind skyways. Q board and ride the cyan lanes.',
    ],
    dramaLines: {
      behind_on_rent: [
        'Mira Coil wants twelve hundred brass by week’s end or I’m out on the ring walk.',
        'I can still work — I just can’t float rent and food. If you know a soft landlord…',
      ],
      homeless: [
        'Pad’s padlocked. I’m under the wind lanes — hire me or clear Mira and I can stand again.',
        'Market runner without a roof. Still know every stall route if you’ve got a crew slot.',
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
    /** Mid-tier self-owned courtyard pad */
    basePrice: 42_000,
    priceTierLabel: 'Courtyard · mid',
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
    /** Premium foundry-view pad — late empire buy */
    basePrice: 125_000,
    priceTierLabel: 'Foundry-view · premium',
    /** Large arrears on a high pad */
    startDebt: 6_500,
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
        'Dredge doesn’t joke. Sixty-five hundred brass or the pad padlocks.',
      ],
      homeless: [
        'Dredge took the pad. I’m a yard fitter on the street — hire me before the cold does.',
        'No roof, full toolkit in my head. Clear the debt or put me on a bay board.',
      ],
      expansion_envy: [
        'You keep growing the bay. Some of us are stuck on the same square of deck.',
      ],
      none: ['Yard’s honest work when the brass flows.'],
    },
  },
];

/**
 * Plaza HOME shells (one per district) — mirrors CITY_DISTRICTS ids.
 * Pass A: each has a named owner with full neighbor interact.
 */
export interface PlazaHomeDistrictMeta {
  id: string;
  name: string;
  role: string;
  stallCost: number;
}

/** Keep in sync with CITY_DISTRICTS in economy.ts */
export const PLAZA_HOME_DISTRICTS: PlazaHomeDistrictMeta[] = [
  { id: 'residential', name: 'Residential Ring', role: 'home', stallCost: 90 },
  { id: 'grand_market', name: 'Grand Market', role: 'market', stallCost: 280 },
  { id: 'industrial', name: 'Industrial Slips', role: 'industrial', stallCost: 160 },
  { id: 'harbor', name: 'Cloud Harbor', role: 'harbor', stallCost: 200 },
  { id: 'clocktower', name: 'Clocktower Bazaar', role: 'premium', stallCost: 340 },
  { id: 'gearworks', name: 'Gearworks Ward', role: 'industrial', stallCost: 220 },
  { id: 'spore_gardens', name: 'Spore Gardens', role: 'premium', stallCost: 260 },
  { id: 'brass_arcade', name: 'Brass Arcade', role: 'premium', stallCost: 300 },
  { id: 'sky_foundry', name: 'Sky Foundry', role: 'industrial', stallCost: 240 },
  { id: 'aether_spire', name: 'Aether Spire', role: 'premium', stallCost: 480 },
  { id: 'mid_ring_east', name: 'East Mid-Ring', role: 'mixed', stallCost: 140 },
  { id: 'mid_ring_west', name: 'West Mid-Ring', role: 'mixed', stallCost: 140 },
  { id: 'south_docks', name: 'South Docks', role: 'harbor', stallCost: 180 },
  { id: 'north_observatory', name: 'North Observatory', role: 'premium', stallCost: 320 },
];

const HOMEOWNER_FIRST = [
  'Ash',
  'Bram',
  'Cora',
  'Dax',
  'Elia',
  'Fern',
  'Grit',
  'Hale',
  'Ivy',
  'Joss',
  'Kade',
  'Lark',
  'Moss',
  'Nia',
  'Orrin',
  'Pax',
  'Quinn',
  'Rook',
  'Sage',
  'Tess',
  'Una',
  'Vex',
  'Wren',
  'Yara',
];
const HOMEOWNER_LAST = [
  'Weld',
  'Pike',
  'Coil',
  'Drift',
  'Voss',
  'Reed',
  'Thorn',
  'Gilt',
  'Marsh',
  'Crane',
  'Forge',
  'Salt',
  'Spire',
  'Quill',
  'Hearth',
  'Lantern',
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number, salt: number): T {
  return arr[(seed + salt * 17) % arr.length]!;
}

const ROLE_JOB: Record<string, string[]> = {
  home: ['Plaza caretaker', 'Ring runner', 'Board courier'],
  market: ['Stall keeper', 'Inventory clerk', 'Market broker'],
  industrial: ['Yard fitter', 'Haul lead', 'Slip mechanic'],
  harbor: ['Dock clerk', 'Salt runner', 'Ferry agent'],
  premium: ['Boutique keeper', 'Aether clerk', 'Gallery host'],
  mixed: ['Mixed-trade runner', 'Courier', 'Shop assistant'],
};

const DRAMAS: DramaKind[] = [
  'behind_on_rent',
  'lonely',
  'workplace_fight',
  'broken_board',
  'expansion_envy',
  'sick_relative',
  'tax_warning',
  'none',
];

function basePriceForPlaza(meta: PlazaHomeDistrictMeta): number {
  const roleMul: Record<string, number> = {
    home: 1.0,
    mixed: 1.15,
    harbor: 1.35,
    industrial: 1.25,
    market: 1.55,
    premium: 2.2,
  };
  const mul = roleMul[meta.role] ?? 1.2;
  const raw = Math.round(meta.stallCost * 220 * mul);
  // Cheapest plaza homes ~12k; premium can exceed 100k
  return Math.max(12_000, Math.min(185_000, raw));
}

function tierLabelForPlaza(meta: PlazaHomeDistrictMeta, price: number): string {
  if (price < 25_000) return `${meta.name} · modest home`;
  if (price < 55_000) return `${meta.name} · mid home`;
  if (price < 100_000) return `${meta.name} · fine home`;
  return `${meta.name} · premium home`;
}

export function makePlazaHomeownerDef(
  meta: PlazaHomeDistrictMeta,
  index: number,
): NeighborDef {
  const seed = hashStr(meta.id);
  const first = pick(HOMEOWNER_FIRST, seed, 1);
  const last = pick(HOMEOWNER_LAST, seed, 3);
  // Avoid colliding with ring cast first names when possible
  const name = `${first} ${last}`;
  const jobs = ROLE_JOB[meta.role] ?? ROLE_JOB.mixed!;
  const jobLabel = pick(jobs, seed, 5);
  const basePrice = basePriceForPlaza(meta);
  const drama = DRAMAS[index % DRAMAS.length]!;
  const landlordRoll = seed % 3;
  let startHomeOwner: HomeOwnerKind = 'self';
  let startLandlordId: string | undefined;
  let startDebt: number | undefined;
  if (drama === 'behind_on_rent' || drama === 'tax_warning') {
    startHomeOwner = 'npc_landlord';
    startLandlordId =
      landlordRoll === 0
        ? 'landlord_mira'
        : landlordRoll === 1
          ? 'landlord_dredge'
          : 'landlord_city';
    startDebt = Math.round(basePrice * (0.06 + (seed % 5) * 0.01));
  } else if (landlordRoll === 0 && meta.role !== 'premium') {
    startHomeOwner = 'npc_landlord';
    startLandlordId = 'landlord_mira';
  } else if (landlordRoll === 1 && meta.role === 'industrial') {
    startHomeOwner = 'npc_landlord';
    startLandlordId = 'landlord_dredge';
  }

  const landlordName =
    (startLandlordId && landlordById(startLandlordId)?.name) || 'the landlord';
  const debtStr = startDebt ? startDebt.toLocaleString() : '';

  const plazaChat = [
    `I keep a home on ${meta.name}. Work fills the day — stalls, hauls, the whole circuit.`,
    `This plaza’s my pad. If you’ve got brass and a fair hand, we can talk business.`,
    `Skyways only between islands. Board out if you’re shopping the city.`,
  ];

  return {
    id: homeownerNeighborId(meta.id),
    name,
    homeDistrictId: meta.id,
    jobLabel,
    startDrama: drama,
    startHomeOwner,
    startLandlordId,
    startDebt,
    basePrice,
    priceTierLabel: tierLabelForPlaza(meta, basePrice),
    chatLines: plazaChat,
    dramaLines: {
      behind_on_rent: [
        `${landlordName} wants ${debtStr} brass or this HOME padlocks.`,
        `I’m short on rent for ${meta.name}. Still good for work if you’ve got a crew slot.`,
      ],
      lonely: [
        `Quiet nights on ${meta.name}. Company helps more than you’d think.`,
        `Everyone’s at market. The house feels big with one person in it.`,
      ],
      workplace_fight: [
        `Had words at the job. Pay’s late and my hands want honest work.`,
        `If your hire board is real, I know a wrench from a rivet.`,
      ],
      broken_board: [
        `Rails cracked last reef run. Grounded until I can patch the deck.`,
      ],
      expansion_envy: [
        `You keep growing. Some of us are stuck on one square of deck on ${meta.name}.`,
      ],
      sick_relative: [
        `Family’s rough this week. Brass for medicine would mean more than small talk.`,
      ],
      homeless: [
        `Pad’s gone on ${meta.name}. I’m on the wind lanes now — hire or gift if you’ve got a heart.`,
        `No roof. Still got skill. Clear the debt or put me on crew and I’ll stand again.`,
      ],
      tax_warning: [
        `City Lease Office sent a notice. ${debtStr ? debtStr + ' brass' : 'Coin'} or they seize the pad.`,
      ],
      none: [`Home’s quiet. Welcome to ${meta.name}.`],
    },
  };
}

/** All plaza HOME owners (Pass A) */
export const PLAZA_HOMEOWNER_DEFS: NeighborDef[] = PLAZA_HOME_DISTRICTS.map(
  (m, i) => makePlazaHomeownerDef(m, i),
);

/** Ring cast + every plaza homeowner */
export const NEIGHBOR_DEFS: NeighborDef[] = [
  ...NEIGHBOR_RING_DEFS,
  ...PLAZA_HOMEOWNER_DEFS,
];

export function neighborDef(id: string): NeighborDef | undefined {
  return NEIGHBOR_DEFS.find((d) => d.id === id);
}

export function homeownerDefForDistrict(districtId: string): NeighborDef | undefined {
  return neighborDef(homeownerNeighborId(districtId));
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
    case 'homeless':
      return 'Homeless · needs help';
    default:
      return 'No drama';
  }
}

export function emptyNeighborLife(): NeighborLifeState {
  return {
    neighbors: NEIGHBOR_DEFS.map(seedNeighborState),
    rentTickAcc: 0,
    pendingTenantOffers: [],
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
  // Market-role jobs start with a small open stand fiction (Layer M wages)
  const job = def.jobLabel.toLowerCase();
  const vendorish =
    job.includes('stall') ||
    job.includes('market') ||
    job.includes('broker') ||
    job.includes('clerk') ||
    job.includes('keeper') ||
    job.includes('runner') ||
    job.includes('host');
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
    homeless: false,
    livelihoodFails: 0,
    lastTalkAffinityMs: 0,
    lastGiftAffinityMs: 0,
    vendorOpen: vendorish && drama !== 'homeless',
    vendorEarned: 0,
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
    } else {
      // Migrate pre-scale tiny debts (old 32/48b era) up to current startDebt
      const n = byId.get(def.id)!;
      if (
        n.debt &&
        n.debt.amount > 0 &&
        n.debt.amount < 200 &&
        def.startDebt &&
        def.startDebt > n.debt.amount &&
        n.homeOwner !== 'player'
      ) {
        n.debt.amount = def.startDebt;
        n.debt.landlordName =
          landlordById(n.debt.landlordId)?.name ?? n.debt.landlordName;
      }
    }
  }
  life.rentTickAcc = typeof life.rentTickAcc === 'number' ? life.rentTickAcc : 0;
  if (!Array.isArray(life.pendingTenantOffers)) life.pendingTenantOffers = [];
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
  if (n.homeless) bits.push('Wandering · no pad');
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
  if (n.vendorOpen) bits.push('Stand open');
  else if (n.vendorOpen === false && (n.vendorEarned ?? 0) > 0) bits.push('Stand closed');
  if (n.vacated && !n.homeless) bits.push('Vacated');
  return bits.join(' · ');
}

export function neighborInteractLabel(n: NeighborState, name: string): string {
  if (n.homeless) return `${name} · homeless · help?`;
  if (n.vacated) return `${name} (vacant pad)`;
  if (n.drama !== 'none') return `${name} · ${dramaLabel(n.drama)}`;
  if (n.debt && n.debt.amount > 0) return `${name} · debt ${n.debt.amount}b`;
  return `Talk to ${name}`;
}

/** True when the person is still a social target (not a pure empty pad). */
export function neighborIsTalkable(n: NeighborState): boolean {
  if (n.homeless) return true;
  if (n.hiredAsWorkerId) return true;
  return !n.vacated;
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
    pendingTenantOffers: (L.pendingTenantOffers ?? []).map((o) => ({
      id: o.id,
      applicantId: o.applicantId,
      homeKind: o.homeKind,
      homeKey: o.homeKey,
      offeredPolicy: o.offeredPolicy,
      offeredRent: o.offeredRent,
      pitch: o.pitch,
    })),
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
      homeless: !!n.homeless,
      livelihoodFails: n.livelihoodFails ?? 0,
      lastTalkAffinityMs: n.lastTalkAffinityMs ?? 0,
      lastGiftAffinityMs: n.lastGiftAffinityMs ?? 0,
      vendorOpen: n.vendorOpen !== false,
      vendorEarned: n.vendorEarned ?? 0,
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
    n.homeless = !!s.homeless;
    n.livelihoodFails = typeof s.livelihoodFails === 'number' ? s.livelihoodFails : 0;
    n.lastTalkAffinityMs =
      typeof s.lastTalkAffinityMs === 'number' ? s.lastTalkAffinityMs : 0;
    n.lastGiftAffinityMs =
      typeof s.lastGiftAffinityMs === 'number' ? s.lastGiftAffinityMs : 0;
    n.vendorOpen = s.vendorOpen !== false && !n.homeless;
    n.vendorEarned = typeof s.vendorEarned === 'number' ? s.vendorEarned : 0;
    if (n.homeless) {
      n.drama = 'homeless';
      n.vacated = true;
      n.vendorOpen = false;
    }
  }
  base.rentTickAcc = typeof o.rentTickAcc === 'number' ? o.rentTickAcc : 0;
  base.pendingTenantOffers = [];
  if (Array.isArray(o.pendingTenantOffers)) {
    for (const raw of o.pendingTenantOffers as Record<string, unknown>[]) {
      if (!raw || typeof raw.applicantId !== 'string' || typeof raw.homeKey !== 'string') {
        continue;
      }
      const pol = raw.offeredPolicy;
      const offeredPolicy: RentPolicy =
        pol === 'cheap' || pol === 'fair' || pol === 'predatory' ? pol : 'fair';
      base.pendingTenantOffers.push({
        id: typeof raw.id === 'string' ? raw.id : `offer_${raw.applicantId}_${raw.homeKey}`,
        applicantId: raw.applicantId,
        homeKind: raw.homeKind === 'plot' ? 'plot' : 'neighbor_pad',
        homeKey: raw.homeKey,
        offeredPolicy,
        offeredRent: typeof raw.offeredRent === 'number' ? raw.offeredRent : 0,
        pitch: typeof raw.pitch === 'string' ? raw.pitch : 'Looking for a pad.',
      });
    }
  }
  return base;
}

/**
 * Rent as a fraction of pad basePrice per bay-upkeep tick (~28s).
 * ~+20% vs original: 10k pad fair ≈ 60b/tick; 125k fair ≈ 750b/tick.
 * Cheap is soft (standing); predatory pays more but risk of leave.
 */
export const RENT_RATE_OF_VALUE: Record<RentPolicy, number> = {
  cheap: 0.0024, // 0.24% of value / tick
  fair: 0.006, // 0.60% of value / tick
  predatory: 0.011, // 1.10% of value / tick
};

/** @deprecated fixed amounts — use rentIncomeForPad */
export const RENT_INCOME: Record<RentPolicy, number> = {
  cheap: 24,
  fair: 60,
  predatory: 110,
};

/** Chance tenant leaves on a rent tick under predatory policy */
export const PREDATORY_LEAVE_CHANCE = 0.18;

/** Min rent floor so free/broken data never pays zero */
export const RENT_INCOME_FLOOR = 8;

export function rentIncomeForPad(basePrice: number, policy: RentPolicy): number {
  const raw = Math.round(basePrice * RENT_RATE_OF_VALUE[policy]);
  return Math.max(RENT_INCOME_FLOOR, raw);
}

/** List price after affinity goodwill (up to ~12% off at affinity 100). */
export function quoteNeighborPadPrice(
  def: NeighborDef,
  affinity: number,
): { list: number; price: number; discount: number } {
  const list = def.basePrice;
  const aff = Math.max(0, Math.min(100, affinity));
  const discount = Math.round(list * (aff * 0.0012));
  const price = Math.max(Math.round(list * 0.88), list - discount);
  return { list, price, discount };
}
