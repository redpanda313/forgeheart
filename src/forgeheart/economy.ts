/**
 * Sky City economy — Phase 0–3 empire scale.
 * Inventory, craft, hire, unlimited bay expansion, multi-plaza stalls,
 * invention → craft → retail market cycle, worker pay grades for long programs.
 * Local-only; server later.
 */

import type { AssembledFrame } from './frameAssembly';
import {
  tryAutoAssembleFrame,
  convertLegacyFrames,
  makeLegacyAssembledFrame,
  inventionFrameSlots,
} from './frameAssembly';

export type CurrencyId = 'brass' | 'aether';

export type CommodityId =
  | 'cloud_iron'
  | 'scrap_brass'
  | 'spore_silk'
  | 'sky_salt'
  | 'wire'
  | 'glass_pane'
  | 'fuel_cell'
  | 'gear_blank'
  | 'basic_frame'
  | 'repair_kit'
  | 'speed_tool'
  | 'haul_pack'
  | 'polished_wire'
  | 'fine_frame'
  | 'elias_medallion'
  | 'flower_gift'
  | 'brass_charm'
  | 'silk_scarf'
  | 'bloom_brass'
  | 'bloom_sky'
  | 'bloom_spore'
  | 'bloom_harbor'
  | 'bloom_aether';

export interface CommodityDef {
  id: CommodityId;
  name: string;
  baseBuy: number;
  baseSell: number;
  stack: number;
  harvestable?: boolean;
}

export const COMMODITIES: Record<CommodityId, CommodityDef> = {
  cloud_iron: {
    id: 'cloud_iron',
    name: 'Cloud Iron',
    baseBuy: 4,
    baseSell: 8,
    stack: 99,
    harvestable: true,
  },
  scrap_brass: {
    id: 'scrap_brass',
    name: 'Scrap Brass',
    baseBuy: 3,
    baseSell: 6,
    stack: 99,
    harvestable: true,
  },
  spore_silk: {
    id: 'spore_silk',
    name: 'Spore Silk',
    baseBuy: 6,
    baseSell: 12,
    stack: 99,
    harvestable: true,
  },
  sky_salt: {
    id: 'sky_salt',
    name: 'Sky Salt',
    baseBuy: 2,
    baseSell: 5,
    stack: 99,
    harvestable: true,
  },
  wire: { id: 'wire', name: 'Copper Wire', baseBuy: 5, baseSell: 11, stack: 99 },
  glass_pane: { id: 'glass_pane', name: 'Glass Pane', baseBuy: 7, baseSell: 14, stack: 50 },
  fuel_cell: { id: 'fuel_cell', name: 'Fuel Cell', baseBuy: 10, baseSell: 20, stack: 30 },
  gear_blank: { id: 'gear_blank', name: 'Gear Blank', baseBuy: 8, baseSell: 16, stack: 50 },
  basic_frame: {
    id: 'basic_frame',
    name: 'Basic Robot Frame',
    baseBuy: 45,
    baseSell: 90,
    stack: 10,
  },
  repair_kit: {
    id: 'repair_kit',
    name: 'Repair Kit',
    baseBuy: 6,
    baseSell: 14,
    stack: 30,
  },
  speed_tool: {
    id: 'speed_tool',
    name: 'Rivet Spanner',
    baseBuy: 12,
    baseSell: 28,
    stack: 5,
  },
  haul_pack: {
    id: 'haul_pack',
    name: 'Haul Pack',
    baseBuy: 10,
    baseSell: 24,
    stack: 5,
  },
  elias_medallion: {
    id: 'elias_medallion',
    name: "Elias's Medallion",
    baseBuy: 0,
    baseSell: 0,
    stack: 1,
  },
  flower_gift: {
    id: 'flower_gift',
    name: 'Cloud Blooms',
    baseBuy: 18,
    baseSell: 8,
    stack: 20,
  },
  brass_charm: {
    id: 'brass_charm',
    name: 'Brass Charm',
    baseBuy: 35,
    baseSell: 12,
    stack: 10,
  },
  silk_scarf: {
    id: 'silk_scarf',
    name: 'Spore-Silk Scarf',
    baseBuy: 55,
    baseSell: 22,
    stack: 10,
  },
  polished_wire: {
    id: 'polished_wire',
    name: 'Polished Wire',
    baseBuy: 11,
    baseSell: 22,
    stack: 50,
  },
  fine_frame: {
    id: 'fine_frame',
    name: 'Masterwork Frame',
    baseBuy: 72,
    baseSell: 130,
    stack: 8,
  },
  bloom_brass: {
    id: 'bloom_brass',
    name: 'Brass Petals',
    baseBuy: 10,
    baseSell: 6,
    stack: 40,
    harvestable: true,
  },
  bloom_sky: {
    id: 'bloom_sky',
    name: 'Skyblooms',
    baseBuy: 12,
    baseSell: 7,
    stack: 40,
    harvestable: true,
  },
  bloom_spore: {
    id: 'bloom_spore',
    name: 'Spore Lilies',
    baseBuy: 14,
    baseSell: 8,
    stack: 40,
    harvestable: true,
  },
  bloom_harbor: {
    id: 'bloom_harbor',
    name: 'Harbor Roses',
    baseBuy: 16,
    baseSell: 9,
    stack: 40,
    harvestable: true,
  },
  bloom_aether: {
    id: 'bloom_aether',
    name: 'Aether Orchids',
    baseBuy: 22,
    baseSell: 12,
    stack: 30,
    harvestable: true,
  },
};

export const COMMODITY_LIST = Object.values(COMMODITIES);

// ——— Jobs & workers ———

export type JobId =
  | 'idle'
  | 'harvest'
  | 'craft_wire'
  | 'craft_frame'
  | 'sell_frame'
  | 'repair'
  | 'program';

/**
 * Nodes in light visual programs (worker automation graph).
 * No skill unlocks — bay lease required for craft; invent desk L3 only for craft_custom.
 */
export type ProgramNodeKind =
  | 'harvest'
  | 'return_bay'
  | 'repair'
  | 'sell_frame'
  // Workbench (all standard recipes)
  | 'craft_wire'
  | 'craft_gear'
  | 'craft_kit'
  | 'craft_frame'
  | 'craft_speed_tool'
  | 'craft_haul_pack'
  | 'craft_polished_wire'
  | 'craft_fine_frame'
  | 'craft_custom'
  // Stall price policies
  | 'price_deal_shelf'
  | 'price_fair_shelf'
  | 'price_premium_shelf'
  // Market sell 1× (walk to vendor that buys it)
  | 'sell_cloud_iron'
  | 'sell_scrap_brass'
  | 'sell_spore_silk'
  | 'sell_sky_salt'
  | 'sell_wire'
  | 'sell_gear_blank'
  | 'sell_repair_kit'
  | 'sell_fuel_cell'
  | 'sell_glass'
  | 'sell_invention'
  // Market buy 1× (walk to vendor that stocks it)
  | 'buy_cloud_iron'
  | 'buy_scrap_brass'
  | 'buy_spore_silk'
  | 'buy_sky_salt'
  | 'buy_wire'
  | 'buy_gear_blank'
  | 'buy_repair_kit'
  | 'buy_fuel_cell'
  | 'buy_glass'
  // Bulk market (sell entire stack / buy 5)
  | 'sell_all_cloud_iron'
  | 'sell_all_scrap_brass'
  | 'sell_all_spore_silk'
  | 'sell_all_sky_salt'
  | 'sell_all_wire'
  | 'sell_all_harvest'
  | 'buy_5_fuel_cell'
  | 'buy_5_scrap_brass'
  | 'buy_5_wire'
  | 'buy_5_cloud_iron'
  // Stock player stall from inventory
  | 'stock_stall_frame'
  | 'stock_stall_wire'
  | 'stock_stall_scrap';

export type ProgramNodeCategory =
  | 'haul'
  | 'craft'
  | 'market_sell'
  | 'market_buy'
  | 'service'
  | 'stall';

export const PROGRAM_NODE_DEFS: {
  id: ProgramNodeKind;
  name: string;
  blurb: string;
  category: ProgramNodeCategory;
}[] = [
  // Haul / bay
  { id: 'harvest', name: 'Harvest Reef', blurb: 'Reef · extract mats', category: 'haul' },
  { id: 'return_bay', name: 'Return Bay', blurb: 'Walk home', category: 'haul' },
  // Craft — all workbench recipes (no unlock; needs leased bay)
  { id: 'craft_wire', name: 'Craft Wire', blurb: '2 scrap → wire', category: 'craft' },
  { id: 'craft_gear', name: 'Craft Gear Blank', blurb: 'iron + scrap → gear', category: 'craft' },
  { id: 'craft_kit', name: 'Craft Repair Kit', blurb: 'wire + scrap → kit', category: 'craft' },
  { id: 'craft_frame', name: 'Assemble Robot Frame', blurb: 'auto-fill five slots from stock', category: 'craft' },
  { id: 'craft_speed_tool', name: 'Craft Rivet Spanner', blurb: 'gear · wire · iron → tool', category: 'craft' },
  { id: 'craft_haul_pack', name: 'Craft Haul Pack', blurb: 'silk + scrap → pack', category: 'craft' },
  {
    id: 'craft_polished_wire',
    name: 'Craft Polished Wire',
    blurb: 'Fine craft · Q2 wire · premium stall',
    category: 'craft',
  },
  {
    id: 'craft_fine_frame',
    name: 'Assemble Fine Frame',
    blurb: 'Auto-fill slots preferring polished / silk parts',
    category: 'craft',
  },
  {
    id: 'craft_custom',
    name: 'Craft Invention',
    blurb: 'First invention in book (needs L3 invent)',
    category: 'craft',
  },
  // Market sell
  { id: 'sell_cloud_iron', name: 'Sell Cloud Iron', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_scrap_brass', name: 'Sell Scrap Brass', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_spore_silk', name: 'Sell Spore Silk', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_sky_salt', name: 'Sell Sky Salt', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_wire', name: 'Sell Wire', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_gear_blank', name: 'Sell Gear Blank', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_repair_kit', name: 'Sell Repair Kit', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_fuel_cell', name: 'Sell Fuel Cell', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_glass', name: 'Sell Glass Pane', blurb: 'Market · 1×', category: 'market_sell' },
  { id: 'sell_invention', name: 'Sell Invention', blurb: 'Mira rate · 1× custom', category: 'market_sell' },
  { id: 'sell_frame', name: 'Sell Frame (Broker)', blurb: 'Frame Broker · 75b', category: 'market_sell' },
  // Market buy
  { id: 'buy_cloud_iron', name: 'Buy Cloud Iron', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_scrap_brass', name: 'Buy Scrap Brass', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_spore_silk', name: 'Buy Spore Silk', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_sky_salt', name: 'Buy Sky Salt', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_wire', name: 'Buy Wire', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_gear_blank', name: 'Buy Gear Blank', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_repair_kit', name: 'Buy Repair Kit', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_fuel_cell', name: 'Buy Fuel Cell', blurb: 'Market · 1×', category: 'market_buy' },
  { id: 'buy_glass', name: 'Buy Glass Pane', blurb: 'Market · 1×', category: 'market_buy' },
  // Service
  { id: 'repair', name: 'Field Repair', blurb: 'Husk · spend kit · +brass', category: 'service' },
  // Bulk sell / buy
  {
    id: 'sell_all_cloud_iron',
    name: 'Sell ALL Cloud Iron',
    blurb: 'Dump full stack at market',
    category: 'market_sell',
  },
  {
    id: 'sell_all_scrap_brass',
    name: 'Sell ALL Scrap',
    blurb: 'Dump full stack at market',
    category: 'market_sell',
  },
  {
    id: 'sell_all_spore_silk',
    name: 'Sell ALL Silk',
    blurb: 'Dump full stack at market',
    category: 'market_sell',
  },
  {
    id: 'sell_all_sky_salt',
    name: 'Sell ALL Salt',
    blurb: 'Dump full stack at market',
    category: 'market_sell',
  },
  {
    id: 'sell_all_wire',
    name: 'Sell ALL Wire',
    blurb: 'Dump full stack at market',
    category: 'market_sell',
  },
  {
    id: 'sell_all_harvest',
    name: 'Sell ALL Harvest Mats',
    blurb: 'Iron · scrap · silk · salt stacks',
    category: 'market_sell',
  },
  {
    id: 'buy_5_fuel_cell',
    name: 'Buy 5× Fuel Cell',
    blurb: 'Bulk buy for frames',
    category: 'market_buy',
  },
  {
    id: 'buy_5_scrap_brass',
    name: 'Buy 5× Scrap',
    blurb: 'Bulk buy',
    category: 'market_buy',
  },
  {
    id: 'buy_5_wire',
    name: 'Buy 5× Wire',
    blurb: 'Bulk buy',
    category: 'market_buy',
  },
  {
    id: 'buy_5_cloud_iron',
    name: 'Buy 5× Cloud Iron',
    blurb: 'Bulk buy',
    category: 'market_buy',
  },
  // Stock player retail stall (walk to stall, move goods into frontage)
  {
    id: 'stock_stall_frame',
    name: 'Stock Stall · Frame',
    blurb: 'Put 1 frame on your stall shelf',
    category: 'stall',
  },
  {
    id: 'stock_stall_wire',
    name: 'Stock Stall · Wire',
    blurb: 'Put 3 wire on stall shelf',
    category: 'stall',
  },
  {
    id: 'stock_stall_scrap',
    name: 'Stock Stall · Scrap',
    blurb: 'Put 5 scrap on stall shelf',
    category: 'stall',
  },
  {
    id: 'price_deal_shelf',
    name: 'Price Shelf · Deals (−15%)',
    blurb: 'Stall · undercut fair for volume',
    category: 'stall',
  },
  {
    id: 'price_fair_shelf',
    name: 'Price Shelf · Fair',
    blurb: 'Stall · match street fair',
    category: 'stall',
  },
  {
    id: 'price_premium_shelf',
    name: 'Price Shelf · Premium (+18%)',
    blurb: 'Stall · premium asks',
    category: 'stall',
  },
];

/** Map craft program nodes → recipe ids (frame assembly handled separately) */
export const PROGRAM_CRAFT_RECIPE: Partial<Record<ProgramNodeKind, string>> = {
  craft_wire: 'wire_from_scrap',
  craft_gear: 'gear_blank',
  craft_kit: 'repair_kit',
  craft_speed_tool: 'speed_tool',
  craft_haul_pack: 'haul_pack',
  craft_polished_wire: 'polished_wire',
};

/** Commodity for sell_* / buy_* program nodes */
export const PROGRAM_TRADE_ITEM: Partial<Record<ProgramNodeKind, CommodityId>> = {
  sell_cloud_iron: 'cloud_iron',
  sell_scrap_brass: 'scrap_brass',
  sell_spore_silk: 'spore_silk',
  sell_sky_salt: 'sky_salt',
  sell_wire: 'wire',
  sell_gear_blank: 'gear_blank',
  sell_repair_kit: 'repair_kit',
  sell_fuel_cell: 'fuel_cell',
  sell_glass: 'glass_pane',
  buy_cloud_iron: 'cloud_iron',
  buy_scrap_brass: 'scrap_brass',
  buy_spore_silk: 'spore_silk',
  buy_sky_salt: 'sky_salt',
  buy_wire: 'wire',
  buy_gear_blank: 'gear_blank',
  buy_repair_kit: 'repair_kit',
  buy_fuel_cell: 'fuel_cell',
  buy_glass: 'glass_pane',
  sell_all_cloud_iron: 'cloud_iron',
  sell_all_scrap_brass: 'scrap_brass',
  sell_all_spore_silk: 'spore_silk',
  sell_all_sky_salt: 'sky_salt',
  sell_all_wire: 'wire',
  buy_5_fuel_cell: 'fuel_cell',
  buy_5_scrap_brass: 'scrap_brass',
  buy_5_wire: 'wire',
  buy_5_cloud_iron: 'cloud_iron',
};

/** Bulk sell-all commodity nodes */
export const PROGRAM_SELL_ALL: ProgramNodeKind[] = [
  'sell_all_cloud_iron',
  'sell_all_scrap_brass',
  'sell_all_spore_silk',
  'sell_all_sky_salt',
  'sell_all_wire',
];

/** Bulk buy qty 5 */
export const PROGRAM_BUY_5: Partial<Record<ProgramNodeKind, CommodityId>> = {
  buy_5_fuel_cell: 'fuel_cell',
  buy_5_scrap_brass: 'scrap_brass',
  buy_5_wire: 'wire',
  buy_5_cloud_iron: 'cloud_iron',
};

export interface WorkerProgram {
  id: string;
  name: string;
  /** Ordered graph (linear chain v1 — branches later) */
  nodes: ProgramNodeKind[];
}

export const JOB_DEFS: {
  id: JobId;
  name: string;
  blurb: string;
  /** Waypoint route keys on hub */
  route: string[];
}[] = [
  { id: 'idle', name: 'Idle', blurb: 'Stand by at the bay.', route: ['bay'] },
  {
    id: 'harvest',
    name: 'Reef Haul',
    blurb: 'Walk to the reef, extract scrap, return to bay.',
    route: ['bay', 'reef', 'bay'],
  },
  {
    id: 'craft_wire',
    name: 'Draw Wire',
    blurb: 'Work the bay bench — scrap → wire.',
    route: ['bay', 'craft', 'bay'],
  },
  {
    id: 'craft_frame',
    name: 'Build Frames',
    blurb: 'Assemble Basic Robot Frames at the bench.',
    route: ['bay', 'craft', 'bay'],
  },
  {
    id: 'sell_frame',
    name: 'Broker Run',
    blurb: 'Carry frames to the Frame Broker and sell.',
    route: ['bay', 'broker', 'bay'],
  },
  {
    id: 'repair',
    name: 'Field Repair',
    blurb: 'Take a kit to the broken husk, earn brass.',
    route: ['bay', 'repair', 'bay'],
  },
  {
    id: 'program',
    name: 'Run Program',
    blurb: 'Execute assigned visual program graph.',
    route: ['bay'],
  },
];

export interface WorkerState {
  id: string;
  name: string;
  job: JobId;
  /** When job === program */
  programId: string | null;
  hasBoard: boolean;
  hasSpeedTool: boolean;
  hasHaulPack: boolean;
  /** Completed work nodes (attention / tool wear) */
  jobsDone: number;
  /**
   * Pay grade (0+). Longer visual programs require higher grade.
   * Raise with brass so crew will run big task lists.
   */
  payGrade: number;
  /**
   * Harvest biome site id (district key) or null = mixed / any reef.
   * Used for job=harvest and program nodes that harvest.
   */
  harvestSiteId: string | null;
  /** Human laborer vs owned robot chassis */
  kind?: 'human' | 'robot';
  /** Elias spirit host — human-parity stats + map marker */
  hasMedallion?: boolean;
  /** Assembled frame identity when this robot was powered from a chassis */
  frameId?: string | null;
  frameName?: string | null;
  frameQuality?: number;
  /** Multipliers from frame (robots only) */
  frameSpeedMul?: number;
  frameWorkMul?: number;
  frameHarvestMul?: number;
  frameProgramBonus?: number;
}

/** Player-placed commercial / cosmetic props from purchase→Game Maker */
export interface PlacementRecord {
  id: string;
  kind: 'stall' | 'bay_wing' | 'storage' | 'shop' | 'home_decor';
  districtId: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  variant: number;
  decorCount: number;
  /** Brass paid at confirm */
  paid: number;
  /** Income multipliers (shops only) */
  trafficMul: number;
  attractMul: number;
  capacityMul: number;
}

export type RelationshipStage = 0 | 1 | 2 | 3 | 4;

export interface RomanceState {
  npcId: string;
  stage: RelationshipStage;
  affinity: number;
  giftsGiven: number;
}

export interface PlayerBoardState {
  owned: boolean;
  thruster: boolean;
  rails: boolean;
  deck: boolean;
}

/** Player-invented recipe (personal book) */
export interface CustomRecipe {
  id: string;
  name: string;
  inputs: { id: CommodityId; n: number }[];
  /** Sell price when sold as custom stock */
  sellValue: number;
  /** 1–3 quality; premium plazas pay more for higher quality */
  quality?: number;
}

/** Stall structure tier — rising build cost past the basic bench */
export type StallTier = 'bench' | 'shade' | 'shop' | 'large';

/** Factory shell form (storage / bay wings — not shop cosmetics) */
export type FactoryForm = 'horizontal' | 'tall' | 'boiler_yard';

/** Placed improvement on a site (local to plot center) */
export interface SiteProp {
  id: string;
  lx: number;
  lz: number;
  yaw: number;
}

/** Saved stall plot + structure + placed props (Game Maker site builder) */
export interface StallLayout {
  plotX: number;
  plotZ: number;
  yaw: number;
  tier: StallTier;
  /** Color palette index 0..n */
  color: number;
  /** Placed decorations / improvements */
  props: SiteProp[];
  built: boolean;
  /** @deprecated legacy single décor ladder — migrated to props */
  decor?: number;
}

/** Factory / bonded-storage site layout */
export interface FactoryLayout {
  plotX: number;
  plotZ: number;
  yaw: number;
  form: FactoryForm;
  props: SiteProp[];
  built: boolean;
}

/** Player plaza stall — auto-sells stocked shelf goods at player-set prices */
export interface StallState {
  owned: boolean;
  open: boolean;
  /** Goods sitting on the stall shelf (sold over time) */
  shelf: Partial<Record<CommodityId, number>>;
  /** Invented goods on shelf by recipe id */
  customShelf: Record<string, number>;
  /** Assembled robot frames on display (unique named chassis) */
  frameShelf: AssembledFrame[];
  /** Player ask price per commodity (brass). Missing → fair price default. */
  asks: Partial<Record<CommodityId, number>>;
  /** Player ask price per invention recipe id. Missing → fair invention price. */
  customAsks: Record<string, number>;
  /** Auto-pull from inventory each tick if shelf empty (optional modes) */
  autoFrames: boolean;
  autoHarvest: boolean;
  autoWire: boolean;
  /** Auto-list invented goods when in stock */
  autoInvent?: boolean;
  sales: number;
  earned: number;
  /** Last demand label for HUD (Hot / Steady / …) */
  lastDemand?: string;
  /** Active customer haggle (player must accept/refuse) */
  pendingHaggle: null | {
    id: CommodityId;
    offer: number;
    ask: number;
    fair: number;
    ttl: number;
  };
  /** Plot + stall build from wizard */
  layout?: StallLayout | null;
  /** Brass already paid toward layout (redesign charges delta only) */
  layoutPaid?: number;
}

/** Cost tables mirrored in stallBuild / factoryBuild (kept here for quotes) */
const STALL_TIER_EXTRA: Record<StallTier, number> = {
  bench: 0,
  shade: 75,
  shop: 200,
  large: 450,
};
const SHOP_PROP_COST: Record<string, number> = {
  crates: 40,
  banners: 40,
  lanterns: 45,
  planters: 35,
  signboard: 50,
  display_case: 70,
  flower_cart: 55,
  extra_awning: 80,
};
const FACTORY_FORM_EXTRA: Record<FactoryForm, number> = {
  horizontal: 0,
  tall: 110,
  boiler_yard: 160,
};
const FACTORY_PROP_COST: Record<string, number> = {
  pipe_run: 45,
  gear_stack: 55,
  cylinder_boiler: 120,
  smokestack: 90,
  valve_rack: 40,
  conduit: 50,
  crane_arm: 110,
};

function sumPropCosts(props: SiteProp[] | undefined, table: Record<string, number>): number {
  let n = 0;
  for (const p of props ?? []) n += table[p.id] ?? 40;
  return n;
}

/** Retail districts in the mega-city (multi-plaza empire) */
export interface CityDistrictDef {
  id: string;
  name: string;
  /** World XZ center */
  x: number;
  z: number;
  /** Plaza deck size */
  size: number;
  /** Lease cost for a stall here */
  stallCost: number;
  /** Customer traffic / price mul (1 = baseline) */
  demandMul: number;
  /** Inventions sell especially well */
  inventBonus: number;
  /** Theme color for labels / pads */
  color: number;
  /** District role for layout */
  role: 'home' | 'market' | 'industrial' | 'harbor' | 'premium' | 'mixed';
  /** Board theme-park circuit on this plaza */
  themePark?: boolean;
}

/**
 * Mega-city map (~5× linear / ~25× area vs prior ±250 city).
 * Visit many plazas to lease shops and run a real retail network.
 */
export const CITY_DISTRICTS: CityDistrictDef[] = [
  {
    id: 'residential',
    name: 'Residential Ring',
    x: 0,
    z: 0,
    size: 120,
    stallCost: 90,
    demandMul: 0.95,
    inventBonus: 0.9,
    color: 0x5a5348,
    role: 'home',
  },
  {
    id: 'grand_market',
    name: 'Grand Market',
    x: 400,
    z: -140,
    size: 152,
    stallCost: 280,
    demandMul: 1.4,
    inventBonus: 1.25,
    color: 0x6a5a48,
    role: 'market',
    themePark: true,
  },
  {
    id: 'industrial',
    name: 'Industrial Slips',
    x: -350,
    z: -250,
    size: 135,
    stallCost: 160,
    demandMul: 0.85,
    inventBonus: 0.75,
    color: 0x4a4840,
    role: 'industrial',
  },
  {
    id: 'harbor',
    name: 'Cloud Harbor',
    x: 50,
    z: 480,
    size: 128,
    stallCost: 200,
    demandMul: 1.2,
    inventBonus: 1.0,
    color: 0x4a5560,
    role: 'harbor',
  },
  {
    id: 'clocktower',
    name: 'Clocktower Bazaar',
    x: 600,
    z: 250,
    size: 122,
    stallCost: 340,
    demandMul: 1.55,
    inventBonus: 1.45,
    color: 0x6a5848,
    role: 'premium',
  },
  {
    id: 'gearworks',
    name: 'Gearworks Ward',
    x: -520,
    z: 200,
    size: 120,
    stallCost: 220,
    demandMul: 1.1,
    inventBonus: 1.05,
    color: 0x555048,
    role: 'industrial',
  },
  {
    id: 'spore_gardens',
    name: 'Spore Gardens',
    x: 300,
    z: 530,
    size: 115,
    stallCost: 260,
    demandMul: 1.25,
    inventBonus: 1.7,
    color: 0x4a5a48,
    role: 'premium',
  },
  {
    id: 'brass_arcade',
    name: 'Brass Arcade',
    x: -280,
    z: 500,
    size: 122,
    stallCost: 300,
    demandMul: 1.35,
    inventBonus: 1.5,
    color: 0x6a5a40,
    role: 'premium',
    themePark: true,
  },
  {
    id: 'sky_foundry',
    name: 'Sky Foundry',
    x: -600,
    z: -480,
    size: 132,
    stallCost: 240,
    demandMul: 1.05,
    inventBonus: 0.85,
    color: 0x4a4440,
    role: 'industrial',
  },
  {
    id: 'aether_spire',
    name: 'Aether Spire',
    x: 550,
    z: -480,
    size: 110,
    stallCost: 480,
    demandMul: 1.8,
    inventBonus: 2.0,
    color: 0x4a5068,
    role: 'premium',
  },
  {
    id: 'mid_ring_east',
    name: 'East Mid-Ring',
    x: 230,
    z: 100,
    size: 102,
    stallCost: 140,
    demandMul: 1.05,
    inventBonus: 1.0,
    color: 0x5a564c,
    role: 'mixed',
  },
  {
    id: 'mid_ring_west',
    name: 'West Mid-Ring',
    x: -200,
    z: 75,
    size: 102,
    stallCost: 140,
    demandMul: 1.0,
    inventBonus: 0.95,
    color: 0x5a564c,
    role: 'mixed',
  },
  {
    id: 'south_docks',
    name: 'South Docks',
    x: 100,
    z: -530,
    size: 105,
    stallCost: 180,
    demandMul: 1.15,
    inventBonus: 0.9,
    color: 0x4a5058,
    role: 'harbor',
    themePark: true,
  },
  {
    id: 'north_observatory',
    name: 'North Observatory',
    x: -100,
    z: 650,
    size: 98,
    stallCost: 320,
    demandMul: 1.3,
    inventBonus: 1.6,
    color: 0x4a5568,
    role: 'premium',
  },
];

export function districtById(id: string): CityDistrictDef | undefined {
  return CITY_DISTRICTS.find((d) => d.id === id);
}

/** Specialized harvest biomes — travel plazas for different mats */
export interface HarvestBiome {
  id: string;
  name: string;
  mats: CommodityId[];
  /** Visual reef tint */
  color: number;
}

export const HARVEST_BIOMES: Record<string, HarvestBiome> = {
  harbor: {
    id: 'harbor',
    name: 'Salt Cloud Reef',
    mats: ['sky_salt', 'cloud_iron'],
    color: 0x4a6a88,
  },
  south_docks: {
    id: 'south_docks',
    name: 'Iron Drift',
    mats: ['cloud_iron', 'scrap_brass'],
    color: 0x5a5a48,
  },
  spore_gardens: {
    id: 'spore_gardens',
    name: 'Spore Canopy',
    mats: ['spore_silk', 'sky_salt'],
    color: 0x3a6a48,
  },
  sky_foundry: {
    id: 'sky_foundry',
    name: 'Slag Vents',
    mats: ['scrap_brass', 'cloud_iron'],
    color: 0x6a4a38,
  },
  gearworks: {
    id: 'gearworks',
    name: 'Gear Spoil Field',
    mats: ['scrap_brass', 'sky_salt'],
    color: 0x555048,
  },
  industrial: {
    id: 'industrial',
    name: 'Workshop Spoil',
    mats: ['scrap_brass', 'cloud_iron', 'sky_salt'],
    color: 0x4a4840,
  },
  brass_arcade: {
    id: 'brass_arcade',
    name: 'Gilded Reef',
    mats: ['scrap_brass', 'spore_silk'],
    color: 0x6a5a40,
  },
  north_observatory: {
    id: 'north_observatory',
    name: 'Aether Mist Banks',
    mats: ['spore_silk', 'cloud_iron'],
    color: 0x4a5570,
  },
  grand_market: {
    id: 'grand_market',
    name: 'Market Flotsam',
    mats: ['cloud_iron', 'scrap_brass', 'spore_silk', 'sky_salt'],
    color: 0x5a5348,
  },
  mid_ring_east: {
    id: 'mid_ring_east',
    name: 'Ring Drift',
    mats: ['cloud_iron', 'sky_salt'],
    color: 0x5a564c,
  },
  mid_ring_west: {
    id: 'mid_ring_west',
    name: 'West Ring Spoil',
    mats: ['scrap_brass', 'sky_salt'],
    color: 0x5a564c,
  },
};

export const DEFAULT_HARVEST_POOL: CommodityId[] = [
  'cloud_iron',
  'scrap_brass',
  'spore_silk',
  'sky_salt',
];

export function harvestBiomeForDistrict(districtId: string): HarvestBiome {
  return (
    HARVEST_BIOMES[districtId] ?? {
      id: districtId,
      name: 'Cloud Reef',
      mats: DEFAULT_HARVEST_POOL,
      color: 0x4a5a48,
    }
  );
}

/** UI options for worker harvest assignment (empire reefs + mixed). */
export function listHarvestSites(): { id: string | null; name: string; mats: CommodityId[] }[] {
  const sites: { id: string | null; name: string; mats: CommodityId[] }[] = [
    { id: null, name: 'Any / mixed reefs', mats: [...DEFAULT_HARVEST_POOL] },
  ];
  for (const b of Object.values(HARVEST_BIOMES)) {
    sites.push({ id: b.id, name: b.name, mats: [...b.mats] });
  }
  return sites;
}

export function harvestPoolForWorker(w: WorkerState): CommodityId[] {
  if (w.harvestSiteId) {
    return [...harvestBiomeForDistrict(w.harvestSiteId).mats];
  }
  return [...DEFAULT_HARVEST_POOL];
}

export function harvestSiteLabel(siteId: string | null | undefined): string {
  if (!siteId) return 'Any / mixed reefs';
  return harvestBiomeForDistrict(siteId).name;
}

export function setWorkerHarvestSite(
  inv: InventoryState,
  workerId: string,
  siteId: string | null,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  if (siteId && !HARVEST_BIOMES[siteId]) {
    return { ok: false, msg: 'Unknown harvest site.' };
  }
  w.harvestSiteId = siteId;
  const label = harvestSiteLabel(siteId);
  return {
    ok: true,
    msg: `${w.name} will harvest at: ${label}`,
  };
}

export function describeWorkerAssignment(inv: InventoryState, w: WorkerState): string {
  if (w.job === 'program' && w.programId) {
    const p = inv.programs.find((x) => x.id === w.programId);
    const site =
      p && p.nodes.includes('harvest')
        ? ` · reef: ${harvestSiteLabel(w.harvestSiteId)}`
        : '';
    return `Program “${p?.name ?? '?'}”${site}`;
  }
  if (w.job === 'harvest') {
    return `Harvest · ${harvestSiteLabel(w.harvestSiteId)}`;
  }
  const def = JOB_DEFS.find((j) => j.id === w.job);
  return def?.name ?? w.job;
}

/** Player harvest minigame success — biased to biome mats */
export function applyHarvestSuccess(
  inv: InventoryState,
  pool: CommodityId[] = DEFAULT_HARVEST_POOL,
  qtyHint?: number,
): { id: CommodityId; qty: number; msg: string } {
  const mats = pool.length ? pool : DEFAULT_HARVEST_POOL;
  const id = mats[Math.floor(Math.random() * mats.length)]!;
  const qty = qtyHint ?? 1 + Math.floor(Math.random() * 3);
  addItem(inv, id, qty);
  inv.harvestRuns += 1;
  noteMarketSupply(inv, id, qty);
  notePeakBrass(inv);
  return {
    id,
    qty,
    msg: `Extracted ${qty}× ${COMMODITIES[id].name}`,
  };
}

/**
 * Passive city-empire worker tick (no nav mesh).
 * Advances job or one program step so mega-city crew keeps working.
 */
export function tickPassiveWorker(
  inv: InventoryState,
  workerId: string,
): { ok: boolean; msg?: string; brassDelta?: number } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false };
  if (w.job === 'idle') return { ok: false };
  if (w.job === 'program' && w.programId) {
    const p = inv.programs.find((x) => x.id === w.programId);
    if (!p || p.nodes.length < 1) return { ok: false, msg: `${w.name}: empty program` };
    const node = p.nodes[w.jobsDone % p.nodes.length]!;
    w.jobsDone += 1;
    return applyProgramNodeResult(inv, workerId, node);
  }
  w.jobsDone += 1;
  return applyWorkerJobResult(inv, workerId, w.job);
}

export function tickAllPassiveWorkers(inv: InventoryState): {
  msgs: string[];
  brassDelta: number;
} {
  const msgs: string[] = [];
  let brassDelta = 0;
  for (const w of inv.workers) {
    const r = tickPassiveWorker(inv, w.id);
    if (r.ok && r.msg) msgs.push(r.msg);
    if (r.brassDelta) brassDelta += r.brassDelta;
  }
  return { msgs, brassDelta };
}

/** Soft city pressure on fair prices (1 = neutral; &lt;1 glut; &gt;1 scarce) */
export type MarketPressure = Partial<Record<CommodityId, number>>;

export type StorageTrack = 'resources' | 'crafted' | 'inventions';

export interface InventoryState {
  brass: number;
  aether: number;
  items: Partial<Record<CommodityId, number>>;
  parcelLeased: boolean;
  /** 0 = none, 1+ unlimited expansion (3 unlocks invent) */
  bayLevel: number;
  harvestRuns: number;
  /** Legacy flag — kept in sync with workers.length > 0 */
  laborerHired: boolean;
  framesSold: number;
  repairsDone: number;
  workers: WorkerState[];
  playerBoard: PlayerBoardState;
  customRecipes: CustomRecipe[];
  /** Stacks of invented goods by recipe id */
  customStock: Record<string, number>;
  /** Light visual coding programs */
  programs: WorkerProgram[];
  /** Training-market plaza stall (single) */
  stall: StallState;
  /**
   * Mega-city multi-plaza stalls keyed by district id.
   * Lease shops across the map to scale retail revenue.
   */
  cityStalls: Record<string, StallState>;
  /** City fair-price pressure per good */
  marketPressure: MarketPressure;
  /** Market tutorial goal — apartment deed from real-estate office */
  apartmentOwned: boolean;
  /** Peak brass held (progress toward apartment) */
  peakBrass: number;
  /** Phase 3 city industrial workshop leased */
  cityWorkshopLeased: boolean;
  /** Inventions prototyped (stats) */
  inventionsMade: number;
  /** Units of invented goods sold via stalls / vendors */
  inventionsSold: number;
  /** Assembled robot frames (slot-built chassis with unique names) */
  assembledFrames: AssembledFrame[];
  /** Bonded storage — resources track (North Observatory) */
  storageResourcesLevel: number;
  /** Bonded storage — crafted goods (Clocktower) */
  storageCraftedLevel: number;
  /** Bonded storage — inventions (Aether Spire) */
  storageInventionsLevel: number;
  /** Frames displayed at broker stalls (visual stock) */
  brokerFrameStock: number;
  /** Medallion in bag (not currently hosting a robot) */
  medallionLoose: boolean;
  /** Worker id currently hosting Elias spirit */
  medallionHostId: string | null;
  /** Purchase→Game Maker placements */
  placements: PlacementRecord[];
  /** Romance progress with girl NPCs */
  relationships: RomanceState[];
  /** Bonded storage factory layouts by track */
  storageLayouts: Partial<Record<StorageTrack, FactoryLayout>>;
  /** Brass paid toward each storage factory layout */
  storageLayoutPaid: Partial<Record<StorageTrack, number>>;
  /** Sky Foundry bay-wing factory look */
  bayWingLayout: FactoryLayout | null;
  bayWingLayoutPaid: number;
}

const WORKER_NAMES = [
  'Rook',
  'Pip',
  'Nessa',
  'Bolt',
  'Midge',
  'Kade',
  'Sera',
  'Juno',
  'Vex',
  'Quinn',
  'Ivy',
  'Tarn',
  'Wren',
  'Osha',
  'Reed',
  'Lark',
  'Moss',
  'Cinder',
  'Pax',
  'Glyph',
  'Hex',
  'Rune',
  'Ash',
  'Nyx',
];

export function emptyInventory(starterBrass = 40): InventoryState {
  return {
    brass: starterBrass,
    aether: 0,
    items: {},
    parcelLeased: false,
    bayLevel: 0,
    harvestRuns: 0,
    laborerHired: false,
    framesSold: 0,
    repairsDone: 0,
    workers: [],
    playerBoard: { owned: false, thruster: false, rails: false, deck: false },
    customRecipes: [],
    customStock: {},
    programs: [
      {
        id: 'prog_default_haul',
        name: 'Haul Loop',
        nodes: ['harvest', 'return_bay'],
      },
      {
        id: 'prog_invent_cycle',
        name: 'Invent Market Cycle',
        nodes: [
          'harvest',
          'return_bay',
          'craft_custom',
          'stock_stall_frame',
          'price_fair_shelf',
        ],
      },
    ],
    stall: emptyStall(),
    cityStalls: {},
    marketPressure: {},
    apartmentOwned: false,
    peakBrass: starterBrass,
    cityWorkshopLeased: false,
    inventionsMade: 0,
    inventionsSold: 0,
    assembledFrames: [],
    storageResourcesLevel: 0,
    storageCraftedLevel: 0,
    storageInventionsLevel: 0,
    brokerFrameStock: 0,
    medallionLoose: false,
    medallionHostId: null,
    placements: [],
    relationships: [],
    storageLayouts: {},
    storageLayoutPaid: {},
    bayWingLayout: null,
    bayWingLayoutPaid: 0,
  };
}

/** Market tutorial: buy a sky apartment from the real-estate office */
export const APARTMENT_COST = 1000;
/** Phase 3 industrial workshop lease */
export const CITY_WORKSHOP_COST = 80;
export const ROGUE_REPAIR_PAY = 22;

export function leaseCityWorkshop(inv: InventoryState): { ok: boolean; msg: string } {
  if (inv.cityWorkshopLeased) return { ok: false, msg: 'You already lease a city workshop slip.' };
  if (inv.brass < CITY_WORKSHOP_COST) {
    return { ok: false, msg: `Need ${CITY_WORKSHOP_COST} brass for a city workshop.` };
  }
  inv.brass -= CITY_WORKSHOP_COST;
  inv.cityWorkshopLeased = true;
  // Share craft rights with bay systems; city shop unlocks invent path
  if (!inv.parcelLeased) {
    inv.parcelLeased = true;
    inv.bayLevel = Math.max(inv.bayLevel, 1);
  }
  // Ensure invent-capable floor if already deep into training
  if (inv.bayLevel < 3) {
    inv.bayLevel = Math.max(inv.bayLevel, 3);
  }
  return {
    ok: true,
    msg: `City workshop leased (−${CITY_WORKSHOP_COST}). Invent unlocked · expand bay forever · lease stalls across plazas.`,
  };
}

export function repairRogueRobot(
  inv: InventoryState,
  opts?: { ownerName?: string; jobLabel?: string },
): { ok: boolean; msg: string } {
  inv.brass += ROGUE_REPAIR_PAY;
  notePeakBrass(inv);
  const owner = opts?.ownerName ? opts.ownerName : 'its owner';
  const job = opts?.jobLabel ? ` (${opts.jobLabel})` : '';
  return {
    ok: true,
    msg: `Restored to ${owner}'s work${job} · +${ROGUE_REPAIR_PAY} brass.`,
  };
}

/** Harvest / scrap a rogue — parts + chance to recover Elias medallion if it was the host. */
export function harvestRogueRobot(
  inv: InventoryState,
  opts?: { wasMedallionHost?: boolean; ownerName?: string },
): { ok: boolean; msg: string } {
  addItem(inv, 'scrap_brass', 2 + Math.floor(Math.random() * 3));
  addItem(inv, 'gear_blank', Math.random() < 0.45 ? 1 : 0);
  inv.brass += 8;
  notePeakBrass(inv);
  const ownerBit = opts?.ownerName ? ` (${opts.ownerName}'s chassis)` : '';
  let msg = `Frame harvested${ownerBit} · scrap + gear. Robot is gone.`;
  if (opts?.wasMedallionHost || inv.medallionHostId) {
    inv.medallionLoose = true;
    inv.medallionHostId = null;
    addItem(inv, 'elias_medallion', 1);
    msg += " Elias's medallion returned to your pack — assign it to another robot.";
  }
  return { ok: true, msg };
}

export const ROBOT_BUY_COST = 120;
/** Robots cost less upkeep than humans */
export const ROBOT_WAGE_MUL = 0.35;

export function buyRobotWorker(inv: InventoryState): { ok: boolean; msg: string; worker?: WorkerState } {
  if (!inv.parcelLeased || inv.bayLevel < 1) {
    return { ok: false, msg: 'Lease a bay first — robots need a dock to report.' };
  }
  const max = maxWorkersForBay(inv.bayLevel);
  if (inv.workers.length >= max) {
    return { ok: false, msg: `Bay full (${inv.workers.length}/${max}). Expand for more slots.` };
  }
  if (!inv.assembledFrames) inv.assembledFrames = [];
  const hasFrame = inv.assembledFrames.length > 0;
  const hasBroker = (inv.brokerFrameStock ?? 0) > 0;
  if (!hasFrame && !hasBroker) {
    return { ok: false, msg: 'Need an assembled frame (workbench) or broker stock.' };
  }
  if (inv.brass < ROBOT_BUY_COST) {
    return { ok: false, msg: `Need ${ROBOT_BUY_COST} brass to buy a work robot.` };
  }
  inv.brass -= ROBOT_BUY_COST;
  let frame: AssembledFrame | null = null;
  if (hasBroker && !hasFrame) {
    inv.brokerFrameStock -= 1;
  } else if (hasBroker && hasFrame) {
    // Prefer player's best assembled chassis when both available
    inv.assembledFrames.sort((a, b) => b.quality - a.quality);
    frame = inv.assembledFrames.shift() ?? null;
  } else {
    inv.assembledFrames.sort((a, b) => b.quality - a.quality);
    frame = inv.assembledFrames.shift() ?? null;
  }
  const w = makeRobotWorker(frame?.name?.replace(/\s*Frame$/i, '') || `R-${inv.workers.length + 1}`);
  if (frame) applyFrameToWorker(w, frame);
  inv.workers.push(w);
  inv.laborerHired = true;
  const q = frame ? ` · ${frame.name} (Q${frame.quality.toFixed(2)})` : ' · broker chassis';
  return {
    ok: true,
    worker: w,
    msg: `Powered work robot ${w.name}${q} (−${ROBOT_BUY_COST} brass).`,
  };
}

export function applyFrameToWorker(w: WorkerState, frame: AssembledFrame) {
  w.frameId = frame.id;
  w.frameName = frame.name;
  w.frameQuality = frame.quality;
  w.frameSpeedMul = frame.speedMul;
  w.frameWorkMul = frame.workMul;
  w.frameHarvestMul = frame.harvestMul;
  w.frameProgramBonus = frame.programNodeBonus;
  w.payGrade = Math.max(w.payGrade ?? 0, frame.payGradeBonus);
}

export function makeRobotWorker(name: string, id?: string): WorkerState {
  return {
    id: id ?? `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    job: 'harvest',
    programId: null,
    hasBoard: false,
    hasSpeedTool: false,
    hasHaulPack: false,
    jobsDone: 0,
    payGrade: 0,
    harvestSiteId: null,
    kind: 'robot',
    hasMedallion: false,
    frameId: null,
    frameName: null,
    frameQuality: 1,
    frameSpeedMul: 0.85,
    frameWorkMul: 1.35,
    frameHarvestMul: 0.85,
    frameProgramBonus: 0,
  };
}

/** Ensure Elias exists as a robot worker (tutorial market crew of 4 with him). */
export function ensureEliasRobotWorker(inv: InventoryState): WorkerState {
  let elias = inv.workers.find((w) => w.id === 'bot_elias' || w.name === 'Elias');
  if (elias) {
    elias.kind = 'robot';
    if (!inv.medallionLoose && !inv.medallionHostId) {
      elias.hasMedallion = true;
      inv.medallionHostId = elias.id;
    }
    return elias;
  }
  elias = makeRobotWorker('Elias', 'bot_elias');
  elias.hasMedallion = true;
  elias.payGrade = 1;
  inv.workers.unshift(elias);
  inv.medallionHostId = elias.id;
  inv.medallionLoose = false;
  inv.laborerHired = true;
  return elias;
}

/**
 * Market tutorial crew: Elias (medallion robot) + 3 human laborers = 4 assignable agents.
 * Humans are granted once when Elias arrives (no brass charge).
 */
export function ensureTutorialMarketCrew(inv: InventoryState): void {
  if (!inv.parcelLeased) {
    inv.parcelLeased = true;
    inv.bayLevel = Math.max(inv.bayLevel, 1);
  }
  ensureEliasRobotWorker(inv);
  const humanNames = ['Rook', 'Pip', 'Nessa'];
  let humans = inv.workers.filter((w) => w.kind !== 'robot');
  for (const name of humanNames) {
    if (humans.length >= 3) break;
    if (humans.some((h) => h.name === name)) continue;
    const w: WorkerState = {
      id: `w_tut_${name.toLowerCase()}`,
      name,
      job: 'harvest',
      programId: null,
      hasBoard: false,
      hasSpeedTool: false,
      hasHaulPack: false,
      jobsDone: 0,
      payGrade: 0,
      harvestSiteId: null,
      kind: 'human',
    };
    inv.workers.push(w);
    humans.push(w);
  }
  inv.laborerHired = inv.workers.length > 0;
}

export function assignMedallion(inv: InventoryState, workerId: string): { ok: boolean; msg: string } {
  const bot = inv.workers.find((w) => w.id === workerId);
  if (!bot || bot.kind !== 'robot') {
    return { ok: false, msg: 'Medallion can only host in a robot you own.' };
  }
  if (!inv.medallionLoose && getQty(inv, 'elias_medallion') < 1 && inv.medallionHostId !== workerId) {
    // Allow reassign from current host
    if (!inv.medallionHostId) {
      return { ok: false, msg: 'No medallion in pack. Recover it when Elias is lost.' };
    }
  }
  // Clear previous host
  for (const w of inv.workers) {
    if (w.hasMedallion) w.hasMedallion = false;
  }
  if (getQty(inv, 'elias_medallion') > 0) removeItem(inv, 'elias_medallion', 1);
  inv.medallionLoose = false;
  bot.hasMedallion = true;
  inv.medallionHostId = bot.id;
  return {
    ok: true,
    msg: `${bot.name} now hosts Elias's spirit — human pace, medallion on the map.`,
  };
}

export function onMedallionHostLost(inv: InventoryState, workerId: string): void {
  if (inv.medallionHostId !== workerId) return;
  inv.medallionHostId = null;
  inv.medallionLoose = true;
  addItem(inv, 'elias_medallion', 1);
  const w = inv.workers.find((x) => x.id === workerId);
  if (w) w.hasMedallion = false;
}

export function buyApartment(inv: InventoryState): { ok: boolean; msg: string } {
  if (inv.apartmentOwned) {
    return { ok: false, msg: 'You already hold a deed to a sky apartment.' };
  }
  if (inv.brass < APARTMENT_COST) {
    return {
      ok: false,
      msg: `Need ${APARTMENT_COST} brass for a starter apartment (you have ${inv.brass}).`,
    };
  }
  inv.brass -= APARTMENT_COST;
  inv.apartmentOwned = true;
  notePeakBrass(inv);
  return {
    ok: true,
    msg: `Deed signed · sky apartment yours (−${APARTMENT_COST} brass). Market training complete!`,
  };
}

export function notePeakBrass(inv: InventoryState): void {
  if (inv.brass > inv.peakBrass) inv.peakBrass = inv.brass;
}

export function emptyStall(): StallState {
  return {
    owned: false,
    open: false,
    shelf: {},
    customShelf: {},
    frameShelf: [],
    asks: {},
    customAsks: {},
    autoFrames: true,
    autoHarvest: false,
    autoWire: false,
    autoInvent: false,
    sales: 0,
    earned: 0,
    lastDemand: 'Steady',
    pendingHaggle: null,
    layout: null,
    layoutPaid: 0,
  };
}

/** Live quote for stall site builder (lease + tier + props + color). */
export function quoteStallBuild(opts: {
  districtId: string;
  tier: StallTier;
  color: number;
  props?: SiteProp[];
  /** @deprecated */
  decor?: number;
  /** Include district lease (false when redesigning an owned stall) */
  includeLease?: boolean;
}): {
  total: number;
  lease: number;
  tierFee: number;
  propFee: number;
  colorFee: number;
} {
  const d = districtById(opts.districtId);
  const lease = opts.includeLease === false ? 0 : (d?.stallCost ?? STALL_LEASE_COST);
  const tierFee = STALL_TIER_EXTRA[opts.tier] ?? 0;
  let props = opts.props;
  if ((!props || !props.length) && opts.decor) {
    const ids = ['crates', 'banners', 'lanterns', 'planters', 'signboard'];
    props = [];
    for (let i = 0; i < Math.min(5, opts.decor); i++) {
      props.push({ id: ids[i]!, lx: 0, lz: 0, yaw: 0 });
    }
  }
  const propFee = sumPropCosts(props, SHOP_PROP_COST);
  const c = Math.max(0, Math.min(5, opts.color | 0));
  const colorFee = c === 0 ? 0 : 20 + c * 15;
  return {
    lease,
    tierFee,
    propFee,
    colorFee,
    total: lease + tierFee + propFee + colorFee,
  };
}

/** Factory site quote (upgrade base + form + props). */
export function quoteFactoryBuild(opts: {
  form: FactoryForm;
  props?: SiteProp[];
  baseCost?: number;
}): { total: number; base: number; formFee: number; propFee: number } {
  const base = opts.baseCost ?? 0;
  const formFee = FACTORY_FORM_EXTRA[opts.form] ?? 0;
  const propFee = sumPropCosts(opts.props, FACTORY_PROP_COST);
  return { base, formFee, propFee, total: base + formFee + propFee };
}

/** Plot must sit on the plaza deck or just past the rim (NPC-reachable). */
export function isValidStallPlot(districtId: string, x: number, z: number): boolean {
  const d = districtById(districtId);
  if (!d) return false;
  const dist = Math.hypot(x - d.x, z - d.z);
  return dist <= d.size * 0.58;
}

function normalizeStallLayout(layout: StallLayout): StallLayout {
  let props = Array.isArray(layout.props) ? layout.props.map((p) => ({ ...p })) : [];
  if (!props.length && layout.decor) {
    const ids = ['crates', 'banners', 'lanterns', 'planters', 'signboard'];
    for (let i = 0; i < Math.min(5, layout.decor); i++) {
      props.push({ id: ids[i]!, lx: -2.2 + i * 1.1, lz: -2.4, yaw: 0 });
    }
  }
  return {
    plotX: layout.plotX,
    plotZ: layout.plotZ,
    yaw: layout.yaw,
    tier: layout.tier,
    color: layout.color,
    props,
    built: layout.built,
  };
}

/**
 * Finalize new lease or redesign. Charges full quote on first build;
 * redesigns charge only the positive delta (more expensive items/location).
 */
export function finalizeStallBuild(
  inv: InventoryState,
  districtId: string,
  layout: StallLayout,
  opts?: { redesign?: boolean },
): { ok: boolean; msg: string; charged: number } {
  const dist = districtById(districtId);
  if (!dist) return { ok: false, msg: 'Unknown district.', charged: 0 };
  const next = normalizeStallLayout(layout);
  if (!isValidStallPlot(districtId, next.plotX, next.plotZ)) {
    return {
      ok: false,
      msg: 'Site must be on the plaza or within NPC reach of the rim.',
      charged: 0,
    };
  }
  const stall = ensureCityStall(inv, districtId);
  const redesign = !!opts?.redesign && stall.owned;
  if (!redesign && stall.owned) {
    return { ok: false, msg: `You already lease a stall in ${dist.name}.`, charged: 0 };
  }
  const buildQuote = quoteStallBuild({
    districtId,
    tier: next.tier,
    color: next.color,
    props: next.props,
    includeLease: false,
  });
  let charge: number;
  if (redesign) {
    const prev = stall.layout ? normalizeStallLayout(stall.layout) : null;
    const prevBuild = prev
      ? quoteStallBuild({
          districtId,
          tier: prev.tier,
          color: prev.color,
          props: prev.props,
          includeLease: false,
        }).total
      : 0;
    charge = Math.max(0, buildQuote.total - prevBuild);
  } else {
    charge = quoteStallBuild({
      districtId,
      tier: next.tier,
      color: next.color,
      props: next.props,
      includeLease: true,
    }).total;
  }
  if (inv.brass < charge) {
    return {
      ok: false,
      msg: `Need ${charge} brass (have ${inv.brass}).`,
      charged: 0,
    };
  }
  inv.brass -= charge;
  stall.owned = true;
  stall.open = true;
  stall.layout = { ...next, built: true };
  stall.layoutPaid = (stall.layoutPaid ?? 0) + charge;
  const n = ownedCityStallCount(inv);
  return {
    ok: true,
    charged: charge,
    msg: redesign
      ? charge > 0
        ? `Stall updated · ${dist.name} (−${charge}b).`
        : `Stall updated · ${dist.name} (no extra charge).`
      : `Stall open · ${dist.name} (−${charge}b). Empire shops: ${n}.`,
  };
}

/**
 * Finalize factory site (storage expand / bay wing / edit).
 * Only charges when the new quote exceeds the previous build (+ optional upgrade base).
 */
export function finalizeFactoryBuild(
  inv: InventoryState,
  layout: FactoryLayout,
  opts: {
    kind: 'storage' | 'bay_wing';
    districtId: string;
    storageTrack?: StorageTrack;
    /** Storage expand / bay expand base (0 on redesign) */
    baseCost?: number;
    redesign?: boolean;
    /** Bump storage level (storage) or bay level (bay_wing) */
    applyUpgrade?: boolean;
  },
): { ok: boolean; msg: string; charged: number } {
  if (!isValidStallPlot(opts.districtId, layout.plotX, layout.plotZ)) {
    return {
      ok: false,
      msg: 'Site must be on the plaza or within NPC reach of the rim.',
      charged: 0,
    };
  }
  const next: FactoryLayout = {
    ...layout,
    props: (layout.props ?? []).map((p) => ({ ...p })),
    built: true,
  };
  const redesign = !!opts.redesign;
  let prevBuild = 0;
  if (opts.kind === 'storage' && opts.storageTrack) {
    const prev = inv.storageLayouts?.[opts.storageTrack];
    if (prev?.built) {
      prevBuild = quoteFactoryBuild({ form: prev.form, props: prev.props, baseCost: 0 }).total;
    }
  } else {
    const prev = inv.bayWingLayout;
    if (prev?.built) {
      prevBuild = quoteFactoryBuild({ form: prev.form, props: prev.props, baseCost: 0 }).total;
    }
  }
  const newBuild = quoteFactoryBuild({
    form: next.form,
    props: next.props,
    baseCost: 0,
  }).total;
  const cosmeticsDelta = Math.max(0, newBuild - prevBuild);
  const base = redesign || !opts.applyUpgrade ? 0 : (opts.baseCost ?? 0);
  const charge = base + cosmeticsDelta;

  if (opts.applyUpgrade && !redesign) {
    if (opts.kind === 'storage' && opts.storageTrack) {
      const from = getStorageLevel(inv, opts.storageTrack);
      if (from >= STORAGE_MAX_LEVEL) {
        return { ok: false, msg: 'Storage already maxed.', charged: 0 };
      }
    } else if (opts.kind === 'bay_wing') {
      // expandBay deducts its own fee — we only charge cosmeticsDelta here
    }
  }

  if (opts.kind === 'bay_wing' && opts.applyUpgrade && !redesign) {
    if (inv.brass < cosmeticsDelta + (opts.baseCost ?? 0)) {
      return {
        ok: false,
        msg: `Need ${(opts.baseCost ?? 0) + cosmeticsDelta} brass (have ${inv.brass}).`,
        charged: 0,
      };
    }
    const r = expandBay(inv);
    if (!r.ok) return { ok: false, msg: r.msg, charged: 0 };
    if (cosmeticsDelta > 0) inv.brass -= cosmeticsDelta;
    inv.bayWingLayout = next;
    inv.bayWingLayoutPaid = (inv.bayWingLayoutPaid ?? 0) + cosmeticsDelta;
    return {
      ok: true,
      charged: (opts.baseCost ?? 0) + cosmeticsDelta,
      msg: `Bay expanded · factory placed (−${(opts.baseCost ?? 0) + cosmeticsDelta}b).`,
    };
  }

  if (inv.brass < charge) {
    return { ok: false, msg: `Need ${charge} brass (have ${inv.brass}).`, charged: 0 };
  }
  inv.brass -= charge;

  if (opts.kind === 'storage' && opts.storageTrack) {
    if (opts.applyUpgrade && !redesign) {
      const from = getStorageLevel(inv, opts.storageTrack);
      const nextLv = from + 1;
      if (opts.storageTrack === 'resources') inv.storageResourcesLevel = nextLv;
      else if (opts.storageTrack === 'crafted') inv.storageCraftedLevel = nextLv;
      else inv.storageInventionsLevel = nextLv;
    }
    if (!inv.storageLayouts) inv.storageLayouts = {};
    if (!inv.storageLayoutPaid) inv.storageLayoutPaid = {};
    inv.storageLayouts[opts.storageTrack] = next;
    inv.storageLayoutPaid[opts.storageTrack] =
      (inv.storageLayoutPaid[opts.storageTrack] ?? 0) + charge;
    return {
      ok: true,
      charged: charge,
      msg:
        charge > 0
          ? `Factory site set (−${charge}b).`
          : 'Factory site updated (no extra charge).',
    };
  }

  inv.bayWingLayout = next;
  inv.bayWingLayoutPaid = (inv.bayWingLayoutPaid ?? 0) + charge;
  return {
    ok: true,
    charged: charge,
    msg:
      charge > 0
        ? `Bay factory updated (−${charge}b).`
        : 'Bay factory updated (no extra charge).',
  };
}

export const STALL_LEASE_COST = 55;
/** Seconds between stall customer checks */
export const STALL_INTERVAL = 10;
/** Fair street price ≈ generous NPC buy band */
export const STALL_PRICE_MUL = 1.12;
/** Ask clamp vs fair */
export const STALL_ASK_MIN_MUL = 0.5;
export const STALL_ASK_MAX_MUL = 2.0;

/** Soft cap only for sanity — expand bay to raise this. */
export const ABSOLUTE_MAX_WORKERS = 48;

export function maxWorkersForBay(bayLevel: number): number {
  if (bayLevel <= 0) return 0;
  // L1=1, L2=2, L3=3, then +2 slots per expand (empire scale)
  if (bayLevel <= 3) return bayLevel;
  return Math.min(ABSOLUTE_MAX_WORKERS, 3 + (bayLevel - 3) * 2);
}

export function bayLevelName(level: number): string {
  if (level <= 0) return 'No bay';
  if (level === 1) return 'Starter Bay';
  if (level === 2) return 'Expanded Pad';
  if (level === 3) return 'Workshop Wing';
  return `Empire Bay L${level}`;
}

/** Escalating expand cost — late levels need multi-plaza cash flow */
export function expandBayCost(fromLevel: number): number {
  if (fromLevel === 1) return BAY_EXPAND_L2;
  if (fromLevel === 2) return BAY_EXPAND_L3;
  // L3→4: 180, then ~1.65× each step
  return Math.round(180 * Math.pow(1.65, fromLevel - 3));
}

/** Hire cost rises with crew size */
export function hireCost(inv: InventoryState): number {
  return LABORER_HIRE_COST + inv.workers.length * 18;
}

// ——— Bonded storage (per-category stack caps) ———

/** Raw / harvest mats */
export const STORAGE_RESOURCE_IDS: readonly CommodityId[] = [
  'cloud_iron',
  'scrap_brass',
  'spore_silk',
  'sky_salt',
  'wire',
];

/** Crafted & equipment goods */
export const STORAGE_CRAFTED_IDS: readonly CommodityId[] = [
  'glass_pane',
  'fuel_cell',
  'gear_blank',
  'repair_kit',
  'speed_tool',
  'haul_pack',
  'polished_wire',
  'bloom_brass',
  'bloom_sky',
  'bloom_spore',
  'bloom_harbor',
  'bloom_aether',
  'flower_gift',
];

export const STORAGE_MAX_LEVEL = 3;
/** L0 = base stack; L1+ absolute caps */
export const STORAGE_CAP_TIERS = [0, 999, 999_999, 999_999_999] as const;
export const STORAGE_INVENTION_BASE_CAP = 99;

const STORAGE_COST_BASE: Record<StorageTrack, number> = {
  inventions: 500,
  crafted: 850,
  resources: 1500,
};
const STORAGE_COST_SCALE = 40;

export function storageTrackLabel(track: StorageTrack): string {
  if (track === 'resources') return 'Resources';
  if (track === 'crafted') return 'Crafted';
  return 'Inventions';
}

export function storageOfficeDistrict(track: StorageTrack): string {
  if (track === 'resources') return 'north_observatory';
  if (track === 'crafted') return 'clocktower';
  return 'aether_spire';
}

export function storageTrackForCommodity(id: CommodityId): StorageTrack {
  if ((STORAGE_RESOURCE_IDS as readonly string[]).includes(id)) return 'resources';
  return 'crafted';
}

export function getStorageLevel(inv: InventoryState, track: StorageTrack): number {
  const raw =
    track === 'resources'
      ? inv.storageResourcesLevel
      : track === 'crafted'
        ? inv.storageCraftedLevel
        : inv.storageInventionsLevel;
  return Math.max(0, Math.min(STORAGE_MAX_LEVEL, Math.floor(raw ?? 0)));
}

export function storageCapAtLevel(track: StorageTrack, level: number, baseStack: number): number {
  const lv = Math.max(0, Math.min(STORAGE_MAX_LEVEL, level));
  if (lv <= 0) {
    return track === 'inventions' ? STORAGE_INVENTION_BASE_CAP : baseStack;
  }
  return STORAGE_CAP_TIERS[lv] ?? STORAGE_CAP_TIERS[STORAGE_MAX_LEVEL]!;
}

export function effectiveStack(inv: InventoryState, id: CommodityId): number {
  const def = COMMODITIES[id];
  const track = storageTrackForCommodity(id);
  return storageCapAtLevel(track, getStorageLevel(inv, track), def.stack);
}

export function effectiveInventionStack(inv: InventoryState): number {
  return storageCapAtLevel('inventions', getStorageLevel(inv, 'inventions'), STORAGE_INVENTION_BASE_CAP);
}

export function storageUpgradeCost(track: StorageTrack, fromLevel: number): number {
  if (fromLevel < 0 || fromLevel >= STORAGE_MAX_LEVEL) return 0;
  const base = STORAGE_COST_BASE[track];
  return Math.round(base * Math.pow(STORAGE_COST_SCALE, fromLevel));
}

export function upgradeStorage(
  inv: InventoryState,
  track: StorageTrack,
): { ok: boolean; msg: string } {
  const from = getStorageLevel(inv, track);
  if (from >= STORAGE_MAX_LEVEL) {
    return { ok: false, msg: `${storageTrackLabel(track)} storage is fully expanded.` };
  }
  const cost = storageUpgradeCost(track, from);
  if (inv.brass < cost) {
    return { ok: false, msg: `Need ${cost} brass (have ${inv.brass}).` };
  }
  inv.brass -= cost;
  const next = from + 1;
  if (track === 'resources') inv.storageResourcesLevel = next;
  else if (track === 'crafted') inv.storageCraftedLevel = next;
  else inv.storageInventionsLevel = next;

  const base = track === 'inventions' ? STORAGE_INVENTION_BASE_CAP : 99;
  const cap = storageCapAtLevel(track, next, base);
  return {
    ok: true,
    msg: `${storageTrackLabel(track)} storage → L${next} · hold up to ${cap.toLocaleString()} each (${cost}b).`,
  };
}

/** Nodes free on base wage; each extra node needs pay grade / costs more wages */
export const PROGRAM_FREE_NODES = 3;

export function minPayGradeForNodes(nodeCount: number): number {
  return Math.max(0, Math.ceil((nodeCount - PROGRAM_FREE_NODES) / 2));
}

export function programNodeWage(nodeCount: number): number {
  return LABORER_WAGE_PER_TICK + Math.max(0, nodeCount - PROGRAM_FREE_NODES);
}

export function workerWagePerTick(inv: InventoryState, w: WorkerState): number {
  let wage = LABORER_WAGE_PER_TICK + w.payGrade;
  if (w.job === 'program' && w.programId) {
    const p = inv.programs.find((x) => x.id === w.programId);
    if (p) wage = Math.max(wage, programNodeWage(p.nodes.length) + w.payGrade);
  }
  if (isRobotWorker(w)) wage = Math.max(1, Math.round(wage * ROBOT_WAGE_MUL));
  return wage;
}

/** Live quote for purchase→Game Maker placement. */
export function quotePlacement(opts: {
  baseCost: number;
  scale: number;
  districtId: string;
  decorCount: number;
  decorUnitCost?: number;
}): { total: number; scaleFee: number; locationFee: number; decorFee: number; trafficMul: number } {
  const d = CITY_DISTRICTS.find((x) => x.id === opts.districtId);
  const demand = d?.demandMul ?? 1;
  const stallHeat = (d?.stallCost ?? 100) / 200;
  const scaleFee = Math.round(Math.max(0, opts.scale - 1) * 420 + (opts.scale > 1.4 ? 280 : 0));
  const locationFee = Math.round(stallHeat * demand * 380);
  const decorFee = opts.decorCount * (opts.decorUnitCost ?? 45);
  const total = opts.baseCost + scaleFee + locationFee + decorFee;
  const trafficMul = 0.85 + demand * 0.2 + Math.min(0.35, locationFee / 2000) + Math.min(0.25, opts.scale - 1);
  return {
    total: Math.min(1000 + opts.baseCost, Math.max(opts.baseCost, total)),
    scaleFee,
    locationFee,
    decorFee,
    trafficMul: Math.max(0.75, Math.min(1.85, trafficMul)),
  };
}

export function stallPlacementMul(inv: InventoryState, districtId: string): number {
  const list = inv.placements.filter(
    (p) => p.districtId === districtId && (p.kind === 'stall' || p.kind === 'shop'),
  );
  let m = 1;
  for (const p of list) {
    m *= (p.trafficMul || 1) * (p.attractMul || 1) * Math.sqrt(p.capacityMul || 1);
  }
  // Wizard layout quality — nicer stands draw more traffic
  const layout = inv.cityStalls?.[districtId]?.layout;
  if (layout?.built) {
    const tierMul =
      layout.tier === 'large' ? 1.35 : layout.tier === 'shop' ? 1.22 : layout.tier === 'shade' ? 1.1 : 1;
    const propMul = 1 + (layout.props?.length ?? layout.decor ?? 0) * 0.03;
    m *= tierMul * propMul;
  }
  if (!list.length && !layout?.built) return 1;
  return Math.max(0.8, Math.min(2.2, m));
}

export function giftRomanceNpc(
  inv: InventoryState,
  npcId: string,
  gift: 'flower_gift' | 'brass_charm' | 'silk_scarf',
): { ok: boolean; msg: string; stage: RelationshipStage } {
  if (getQty(inv, gift) < 1) {
    return { ok: false, msg: `No ${COMMODITIES[gift].name} in pack.`, stage: 0 };
  }
  removeItem(inv, gift, 1);
  let rel = inv.relationships.find((r) => r.npcId === npcId);
  if (!rel) {
    rel = { npcId, stage: 0, affinity: 0, giftsGiven: 0 };
    inv.relationships.push(rel);
  }
  const boost = gift === 'silk_scarf' ? 28 : gift === 'brass_charm' ? 18 : 12;
  rel.affinity += boost;
  rel.giftsGiven += 1;
  const prev = rel.stage;
  if (rel.affinity >= 100) rel.stage = 4;
  else if (rel.affinity >= 70) rel.stage = 3;
  else if (rel.affinity >= 40) rel.stage = 2;
  else if (rel.affinity >= 15) rel.stage = 1;
  else rel.stage = 0;
  const stageNames = ['stranger', 'acquaintance', 'friendly', 'close', 'sweetheart'];
  return {
    ok: true,
    stage: rel.stage,
    msg:
      rel.stage > prev
        ? `She smiles brighter — now ${stageNames[rel.stage]}.`
        : `Gift accepted (+${boost} affinity). ${stageNames[rel.stage]}.`,
  };
}

export function totalWagesPerTick(inv: InventoryState): number {
  return inv.workers.reduce((s, w) => s + workerWagePerTick(inv, w), 0);
}

export function ownedCityStallCount(inv: InventoryState): number {
  return Object.values(inv.cityStalls).filter((s) => s.owned).length;
}

export function canInvent(inv: InventoryState): boolean {
  return inv.bayLevel >= 3 || inv.cityWorkshopLeased;
}

// ——— Crafting ———

export interface Recipe {
  id: string;
  name: string;
  inputs: { id: CommodityId; n: number }[];
  output: { id: CommodityId; n: number };
  needsBay: boolean;
}

export const RECIPES: Recipe[] = [
  {
    id: 'wire_from_scrap',
    name: 'Draw Wire',
    inputs: [{ id: 'scrap_brass', n: 2 }],
    output: { id: 'wire', n: 1 },
    needsBay: true,
  },
  {
    id: 'gear_blank',
    name: 'Stamp Gear Blank',
    inputs: [
      { id: 'cloud_iron', n: 2 },
      { id: 'scrap_brass', n: 1 },
    ],
    output: { id: 'gear_blank', n: 1 },
    needsBay: true,
  },
  {
    id: 'repair_kit',
    name: 'Assemble Repair Kit',
    inputs: [
      { id: 'wire', n: 1 },
      { id: 'scrap_brass', n: 1 },
    ],
    output: { id: 'repair_kit', n: 1 },
    needsBay: true,
  },
  {
    id: 'speed_tool',
    name: 'Forge Rivet Spanner',
    inputs: [
      { id: 'gear_blank', n: 1 },
      { id: 'wire', n: 2 },
      { id: 'cloud_iron', n: 1 },
    ],
    output: { id: 'speed_tool', n: 1 },
    needsBay: true,
  },
  {
    id: 'haul_pack',
    name: 'Stitch Haul Pack',
    inputs: [
      { id: 'spore_silk', n: 2 },
      { id: 'scrap_brass', n: 1 },
    ],
    output: { id: 'haul_pack', n: 1 },
    needsBay: true,
  },
  {
    id: 'polished_wire',
    name: 'Polish Copper Wire',
    inputs: [
      { id: 'wire', n: 2 },
      { id: 'sky_salt', n: 1 },
    ],
    output: { id: 'polished_wire', n: 1 },
    needsBay: true,
  },
];

export function canCraft(inv: InventoryState, recipe: Recipe): boolean {
  if (recipe.needsBay && !inv.parcelLeased) return false;
  for (const inp of recipe.inputs) {
    if (getQty(inv, inp.id) < inp.n) return false;
  }
  return true;
}

export function craft(inv: InventoryState, recipe: Recipe): { ok: boolean; msg: string } {
  if (!inv.parcelLeased && recipe.needsBay) {
    return { ok: false, msg: 'Lease a bay first — craft needs a workbench.' };
  }
  if (!canCraft(inv, recipe)) {
    return { ok: false, msg: 'Missing materials for that recipe.' };
  }
  for (const inp of recipe.inputs) {
    removeItem(inv, inp.id, inp.n);
  }
  addItem(inv, recipe.output.id, recipe.output.n);
  return {
    ok: true,
    msg: `Crafted ${recipe.output.n}× ${COMMODITIES[recipe.output.id].name}`,
  };
}

// ——— Hire / workers ———

export const LABORER_HIRE_COST = 35;
export const LABORER_WAGE_PER_TICK = 1;
/** Legacy interval; agents use travel + work timers instead */
export const LABORER_INTERVAL = 12;
export const UPKEEP_INTERVAL = 28;
export const BAY_UPKEEP_PER_LEVEL = 1;

export function hireLaborer(inv: InventoryState): { ok: boolean; msg: string; worker?: WorkerState } {
  if (!inv.parcelLeased || inv.bayLevel < 1) {
    return { ok: false, msg: 'Lease a bay first — workers need a place to report.' };
  }
  const max = maxWorkersForBay(inv.bayLevel);
  if (inv.workers.length >= max) {
    return {
      ok: false,
      msg: `Bay full (${inv.workers.length}/${max}). Expand bay (unlimited) for more worker slots.`,
    };
  }
  const cost = hireCost(inv);
  if (inv.brass < cost) {
    return { ok: false, msg: `Need ${cost} brass to hire (crew demand rises).` };
  }
  inv.brass -= cost;
  const name = WORKER_NAMES[inv.workers.length % WORKER_NAMES.length]!;
  const w: WorkerState = {
    id: `w_${Date.now()}_${inv.workers.length}`,
    name,
    job: 'harvest',
    programId: null,
    hasBoard: false,
    hasSpeedTool: false,
    hasHaulPack: false,
    jobsDone: 0,
    payGrade: 0,
    harvestSiteId: null,
  };
  inv.workers.push(w);
  inv.laborerHired = true;
  return {
    ok: true,
    worker: w,
    msg: `Hired ${name} (−${cost} brass). Raise pay for long programs · expand bay for more crew.`,
  };
}

/** Spend brass to raise a worker’s pay grade (unlocks longer task lists). */
export const PAY_RAISE_COST = 40;

export function raiseWorkerPay(
  inv: InventoryState,
  workerId: string,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  const cost = PAY_RAISE_COST + w.payGrade * 25;
  if (inv.brass < cost) {
    return { ok: false, msg: `Need ${cost} brass to raise ${w.name}’s pay grade.` };
  }
  inv.brass -= cost;
  w.payGrade += 1;
  const nodes = PROGRAM_FREE_NODES + w.payGrade * 2;
  return {
    ok: true,
    msg: `${w.name} pay grade ${w.payGrade} (−${cost}). Can run programs up to ~${nodes} steps.`,
  };
}

/** Legacy passive tick — kept for safety; prefer agents */
export function tickLaborer(inv: InventoryState): { ok: boolean; msg?: string } {
  if (inv.workers.length === 0) {
    inv.laborerHired = false;
    return { ok: false };
  }
  const wage = totalWagesPerTick(inv);
  if (inv.brass < wage) {
    const fired = inv.workers.splice(0);
    inv.laborerHired = false;
    return {
      ok: false,
      msg: `${fired.map((w) => w.name).join(', ')} quit — not enough brass for wages (${wage}/tick).`,
    };
  }
  inv.brass -= wage;
  return { ok: true };
}

export function setWorkerJob(
  inv: InventoryState,
  workerId: string,
  job: JobId,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  w.job = job;
  if (job !== 'program') w.programId = null;
  const def = JOB_DEFS.find((j) => j.id === job);
  return { ok: true, msg: `${w.name} assigned: ${def?.name ?? job}` };
}

export function assignWorkerProgram(
  inv: InventoryState,
  workerId: string,
  programId: string,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  if (p.nodes.length < 1) return { ok: false, msg: 'Program has no nodes.' };
  const need = minPayGradeForNodes(p.nodes.length);
  if (w.payGrade < need) {
    return {
      ok: false,
      msg: `${w.name} refuses “${p.name}” (${p.nodes.length} steps) — need pay grade ${need} (has ${w.payGrade}). Raise pay first.`,
    };
  }
  const maxNodes = workerMaxProgramNodes(w);
  if (p.nodes.length > maxNodes) {
    return {
      ok: false,
      msg: `${w.name} is a bare robot — max ${maxNodes} tasks (has ${p.nodes.length}). Equip Elias's medallion for human capacity.`,
    };
  }
  w.job = 'program';
  w.programId = programId;
  const wage = workerWagePerTick(inv, w);
  return {
    ok: true,
    msg: `${w.name} running “${p.name}” (${p.nodes.length} steps · wage ${wage}/tick)`,
  };
}

export function createProgram(
  inv: InventoryState,
  name?: string,
): { ok: boolean; msg: string; program?: WorkerProgram } {
  if (inv.programs.length >= 32) {
    return { ok: false, msg: 'Max 32 programs on this empire bay.' };
  }
  const program: WorkerProgram = {
    id: `prog_${Date.now()}`,
    name: name?.trim() || `Program ${inv.programs.length + 1}`,
    nodes: ['harvest', 'return_bay'],
  };
  inv.programs.push(program);
  return { ok: true, msg: `Created ${program.name}`, program };
}

export function addProgramNode(
  inv: InventoryState,
  programId: string,
  node: ProgramNodeKind,
): { ok: boolean; msg: string } {
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  if (p.nodes.length >= 20) return { ok: false, msg: 'Max 20 nodes per program.' };
  p.nodes.push(node);
  return { ok: true, msg: `Added ${PROGRAM_NODE_DEFS.find((n) => n.id === node)?.name ?? node}` };
}

export function removeProgramNode(
  inv: InventoryState,
  programId: string,
  index: number,
): { ok: boolean; msg: string } {
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  if (index < 0 || index >= p.nodes.length) return { ok: false, msg: 'Bad node index.' };
  p.nodes.splice(index, 1);
  return { ok: true, msg: 'Node removed.' };
}

export function moveProgramNode(
  inv: InventoryState,
  programId: string,
  index: number,
  dir: -1 | 1,
): { ok: boolean; msg: string } {
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  const j = index + dir;
  if (index < 0 || index >= p.nodes.length || j < 0 || j >= p.nodes.length) {
    return { ok: false, msg: 'Cannot move.' };
  }
  const tmp = p.nodes[index]!;
  p.nodes[index] = p.nodes[j]!;
  p.nodes[j] = tmp;
  return { ok: true, msg: 'Reordered.' };
}

export function getWorkerProgramNodes(inv: InventoryState, w: WorkerState): ProgramNodeKind[] {
  if (w.job !== 'program' || !w.programId) return [];
  const p = inv.programs.find((x) => x.id === w.programId);
  return p?.nodes ?? [];
}

/** First vendor that stocks / buys a commodity */
export function findVendorForTrade(
  id: CommodityId,
  mode: 'buy' | 'sell',
): VendorDef | null {
  for (const v of VENDORS) {
    if (!v.stock.includes(id)) continue;
    // All listed stock can be bought/sold both ways in our model
    void mode;
    return v;
  }
  return null;
}

/** Vendor waypoint key used by worker pathing */
export function vendorWaypointKey(vendorId: string): string {
  return `vendor_${vendorId}`;
}

export function applyProgramNodeResult(
  inv: InventoryState,
  workerId: string,
  node: ProgramNodeKind,
): { ok: boolean; msg?: string; brassDelta?: number } {
  const w = inv.workers.find((x) => x.id === workerId);
  const name = w?.name ?? 'Worker';

  const finish = (r: { ok: boolean; msg?: string; brassDelta?: number }) => {
    if (r.ok && w) {
      w.jobsDone = (w.jobsDone ?? 0) + 1;
      // Tool wear attention event
      if (w.hasSpeedTool && w.jobsDone > 0 && w.jobsDone % 22 === 0) {
        w.hasSpeedTool = false;
        return {
          ...r,
          msg: `${r.msg ?? ''} · ${name}'s Rivet Spanner wore out!`.trim(),
        };
      }
    }
    return r;
  };

  if (node === 'return_bay') {
    return { ok: true, msg: `${name} returned to bay` };
  }

  // ——— Slot frame assembly (replaces fixed basic/fine recipes) ———
  if (node === 'craft_frame' || node === 'craft_fine_frame') {
    const r = tryAutoAssembleFrame(inv, node === 'craft_fine_frame');
    return finish({ ok: r.ok, msg: `${name}: ${r.msg}` });
  }

  // ——— Craft any workbench recipe ———
  const recipeId = PROGRAM_CRAFT_RECIPE[node];
  if (recipeId) {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return { ok: false, msg: `${name}: unknown recipe` };
    if (!canCraft(inv, recipe)) {
      return { ok: false, msg: `${name}: missing mats for ${recipe.name}` };
    }
    const r = craft(inv, recipe);
    return finish({ ok: r.ok, msg: `${name}: ${r.msg}` });
  }

  if (node === 'craft_custom') {
    const first = inv.customRecipes[0];
    if (!first) {
      return { ok: false, msg: `${name}: no inventions (invent at L3 desk first)` };
    }
    const r = craftCustom(inv, first.id);
    return finish({ ok: r.ok, msg: `${name}: ${r.msg}` });
  }

  // ——— Frame broker ———
  if (node === 'sell_frame') {
    const r = sellFrameToBroker(inv);
    if (!r.ok) return { ok: false, msg: `${name}: ${r.msg}` };
    return finish({
      ok: true,
      msg: `${name} sold a frame (+${r.gained})`,
      brassDelta: r.gained,
    });
  }

  // ——— Field repair ———
  if (node === 'repair') {
    const r = completeRepair(inv);
    if (!r.ok) return { ok: false, msg: `${name}: ${r.msg}` };
    return finish({
      ok: true,
      msg: `${name} finished a repair (+${REPAIR_PAY})`,
      brassDelta: REPAIR_PAY,
    });
  }

  // ——— Harvest ———
  if (node === 'harvest') {
    return finish(applyWorkerJobResult(inv, workerId, 'harvest'));
  }

  // ——— Sell invention ———
  if (node === 'sell_invention') {
    const rid = Object.keys(inv.customStock).find((k) => (inv.customStock[k] ?? 0) > 0);
    if (!rid) return { ok: false, msg: `${name}: no inventions in stock` };
    const r = sellCustomToVendor(inv, rid);
    return finish({ ok: r.ok, msg: `${name}: ${r.msg}`, brassDelta: r.gained });
  }

  // ——— Bulk sell all harvest mats ———
  if (node === 'sell_all_harvest') {
    const ids: CommodityId[] = ['cloud_iron', 'scrap_brass', 'spore_silk', 'sky_salt'];
    let gained = 0;
    const parts: string[] = [];
    for (const id of ids) {
      const q = getQty(inv, id);
      if (q < 1) continue;
      const vendor = findVendorForTrade(id, 'sell');
      if (!vendor) continue;
      const r = sellToVendor(inv, vendor, id, q);
      if (r.ok) {
        gained += r.gained;
        parts.push(`${q}× ${COMMODITIES[id].name}`);
      }
    }
    if (!parts.length) return { ok: false, msg: `${name}: no harvest mats to sell` };
    return finish({
      ok: true,
      msg: `${name} sold harvest (${parts.join(', ')}) +${gained}`,
      brassDelta: gained,
    });
  }

  // ——— Bulk sell all of one commodity ———
  if (PROGRAM_SELL_ALL.includes(node)) {
    const id = PROGRAM_TRADE_ITEM[node];
    if (!id) return { ok: false, msg: `${name}: bad bulk sell` };
    const q = getQty(inv, id);
    if (q < 1) return { ok: false, msg: `${name}: no ${COMMODITIES[id].name}` };
    const vendor = findVendorForTrade(id, 'sell');
    if (!vendor) return { ok: false, msg: `${name}: no vendor` };
    const r = sellToVendor(inv, vendor, id, q);
    return finish({
      ok: r.ok,
      msg: `${name} @ ${vendor.name}: ${r.msg}`,
      brassDelta: r.gained,
    });
  }

  // ——— Bulk buy 5 ———
  const buy5 = PROGRAM_BUY_5[node];
  if (buy5) {
    const vendor = findVendorForTrade(buy5, 'buy');
    if (!vendor) return { ok: false, msg: `${name}: no vendor` };
    const r = buyFromVendor(inv, vendor, buy5, 5);
    return finish({
      ok: r.ok,
      msg: `${name} @ ${vendor.name}: ${r.msg}`,
      brassDelta: r.ok ? -r.spent : 0,
    });
  }

  // ——— Stock player stall ———
  if (node === 'stock_stall_frame') {
    return finish(stockAssembledFrameOnStall(inv, name));
  }
  if (node === 'stock_stall_wire') {
    return finish(stockStallFromInv(inv, 'wire', 3, name));
  }
  if (node === 'stock_stall_scrap') {
    return finish(stockStallFromInv(inv, 'scrap_brass', 5, name));
  }

  // ——— Stall price policies ———
  if (node === 'price_deal_shelf') {
    return finish(applyShelfPricePolicy(inv, 'deal'));
  }
  if (node === 'price_fair_shelf') {
    return finish(applyShelfPricePolicy(inv, 'fair'));
  }
  if (node === 'price_premium_shelf') {
    return finish(applyShelfPricePolicy(inv, 'premium'));
  }

  // ——— Market sell / buy 1× ———
  const tradeId = PROGRAM_TRADE_ITEM[node];
  if (tradeId && !node.startsWith('sell_all_') && !node.startsWith('buy_5_')) {
    const isBuy = node.startsWith('buy_');
    const vendor = findVendorForTrade(tradeId, isBuy ? 'buy' : 'sell');
    if (!vendor) {
      return { ok: false, msg: `${name}: no vendor trades ${COMMODITIES[tradeId].name}` };
    }
    if (isBuy) {
      const r = buyFromVendor(inv, vendor, tradeId, 1);
      return finish({
        ok: r.ok,
        msg: `${name} @ ${vendor.name}: ${r.msg}`,
        brassDelta: r.ok ? -r.spent : 0,
      });
    }
    const r = sellToVendor(inv, vendor, tradeId, 1);
    return finish({
      ok: r.ok,
      msg: `${name} @ ${vendor.name}: ${r.msg}`,
      brassDelta: r.gained,
    });
  }

  return { ok: false, msg: `${name}: unknown program step` };
}

// ——— Player retail stall (training + multi-plaza city) ———

export function ensureCityStall(inv: InventoryState, districtId: string): StallState {
  if (!inv.cityStalls) inv.cityStalls = {};
  let s = inv.cityStalls[districtId];
  if (!s) {
    s = emptyStall();
    inv.cityStalls[districtId] = s;
  }
  if (!s.customShelf) s.customShelf = {};
  return s;
}

export function leaseStall(inv: InventoryState): { ok: boolean; msg: string } {
  if (inv.stall.owned) return { ok: false, msg: 'You already hold a training-market stall.' };
  if (inv.brass < STALL_LEASE_COST) {
    return { ok: false, msg: `Need ${STALL_LEASE_COST} brass for a retail stall.` };
  }
  inv.brass -= STALL_LEASE_COST;
  inv.stall.owned = true;
  inv.stall.open = true;
  return {
    ok: true,
    msg: `Leased plaza stall (−${STALL_LEASE_COST}). Stock it or enable auto-list. Open for business.`,
  };
}

/** Lease a mega-city district shop — visit many plazas to scale retail */
export function leaseCityStall(
  inv: InventoryState,
  districtId: string,
): { ok: boolean; msg: string } {
  const dist = districtById(districtId);
  if (!dist) return { ok: false, msg: 'Unknown district.' };
  const stall = ensureCityStall(inv, districtId);
  if (stall.owned) {
    return { ok: false, msg: `You already lease a stall in ${dist.name}.` };
  }
  if (inv.brass < dist.stallCost) {
    return {
      ok: false,
      msg: `Need ${dist.stallCost} brass for a stall in ${dist.name} (you have ${inv.brass}). Multi-plaza retail is expensive — invent & sell.`,
    };
  }
  inv.brass -= dist.stallCost;
  stall.owned = true;
  stall.open = true;
  const n = ownedCityStallCount(inv);
  return {
    ok: true,
    msg: `Leased stall · ${dist.name} (−${dist.stallCost}). Empire shops: ${n}. Stock inventions at premium plazas for max profit.`,
  };
}

export function toggleStallOpen(inv: InventoryState): { ok: boolean; msg: string } {
  if (!inv.stall.owned) return { ok: false, msg: 'Lease a stall first.' };
  inv.stall.open = !inv.stall.open;
  return {
    ok: true,
    msg: inv.stall.open ? 'Stall OPEN — customers browsing.' : 'Stall CLOSED.',
  };
}

export function toggleCityStallOpen(
  inv: InventoryState,
  districtId: string,
): { ok: boolean; msg: string } {
  const dist = districtById(districtId);
  const stall = inv.cityStalls?.[districtId];
  if (!stall?.owned) return { ok: false, msg: 'Lease this district stall first.' };
  stall.open = !stall.open;
  return {
    ok: true,
    msg: `${dist?.name ?? districtId}: ${stall.open ? 'OPEN' : 'CLOSED'}`,
  };
}

export function stockStallFromInv(
  inv: InventoryState,
  id: CommodityId,
  qty: number,
  workerName?: string,
  stallRef?: StallState,
): { ok: boolean; msg: string } {
  const stall = stallRef ?? inv.stall;
  if (!stall.owned) {
    return { ok: false, msg: `${workerName ?? 'You'}: lease a stall first` };
  }
  if (getQty(inv, id) < qty) {
    return {
      ok: false,
      msg: `${workerName ?? 'You'}: need ${qty}× ${COMMODITIES[id].name}`,
    };
  }
  removeItem(inv, id, qty);
  stall.shelf[id] = (stall.shelf[id] ?? 0) + qty;
  // Default ask to fair if never set
  if (stall.asks[id] == null) {
    stall.asks[id] = fairStallPrice(id, inv);
  }
  const who = workerName ? `${workerName} stocked` : 'Stocked';
  const ask = stall.asks[id] ?? fairStallPrice(id, inv);
  return {
    ok: true,
    msg: `${who} stall with ${qty}× ${COMMODITIES[id].name} @ ${ask}b ask`,
  };
}

/** Move one assembled frame from bay stock onto a stall display. */
export function stockAssembledFrameOnStall(
  inv: InventoryState,
  workerName?: string,
  stallRef?: StallState,
): { ok: boolean; msg: string } {
  const stall = stallRef ?? inv.stall;
  if (!stall.owned) return { ok: false, msg: `${workerName ?? 'You'}: lease a stall first` };
  if (!inv.assembledFrames) inv.assembledFrames = [];
  if (!stall.frameShelf) stall.frameShelf = [];
  if (inv.assembledFrames.length < 1) {
    return { ok: false, msg: `${workerName ?? 'You'}: no assembled frames to stock` };
  }
  inv.assembledFrames.sort((a, b) => b.sellValue - a.sellValue);
  const frame = inv.assembledFrames.shift()!;
  stall.frameShelf.push(frame);
  const who = workerName ? `${workerName} stocked` : 'Stocked';
  return {
    ok: true,
    msg: `${who} ${frame.name} on stall (~${frame.sellValue}b)`,
  };
}

/** Stock invented goods onto a stall (training or city district) */
export function stockInventionOnStall(
  inv: InventoryState,
  recipeId: string,
  qty = 1,
  stallRef?: StallState,
  inventBonus = 1,
): { ok: boolean; msg: string } {
  const stall = stallRef ?? inv.stall;
  if (!stall.owned) return { ok: false, msg: 'Lease a stall first.' };
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.' };
  const have = inv.customStock[recipeId] ?? 0;
  if (have < qty) return { ok: false, msg: `Need ${qty}× ${recipe.name} in stock.` };
  inv.customStock[recipeId] = have - qty;
  if (inv.customStock[recipeId]! <= 0) delete inv.customStock[recipeId];
  if (!stall.customShelf) stall.customShelf = {};
  stall.customShelf[recipeId] = (stall.customShelf[recipeId] ?? 0) + qty;
  if (!stall.customAsks) stall.customAsks = {};
  if (stall.customAsks[recipeId] == null) {
    stall.customAsks[recipeId] = fairInventionAsk(recipe, inventBonus);
  }
  return {
    ok: true,
    msg: `Stocked ${qty}× ${recipe.name} @ ${stall.customAsks[recipeId]}b ask (invented goods sell best at premium plazas).`,
  };
}

/** City pressure 0.72–1.4 around neutral 1.0 */
export function getMarketPressure(inv: InventoryState, id: CommodityId): number {
  const p = inv.marketPressure[id];
  if (typeof p !== 'number' || Number.isNaN(p)) return 1;
  return Math.max(0.72, Math.min(1.4, p));
}

/** Supply flood (harvest / dump-sell) softens fair price */
export function noteMarketSupply(inv: InventoryState, id: CommodityId, units = 1): void {
  const cur = getMarketPressure(inv, id);
  inv.marketPressure[id] = Math.max(0.72, cur - 0.018 * Math.min(units, 8));
}

/** Demand (stall sale / player buy) tightens fair price */
export function noteMarketDemand(inv: InventoryState, id: CommodityId, units = 1): void {
  const cur = getMarketPressure(inv, id);
  inv.marketPressure[id] = Math.min(1.4, cur + 0.014 * Math.min(units, 8));
}

/** Drift pressure back toward 1.0 */
export function tickMarketPressure(inv: InventoryState): void {
  for (const key of Object.keys(inv.marketPressure) as CommodityId[]) {
    const v = inv.marketPressure[key];
    if (v == null) continue;
    const next = v + (1 - v) * 0.1;
    if (Math.abs(next - 1) < 0.01) delete inv.marketPressure[key];
    else inv.marketPressure[key] = next;
  }
}

/** City “street fair” price — base band × soft market pressure */
export function fairStallPrice(id: CommodityId, inv?: InventoryState): number {
  const pressure = inv ? getMarketPressure(inv, id) : 1;
  return Math.max(1, Math.round(COMMODITIES[id].baseBuy * STALL_PRICE_MUL * pressure));
}

/** @deprecated use fairStallPrice / getStallAsk */
export function stallUnitPrice(id: CommodityId): number {
  return fairStallPrice(id);
}

/**
 * Product quality tier 0–2.
 * Raw harvest = 0; processed parts Q1; tools/frames/fine goods Q2.
 */
export function productQuality(id: CommodityId): number {
  switch (id) {
    case 'fine_frame':
    case 'polished_wire':
    case 'basic_frame':
    case 'speed_tool':
      return 2;
    case 'repair_kit':
    case 'gear_blank':
    case 'wire':
    case 'fuel_cell':
    case 'glass_pane':
    case 'haul_pack':
      return 1;
    default:
      return 0; // harvest mats
  }
}

export function getStallAsk(
  inv: InventoryState,
  id: CommodityId,
  stall: StallState = inv.stall,
): number {
  const fair = fairStallPrice(id, inv);
  const raw = stall.asks[id];
  if (typeof raw === 'number' && raw >= 1) {
    return clampStallAsk(id, raw, inv);
  }
  return fair;
}

export function clampStallAsk(id: CommodityId, price: number, inv?: InventoryState): number {
  const fair = fairStallPrice(id, inv);
  const min = Math.max(1, Math.round(fair * STALL_ASK_MIN_MUL));
  const max = Math.max(min, Math.round(fair * STALL_ASK_MAX_MUL));
  return Math.max(min, Math.min(max, Math.round(price)));
}

export function setStallAsk(
  inv: InventoryState,
  id: CommodityId,
  price: number,
  stall: StallState = inv.stall,
): { ok: boolean; msg: string; ask: number } {
  if (!stall.owned) return { ok: false, msg: 'Lease a stall first.', ask: 0 };
  const ask = clampStallAsk(id, price, inv);
  stall.asks[id] = ask;
  const fair = fairStallPrice(id, inv);
  const d = stallDemandInfo(ask, fair, productQuality(id));
  return {
    ok: true,
    ask,
    msg: `${COMMODITIES[id].name} ask ${ask}b · fair ${fair}b · demand ${d.label}`,
  };
}

/** Apply price policy to every stocked shelf line (goods + inventions). */
export function applyShelfPricePolicy(
  inv: InventoryState,
  policy: 'deal' | 'fair' | 'premium',
  stall: StallState = inv.stall,
  inventBonus = 1,
): { ok: boolean; msg: string } {
  if (!stall.owned) return { ok: false, msg: 'Lease a stall first.' };
  const ids = (Object.keys(stall.shelf) as CommodityId[]).filter(
    (id) => (stall.shelf[id] ?? 0) > 0,
  );
  const inventIds = Object.keys(stall.customShelf ?? {}).filter(
    (k) => (stall.customShelf[k] ?? 0) > 0,
  );
  if (ids.length === 0 && inventIds.length === 0) {
    return { ok: false, msg: 'Shelf empty — nothing to price.' };
  }
  const mul = policy === 'deal' ? 0.85 : policy === 'premium' ? 1.18 : 1;
  for (const id of ids) {
    const fair = fairStallPrice(id, inv);
    stall.asks[id] = clampStallAsk(id, Math.round(fair * mul), inv);
  }
  if (!stall.customAsks) stall.customAsks = {};
  for (const rid of inventIds) {
    const recipe = inv.customRecipes.find((r) => r.id === rid);
    if (!recipe) continue;
    const fair = fairInventionAsk(recipe, inventBonus);
    stall.customAsks[rid] = clampInventionAsk(recipe, Math.round(fair * mul), inventBonus);
  }
  const label = policy === 'deal' ? 'deals (−15%)' : policy === 'premium' ? 'premium (+18%)' : 'fair';
  const n = ids.length + inventIds.length;
  return { ok: true, msg: `Shelf priced at ${label} · ${n} lines` };
}

export function nudgeStallAsk(
  inv: InventoryState,
  id: CommodityId,
  delta: number,
  stall: StallState = inv.stall,
): { ok: boolean; msg: string; ask: number } {
  const cur = getStallAsk(inv, id, stall);
  return setStallAsk(inv, id, cur + delta, stall);
}

/** Fair shelf ask for a custom invention (sell value × invent bonus × quality). */
export function fairInventionAsk(recipe: CustomRecipe, inventBonus = 1): number {
  const q = recipe.quality ?? 1;
  return Math.max(1, Math.round(recipe.sellValue * inventBonus * (0.95 + q * 0.08)));
}

export function clampInventionAsk(
  recipe: CustomRecipe,
  price: number,
  inventBonus = 1,
): number {
  const fair = fairInventionAsk(recipe, inventBonus);
  const min = Math.max(1, Math.round(fair * STALL_ASK_MIN_MUL));
  const max = Math.max(min, Math.round(fair * STALL_ASK_MAX_MUL));
  return Math.max(min, Math.min(max, Math.round(price)));
}

export function getInventionAsk(
  stall: StallState,
  recipe: CustomRecipe,
  inventBonus = 1,
): number {
  if (!stall.customAsks) stall.customAsks = {};
  const fair = fairInventionAsk(recipe, inventBonus);
  const raw = stall.customAsks[recipe.id];
  if (typeof raw === 'number' && raw >= 1) {
    return clampInventionAsk(recipe, raw, inventBonus);
  }
  return fair;
}

export function setInventionAsk(
  stall: StallState,
  recipe: CustomRecipe,
  price: number,
  inventBonus = 1,
): { ok: boolean; msg: string; ask: number } {
  if (!stall.owned) return { ok: false, msg: 'Lease a stall first.', ask: 0 };
  if (!stall.customAsks) stall.customAsks = {};
  const ask = clampInventionAsk(recipe, price, inventBonus);
  stall.customAsks[recipe.id] = ask;
  const fair = fairInventionAsk(recipe, inventBonus);
  const d = stallDemandInfo(ask, fair, recipe.quality ?? 1);
  return {
    ok: true,
    ask,
    msg: `${recipe.name} ask ${ask}b · fair ${fair}b · demand ${d.label}`,
  };
}

export function nudgeInventionAsk(
  stall: StallState,
  recipe: CustomRecipe,
  delta: number,
  inventBonus = 1,
): { ok: boolean; msg: string; ask: number } {
  const cur = getInventionAsk(stall, recipe, inventBonus);
  return setInventionAsk(stall, recipe, cur + delta, inventBonus);
}

export function resolveStallHaggle(
  inv: InventoryState,
  accept: boolean,
  stall: StallState = inv.stall,
): { ok: boolean; msg: string } {
  const h = stall.pendingHaggle;
  if (!h) return { ok: false, msg: 'No haggle pending.' };
  stall.pendingHaggle = null;
  if (!accept) {
    return { ok: true, msg: 'Haggle refused — customer walked.' };
  }
  const onShelf = stall.shelf[h.id] ?? 0;
  if (onShelf < 1) {
    return { ok: false, msg: 'That good left the shelf — haggle expired.' };
  }
  stall.shelf[h.id] = onShelf - 1;
  if ((stall.shelf[h.id] ?? 0) <= 0) delete stall.shelf[h.id];
  inv.brass += h.offer;
  stall.sales += 1;
  stall.earned += h.offer;
  if (h.id === 'basic_frame' || h.id === 'fine_frame') inv.framesSold += 1;
  noteMarketDemand(inv, h.id, 1);
  notePeakBrass(inv);
  return {
    ok: true,
    msg: `Haggle closed · sold 1× ${COMMODITIES[h.id].name} @ ${h.offer}b (ask was ${h.ask}b)`,
  };
}

export type StallDemandLabel = 'Hot' | 'Steady' | 'Cool' | 'Slow' | 'Dead';

export function stallDemandInfo(
  ask: number,
  fair: number,
  quality: number,
): { factor: number; label: StallDemandLabel; ratio: number } {
  const fairSafe = Math.max(1, fair);
  const ratio = ask / fairSafe;
  // Quality softens premium: effective ratio lower when quality high
  const adj = ratio / (1 + 0.3 * quality);
  let factor: number;
  let label: StallDemandLabel;
  if (adj <= 0.88) {
    factor = 1.5;
    label = 'Hot';
  } else if (adj <= 1.06) {
    factor = 1.0;
    label = 'Steady';
  } else if (adj <= 1.28) {
    factor = 0.52;
    label = 'Cool';
  } else if (adj <= 1.55) {
    factor = 0.26;
    label = 'Slow';
  } else {
    factor = 0.09;
    label = 'Dead';
  }
  return { factor, label, ratio };
}

export function stallLineDemand(inv: InventoryState, id: CommodityId) {
  return stallDemandInfo(getStallAsk(inv, id), fairStallPrice(id, inv), productQuality(id));
}

/** Pull one unit from inv into shelf if auto modes set and shelf empty of that line */
function autoRestockShelf(inv: InventoryState, stall: StallState) {
  if (!stall.frameShelf) stall.frameShelf = [];
  if (!inv.assembledFrames) inv.assembledFrames = [];
  if (stall.autoFrames && stall.frameShelf.length < 1 && inv.assembledFrames.length > 0) {
    inv.assembledFrames.sort((a, b) => b.sellValue - a.sellValue);
    const frame = inv.assembledFrames.shift()!;
    stall.frameShelf.push(frame);
  }
  // Migrate legacy commodity frame shelf → assembled display
  if ((stall.shelf.basic_frame ?? 0) > 0) {
    const n = stall.shelf.basic_frame!;
    delete stall.shelf.basic_frame;
    for (let i = 0; i < n; i++) stall.frameShelf.push(makeLegacyAssembledFrame(inv, 'basic'));
  }
  if ((stall.shelf.fine_frame ?? 0) > 0) {
    const n = stall.shelf.fine_frame!;
    delete stall.shelf.fine_frame;
    for (let i = 0; i < n; i++) stall.frameShelf.push(makeLegacyAssembledFrame(inv, 'fine'));
  }
  if (stall.autoWire && (stall.shelf.wire ?? 0) < 1 && getQty(inv, 'wire') > 0) {
    removeItem(inv, 'wire', 1);
    stall.shelf.wire = (stall.shelf.wire ?? 0) + 1;
    if (stall.asks.wire == null) stall.asks.wire = fairStallPrice('wire', inv);
  }
  if (stall.autoHarvest) {
    const harvest: CommodityId[] = ['cloud_iron', 'scrap_brass', 'spore_silk', 'sky_salt'];
    for (const id of harvest) {
      if ((stall.shelf[id] ?? 0) < 1 && getQty(inv, id) > 0) {
        removeItem(inv, id, 1);
        stall.shelf[id] = (stall.shelf[id] ?? 0) + 1;
        if (stall.asks[id] == null) stall.asks[id] = fairStallPrice(id, inv);
        break;
      }
    }
  }
  if (stall.autoInvent) {
    if (!stall.customShelf) stall.customShelf = {};
    if (!stall.customAsks) stall.customAsks = {};
    for (const rid of Object.keys(inv.customStock)) {
      if ((inv.customStock[rid] ?? 0) > 0 && (stall.customShelf[rid] ?? 0) < 1) {
        inv.customStock[rid]!--;
        if (inv.customStock[rid]! <= 0) delete inv.customStock[rid];
        stall.customShelf[rid] = (stall.customShelf[rid] ?? 0) + 1;
        if (stall.customAsks[rid] == null) {
          const recipe = inv.customRecipes.find((r) => r.id === rid);
          if (recipe) stall.customAsks[rid] = fairInventionAsk(recipe);
        }
        break;
      }
    }
  }
}

function askForStall(inv: InventoryState, stall: StallState, id: CommodityId): number {
  const raw = stall.asks[id];
  if (typeof raw === 'number' && raw > 0) return raw;
  return fairStallPrice(id, inv);
}

/**
 * One customer check on a specific stall.
 * demandMul / inventBonus from city district boost traffic & invention payouts.
 */
export function tickStallState(
  inv: InventoryState,
  stall: StallState,
  opts?: { demandMul?: number; inventBonus?: number; label?: string },
): { ok: boolean; msg?: string; haggle?: boolean } {
  if (!stall.owned || !stall.open) return { ok: false };
  if (!stall.customShelf) stall.customShelf = {};
  const demandMul = opts?.demandMul ?? 1;
  const inventBonus = opts?.inventBonus ?? 1;
  const label = opts?.label ?? 'Stall';

  if (stall.pendingHaggle) {
    stall.pendingHaggle.ttl -= 1;
    if (stall.pendingHaggle.ttl <= 0) {
      stall.pendingHaggle = null;
      return { ok: false, msg: `${label}: haggle expired — customer left.` };
    }
    return { ok: false, haggle: true, msg: `${label}: customer waiting on a haggle…` };
  }

  autoRestockShelf(inv, stall);
  tickMarketPressure(inv);

  // Prefer selling inventions first when stocked (market cycle payoff)
  const inventIds = Object.keys(stall.customShelf).filter((k) => (stall.customShelf[k] ?? 0) > 0);
  if (inventIds.length > 0 && Math.random() < 0.45 + inventBonus * 0.15) {
    const rid = inventIds[Math.floor(Math.random() * inventIds.length)]!;
    const recipe = inv.customRecipes.find((r) => r.id === rid);
    if (recipe) {
      const q = recipe.quality ?? 1;
      const fair = fairInventionAsk(recipe, inventBonus);
      const ask = getInventionAsk(stall, recipe, inventBonus);
      const d = stallDemandInfo(ask, fair, q);
      const inventSaleChance = Math.min(0.95, 0.35 + d.factor * 0.5 * demandMul);
      if (Math.random() > inventSaleChance) {
        stall.lastDemand = d.label;
        return {
          ok: false,
          msg:
            d.label === 'Dead' || d.label === 'Slow'
              ? `${label}: invention browsers left — ${recipe.name} priced high (${d.label}).`
              : undefined,
        };
      }
      stall.customShelf[rid]!--;
      if (stall.customShelf[rid]! <= 0) delete stall.customShelf[rid];
      inv.brass += ask;
      stall.sales += 1;
      stall.earned += ask;
      inv.inventionsSold = (inv.inventionsSold ?? 0) + 1;
      notePeakBrass(inv);
      stall.lastDemand = d.label;
      const vs = ask === fair ? 'fair' : ask < fair ? 'deal' : 'premium';
      return {
        ok: true,
        msg: `${label} sold invention ${recipe.name} @ ${ask}b (${vs} · ${d.label}) · sales ${stall.sales}`,
      };
    }
  }

  // Assembled frames — high ticket when quality is strong
  if (!stall.frameShelf) stall.frameShelf = [];
  if (stall.frameShelf.length > 0 && Math.random() < 0.38) {
    stall.frameShelf.sort((a, b) => b.sellValue - a.sellValue);
    const frame = stall.frameShelf.shift()!;
    const price = Math.round(frame.sellValue * (0.92 + inventBonus * 0.08));
    inv.brass += price;
    stall.sales += 1;
    stall.earned += price;
    inv.framesSold += 1;
    notePeakBrass(inv);
    stall.lastDemand = frame.quality >= 1.35 ? 'Hot' : 'Steady';
    return {
      ok: true,
      msg: `${label} sold ${frame.name} @ ${price}b · sales ${stall.sales}`,
    };
  }

  const ids = (Object.keys(stall.shelf) as CommodityId[]).filter(
    (id) => (stall.shelf[id] ?? 0) > 0,
  );
  if (ids.length === 0 && inventIds.length === 0 && stall.frameShelf.length === 0) {
    stall.lastDemand = 'Dead';
    return { ok: false, msg: `${label} empty — stock goods, frames, or inventions.` };
  }
  if (ids.length === 0) return { ok: false };

  let totalW = 0;
  const weights: { id: CommodityId; w: number; d: ReturnType<typeof stallLineDemand> }[] = [];
  for (const id of ids) {
    const d = stallDemandInfo(askForStall(inv, stall, id), fairStallPrice(id, inv), productQuality(id));
    const w = Math.max(0.05, d.factor * demandMul);
    weights.push({ id, w, d });
    totalW += w;
  }
  const avgFactor = totalW / weights.length;
  stall.lastDemand =
    avgFactor >= 1.2
      ? 'Hot'
      : avgFactor >= 0.85
        ? 'Steady'
        : avgFactor >= 0.45
          ? 'Cool'
          : avgFactor >= 0.2
            ? 'Slow'
            : 'Dead';

  const saleChance = Math.min(0.95, 0.22 + avgFactor * 0.45 * demandMul);
  if (Math.random() > saleChance) {
    return {
      ok: false,
      msg:
        stall.lastDemand === 'Dead' || stall.lastDemand === 'Slow'
          ? `${label}: browsers left — prices high (${stall.lastDemand}).`
          : undefined,
    };
  }

  let roll = Math.random() * totalW;
  let picked = weights[0]!;
  for (const row of weights) {
    roll -= row.w;
    if (roll <= 0) {
      picked = row;
      break;
    }
  }
  const id = picked.id;
  const ask = askForStall(inv, stall, id);
  const fair = fairStallPrice(id, inv);

  if (Math.random() < 0.18) {
    const offer = Math.max(1, Math.round(ask * (0.78 + Math.random() * 0.14)));
    stall.pendingHaggle = { id, offer, ask, fair, ttl: 3 };
    return {
      ok: false,
      haggle: true,
      msg: `${label} haggle! ${offer}b for ${COMMODITIES[id].name} (ask ${ask}b).`,
    };
  }

  stall.shelf[id] = (stall.shelf[id] ?? 1) - 1;
  if ((stall.shelf[id] ?? 0) <= 0) delete stall.shelf[id];
  inv.brass += ask;
  stall.sales += 1;
  stall.earned += ask;
  if (id === 'basic_frame' || id === 'fine_frame') inv.framesSold += 1;
  noteMarketDemand(inv, id, 1);
  notePeakBrass(inv);
  const vs = ask === fair ? 'fair' : ask < fair ? 'deal' : 'premium';
  return {
    ok: true,
    msg: `${label} sold 1× ${COMMODITIES[id].name} @ ${ask}b (${vs} · ${picked.d.label}) · sales ${stall.sales}`,
  };
}

/** Training-market stall (legacy API). */
export function tickStall(inv: InventoryState): { ok: boolean; msg?: string; haggle?: boolean } {
  return tickStallState(inv, inv.stall, { label: 'Training stall' });
}

/** Tick every owned open city stall + training stall. */
export function tickAllStalls(inv: InventoryState): {
  ok: boolean;
  msg?: string;
  haggle?: boolean;
  sales: number;
} {
  let sales = 0;
  let lastMsg: string | undefined;
  let haggle = false;
  if (inv.stall.owned && inv.stall.open) {
    const r = tickStallState(inv, inv.stall, { label: 'Training stall' });
    if (r.ok) sales++;
    if (r.msg) lastMsg = r.msg;
    if (r.haggle) haggle = true;
  }
  if (inv.cityStalls) {
    for (const [did, stall] of Object.entries(inv.cityStalls)) {
      if (!stall.owned || !stall.open) continue;
      const dist = districtById(did);
      const placeMul = stallPlacementMul(inv, did);
      const r = tickStallState(inv, stall, {
        demandMul: (dist?.demandMul ?? 1) * placeMul,
        inventBonus: (dist?.inventBonus ?? 1) * Math.sqrt(placeMul),
        label: dist?.name ?? did,
      });
      if (r.ok) sales++;
      if (r.msg) lastMsg = r.msg;
      if (r.haggle) haggle = true;
    }
  }
  return { ok: sales > 0, msg: lastMsg, haggle, sales };
}

export function equipWorkerBoard(
  inv: InventoryState,
  workerId: string,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  if (w.hasBoard) return { ok: false, msg: `${w.name} already has a work board.` };
  if (!inv.playerBoard.owned && getQty(inv, 'fuel_cell') < 0) {
    /* board purchase is separate */
  }
  // Equip costs a board chassis from shop stock concept: require player owns board shop purchase token
  // Simpler: spend 40 brass OR need playerBoard.owned spare — use brass board kit price
  const cost = 40;
  if (inv.brass < cost) return { ok: false, msg: `Need ${cost} brass for a worker board kit.` };
  inv.brass -= cost;
  w.hasBoard = true;
  return { ok: true, msg: `${w.name} equipped with a work surfboard — travels faster.` };
}

export function equipWorkerTool(
  inv: InventoryState,
  workerId: string,
  kind: 'speed' | 'haul',
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  if (kind === 'speed') {
    if (w.hasSpeedTool) return { ok: false, msg: `${w.name} already has a Rivet Spanner.` };
    if (getQty(inv, 'speed_tool') < 1) {
      return { ok: false, msg: 'Craft a Rivet Spanner at the workbench first.' };
    }
    removeItem(inv, 'speed_tool', 1);
    w.hasSpeedTool = true;
    return { ok: true, msg: `${w.name} equipped Rivet Spanner — works faster.` };
  }
  if (w.hasHaulPack) return { ok: false, msg: `${w.name} already has a Haul Pack.` };
  if (getQty(inv, 'haul_pack') < 1) {
    return { ok: false, msg: 'Craft a Haul Pack at the workbench first.' };
  }
  removeItem(inv, 'haul_pack', 1);
  w.hasHaulPack = true;
  return { ok: true, msg: `${w.name} equipped Haul Pack — bigger reef yields.` };
}

export function isRobotWorker(w: WorkerState): boolean {
  return w.kind === 'robot';
}

/** Robots slower unless medallion / high-quality frame; humans baseline. */
export function workerMoveSpeed(w: WorkerState): number {
  let s = 3.2;
  if (w.hasBoard) s += 2.4;
  if (isRobotWorker(w)) {
    if (w.hasMedallion) s *= 1.05;
    else s *= Math.max(0.55, Math.min(1.15, w.frameSpeedMul ?? 0.85));
  }
  return s;
}

export function workerWorkMul(w: WorkerState): number {
  let mul = w.hasSpeedTool ? 0.55 : 1;
  // Higher mul = slower work timer in agents
  if (isRobotWorker(w) && !w.hasMedallion) {
    mul *= Math.max(0.5, Math.min(1.7, w.frameWorkMul ?? 1.35));
  }
  return mul;
}

export function workerHarvestQty(w: WorkerState): number {
  let n = w.hasHaulPack ? 2 + Math.floor(Math.random() * 2) : 1;
  if (isRobotWorker(w) && !w.hasMedallion) {
    const hm = w.frameHarvestMul ?? 0.85;
    n = Math.max(1, Math.floor(n * hm + (hm > 1.1 ? Math.random() : 0)));
  }
  return n;
}

/** Max useful program nodes — robots capped unless medallion / fine frame. */
export function workerMaxProgramNodes(w: WorkerState): number {
  if (!isRobotWorker(w) || w.hasMedallion) return 8;
  return 3 + Math.max(0, w.frameProgramBonus ?? 0);
}

/** Apply result when agent completes a work node */
export function applyWorkerJobResult(
  inv: InventoryState,
  workerId: string,
  job: JobId,
): { ok: boolean; msg?: string; brassDelta?: number } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false };

  if (job === 'harvest') {
    const pool = harvestPoolForWorker(w);
    const id = pool[Math.floor(Math.random() * pool.length)]!;
    const n = workerHarvestQty(w);
    addItem(inv, id, n);
    inv.harvestRuns += 1;
    noteMarketSupply(inv, id, n);
    const site = harvestSiteLabel(w.harvestSiteId);
    return {
      ok: true,
      msg: `${w.name} hauled ${n}× ${COMMODITIES[id].name} (${site})`,
    };
  }

  if (job === 'craft_wire' || job === 'craft_frame') {
    // Built-in job shortcuts still use program craft path
    return applyProgramNodeResult(inv, workerId, job);
  }

  if (job === 'sell_frame') {
    const r = sellFrameToBroker(inv);
    if (!r.ok) return { ok: false, msg: `${w.name}: ${r.msg}` };
    return { ok: true, msg: `${w.name} sold a frame (+${r.gained})`, brassDelta: r.gained };
  }

  if (job === 'repair') {
    const r = completeRepair(inv);
    if (!r.ok) return { ok: false, msg: `${w.name}: ${r.msg}` };
    return { ok: true, msg: `${w.name} finished a repair (+${REPAIR_PAY})`, brassDelta: REPAIR_PAY };
  }

  return { ok: true };
}

export function tickBayUpkeep(inv: InventoryState): { ok: boolean; msg?: string } {
  if (inv.bayLevel < 1) return { ok: true };
  const wages = totalWagesPerTick(inv);
  const cost = inv.bayLevel * BAY_UPKEEP_PER_LEVEL + wages;
  // Multi-plaza shop leases: soft upkeep per owned city stall
  const shopTax = ownedCityStallCount(inv) * 2;
  const total = cost + shopTax;
  if (total <= 0) return { ok: true };
  if (inv.brass < total) {
    if (inv.workers.length > 0) {
      const gone = inv.workers.pop()!;
      inv.laborerHired = inv.workers.length > 0;
      return {
        ok: false,
        msg: `Upkeep failed — ${gone.name} left. Need ${total} brass (wages + bay + shops).`,
      };
    }
    return { ok: false, msg: `Bay upkeep due (${total} brass) — scale retail to cover empire costs.` };
  }
  inv.brass -= total;
  return {
    ok: true,
    msg: inv.workers.length
      ? `Upkeep −${total}b (crew wages ${wages} · bay L${inv.bayLevel} · ${ownedCityStallCount(inv)} shops)`
      : `Bay upkeep −${total} brass`,
  };
}

// ——— Bay expand ———

export const PARCEL_LEASE_COST = 25;
export const BAY_EXPAND_L2 = 50;
export const BAY_EXPAND_L3 = 100;

export function leaseParcel(inv: InventoryState): { ok: boolean; msg: string } {
  if (inv.parcelLeased || inv.bayLevel >= 1) {
    return expandBay(inv);
  }
  if (inv.brass < PARCEL_LEASE_COST) {
    return { ok: false, msg: `Need ${PARCEL_LEASE_COST} brass to lease.` };
  }
  inv.brass -= PARCEL_LEASE_COST;
  inv.parcelLeased = true;
  inv.bayLevel = 1;
  return {
    ok: true,
    msg: `Leased Starter Bay · −${PARCEL_LEASE_COST} brass. Expand again here later for more pads & workers.`,
  };
}

/**
 * Market training (pre-apartment) caps at Workshop Wing (L3).
 * Infinite empire expands unlock after the apartment deed (true sky city).
 */
export const TRAINING_MAX_BAY_LEVEL = 3;

export function canEmpireExpand(inv: InventoryState): boolean {
  return inv.apartmentOwned || inv.cityWorkshopLeased;
}

export function expandBay(inv: InventoryState): { ok: boolean; msg: string } {
  if (!inv.parcelLeased || inv.bayLevel < 1) {
    return { ok: false, msg: 'Lease a starter bay first.' };
  }
  const from = inv.bayLevel;
  // Training sandbox: do not allow empire-scale expands before apartment
  if (!canEmpireExpand(inv) && from >= TRAINING_MAX_BAY_LEVEL) {
    return {
      ok: false,
      msg: `Workshop Wing is max in market training. Earn ${APARTMENT_COST} brass → buy your apartment (east) for the full city and unlimited expands.`,
    };
  }
  const cost = expandBayCost(from);
  if (inv.brass < cost) {
    return {
      ok: false,
      msg: canEmpireExpand(inv)
        ? `Need ${cost} brass to expand to ${bayLevelName(from + 1)} (empire scale gets expensive).`
        : `Need ${cost} brass to expand to ${bayLevelName(from + 1)}.`,
    };
  }
  inv.brass -= cost;
  inv.bayLevel = from + 1;
  const slots = maxWorkersForBay(inv.bayLevel);
  if (inv.bayLevel === 2) {
    return {
      ok: true,
      msg: `Expanded Pad · −${cost} brass. ${slots} worker slots. More floor to the west.`,
    };
  }
  if (inv.bayLevel === 3) {
    return {
      ok: true,
      msg: canEmpireExpand(inv)
        ? `Workshop Wing · −${cost} brass. ${slots} workers · invent unlocked. Expand again anytime.`
        : `Workshop Wing · −${cost} brass. ${slots} workers · invent unlocked. Buy your apartment for unlimited empire expands.`,
    };
  }
  return {
    ok: true,
    msg: `${bayLevelName(inv.bayLevel)} · −${cost} brass. Worker slots: ${slots}. Expand again at Sky Foundry yards — no hard cap.`,
  };
}

// ——— Broker / repair ———

export const FRAME_BROKER_PRICE = 75;

export function sellFrameToBroker(inv: InventoryState): {
  ok: boolean;
  msg: string;
  gained: number;
} {
  if (!inv.assembledFrames) inv.assembledFrames = [];
  if (inv.assembledFrames.length < 1) {
    return { ok: false, msg: 'No assembled frames to sell. Build one at the workbench slots.', gained: 0 };
  }
  // Sell the highest-value chassis first
  inv.assembledFrames.sort((a, b) => b.sellValue - a.sellValue);
  const frame = inv.assembledFrames.shift()!;
  const gained = Math.max(FRAME_BROKER_PRICE, frame.sellValue);
  inv.brass += gained;
  inv.framesSold += 1;
  inv.brokerFrameStock = Math.min(12, (inv.brokerFrameStock ?? 0) + 1);
  notePeakBrass(inv);
  return {
    ok: true,
    gained,
    msg: `Sold ${frame.name} for ${gained} brass. Broker stock ${inv.brokerFrameStock}.`,
  };
}

export const REPAIR_PAY = 18;

export function completeRepair(inv: InventoryState): { ok: boolean; msg: string } {
  if (getQty(inv, 'repair_kit') < 1) {
    return { ok: false, msg: 'Need a Repair Kit (craft at bay: wire + scrap).' };
  }
  removeItem(inv, 'repair_kit', 1);
  inv.brass += REPAIR_PAY;
  inv.repairsDone += 1;
  return {
    ok: true,
    msg: `Repair complete · +${REPAIR_PAY} brass · jobs done: ${inv.repairsDone}`,
  };
}

// ——— Surfboard shop ———

export const BOARD_BASE_COST = 55;
export const BOARD_THRUSTER_COST = 30;
export const BOARD_RAILS_COST = 25;
export const BOARD_DECK_COST = 20;

export function buyPlayerBoard(inv: InventoryState): { ok: boolean; msg: string } {
  if (inv.playerBoard.owned) return { ok: false, msg: 'You already own a market board base.' };
  if (inv.brass < BOARD_BASE_COST) {
    return { ok: false, msg: `Need ${BOARD_BASE_COST} brass for a board chassis.` };
  }
  inv.brass -= BOARD_BASE_COST;
  inv.playerBoard.owned = true;
  return {
    ok: true,
    msg: `Board base purchased (−${BOARD_BASE_COST}). Upgrade thruster, rails, deck here.`,
  };
}

export function upgradePlayerBoard(
  inv: InventoryState,
  part: 'thruster' | 'rails' | 'deck',
): { ok: boolean; msg: string } {
  if (!inv.playerBoard.owned) {
    return { ok: false, msg: 'Buy a board base first.' };
  }
  if (part === 'thruster') {
    if (inv.playerBoard.thruster) return { ok: false, msg: 'Thruster already fitted.' };
    if (inv.brass < BOARD_THRUSTER_COST) {
      return { ok: false, msg: `Need ${BOARD_THRUSTER_COST} brass.` };
    }
    inv.brass -= BOARD_THRUSTER_COST;
    inv.playerBoard.thruster = true;
    return { ok: true, msg: `Thruster fitted (−${BOARD_THRUSTER_COST}). Walk speed up on market.` };
  }
  if (part === 'rails') {
    if (inv.playerBoard.rails) return { ok: false, msg: 'Rails already fitted.' };
    if (inv.brass < BOARD_RAILS_COST) return { ok: false, msg: `Need ${BOARD_RAILS_COST} brass.` };
    inv.brass -= BOARD_RAILS_COST;
    inv.playerBoard.rails = true;
    return { ok: true, msg: `Grip rails fitted (−${BOARD_RAILS_COST}).` };
  }
  if (inv.playerBoard.deck) return { ok: false, msg: 'Deck already upgraded.' };
  if (inv.brass < BOARD_DECK_COST) return { ok: false, msg: `Need ${BOARD_DECK_COST} brass.` };
  inv.brass -= BOARD_DECK_COST;
  inv.playerBoard.deck = true;
  return { ok: true, msg: `Reinforced deck (−${BOARD_DECK_COST}). Status flex, future race use.` };
}

export function playerWalkSpeedMul(inv: InventoryState): number {
  if (!inv.playerBoard.owned) return 1;
  let m = 1.12;
  if (inv.playerBoard.thruster) m += 0.18;
  if (inv.playerBoard.rails) m += 0.08;
  return m;
}

/** Max board speed multiplier for market ride */
export function playerBoardSpeedMul(inv: InventoryState): number {
  if (!inv.playerBoard.owned) return 1;
  let m = 0.72; // market is slower than race track
  if (inv.playerBoard.thruster) m += 0.22;
  if (inv.playerBoard.rails) m += 0.08;
  if (inv.playerBoard.deck) m += 0.05;
  return m;
}

// ——— Light invention (constrained) ———

/** Materials allowed at the invent desk — include gear/wire/fuel so slot-fit inventions are reachable. */
export const INVENT_MATERIAL_IDS: CommodityId[] = [
  'cloud_iron',
  'scrap_brass',
  'spore_silk',
  'sky_salt',
  'wire',
  'polished_wire',
  'gear_blank',
  'fuel_cell',
];

const INVENT_NAME_PREFIX: Partial<Record<CommodityId, string>> = {
  gear_blank: 'Gear',
  wire: 'Wire',
  polished_wire: 'Gleam',
  fuel_cell: 'Cell',
  cloud_iron: 'Iron',
  scrap_brass: 'Brass',
  spore_silk: 'Silk',
  sky_salt: 'Salt',
  glass_pane: 'Glass',
};

const INVENT_NAME_SUFFIX: Partial<Record<CommodityId, string>> = {
  gear_blank: 'works',
  wire: 'filament',
  polished_wire: 'lace',
  fuel_cell: 'core',
  cloud_iron: 'plate',
  scrap_brass: 'coil',
  spore_silk: 'weave',
  sky_salt: 'crystal',
  glass_pane: 'lens',
};

function inventNameFromMats(a: CommodityId, b: CommodityId, index: number): string {
  const left = INVENT_NAME_PREFIX[a] ?? COMMODITIES[a].name.split(/\s+/).pop() ?? 'Proto';
  const right = INVENT_NAME_SUFFIX[b] ?? COMMODITIES[b].name.split(/\s+/).pop()?.toLowerCase() ?? 'part';
  const base = `${left}${right.charAt(0).toUpperCase()}${right.slice(1)}`;
  return index > 0 ? `${base} ${index + 1}` : base;
}

/** Human-readable frame slots an invention can fill (for UI toasts). */
export function inventSlotBlurb(a: CommodityId, b: CommodityId): string {
  const slots = inventionFrameSlots({
    inputs: [
      { id: a, n: 1 },
      { id: b, n: 1 },
    ],
  });
  const labels: Record<string, string> = {
    chassis: 'Chassis',
    mechanisms: 'Mechanisms',
    power: 'Power',
    wiring: 'Wiring',
    personality: 'Personality',
  };
  return slots.map((s) => labels[s] ?? s).join(' · ');
}

export function inventCustomRecipe(
  inv: InventoryState,
  a: CommodityId,
  b: CommodityId,
): { ok: boolean; msg: string; recipe?: CustomRecipe } {
  if (!canInvent(inv)) {
    return {
      ok: false,
      msg: 'Invention needs Workshop Wing (bay L3+) or a leased city workshop.',
    };
  }
  if (a === b) return { ok: false, msg: 'Pick two different materials.' };
  if (!INVENT_MATERIAL_IDS.includes(a) || !INVENT_MATERIAL_IDS.includes(b)) {
    return { ok: false, msg: 'Those materials can’t be prototyped at this desk.' };
  }
  if (getQty(inv, a) < 2 || getQty(inv, b) < 2) {
    return { ok: false, msg: 'Need 2 of each input material to prototype.' };
  }
  // Soft cost: later inventions need a brass lab fee (full market cycle funding)
  const labFee = 15 + inv.customRecipes.length * 12;
  if (inv.brass < labFee) {
    return { ok: false, msg: `Lab fee ${labFee} brass for next prototype (you have ${inv.brass}).` };
  }
  // Cost prototype mats + lab
  removeItem(inv, a, 2);
  removeItem(inv, b, 2);
  inv.brass -= labFee;
  const name = inventNameFromMats(a, b, inv.customRecipes.length);
  // Quality rises with bay level & prior inventions (premium plazas pay more)
  const quality = Math.min(3, 1 + Math.floor(inv.bayLevel / 4) + (inv.customRecipes.length >= 4 ? 1 : 0));
  const sellValue = Math.round(
    (COMMODITIES[a].baseBuy + COMMODITIES[b].baseBuy) * (2.8 + quality * 0.35) + 12 + inv.bayLevel * 2,
  );
  const recipe: CustomRecipe = {
    id: `inv_${Date.now()}_${inv.customRecipes.length}`,
    name,
    inputs: [
      { id: a, n: 1 },
      { id: b, n: 1 },
    ],
    sellValue,
    quality,
  };
  inv.customRecipes.push(recipe);
  inv.inventionsMade = (inv.inventionsMade ?? 0) + 1;
  const slotBlurb = inventSlotBlurb(a, b);
  return {
    ok: true,
    recipe,
    msg: `Invented ${name} (Q${quality}, ~${sellValue}b). Fits frame slots: ${slotBlurb}. Craft → assemble or stock stalls.`,
  };
}

export function craftCustom(
  inv: InventoryState,
  recipeId: string,
): { ok: boolean; msg: string } {
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.' };
  if (!inv.parcelLeased) return { ok: false, msg: 'Need a bay.' };
  for (const inp of recipe.inputs) {
    if (getQty(inv, inp.id) < inp.n) {
      return { ok: false, msg: `Missing ${COMMODITIES[inp.id].name} for ${recipe.name}.` };
    }
  }
  for (const inp of recipe.inputs) {
    removeItem(inv, inp.id, inp.n);
  }
  if (!addInventionStock(inv, recipe.id, 1)) {
    // Refund inputs if invent stock is full
    for (const inp of recipe.inputs) {
      addItem(inv, inp.id, inp.n);
    }
    return {
      ok: false,
      msg: `Invention storage full (${effectiveInventionStack(inv)}). Expand at Aether Spire.`,
    };
  }
  return { ok: true, msg: `Crafted 1× ${recipe.name}` };
}

export function sellCustomToVendor(
  inv: InventoryState,
  recipeId: string,
): { ok: boolean; msg: string; gained: number } {
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.', gained: 0 };
  const n = inv.customStock[recipeId] ?? 0;
  if (n < 1) return { ok: false, msg: `No ${recipe.name} in stock.`, gained: 0 };
  inv.customStock[recipeId] = n - 1;
  if (inv.customStock[recipeId]! <= 0) delete inv.customStock[recipeId];
  inv.brass += recipe.sellValue;
  return {
    ok: true,
    gained: recipe.sellValue,
    msg: `Sold ${recipe.name} for ${recipe.sellValue} brass.`,
  };
}

// ——— Inventory helpers ———

export function getQty(inv: InventoryState, id: CommodityId): number {
  return inv.items[id] ?? 0;
}

export function addItem(inv: InventoryState, id: CommodityId, n: number): boolean {
  if (n <= 0) return true;
  const cur = getQty(inv, id);
  const next = Math.min(effectiveStack(inv, id), cur + n);
  inv.items[id] = next;
  return next === cur + n;
}

export function addInventionStock(inv: InventoryState, recipeId: string, n = 1): boolean {
  if (n <= 0) return true;
  const cur = inv.customStock[recipeId] ?? 0;
  const next = Math.min(effectiveInventionStack(inv), cur + n);
  inv.customStock[recipeId] = next;
  return next === cur + n;
}

export function removeItem(inv: InventoryState, id: CommodityId, n: number): boolean {
  const cur = getQty(inv, id);
  if (cur < n) return false;
  const left = cur - n;
  if (left <= 0) delete inv.items[id];
  else inv.items[id] = left;
  return true;
}

// ——— Vendors ———

export interface VendorDef {
  id: string;
  name: string;
  title: string;
  buyMul: number;
  sellMul: number;
  stock: CommodityId[];
  greeting: string;
}

export const VENDORS: VendorDef[] = [
  {
    id: 'mira',
    name: 'Mira Cole',
    title: 'General Goods',
    buyMul: 1.0,
    sellMul: 1.0,
    stock: ['cloud_iron', 'scrap_brass', 'sky_salt', 'wire', 'glass_pane', 'brass_charm', 'flower_gift'],
    greeting: 'Cloud iron’s steady today. Charms and blooms for the Arcade girls.',
  },
  {
    id: 'hark',
    name: 'Hark Voss',
    title: 'Scrap & Gears',
    buyMul: 1.15,
    sellMul: 0.95,
    stock: [
      'scrap_brass',
      'gear_blank',
      'wire',
      'fuel_cell',
      'repair_kit',
      'speed_tool',
      'polished_wire',
      'bloom_brass',
      'bloom_sky',
    ],
    greeting: 'Bring me scrap. I’ll pay fair — for scrap. Flowers for personality cores, too.',
  },
  {
    id: 'sela',
    name: 'Sela Quinn',
    title: 'Silk & Soft Goods',
    buyMul: 1.1,
    sellMul: 1.05,
    stock: ['spore_silk', 'sky_salt', 'glass_pane', 'haul_pack', 'flower_gift', 'silk_scarf'],
    greeting: 'Spore silk from the reefs? I’ll take every spool. Gifts for someone special?',
  },
  {
    id: 'dock',
    name: 'Ferry Clerk Jon',
    title: 'Dock Exchange',
    buyMul: 0.9,
    sellMul: 1.1,
    stock: ['fuel_cell', 'cloud_iron', 'scrap_brass', 'sky_salt'],
    greeting: 'Quick trades for haulers. Prices favor the dock, not you.',
  },
];

export function vendorBuyPrice(v: VendorDef, id: CommodityId): number {
  return Math.max(1, Math.round(COMMODITIES[id].baseBuy * v.buyMul));
}

export function vendorSellPrice(v: VendorDef, id: CommodityId): number {
  return Math.max(1, Math.round(COMMODITIES[id].baseSell * v.sellMul));
}

export function sellToVendor(
  inv: InventoryState,
  v: VendorDef,
  id: CommodityId,
  qty: number,
): { ok: boolean; gained: number; msg: string } {
  if (!v.stock.includes(id)) return { ok: false, gained: 0, msg: 'They don’t buy that.' };
  if (qty < 1 || getQty(inv, id) < qty) return { ok: false, gained: 0, msg: 'Not enough goods.' };
  const unit = vendorBuyPrice(v, id);
  const gained = unit * qty;
  removeItem(inv, id, qty);
  inv.brass += gained;
  noteMarketSupply(inv, id, qty);
  return { ok: true, gained, msg: `Sold ${qty}× ${COMMODITIES[id].name} for ${gained} brass.` };
}

export function buyFromVendor(
  inv: InventoryState,
  v: VendorDef,
  id: CommodityId,
  qty: number,
): { ok: boolean; spent: number; msg: string } {
  if (!v.stock.includes(id)) return { ok: false, spent: 0, msg: 'Not in stock.' };
  if (qty < 1) return { ok: false, spent: 0, msg: 'Invalid amount.' };
  const unit = vendorSellPrice(v, id);
  const spent = unit * qty;
  if (inv.brass < spent) return { ok: false, spent: 0, msg: 'Not enough brass.' };
  if (!addItem(inv, id, qty)) return { ok: false, spent: 0, msg: 'Inventory full for that good.' };
  inv.brass -= spent;
  noteMarketDemand(inv, id, qty);
  return { ok: true, spent, msg: `Bought ${qty}× ${COMMODITIES[id].name} for ${spent} brass.` };
}

// ——— Save ———

function stallToSave(s: StallState) {
  return {
    owned: s.owned,
    open: s.open,
    shelf: { ...s.shelf },
    customShelf: { ...(s.customShelf ?? {}) },
    frameShelf: (s.frameShelf ?? []).map((f) => ({ ...f, slots: { ...f.slots } })),
    asks: { ...s.asks },
    customAsks: { ...(s.customAsks ?? {}) },
    autoFrames: s.autoFrames,
    autoHarvest: s.autoHarvest,
    autoWire: s.autoWire,
    autoInvent: !!s.autoInvent,
    sales: s.sales,
    earned: s.earned,
    lastDemand: s.lastDemand,
    pendingHaggle: s.pendingHaggle ? { ...s.pendingHaggle } : null,
    layout: s.layout
      ? {
          ...s.layout,
          props: (s.layout.props ?? []).map((p) => ({ ...p })),
        }
      : null,
    layoutPaid: s.layoutPaid ?? 0,
  };
}

function stallFromSave(s: Partial<StallState> | undefined): StallState {
  const base = emptyStall();
  if (!s || typeof s !== 'object') return base;
  base.owned = !!s.owned;
  base.open = !!s.open;
  base.shelf = s.shelf && typeof s.shelf === 'object' ? { ...s.shelf } : {};
  base.customShelf =
    s.customShelf && typeof s.customShelf === 'object' ? { ...s.customShelf } : {};
  base.frameShelf = Array.isArray((s as StallState).frameShelf)
    ? ((s as StallState).frameShelf as AssembledFrame[]).map((f) => ({
        ...f,
        slots: { ...f.slots },
      }))
    : [];
  base.asks = s.asks && typeof s.asks === 'object' ? { ...s.asks } : {};
  base.customAsks =
    (s as StallState).customAsks && typeof (s as StallState).customAsks === 'object'
      ? { ...(s as StallState).customAsks }
      : {};
  base.autoFrames = s.autoFrames !== false;
  base.autoHarvest = !!s.autoHarvest;
  base.autoWire = !!s.autoWire;
  base.autoInvent = !!s.autoInvent;
  base.sales = typeof s.sales === 'number' ? s.sales : 0;
  base.earned = typeof s.earned === 'number' ? s.earned : 0;
  base.lastDemand = typeof s.lastDemand === 'string' ? s.lastDemand : 'Steady';
  base.pendingHaggle =
    s.pendingHaggle && typeof s.pendingHaggle === 'object'
      ? {
          id: (s.pendingHaggle as { id: CommodityId }).id,
          offer: Number((s.pendingHaggle as { offer: number }).offer) || 1,
          ask: Number((s.pendingHaggle as { ask: number }).ask) || 1,
          fair: Number((s.pendingHaggle as { fair: number }).fair) || 1,
          ttl: Number((s.pendingHaggle as { ttl: number }).ttl) || 1,
        }
      : null;
  base.layoutPaid = typeof s.layoutPaid === 'number' ? s.layoutPaid : 0;
  if (s.layout && typeof s.layout === 'object') {
    const L = s.layout as StallLayout;
    const tier = (['bench', 'shade', 'shop', 'large'] as StallTier[]).includes(L.tier as StallTier)
      ? (L.tier as StallTier)
      : 'bench';
    let props: SiteProp[] = Array.isArray(L.props)
      ? L.props.map((p) => ({
          id: String(p.id ?? 'crates'),
          lx: Number(p.lx) || 0,
          lz: Number(p.lz) || 0,
          yaw: Number(p.yaw) || 0,
        }))
      : [];
    if (!props.length && L.decor) {
      const ids = ['crates', 'banners', 'lanterns', 'planters', 'signboard'];
      for (let i = 0; i < Math.min(5, Number(L.decor) || 0); i++) {
        props.push({ id: ids[i]!, lx: -2.2 + i * 1.1, lz: -2.4, yaw: 0 });
      }
    }
    base.layout = {
      plotX: Number(L.plotX) || 0,
      plotZ: Number(L.plotZ) || 0,
      yaw: Number(L.yaw) || 0,
      tier,
      color: Math.max(0, Math.min(5, Number(L.color) || 0)),
      props,
      built: !!L.built,
    };
  } else {
    base.layout = null;
  }
  return base;
}

function factoryLayoutToSave(L: FactoryLayout | null | undefined) {
  if (!L) return null;
  return {
    plotX: L.plotX,
    plotZ: L.plotZ,
    yaw: L.yaw,
    form: L.form,
    props: (L.props ?? []).map((p) => ({ ...p })),
    built: !!L.built,
  };
}

function factoryLayoutFromSave(raw: unknown): FactoryLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const L = raw as FactoryLayout;
  const form = (['horizontal', 'tall', 'boiler_yard'] as FactoryForm[]).includes(L.form as FactoryForm)
    ? (L.form as FactoryForm)
    : 'horizontal';
  return {
    plotX: Number(L.plotX) || 0,
    plotZ: Number(L.plotZ) || 0,
    yaw: Number(L.yaw) || 0,
    form,
    props: Array.isArray(L.props)
      ? L.props.map((p) => ({
          id: String(p.id ?? 'pipe_run'),
          lx: Number(p.lx) || 0,
          lz: Number(p.lz) || 0,
          yaw: Number(p.yaw) || 0,
        }))
      : [],
    built: !!L.built,
  };
}

export function invToSave(inv: InventoryState) {
  const cityStalls: Record<string, ReturnType<typeof stallToSave>> = {};
  if (inv.cityStalls) {
    for (const [k, s] of Object.entries(inv.cityStalls)) {
      cityStalls[k] = stallToSave(s);
    }
  }
  return {
    brass: inv.brass,
    aether: inv.aether,
    items: { ...inv.items },
    parcelLeased: inv.parcelLeased,
    bayLevel: inv.bayLevel,
    harvestRuns: inv.harvestRuns,
    laborerHired: inv.laborerHired,
    framesSold: inv.framesSold,
    repairsDone: inv.repairsDone,
    workers: inv.workers.map((w) => ({ ...w, payGrade: w.payGrade ?? 0 })),
    playerBoard: { ...inv.playerBoard },
    customRecipes: inv.customRecipes.map((r) => ({
      ...r,
      inputs: r.inputs.map((i) => ({ ...i })),
      quality: r.quality ?? 1,
    })),
    customStock: { ...inv.customStock },
    programs: inv.programs.map((p) => ({
      id: p.id,
      name: p.name,
      nodes: [...p.nodes],
    })),
    stall: stallToSave(inv.stall),
    cityStalls,
    marketPressure: { ...inv.marketPressure },
    apartmentOwned: inv.apartmentOwned,
    peakBrass: inv.peakBrass,
    cityWorkshopLeased: inv.cityWorkshopLeased,
    inventionsMade: inv.inventionsMade ?? 0,
    inventionsSold: inv.inventionsSold ?? 0,
    assembledFrames: (inv.assembledFrames ?? []).map((f) => ({
      ...f,
      slots: { ...f.slots },
    })),
    storageResourcesLevel: inv.storageResourcesLevel ?? 0,
    storageCraftedLevel: inv.storageCraftedLevel ?? 0,
    storageInventionsLevel: inv.storageInventionsLevel ?? 0,
    brokerFrameStock: inv.brokerFrameStock ?? 0,
    medallionLoose: !!inv.medallionLoose,
    medallionHostId: inv.medallionHostId ?? null,
    placements: inv.placements.map((p) => ({ ...p })),
    relationships: inv.relationships.map((r) => ({ ...r })),
    storageLayouts: {
      resources: factoryLayoutToSave(inv.storageLayouts?.resources) ?? undefined,
      crafted: factoryLayoutToSave(inv.storageLayouts?.crafted) ?? undefined,
      inventions: factoryLayoutToSave(inv.storageLayouts?.inventions) ?? undefined,
    },
    storageLayoutPaid: { ...(inv.storageLayoutPaid ?? {}) },
    bayWingLayout: factoryLayoutToSave(inv.bayWingLayout),
    bayWingLayoutPaid: inv.bayWingLayoutPaid ?? 0,
  };
}

export function invFromSave(raw: unknown, fallbackBrass = 40): InventoryState {
  if (!raw || typeof raw !== 'object') return emptyInventory(fallbackBrass);
  const o = raw as Record<string, unknown>;
  const inv = emptyInventory(0);
  inv.brass = typeof o.brass === 'number' ? o.brass : fallbackBrass;
  inv.aether = typeof o.aether === 'number' ? o.aether : 0;
  inv.parcelLeased = !!o.parcelLeased;
  inv.bayLevel =
    typeof o.bayLevel === 'number'
      ? o.bayLevel
      : inv.parcelLeased
        ? 1
        : 0;
  if (inv.parcelLeased && inv.bayLevel < 1) inv.bayLevel = 1;
  inv.harvestRuns = typeof o.harvestRuns === 'number' ? o.harvestRuns : 0;
  inv.framesSold = typeof o.framesSold === 'number' ? o.framesSold : 0;
  inv.repairsDone = typeof o.repairsDone === 'number' ? o.repairsDone : 0;
  if (o.items && typeof o.items === 'object') {
    inv.items = { ...(o.items as InventoryState['items']) };
  }
  if (Array.isArray(o.workers)) {
    inv.workers = (o.workers as WorkerState[]).map((w) => ({
      id: String(w.id ?? `w_${Math.random()}`),
      name: String(w.name ?? 'Worker'),
      job: (w.job as JobId) || 'harvest',
      programId: w.programId ? String(w.programId) : null,
      hasBoard: !!w.hasBoard,
      hasSpeedTool: !!w.hasSpeedTool,
      hasHaulPack: !!w.hasHaulPack,
      jobsDone: typeof w.jobsDone === 'number' ? w.jobsDone : 0,
      payGrade: typeof w.payGrade === 'number' ? w.payGrade : 0,
      harvestSiteId:
        typeof w.harvestSiteId === 'string' && w.harvestSiteId
          ? String(w.harvestSiteId)
          : null,
      kind: w.kind === 'robot' ? 'robot' : 'human',
      hasMedallion: !!w.hasMedallion,
      frameId: w.frameId ? String(w.frameId) : null,
      frameName: w.frameName ? String(w.frameName) : null,
      frameQuality: typeof w.frameQuality === 'number' ? w.frameQuality : undefined,
      frameSpeedMul: typeof w.frameSpeedMul === 'number' ? w.frameSpeedMul : undefined,
      frameWorkMul: typeof w.frameWorkMul === 'number' ? w.frameWorkMul : undefined,
      frameHarvestMul: typeof w.frameHarvestMul === 'number' ? w.frameHarvestMul : undefined,
      frameProgramBonus: typeof w.frameProgramBonus === 'number' ? w.frameProgramBonus : undefined,
    }));
  } else if (o.laborerHired) {
    // Migrate Phase 1 single laborer
    inv.workers = [
      {
        id: 'w_legacy',
        name: 'Rook',
        job: 'harvest',
        programId: null,
        hasBoard: false,
        hasSpeedTool: false,
        hasHaulPack: false,
        jobsDone: 0,
        payGrade: 0,
        harvestSiteId: null,
      },
    ];
  } else {
    inv.workers = inv.workers.map((w) => ({
      ...w,
      programId: w.programId ?? null,
      job: w.job || 'harvest',
      jobsDone: w.jobsDone ?? 0,
      payGrade: w.payGrade ?? 0,
      harvestSiteId: w.harvestSiteId ?? null,
    }));
  }
  inv.laborerHired = inv.workers.length > 0;
  if (o.playerBoard && typeof o.playerBoard === 'object') {
    const b = o.playerBoard as PlayerBoardState;
    inv.playerBoard = {
      owned: !!b.owned,
      thruster: !!b.thruster,
      rails: !!b.rails,
      deck: !!b.deck,
    };
  }
  if (Array.isArray(o.customRecipes)) {
    inv.customRecipes = (o.customRecipes as CustomRecipe[]).map((r) => ({
      ...r,
      quality: r.quality ?? 1,
    }));
  }
  if (o.customStock && typeof o.customStock === 'object') {
    inv.customStock = { ...(o.customStock as Record<string, number>) };
  }
  if (o.stall && typeof o.stall === 'object') {
    inv.stall = stallFromSave(o.stall as StallState);
  }
  inv.cityStalls = {};
  if (o.cityStalls && typeof o.cityStalls === 'object') {
    for (const [k, v] of Object.entries(o.cityStalls as Record<string, StallState>)) {
      inv.cityStalls[k] = stallFromSave(v);
    }
  }
  if (o.marketPressure && typeof o.marketPressure === 'object') {
    inv.marketPressure = { ...(o.marketPressure as MarketPressure) };
  }
  inv.apartmentOwned = !!o.apartmentOwned;
  inv.peakBrass = typeof o.peakBrass === 'number' ? o.peakBrass : inv.brass;
  inv.cityWorkshopLeased = !!o.cityWorkshopLeased;
  inv.inventionsMade = typeof o.inventionsMade === 'number' ? o.inventionsMade : inv.customRecipes.length;
  inv.inventionsSold = typeof o.inventionsSold === 'number' ? o.inventionsSold : 0;
  inv.assembledFrames = Array.isArray(o.assembledFrames)
    ? (o.assembledFrames as AssembledFrame[]).map((f) => ({
        ...f,
        slots: { ...f.slots },
      }))
    : [];
  // Migrate legacy commodity frames → assembled chassis
  convertLegacyFrames(inv);
  inv.storageResourcesLevel =
    typeof o.storageResourcesLevel === 'number' ? Math.max(0, Math.min(STORAGE_MAX_LEVEL, o.storageResourcesLevel)) : 0;
  inv.storageCraftedLevel =
    typeof o.storageCraftedLevel === 'number' ? Math.max(0, Math.min(STORAGE_MAX_LEVEL, o.storageCraftedLevel)) : 0;
  inv.storageInventionsLevel =
    typeof o.storageInventionsLevel === 'number'
      ? Math.max(0, Math.min(STORAGE_MAX_LEVEL, o.storageInventionsLevel))
      : 0;
  // Clamp pre-apartment training bays (empire expands only after deed / city workshop)
  if (!canEmpireExpand(inv) && inv.bayLevel > TRAINING_MAX_BAY_LEVEL) {
    inv.bayLevel = TRAINING_MAX_BAY_LEVEL;
  }
  if (Array.isArray(o.programs) && (o.programs as WorkerProgram[]).length) {
    inv.programs = (o.programs as WorkerProgram[]).map((p) => ({
      id: String(p.id),
      name: String(p.name ?? 'Program'),
      nodes: Array.isArray(p.nodes) ? [...p.nodes] : ['harvest', 'return_bay'],
    }));
  }
  inv.brokerFrameStock = typeof o.brokerFrameStock === 'number' ? o.brokerFrameStock : 0;
  inv.medallionLoose = !!o.medallionLoose;
  inv.medallionHostId = typeof o.medallionHostId === 'string' ? o.medallionHostId : null;
  inv.placements = Array.isArray(o.placements) ? (o.placements as PlacementRecord[]).map((p) => ({ ...p })) : [];
  inv.relationships = Array.isArray(o.relationships)
    ? (o.relationships as RomanceState[]).map((r) => ({
        npcId: String(r.npcId),
        stage: (Math.max(0, Math.min(4, Number(r.stage) || 0)) as RelationshipStage),
        affinity: Number(r.affinity) || 0,
        giftsGiven: Number(r.giftsGiven) || 0,
      }))
    : [];
  inv.storageLayouts = {};
  inv.storageLayoutPaid = {};
  if (o.storageLayouts && typeof o.storageLayouts === 'object') {
    const sl = o.storageLayouts as Record<string, unknown>;
    for (const track of ['resources', 'crafted', 'inventions'] as StorageTrack[]) {
      const L = factoryLayoutFromSave(sl[track]);
      if (L) inv.storageLayouts[track] = L;
    }
  }
  if (o.storageLayoutPaid && typeof o.storageLayoutPaid === 'object') {
    inv.storageLayoutPaid = { ...(o.storageLayoutPaid as InventoryState['storageLayoutPaid']) };
  }
  inv.bayWingLayout = factoryLayoutFromSave(o.bayWingLayout);
  inv.bayWingLayoutPaid = typeof o.bayWingLayoutPaid === 'number' ? o.bayWingLayoutPaid : 0;
  return inv;
}
