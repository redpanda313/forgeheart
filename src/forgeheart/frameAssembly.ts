/**
 * Slot-based robot frame assembly.
 * Five labeled spaces (chassis · mechanisms · power · wiring · personality)
 * produce uniquely named frames from ingredient tokens. No blueprint gate —
 * patents come later. Better ingredients → higher sell value + stronger workers.
 */

import type { CommodityId, CustomRecipe, InventoryState } from './economy';
import { COMMODITIES, getQty, removeItem } from './economy';

export type FrameSlotId = 'chassis' | 'mechanisms' | 'power' | 'wiring' | 'personality';

/** Ingredient ref: stock commodity or a crafted invention (`custom:<recipeId>`). */
export type FramePartRef = CommodityId | `custom:${string}`;

export const FRAME_SLOT_IDS: FrameSlotId[] = [
  'chassis',
  'mechanisms',
  'power',
  'wiring',
  'personality',
];

export interface FrameSlotDef {
  id: FrameSlotId;
  label: string;
  blurb: string;
  /** CSS grid placement hint for robot silhouette */
  place: string;
}

export const FRAME_SLOT_DEFS: FrameSlotDef[] = [
  {
    id: 'power',
    label: 'Power',
    blurb: 'Fuel cell or invented supply',
    place: 'power',
  },
  {
    id: 'wiring',
    label: 'Wiring',
    blurb: 'Copper or polished wire',
    place: 'wiring',
  },
  {
    id: 'chassis',
    label: 'Chassis',
    blurb: 'Body metals & cloth',
    place: 'chassis',
  },
  {
    id: 'mechanisms',
    label: 'Mechanisms',
    blurb: 'Gears & workings',
    place: 'mechanisms',
  },
  {
    id: 'personality',
    label: 'Personality',
    blurb: 'Plaza flowers',
    place: 'personality',
  },
];

export interface AssembledFrame {
  id: string;
  name: string;
  slots: Record<FrameSlotId, FramePartRef>;
  /** 1–5ish continuous quality used for sell + robot bonuses */
  quality: number;
  sellValue: number;
  speedMul: number;
  workMul: number;
  harvestMul: number;
  payGradeBonus: number;
  programNodeBonus: number;
}

export type FrameSlotFill = Partial<Record<FrameSlotId, FramePartRef | null>>;

/** Plaza blooms — personality slot. */
export const FLOWER_IDS = [
  'bloom_brass',
  'bloom_sky',
  'bloom_spore',
  'bloom_harbor',
  'bloom_aether',
  'flower_gift',
] as const satisfies readonly CommodityId[];

export type FlowerId = (typeof FLOWER_IDS)[number];

const CHASSIS_PARTS: CommodityId[] = [
  'cloud_iron',
  'scrap_brass',
  'spore_silk',
  'sky_salt',
  'glass_pane',
];
const MECHANISM_PARTS: CommodityId[] = ['gear_blank'];
const POWER_PARTS: CommodityId[] = ['fuel_cell'];
const WIRING_PARTS: CommodityId[] = ['wire', 'polished_wire'];
const PERSONALITY_PARTS: CommodityId[] = [...FLOWER_IDS];

/** Short name tokens used to mint endless frame titles. */
const NAME_TOKENS: Partial<Record<string, string>> = {
  cloud_iron: 'Iron',
  scrap_brass: 'Brass',
  spore_silk: 'Silk',
  sky_salt: 'Salt',
  glass_pane: 'Glass',
  gear_blank: 'Gear',
  fuel_cell: 'Cell',
  wire: 'Wire',
  polished_wire: 'Gleam',
  bloom_brass: 'Petal',
  bloom_sky: 'Skybloom',
  bloom_spore: 'Sporelily',
  bloom_harbor: 'Harborose',
  bloom_aether: 'Orchid',
  flower_gift: 'Cloudbloom',
};

export function isFlowerCommodity(id: string): boolean {
  return (FLOWER_IDS as readonly string[]).includes(id);
}

export function isCustomPartRef(ref: FramePartRef): ref is `custom:${string}` {
  return typeof ref === 'string' && ref.startsWith('custom:');
}

export function customRecipeIdFromRef(ref: `custom:${string}`): string {
  return ref.slice('custom:'.length);
}

export function partRefLabel(inv: InventoryState, ref: FramePartRef): string {
  if (isCustomPartRef(ref)) {
    const recipe = inv.customRecipes.find((r) => r.id === customRecipeIdFromRef(ref));
    return recipe?.name ?? 'Invention';
  }
  return COMMODITIES[ref]?.name ?? ref;
}

export function partRefToken(inv: InventoryState, ref: FramePartRef): string {
  if (isCustomPartRef(ref)) {
    const recipe = inv.customRecipes.find((r) => r.id === customRecipeIdFromRef(ref));
    if (!recipe) return 'Spark';
    const words = recipe.name.split(/\s+/).filter(Boolean);
    return words[words.length - 1] ?? words[0] ?? 'Spark';
  }
  return NAME_TOKENS[ref] ?? (COMMODITIES[ref]?.name.split(/\s+/).pop() ?? 'Part');
}

export function slotAccepts(inv: InventoryState, slot: FrameSlotId, ref: FramePartRef): boolean {
  if (isCustomPartRef(ref)) {
    const recipe = inv.customRecipes.find((r) => r.id === customRecipeIdFromRef(ref));
    if (!recipe) return false;
    const stock = inv.customStock[recipe.id] ?? 0;
    if (stock < 1) return false;
    return inventionFitsSlot(recipe, slot);
  }
  if (getQty(inv, ref) < 1) return false;
  if (slot === 'chassis') return CHASSIS_PARTS.includes(ref);
  if (slot === 'mechanisms') return MECHANISM_PARTS.includes(ref);
  if (slot === 'power') return POWER_PARTS.includes(ref);
  if (slot === 'wiring') return WIRING_PARTS.includes(ref);
  if (slot === 'personality') return PERSONALITY_PARTS.includes(ref);
  return false;
}

/**
 * Which frame slots an invention can fill — driven by the materials it was
 * prototyped from (gear → mechanisms, wire → wiring, etc.).
 */
export function inventionFrameSlots(recipe: {
  inputs: { id: CommodityId; n: number }[];
}): FrameSlotId[] {
  const slots = new Set<FrameSlotId>();
  for (const inp of recipe.inputs) {
    const id = inp.id;
    if (id === 'gear_blank') slots.add('mechanisms');
    if (id === 'wire' || id === 'polished_wire') slots.add('wiring');
    if (id === 'fuel_cell') slots.add('power');
    if (
      id === 'cloud_iron' ||
      id === 'scrap_brass' ||
      id === 'spore_silk' ||
      id === 'sky_salt' ||
      id === 'glass_pane'
    ) {
      slots.add('chassis');
    }
    if (isFlowerCommodity(id)) slots.add('personality');
  }
  // Odd / pure-mat combos still usable as body or experimental power
  if (slots.size === 0) {
    slots.add('chassis');
    slots.add('power');
  }
  return FRAME_SLOT_IDS.filter((s) => slots.has(s));
}

export function inventionFitsSlot(
  recipe: { inputs: { id: CommodityId; n: number }[] },
  slot: FrameSlotId,
): boolean {
  return inventionFrameSlots(recipe).includes(slot);
}

export function listPartsForSlot(inv: InventoryState, slot: FrameSlotId): FramePartRef[] {
  const out: FramePartRef[] = [];
  const pool =
    slot === 'chassis'
      ? CHASSIS_PARTS
      : slot === 'mechanisms'
        ? MECHANISM_PARTS
        : slot === 'power'
          ? POWER_PARTS
          : slot === 'wiring'
            ? WIRING_PARTS
            : PERSONALITY_PARTS;
  for (const id of pool) {
    if (getQty(inv, id) > 0) out.push(id);
  }
  // Inventions appear only in slots their ingredients qualify for
  for (const recipe of inv.customRecipes) {
    if ((inv.customStock[recipe.id] ?? 0) < 1) continue;
    if (inventionFitsSlot(recipe, slot)) out.push(`custom:${recipe.id}`);
  }
  return out;
}

function partQuality(inv: InventoryState, ref: FramePartRef): number {
  if (isCustomPartRef(ref)) {
    const recipe = inv.customRecipes.find((r) => r.id === customRecipeIdFromRef(ref));
    return 1.35 + (recipe?.quality ?? 1) * 0.35;
  }
  switch (ref) {
    case 'polished_wire':
      return 1.55;
    case 'spore_silk':
      return 1.25;
    case 'glass_pane':
      return 1.2;
    case 'bloom_aether':
      return 1.7;
    case 'bloom_harbor':
      return 1.45;
    case 'bloom_sky':
      return 1.4;
    case 'bloom_spore':
      return 1.35;
    case 'bloom_brass':
      return 1.3;
    case 'flower_gift':
      return 1.15;
    case 'fuel_cell':
      return 1.1;
    case 'gear_blank':
      return 1.05;
    case 'cloud_iron':
      return 1.0;
    case 'scrap_brass':
      return 0.95;
    case 'wire':
      return 1.0;
    case 'sky_salt':
      return 0.9;
    default:
      return 1;
  }
}

function partBaseValue(inv: InventoryState, ref: FramePartRef): number {
  if (isCustomPartRef(ref)) {
    const recipe = inv.customRecipes.find((r) => r.id === customRecipeIdFromRef(ref));
    return Math.max(20, Math.round((recipe?.sellValue ?? 40) * 0.55));
  }
  return COMMODITIES[ref]?.baseSell ?? 8;
}

/** Endless-ish names from ingredient tokens. */
export function nameFrameFromSlots(
  inv: InventoryState,
  slots: Record<FrameSlotId, FramePartRef>,
): string {
  const chassis = partRefToken(inv, slots.chassis);
  const mech = partRefToken(inv, slots.mechanisms);
  const power = partRefToken(inv, slots.power);
  const wire = partRefToken(inv, slots.wiring);
  const persona = partRefToken(inv, slots.personality);
  // Personality leads when rare; otherwise chassis-mech compound
  const head = persona;
  const body = chassis === mech ? chassis : `${chassis}${mech}`;
  const heart = power === wire ? power : `${power}-${wire}`;
  return `${head} ${body} ${heart} Frame`;
}

export function evaluateFrameSlots(
  inv: InventoryState,
  slots: Record<FrameSlotId, FramePartRef>,
): Omit<AssembledFrame, 'id' | 'slots'> {
  const qualities = FRAME_SLOT_IDS.map((s) => partQuality(inv, slots[s]));
  const avg = qualities.reduce((a, b) => a + b, 0) / qualities.length;
  const quality = Math.round(avg * 100) / 100;
  const materialValue = FRAME_SLOT_IDS.reduce((sum, s) => sum + partBaseValue(inv, slots[s]), 0);
  const sellValue = Math.max(55, Math.round(materialValue * 1.15 + quality * 38));
  const speedMul = 0.72 + quality * 0.28;
  const workMul = Math.max(0.45, 1.65 - quality * 0.35); // lower = faster work timers
  const harvestMul = 0.7 + quality * 0.35;
  const payGradeBonus = quality >= 1.55 ? 2 : quality >= 1.3 ? 1 : 0;
  const programNodeBonus = quality >= 1.55 ? 3 : quality >= 1.25 ? 1 : 0;
  return {
    name: nameFrameFromSlots(inv, slots),
    quality,
    sellValue,
    speedMul,
    workMul,
    harvestMul,
    payGradeBonus,
    programNodeBonus,
  };
}

export function canAssembleFrame(inv: InventoryState, fill: FrameSlotFill): boolean {
  if (!inv.parcelLeased) return false;
  for (const slot of FRAME_SLOT_IDS) {
    const ref = fill[slot];
    if (!ref) return false;
    if (!slotAccepts(inv, slot, ref)) return false;
  }
  // Ensure unique inventory consumption when same commodity used twice
  const counts = new Map<string, number>();
  for (const slot of FRAME_SLOT_IDS) {
    const ref = fill[slot]!;
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  for (const [ref, n] of counts) {
    if (isCustomPartRef(ref as FramePartRef)) {
      const rid = customRecipeIdFromRef(ref as `custom:${string}`);
      if ((inv.customStock[rid] ?? 0) < n) return false;
    } else if (getQty(inv, ref as CommodityId) < n) {
      return false;
    }
  }
  return true;
}

function consumePart(inv: InventoryState, ref: FramePartRef) {
  if (isCustomPartRef(ref)) {
    const rid = customRecipeIdFromRef(ref);
    inv.customStock[rid] = (inv.customStock[rid] ?? 0) - 1;
    if (inv.customStock[rid]! <= 0) delete inv.customStock[rid];
    return;
  }
  removeItem(inv, ref, 1);
}

export function assembleFrame(
  inv: InventoryState,
  fill: FrameSlotFill,
): { ok: boolean; msg: string; frame?: AssembledFrame } {
  if (!inv.parcelLeased) {
    return { ok: false, msg: 'Lease a bay first — assembly needs a workbench.' };
  }
  if (!canAssembleFrame(inv, fill)) {
    return { ok: false, msg: 'Fill all five spaces with valid parts you own.' };
  }
  const slots = {
    chassis: fill.chassis!,
    mechanisms: fill.mechanisms!,
    power: fill.power!,
    wiring: fill.wiring!,
    personality: fill.personality!,
  };
  for (const slot of FRAME_SLOT_IDS) consumePart(inv, slots[slot]);
  const stats = evaluateFrameSlots(inv, slots);
  const frame: AssembledFrame = {
    id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    slots,
    ...stats,
  };
  if (!inv.assembledFrames) inv.assembledFrames = [];
  inv.assembledFrames.push(frame);
  return { ok: true, msg: `Assembled ${frame.name} · sell ~${frame.sellValue}b · Q${frame.quality.toFixed(2)}`, frame };
}

/** Worker-program helper: assemble a serviceable frame from whatever is available. */
export function tryAutoAssembleFrame(
  inv: InventoryState,
  preferFine: boolean,
): { ok: boolean; msg: string; frame?: AssembledFrame } {
  const pick = (slot: FrameSlotId, prefer: FramePartRef[]): FramePartRef | null => {
    for (const ref of prefer) {
      if (slotAccepts(inv, slot, ref)) return ref;
    }
    const any = listPartsForSlot(inv, slot);
    return any[0] ?? null;
  };
  const fill: FrameSlotFill = {
    chassis: pick('chassis', preferFine ? ['spore_silk', 'cloud_iron', 'scrap_brass'] : ['cloud_iron', 'scrap_brass']),
    mechanisms: pick('mechanisms', ['gear_blank']),
    power: pick('power', ['fuel_cell']),
    wiring: pick('wiring', preferFine ? ['polished_wire', 'wire'] : ['wire', 'polished_wire']),
    personality: pick('personality', [
      'bloom_aether',
      'bloom_harbor',
      'bloom_sky',
      'bloom_spore',
      'bloom_brass',
      'flower_gift',
    ]),
  };
  return assembleFrame(inv, fill);
}

export function legacyBasicFrameSlots(): Record<FrameSlotId, FramePartRef> {
  return {
    chassis: 'cloud_iron',
    mechanisms: 'gear_blank',
    power: 'fuel_cell',
    wiring: 'wire',
    personality: 'flower_gift',
  };
}

export function legacyFineFrameSlots(): Record<FrameSlotId, FramePartRef> {
  return {
    chassis: 'spore_silk',
    mechanisms: 'gear_blank',
    power: 'fuel_cell',
    wiring: 'polished_wire',
    personality: 'bloom_sky',
  };
}

export function makeLegacyAssembledFrame(
  inv: InventoryState,
  kind: 'basic' | 'fine',
): AssembledFrame {
  const slots = kind === 'fine' ? legacyFineFrameSlots() : legacyBasicFrameSlots();
  const stats = evaluateFrameSlots(inv, slots);
  return {
    id: `frame_legacy_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    slots,
    ...stats,
    name: kind === 'fine' ? stats.name.replace(/Frame$/, 'Masterwork Frame') : stats.name,
  };
}

/** Convert old basic_frame / fine_frame counts into assembledFrames. */
export function convertLegacyFrames(inv: InventoryState) {
  if (!inv.assembledFrames) inv.assembledFrames = [];
  const basic = getQty(inv, 'basic_frame' as CommodityId);
  const fine = getQty(inv, 'fine_frame' as CommodityId);
  for (let i = 0; i < basic; i++) {
    inv.assembledFrames.push(makeLegacyAssembledFrame(inv, 'basic'));
    removeItem(inv, 'basic_frame' as CommodityId, 1);
  }
  for (let i = 0; i < fine; i++) {
    inv.assembledFrames.push(makeLegacyAssembledFrame(inv, 'fine'));
    removeItem(inv, 'fine_frame' as CommodityId, 1);
  }
}

/** Ensure invent recipes used as power cores are listed (no-op helper for typing). */
export function inventionAsPowerRef(recipe: CustomRecipe): FramePartRef {
  return `custom:${recipe.id}`;
}
