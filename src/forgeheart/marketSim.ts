/**
 * Layer M — Shared market dynamics (SP + Co-op + Comp).
 *
 * Pure formulas and helpers. Ownership adapters (solo / team / per-player)
 * live outside; this module never assumes multiplayer.
 *
 * ## M0 Spec lock (SP v1 numbers)
 *
 * | Factor | Rule |
 * |--------|------|
 * | Customer need | mats / parts / frames / inventions / gifts / flowers |
 * | Underserved niche | ≤1 open player stall stocks need → ×1.28 traffic |
 * | Balanced | 2 open stalls stock need → ×1.0 |
 * | Busy | 3 open stalls → ×0.88 |
 * | Overserved | 4+ open stalls stock same need → ×0.72 |
 * | Empire standing 0–100 | up to +22% sale chance |
 * | District standing −20–100 | up to +12% / down to −8% |
 * | Known-neighbor affinity avg | up to +10% goodwill foot traffic |
 * | Décor / layout (placement mul) | half of (placementMul − 1) applied |
 * | Empty shelf / no stock match | bounce (existing stall tick) |
 * | Talk / Learn affinity grant | 1 per NPC per 60s (chat always OK) |
 * | Meaningful gift affinity | 1 per NPC per 30s (brass ≥50 or gift goods) |
 * | NPC livelihood fail | 12% per landlord-rent tick if stressed |
 * | Homeless | after 2 livelihood fails OR debt ≥ 1.5× start debt floor |
 * | Backstory hook on chat | ~10% rare flavor; never gates critical info |
 *
 * Co-op later: pass team standing/affinity aggregate into the same mul helpers.
 * Comp later: same mul per-player stall owner.
 */

// ——— M0 constants ———

export const MARKET_UNDER_SERVE_MUL = 1.28;
export const MARKET_BALANCED_SERVE_MUL = 1.0;
export const MARKET_BUSY_SERVE_MUL = 0.88;
export const MARKET_OVER_SERVE_MUL = 0.72;
/** Open stalls stocking a need category at this count = underserved (≤). */
export const MARKET_UNDER_SERVE_MAX = 1;
/** Open stalls at this count = overserved (≥). */
export const MARKET_OVER_SERVE_MIN = 4;

export const MARKET_STANDING_MAX_BONUS = 0.22;
export const MARKET_DISTRICT_STANDING_MAX_BONUS = 0.12;
export const MARKET_DISTRICT_STANDING_MAX_PENALTY = 0.08;
export const MARKET_AFFINITY_MAX_BONUS = 0.1;
/** Fraction of (placementMul − 1) that becomes extra demand. */
export const MARKET_DECOR_HALF_WEIGHT = 0.5;

/** Talk/Learn: affinity XP only this often per NPC (ms). Spam chat OK. */
export const TALK_AFFINITY_COOLDOWN_MS = 60_000;
/** Meaningful gifts (goods or brass ≥ this) share a 30s affinity cooldown. */
export const GIFT_AFFINITY_COOLDOWN_MS = 30_000;
export const GIFT_MEANINGFUL_BRASS_MIN = 50;

/** Stressed NPC rent/livelihood fail chance per landlord rent tick. */
export const NPC_LIVELIHOOD_FAIL_CHANCE = 0.12;
/** Failures before forced homeless (if not already debt-triggered). */
export const NPC_FAILS_BEFORE_HOMELESS = 2;
/** Debt ≥ this × neighbor start debt floor → homeless risk. */
export const NPC_HOMELESS_DEBT_MUL = 1.5;

/** Rare backstory callout on chat (not critical path). */
export const BACKSTORY_HOOK_CHANCE = 0.1;

// ——— Customer need categories ———

export type CustomerNeed =
  | 'mats'
  | 'parts'
  | 'frames'
  | 'inventions'
  | 'gifts'
  | 'flowers';

export const CUSTOMER_NEED_LABEL: Record<CustomerNeed, string> = {
  mats: 'raw mats',
  parts: 'parts & tools',
  frames: 'frames',
  inventions: 'inventions',
  gifts: 'gifts',
  flowers: 'flowers',
};

export function needCategoryForCommodity(id: string): CustomerNeed {
  switch (id) {
    case 'basic_frame':
    case 'fine_frame':
      return 'frames';
    case 'flower_gift':
    case 'bloom_brass':
    case 'bloom_sky':
    case 'bloom_spore':
    case 'bloom_harbor':
    case 'bloom_aether':
      return 'flowers';
    case 'brass_charm':
    case 'silk_scarf':
      return 'gifts';
    case 'wire':
    case 'gear_blank':
    case 'glass_pane':
    case 'fuel_cell':
    case 'repair_kit':
    case 'polished_wire':
    case 'speed_tool':
    case 'haul_pack':
    case 'speed_tool_fine':
    case 'haul_pack_fine':
      return 'parts';
    default:
      return 'mats';
  }
}

export interface StallStockSnap {
  shelf: Partial<Record<string, number>>;
  customShelf?: Record<string, number>;
  frameCount: number;
  open: boolean;
  owned: boolean;
}

/** True if stall has at least one unit matching the customer need. */
export function stallStocksNeed(snap: StallStockSnap, need: CustomerNeed): boolean {
  if (!snap.owned || !snap.open) return false;
  if (need === 'inventions') {
    return Object.values(snap.customShelf ?? {}).some((n) => (n ?? 0) > 0);
  }
  if (need === 'frames') return snap.frameCount > 0;
  for (const [id, n] of Object.entries(snap.shelf)) {
    if ((n ?? 0) > 0 && needCategoryForCommodity(id) === need) return true;
  }
  return false;
}

/** Dominant shelf need for attract / serve math (inventions > frames > goods). */
export function dominantStallNeed(snap: StallStockSnap): CustomerNeed | null {
  if (!snap.owned || !snap.open) return null;
  if (Object.values(snap.customShelf ?? {}).some((n) => (n ?? 0) > 0)) return 'inventions';
  if (snap.frameCount > 0) return 'frames';
  const counts: Partial<Record<CustomerNeed, number>> = {};
  for (const [id, n] of Object.entries(snap.shelf)) {
    if ((n ?? 0) <= 0) continue;
    const cat = needCategoryForCommodity(id);
    counts[cat] = (counts[cat] ?? 0) + (n ?? 0);
  }
  let best: CustomerNeed | null = null;
  let bestN = 0;
  for (const [k, v] of Object.entries(counts) as [CustomerNeed, number][]) {
    if (v > bestN) {
      bestN = v;
      best = k;
    }
  }
  return best;
}

/**
 * City-wide under/over-serve for a need category (player open stalls stocking it).
 * SP: only the player's retail network counts; ambient NPC shops are flavor only.
 */
export function categoryServeMul(openStallsStockingNeed: number): {
  mul: number;
  label: string;
  count: number;
} {
  const n = Math.max(0, openStallsStockingNeed | 0);
  if (n <= MARKET_UNDER_SERVE_MAX) {
    return { mul: MARKET_UNDER_SERVE_MUL, label: 'Underserved niche', count: n };
  }
  if (n === 2) {
    return { mul: MARKET_BALANCED_SERVE_MUL, label: 'Balanced supply', count: n };
  }
  if (n === 3) {
    return { mul: MARKET_BUSY_SERVE_MUL, label: 'Busy niche', count: n };
  }
  return { mul: MARKET_OVER_SERVE_MUL, label: 'Overserved', count: n };
}

export function reputationSalesMul(
  empireStanding: number,
  districtStanding: number,
  avgKnownAffinity: number,
): { mul: number; parts: string[] } {
  const e =
    (Math.max(0, Math.min(100, empireStanding)) / 100) * MARKET_STANDING_MAX_BONUS;
  const dRaw = Math.max(-20, Math.min(100, districtStanding));
  const dBonus =
    dRaw >= 0
      ? (dRaw / 100) * MARKET_DISTRICT_STANDING_MAX_BONUS
      : (dRaw / 20) * MARKET_DISTRICT_STANDING_MAX_PENALTY;
  const a =
    (Math.max(0, Math.min(100, avgKnownAffinity)) / 100) * MARKET_AFFINITY_MAX_BONUS;
  const mul = Math.max(0.75, Math.min(1.55, 1 + e + dBonus + a));
  const parts: string[] = [];
  if (e >= 0.02) parts.push(`Standing +${Math.round(e * 100)}%`);
  if (dBonus >= 0.02) parts.push(`District +${Math.round(dBonus * 100)}%`);
  if (dBonus <= -0.02) parts.push(`District ${Math.round(dBonus * 100)}%`);
  if (a >= 0.02) parts.push(`Goodwill +${Math.round(a * 100)}%`);
  return { mul, parts };
}

/** Convert stall placement / décor mul into demand contribution. */
export function decorSalesMul(placementMul: number): { mul: number; part: string | null } {
  const p = Math.max(0.8, Math.min(2.2, placementMul || 1));
  const extra = (p - 1) * MARKET_DECOR_HALF_WEIGHT;
  const mul = Math.max(0.85, Math.min(1.35, 1 + extra));
  if (Math.abs(extra) < 0.03) return { mul: 1, part: null };
  const pct = Math.round(extra * 100);
  return {
    mul,
    part: pct >= 0 ? `Décor +${pct}%` : `Décor ${pct}%`,
  };
}

export interface MarketDemandBundle {
  demandMul: number;
  drivers: string[];
  serveLabel: string;
  need: CustomerNeed | null;
}

/**
 * Combine district base × under/over-serve × reputation × décor into one demand mul.
 */
export function combineMarketDemand(opts: {
  districtDemandMul: number;
  openStallsStockingNeed: number;
  empireStanding: number;
  districtStanding: number;
  avgKnownAffinity: number;
  placementMul: number;
  need: CustomerNeed | null;
}): MarketDemandBundle {
  const base = Math.max(0.5, opts.districtDemandMul || 1);
  const serve = categoryServeMul(opts.openStallsStockingNeed);
  const rep = reputationSalesMul(
    opts.empireStanding,
    opts.districtStanding,
    opts.avgKnownAffinity,
  );
  const decor = decorSalesMul(opts.placementMul);
  const demandMul = Math.max(
    0.35,
    Math.min(3.2, base * serve.mul * rep.mul * decor.mul),
  );
  const drivers: string[] = [];
  if (opts.need) {
    drivers.push(`${CUSTOMER_NEED_LABEL[opts.need]} · ${serve.label}`);
  } else {
    drivers.push(serve.label);
  }
  drivers.push(...rep.parts);
  if (decor.part) drivers.push(decor.part);
  if (base !== 1) {
    drivers.push(`Plaza ×${base.toFixed(2)}`);
  }
  return {
    demandMul,
    drivers,
    serveLabel: serve.label,
    need: opts.need,
  };
}

/** HUD line: why sales rose/fell. */
export function formatSalesDrivers(drivers: string[] | undefined | null): string {
  if (!drivers || !drivers.length) return 'Traffic: baseline';
  return drivers.join(' · ');
}

// ——— Social rate limits ———

export function canGrantTalkAffinity(
  lastTalkAffinityMs: number | undefined | null,
  nowMs: number,
): boolean {
  if (lastTalkAffinityMs == null || lastTalkAffinityMs <= 0) return true;
  return nowMs - lastTalkAffinityMs >= TALK_AFFINITY_COOLDOWN_MS;
}

export function talkCooldownRemainingSec(
  lastTalkAffinityMs: number | undefined | null,
  nowMs: number,
): number {
  if (lastTalkAffinityMs == null || lastTalkAffinityMs <= 0) return 0;
  const left = TALK_AFFINITY_COOLDOWN_MS - (nowMs - lastTalkAffinityMs);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export function canGrantGiftAffinity(
  lastGiftAffinityMs: number | undefined | null,
  nowMs: number,
): boolean {
  if (lastGiftAffinityMs == null || lastGiftAffinityMs <= 0) return true;
  return nowMs - lastGiftAffinityMs >= GIFT_AFFINITY_COOLDOWN_MS;
}

export function giftCooldownRemainingSec(
  lastGiftAffinityMs: number | undefined | null,
  nowMs: number,
): number {
  if (lastGiftAffinityMs == null || lastGiftAffinityMs <= 0) return 0;
  const left = GIFT_AFFINITY_COOLDOWN_MS - (nowMs - lastGiftAffinityMs);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

// ——— Dialogue hooks (M4) ———

const JOB_BACKSTORY_HOOKS: string[] = [
  'Something in your eyes — like you built a life out of someone else’s unfinished work.',
  'You walk like someone who still answers to a name that isn’t on any ledger.',
  'I’ve seen that set of shoulders on the docks after a bad reef run. You carry it well.',
  'If you’re looking for more than brass, the city keeps quiet company for that.',
  'Funny — you remind me of an engineer who never stopped talking about a lost chassis.',
];

const HOMELESS_LINES: string[] = [
  'Deck’s gone. Still got hands. Still got pride — mostly.',
  'I’m sleeping under the wind lanes. Hire or brass, I won’t beg twice.',
  'Landlord locked the pad. If you need crew, I’m cheaper than my pride.',
];

const DRAMA_EXTRA: Record<string, string[]> = {
  behind_on_rent: [
    'Every tick the debt grows like rust. I can work it off if someone stakes me.',
    'The lease office smiles like a shark. I smile back with empty pockets.',
  ],
  lonely: [
    'Trade stories? Brass is thin company after dark.',
    'I used to know every board route. Now I know every empty bench.',
  ],
  workplace_fight: [
    'Foreman said I was expendable. Prove him wrong and hire me.',
    'Honest labor’s still honest — even when the yard isn’t.',
  ],
  broken_board: [
    'Without a deck I’m a walker in a board city. That’s a special kind of stuck.',
  ],
  expansion_envy: [
    'Your skyline keeps growing. Mine’s the same four walls — when I still had walls.',
  ],
  sick_relative: [
    'Medicine first, rent second. The city doesn’t accept that order.',
  ],
  tax_warning: [
    'City stamp on the door. Not foreclosure yet — but the ink’s still wet.',
  ],
  homeless: HOMELESS_LINES,
};

/** Extra chat lines by drama (M4 depth). */
export function extraDramaLines(drama: string): string[] {
  return DRAMA_EXTRA[drama] ?? [];
}

/**
 * Rare (~10%) backstory-adjacent flavor. Never the only source of useful info.
 * `softMatch` true when player origin / companion themes loosely fit NPC job.
 */
export function maybeBackstoryHook(opts: {
  roll: number;
  softMatch: boolean;
  homeless?: boolean;
}): string | null {
  if (opts.homeless && opts.roll < 0.35) {
    return HOMELESS_LINES[Math.floor(opts.roll * 1000) % HOMELESS_LINES.length]!;
  }
  const chance = opts.softMatch ? BACKSTORY_HOOK_CHANCE * 1.4 : BACKSTORY_HOOK_CHANCE;
  if (opts.roll >= chance) return null;
  const idx = Math.floor(opts.roll * 997) % JOB_BACKSTORY_HOOKS.length;
  return JOB_BACKSTORY_HOOKS[idx]!;
}

/** Soft match: player seed / job keywords (kept simple for SP). */
export function softBackstoryMatch(jobLabel: string, playerHint?: string): boolean {
  if (!playerHint) return false;
  const j = jobLabel.toLowerCase();
  const h = playerHint.toLowerCase();
  const keys = [
    'engineer',
    'board',
    'market',
    'yard',
    'dock',
    'courier',
    'fitter',
    'clerk',
    'invent',
    'brass',
    'crew',
  ];
  for (const k of keys) {
    if (j.includes(k) && h.includes(k)) return true;
  }
  return h.includes('lost') || h.includes('chassis') || h.includes('companion');
}
