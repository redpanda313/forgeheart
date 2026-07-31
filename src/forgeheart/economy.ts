/**
 * Sky City economy — Phase 0–3 empire scale.
 * Inventory, craft, hire, unlimited bay expansion, multi-plaza stalls,
 * invention → craft → retail market cycle, worker pay grades for long programs.
 * Local-only; server later.
 */

import type { AssembledFrame, FlowerId } from './frameAssembly';
import {
  tryAutoAssembleFrame,
  convertLegacyFrames,
  makeLegacyAssembledFrame,
  inventionFrameSlots,
  inventionFitsSlot,
  FLOWER_IDS,
} from './frameAssembly';
import {
  generateRomancePersona,
  ROMANCE_ARCHETYPES,
  formatPlayerStoryBeat,
  storyTellSeed,
  type GeneratedRomancePersona,
  type RomanceStoryId as GenRomanceStoryId,
  type PlayerStoryContext,
} from './romanceGen';
import {
  emptyNeighborLife,
  ensureNeighborLife,
  neighborLifeToSave,
  neighborLifeFromSave,
  neighborDef,
  dramaLabel,
  neighborStatusLine,
  NEIGHBOR_GIFT_IDS,
  rentIncomeForPad,
  quoteNeighborPadPrice,
  PREDATORY_LEAVE_CHANCE,
  landlordById,
  type NeighborLifeState,
  type NeighborState,
  type RentPolicy,
  type TenantOffer,
} from './neighborLife';
import {
  emptyPlazaPlots,
  ensurePlazaPlots,
  plazaPlotsToSave,
  plazaPlotsFromSave,
  quotePlotBuyPrice,
  getPlot,
  collectPlotRents,
  plotsInDistrict,
  plotWorldCenter,
  plotOwnerLabel,
  plotMapColor,
  playerOwnedPlots,
  PLOT_GRID,
  plotId,
  PLOT_BUILD_CATALOG,
  quotePlotBuild,
  applyPlotBuild,
  hasAdjacentOwned,
  hasNearbyOwned,
  nearestOwnedPlot,
  rotatePlayerPlot,
  movePlotFree,
  listEdgeCandidates,
  createEdgePlot,
  plotPrimaryBuilding,
  plotHasBuild,
  plotRentIncome,
  plotLivePos,
  clampPlotWorld,
  clampLocalOnPlot,
  computeAutoBridges,
  bridgeEdgePoints,
  platformsSeparatedForBridge,
  plotPlatformHalf,
  platformFacingEdgeMid,
  bestCardinalSidePair,
  BRIDGE_WIDTH_MUL,
  setPlotShape,
  unlockPlotUpperDeck,
  linkPlotAirway,
  listAirwayTargets,
  listPlotAirways,
  quotePlotShapeChange,
  quotePlotLayerUpgrade,
  quotePlotAirwayLink,
  plotShapeLabel,
  PLOT_SHAPES,
  MAX_PLOT_LAYER,
  hasPlotAirway,
  ensureGardenSpots,
  GARDEN_SPOT_COUNT,
  gardenSpotLocalOffsets,
  plotEmptyTax,
  plotStructureUpkeep,
  plotIsEmptyHolding,
  type PlazaPlotsState,
  type PlotState,
  type DistrictLite,
  type ZoningHint,
  type PlotBuildKind,
  type PlotShape,
  type PlotAirwayLink,
} from './plazaPlots';
import {
  listFillablePlayerPlots,
  restockPlotRetail,
  factoryPlotIncome,
  plotHasRetail,
  plotHasFactory,
  plotHasHousing,
  defaultHousingOfferPolicy,
  housingOfferRent,
  type PlotFillOffer,
  PLOT_RETAIL_STOCK_POOL,
} from './plotUse';

export type {
  NeighborLifeState,
  NeighborState,
  RentPolicy,
  DramaKind,
  LandlordDebt,
  NeighborDef,
  TenantOffer,
} from './neighborLife';
export {
  NEIGHBOR_DEFS,
  NEIGHBOR_RING_DEFS,
  PLAZA_HOMEOWNER_DEFS,
  LANDLORDS,
  neighborDef,
  homeownerNeighborId,
  homeownerDefForDistrict,
  dramaLabel,
  neighborStatusLine,
  neighborInteractLabel,
  neighborIsTalkable,
  NEIGHBOR_GIFT_IDS,
  landlordById,
  emptyNeighborLife,
  ensureNeighborLife,
  getNeighborState,
  rentIncomeForPad,
  quoteNeighborPadPrice,
  RENT_RATE_OF_VALUE,
} from './neighborLife';
import {
  combineMarketDemand,
  dominantStallNeed,
  stallStocksNeed,
  canGrantTalkAffinity,
  canGrantGiftAffinity,
  talkCooldownRemainingSec,
  giftCooldownRemainingSec,
  formatSalesDrivers,
  extraDramaLines,
  maybeBackstoryHook,
  softBackstoryMatch,
  NPC_LIVELIHOOD_FAIL_CHANCE,
  NPC_FAILS_BEFORE_HOMELESS,
  NPC_HOMELESS_DEBT_MUL,
  GIFT_MEANINGFUL_BRASS_MIN,
  type CustomerNeed,
  type StallStockSnap,
} from './marketSim';
export {
  formatSalesDrivers,
  CUSTOMER_NEED_LABEL,
  TALK_AFFINITY_COOLDOWN_MS,
  GIFT_AFFINITY_COOLDOWN_MS,
  type CustomerNeed,
  type MarketDemandBundle,
} from './marketSim';

export type CurrencyId = 'brass' | 'aether';

export type CommodityId =
  | 'cloud_iron'
  | 'scrap_brass'
  | 'spore_silk'
  | 'sky_salt'
  | 'speed_tool_fine'
  | 'haul_pack_fine'
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
  /** Tempered with a player invention — stronger work speed */
  speed_tool_fine: {
    id: 'speed_tool_fine',
    name: 'Tempered Rivet Spanner',
    baseBuy: 28,
    baseSell: 55,
    stack: 5,
  },
  haul_pack: {
    id: 'haul_pack',
    name: 'Haul Pack',
    baseBuy: 10,
    baseSell: 24,
    stack: 5,
  },
  /** Reinforced with a player invention — stronger reef yields */
  haul_pack_fine: {
    id: 'haul_pack_fine',
    name: 'Reinforced Haul Pack',
    baseBuy: 24,
    baseSell: 50,
    stack: 5,
  },
  elias_medallion: {
    id: 'elias_medallion',
    name: 'Soul Medallion',
    baseBuy: 0,
    baseSell: 0,
    stack: 1,
  },
  flower_gift: {
    id: 'flower_gift',
    name: 'Cloud Blooms',
    // Raw blooms ≈ sky salt (value is in gifting / crafts, not bulk sale)
    baseBuy: 2,
    baseSell: 5,
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
  // Plaza flowers: sell price matches sky salt when sold raw
  bloom_brass: {
    id: 'bloom_brass',
    name: 'Brass Petals',
    baseBuy: 2,
    baseSell: 5,
    stack: 40,
    harvestable: true,
  },
  bloom_sky: {
    id: 'bloom_sky',
    name: 'Skyblooms',
    baseBuy: 2,
    baseSell: 5,
    stack: 40,
    harvestable: true,
  },
  bloom_spore: {
    id: 'bloom_spore',
    name: 'Spore Lilies',
    baseBuy: 2,
    baseSell: 5,
    stack: 40,
    harvestable: true,
  },
  bloom_harbor: {
    id: 'bloom_harbor',
    name: 'Harbor Roses',
    baseBuy: 2,
    baseSell: 5,
    stack: 40,
    harvestable: true,
  },
  bloom_aether: {
    id: 'bloom_aether',
    name: 'Aether Orchids',
    baseBuy: 2,
    baseSell: 5,
    stack: 30,
    harvestable: true,
  },
};

export const COMMODITY_LIST = Object.values(COMMODITIES);

// ——— Jobs & workers ———

export type JobId =
  | 'idle'
  | 'harvest'
  | 'pick_flowers'
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
  | 'pick_flowers'
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
  /** Create a brand-new invention (needs Apprentice Inventor = pay grade 5) */
  | 'invent_recipe'
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
  | 'stock_stall_scrap'
  /** Stock chosen invention (program.inventionId) */
  | 'stock_stall_invention'
  /** Stock chosen commodity (program.stallCommodityId + stallStockQty) */
  | 'stock_stall_goods';

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
  {
    id: 'pick_flowers',
    name: 'Pick Flowers',
    blurb: 'Plaza blooms · personality mats',
    category: 'haul',
  },
  { id: 'return_bay', name: 'Return Bay', blurb: 'Walk home', category: 'haul' },
  // Craft — all workbench recipes (no unlock; needs leased bay)
  { id: 'craft_wire', name: 'Craft Wire', blurb: '2 scrap → wire', category: 'craft' },
  { id: 'craft_gear', name: 'Craft Gear Blank', blurb: 'iron + scrap → gear', category: 'craft' },
  { id: 'craft_kit', name: 'Craft Repair Kit', blurb: 'wire + scrap → kit', category: 'craft' },
  {
    id: 'craft_frame',
    name: 'Make Frame',
    blurb: 'Prep wire/gear from stock · fill five slots · assemble',
    category: 'craft',
  },
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
    name: 'Make Fine Frame',
    blurb: 'Legacy · same as Make Frame with Fine preference',
    category: 'craft',
  },
  {
    id: 'craft_custom',
    name: 'Craft Invention',
    blurb: 'Craft chosen invention from your book (set target in program)',
    category: 'craft',
  },
  {
    id: 'invent_recipe',
    name: 'Invent New Recipe',
    blurb: 'Prototype a new invention · needs Apprentice Inventor (pay G5)',
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
    id: 'stock_stall_invention',
    name: 'Stock Stall · Invention',
    blurb: 'Shelf your chosen invention (set target in program)',
    category: 'stall',
  },
  {
    id: 'stock_stall_goods',
    name: 'Stock Stall · Goods',
    blurb: 'Shelf chosen commodity qty (set target in program)',
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
  /** Preference for Make Frame nodes — serviceable stock vs fine parts */
  framePref?: 'service' | 'fine';
  /**
   * Invention recipe id for craft_custom / stock_stall_invention / sell_invention.
   * null = first recipe in the book.
   */
  inventionId?: string | null;
  /**
   * Commodity for stock_stall_goods (player-chosen stall restock).
   * null = wire default.
   */
  stallCommodityId?: CommodityId | null;
  /** Units moved onto stall per stock_stall_goods step (1–20). */
  stallStockQty?: number;
  /** Invent node: preferred material pair (null = auto-pick held invent mats). */
  inventMatA?: CommodityId | null;
  inventMatB?: CommodityId | null;
}

/** One-click program starters — balanced length, clear purpose. */
export type ProgramTemplateId =
  | 'frame_line'
  | 'frame_broker'
  | 'frame_stall'
  | 'harvest_loop'
  | 'flower_loop';

export interface ProgramTemplate {
  id: ProgramTemplateId;
  name: string;
  blurb: string;
  nodes: ProgramNodeKind[];
  framePref?: 'service' | 'fine';
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'frame_line',
    name: 'Frame Line',
    blurb: 'Reef → buy fuel → make frame → bay · 4 steps',
    nodes: ['harvest', 'buy_fuel_cell', 'craft_frame', 'return_bay'],
    framePref: 'service',
  },
  {
    id: 'frame_broker',
    name: 'Frame → Broker',
    blurb: 'Make frames & sell to broker · 5 steps',
    nodes: ['harvest', 'buy_fuel_cell', 'craft_frame', 'sell_frame', 'return_bay'],
    framePref: 'service',
  },
  {
    id: 'frame_stall',
    name: 'Frame → Stall',
    blurb: 'Make a frame & stock your stall · 4 steps',
    nodes: ['buy_fuel_cell', 'craft_frame', 'stock_stall_frame', 'return_bay'],
    framePref: 'service',
  },
  {
    id: 'harvest_loop',
    name: 'Harvest Loop',
    blurb: 'Reef haul home · 2 steps',
    nodes: ['harvest', 'return_bay'],
  },
  {
    id: 'flower_loop',
    name: 'Flower Loop',
    blurb: 'Pick plaza blooms · return · 2 steps',
    nodes: ['pick_flowers', 'return_bay'],
  },
];

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
    id: 'pick_flowers',
    name: 'Pick Flowers',
    blurb: 'Walk to plaza blooms, pick personality mats, return.',
    route: ['bay', 'flowers', 'bay'],
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
    blurb: 'Prep parts & assemble robot frames at the bench.',
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

/** 0 = none · 1 = basic craft · 2 = invention-tempered */
export type ToolTier = 0 | 1 | 2;

export interface WorkerState {
  id: string;
  name: string;
  job: JobId;
  /** When job === program */
  programId: string | null;
  hasBoard: boolean;
  /** Legacy flag — kept in sync with speedToolTier > 0 */
  hasSpeedTool: boolean;
  /** Legacy flag — kept in sync with haulToolTier > 0 */
  hasHaulPack: boolean;
  /** Rivet Spanner tier (0 none · 1 basic · 2 tempered with invention) */
  speedToolTier?: ToolTier;
  /** Haul Pack tier (0 none · 1 basic · 2 reinforced with invention) */
  haulToolTier?: ToolTier;
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
  /**
   * When set, only harvest this mat at the chosen plaza/reef.
   * null = all materials available at that site.
   */
  harvestMatId?: CommodityId | null;
  /**
   * When set, only pick this bloom type at the plaza (pick_flowers job/node).
   * null = all blooms available at the plaza.
   */
  flowerMatId?: CommodityId | null;
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
  /** True when upkeep failed — idle until brass covers wages again */
  unpaid?: boolean;
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
  /** Player asked what she likes */
  knownLikes?: boolean;
  /** Story beat ids already shared with her */
  storiesShared?: string[];
}

/** Items that can be offered as romance gifts (must be obtainable in-game). */
export const ROMANCE_GIFT_IDS = [
  'flower_gift',
  'brass_charm',
  'silk_scarf',
  'bloom_sky',
  'bloom_brass',
  'bloom_spore',
  'bloom_harbor',
  'bloom_aether',
  'polished_wire',
] as const satisfies readonly CommodityId[];

export type RomanceGiftId = (typeof ROMANCE_GIFT_IDS)[number];

/** Procedural romance persona (dialogue + bio); gift prefs stay archetype-stable. */
export type RomanceNpcDef = GeneratedRomancePersona;

/** Stable romance NPC ids in the empire city. */
export const ROMANCE_NPC_IDS = Object.keys(ROMANCE_ARCHETYPES);

/**
 * Build all romance personas for a playthrough seed.
 * Same seed → same names, jobs, chat — unique across playthroughs.
 */
export function getRomanceNpcs(worldSeed: number): Record<string, RomanceNpcDef> {
  const out: Record<string, RomanceNpcDef> = {};
  for (const id of ROMANCE_NPC_IDS) {
    out[id] = generateRomancePersona(id, worldSeed || 1);
  }
  return out;
}

/** @deprecated use getRomanceNpcs(seed) — kept for imports that expect a map */
export const ROMANCE_NPCS: Record<string, RomanceNpcDef> = getRomanceNpcs(1);

export const RELATIONSHIP_STAGE_NAMES = [
  'stranger',
  'acquaintance',
  'friendly',
  'close',
  'sweetheart',
] as const;

/**
 * Persona for this playthrough. Pass the player's backstory seed so each
 * new game rolls unique romance lives while gift archetypes stay readable.
 */
export function getRomanceDef(npcId: string, worldSeed = 1): RomanceNpcDef | null {
  if (!ROMANCE_ARCHETYPES[npcId]) return null;
  return generateRomancePersona(npcId, worldSeed || 1);
}

export function ensureRomanceState(inv: InventoryState, npcId: string): RomanceState {
  let rel = inv.relationships.find((r) => r.npcId === npcId);
  if (!rel) {
    rel = {
      npcId,
      stage: 0,
      affinity: 0,
      giftsGiven: 0,
      knownLikes: false,
      storiesShared: [],
    };
    inv.relationships.push(rel);
  }
  if (!rel.storiesShared) rel.storiesShared = [];
  if (rel.knownLikes === undefined) rel.knownLikes = false;
  return rel;
}

function recomputeRomanceStage(rel: RomanceState): void {
  const a = rel.affinity;
  if (a >= 100) rel.stage = 4;
  else if (a >= 70) rel.stage = 3;
  else if (a >= 40) rel.stage = 2;
  else if (a >= 15) rel.stage = 1;
  else rel.stage = 0;
}

/** Giftable items currently in the player's pack. */
export function listHeldRomanceGifts(inv: InventoryState): CommodityId[] {
  return ROMANCE_GIFT_IDS.filter((id) => getQty(inv, id) > 0);
}

export interface PlayerBoardState {
  owned: boolean;
  thruster: boolean;
  rails: boolean;
  deck: boolean;
  /**
   * Foundry line (craft at factory-owned empire or craft bench with recipes):
   * gyro = turn / powerslide control; aetherDrive = top speed / accel.
   */
  gyro?: boolean;
  aetherDrive?: boolean;
}

/** Personal harvest / field gear (Foundry line). */
export interface PlayerFieldGear {
  /** Wider green zone / slower needle — easier & faster hits */
  reefGauge?: boolean;
  /** +qty per successful haul */
  haulRig?: boolean;
  /** Extract 2 mat types at once on success */
  multiScanner?: boolean;
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

/** Home footprint tier — prices rise steeply toward a private island */
export type HomeTier = 'cottage' | 'house' | 'manor' | 'estate' | 'island';

/** Functional rooms placed on the home plot */
export type HomeRoomKind = 'living' | 'workshop' | 'invent_lab' | 'gallery' | 'garden';

/** Factory shell form (storage / bay wings — not shop cosmetics) */
export type FactoryForm = 'horizontal' | 'tall' | 'boiler_yard';

/** Placed improvement on a site (local to plot center) */
export interface SiteProp {
  id: string;
  lx: number;
  lz: number;
  yaw: number;
  /** True when placed via interior décor mode (inside the home shell) */
  interior?: boolean;
}

export interface HomeRoom {
  kind: HomeRoomKind;
  lx: number;
  lz: number;
  yaw: number;
}

/** Saved player home layout (site builder) */
export interface HomeLayout {
  plotX: number;
  plotZ: number;
  yaw: number;
  tier: HomeTier;
  color: number;
  props: SiteProp[];
  rooms: HomeRoom[];
  built: boolean;
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
  /** Closed automatically when upkeep failed — reopen when brass recovers */
  forcedClosed?: boolean;
  /**
   * Layer M — last market drivers for HUD (“Underserved · Standing +12% · Décor +8%”).
   * Updated each stall customer check.
   */
  lastSalesDrivers?: string;
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
const HOME_TIER_EXTRA: Record<HomeTier, number> = {
  cottage: 0,
  house: 450,
  manor: 1400,
  estate: 3800,
  island: 9000,
};
const HOME_ROOM_COST: Record<HomeRoomKind, number> = {
  living: 0,
  workshop: 380,
  invent_lab: 520,
  gallery: 220,
  garden: 180,
};
const HOME_PROP_COST: Record<string, number> = {
  planters: 40,
  lanterns: 45,
  banners: 50,
  benches: 55,
  fountain: 120,
  statue: 150,
  trellis: 70,
  chimney: 90,
};
const HOME_ROOM_CAP: Record<HomeTier, number> = {
  cottage: 1,
  house: 2,
  manor: 3,
  estate: 4,
  island: 5,
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
  /** Market training reef — one deposit per starter mat */
  training: {
    id: 'training',
    name: 'Training Cloud Reef',
    mats: ['cloud_iron', 'scrap_brass', 'spore_silk', 'sky_salt'],
    color: 0x4a5a48,
  },
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
export function listHarvestSites(opts?: {
  /** Market tutorial — only the training reef (no empire plazas). */
  trainingOnly?: boolean;
}): { id: string | null; name: string; mats: CommodityId[] }[] {
  if (opts?.trainingOnly) {
    const t = HARVEST_BIOMES.training;
    return [
      {
        id: 'training',
        name: t?.name ?? 'Training Cloud Reef',
        mats: t ? [...t.mats] : [...DEFAULT_HARVEST_POOL],
      },
    ];
  }
  const sites: { id: string | null; name: string; mats: CommodityId[] }[] = [
    { id: null, name: 'Any / mixed reefs', mats: [...DEFAULT_HARVEST_POOL] },
  ];
  for (const b of Object.values(HARVEST_BIOMES)) {
    // Training reef is tutorial-only — hide from empire program UI
    if (b.id === 'training') continue;
    sites.push({ id: b.id, name: b.name, mats: [...b.mats] });
  }
  return sites;
}

/** Materials available at a harvest site (or all default mats if mixed). */
export function matsAtHarvestSite(siteId: string | null | undefined): CommodityId[] {
  if (siteId) return [...harvestBiomeForDistrict(siteId).mats];
  return [...DEFAULT_HARVEST_POOL];
}

export function harvestPoolForWorker(w: WorkerState): CommodityId[] {
  const siteMats = matsAtHarvestSite(w.harvestSiteId);
  if (w.harvestMatId && siteMats.includes(w.harvestMatId)) {
    return [w.harvestMatId];
  }
  // Stale mat filter if plaza doesn't carry it — fall back to all at site
  return siteMats;
}

/** Training plaza blooms (matches market hub flower patches). */
export const TRAINING_FLOWER_IDS: readonly FlowerId[] = [
  'bloom_sky',
  'bloom_brass',
  'flower_gift',
];

/**
 * Blooms by district / training — single source for worker programming & world patches.
 * Keep in sync with visual patches in flowers.ts / marketHub / skyCity.
 */
export const PLAZA_FLOWER_POOLS: Record<string, readonly FlowerId[]> = {
  training: TRAINING_FLOWER_IDS,
  residential: ['bloom_sky'],
  grand_market: ['flower_gift', 'bloom_brass'],
  industrial: ['bloom_brass'],
  harbor: ['bloom_harbor'],
  clocktower: ['bloom_aether', 'bloom_sky'],
  gearworks: ['bloom_brass', 'bloom_spore'],
  spore_gardens: ['bloom_spore', 'bloom_aether'],
  brass_arcade: ['bloom_brass', 'flower_gift'],
  sky_foundry: ['bloom_brass'],
  aether_spire: ['bloom_aether'],
  mid_ring_east: ['bloom_sky'],
  mid_ring_west: ['bloom_spore'],
  south_docks: ['bloom_harbor', 'bloom_sky'],
  north_observatory: ['bloom_aether'],
};

/** Blooms available at a plaza (training reef site shares training blooms). */
export function flowersAtSite(siteId: string | null | undefined): CommodityId[] {
  if (!siteId) {
    // Mixed / any — all flower types
    return [...FLOWER_IDS];
  }
  const listed = PLAZA_FLOWER_POOLS[siteId];
  if (listed?.length) return [...listed];
  // Unknown plaza: soft default
  return ['bloom_sky'];
}

export function listFlowerSites(opts?: {
  trainingOnly?: boolean;
}): { id: string | null; name: string; flowers: CommodityId[] }[] {
  if (opts?.trainingOnly) {
    return [
      {
        id: 'training',
        name: 'Training Plaza Blooms',
        flowers: [...TRAINING_FLOWER_IDS],
      },
    ];
  }
  const sites: { id: string | null; name: string; flowers: CommodityId[] }[] = [
    { id: null, name: 'Any / all blooms', flowers: [...FLOWER_IDS] },
    {
      id: 'training',
      name: 'Training Plaza Blooms',
      flowers: [...TRAINING_FLOWER_IDS],
    },
  ];
  for (const d of CITY_DISTRICTS) {
    const flowers = flowersAtSite(d.id);
    sites.push({ id: d.id, name: `${d.name} blooms`, flowers });
  }
  return sites;
}

export function flowerPoolForWorker(w: WorkerState): CommodityId[] {
  // Prefer harvestSiteId as plaza; fall back to mixed blooms
  const siteFlowers = flowersAtSite(w.harvestSiteId);
  if (w.flowerMatId && siteFlowers.includes(w.flowerMatId)) {
    return [w.flowerMatId];
  }
  if (w.flowerMatId && FLOWER_IDS.includes(w.flowerMatId as FlowerId)) {
    // Stale plaza filter — still allow chosen bloom if it's a real flower
    return [w.flowerMatId];
  }
  return siteFlowers;
}

export function flowerMatLabel(matId: CommodityId | null | undefined): string {
  if (!matId) return 'All blooms';
  return COMMODITIES[matId]?.name ?? matId;
}

export function setWorkerFlowerMat(
  inv: InventoryState,
  workerId: string,
  matId: CommodityId | null,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  if (matId) {
    if (!FLOWER_IDS.includes(matId as FlowerId)) {
      return { ok: false, msg: 'That is not a flower / bloom commodity.' };
    }
    const pool = flowersAtSite(w.harvestSiteId);
    // Allow if at plaza or mixed (null site)
    if (w.harvestSiteId && !pool.includes(matId) && w.harvestSiteId !== null) {
      // still set — player may change plaza later; warn softly
    }
  }
  w.flowerMatId = matId;
  return {
    ok: true,
    msg: `${w.name} flower target: ${flowerMatLabel(matId)} @ ${harvestSiteLabel(w.harvestSiteId)}`,
  };
}

export function workerFlowerQty(w: WorkerState): number {
  const tier = workerHaulToolTier(w);
  // Flowers are lighter hauls than ore
  if (tier >= 2) return 2 + Math.floor(Math.random() * 2); // 2–3
  if (tier >= 1) return 1 + Math.floor(Math.random() * 2); // 1–2
  return 1;
}

export function harvestSiteLabel(siteId: string | null | undefined): string {
  if (!siteId) return 'Any / mixed reefs';
  return harvestBiomeForDistrict(siteId).name;
}

export function harvestMatLabel(matId: CommodityId | null | undefined): string {
  if (!matId) return 'All materials';
  return COMMODITIES[matId]?.name ?? matId;
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
  // Clear mat filter if not available at new plaza
  const mats = matsAtHarvestSite(siteId);
  if (w.harvestMatId && !mats.includes(w.harvestMatId)) {
    w.harvestMatId = null;
  }
  const label = harvestSiteLabel(siteId);
  const mat = harvestMatLabel(w.harvestMatId);
  return {
    ok: true,
    msg: `${w.name} will harvest at: ${label} · ${mat}`,
  };
}

export function setWorkerHarvestMat(
  inv: InventoryState,
  workerId: string,
  matId: CommodityId | null,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  if (matId) {
    const mats = matsAtHarvestSite(w.harvestSiteId);
    if (!mats.includes(matId)) {
      return {
        ok: false,
        msg: `${COMMODITIES[matId]?.name ?? matId} is not available at ${harvestSiteLabel(w.harvestSiteId)}.`,
      };
    }
  }
  w.harvestMatId = matId;
  return {
    ok: true,
    msg: `${w.name} harvest target: ${harvestMatLabel(matId)} @ ${harvestSiteLabel(w.harvestSiteId)}`,
  };
}

export function describeWorkerAssignment(inv: InventoryState, w: WorkerState): string {
  if (w.unpaid) return 'UNPAID — idle until brass covers upkeep (or fire in Bay)';
  const matBit = w.harvestMatId ? ` · ${harvestMatLabel(w.harvestMatId)}` : ' · all mats';
  const flowerBit = w.flowerMatId ? ` · ${flowerMatLabel(w.flowerMatId)}` : ' · all blooms';
  if (w.job === 'program' && w.programId) {
    const p = inv.programs.find((x) => x.id === w.programId);
    const bits: string[] = [];
    if (p?.nodes.includes('harvest')) {
      bits.push(`reef: ${harvestSiteLabel(w.harvestSiteId)}${matBit}`);
    }
    if (p?.nodes.includes('pick_flowers')) {
      bits.push(`flowers: ${harvestSiteLabel(w.harvestSiteId)}${flowerBit}`);
    }
    if (
      p &&
      (p.nodes.includes('craft_custom') ||
        p.nodes.includes('stock_stall_invention') ||
        p.nodes.includes('sell_invention'))
    ) {
      const rid = resolveProgramInventionId(inv, p);
      const recipe = rid ? inv.customRecipes.find((r) => r.id === rid) : null;
      bits.push(recipe ? `inv: ${recipe.name}` : 'inv: none');
    }
    if (p?.nodes.includes('stock_stall_goods')) {
      const cid = p.stallCommodityId ?? 'wire';
      bits.push(
        `stall: ${COMMODITIES[cid]?.name ?? cid} ×${p.stallStockQty ?? 3}`,
      );
    }
    const site = bits.length ? ` · ${bits.join(' · ')}` : '';
    return `Program “${p?.name ?? '?'}”${site}`;
  }
  if (w.job === 'harvest') {
    return `Harvest · ${harvestSiteLabel(w.harvestSiteId)}${matBit}`;
  }
  if (w.job === 'pick_flowers') {
    return `Flowers · ${harvestSiteLabel(w.harvestSiteId)}${flowerBit}`;
  }
  const def = JOB_DEFS.find((j) => j.id === w.job);
  return def?.name ?? w.job;
}

/** Player harvest minigame success — biased to biome mats; field gear boosts yield. */
export function applyHarvestSuccess(
  inv: InventoryState,
  pool: CommodityId[] = DEFAULT_HARVEST_POOL,
  qtyHint?: number,
): { id: CommodityId; qty: number; msg: string; extra?: { id: CommodityId; qty: number } } {
  ensureFieldGear(inv);
  const mats = pool.length ? pool : DEFAULT_HARVEST_POOL;
  const id = mats[Math.floor(Math.random() * mats.length)]!;
  let qty = (qtyHint ?? 1 + Math.floor(Math.random() * 3)) + playerHarvestQtyBonus(inv);
  qty = Math.max(1, qty);
  addItem(inv, id, qty);
  inv.harvestRuns += 1;
  noteMarketSupply(inv, id, qty);
  let extra: { id: CommodityId; qty: number } | undefined;
  if (inv.fieldGear.multiScanner && mats.length > 1) {
    const others = mats.filter((m) => m !== id);
    const id2 = others[Math.floor(Math.random() * others.length)]!;
    const q2 = 1 + (inv.fieldGear.haulRig ? 1 : 0);
    addItem(inv, id2, q2);
    noteMarketSupply(inv, id2, q2);
    extra = { id: id2, qty: q2 };
  }
  notePeakBrass(inv);
  const extraBit = extra
    ? ` + ${extra.qty}× ${COMMODITIES[extra.id].name} (scanner)`
    : '';
  return {
    id,
    qty,
    extra,
    msg: `Extracted ${qty}× ${COMMODITIES[id].name}${extraBit}`,
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
  if (w.unpaid) return { ok: false, msg: `${w.name} unpaid — waiting for brass.` };
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
  /** Foundry-line personal harvest gear */
  fieldGear: PlayerFieldGear;
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
  /** Expandable home layout (site builder) */
  apartmentLayout: HomeLayout | null;
  /** Brass paid toward home layout (redesign charges delta) */
  apartmentLayoutPaid: number;
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
  /**
   * Bonded storage factory buildings by track.
   * Each capacity expand can add a new building; older ones stay in the world.
   */
  storageLayouts: Partial<Record<StorageTrack, FactoryLayout[]>>;
  /** Brass paid toward each storage factory layout (sum) */
  storageLayoutPaid: Partial<Record<StorageTrack, number>>;
  /**
   * Sky Foundry bay-wing factories (one per expand). Prior wings remain.
   * Legacy single bayWingLayout is migrated into this array on load.
   */
  bayWingLayouts: FactoryLayout[];
  /** @deprecated use bayWingLayouts[0] — kept during migration */
  bayWingLayout: FactoryLayout | null;
  bayWingLayoutPaid: number;
  /**
   * Soft empire reputation (0–100). Brand-lite until explicit brand ships.
   * Fed by fair labor, retail, gifts, repairs; sunk by unpaid wages / bad gifts.
   */
  empireStanding: number;
  /** Per-district standing (−20–100), keyed by CITY_DISTRICTS id */
  districtStanding: Record<string, number>;
  /** Soft-goal flags that are not implied by other inventory fields */
  softGoalFlags: SoftGoalFlags;
  /** Neighbor drama, debt, hire, landlord rent (Tasks 2–3) */
  neighborLife: NeighborLifeState;
  /** Plaza 3×3 plot ownership (Tasks 4–6) */
  plazaPlots: PlazaPlotsState;
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
    playerBoard: {
      owned: false,
      thruster: false,
      rails: false,
      deck: false,
      gyro: false,
      aetherDrive: false,
    },
    fieldGear: { reefGauge: false, haulRig: false, multiScanner: false },
    customRecipes: [],
    customStock: {},
    programs: [
      {
        id: 'prog_default_haul',
        name: 'Haul Loop',
        nodes: ['harvest', 'return_bay'],
      },
      {
        id: 'prog_frame_line',
        name: 'Frame Line',
        nodes: ['harvest', 'buy_fuel_cell', 'craft_frame', 'return_bay'],
        framePref: 'service',
      },
      {
        id: 'prog_invent_cycle',
        name: 'Invent Market Cycle',
        nodes: [
          'harvest',
          'return_bay',
          'craft_custom',
          'stock_stall_invention',
          'price_fair_shelf',
        ],
      },
    ],
    stall: emptyStall(),
    cityStalls: {},
    marketPressure: {},
    apartmentOwned: false,
    apartmentLayout: null,
    apartmentLayoutPaid: 0,
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
    bayWingLayouts: [],
    bayWingLayout: null,
    bayWingLayoutPaid: 0,
    empireStanding: 0,
    districtStanding: {},
    softGoalFlags: {},
    neighborLife: emptyNeighborLife(),
    plazaPlots: emptyPlazaPlots(districtsLite()),
  };
}

function districtsLite(): DistrictLite[] {
  return CITY_DISTRICTS.map((d) => ({
    id: d.id,
    name: d.name,
    x: d.x,
    z: d.z,
    size: d.size,
    role: d.role,
    stallCost: d.stallCost,
  }));
}

export function ensureInvPlots(inv: InventoryState): PlazaPlotsState {
  inv.plazaPlots = ensurePlazaPlots(inv.plazaPlots, districtsLite());
  return inv.plazaPlots;
}

/** Normalize one storage track to a building list (migrates legacy single layout). */
export function storageBuildings(
  inv: InventoryState,
  track: StorageTrack,
): FactoryLayout[] {
  const raw = inv.storageLayouts?.[track] as FactoryLayout | FactoryLayout[] | undefined;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((b) => b?.built);
  return raw.built ? [raw] : [];
}

export function bayWingBuildings(inv: InventoryState): FactoryLayout[] {
  if (Array.isArray(inv.bayWingLayouts) && inv.bayWingLayouts.length) {
    return inv.bayWingLayouts.filter((b) => b?.built);
  }
  if (inv.bayWingLayout?.built) return [inv.bayWingLayout];
  return [];
}

export function setStorageBuildings(
  inv: InventoryState,
  track: StorageTrack,
  list: FactoryLayout[],
): void {
  if (!inv.storageLayouts) inv.storageLayouts = {};
  inv.storageLayouts[track] = list.filter((b) => b.built);
}

export function setBayWingBuildings(inv: InventoryState, list: FactoryLayout[]): void {
  inv.bayWingLayouts = list.filter((b) => b.built);
  inv.bayWingLayout = inv.bayWingLayouts[0] ?? null;
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
  applyStanding(inv, 4, { districtId: 'industrial', districtDelta: 6 });
  return {
    ok: true,
    msg: `City workshop leased (−${CITY_WORKSHOP_COST}). Invent unlocked · expand bay forever · lease stalls across plazas.`,
  };
}

/**
 * Restore a disabled/scrambled rogue to work.
 * Requires 1× Repair Kit (same consumable as field repair jobs).
 */
export function repairRogueRobot(
  inv: InventoryState,
  opts?: { ownerName?: string; jobLabel?: string },
): { ok: boolean; msg: string } {
  if (getQty(inv, 'repair_kit') < 1) {
    return {
      ok: false,
      msg: 'Need a Repair Kit to fix a rogue (craft: wire + scrap, or buy at market).',
    };
  }
  removeItem(inv, 'repair_kit', 1);
  inv.brass += ROGUE_REPAIR_PAY;
  inv.repairsDone += 1;
  notePeakBrass(inv);
  applyStanding(inv, 2);
  const owner = opts?.ownerName ? opts.ownerName : 'its owner';
  const job = opts?.jobLabel ? ` (${opts.jobLabel})` : '';
  return {
    ok: true,
    msg: `Used Repair Kit · restored to ${owner}'s work${job} · +${ROGUE_REPAIR_PAY} brass.`,
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
    msg += ' Soul medallion returned to your pack — assign it to another robot.';
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
  applyStanding(inv, 1);
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
    speedToolTier: 0,
    haulToolTier: 0,
    jobsDone: 0,
    payGrade: 0,
    harvestSiteId: null,
    harvestMatId: null,
    flowerMatId: null,
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

/**
 * Ensure the soul-host robot worker exists (companion from workshop).
 * Starts idle (follows the player) until assigned a job/program.
 */
export function ensureEliasRobotWorker(inv: InventoryState, companionName = 'Elias'): WorkerState {
  let elias = inv.workers.find((w) => w.id === 'bot_elias');
  if (elias) {
    elias.kind = 'robot';
    elias.name = companionName;
    if (!inv.medallionLoose && !inv.medallionHostId) {
      elias.hasMedallion = true;
      inv.medallionHostId = elias.id;
    }
    return elias;
  }
  elias = makeRobotWorker(companionName, 'bot_elias');
  elias.hasMedallion = true;
  elias.payGrade = 1;
  elias.job = 'idle'; // follow player until a task is assigned
  inv.workers.unshift(elias);
  inv.medallionHostId = elias.id;
  inv.medallionLoose = false;
  return elias;
}

/**
 * Market start: companion robot only — no free hired crew.
 * Robot follows until Bay → Workers assigns a job or program.
 * (Hired humans still appear if the player buys them later.)
 */
export function ensureTutorialMarketCrew(inv: InventoryState, companionName = 'Elias'): void {
  if (!inv.parcelLeased) {
    inv.parcelLeased = true;
    inv.bayLevel = Math.max(inv.bayLevel, 1);
  }
  // Strip legacy free tutorial laborers (Rook / Pip / Nessa) once
  inv.workers = inv.workers.filter((w) => !String(w.id).startsWith('w_tut_'));
  const elias = ensureEliasRobotWorker(inv, companionName);
  // Only force idle follow on a fresh companion that never worked a real job yet
  if (elias.jobsDone === 0 && !elias.programId && (elias.job === 'harvest' || elias.job === 'idle')) {
    elias.job = 'idle';
  }
  inv.laborerHired = inv.workers.some((w) => w.id !== 'bot_elias');
}

export function assignMedallion(inv: InventoryState, workerId: string): { ok: boolean; msg: string } {
  const bot = inv.workers.find((w) => w.id === workerId);
  if (!bot || bot.kind !== 'robot') {
    return { ok: false, msg: 'Medallion can only host in a robot you own.' };
  }
  if (!inv.medallionLoose && getQty(inv, 'elias_medallion') < 1 && inv.medallionHostId !== workerId) {
    // Allow reassign from current host
    if (!inv.medallionHostId) {
      return { ok: false, msg: 'No medallion in pack. Recover it when the soul-host is lost.' };
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
    msg: `${bot.name} now hosts the soul medallion — human pace, marked on the map.`,
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
  ensureDefaultHomeLayout(inv);
  notePeakBrass(inv);
  applyStanding(inv, 5, { districtId: 'residential', districtDelta: 5 });
  return {
    ok: true,
    msg: `Deed signed · sky cottage yours (−${APARTMENT_COST} brass). Improve it from the door!`,
  };
}

export function notePeakBrass(inv: InventoryState): void {
  if (inv.brass > inv.peakBrass) inv.peakBrass = inv.brass;
}

// ——— Soft goals & reputation (Task 1) ———

export interface SoftGoalFlags {
  /** Talked to a residential neighbor at least once in the empire city */
  metNeighbor?: boolean;
  /** Cleared NPC landlord debt (Task 3+) */
  clearedNeighborDebt?: boolean;
  /** Hired a neighbor out of drama (Task 2+) */
  hiredNeighbor?: boolean;
  /** Owned at least one plaza plot (Task 4+) */
  ownedPlot?: boolean;
  /** Built a garden on any owned plot (optional onboarding) */
  plantedGarden?: boolean;
  /** Bound retail front on a plot (optional onboarding) */
  boundRetail?: boolean;
  /** Last soft-goal id announced (toasts / compass surface) */
  lastAnnouncedGoalId?: string;
}

export type StandingTierId =
  | 'newcomer'
  | 'noticed'
  | 'friendly'
  | 'respected'
  | 'pillar';

export interface StandingTier {
  id: StandingTierId;
  label: string;
  min: number;
  /** One-line “what good looks like” */
  blurb: string;
}

export const STANDING_TIERS: StandingTier[] = [
  {
    id: 'newcomer',
    min: 0,
    label: 'Newcomer',
    blurb: 'The city barely knows your name.',
  },
  {
    id: 'noticed',
    min: 10,
    label: 'Noticed',
    blurb: 'Shopkeepers nod. Neighbors watch.',
  },
  {
    id: 'friendly',
    min: 25,
    label: 'Friendly',
    blurb: 'Fair deals and help open doors.',
  },
  {
    id: 'respected',
    min: 45,
    label: 'Respected',
    blurb: 'Your brand carries weight on the plazas.',
  },
  {
    id: 'pillar',
    min: 70,
    label: 'Pillar',
    blurb: 'Empire-scale reputation — landlord and employer.',
  },
];

export const EMPIRE_STANDING_MIN = 0;
export const EMPIRE_STANDING_MAX = 100;
export const DISTRICT_STANDING_MIN = -20;
export const DISTRICT_STANDING_MAX = 100;

export interface SoftGoalDef {
  id: string;
  title: string;
  hint: string;
  /** Only relevant after apartment deed (empire soft goals) */
  empireOnly?: boolean;
  isDone: (inv: InventoryState) => boolean;
}

/** Soft goal chain for empire (and apartment pre-goal). */
export const SOFT_GOALS: SoftGoalDef[] = [
  {
    id: 'apartment',
    title: 'Deed a sky apartment',
    hint: 'Training market · 1000 brass · Real Estate east',
    isDone: (inv) => inv.apartmentOwned,
  },
  {
    id: 'workshop',
    title: 'Lease empire workshop',
    hint: 'Industrial slips west · craft · hire · invent',
    empireOnly: true,
    isDone: (inv) => inv.cityWorkshopLeased || inv.parcelLeased,
  },
  {
    id: 'neighbor',
    title: 'Meet a neighbor',
    hint: 'Residential ring · E talk · drama and hire come later',
    empireOnly: true,
    isDone: (inv) => !!inv.softGoalFlags?.metNeighbor,
  },
  {
    id: 'hire',
    title: 'Hire crew',
    hint: 'Workshop hire board · humans or robots',
    empireOnly: true,
    isDone: (inv) => inv.workers.length >= 1,
  },
  {
    id: 'stall',
    title: 'Open a plaza stall',
    hint: 'Lease a district shop · stock shelf · stay open',
    empireOnly: true,
    isDone: (inv) => ownedCityStallCount(inv) >= 1 || inv.stall.owned,
  },
  {
    id: 'invent',
    title: 'Invent a product',
    hint: 'Bay L3 / workshop invent desk',
    empireOnly: true,
    isDone: (inv) => inv.customRecipes.length >= 1,
  },
  {
    id: 'network',
    title: 'Retail network (3 shops)',
    hint: 'Multi-plaza stalls · premium plazas pay invent bonus',
    empireOnly: true,
    isDone: (inv) => ownedCityStallCount(inv) >= 3,
  },
  {
    id: 'standing_friendly',
    title: 'Reach Friendly standing',
    hint: 'Hire fairly · repair rogues · gifts · open shops',
    empireOnly: true,
    isDone: (inv) => (inv.empireStanding ?? 0) >= 25,
  },
  // Future RE / drama goals (complete via flags when those systems land)
  {
    id: 'clear_debt',
    title: 'Clear a neighbor’s debt',
    hint: 'Pip / Bolt · E talk · Clear debt to Mira Coil or Dockmaster Dredge',
    empireOnly: true,
    isDone: (inv) => !!inv.softGoalFlags?.clearedNeighborDebt,
  },
  {
    id: 'own_plot',
    title: 'Own plaza land',
    hint: 'Leasing office (Market / Residential) · or buy a neighbor’s home plot',
    empireOnly: true,
    isDone: (inv) =>
      !!inv.softGoalFlags?.ownedPlot || playerOwnedPlotCount(inv) > 0,
  },
  {
    id: 'hire_neighbor',
    title: 'Hire a neighbor',
    hint: 'Offer hire on neighbor panel · needs free bay slot',
    empireOnly: true,
    isDone: (inv) => !!inv.softGoalFlags?.hiredNeighbor,
  },
  {
    id: 'plot_garden',
    title: 'Plant a plot garden',
    hint: 'Lease office · Develop · Flower garden on an owned pad',
    empireOnly: true,
    isDone: (inv) =>
      !!inv.softGoalFlags?.plantedGarden ||
      !!inv.plazaPlots?.plots?.some(
        (p) => p.owner === 'player' && p.buildings.some((b) => b.kind === 'garden'),
      ),
  },
  {
    id: 'plot_retail',
    title: 'Bind a retail front',
    hint: 'Lease office · Develop · Retail front (or bind district stall)',
    empireOnly: true,
    isDone: (inv) =>
      !!inv.softGoalFlags?.boundRetail ||
      !!inv.plazaPlots?.plots?.some(
        (p) => p.owner === 'player' && (p.retailBound || p.buildings.some((b) => b.kind === 'retail')),
      ),
  },
  {
    id: 'plot_shape',
    title: 'Remodel a pad shape',
    hint: 'Lease office · own a plot · octagon / circle / triangle',
    empireOnly: true,
    isDone: (inv) =>
      !!inv.plazaPlots?.plots?.some((p) => p.owner === 'player' && p.shape && p.shape !== 'square'),
  },
  {
    id: 'plot_layer',
    title: 'Build an upper deck',
    hint: 'Lease office · Add deck L1+ on an owned plot (stack many)',
    empireOnly: true,
    isDone: (inv) =>
      !!inv.plazaPlots?.plots?.some((p) => p.owner === 'player' && (p.layer ?? 0) >= 1),
  },
  {
    id: 'plot_airway',
    title: 'Link a private skyway',
    hint: 'Own 2 plots in one district · lease office · Airway button',
    empireOnly: true,
    isDone: (inv) => (inv.plazaPlots?.airways?.length ?? 0) >= 1,
  },
];

export function ensureStandingState(inv: InventoryState): void {
  if (typeof inv.empireStanding !== 'number' || Number.isNaN(inv.empireStanding)) {
    inv.empireStanding = 0;
  }
  if (!inv.districtStanding || typeof inv.districtStanding !== 'object') {
    inv.districtStanding = {};
  }
  if (!inv.softGoalFlags || typeof inv.softGoalFlags !== 'object') {
    inv.softGoalFlags = {};
  }
  inv.empireStanding = clampStanding(
    inv.empireStanding,
    EMPIRE_STANDING_MIN,
    EMPIRE_STANDING_MAX,
  );
}

function clampStanding(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n * 10) / 10));
}

export function standingTierFor(score: number): StandingTier {
  let best = STANDING_TIERS[0]!;
  for (const t of STANDING_TIERS) {
    if (score >= t.min) best = t;
  }
  return best;
}

export function empireStandingTier(inv: InventoryState): StandingTier {
  ensureStandingState(inv);
  return standingTierFor(inv.empireStanding);
}

export function getDistrictStanding(inv: InventoryState, districtId: string): number {
  ensureStandingState(inv);
  return inv.districtStanding[districtId] ?? 0;
}

export function districtStandingTier(
  inv: InventoryState,
  districtId: string,
): StandingTier {
  return standingTierFor(getDistrictStanding(inv, districtId));
}

/**
 * Apply empire and optional district standing delta.
 * Future systems (rent tiers, plot gifts) call this with a districtId.
 */
export function applyStanding(
  inv: InventoryState,
  empireDelta: number,
  opts?: { districtId?: string; districtDelta?: number },
): void {
  ensureStandingState(inv);
  if (empireDelta) {
    inv.empireStanding = clampStanding(
      inv.empireStanding + empireDelta,
      EMPIRE_STANDING_MIN,
      EMPIRE_STANDING_MAX,
    );
  }
  const did = opts?.districtId;
  if (did) {
    const dDelta = opts?.districtDelta ?? empireDelta;
    if (dDelta) {
      const cur = inv.districtStanding[did] ?? 0;
      inv.districtStanding[did] = clampStanding(
        cur + dDelta,
        DISTRICT_STANDING_MIN,
        DISTRICT_STANDING_MAX,
      );
    }
  }
}

/** One-line HUD / map summary */
export function formatEmpireStandingLine(inv: InventoryState): string {
  ensureStandingState(inv);
  const tier = empireStandingTier(inv);
  const next = STANDING_TIERS.find((t) => t.min > inv.empireStanding);
  const nextBit = next ? ` · next ${next.label} at ${next.min}` : ' · peak tier';
  return `Standing ${Math.round(inv.empireStanding)} · ${tier.label}${nextBit}`;
}

export function formatDistrictStandingLine(
  inv: InventoryState,
  districtId: string,
): string {
  ensureStandingState(inv);
  const dist = districtById(districtId);
  const score = getDistrictStanding(inv, districtId);
  const tier = standingTierFor(score);
  const name = dist?.name ?? districtId;
  return `${name}: ${Math.round(score)} · ${tier.label}`;
}

export interface SoftGoalView {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  active: boolean;
}

/** Goals relevant to current play phase, in chain order. */
export function listSoftGoalViews(inv: InventoryState): SoftGoalView[] {
  ensureStandingState(inv);
  const empire = inv.apartmentOwned;
  const ownsLand =
    !!inv.softGoalFlags?.ownedPlot || playerOwnedPlotCount(inv) > 0;
  const metNeighbor = !!inv.softGoalFlags?.metNeighbor;
  const shops = ownedCityStallCount(inv);
  const filtered = SOFT_GOALS.filter((g) => {
    if (g.empireOnly && !empire) return false;
    // RE/debt goals appear after first neighbor contact (or any stall)
    if (
      (g.id === 'clear_debt' || g.id === 'own_plot' || g.id === 'hire_neighbor') &&
      shops < 1 &&
      !metNeighbor
    ) {
      return false;
    }
    // Optional pad builds + RE expression only after first land deed
    if (
      (g.id === 'plot_garden' ||
        g.id === 'plot_retail' ||
        g.id === 'plot_shape' ||
        g.id === 'plot_layer' ||
        g.id === 'plot_airway') &&
      !ownsLand
    ) {
      return false;
    }
    return true;
  });
  let foundActive = false;
  return filtered.map((g) => {
    const done = g.isDone(inv);
    const active = !done && !foundActive;
    if (active) foundActive = true;
    return {
      id: g.id,
      title: g.title,
      hint: g.hint,
      done,
      active,
    };
  });
}

/**
 * Task 14: detect soft-goal advance and return toast copy.
 * Updates softGoalFlags.lastAnnouncedGoalId when the active goal changes.
 */
export function pollSoftGoalAnnouncement(inv: InventoryState): {
  toast: string | null;
  goal: SoftGoalView | null;
  changed: boolean;
} {
  ensureStandingState(inv);
  // Keep optional flags in sync with world state
  if (
    inv.plazaPlots?.plots?.some(
      (p) => p.owner === 'player' && p.buildings.some((b) => b.kind === 'garden'),
    )
  ) {
    inv.softGoalFlags.plantedGarden = true;
  }
  if (
    inv.plazaPlots?.plots?.some(
      (p) =>
        p.owner === 'player' &&
        (p.retailBound || p.buildings.some((b) => b.kind === 'retail')),
    )
  ) {
    inv.softGoalFlags.boundRetail = true;
  }

  const active = getActiveSoftGoal(inv);
  const prev = inv.softGoalFlags.lastAnnouncedGoalId ?? null;
  const nextId = active?.id ?? (inv.apartmentOwned ? '_empire_done' : null);
  if (!nextId || nextId === prev) {
    return { toast: null, goal: active, changed: false };
  }
  inv.softGoalFlags.lastAnnouncedGoalId = nextId;
  if (!active) {
    return {
      toast: 'Soft goals clear · grow standing, shops, and skyline at your pace.',
      goal: null,
      changed: true,
    };
  }
  const wasProgress = prev && prev !== '_empire_done';
  const toast = wasProgress
    ? `Next soft goal: ${active.title} — ${active.hint}`
    : `Soft goal: ${active.title} — ${active.hint}`;
  return { toast, goal: active, changed: true };
}

/** Longer coach line for first-time goal context (city enter / map). */
export function softGoalCoachLine(inv: InventoryState): string | null {
  const g = getActiveSoftGoal(inv);
  if (!g) return null;
  switch (g.id) {
    case 'workshop':
      return 'Industrial slips west · lease the empire workshop (craft · hire · invent).';
    case 'neighbor':
      return 'Residential ring · walk to a named home · E talk. Drama and debt come next.';
    case 'hire':
      return 'Bay hire board (or workshop hire) · free a pad slot if full.';
    case 'stall':
      return 'Lease a district stall · stock shelf · stay open for sales.';
    case 'invent':
      return 'Bay L3 or workshop invent desk · spend mats for a custom recipe.';
    case 'network':
      return 'Open 3 plazas · premium districts pay invent bonuses.';
    case 'standing_friendly':
      return 'Standing 25 · hire fairly, clear debts, open shops, repair rogues.';
    case 'clear_debt':
      return 'Talk to Pip/Bolt (or any debt drama) · Clear debt or gift brass/goods.';
    case 'own_plot':
      return 'M map · LEASE pin at Market or Residential · buy a city pad (or a neighbor home).';
    case 'hire_neighbor':
      return 'Neighbor panel · Hire · needs free bay crew slot.';
    case 'plot_garden':
      return 'Lease office · select your gold pad · Develop · Flower garden.';
    case 'plot_retail':
      return 'Lease office · Develop · Retail front binds your district stall lease.';
    case 'plot_shape':
      return 'Lease office · Shape · try octagon / circle / triangle (costs brass).';
    case 'plot_layer':
      return 'Lease office · Add deck · stack L1+ for another full building set.';
    case 'plot_airway':
      return 'Own 2 pads in one district · lease office · Airway between them.';
    default:
      return `${g.title} · ${g.hint}`;
  }
}

export function getActiveSoftGoal(inv: InventoryState): SoftGoalView | null {
  return listSoftGoalViews(inv).find((g) => g.active) ?? null;
}

/** Objective string driven by soft goals (empire) */
export function softGoalObjectiveLine(inv: InventoryState): string {
  const active = getActiveSoftGoal(inv);
  if (!active) {
    const tier = empireStandingTier(inv);
    const shops = ownedCityStallCount(inv);
    return `Empire · ${tier.label} · ${shops} shops · ${inv.workers.length} crew · ${formatEmpireStandingLine(inv)}`;
  }
  return `${active.title} · ${active.hint}`;
}

/** Mark neighbor hello (Task 1 soft goal); later drama builds on this. */
export function noteMetNeighbor(inv: InventoryState): { first: boolean } {
  ensureStandingState(inv);
  if (inv.softGoalFlags.metNeighbor) return { first: false };
  inv.softGoalFlags.metNeighbor = true;
  applyStanding(inv, 2, { districtId: 'residential', districtDelta: 4 });
  return { first: true };
}

/**
 * One-time bootstrap for older saves that never tracked standing —
 * award soft credit for accomplishments already earned (not a free farm).
 */
export function bootstrapStandingFromProgress(inv: InventoryState): void {
  ensureStandingState(inv);
  const flag = inv as InventoryState & { _standingBootstrapped?: boolean };
  if (flag._standingBootstrapped) return;
  // Only bootstrap if completely flat (new field on old save)
  const anyDistrict = Object.keys(inv.districtStanding).length > 0;
  if (inv.empireStanding > 0 || anyDistrict) {
    flag._standingBootstrapped = true;
    return;
  }
  let empire = 0;
  if (inv.apartmentOwned) empire += 5;
  if (inv.cityWorkshopLeased) {
    empire += 4;
    inv.districtStanding.industrial = (inv.districtStanding.industrial ?? 0) + 6;
  }
  if (inv.workers.length) empire += Math.min(8, inv.workers.length * 2);
  const shops = ownedCityStallCount(inv);
  if (shops) {
    empire += Math.min(12, shops * 3);
    for (const [did, stall] of Object.entries(inv.cityStalls ?? {})) {
      if (stall.owned) {
        inv.districtStanding[did] = (inv.districtStanding[did] ?? 0) + 5;
      }
    }
  }
  if (inv.customRecipes.length) empire += Math.min(6, inv.customRecipes.length * 2);
  if (inv.repairsDone > 0) empire += Math.min(6, inv.repairsDone);
  inv.empireStanding = clampStanding(empire, EMPIRE_STANDING_MIN, EMPIRE_STANDING_MAX);
  for (const k of Object.keys(inv.districtStanding)) {
    inv.districtStanding[k] = clampStanding(
      inv.districtStanding[k]!,
      DISTRICT_STANDING_MIN,
      DISTRICT_STANDING_MAX,
    );
  }
  flag._standingBootstrapped = true;
}

// ——— Neighbor actions (Tasks 2–3) ———

export function getInvNeighbor(inv: InventoryState, id: string): NeighborState | undefined {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  return inv.neighborLife.neighbors.find((n) => n.id === id);
}

function bumpNeighborAffinity(n: NeighborState, delta: number): void {
  n.affinity = Math.max(0, Math.min(100, n.affinity + delta));
}

function clearEconomicDrama(n: NeighborState): void {
  if (
    n.drama === 'behind_on_rent' ||
    n.drama === 'workplace_fight' ||
    n.drama === 'tax_warning'
  ) {
    n.drama = 'none';
  }
}

export function chatNeighbor(
  inv: InventoryState,
  neighborId: string,
  opts?: { nowMs?: number; playerStoryHint?: string },
): { ok: boolean; msg: string } {
  ensureStandingState(inv);
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  // Homeless stay talkable; pure vacated pad (predatory leave) does not
  if (n.vacated && !n.homeless) {
    return { ok: true, msg: 'The pad is empty — they left under your rent terms.' };
  }
  const now = opts?.nowMs ?? Date.now();
  const first = !n.known;
  n.known = true;
  if (first) {
    inv.softGoalFlags.metNeighbor = true;
    applyStanding(inv, 2, { districtId: def.homeDistrictId, districtDelta: 4 });
  }
  // M3: affinity grant rate-limited (~1/60s); chat spam still yields dialogue
  let affBit = '';
  if (first || canGrantTalkAffinity(n.lastTalkAffinityMs, now)) {
    bumpNeighborAffinity(n, first ? 4 : 1);
    n.lastTalkAffinityMs = now;
    if (!first) affBit = ' · +affinity';
  } else {
    const sec = talkCooldownRemainingSec(n.lastTalkAffinityMs, now);
    affBit = sec > 0 ? ` · chat ok · affinity cool ${sec}s` : '';
  }
  const dramaPool = def.dramaLines[n.drama];
  const extras = extraDramaLines(n.drama);
  const pool =
    dramaPool && dramaPool.length
      ? [...dramaPool, ...extras]
      : n.drama !== 'none'
        ? [`Still dealing with: ${dramaLabel(n.drama)}.`, ...extras]
        : [...def.chatLines, ...extras];
  const line = pool[Math.floor(Math.random() * pool.length)]!;
  const hook = maybeBackstoryHook({
    roll: Math.random(),
    softMatch: softBackstoryMatch(def.jobLabel, opts?.playerStoryHint),
    homeless: !!n.homeless,
  });
  const hookBit = hook ? ` ${def.name} adds: “${hook}”` : '';
  const debtBit =
    n.debt && n.debt.amount > 0
      ? ` · Owes ${n.debt.amount}b to ${n.debt.landlordName}`
      : '';
  const homeBit = n.homeless ? ' · Homeless · hire or gift to help' : '';
  return {
    ok: true,
    msg: `${def.name}: “${line}”${hookBit}${first ? ' · First meet · standing up' : ''}${affBit}${debtBit}${homeBit}`,
  };
}

export function learnNeighbor(
  inv: InventoryState,
  neighborId: string,
  opts?: { nowMs?: number },
): { ok: boolean; msg: string } {
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  if (n.vacated && !n.homeless) {
    return { ok: false, msg: 'The pad is empty — nothing to learn.' };
  }
  const now = opts?.nowMs ?? Date.now();
  n.known = true;
  inv.softGoalFlags.metNeighbor = true;
  let coolBit = '';
  if (canGrantTalkAffinity(n.lastTalkAffinityMs, now)) {
    bumpNeighborAffinity(n, 2);
    n.lastTalkAffinityMs = now;
  } else {
    const sec = talkCooldownRemainingSec(n.lastTalkAffinityMs, now);
    coolBit = sec > 0 ? ` · affinity cool ${sec}s` : '';
  }
  const ownerBit = n.homeless
    ? 'No pad — wandering the plazas.'
    : n.homeOwner === 'player'
      ? 'You hold the pad deed.'
      : n.homeOwner === 'npc_landlord' && n.landlordId
        ? `Landlord: ${landlordById(n.landlordId)?.name ?? n.landlordId}.`
        : n.homeOwner === 'self'
          ? 'Owns their own pad.'
          : 'City-held pad.';
  const quote = quoteNeighborPadPrice(def, n.affinity);
  const fairRent = rentIncomeForPad(def.basePrice, 'fair');
  const vendorBit =
    n.vendorOpen
      ? ' · Small stand open (city wages)'
      : n.homeless
        ? ' · Stand closed'
        : '';
  return {
    ok: true,
    msg:
      `${def.name} · ${def.jobLabel} · ${ownerBit} · ${def.priceTierLabel} ` +
      `list ${quote.list.toLocaleString()}b (your price ~${quote.price.toLocaleString()}b) · ` +
      `fair rent ~${fairRent.toLocaleString()}b/tick · ${neighborStatusLine(n)}${vendorBit}${coolBit}`,
  };
}

export function listHeldNeighborGifts(inv: InventoryState): CommodityId[] {
  return NEIGHBOR_GIFT_IDS.filter((id) => id in COMMODITIES && getQty(inv, id) > 0);
}

export function giftNeighborGoods(
  inv: InventoryState,
  neighborId: string,
  gift: CommodityId,
  opts?: { nowMs?: number },
): { ok: boolean; msg: string } {
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  if (n.vacated && !n.homeless) return { ok: false, msg: 'They already left.' };
  if (!(NEIGHBOR_GIFT_IDS as readonly string[]).includes(gift)) {
    return { ok: false, msg: 'That isn’t a neighbor gift.' };
  }
  if (getQty(inv, gift) < 1) {
    return { ok: false, msg: `No ${COMMODITIES[gift]?.name ?? gift} in pack.` };
  }
  const now = opts?.nowMs ?? Date.now();
  removeItem(inv, gift, 1);
  n.giftsGiven += 1;
  n.known = true;
  inv.softGoalFlags.metNeighbor = true;
  let aff = 6;
  let stand = 1;
  // Blooms / charms land softer; bulk mats help practical drama
  if (gift === 'brass_charm' || gift === 'silk_scarf' || gift === 'flower_gift') {
    aff = 10;
    stand = 2;
  } else if (n.drama === 'broken_board' && (gift === 'gear_blank' || gift === 'scrap_brass')) {
    aff = 12;
    n.drama = 'none';
    stand = 3;
  } else if (n.drama === 'lonely') {
    aff = 9;
    if (n.giftsGiven >= 2) n.drama = 'none';
    stand = 2;
  } else if (n.homeless) {
    aff = 11;
    stand = 2;
  }
  // M3: meaningful gift affinity rate-limited (~1/30s); item always consumed
  let coolBit = '';
  if (canGrantGiftAffinity(n.lastGiftAffinityMs, now)) {
    bumpNeighborAffinity(n, aff);
    n.lastGiftAffinityMs = now;
  } else {
    const sec = giftCooldownRemainingSec(n.lastGiftAffinityMs, now);
    coolBit = sec > 0 ? ` · gift accepted · affinity cool ${sec}s` : '';
    aff = 0;
  }
  if (aff > 0) {
    applyStanding(inv, stand, { districtId: def.homeDistrictId, districtDelta: stand + 1 });
  }
  // Partial debt help: practical goods reduce debt a little (brass is better)
  if (n.debt && n.debt.amount > 0 && (gift === 'scrap_brass' || gift === 'cloud_iron')) {
    const cut = Math.min(n.debt.amount, 80);
    n.debt.amount -= cut;
    n.debtPaidToward += cut;
    if (n.debt.amount <= 0) {
      n.debt = null;
      if (n.drama === 'behind_on_rent' || n.drama === 'homeless') n.drama = 'none';
      tryRescueHomeless(n);
      inv.softGoalFlags.clearedNeighborDebt = true;
      applyStanding(inv, 3, { districtId: def.homeDistrictId, districtDelta: 5 });
      return {
        ok: true,
        msg: `${def.name} sells the ${COMMODITIES[gift].name} and clears the last of the debt! Standing up.`,
      };
    }
  }
  return {
    ok: true,
    msg:
      `${def.name} accepts ${COMMODITIES[gift].name}` +
      (aff > 0 ? ` · +${aff} affinity` : '') +
      ` · ${neighborStatusLine(n)}${coolBit}`,
  };
}

export function giftNeighborBrass(
  inv: InventoryState,
  neighborId: string,
  amount: number,
  opts?: { nowMs?: number },
): { ok: boolean; msg: string } {
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  if (n.vacated && !n.homeless) return { ok: false, msg: 'They already left.' };
  const pay = Math.max(1, Math.floor(amount));
  if (inv.brass < pay) return { ok: false, msg: `Need ${pay} brass (you have ${inv.brass}).` };
  const now = opts?.nowMs ?? Date.now();
  inv.brass -= pay;
  n.known = true;
  inv.softGoalFlags.metNeighbor = true;
  n.giftsGiven += 1;
  const meaningful = pay >= GIFT_MEANINGFUL_BRASS_MIN;
  let coolBit = '';
  let affGranted = true;
  if (meaningful) {
    if (canGrantGiftAffinity(n.lastGiftAffinityMs, now)) {
      bumpNeighborAffinity(n, Math.min(20, 3 + Math.floor(pay / 5)));
      n.lastGiftAffinityMs = now;
    } else {
      affGranted = false;
      const sec = giftCooldownRemainingSec(n.lastGiftAffinityMs, now);
      coolBit = sec > 0 ? ` · affinity cool ${sec}s` : '';
    }
  } else {
    // Small brass gifts still tick affinity lightly without the meaningful cooldown
    bumpNeighborAffinity(n, Math.min(8, 2 + Math.floor(pay / 10)));
  }
  if (affGranted) {
    applyStanding(inv, Math.min(4, 1 + Math.floor(pay / 15)), {
      districtId: def.homeDistrictId,
      districtDelta: Math.min(6, 2 + Math.floor(pay / 10)),
    });
  }
  // Apply toward debt if any
  if (n.debt && n.debt.amount > 0) {
    const applied = Math.min(n.debt.amount, pay);
    n.debt.amount -= applied;
    n.debtPaidToward += applied;
    if (n.debt.amount <= 0) {
      n.debt = null;
      if (n.drama === 'behind_on_rent' || n.drama === 'homeless') n.drama = 'none';
      tryRescueHomeless(n);
      inv.softGoalFlags.clearedNeighborDebt = true;
      applyStanding(inv, 5, { districtId: def.homeDistrictId, districtDelta: 8 });
      return {
        ok: true,
        msg: `${def.name}: debt cleared with ${pay}b gift (−${pay}). ${neighborStatusLine(n)}`,
      };
    }
    return {
      ok: true,
      msg: `${def.name}: “That helps.” −${pay}b · debt now ${n.debt.amount}b to ${n.debt.landlordName}.${coolBit}`,
    };
  }
  if (n.drama === 'lonely' || n.drama === 'sick_relative') {
    if (pay >= 15) n.drama = 'none';
  }
  if (n.homeless && pay >= 100) {
    // Big gift without full debt clear still eases street life
    bumpNeighborAffinity(n, 4);
  }
  return {
    ok: true,
    msg: `${def.name} pockets ${pay}b${affGranted ? ' · +affinity' : ''} · ${neighborStatusLine(n)}${coolBit}`,
  };
}

/** Soft rescue: clear homeless flag when debt gone and player helped. */
function tryRescueHomeless(n: NeighborState): void {
  if (!n.homeless) return;
  if (n.debt && n.debt.amount > 0) return;
  n.homeless = false;
  n.livelihoodFails = 0;
  n.vacated = false;
  n.vendorOpen = true;
  if (n.drama === 'homeless') n.drama = 'none';
}

/** Pay the NPC landlord the full remaining debt (Task 3). */
export function clearNeighborDebt(
  inv: InventoryState,
  neighborId: string,
): { ok: boolean; msg: string } {
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  if (!n.debt || n.debt.amount <= 0) {
    return { ok: false, msg: `${def.name} doesn’t owe a landlord right now.` };
  }
  const amount = n.debt.amount;
  const landlordName = n.debt.landlordName;
  if (inv.brass < amount) {
    return {
      ok: false,
      msg: `Need ${amount} brass to clear debt to ${landlordName} (you have ${inv.brass}).`,
    };
  }
  inv.brass -= amount;
  n.debt = null;
  n.debtPaidToward += amount;
  if (n.drama === 'behind_on_rent' || n.drama === 'homeless') n.drama = 'none';
  clearEconomicDrama(n);
  tryRescueHomeless(n);
  n.known = true;
  inv.softGoalFlags.metNeighbor = true;
  inv.softGoalFlags.clearedNeighborDebt = true;
  bumpNeighborAffinity(n, 18);
  applyStanding(inv, 6, { districtId: def.homeDistrictId, districtDelta: 10 });
  return {
    ok: true,
    msg: `Paid ${landlordName} ${amount}b for ${def.name}. Debt gone · standing up · affinity +18.`,
  };
}

export function hireNeighbor(
  inv: InventoryState,
  neighborId: string,
): { ok: boolean; msg: string; worker?: WorkerState } {
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  if (n.vacated && !n.homeless) return { ok: false, msg: 'They left the pad.' };
  if (n.hiredAsWorkerId) {
    const existing = inv.workers.find((w) => w.id === n.hiredAsWorkerId);
    if (existing) {
      return { ok: false, msg: `${def.name} already works for you (${existing.name}).` };
    }
    n.hiredAsWorkerId = null;
  }
  if (!inv.parcelLeased && !inv.cityWorkshopLeased) {
    return { ok: false, msg: 'Lease a workshop first — they need a place to report.' };
  }
  if (inv.bayLevel < 1) {
    inv.bayLevel = 1;
    inv.parcelLeased = true;
  }
  const max = maxWorkersForBay(inv.bayLevel);
  if (inv.workers.length >= max) {
    return {
      ok: false,
      msg: `Bay full (${inv.workers.length}/${max}). Expand bay first, then hire ${def.name}.`,
    };
  }
  const cost = Math.max(20, Math.floor(hireCost(inv) * 0.85));
  if (inv.brass < cost) {
    return { ok: false, msg: `Need ${cost} brass to hire ${def.name}.` };
  }
  inv.brass -= cost;
  const w: WorkerState = {
    id: `w_nb_${neighborId}_${Date.now()}`,
    name: def.name.split(' ')[0]!,
    job: 'harvest',
    programId: null,
    hasBoard: false,
    hasSpeedTool: false,
    hasHaulPack: false,
    speedToolTier: 0,
    haulToolTier: 0,
    jobsDone: 0,
    payGrade: 0,
    harvestSiteId: def.homeDistrictId,
    harvestMatId: null,
    flowerMatId: null,
    kind: 'human',
  };
  inv.workers.push(w);
  inv.laborerHired = true;
  n.hiredAsWorkerId = w.id;
  n.known = true;
  inv.softGoalFlags.metNeighbor = true;
  inv.softGoalFlags.hiredNeighbor = true;
  clearEconomicDrama(n);
  if (n.drama === 'lonely' || n.drama === 'expansion_envy' || n.drama === 'homeless') {
    n.drama = 'none';
  }
  // Hiring off the street stabilizes housing fiction (still may owe debt)
  const wasHomeless = !!n.homeless;
  if (wasHomeless) {
    n.homeless = false;
    n.livelihoodFails = 0;
    n.vacated = false;
    n.vendorOpen = false; // on crew, not running their own stand
  }
  bumpNeighborAffinity(n, wasHomeless ? 18 : 14);
  applyStanding(inv, 4, { districtId: def.homeDistrictId, districtDelta: 6 });
  return {
    ok: true,
    worker: w,
    msg:
      `Hired ${def.name} onto the crew (−${cost}b)` +
      (wasHomeless ? ' · off the street' : '') +
      `. Drama eases · ${neighborStatusLine(n)}`,
  };
}

/**
 * Buy the neighbor’s pad from them or their NPC landlord (Task 3).
 * Real plot grid comes in Task 4 — this is virtual deed + optional tenancy.
 * Prices are empire-scale (10k–100k+) with per-pad variance.
 */
export function buyNeighborProperty(
  inv: InventoryState,
  neighborId: string,
  opts?: { keepTenant?: boolean; rentPolicy?: RentPolicy },
): { ok: boolean; msg: string } {
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  if (n.homeOwner === 'player') {
    return { ok: false, msg: `You already own ${def.name}’s pad.` };
  }
  if (n.vacated && n.homeOwner !== 'npc_landlord' && n.homeOwner !== 'self') {
    return { ok: false, msg: 'Pad already gone.' };
  }

  const quote = quoteNeighborPadPrice(def, n.affinity);
  let price = quote.price;
  // NPC landlord portfolios cost a buyout premium; owner-occupiers slightly softer
  if (n.homeOwner === 'npc_landlord') {
    price = Math.round(price * 1.08);
  } else if (n.homeOwner === 'self') {
    price = Math.round(price * 0.97);
  }
  // Outstanding debt must be settled in the deal (full amount to landlord)
  let debtFold = 0;
  if (n.debt && n.debt.amount > 0) {
    debtFold = n.debt.amount;
    price += debtFold;
  }
  const total = price;
  if (inv.brass < total) {
    return {
      ok: false,
      msg:
        `Need ${total.toLocaleString()} brass for ${def.priceTierLabel} pad` +
        (debtFold
          ? ` (list ~${quote.list.toLocaleString()}` +
            (quote.discount ? ` −${quote.discount.toLocaleString()} affinity` : '') +
            ` + ${debtFold.toLocaleString()}b debt to ${n.debt!.landlordName})`
          : quote.discount
            ? ` (list ${quote.list.toLocaleString()} −${quote.discount.toLocaleString()} affinity)`
            : ` (list ${quote.list.toLocaleString()})`) +
        ` — you have ${inv.brass.toLocaleString()}.`,
    };
  }
  inv.brass -= total;
  // Clear debt as part of buyout
  if (n.debt) {
    n.debtPaidToward += n.debt.amount;
    n.debt = null;
    inv.softGoalFlags.clearedNeighborDebt = true;
  }
  n.homeOwner = 'player';
  n.landlordId = null;
  n.known = true;
  inv.softGoalFlags.metNeighbor = true;
  inv.softGoalFlags.ownedPlot = true;
  if (n.drama === 'behind_on_rent') n.drama = 'none';

  const keep = opts?.keepTenant !== false; // default keep as tenant
  const policy: RentPolicy = opts?.rentPolicy ?? 'fair';
  const rentPerTick = rentIncomeForPad(def.basePrice, policy);
  if (keep && !n.vacated) {
    n.isPlayerTenant = true;
    n.rentPolicy = policy;
    bumpNeighborAffinity(
      n,
      policy === 'cheap' ? 12 : policy === 'fair' ? 6 : -8,
    );
    if (policy === 'cheap') {
      applyStanding(inv, 4, { districtId: def.homeDistrictId, districtDelta: 6 });
    } else if (policy === 'fair') {
      applyStanding(inv, 2, { districtId: def.homeDistrictId, districtDelta: 3 });
    } else {
      applyStanding(inv, -2, { districtId: def.homeDistrictId, districtDelta: -4 });
    }
  } else {
    n.isPlayerTenant = false;
    n.rentPolicy = null;
    applyStanding(inv, 1, { districtId: def.homeDistrictId, districtDelta: 2 });
  }

  // Task 4: transfer linked plaza plot deed (no second charge)
  ensureInvPlots(inv);
  let plotBit = '';
  const linked = inv.plazaPlots.plots.find(
    (p) =>
      p.districtId === def.homeDistrictId &&
      (p.npcOwnerId === neighborId || p.tenantNeighborId === neighborId) &&
      p.owner !== 'player',
  );
  if (linked) {
    linked.owner = 'player';
    linked.forSale = false;
    linked.npcOwnerId = null;
    if (keep && !n.vacated) {
      linked.tenantNeighborId = neighborId;
      linked.rentPolicy = policy;
      linked.vacant = false;
    } else {
      linked.tenantNeighborId = null;
      linked.rentPolicy = null;
      linked.vacant = true;
    }
    plotBit = ` · grid plot (${linked.cellX},${linked.cellY}) deeded`;
  }

  return {
    ok: true,
    msg:
      `Bought ${def.name}’s pad (−${total.toLocaleString()}b · ${def.priceTierLabel})` +
      (debtFold ? ` · cleared ${debtFold.toLocaleString()}b landlord debt` : '') +
      (quote.discount ? ` · affinity saved ${quote.discount.toLocaleString()}b` : '') +
      (keep
        ? ` · tenant stays at ${policy} rent (${rentPerTick.toLocaleString()}b / upkeep tick)`
        : ' · empty pad') +
      plotBit,
  };
}

export function setNeighborRentPolicy(
  inv: InventoryState,
  neighborId: string,
  policy: RentPolicy,
): { ok: boolean; msg: string } {
  const def = neighborDef(neighborId);
  const n = getInvNeighbor(inv, neighborId);
  if (!def || !n) return { ok: false, msg: 'Nobody home.' };
  if (n.homeOwner !== 'player') {
    return { ok: false, msg: 'You don’t own this pad yet.' };
  }
  if (!n.isPlayerTenant || n.vacated) {
    return { ok: false, msg: 'No tenant on this pad.' };
  }
  const prev = n.rentPolicy;
  n.rentPolicy = policy;
  const rent = rentIncomeForPad(def.basePrice, policy);
  if (policy === 'cheap') {
    bumpNeighborAffinity(n, 4);
    applyStanding(inv, 2, { districtId: def.homeDistrictId, districtDelta: 3 });
  } else if (policy === 'predatory') {
    bumpNeighborAffinity(n, -6);
    applyStanding(inv, -2, { districtId: def.homeDistrictId, districtDelta: -3 });
  }
  return {
    ok: true,
    msg: `${def.name} rent ${prev ?? '—'} → ${policy} (${rent.toLocaleString()}b / tick · ${def.priceTierLabel}).`,
  };
}

export interface NeighborRentTickResult {
  collected: number;
  left: { id: string; name: string }[];
  msgs: string[];
}

/** Vacant player-owned residential home that can take a tenant. */
export interface VacantPlayerHome {
  homeKind: 'neighbor_pad' | 'plot';
  homeKey: string;
  label: string;
  basePrice: number;
  districtId: string;
}

/** Pads you own that are empty (left / never tenanted). */
export function listVacantPlayerHomes(inv: InventoryState): VacantPlayerHome[] {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  ensureInvPlots(inv);
  const out: VacantPlayerHome[] = [];
  for (const n of inv.neighborLife.neighbors) {
    if (n.homeOwner !== 'player') continue;
    if (n.isPlayerTenant && !n.vacated) continue;
    // Vacant pad you own
    if (n.vacated || !n.isPlayerTenant) {
      const def = neighborDef(n.id);
      out.push({
        homeKind: 'neighbor_pad',
        homeKey: n.id,
        label: def ? `${def.name}'s pad` : n.id,
        basePrice: def?.basePrice ?? 10_000,
        districtId: def?.homeDistrictId ?? 'residential',
      });
    }
  }
  for (const p of playerOwnedPlots(inv.plazaPlots)) {
    if (!p.vacant && p.tenantNeighborId) continue;
    const builds = p.buildings ?? [];
    if (builds.length > 0) {
      const res = builds.some(
        (b) => b.kind === 'home' || b.kind === 'apartment',
      );
      if (!res) continue; // retail/garden/etc. only — no residential tenancy
    }
    // Empty lots or residential builds can take a tenant
    if (p.vacant || !p.tenantNeighborId) {
      const dist = districtById(p.districtId);
      out.push({
        homeKind: 'plot',
        homeKey: p.id,
        label: `${dist?.name ?? p.districtId} plot (${p.cellX},${p.cellY})`,
        basePrice: Math.max(8_000, Math.round((dist?.stallCost ?? 100) * 80)),
        districtId: p.districtId,
      });
    }
  }
  return out;
}

function neighborSeekingHousing(n: NeighborState): boolean {
  if (n.hiredAsWorkerId) {
    return false; // on crew — housed via job fiction
  }
  if (n.isPlayerTenant && !n.vacated) return false;
  if (n.homeless) return true;
  if (n.drama === 'homeless') return true;
  // Left a pad or never housed, not currently on a player lease
  if (n.vacated && n.homeOwner !== 'player') return true;
  if (n.vacated && n.homeOwner === 'player' && !n.isPlayerTenant) return true;
  if (n.drama === 'behind_on_rent' && n.homeOwner === 'npc_landlord') return true;
  return false;
}

function pickRentOfferPolicy(applicant: NeighborState): RentPolicy {
  // Affinity + desperation shape what they can pay
  if (applicant.homeless || applicant.drama === 'homeless') {
    return Math.random() < 0.65 ? 'cheap' : 'fair';
  }
  if ((applicant.affinity ?? 0) >= 40 && Math.random() < 0.2) return 'predatory';
  if (Math.random() < 0.35) return 'cheap';
  return 'fair';
}

/**
 * Generate NPC rent offers for vacant player homes (return / new tenants).
 * Called on landlord rent clock.
 */
export function tickTenantOffers(inv: InventoryState): {
  msgs: string[];
  newOffers: TenantOffer[];
} {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  const life = inv.neighborLife;
  if (!life.pendingTenantOffers) life.pendingTenantOffers = [];
  const vacant = listVacantPlayerHomes(inv);
  const vacantKeys = new Set(vacant.map((v) => `${v.homeKind}:${v.homeKey}`));

  // Drop offers for homes no longer vacant or applicants no longer seeking
  life.pendingTenantOffers = life.pendingTenantOffers.filter((o) => {
    if (!vacantKeys.has(`${o.homeKind}:${o.homeKey}`)) return false;
    const app = getInvNeighbor(inv, o.applicantId);
    return !!app && neighborSeekingHousing(app);
  });

  const msgs: string[] = [];
  const newOffers: TenantOffer[] = [];
  if (!vacant.length) return { msgs, newOffers };

  const seekers = life.neighbors.filter(neighborSeekingHousing);
  if (!seekers.length) return { msgs, newOffers };

  // Cap open offers
  if (life.pendingTenantOffers.length >= 6) return { msgs, newOffers };

  for (const home of vacant) {
    if (life.pendingTenantOffers.length >= 6) break;
    // Already have an offer on this home?
    if (life.pendingTenantOffers.some((o) => o.homeKind === home.homeKind && o.homeKey === home.homeKey)) {
      continue;
    }
    // Chance per vacant home per rent tick
    if (Math.random() > 0.42) continue;

    // Neighbor pads: only the original resident can return (pad entity = person).
    // Plaza plots: any seeker can apply.
    let applicant: NeighborState | undefined;
    if (home.homeKind === 'neighbor_pad') {
      const orig = getInvNeighbor(inv, home.homeKey);
      if (orig && neighborSeekingHousing(orig)) applicant = orig;
      else continue;
    } else {
      const pendingApps = new Set(life.pendingTenantOffers.map((o) => o.applicantId));
      const pool = seekers.filter((s) => !pendingApps.has(s.id));
      if (!pool.length) continue;
      pool.sort((a, b) => Number(!!b.homeless) - Number(!!a.homeless));
      applicant = pool[Math.floor(Math.random() * Math.min(4, pool.length))]!;
    }
    if (!applicant) continue;

    const def = neighborDef(applicant.id);
    const policy = pickRentOfferPolicy(applicant);
    const rent = rentIncomeForPad(home.basePrice, policy);
    const returning =
      home.homeKind === 'neighbor_pad' && applicant.id === home.homeKey;
    const name = def?.name ?? applicant.id;
    const pitch = returning
      ? `${name} wants to return home · offers ${policy} rent (${rent.toLocaleString()}b/tick).`
      : `${name} seeks a pad at ${home.label} · offers ${policy} rent (${rent.toLocaleString()}b/tick).`;

    const offer: TenantOffer = {
      id: `to_${home.homeKind}_${home.homeKey}_${applicant.id}_${Date.now().toString(36)}`,
      applicantId: applicant.id,
      homeKind: home.homeKind,
      homeKey: home.homeKey,
      offeredPolicy: policy,
      offeredRent: rent,
      pitch,
    };
    life.pendingTenantOffers.push(offer);
    newOffers.push(offer);
    msgs.push(pitch);
  }
  return { msgs, newOffers };
}

export function listPendingTenantOffers(inv: InventoryState): TenantOffer[] {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  return [...(inv.neighborLife.pendingTenantOffers ?? [])];
}

export function rejectTenantOffer(
  inv: InventoryState,
  offerId: string,
): { ok: boolean; msg: string } {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  const list = inv.neighborLife.pendingTenantOffers ?? [];
  const idx = list.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, msg: 'Offer already gone.' };
  const o = list[idx]!;
  list.splice(idx, 1);
  const def = neighborDef(o.applicantId);
  return {
    ok: true,
    msg: `Declined ${def?.name ?? 'applicant'}'s rent offer.`,
  };
}

/** Accept an NPC's rent offer — they move into your vacant property. */
export function acceptTenantOffer(
  inv: InventoryState,
  offerId: string,
): { ok: boolean; msg: string } {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const list = inv.neighborLife.pendingTenantOffers ?? [];
  const idx = list.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, msg: 'Offer expired.' };
  const o = list[idx]!;
  const applicant = getInvNeighbor(inv, o.applicantId);
  const def = neighborDef(o.applicantId);
  if (!applicant || !def) {
    list.splice(idx, 1);
    return { ok: false, msg: 'Applicant left the city.' };
  }

  if (o.homeKind === 'neighbor_pad') {
    const pad = getInvNeighbor(inv, o.homeKey);
    if (!pad || pad.homeOwner !== 'player') {
      list.splice(idx, 1);
      return { ok: false, msg: 'You no longer own that pad.' };
    }
    if (pad.isPlayerTenant && !pad.vacated) {
      list.splice(idx, 1);
      return { ok: false, msg: 'Pad already has a tenant.' };
    }
    if (applicant.id !== pad.id) {
      list.splice(idx, 1);
      return { ok: false, msg: 'Only the original resident can re-lease this pad.' };
    }
    applicant.vacated = false;
    applicant.isPlayerTenant = true;
    applicant.rentPolicy = o.offeredPolicy;
    applicant.homeless = false;
    if (applicant.drama === 'homeless') applicant.drama = 'none';
    applicant.livelihoodFails = 0;
  } else {
    const plot = getPlot(inv.plazaPlots, o.homeKey);
    if (!plot || plot.owner !== 'player') {
      list.splice(idx, 1);
      return { ok: false, msg: 'You no longer own that plot.' };
    }
    if (!plot.vacant && plot.tenantNeighborId) {
      list.splice(idx, 1);
      return { ok: false, msg: 'Plot already has a tenant.' };
    }
    plot.vacant = false;
    plot.tenantNeighborId = applicant.id;
    plot.rentPolicy = o.offeredPolicy;
    applicant.homeOwner = 'player';
    applicant.isPlayerTenant = true;
    applicant.rentPolicy = o.offeredPolicy;
    applicant.vacated = false;
    applicant.homeless = false;
    if (applicant.drama === 'homeless') applicant.drama = 'none';
    applicant.livelihoodFails = 0;
  }

  // Remove all offers for this home + this applicant
  inv.neighborLife.pendingTenantOffers = list.filter(
    (x) =>
      x.id !== o.id &&
      !(x.homeKind === o.homeKind && x.homeKey === o.homeKey) &&
      x.applicantId !== o.applicantId,
  );

  bumpNeighborAffinity(applicant, 10);
  applyStanding(inv, 2, {
    districtId: def.homeDistrictId,
    districtDelta: 3,
  });
  return {
    ok: true,
    msg:
      `Accepted ${def.name} · ${o.offeredPolicy} rent ${o.offeredRent.toLocaleString()}b/tick. ` +
      `They're moving in.`,
  };
}

/** Collect tenant rent on bay upkeep clock; predatory may cause leave. */
export function tickNeighborRents(inv: InventoryState): NeighborRentTickResult {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  let collected = 0;
  const left: { id: string; name: string }[] = [];
  const msgs: string[] = [];
  for (const n of inv.neighborLife.neighbors) {
    if (n.homeOwner !== 'player' || !n.isPlayerTenant || n.vacated || !n.rentPolicy) {
      continue;
    }
    const def = neighborDef(n.id);
    const base = def?.basePrice ?? 10_000;
    const income = rentIncomeForPad(base, n.rentPolicy);
    inv.brass += income;
    collected += income;
    notePeakBrass(inv);
    if (n.rentPolicy === 'predatory' && Math.random() < PREDATORY_LEAVE_CHANCE) {
      n.vacated = true;
      n.isPlayerTenant = false;
      n.rentPolicy = null;
      n.drama = 'none';
      bumpNeighborAffinity(n, -20);
      applyStanding(inv, -4, {
        districtId: def?.homeDistrictId ?? 'residential',
        districtDelta: -6,
      });
      const name = def?.name ?? n.id;
      left.push({ id: n.id, name });
      msgs.push(`${name} left after predatory rent — pad vacant.`);
    } else if (n.rentPolicy === 'cheap') {
      bumpNeighborAffinity(n, 0.5);
    }
  }
  if (collected > 0 && !left.length) {
    msgs.push(`Tenant rent +${collected}b.`);
  }
  return { collected, left, msgs };
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
    forcedClosed: false,
    lastSalesDrivers: '',
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
 * - applyUpgrade + new placement → append building (keeps prior models)
 * - redesign + replaceIndex → replace that building only
 * - redesign without index → replace last / only building
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
    /**
     * When redesigning, which building to replace.
     * Omit / null when placing an additional building on expand.
     */
    replaceIndex?: number | null;
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
  const replaceIdx =
    typeof opts.replaceIndex === 'number' && opts.replaceIndex >= 0
      ? opts.replaceIndex
      : redesign
        ? 0
        : -1; // -1 = append

  let list: FactoryLayout[] =
    opts.kind === 'storage' && opts.storageTrack
      ? [...storageBuildings(inv, opts.storageTrack)]
      : [...bayWingBuildings(inv)];

  const prev =
    replaceIdx >= 0 && replaceIdx < list.length ? list[replaceIdx]! : null;
  const prevBuild = prev?.built
    ? quoteFactoryBuild({ form: prev.form, props: prev.props, baseCost: 0 }).total
    : 0;
  const newBuild = quoteFactoryBuild({
    form: next.form,
    props: next.props,
    baseCost: 0,
  }).total;
  // New buildings pay full cosmetics; replacements pay only the upgrade delta
  const cosmeticsDelta =
    prev && replaceIdx >= 0 ? Math.max(0, newBuild - prevBuild) : newBuild;
  const base = redesign || !opts.applyUpgrade ? 0 : (opts.baseCost ?? 0);
  const charge = base + cosmeticsDelta;

  if (opts.applyUpgrade && !redesign) {
    if (opts.kind === 'storage' && opts.storageTrack) {
      const from = getStorageLevel(inv, opts.storageTrack);
      if (from >= STORAGE_MAX_LEVEL) {
        return { ok: false, msg: 'Storage already maxed.', charged: 0 };
      }
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
    list = [...list, next];
    setBayWingBuildings(inv, list);
    inv.bayWingLayoutPaid = (inv.bayWingLayoutPaid ?? 0) + cosmeticsDelta;
    return {
      ok: true,
      charged: (opts.baseCost ?? 0) + cosmeticsDelta,
      msg: `Bay expanded · new factory wing placed (−${(opts.baseCost ?? 0) + cosmeticsDelta}b). Prior wings kept.`,
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
    if (replaceIdx >= 0 && replaceIdx < list.length) {
      list[replaceIdx] = next;
    } else {
      list.push(next);
    }
    setStorageBuildings(inv, opts.storageTrack, list);
    if (!inv.storageLayoutPaid) inv.storageLayoutPaid = {};
    inv.storageLayoutPaid[opts.storageTrack] =
      (inv.storageLayoutPaid[opts.storageTrack] ?? 0) + charge;
    const n = list.length;
    return {
      ok: true,
      charged: charge,
      msg:
        replaceIdx >= 0
          ? charge > 0
            ? `Storage factory replaced (−${charge}b). ${n} building(s) on site.`
            : `Storage factory updated. ${n} building(s) on site.`
          : charge > 0
            ? `New storage factory placed (−${charge}b). ${n} building(s) kept.`
            : `New storage factory placed. ${n} building(s) on site.`,
    };
  }

  // Bay wing redesign / extra wing without capacity bump
  if (replaceIdx >= 0 && replaceIdx < list.length) {
    list[replaceIdx] = next;
  } else {
    list.push(next);
  }
  setBayWingBuildings(inv, list);
  inv.bayWingLayoutPaid = (inv.bayWingLayoutPaid ?? 0) + charge;
  return {
    ok: true,
    charged: charge,
    msg:
      charge > 0
        ? `Bay factory updated (−${charge}b). ${list.length} wing(s).`
        : `Bay factory updated. ${list.length} wing(s).`,
  };
}

/** Residential home-island center (matches skyCity apartment pad). */
export function apartmentAnchorXZ(): { x: number; z: number } {
  const r = CITY_DISTRICTS.find((d) => d.id === 'residential')!;
  return { x: r.x - 32, z: r.z + 20 };
}

export function ensureDefaultHomeLayout(inv: InventoryState): HomeLayout {
  if (inv.apartmentLayout?.built) return inv.apartmentLayout;
  const a = apartmentAnchorXZ();
  inv.apartmentLayout = {
    plotX: a.x,
    plotZ: a.z,
    yaw: 0,
    tier: 'cottage',
    color: 0,
    props: [],
    rooms: [{ kind: 'living', lx: 0, lz: 0, yaw: 0 }],
    built: true,
  };
  inv.apartmentLayoutPaid = inv.apartmentLayoutPaid ?? 0;
  return inv.apartmentLayout;
}

export function homeHasRoom(inv: InventoryState, kind: HomeRoomKind): boolean {
  const rooms = inv.apartmentLayout?.rooms;
  if (!rooms?.length) return false;
  return rooms.some((r) => r.kind === kind);
}

export function quoteHomeBuild(opts: {
  tier: HomeTier;
  color: number;
  rooms?: HomeRoom[];
  props?: SiteProp[];
}): {
  total: number;
  tierFee: number;
  roomFee: number;
  propFee: number;
  colorFee: number;
} {
  const tierFee = HOME_TIER_EXTRA[opts.tier] ?? 0;
  let roomFee = 0;
  for (const r of opts.rooms ?? []) roomFee += HOME_ROOM_COST[r.kind] ?? 0;
  const propFee = sumPropCosts(opts.props, HOME_PROP_COST);
  const c = Math.max(0, Math.min(5, opts.color | 0));
  const colorFee = c === 0 ? 0 : 25 + c * 20;
  return {
    tierFee,
    roomFee,
    propFee,
    colorFee,
    total: tierFee + roomFee + propFee + colorFee,
  };
}

export function isValidHomePlot(x: number, z: number, tier: HomeTier): boolean {
  const a = apartmentAnchorXZ();
  const pad =
    tier === 'island'
      ? 64
      : tier === 'estate'
        ? 48
        : tier === 'manor'
          ? 34
          : tier === 'house'
            ? 22
            : 14;
  const reach = pad * 0.55 + 8;
  return Math.hypot(x - a.x, z - a.z) <= reach;
}

function normalizeHomeLayout(layout: HomeLayout): HomeLayout {
  const tier = (['cottage', 'house', 'manor', 'estate', 'island'] as HomeTier[]).includes(
    layout.tier as HomeTier,
  )
    ? layout.tier
    : 'cottage';
  let rooms = Array.isArray(layout.rooms)
    ? layout.rooms.map((r) => ({
        kind: r.kind,
        lx: Number(r.lx) || 0,
        lz: Number(r.lz) || 0,
        yaw: Number(r.yaw) || 0,
      }))
    : [];
  if (!rooms.length) rooms = [{ kind: 'living', lx: 0, lz: 0, yaw: 0 }];
  // Always keep a living room; trim to tier cap
  if (!rooms.some((r) => r.kind === 'living')) {
    rooms.unshift({ kind: 'living', lx: 0, lz: 0, yaw: 0 });
  }
  const cap = HOME_ROOM_CAP[tier] ?? 1;
  if (rooms.length > cap) rooms = rooms.slice(0, cap);
  // Persist resolved wing positions + axis-aligned yaw (stable interacts / colliders)
  rooms = resolveHomeRoomsForSave(rooms, tier);
  const step = Math.PI / 2;
  const yaw = Math.round((Number(layout.yaw) || 0) / step) * step;
  return {
    plotX: layout.plotX,
    plotZ: layout.plotZ,
    yaw,
    tier,
    color: Math.max(0, Math.min(5, layout.color | 0)),
    props: Array.isArray(layout.props)
      ? layout.props.map((p) => ({
          id: p.id,
          lx: Number(p.lx) || 0,
          lz: Number(p.lz) || 0,
          yaw: Number(p.yaw) || 0,
          interior: !!p.interior,
        }))
      : [],
    rooms,
    built: layout.built,
  };
}

/** Inline resolve so economy does not import homeBuild (avoid cycles via game). */
function resolveHomeRoomsForSave(rooms: HomeRoom[], tier: HomeTier): HomeRoom[] {
  const pad =
    tier === 'island' ? 64 : tier === 'estate' ? 48 : tier === 'manor' ? 34 : tier === 'house' ? 22 : 14;
  const list = rooms.map((r) => ({ ...r }));
  const wings = list.filter((r) => r.kind !== 'living');
  const step = Math.PI / 2;
  for (const placed of list) {
    if (placed.kind === 'living') {
      placed.lx = 0;
      placed.lz = 0;
      placed.yaw = 0;
      continue;
    }
    if (Math.abs(placed.lx) < 0.1 && Math.abs(placed.lz) < 0.1) {
      const idx = wings.indexOf(placed);
      const a = (idx / Math.max(1, wings.length)) * Math.PI * 2 - Math.PI / 2;
      const rad = pad * 0.28;
      placed.lx = Math.cos(a) * rad;
      placed.lz = Math.sin(a) * rad;
    }
    placed.yaw = Math.round(placed.yaw / step) * step;
  }
  return list;
}

export function finalizeHomeBuild(
  inv: InventoryState,
  layout: HomeLayout,
  opts?: { redesign?: boolean },
): { ok: boolean; msg: string; charged: number } {
  if (!inv.apartmentOwned) {
    return { ok: false, msg: 'Buy an apartment deed first.', charged: 0 };
  }
  const next = normalizeHomeLayout({ ...layout, built: true });
  if (!isValidHomePlot(next.plotX, next.plotZ, next.tier)) {
    return {
      ok: false,
      msg: 'Home site must stay on your home island.',
      charged: 0,
    };
  }
  const cap = HOME_ROOM_CAP[next.tier] ?? 1;
  if (next.rooms.length > cap) {
    return {
      ok: false,
      msg: `${next.tier} holds at most ${cap} rooms.`,
      charged: 0,
    };
  }
  const buildQuote = quoteHomeBuild({
    tier: next.tier,
    color: next.color,
    rooms: next.rooms,
    props: next.props,
  });
  const redesign = !!opts?.redesign && !!inv.apartmentLayout?.built;
  let charge: number;
  if (redesign && inv.apartmentLayout) {
    const prev = normalizeHomeLayout(inv.apartmentLayout);
    const prevBuild = quoteHomeBuild({
      tier: prev.tier,
      color: prev.color,
      rooms: prev.rooms,
      props: prev.props,
    }).total;
    charge = Math.max(0, buildQuote.total - prevBuild);
  } else {
    // First customize after deed — cottage base is free; only extras charge
    charge = buildQuote.total;
  }
  if (inv.brass < charge) {
    return {
      ok: false,
      msg: `Need ${charge} brass (have ${inv.brass}).`,
      charged: 0,
    };
  }
  inv.brass -= charge;
  inv.apartmentLayout = next;
  inv.apartmentLayoutPaid = (inv.apartmentLayoutPaid ?? 0) + charge;
  notePeakBrass(inv);
  return {
    ok: true,
    charged: charge,
    msg: redesign
      ? charge > 0
        ? `Home updated (−${charge}b).`
        : 'Home updated (no extra charge).'
      : charge > 0
        ? `Home built (−${charge}b). Expand toward a private island!`
        : 'Cottage ready — expand when you can afford it.',
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
  // L3→4: 150, then ~1.38× each step (was 180 × 1.65 — scaled too hard)
  return Math.round(150 * Math.pow(1.38, fromLevel - 3));
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
  'speed_tool_fine',
  'haul_pack',
  'haul_pack_fine',
  'polished_wire',
  'brass_charm',
  'silk_scarf',
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

/**
 * Pay-raise rank ladder (grade = number of raises from hire).
 * Grade 5 = Apprentice Inventor — may run invent_recipe nodes.
 */
export const APPRENTICE_INVENTOR_GRADE = 5;

export interface PayGradeRank {
  grade: number;
  title: string;
  blurb: string;
}

export const PAY_GRADE_RANKS: PayGradeRank[] = [
  { grade: 0, title: 'Dock Hand', blurb: 'Entry crew · short programs only' },
  { grade: 1, title: 'Bay Runner', blurb: 'First raise · longer hauls' },
  { grade: 2, title: 'Floor Hand', blurb: 'Steady craft work' },
  { grade: 3, title: 'Journeyman', blurb: 'Multi-step programs' },
  { grade: 4, title: 'Specialist', blurb: 'Complex automation routes' },
  {
    grade: 5,
    title: 'Apprentice Inventor',
    blurb: 'May invent new recipes on programs',
  },
  { grade: 6, title: 'Workshop Lead', blurb: 'Senior automation authority' },
  { grade: 7, title: 'Master Artisan', blurb: 'Peak craft & program length' },
  { grade: 8, title: 'Chief Inventor', blurb: 'Empire R&D rank' },
];

export function payGradeTitle(grade: number): string {
  const g = Math.max(0, Math.floor(grade));
  const exact = PAY_GRADE_RANKS.find((r) => r.grade === g);
  if (exact) return exact.title;
  const top = PAY_GRADE_RANKS[PAY_GRADE_RANKS.length - 1]!;
  if (g > top.grade) return `${top.title} ${g - top.grade + 1}`;
  // Between defined ranks — use nearest lower
  let best = PAY_GRADE_RANKS[0]!;
  for (const r of PAY_GRADE_RANKS) {
    if (r.grade <= g) best = r;
  }
  return best.title;
}

export function payGradeBlurb(grade: number): string {
  const g = Math.max(0, Math.floor(grade));
  const exact = PAY_GRADE_RANKS.find((r) => r.grade === g);
  if (exact) return exact.blurb;
  if (g >= APPRENTICE_INVENTOR_GRADE) return 'Invent rights · long programs';
  return 'Raise pay for longer programs';
}

/** True when crew may run invent_recipe (new inventions). */
export function canWorkerInvent(w: WorkerState): boolean {
  return (w.payGrade ?? 0) >= APPRENTICE_INVENTOR_GRADE;
}

export function minPayGradeForNodes(nodeCount: number): number {
  return Math.max(0, Math.ceil((nodeCount - PROGRAM_FREE_NODES) / 2));
}

/** Programs with invent_recipe need at least Apprentice Inventor. */
export function minPayGradeForProgram(p: WorkerProgram): number {
  const byLen = minPayGradeForNodes(p.nodes.length);
  const needsInvent = p.nodes.includes('invent_recipe');
  return needsInvent ? Math.max(byLen, APPRENTICE_INVENTOR_GRADE) : byLen;
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

export function chatRomanceNpc(
  inv: InventoryState,
  npcId: string,
  worldSeed = 1,
): { ok: boolean; msg: string; stage: RelationshipStage } {
  const def = getRomanceDef(npcId, worldSeed);
  if (!def) return { ok: false, msg: 'She has already moved on.', stage: 0 };
  const rel = ensureRomanceState(inv, npcId);
  const prev = rel.stage;
  // Small warm-up from conversation
  rel.affinity = Math.min(120, rel.affinity + 3 + (rel.stage >= 2 ? 2 : 0));
  recomputeRomanceStage(rel);
  const line = def.chatByStage[rel.stage] ?? def.chatByStage[0]!;
  const stageNote =
    rel.stage > prev
      ? ` · Now ${RELATIONSHIP_STAGE_NAMES[rel.stage]}.`
      : ` · ${RELATIONSHIP_STAGE_NAMES[rel.stage]} (${rel.affinity}).`;
  return {
    ok: true,
    stage: rel.stage,
    msg: `${def.name}: “${line}”${stageNote}`,
  };
}

export function learnRomanceLikes(
  inv: InventoryState,
  npcId: string,
  worldSeed = 1,
): { ok: boolean; msg: string; stage: RelationshipStage } {
  const def = getRomanceDef(npcId, worldSeed);
  if (!def) return { ok: false, msg: 'She has already moved on.', stage: 0 };
  const rel = ensureRomanceState(inv, npcId);
  const first = !rel.knownLikes;
  rel.knownLikes = true;
  if (first) {
    rel.affinity = Math.min(120, rel.affinity + 6);
    recomputeRomanceStage(rel);
  }
  const about = def.aboutLines[Math.floor(Math.random() * def.aboutLines.length)]!;
  return {
    ok: true,
    stage: rel.stage,
    msg: `${def.name}: “${about}” · Likes: ${def.likesHint} · Avoid: ${def.dislikesHint}`,
  };
}

export function giftRomanceNpc(
  inv: InventoryState,
  npcId: string,
  gift: CommodityId,
  worldSeed = 1,
): { ok: boolean; msg: string; stage: RelationshipStage; delta: number } {
  const def = getRomanceDef(npcId, worldSeed);
  if (!def) {
    return { ok: false, msg: 'She has already moved on.', stage: 0, delta: 0 };
  }
  if (!(ROMANCE_GIFT_IDS as readonly string[]).includes(gift)) {
    return {
      ok: false,
      msg: `${COMMODITIES[gift]?.name ?? gift} isn’t something you’d offer as a gift.`,
      stage: 0,
      delta: 0,
    };
  }
  if (getQty(inv, gift) < 1) {
    return {
      ok: false,
      msg: `No ${COMMODITIES[gift].name} in pack.`,
      stage: 0,
      delta: 0,
    };
  }
  removeItem(inv, gift, 1);
  const rel = ensureRomanceState(inv, npcId);
  const prev = rel.stage;
  const name = COMMODITIES[gift].name;
  let delta = 8;
  let reaction: string;
  if (def.loves.includes(gift)) {
    delta =
      gift === 'silk_scarf' || gift === 'brass_charm'
        ? 26
        : gift === 'flower_gift'
          ? 18
          : 16;
    reaction = `Her eyes light up at the ${name}.`;
  } else if (def.dislikes.includes(gift)) {
    delta = gift === 'silk_scarf' || gift === 'brass_charm' ? -18 : -12;
    reaction = `She stiffens. The ${name} was a misread.`;
  } else {
    delta = 5;
    reaction = `She accepts the ${name} politely.`;
  }
  rel.affinity = Math.max(0, Math.min(120, rel.affinity + delta));
  if (delta > 0) rel.giftsGiven += 1;
  recomputeRomanceStage(rel);
  // Soft brand: good gifts raise standing; misreads cost a little face
  if (delta >= 16) applyStanding(inv, 2);
  else if (delta > 0) applyStanding(inv, 1);
  else if (delta < 0) applyStanding(inv, -1);
  const stageBit =
    rel.stage > prev
      ? ` Now ${RELATIONSHIP_STAGE_NAMES[rel.stage]}.`
      : rel.stage < prev
        ? ` Now only ${RELATIONSHIP_STAGE_NAMES[rel.stage]}.`
        : ` (${RELATIONSHIP_STAGE_NAMES[rel.stage]}, ${rel.affinity})`;
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  return {
    ok: true,
    stage: rel.stage,
    delta,
    msg: `${def.name}: ${reaction} ${sign} affinity.${stageBit}`,
  };
}

export type RomanceStoryId = GenRomanceStoryId;

export interface StoryShareContext {
  companionName: string;
  whoOf: string;
  how: string;
  why: string;
  remains: string;
  moral: string;
  /** Player backstory seed — drives unique tellings per playthrough */
  worldSeed: number;
}

function buildPlayerStoryContext(inv: InventoryState, ctx: StoryShareContext): PlayerStoryContext {
  const workers = inv.workers.filter((w) => !w.unpaid);
  const invent = [...inv.customRecipes].sort(
    (a, b) => (b.quality ?? 1) * b.sellValue - (a.quality ?? 1) * a.sellValue,
  )[0];
  const matTotal = (['cloud_iron', 'scrap_brass', 'spore_silk', 'sky_salt'] as CommodityId[]).reduce(
    (s, id) => s + getQty(inv, id),
    0,
  );
  const blooms = (FLOWER_IDS as readonly CommodityId[]).reduce((s, id) => s + getQty(inv, id), 0);
  return {
    companionName: ctx.companionName,
    whoOf: ctx.whoOf,
    how: ctx.how,
    why: ctx.why,
    remains: ctx.remains,
    moral: ctx.moral,
    workerNames: workers.map((w) => w.name),
    workerCount: workers.length,
    unpaidCount: inv.workers.filter((w) => w.unpaid).length,
    topInvention: invent
      ? { name: invent.name, quality: invent.quality ?? 1, sellValue: invent.sellValue }
      : undefined,
    inventionCount: inv.customRecipes.length,
    brass: inv.brass,
    matTotal,
    blooms,
    harvestRuns: inv.harvestRuns,
    bayLevel: inv.bayLevel,
    cityWorkshop: inv.cityWorkshopLeased,
    apartment: inv.apartmentOwned,
    stalls: ownedCityStallCount(inv),
    peakBrass: inv.peakBrass ?? inv.brass,
  };
}

export function listRomanceStories(
  inv: InventoryState,
  npcId: string,
  ctx: StoryShareContext,
): {
  id: RomanceStoryId;
  title: string;
  locked: boolean;
  reason?: string;
  preview: string;
}[] {
  const rel = ensureRomanceState(inv, npcId);
  const shared = new Set(rel.storiesShared ?? []);
  const pctx = buildPlayerStoryContext(inv, ctx);
  const seedBase = ctx.worldSeed || 1;

  const beats: {
    id: RomanceStoryId;
    title: string;
    minStage: number;
    require?: () => string | null;
  }[] = [
    { id: 'origin', title: 'Your origin', minStage: 2 },
    {
      id: 'companion',
      title: `${ctx.companionName} — the soul you woke`,
      minStage: 2,
    },
    { id: 'crew', title: 'Your crew', minStage: 2 },
    {
      id: 'invention',
      title: 'Proudest invention',
      minStage: 3,
      require: () =>
        pctx.topInvention ? null : 'Invent something first (bay L3 / workshop lab).',
    },
    { id: 'resources', title: 'What the shelves taught you', minStage: 2 },
    { id: 'workshop', title: 'Your workshop path', minStage: 3 },
  ];

  return beats.map((b) => {
    const need = b.require?.() ?? null;
    const locked = rel.stage < b.minStage || !!need || shared.has(b.id);
    let reason: string | undefined;
    if (shared.has(b.id)) reason = 'Already shared';
    else if (rel.stage < b.minStage) {
      reason = `Need ${RELATIONSHIP_STAGE_NAMES[b.minStage as RelationshipStage]}+ (now ${RELATIONSHIP_STAGE_NAMES[rel.stage]})`;
    } else if (need) reason = need;
    const tellSeed = storyTellSeed(seedBase, npcId, b.id, rel.affinity);
    const preview = formatPlayerStoryBeat(b.id, pctx, tellSeed);
    return {
      id: b.id,
      title: b.title,
      locked,
      reason,
      preview,
    };
  });
}

export function shareRomanceStory(
  inv: InventoryState,
  npcId: string,
  storyId: RomanceStoryId,
  ctx: StoryShareContext,
): { ok: boolean; msg: string; stage: RelationshipStage } {
  const def = getRomanceDef(npcId, ctx.worldSeed);
  if (!def) return { ok: false, msg: 'She has already moved on.', stage: 0 };
  const rel = ensureRomanceState(inv, npcId);
  const options = listRomanceStories(inv, npcId, ctx);
  const beat = options.find((o) => o.id === storyId);
  if (!beat) return { ok: false, msg: 'Nothing to share.', stage: rel.stage };
  if (beat.locked) {
    return {
      ok: false,
      msg: beat.reason ?? 'Not ready to share that yet.',
      stage: rel.stage,
    };
  }
  rel.storiesShared = [...(rel.storiesShared ?? []), storyId];
  const gain = storyId === 'origin' || storyId === 'companion' ? 14 : storyId === 'invention' ? 12 : 10;
  rel.affinity = Math.min(120, rel.affinity + gain);
  const prev = rel.stage;
  recomputeRomanceStage(rel);
  // Stable reaction pick from her persona seed + story (not Math.random)
  const reactSeed = storyTellSeed(ctx.worldSeed || 1, npcId, `react:${storyId}`, rel.giftsGiven);
  const reactIdx = reactSeed % Math.max(1, def.storyReactions.length);
  const reaction = def.storyReactions[reactIdx] ?? def.storyReactions[0]!;
  const stageBit =
    rel.stage > prev
      ? ` Now ${RELATIONSHIP_STAGE_NAMES[rel.stage]}.`
      : ` (+${gain} affinity · ${RELATIONSHIP_STAGE_NAMES[rel.stage]})`;
  return {
    ok: true,
    stage: rel.stage,
    msg: `You tell her: “${beat.preview}” ${def.name}: “${reaction}”${stageBit}`,
  };
}

export function totalWagesPerTick(inv: InventoryState): number {
  return inv.workers.reduce((s, w) => s + workerWagePerTick(inv, w), 0);
}

export function ownedCityStallCount(inv: InventoryState): number {
  return Object.values(inv.cityStalls).filter((s) => s.owned).length;
}

export function canInvent(inv: InventoryState): boolean {
  return inv.bayLevel >= 3 || inv.cityWorkshopLeased || homeHasRoom(inv, 'invent_lab');
}

/** Home workshop or city/training bay craft access */
export function canCraftAtHomeOrBay(inv: InventoryState): boolean {
  return inv.cityWorkshopLeased || inv.parcelLeased || homeHasRoom(inv, 'workshop');
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
  // Fine tools are made via temperWorkerGear (invention + basic tool) — not listed as RECIPES.
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
  // ——— Romance gifts (also buyable at market) ———
  {
    id: 'brass_charm',
    name: 'Stamp Brass Charm',
    inputs: [
      { id: 'scrap_brass', n: 2 },
      { id: 'wire', n: 1 },
    ],
    output: { id: 'brass_charm', n: 1 },
    needsBay: true,
  },
  {
    id: 'silk_scarf',
    name: 'Weave Spore-Silk Scarf',
    inputs: [
      { id: 'spore_silk', n: 3 },
      { id: 'wire', n: 1 },
    ],
    output: { id: 'silk_scarf', n: 1 },
    needsBay: true,
  },
  {
    id: 'flower_gift',
    name: 'Bind Cloud Blooms Bouquet',
    inputs: [
      { id: 'bloom_sky', n: 1 },
      { id: 'bloom_brass', n: 1 },
    ],
    output: { id: 'flower_gift', n: 1 },
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
  if (recipe.needsBay && !canCraftAtHomeOrBay(inv)) {
    return { ok: false, msg: 'Need a bay or home workshop to craft.' };
  }
  if (!canCraft(inv, recipe)) {
    return { ok: false, msg: 'Missing materials for that recipe.' };
  }
  // Stack room for one craft
  const outId = recipe.output.id;
  const outN = recipe.output.n;
  if (getQty(inv, outId) + outN > effectiveStack(inv, outId)) {
    return { ok: false, msg: `Inventory full for ${COMMODITIES[outId].name}.` };
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

/** How many times `recipe` can be crafted with current mats / stack room. */
export function maxCraftTimes(inv: InventoryState, recipe: Recipe): number {
  if (recipe.needsBay && !canCraftAtHomeOrBay(inv)) return 0;
  let max = Infinity;
  for (const inp of recipe.inputs) {
    max = Math.min(max, Math.floor(getQty(inv, inp.id) / inp.n));
  }
  const room = effectiveStack(inv, recipe.output.id) - getQty(inv, recipe.output.id);
  max = Math.min(max, Math.floor(room / Math.max(1, recipe.output.n)));
  return Math.max(0, Number.isFinite(max) ? max : 0);
}

/** Craft the same recipe up to `times` (stops on first failure). */
export function craftTimes(
  inv: InventoryState,
  recipe: Recipe,
  times: number,
): { ok: boolean; msg: string; crafted: number } {
  const n = Math.max(0, Math.floor(times));
  if (n < 1) return { ok: false, msg: 'Invalid amount.', crafted: 0 };
  let crafted = 0;
  for (let i = 0; i < n; i++) {
    const r = craft(inv, recipe);
    if (!r.ok) {
      if (crafted === 0) return { ok: false, msg: r.msg, crafted: 0 };
      return {
        ok: true,
        crafted,
        msg: `Crafted ${crafted}× ${COMMODITIES[recipe.output.id].name} (stopped: ${r.msg})`,
      };
    }
    crafted++;
  }
  return {
    ok: true,
    crafted,
    msg: `Crafted ${crafted * recipe.output.n}× ${COMMODITIES[recipe.output.id].name}`,
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
    speedToolTier: 0,
    haulToolTier: 0,
    jobsDone: 0,
    payGrade: 0,
    harvestSiteId: null,
    harvestMatId: null,
    flowerMatId: null,
  };
  inv.workers.push(w);
  inv.laborerHired = true;
  applyStanding(inv, 2);
  return {
    ok: true,
    worker: w,
    msg: `Hired ${name} (−${cost} brass). Raise pay for long programs · expand bay for more crew.`,
  };
}

/** Spend brass to raise a worker’s pay grade (unlocks longer task lists). */
export const PAY_RAISE_COST = 40;

export function raiseWorkerPayCost(payGrade: number): number {
  return PAY_RAISE_COST + Math.max(0, payGrade) * 25;
}

export function raiseWorkerPay(
  inv: InventoryState,
  workerId: string,
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  const cost = raiseWorkerPayCost(w.payGrade ?? 0);
  if (inv.brass < cost) {
    return {
      ok: false,
      msg: `Need ${cost} brass to raise ${w.name} to ${payGradeTitle((w.payGrade ?? 0) + 1)}.`,
    };
  }
  inv.brass -= cost;
  w.payGrade = (w.payGrade ?? 0) + 1;
  const title = payGradeTitle(w.payGrade);
  const nodes = PROGRAM_FREE_NODES + w.payGrade * 2;
  const inventBit =
    w.payGrade === APPRENTICE_INVENTOR_GRADE
      ? ' · can invent new recipes on programs!'
      : w.payGrade > APPRENTICE_INVENTOR_GRADE
        ? ' · invent rights kept'
        : ` · invent at G${APPRENTICE_INVENTOR_GRADE} (${payGradeTitle(APPRENTICE_INVENTOR_GRADE)})`;
  return {
    ok: true,
    msg: `${w.name} → ${title} (G${w.payGrade}, −${cost}b). Programs up to ~${nodes} steps${inventBit}`,
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
  const need = minPayGradeForProgram(p);
  if ((w.payGrade ?? 0) < need) {
    const inventNeed =
      p.nodes.includes('invent_recipe') && (w.payGrade ?? 0) < APPRENTICE_INVENTOR_GRADE
        ? ` · invent steps need ${payGradeTitle(APPRENTICE_INVENTOR_GRADE)} (G${APPRENTICE_INVENTOR_GRADE})`
        : '';
    return {
      ok: false,
      msg: `${w.name} refuses “${p.name}” — need ${payGradeTitle(need)} (G${need}); is ${payGradeTitle(w.payGrade ?? 0)} (G${w.payGrade ?? 0})${inventNeed}. Raise pay first.`,
    };
  }
  const maxNodes = workerMaxProgramNodes(w);
  if (p.nodes.length > maxNodes) {
    return {
      ok: false,
      msg: `${w.name} is a bare robot — max ${maxNodes} tasks (has ${p.nodes.length}). Equip the soul medallion for human capacity.`,
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

/** Spawn a program from a curated template (Frame Line, broker run, …). */
export function createProgramFromTemplate(
  inv: InventoryState,
  templateId: ProgramTemplateId,
): { ok: boolean; msg: string; program?: WorkerProgram } {
  if (inv.programs.length >= 32) {
    return { ok: false, msg: 'Max 32 programs on this empire bay.' };
  }
  const t = PROGRAM_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return { ok: false, msg: 'Unknown template.' };
  const program: WorkerProgram = {
    id: `prog_${Date.now()}`,
    name: t.name,
    nodes: [...t.nodes],
    framePref: t.framePref ?? 'service',
  };
  inv.programs.push(program);
  const grade = minPayGradeForNodes(program.nodes.length);
  const gradeNote = grade > 0 ? ` · needs pay grade ${grade}` : ' · free for grade 0';
  return {
    ok: true,
    msg: `Created “${program.name}” (${program.nodes.length} steps${gradeNote})`,
    program,
  };
}

export function setProgramFramePref(
  inv: InventoryState,
  programId: string,
  pref: 'service' | 'fine',
): { ok: boolean; msg: string } {
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  p.framePref = pref;
  return {
    ok: true,
    msg:
      pref === 'fine'
        ? `“${p.name}” prefers fine parts (silk · polished wire)`
        : `“${p.name}” uses serviceable stock`,
  };
}

/** Which invention craft_custom / stock_stall_invention / sell_invention use. */
export function setProgramInvention(
  inv: InventoryState,
  programId: string,
  recipeId: string | null,
): { ok: boolean; msg: string } {
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  if (recipeId == null || recipeId === '') {
    p.inventionId = null;
    return { ok: true, msg: `“${p.name}” invention target: first in book` };
  }
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.' };
  p.inventionId = recipeId;
  return { ok: true, msg: `“${p.name}” invention target: ${recipe.name}` };
}

/** Commodity + qty for stock_stall_goods. */
export function setProgramStallGoods(
  inv: InventoryState,
  programId: string,
  commodityId: CommodityId | null,
  qty = 3,
): { ok: boolean; msg: string } {
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  if (commodityId && !(commodityId in COMMODITIES)) {
    return { ok: false, msg: 'Unknown commodity.' };
  }
  p.stallCommodityId = commodityId;
  p.stallStockQty = Math.max(1, Math.min(20, Math.floor(qty) || 3));
  if (!commodityId) {
    return { ok: true, msg: `“${p.name}” stall goods: wire ×${p.stallStockQty} (default)` };
  }
  return {
    ok: true,
    msg: `“${p.name}” stall goods: ${COMMODITIES[commodityId].name} ×${p.stallStockQty}`,
  };
}

/** Material pair for invent_recipe node. */
export function setProgramInventMats(
  inv: InventoryState,
  programId: string,
  a: CommodityId | null,
  b: CommodityId | null,
): { ok: boolean; msg: string } {
  const p = inv.programs.find((x) => x.id === programId);
  if (!p) return { ok: false, msg: 'Program not found.' };
  if (a && !INVENT_MATERIAL_IDS.includes(a)) {
    return { ok: false, msg: `${COMMODITIES[a]?.name ?? a} can’t invent.` };
  }
  if (b && !INVENT_MATERIAL_IDS.includes(b)) {
    return { ok: false, msg: `${COMMODITIES[b]?.name ?? b} can’t invent.` };
  }
  if (a && b && a === b) {
    return { ok: false, msg: 'Pick two different invent materials.' };
  }
  p.inventMatA = a;
  p.inventMatB = b;
  if (!a || !b) {
    return { ok: true, msg: `“${p.name}” invent mats: auto from pack` };
  }
  return {
    ok: true,
    msg: `“${p.name}” invent mats: ${COMMODITIES[a].name} + ${COMMODITIES[b].name}`,
  };
}

/** Resolve which invention a program should craft/stock/sell. */
export function resolveProgramInventionId(
  inv: InventoryState,
  prog: WorkerProgram | undefined,
): string | null {
  if (prog?.inventionId) {
    if (inv.customRecipes.some((r) => r.id === prog.inventionId)) return prog.inventionId;
  }
  return inv.customRecipes[0]?.id ?? null;
}

/**
 * Craft invented goods that can fill frame slots (up to a few per assemble).
 * Prefers program-selected invention, then highest quality recipes.
 */
export function craftInventionsForFrameAssemble(
  inv: InventoryState,
  preferFine: boolean,
  preferredInventionId?: string | null,
): string[] {
  const notes: string[] = [];
  if (!canCraftAtHomeOrBay(inv) || inv.customRecipes.length < 1) return notes;

  const sorted = [...inv.customRecipes].sort((a, b) => {
    if (preferredInventionId) {
      if (a.id === preferredInventionId) return -1;
      if (b.id === preferredInventionId) return 1;
    }
    const qa = a.quality ?? 1;
    const qb = b.quality ?? 1;
    if (qb !== qa) return qb - qa;
    return (b.sellValue ?? 0) - (a.sellValue ?? 0);
  });

  let crafted = 0;
  const maxCraft = preferFine ? 3 : 2;
  for (const recipe of sorted) {
    if (crafted >= maxCraft) break;
    const stock = inv.customStock[recipe.id] ?? 0;
    // Always try to have at least 1 of preferred / high-quality inventions on hand
    if (stock >= 1 && recipe.id !== preferredInventionId) continue;
    if (stock >= 2) continue; // already stocked enough for multi-slot
    // Serviceable lines only auto-craft inventions that are a real upgrade (Q2+)
    // or the program-locked invention target
    if (
      !preferFine &&
      recipe.id !== preferredInventionId &&
      (recipe.quality ?? 1) < 2
    ) {
      continue;
    }
    if (maxCraftCustomTimes(inv, recipe.id) < 1) continue;
    const r = craftCustom(inv, recipe.id);
    if (r.ok) {
      notes.push(`crafted ${recipe.name}`);
      crafted += 1;
    }
  }
  return notes;
}

/**
 * Worker Make Frame: craft missing wire/gear, craft inventions when useful,
 * soft-buy a bloom if needed, then auto-fill five slots (inventions preferred).
 */
export function buildFrameForWorker(
  inv: InventoryState,
  preferFine: boolean,
  opts?: { preferredInventionId?: string | null },
): { ok: boolean; msg: string } {
  if (inv.bayLevel < 1) {
    return { ok: false, msg: 'Lease a bay before assembling frames.' };
  }
  const notes: string[] = [];

  const craftOnce = (recipeId: string, label: string) => {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe || !canCraft(inv, recipe)) return false;
    const r = craft(inv, recipe);
    if (r.ok) notes.push(label);
    return r.ok;
  };

  if (getQty(inv, 'wire') < 1 && getQty(inv, 'polished_wire') < 1) {
    craftOnce('wire_from_scrap', 'drew wire');
  }
  if (getQty(inv, 'gear_blank') < 1) {
    craftOnce('gear_blank', 'cut gear');
  }
  if (preferFine && getQty(inv, 'polished_wire') < 1 && getQty(inv, 'wire') >= 1) {
    craftOnce('polished_wire', 'polished wire');
  }

  // Soft-buy a cloudbloom so Make Frame isn't blocked on plaza flowers
  const hasPersonality =
    getQty(inv, 'flower_gift') > 0 ||
    getQty(inv, 'bloom_brass') > 0 ||
    getQty(inv, 'bloom_sky') > 0 ||
    getQty(inv, 'bloom_spore') > 0 ||
    getQty(inv, 'bloom_harbor') > 0 ||
    getQty(inv, 'bloom_aether') > 0 ||
    inv.customRecipes.some(
      (r) =>
        (inv.customStock[r.id] ?? 0) > 0 && inventionFitsSlot(r, 'personality'),
    );
  if (!hasPersonality) {
    const vendor = findVendorForTrade('flower_gift', 'buy');
    if (vendor) {
      const buy = buyFromVendor(inv, vendor, 'flower_gift', 1);
      if (buy.ok) notes.push('bought bloom');
    }
  }

  // Craft invented parts so they can fill frame slots for upgraded builds
  notes.push(
    ...craftInventionsForFrameAssemble(
      inv,
      preferFine,
      opts?.preferredInventionId ?? null,
    ),
  );

  const r = tryAutoAssembleFrame(inv, preferFine);
  if (!r.ok) {
    return {
      ok: false,
      msg: notes.length ? `${notes.join(', ')} · ${r.msg}` : r.msg,
    };
  }
  const prefix = notes.length ? `${notes.join(', ')} · ` : '';
  return { ok: true, msg: `${prefix}${r.msg}` };
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
      normalizeWorkerToolTiers(w);
      // Tool wear — tempered lasts longer; degrades tempered → basic → none
      if ((w.speedToolTier ?? 0) > 0 && w.jobsDone > 0) {
        const tier = w.speedToolTier ?? 0;
        const every = tier >= 2 ? 38 : 22;
        if (w.jobsDone % every === 0) {
          if (tier >= 2) {
            w.speedToolTier = 1;
            w.hasSpeedTool = true;
            return {
              ...r,
              msg: `${r.msg ?? ''} · ${name}'s tempered spanner cooled to a standard Rivet Spanner.`.trim(),
            };
          }
          w.speedToolTier = 0;
          w.hasSpeedTool = false;
          return {
            ...r,
            msg: `${r.msg ?? ''} · ${name}'s Rivet Spanner wore out!`.trim(),
          };
        }
      }
      if ((w.haulToolTier ?? 0) > 0 && w.jobsDone > 0) {
        const tier = w.haulToolTier ?? 0;
        const every = tier >= 2 ? 42 : 28;
        if (w.jobsDone % every === 0) {
          if (tier >= 2) {
            w.haulToolTier = 1;
            w.hasHaulPack = true;
            return {
              ...r,
              msg: `${r.msg ?? ''} · ${name}'s reinforced pack frayed to a standard Haul Pack.`.trim(),
            };
          }
          w.haulToolTier = 0;
          w.hasHaulPack = false;
          return {
            ...r,
            msg: `${r.msg ?? ''} · ${name}'s Haul Pack wore out!`.trim(),
          };
        }
      }
    }
    return r;
  };

  if (node === 'return_bay') {
    return { ok: true, msg: `${name} returned to bay` };
  }

  // ——— Make Frame (prep parts + assemble five slots) ———
  if (node === 'craft_frame' || node === 'craft_fine_frame') {
    const prog = w?.programId ? inv.programs.find((p) => p.id === w.programId) : undefined;
    const preferFine = node === 'craft_fine_frame' || prog?.framePref === 'fine';
    // Prefer program invention target for frame parts when it fits a slot
    const r = buildFrameForWorker(inv, preferFine, {
      preferredInventionId: prog?.inventionId ?? null,
    });
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
    const prog = w?.programId ? inv.programs.find((p) => p.id === w.programId) : undefined;
    const rid = resolveProgramInventionId(inv, prog);
    if (!rid) {
      return { ok: false, msg: `${name}: no inventions (invent at desk or run Invent New Recipe)` };
    }
    const r = craftCustom(inv, rid);
    return finish({ ok: r.ok, msg: `${name}: ${r.msg}` });
  }

  if (node === 'invent_recipe') {
    if (!w || !canWorkerInvent(w)) {
      return {
        ok: false,
        msg: `${name}: invent needs ${payGradeTitle(APPRENTICE_INVENTOR_GRADE)} (G${APPRENTICE_INVENTOR_GRADE}) — raise pay ${APPRENTICE_INVENTOR_GRADE - (w?.payGrade ?? 0)} more time(s)`,
      };
    }
    const prog = w.programId ? inv.programs.find((p) => p.id === w.programId) : undefined;
    const r = inventRecipeForWorker(inv, prog);
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

  // ——— Harvest reef ———
  if (node === 'harvest') {
    return finish(applyWorkerJobResult(inv, workerId, 'harvest'));
  }

  // ——— Pick plaza flowers ———
  if (node === 'pick_flowers') {
    return finish(applyWorkerJobResult(inv, workerId, 'pick_flowers'));
  }

  // ——— Sell invention ———
  if (node === 'sell_invention') {
    const prog = w?.programId ? inv.programs.find((p) => p.id === w.programId) : undefined;
    const preferred = resolveProgramInventionId(inv, prog);
    const rid =
      preferred && (inv.customStock[preferred] ?? 0) > 0
        ? preferred
        : Object.keys(inv.customStock).find((k) => (inv.customStock[k] ?? 0) > 0);
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
  if (node === 'stock_stall_invention') {
    const prog = w?.programId ? inv.programs.find((p) => p.id === w.programId) : undefined;
    const rid = resolveProgramInventionId(inv, prog);
    if (!rid) return { ok: false, msg: `${name}: no invention to stock` };
    const r = stockInventionOnStall(inv, rid, 1, undefined, 1);
    return finish({ ok: r.ok, msg: `${name}: ${r.msg}` });
  }
  if (node === 'stock_stall_goods') {
    const prog = w?.programId ? inv.programs.find((p) => p.id === w.programId) : undefined;
    const id = (prog?.stallCommodityId ?? 'wire') as CommodityId;
    const qty = Math.max(1, Math.min(20, prog?.stallStockQty ?? 3));
    if (!(id in COMMODITIES)) {
      return { ok: false, msg: `${name}: bad stall commodity` };
    }
    return finish(stockStallFromInv(inv, id, qty, name));
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
  applyStanding(inv, 2);
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
  applyStanding(inv, 3, { districtId, districtDelta: 5 });
  const n = ownedCityStallCount(inv);
  return {
    ok: true,
    msg: `Leased stall · ${dist.name} (−${dist.stallCost}). Empire shops: ${n}. Stock inventions at premium plazas for max profit.`,
  };
}

export function toggleStallOpen(inv: InventoryState): { ok: boolean; msg: string } {
  if (!inv.stall.owned) return { ok: false, msg: 'Lease a stall first.' };
  inv.stall.open = !inv.stall.open;
  if (inv.stall.open) inv.stall.forcedClosed = false;
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
  if (stall.open) stall.forcedClosed = false;
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

function stallToStockSnap(stall: StallState): StallStockSnap {
  return {
    shelf: stall.shelf ?? {},
    customShelf: stall.customShelf ?? {},
    frameCount: stall.frameShelf?.length ?? 0,
    open: !!stall.open,
    owned: !!stall.owned,
  };
}

/** Count open owned stalls (training + city) stocking each need category. */
export function countOpenStallsByNeed(inv: InventoryState): Record<CustomerNeed, number> {
  const counts: Record<CustomerNeed, number> = {
    mats: 0,
    parts: 0,
    frames: 0,
    inventions: 0,
    gifts: 0,
    flowers: 0,
  };
  const consider = (stall: StallState) => {
    if (!stall.owned || !stall.open) return;
    const snap = stallToStockSnap(stall);
    (Object.keys(counts) as CustomerNeed[]).forEach((need) => {
      if (stallStocksNeed(snap, need)) counts[need] += 1;
    });
  };
  consider(inv.stall);
  for (const stall of Object.values(inv.cityStalls ?? {})) consider(stall);
  return counts;
}

/** Average affinity of known neighbors (goodwill → foot traffic). */
export function avgKnownNeighborAffinity(inv: InventoryState): number {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  const list = inv.neighborLife.neighbors.filter((n) => n.known);
  if (!list.length) return 0;
  const sum = list.reduce((a, n) => a + n.affinity, 0);
  return sum / list.length;
}

/**
 * Layer M demand mul for a stall: under/over-serve + standing + décor.
 * Writes `stall.lastSalesDrivers` for HUD (M5).
 */
export function marketDemandForStall(
  inv: InventoryState,
  stall: StallState,
  districtId: string | null,
): { demandMul: number; inventBonus: number; drivers: string[] } {
  ensureStandingState(inv);
  const snap = stallToStockSnap(stall);
  const need = dominantStallNeed(snap);
  const byNeed = countOpenStallsByNeed(inv);
  const openForNeed = need ? byNeed[need] : 1;
  const dist = districtId ? districtById(districtId) : null;
  const placeMul = districtId ? stallPlacementMul(inv, districtId) : 1;
  const districtStand = districtId ? getDistrictStanding(inv, districtId) : 0;
  const bundle = combineMarketDemand({
    districtDemandMul: dist?.demandMul ?? 1,
    openStallsStockingNeed: openForNeed,
    empireStanding: inv.empireStanding ?? 0,
    districtStanding: districtStand,
    avgKnownAffinity: avgKnownNeighborAffinity(inv),
    placementMul: placeMul,
    need,
  });
  stall.lastSalesDrivers = formatSalesDrivers(bundle.drivers);
  const inventBonus =
    (dist?.inventBonus ?? 1) * Math.sqrt(Math.max(0.85, placeMul)) * Math.min(1.15, 0.92 + (inv.empireStanding ?? 0) * 0.002);
  return {
    demandMul: bundle.demandMul,
    inventBonus,
    drivers: bundle.drivers,
  };
}

/** Tick every owned open city stall + training stall (Layer M customer pipeline). */
export function tickAllStalls(inv: InventoryState): {
  ok: boolean;
  msg?: string;
  haggle?: boolean;
  sales: number;
  /** Last non-empty drivers string for HUD toast */
  drivers?: string;
} {
  let sales = 0;
  let lastMsg: string | undefined;
  let haggle = false;
  let lastDrivers: string | undefined;
  if (inv.stall.owned && inv.stall.open) {
    const m = marketDemandForStall(inv, inv.stall, null);
    lastDrivers = inv.stall.lastSalesDrivers;
    const r = tickStallState(inv, inv.stall, {
      demandMul: m.demandMul,
      inventBonus: m.inventBonus,
      label: 'Training stall',
    });
    if (r.ok) {
      sales++;
      if (inv.stall.lastSalesDrivers) {
        lastMsg = `${r.msg} · ${inv.stall.lastSalesDrivers}`;
      } else if (r.msg) lastMsg = r.msg;
    } else {
      if (r.msg) lastMsg = r.msg;
    }
    if (r.haggle) haggle = true;
  }
  if (inv.cityStalls) {
    for (const [did, stall] of Object.entries(inv.cityStalls)) {
      if (!stall.owned || !stall.open) continue;
      const dist = districtById(did);
      const m = marketDemandForStall(inv, stall, did);
      lastDrivers = stall.lastSalesDrivers;
      const r = tickStallState(inv, stall, {
        demandMul: m.demandMul,
        inventBonus: m.inventBonus,
        label: dist?.name ?? did,
      });
      if (r.ok) {
        sales++;
        lastMsg = r.msg
          ? `${r.msg}${stall.lastSalesDrivers ? ` · ${stall.lastSalesDrivers}` : ''}`
          : lastMsg;
      } else if (r.msg) {
        lastMsg = r.msg;
      }
      if (r.haggle) haggle = true;
    }
  }
  return { ok: sales > 0, msg: lastMsg, haggle, sales, drivers: lastDrivers };
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

/** Normalize legacy boolean gear flags into tiers. */
export function normalizeWorkerToolTiers(w: WorkerState): void {
  if (w.speedToolTier == null) {
    w.speedToolTier = w.hasSpeedTool ? 1 : 0;
  }
  if (w.haulToolTier == null) {
    w.haulToolTier = w.hasHaulPack ? 1 : 0;
  }
  w.speedToolTier = Math.max(0, Math.min(2, w.speedToolTier)) as ToolTier;
  w.haulToolTier = Math.max(0, Math.min(2, w.haulToolTier)) as ToolTier;
  w.hasSpeedTool = w.speedToolTier > 0;
  w.hasHaulPack = w.haulToolTier > 0;
}

export function workerSpeedToolTier(w: WorkerState): ToolTier {
  normalizeWorkerToolTiers(w);
  return w.speedToolTier ?? 0;
}

export function workerHaulToolTier(w: WorkerState): ToolTier {
  normalizeWorkerToolTiers(w);
  return w.haulToolTier ?? 0;
}

export function toolTierLabel(kind: 'speed' | 'haul', tier: ToolTier): string {
  if (kind === 'speed') {
    if (tier >= 2) return 'Tempered Spanner';
    if (tier >= 1) return 'Rivet Spanner';
    return 'no spanner';
  }
  if (tier >= 2) return 'Reinforced Pack';
  if (tier >= 1) return 'Haul Pack';
  return 'no pack';
}

/**
 * Equip best available tool of kind (fine preferred over basic).
 * Replacing a weaker tool returns the old one to inventory when possible.
 */
export function equipWorkerTool(
  inv: InventoryState,
  workerId: string,
  kind: 'speed' | 'haul',
): { ok: boolean; msg: string } {
  const w = inv.workers.find((x) => x.id === workerId);
  if (!w) return { ok: false, msg: 'Worker not found.' };
  normalizeWorkerToolTiers(w);

  if (kind === 'speed') {
    const cur = w.speedToolTier ?? 0;
    const fine = getQty(inv, 'speed_tool_fine');
    const basic = getQty(inv, 'speed_tool');
    let next: ToolTier = 0;
    if (fine > 0) next = 2;
    else if (basic > 0) next = 1;
    else {
      return {
        ok: false,
        msg:
          cur > 0
            ? `${w.name} already has ${toolTierLabel('speed', cur)}.`
            : 'Craft a Rivet Spanner (Tools). Temper it with an invention for bigger gains.',
      };
    }
    if (next <= cur) {
      return {
        ok: false,
        msg: `${w.name} already has ${toolTierLabel('speed', cur)} (equip a tempered one for an upgrade).`,
      };
    }
    if (next === 2) removeItem(inv, 'speed_tool_fine', 1);
    else removeItem(inv, 'speed_tool', 1);
    // Return previous tool to pack when upgrading
    if (cur === 1) addItem(inv, 'speed_tool', 1);
    else if (cur === 2) addItem(inv, 'speed_tool_fine', 1);
    w.speedToolTier = next;
    w.hasSpeedTool = true;
    return {
      ok: true,
      msg:
        next === 2
          ? `${w.name} equipped Tempered Rivet Spanner — much faster work cycles.`
          : `${w.name} equipped Rivet Spanner — works faster.`,
    };
  }

  const cur = w.haulToolTier ?? 0;
  const fine = getQty(inv, 'haul_pack_fine');
  const basic = getQty(inv, 'haul_pack');
  let next: ToolTier = 0;
  if (fine > 0) next = 2;
  else if (basic > 0) next = 1;
  else {
    return {
      ok: false,
      msg:
        cur > 0
          ? `${w.name} already has ${toolTierLabel('haul', cur)}.`
          : 'Craft a Haul Pack (Tools). Reinforce it with an invention for greater reef yields.',
    };
  }
  if (next <= cur) {
    return {
      ok: false,
      msg: `${w.name} already has ${toolTierLabel('haul', cur)} (equip a reinforced one for an upgrade).`,
    };
  }
  if (next === 2) removeItem(inv, 'haul_pack_fine', 1);
  else removeItem(inv, 'haul_pack', 1);
  if (cur === 1) addItem(inv, 'haul_pack', 1);
  else if (cur === 2) addItem(inv, 'haul_pack_fine', 1);
  w.haulToolTier = next;
  w.hasHaulPack = true;
  return {
    ok: true,
    msg:
      next === 2
        ? `${w.name} equipped Reinforced Haul Pack — much larger reef hauls.`
        : `${w.name} equipped Haul Pack — bigger reef yields.`,
  };
}

/** Inventions currently stocked and usable to temper gear. */
export function listTemperingInventions(
  inv: InventoryState,
): { id: string; name: string; qty: number; quality: number }[] {
  return inv.customRecipes
    .map((r) => ({
      id: r.id,
      name: r.name,
      qty: inv.customStock[r.id] ?? 0,
      quality: r.quality ?? 1,
    }))
    .filter((x) => x.qty > 0);
}

/**
 * Improve a basic tool using one crafted invention.
 * Gated behind invent unlock — keeps tutorial free of this path.
 */
export function temperWorkerGear(
  inv: InventoryState,
  kind: 'speed' | 'haul',
  inventionId: string,
): { ok: boolean; msg: string } {
  if (!canInvent(inv)) {
    return {
      ok: false,
      msg: 'Tool tempering unlocks with invention (bay L3, city workshop, or home invent lab).',
    };
  }
  if (!canCraftAtHomeOrBay(inv)) {
    return { ok: false, msg: 'Need a bay or home workshop.' };
  }
  const recipe = inv.customRecipes.find((r) => r.id === inventionId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.' };
  const stock = inv.customStock[inventionId] ?? 0;
  if (stock < 1) {
    return { ok: false, msg: `Craft 1× ${recipe.name} first, then temper gear with it.` };
  }

  if (kind === 'speed') {
    if (getQty(inv, 'speed_tool') < 1) {
      return {
        ok: false,
        msg: 'Need a basic Rivet Spanner in stock (Tools → Forge Rivet Spanner).',
      };
    }
    if (getQty(inv, 'speed_tool_fine') + 1 > effectiveStack(inv, 'speed_tool_fine')) {
      return { ok: false, msg: 'Inventory full for Tempered Rivet Spanner.' };
    }
    removeItem(inv, 'speed_tool', 1);
    inv.customStock[inventionId]!--;
    if (inv.customStock[inventionId]! <= 0) delete inv.customStock[inventionId];
    addItem(inv, 'speed_tool_fine', 1);
    return {
      ok: true,
      msg: `Tempered Rivet Spanner with ${recipe.name} (Q${recipe.quality ?? 1}) — equip on a worker for faster work.`,
    };
  }

  if (getQty(inv, 'haul_pack') < 1) {
    return {
      ok: false,
      msg: 'Need a basic Haul Pack in stock (Tools → Stitch Haul Pack).',
    };
  }
  if (getQty(inv, 'haul_pack_fine') + 1 > effectiveStack(inv, 'haul_pack_fine')) {
    return { ok: false, msg: 'Inventory full for Reinforced Haul Pack.' };
  }
  removeItem(inv, 'haul_pack', 1);
  inv.customStock[inventionId]!--;
  if (inv.customStock[inventionId]! <= 0) delete inv.customStock[inventionId];
  addItem(inv, 'haul_pack_fine', 1);
  const q = recipe.quality ?? 1;
  return {
    ok: true,
    msg: `Reinforced Haul Pack with ${recipe.name} (Q${q}) — equip for greater reef yields.`,
  };
}

export function canTemperGear(
  inv: InventoryState,
  kind: 'speed' | 'haul',
): boolean {
  if (!canInvent(inv) || !canCraftAtHomeOrBay(inv)) return false;
  if (listTemperingInventions(inv).length < 1) return false;
  if (kind === 'speed') return getQty(inv, 'speed_tool') >= 1;
  return getQty(inv, 'haul_pack') >= 1;
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
  const tier = workerSpeedToolTier(w);
  // Higher mul = slower work timer in agents
  let mul = tier >= 2 ? 0.36 : tier >= 1 ? 0.55 : 1;
  if (isRobotWorker(w) && !w.hasMedallion) {
    mul *= Math.max(0.5, Math.min(1.7, w.frameWorkMul ?? 1.35));
  }
  return mul;
}

export function workerHarvestQty(w: WorkerState): number {
  const tier = workerHaulToolTier(w);
  // Basic pack: 2–3 · Reinforced (invention): 4–6
  let n =
    tier >= 2
      ? 4 + Math.floor(Math.random() * 3)
      : tier >= 1
        ? 2 + Math.floor(Math.random() * 2)
        : 1;
  if (isRobotWorker(w) && !w.hasMedallion) {
    const hm = w.frameHarvestMul ?? 0.85;
    n = Math.max(1, Math.floor(n * hm + (hm > 1.1 ? Math.random() : 0)));
  }
  // Tempered spanner also slightly boosts haul size (cleaner reefs, faster cycles)
  if (workerSpeedToolTier(w) >= 2 && Math.random() < 0.45) n += 1;
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

  if (job === 'pick_flowers') {
    const pool = flowerPoolForWorker(w);
    if (!pool.length) {
      return { ok: false, msg: `${w.name}: no blooms at that plaza` };
    }
    const id = pool[Math.floor(Math.random() * pool.length)]!;
    const n = workerFlowerQty(w);
    if (!addItem(inv, id, n)) {
      return { ok: false, msg: `${w.name}: pack full for ${COMMODITIES[id].name}` };
    }
    inv.harvestRuns += 1;
    noteMarketSupply(inv, id, n);
    const site = harvestSiteLabel(w.harvestSiteId);
    return {
      ok: true,
      msg: `${w.name} picked ${n}× ${COMMODITIES[id].name} (${site})`,
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

/** Total brass due each upkeep tick (bay + wages + city shop tax). */
export function bayUpkeepDue(inv: InventoryState): number {
  if (inv.bayLevel < 1) return 0;
  const wages = totalWagesPerTick(inv);
  const cost = inv.bayLevel * BAY_UPKEEP_PER_LEVEL + wages;
  const shopTax = ownedCityStallCount(inv) * 2;
  return cost + shopTax;
}

export interface ForcedClosedStall {
  key: string;
  label: string;
}

/** Stalls auto-closed by failed upkeep (still owned, waiting to reopen). */
export function listForcedClosedStalls(inv: InventoryState): ForcedClosedStall[] {
  const out: ForcedClosedStall[] = [];
  if (inv.stall.owned && inv.stall.forcedClosed) {
    out.push({ key: 'training', label: 'Training stall' });
  }
  for (const [did, stall] of Object.entries(inv.cityStalls ?? {})) {
    if (!stall.owned || !stall.forcedClosed) continue;
    const dist = districtById(did);
    out.push({ key: did, label: dist?.name ?? did });
  }
  return out;
}

function forceCloseOwnedOpenStalls(inv: InventoryState): ForcedClosedStall[] {
  const closed: ForcedClosedStall[] = [];
  if (inv.stall.owned && inv.stall.open) {
    inv.stall.open = false;
    inv.stall.forcedClosed = true;
    closed.push({ key: 'training', label: 'Training stall' });
  } else if (inv.stall.owned && inv.stall.forcedClosed) {
    closed.push({ key: 'training', label: 'Training stall' });
  }
  for (const [did, stall] of Object.entries(inv.cityStalls ?? {})) {
    if (!stall.owned) continue;
    const dist = districtById(did);
    const label = dist?.name ?? did;
    if (stall.open) {
      stall.open = false;
      stall.forcedClosed = true;
      closed.push({ key: did, label });
    } else if (stall.forcedClosed) {
      closed.push({ key: did, label });
    }
  }
  return closed;
}

export function fireWorker(
  inv: InventoryState,
  workerId: string,
): { ok: boolean; msg: string } {
  const idx = inv.workers.findIndex((w) => w.id === workerId);
  if (idx < 0) return { ok: false, msg: 'Worker not found.' };
  const w = inv.workers[idx]!;
  if (w.hasMedallion) onMedallionHostLost(inv, w.id);
  inv.workers.splice(idx, 1);
  inv.laborerHired = inv.workers.length > 0;
  return { ok: true, msg: `Fired ${w.name}. Wages drop next upkeep.` };
}

export interface UpkeepResult {
  ok: boolean;
  msg?: string;
  need?: number;
  /** Crew marked unpaid / already unpaid during a failed tick */
  unpaidWorkers?: { id: string; name: string }[];
  /** Shops force-closed (or already closed) this failed tick */
  closedShops?: ForcedClosedStall[];
  /** Just cleared unpaid after a successful pay */
  paidWorkers?: { id: string; name: string }[];
  /** Force-closed shops that can be reopened now that upkeep cleared */
  canOpenShops?: ForcedClosedStall[];
}

export function tickBayUpkeep(inv: InventoryState): UpkeepResult {
  if (inv.bayLevel < 1) return { ok: true };
  const wages = totalWagesPerTick(inv);
  const total = bayUpkeepDue(inv);
  if (total <= 0) return { ok: true };
  if (inv.brass < total) {
    const unpaidWorkers: { id: string; name: string }[] = [];
    for (const w of inv.workers) {
      if (!w.unpaid) unpaidWorkers.push({ id: w.id, name: w.name });
      w.unpaid = true;
    }
    const closedShops = forceCloseOwnedOpenStalls(inv);
    // Reputation sink: stiffing crew damages brand (once per new unpaid wave)
    if (unpaidWorkers.length) applyStanding(inv, -3);
    const crewBit =
      inv.workers.length > 0
        ? `Crew unpaid (${inv.workers.map((w) => w.name).join(', ')}).`
        : 'No crew left to idle.';
    const shopBit =
      closedShops.length > 0
        ? ` Shops closed: ${closedShops.map((s) => s.label).join(', ')}.`
        : '';
    return {
      ok: false,
      need: total,
      unpaidWorkers,
      closedShops,
      msg: `Can't cover upkeep (${total}b) — ${crewBit}${shopBit}`,
    };
  }
  const paidWorkers = inv.workers
    .filter((w) => w.unpaid)
    .map((w) => ({ id: w.id, name: w.name }));
  for (const w of inv.workers) w.unpaid = false;
  const canOpenShops = listForcedClosedStalls(inv);
  inv.brass -= total;
  return {
    ok: true,
    need: total,
    paidWorkers,
    canOpenShops,
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
  if (inv.playerBoard.aetherDrive) m += 0.1;
  return m;
}

/** Max board speed multiplier for market ride */
export function playerBoardSpeedMul(inv: InventoryState): number {
  if (!inv.playerBoard.owned) return 1;
  let m = 0.72; // market is slower than race track
  if (inv.playerBoard.thruster) m += 0.22;
  if (inv.playerBoard.rails) m += 0.08;
  if (inv.playerBoard.deck) m += 0.05;
  if (inv.playerBoard.aetherDrive) m += 0.28;
  if (inv.playerBoard.gyro) m += 0.06;
  return m;
}

/** Turn / powerslide responsiveness (foundry gyro). */
export function playerBoardTurnMul(inv: InventoryState): number {
  if (!inv.playerBoard.owned) return 1;
  let m = 1;
  if (inv.playerBoard.rails) m += 0.12;
  if (inv.playerBoard.gyro) m += 0.35;
  return m;
}

export function ensureFieldGear(inv: InventoryState): PlayerFieldGear {
  if (!inv.fieldGear || typeof inv.fieldGear !== 'object') {
    inv.fieldGear = { reefGauge: false, haulRig: false, multiScanner: false };
  }
  return inv.fieldGear;
}

export function ownsPlayerFactory(inv: InventoryState): boolean {
  ensureInvPlots(inv);
  return inv.plazaPlots.plots.some(
    (p) => p.owner === 'player' && (p.buildings ?? []).some((b) => b.kind === 'factory'),
  );
}

/** Foundry craft costs — require factory pad (or already own part for re-craft fail). */
export type FoundryPartId =
  | 'board_gyro'
  | 'board_drive'
  | 'reef_gauge'
  | 'haul_rig'
  | 'multi_scanner';

export const FOUNDRY_PARTS: {
  id: FoundryPartId;
  name: string;
  blurb: string;
  brass: number;
  mats: { id: CommodityId; n: number }[];
}[] = [
  {
    id: 'board_gyro',
    name: 'Gyro gimbal',
    blurb: 'Board turn & powerslide control',
    brass: 120,
    mats: [
      { id: 'gear_blank', n: 2 },
      { id: 'wire', n: 3 },
      { id: 'scrap_brass', n: 4 },
    ],
  },
  {
    id: 'board_drive',
    name: 'Aether drive coil',
    blurb: 'Board top speed & acceleration',
    brass: 180,
    mats: [
      { id: 'fuel_cell', n: 2 },
      { id: 'polished_wire', n: 2 },
      { id: 'cloud_iron', n: 6 },
    ],
  },
  {
    id: 'reef_gauge',
    name: 'Reef chronometer',
    blurb: 'Easier / faster harvest timing window',
    brass: 95,
    mats: [
      { id: 'glass_pane', n: 1 },
      { id: 'gear_blank', n: 1 },
      { id: 'sky_salt', n: 4 },
    ],
  },
  {
    id: 'haul_rig',
    name: 'Multi-haul arm',
    blurb: '+yield per successful haul',
    brass: 110,
    mats: [
      { id: 'cloud_iron', n: 5 },
      { id: 'wire', n: 2 },
      { id: 'repair_kit', n: 1 },
    ],
  },
  {
    id: 'multi_scanner',
    name: 'Dual-mat scanner',
    blurb: 'Harvest two mat types at once',
    brass: 150,
    mats: [
      { id: 'glass_pane', n: 2 },
      { id: 'fuel_cell', n: 1 },
      { id: 'spore_silk', n: 3 },
    ],
  },
];

export function foundryPartOwned(inv: InventoryState, id: FoundryPartId): boolean {
  ensureFieldGear(inv);
  const b = inv.playerBoard;
  switch (id) {
    case 'board_gyro':
      return !!b.gyro;
    case 'board_drive':
      return !!b.aetherDrive;
    case 'reef_gauge':
      return !!inv.fieldGear.reefGauge;
    case 'haul_rig':
      return !!inv.fieldGear.haulRig;
    case 'multi_scanner':
      return !!inv.fieldGear.multiScanner;
  }
}

/** Craft + auto-install foundry part (needs a factory pad on your land). */
export function craftFoundryPart(
  inv: InventoryState,
  id: FoundryPartId,
): { ok: boolean; msg: string } {
  ensureFieldGear(inv);
  if (!ownsPlayerFactory(inv)) {
    return {
      ok: false,
      msg: 'Build a Factory pad on your land first (lease office · Develop · Factory).',
    };
  }
  if (foundryPartOwned(inv, id)) {
    return { ok: false, msg: 'Already installed.' };
  }
  const def = FOUNDRY_PARTS.find((p) => p.id === id);
  if (!def) return { ok: false, msg: 'Unknown foundry part.' };
  if (inv.brass < def.brass) {
    return { ok: false, msg: `Need ${def.brass} brass (have ${inv.brass}).` };
  }
  for (const m of def.mats) {
    if (getQty(inv, m.id) < m.n) {
      return {
        ok: false,
        msg: `Need ${m.n}× ${COMMODITIES[m.id].name} (have ${getQty(inv, m.id)}).`,
      };
    }
  }
  inv.brass -= def.brass;
  for (const m of def.mats) removeItem(inv, m.id, m.n);
  switch (id) {
    case 'board_gyro':
      inv.playerBoard.gyro = true;
      break;
    case 'board_drive':
      inv.playerBoard.aetherDrive = true;
      break;
    case 'reef_gauge':
      inv.fieldGear.reefGauge = true;
      break;
    case 'haul_rig':
      inv.fieldGear.haulRig = true;
      break;
    case 'multi_scanner':
      inv.fieldGear.multiScanner = true;
      break;
  }
  notePeakBrass(inv);
  return {
    ok: true,
    msg: `Foundry: installed ${def.name} (−${def.brass}b). ${def.blurb}.`,
  };
}

/** Haul qty bonus from field gear */
export function playerHarvestQtyBonus(inv: InventoryState): number {
  ensureFieldGear(inv);
  let n = 0;
  if (inv.fieldGear.haulRig) n += 2;
  return n;
}

export function playerHarvestZoneBonus(inv: InventoryState): {
  zoneWidth: number;
  needleSlow: number;
} {
  ensureFieldGear(inv);
  if (inv.fieldGear.reefGauge) return { zoneWidth: 5, needleSlow: 0.82 };
  return { zoneWidth: 0, needleSlow: 1 };
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

/** Stable key for an invention’s two material inputs (order-independent). */
export function inventionPairKey(a: CommodityId, b: CommodityId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function recipeInventionPairKey(recipe: CustomRecipe): string {
  const ids = (recipe.inputs ?? [])
    .map((i) => i.id)
    .filter((id): id is CommodityId => typeof id === 'string' && id.length > 0);
  if (ids.length < 2) return `id:${recipe.id}`;
  return inventionPairKey(ids[0]!, ids[1]!);
}

export function hasInventionPair(
  inv: InventoryState,
  a: CommodityId,
  b: CommodityId,
): boolean {
  const key = inventionPairKey(a, b);
  return inv.customRecipes.some((r) => recipeInventionPairKey(r) === key);
}

/**
 * One-time / load-time cleanup: drop duplicate recipes that share the same
 * material pair. Keeps the best quality (then sell value). Merges stock and
 * remaps programs / stalls / frame slots that pointed at removed ids.
 */
export function dedupeCustomRecipes(inv: InventoryState): {
  removed: number;
  kept: number;
} {
  if (!inv.customRecipes?.length) return { removed: 0, kept: 0 };
  const flag = inv as InventoryState & { inventionsDedupedV1?: boolean };
  // Always safe/idempotent; flag only tracks that we ran once for saves
  const best = new Map<string, CustomRecipe>();
  for (const r of inv.customRecipes) {
    const key = recipeInventionPairKey(r);
    const cur = best.get(key);
    if (!cur) {
      best.set(key, r);
      continue;
    }
    const score = (x: CustomRecipe) =>
      (x.quality ?? 1) * 100_000 + (x.sellValue ?? 0);
    if (score(r) > score(cur)) best.set(key, r);
  }
  if (best.size === inv.customRecipes.length) {
    flag.inventionsDedupedV1 = true;
    return { removed: 0, kept: inv.customRecipes.length };
  }

  const keepIds = new Set([...best.values()].map((r) => r.id));
  const idMap = new Map<string, string>(); // removed → kept
  for (const r of inv.customRecipes) {
    if (keepIds.has(r.id)) continue;
    const keeper = best.get(recipeInventionPairKey(r));
    if (keeper) idMap.set(r.id, keeper.id);
  }

  // Merge invention stock
  if (!inv.customStock) inv.customStock = {};
  for (const [from, to] of idMap) {
    const n = inv.customStock[from] ?? 0;
    if (n > 0) {
      inv.customStock[to] = (inv.customStock[to] ?? 0) + n;
    }
    delete inv.customStock[from];
  }

  // Stall custom shelves / asks
  const stalls: StallState[] = [inv.stall];
  if (inv.cityStalls) stalls.push(...Object.values(inv.cityStalls));
  for (const stall of stalls) {
    if (!stall) continue;
    if (stall.customShelf) {
      for (const [from, to] of idMap) {
        const n = stall.customShelf[from] ?? 0;
        if (n > 0) {
          stall.customShelf[to] = (stall.customShelf[to] ?? 0) + n;
        }
        delete stall.customShelf[from];
      }
    }
    if (stall.customAsks) {
      for (const [from, to] of idMap) {
        if (stall.customAsks[from] != null && stall.customAsks[to] == null) {
          stall.customAsks[to] = stall.customAsks[from]!;
        }
        delete stall.customAsks[from];
      }
    }
  }

  // Program invention targets
  for (const p of inv.programs ?? []) {
    if (p.inventionId && idMap.has(p.inventionId)) {
      p.inventionId = idMap.get(p.inventionId)!;
    }
  }

  // Assembled frame part refs
  for (const f of inv.assembledFrames ?? []) {
    if (!f.slots) continue;
    for (const slot of Object.keys(f.slots) as (keyof typeof f.slots)[]) {
      const ref = f.slots[slot];
      if (typeof ref === 'string' && ref.startsWith('custom:')) {
        const rid = ref.slice('custom:'.length);
        if (idMap.has(rid)) {
          (f.slots as Record<string, string>)[slot as string] = `custom:${idMap.get(rid)}`;
        }
      }
    }
  }

  const removed = inv.customRecipes.length - best.size;
  inv.customRecipes = [...best.values()];
  flag.inventionsDedupedV1 = true;
  return { removed, kept: inv.customRecipes.length };
}

/** Find a material pair not already in the invention book (with stock ×2 each). */
function findNewInventPair(
  inv: InventoryState,
  preferA?: CommodityId | null,
  preferB?: CommodityId | null,
): { a: CommodityId; b: CommodityId } | null {
  if (
    preferA &&
    preferB &&
    preferA !== preferB &&
    getQty(inv, preferA) >= 2 &&
    getQty(inv, preferB) >= 2 &&
    !hasInventionPair(inv, preferA, preferB)
  ) {
    return { a: preferA, b: preferB };
  }
  const held = INVENT_MATERIAL_IDS.filter((id) => getQty(inv, id) >= 2);
  for (let i = 0; i < held.length; i++) {
    for (let j = i + 1; j < held.length; j++) {
      const a = held[i]!;
      const b = held[j]!;
      if (!hasInventionPair(inv, a, b)) return { a, b };
    }
  }
  return null;
}

/**
 * Worker invent step: use program mat pair, or auto-pick two invent mats held ×2+.
 * Never creates a recipe that already exists for the same material pair.
 */
export function inventRecipeForWorker(
  inv: InventoryState,
  prog?: WorkerProgram,
): { ok: boolean; msg: string; recipe?: CustomRecipe } {
  dedupeCustomRecipes(inv);
  const pair = findNewInventPair(
    inv,
    prog?.inventMatA ?? null,
    prog?.inventMatB ?? null,
  );
  if (!pair) {
    const held = INVENT_MATERIAL_IDS.filter((id) => getQty(inv, id) >= 2);
    if (held.length < 2) {
      return {
        ok: false,
        msg: 'Need 2× of two different invent mats (set pair in program or stock pack).',
      };
    }
    return {
      ok: false,
      msg: 'No new invention pairs left — that material combo is already in the book (or try other mats).',
    };
  }
  return inventCustomRecipe(inv, pair.a, pair.b);
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
  if (hasInventionPair(inv, a, b)) {
    const existing = inv.customRecipes.find(
      (r) => recipeInventionPairKey(r) === inventionPairKey(a, b),
    );
    return {
      ok: false,
      msg: `Already invented “${existing?.name ?? 'that pair'}” — pick different materials.`,
    };
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
  applyStanding(inv, 2);
  const slotBlurb = inventSlotBlurb(a, b);
  const gearTip =
    inv.customRecipes.length <= 1
      ? ' Tip: craft a Rivet Spanner or Haul Pack, then Temper / Reinforce it (Tools) with this invention for stronger crew harvests.'
      : '';
  return {
    ok: true,
    recipe,
    msg: `Invented ${name} (Q${quality}, ~${sellValue}b). Fits frame slots: ${slotBlurb}. Craft → assemble or stock stalls.${gearTip}`,
  };
}

export function craftCustom(
  inv: InventoryState,
  recipeId: string,
): { ok: boolean; msg: string } {
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.' };
  if (!canCraftAtHomeOrBay(inv)) return { ok: false, msg: 'Need a bay or home workshop.' };
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

/** Max invention crafts for a custom recipe. */
export function maxCraftCustomTimes(inv: InventoryState, recipeId: string): number {
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe || !canCraftAtHomeOrBay(inv)) return 0;
  let max = Infinity;
  for (const inp of recipe.inputs) {
    max = Math.min(max, Math.floor(getQty(inv, inp.id) / inp.n));
  }
  const room = effectiveInventionStack(inv) - (inv.customStock[recipeId] ?? 0);
  max = Math.min(max, room);
  return Math.max(0, Number.isFinite(max) ? max : 0);
}

export function craftCustomTimes(
  inv: InventoryState,
  recipeId: string,
  times: number,
): { ok: boolean; msg: string; crafted: number } {
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.', crafted: 0 };
  const n = Math.max(0, Math.floor(times));
  if (n < 1) return { ok: false, msg: 'Invalid amount.', crafted: 0 };
  let crafted = 0;
  for (let i = 0; i < n; i++) {
    const r = craftCustom(inv, recipeId);
    if (!r.ok) {
      if (crafted === 0) return { ok: false, msg: r.msg, crafted: 0 };
      return {
        ok: true,
        crafted,
        msg: `Crafted ${crafted}× ${recipe.name} (stopped: ${r.msg})`,
      };
    }
    crafted++;
  }
  return { ok: true, crafted, msg: `Crafted ${crafted}× ${recipe.name}` };
}

export function sellCustomToVendor(
  inv: InventoryState,
  recipeId: string,
  qty = 1,
): { ok: boolean; msg: string; gained: number } {
  const recipe = inv.customRecipes.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown invention.', gained: 0 };
  const n = Math.max(0, Math.floor(qty));
  if (n < 1) return { ok: false, msg: 'Invalid amount.', gained: 0 };
  const have = inv.customStock[recipeId] ?? 0;
  if (have < n) return { ok: false, msg: `Need ${n}× ${recipe.name} in stock.`, gained: 0 };
  inv.customStock[recipeId] = have - n;
  if (inv.customStock[recipeId]! <= 0) delete inv.customStock[recipeId];
  const gained = recipe.sellValue * n;
  inv.brass += gained;
  return {
    ok: true,
    gained,
    msg: n === 1 ? `Sold ${recipe.name} for ${gained} brass.` : `Sold ${n}× ${recipe.name} for ${gained} brass.`,
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
    lastSalesDrivers: s.lastSalesDrivers ?? '',
    pendingHaggle: s.pendingHaggle ? { ...s.pendingHaggle } : null,
    layout: s.layout
      ? {
          ...s.layout,
          props: (s.layout.props ?? []).map((p) => ({ ...p })),
        }
      : null,
    layoutPaid: s.layoutPaid ?? 0,
    forcedClosed: !!s.forcedClosed,
  };
}

function stallFromSave(s: Partial<StallState> | undefined): StallState {
  const base = emptyStall();
  if (!s || typeof s !== 'object') return base;
  base.owned = !!s.owned;
  base.open = !!s.open;
  base.forcedClosed = !!(s as StallState).forcedClosed;
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
  base.lastSalesDrivers =
    typeof (s as StallState).lastSalesDrivers === 'string'
      ? (s as StallState).lastSalesDrivers
      : '';
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

function homeLayoutToSave(L: HomeLayout | null | undefined) {
  if (!L) return null;
  return {
    plotX: L.plotX,
    plotZ: L.plotZ,
    yaw: L.yaw,
    tier: L.tier,
    color: L.color,
    props: (L.props ?? []).map((p) => ({
      id: p.id,
      lx: p.lx,
      lz: p.lz,
      yaw: p.yaw,
      interior: !!p.interior,
    })),
    rooms: (L.rooms ?? []).map((r) => ({ ...r })),
    built: !!L.built,
  };
}

function homeLayoutFromSave(raw: unknown): HomeLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const L = raw as HomeLayout;
  return normalizeHomeLayout({
    plotX: Number(L.plotX) || 0,
    plotZ: Number(L.plotZ) || 0,
    yaw: Number(L.yaw) || 0,
    tier: L.tier,
    color: Number(L.color) || 0,
    props: Array.isArray(L.props)
      ? L.props.map((p) => ({
          id: String(p.id ?? 'planters'),
          lx: Number(p.lx) || 0,
          lz: Number(p.lz) || 0,
          yaw: Number(p.yaw) || 0,
          interior: !!(p as SiteProp).interior,
        }))
      : [],
    rooms: Array.isArray(L.rooms)
      ? L.rooms.map((r) => ({
          kind: r.kind,
          lx: Number(r.lx) || 0,
          lz: Number(r.lz) || 0,
          yaw: Number(r.yaw) || 0,
        }))
      : [],
    built: !!L.built,
  });
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
    playerBoard: {
      ...inv.playerBoard,
      gyro: !!inv.playerBoard.gyro,
      aetherDrive: !!inv.playerBoard.aetherDrive,
    },
    fieldGear: { ...ensureFieldGear(inv) },
    customRecipes: inv.customRecipes.map((r) => ({
      ...r,
      inputs: r.inputs.map((i) => ({ ...i })),
      quality: r.quality ?? 1,
    })),
    customStock: { ...inv.customStock },
    inventionsDedupedV1: !!(inv as InventoryState & { inventionsDedupedV1?: boolean })
      .inventionsDedupedV1,
    programs: inv.programs.map((p) => ({
      id: p.id,
      name: p.name,
      nodes: [...p.nodes],
      framePref: p.framePref === 'fine' ? 'fine' : 'service',
      inventionId: p.inventionId ?? null,
      stallCommodityId: p.stallCommodityId ?? null,
      stallStockQty: p.stallStockQty ?? 3,
      inventMatA: p.inventMatA ?? null,
      inventMatB: p.inventMatB ?? null,
    })),
    stall: stallToSave(inv.stall),
    cityStalls,
    marketPressure: { ...inv.marketPressure },
    apartmentOwned: inv.apartmentOwned,
    apartmentLayout: homeLayoutToSave(inv.apartmentLayout),
    apartmentLayoutPaid: inv.apartmentLayoutPaid ?? 0,
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
      resources: storageBuildings(inv, 'resources').map((L) => factoryLayoutToSave(L)),
      crafted: storageBuildings(inv, 'crafted').map((L) => factoryLayoutToSave(L)),
      inventions: storageBuildings(inv, 'inventions').map((L) => factoryLayoutToSave(L)),
    },
    storageLayoutPaid: { ...(inv.storageLayoutPaid ?? {}) },
    bayWingLayouts: bayWingBuildings(inv).map((L) => factoryLayoutToSave(L)),
    // legacy single field for older readers
    bayWingLayout: factoryLayoutToSave(bayWingBuildings(inv)[0] ?? null),
    bayWingLayoutPaid: inv.bayWingLayoutPaid ?? 0,
    empireStanding: inv.empireStanding ?? 0,
    districtStanding: { ...(inv.districtStanding ?? {}) },
    softGoalFlags: { ...(inv.softGoalFlags ?? {}) },
    neighborLife: neighborLifeToSave(ensureNeighborLife(inv.neighborLife)),
    plazaPlots: plazaPlotsToSave(ensurePlazaPlots(inv.plazaPlots, districtsLite())),
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
    inv.workers = (o.workers as WorkerState[]).map((raw) => {
      const w: WorkerState = {
        id: String(raw.id ?? `w_${Math.random()}`),
        name: String(raw.name ?? 'Worker'),
        job: (raw.job as JobId) || 'harvest',
        programId: raw.programId ? String(raw.programId) : null,
        hasBoard: !!raw.hasBoard,
        hasSpeedTool: !!raw.hasSpeedTool,
        hasHaulPack: !!raw.hasHaulPack,
        speedToolTier: (typeof raw.speedToolTier === 'number'
          ? raw.speedToolTier
          : raw.hasSpeedTool
            ? 1
            : 0) as ToolTier,
        haulToolTier: (typeof raw.haulToolTier === 'number'
          ? raw.haulToolTier
          : raw.hasHaulPack
            ? 1
            : 0) as ToolTier,
        jobsDone: typeof raw.jobsDone === 'number' ? raw.jobsDone : 0,
        payGrade: typeof raw.payGrade === 'number' ? raw.payGrade : 0,
        harvestSiteId:
          typeof raw.harvestSiteId === 'string' && raw.harvestSiteId
            ? String(raw.harvestSiteId)
            : null,
        harvestMatId:
          typeof raw.harvestMatId === 'string' && raw.harvestMatId in COMMODITIES
            ? (raw.harvestMatId as CommodityId)
            : null,
        flowerMatId:
          typeof raw.flowerMatId === 'string' && raw.flowerMatId in COMMODITIES
            ? (raw.flowerMatId as CommodityId)
            : null,
        kind: raw.kind === 'robot' ? 'robot' : 'human',
        hasMedallion: !!raw.hasMedallion,
        frameId: raw.frameId ? String(raw.frameId) : null,
        frameName: raw.frameName ? String(raw.frameName) : null,
        frameQuality: typeof raw.frameQuality === 'number' ? raw.frameQuality : undefined,
        frameSpeedMul: typeof raw.frameSpeedMul === 'number' ? raw.frameSpeedMul : undefined,
        frameWorkMul: typeof raw.frameWorkMul === 'number' ? raw.frameWorkMul : undefined,
        frameHarvestMul: typeof raw.frameHarvestMul === 'number' ? raw.frameHarvestMul : undefined,
        frameProgramBonus: typeof raw.frameProgramBonus === 'number' ? raw.frameProgramBonus : undefined,
        unpaid: !!raw.unpaid,
      };
      normalizeWorkerToolTiers(w);
      return w;
    });
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
        speedToolTier: 0,
        haulToolTier: 0,
        jobsDone: 0,
        payGrade: 0,
        harvestSiteId: null,
        harvestMatId: null,
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
      harvestMatId: w.harvestMatId ?? null,
      flowerMatId: w.flowerMatId ?? null,
      speedToolTier: w.speedToolTier ?? (w.hasSpeedTool ? 1 : 0),
      haulToolTier: w.haulToolTier ?? (w.hasHaulPack ? 1 : 0),
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
      gyro: !!b.gyro,
      aetherDrive: !!b.aetherDrive,
    };
  }
  if (o.fieldGear && typeof o.fieldGear === 'object') {
    const g = o.fieldGear as PlayerFieldGear;
    inv.fieldGear = {
      reefGauge: !!g.reefGauge,
      haulRig: !!g.haulRig,
      multiScanner: !!g.multiScanner,
    };
  } else {
    ensureFieldGear(inv);
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
  inv.apartmentLayout = homeLayoutFromSave(o.apartmentLayout);
  inv.apartmentLayoutPaid =
    typeof o.apartmentLayoutPaid === 'number' ? o.apartmentLayoutPaid : 0;
  if (inv.apartmentOwned && !inv.apartmentLayout?.built) {
    ensureDefaultHomeLayout(inv);
  }
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
    inv.programs = (o.programs as WorkerProgram[]).map((p) => {
      const raw = p as WorkerProgram & Record<string, unknown>;
      const stallQty = Number(raw.stallStockQty);
      return {
        id: String(p.id),
        name: String(p.name ?? 'Program'),
        nodes: Array.isArray(p.nodes) ? [...(p.nodes as ProgramNodeKind[])] : ['harvest', 'return_bay'],
        framePref: p.framePref === 'fine' ? 'fine' : 'service',
        inventionId: typeof raw.inventionId === 'string' ? raw.inventionId : null,
        stallCommodityId:
          typeof raw.stallCommodityId === 'string' && raw.stallCommodityId in COMMODITIES
            ? (raw.stallCommodityId as CommodityId)
            : null,
        stallStockQty: Number.isFinite(stallQty)
          ? Math.max(1, Math.min(20, Math.floor(stallQty)))
          : 3,
        inventMatA:
          typeof raw.inventMatA === 'string' &&
          INVENT_MATERIAL_IDS.includes(raw.inventMatA as CommodityId)
            ? (raw.inventMatA as CommodityId)
            : null,
        inventMatB:
          typeof raw.inventMatB === 'string' &&
          INVENT_MATERIAL_IDS.includes(raw.inventMatB as CommodityId)
            ? (raw.inventMatB as CommodityId)
            : null,
      };
    });
  }
  // After recipes, stock, stalls, frames, programs are loaded — purge duplicate pairs
  dedupeCustomRecipes(inv);
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
        knownLikes: !!r.knownLikes,
        storiesShared: Array.isArray(r.storiesShared)
          ? r.storiesShared.map(String)
          : [],
      }))
    : [];
  inv.storageLayouts = {};
  inv.storageLayoutPaid = {};
  if (o.storageLayouts && typeof o.storageLayouts === 'object') {
    const sl = o.storageLayouts as Record<string, unknown>;
    for (const track of ['resources', 'crafted', 'inventions'] as StorageTrack[]) {
      const raw = sl[track];
      const list: FactoryLayout[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const L = factoryLayoutFromSave(item);
          if (L?.built) list.push(L);
        }
      } else {
        const L = factoryLayoutFromSave(raw);
        if (L?.built) list.push(L);
      }
      if (list.length) inv.storageLayouts[track] = list;
    }
  }
  if (o.storageLayoutPaid && typeof o.storageLayoutPaid === 'object') {
    inv.storageLayoutPaid = { ...(o.storageLayoutPaid as InventoryState['storageLayoutPaid']) };
  }
  inv.bayWingLayouts = [];
  if (Array.isArray(o.bayWingLayouts)) {
    for (const item of o.bayWingLayouts) {
      const L = factoryLayoutFromSave(item);
      if (L?.built) inv.bayWingLayouts.push(L);
    }
  }
  if (!inv.bayWingLayouts.length) {
    const legacy = factoryLayoutFromSave(o.bayWingLayout);
    if (legacy?.built) inv.bayWingLayouts.push(legacy);
  }
  inv.bayWingLayout = inv.bayWingLayouts[0] ?? null;
  inv.bayWingLayoutPaid = typeof o.bayWingLayoutPaid === 'number' ? o.bayWingLayoutPaid : 0;
  inv.empireStanding = typeof o.empireStanding === 'number' ? o.empireStanding : 0;
  inv.districtStanding = {};
  if (o.districtStanding && typeof o.districtStanding === 'object') {
    for (const [k, v] of Object.entries(o.districtStanding as Record<string, unknown>)) {
      if (typeof v === 'number') inv.districtStanding[k] = v;
    }
  }
  inv.softGoalFlags = {};
  if (o.softGoalFlags && typeof o.softGoalFlags === 'object') {
    const f = o.softGoalFlags as SoftGoalFlags;
    if (f.metNeighbor) inv.softGoalFlags.metNeighbor = true;
    if (f.clearedNeighborDebt) inv.softGoalFlags.clearedNeighborDebt = true;
    if (f.hiredNeighbor) inv.softGoalFlags.hiredNeighbor = true;
    if (f.ownedPlot) inv.softGoalFlags.ownedPlot = true;
    if (f.plantedGarden) inv.softGoalFlags.plantedGarden = true;
    if (f.boundRetail) inv.softGoalFlags.boundRetail = true;
    if (typeof f.lastAnnouncedGoalId === 'string') {
      inv.softGoalFlags.lastAnnouncedGoalId = f.lastAnnouncedGoalId;
    }
  }
  ensureStandingState(inv);
  bootstrapStandingFromProgress(inv);
  inv.neighborLife = neighborLifeFromSave(o.neighborLife);
  // Sync soft flags from neighbor life (old saves / mid-session)
  for (const n of inv.neighborLife.neighbors) {
    if (n.known) inv.softGoalFlags.metNeighbor = true;
    if (!n.debt && n.debtPaidToward > 0) inv.softGoalFlags.clearedNeighborDebt = true;
    if (n.hiredAsWorkerId) inv.softGoalFlags.hiredNeighbor = true;
    if (n.homeOwner === 'player') inv.softGoalFlags.ownedPlot = true;
  }
  inv.plazaPlots = plazaPlotsFromSave(o.plazaPlots, districtsLite());
  if (playerOwnedPlotCount(inv) > 0) inv.softGoalFlags.ownedPlot = true;
  // Sync optional RE soft flags from world (old saves)
  for (const p of inv.plazaPlots.plots) {
    if (p.owner !== 'player') continue;
    if (p.buildings.some((b) => b.kind === 'garden')) inv.softGoalFlags.plantedGarden = true;
    if (p.retailBound || p.buildings.some((b) => b.kind === 'retail')) {
      inv.softGoalFlags.boundRetail = true;
    }
  }
  return inv;
}

export function playerOwnedPlotCount(inv: InventoryState): number {
  ensureInvPlots(inv);
  return inv.plazaPlots.plots.filter((p) => p.owner === 'player').length;
}

export type { PlotState, PlazaPlotsState, ZoningHint, PlotBuildKind, PlotShape, PlotAirwayLink };
export {
  quotePlotBuyPrice,
  getPlot,
  plotId,
  plotWorldCenter,
  plotOwnerLabel,
  plotMapColor,
  plotsInDistrict,
  playerOwnedPlots,
  PLOT_GRID,
  PLOT_BUILD_CATALOG,
  quotePlotBuild,
  hasAdjacentOwned,
  hasNearbyOwned,
  nearestOwnedPlot,
  listEdgeCandidates,
  plotPrimaryBuilding,
  plotHasBuild,
  plotRentIncome,
  plotLivePos,
  clampPlotWorld,
  clampLocalOnPlot,
  computeAutoBridges,
  bridgeEdgePoints,
  platformsSeparatedForBridge,
  plotPlatformHalf,
  platformFacingEdgeMid,
  bestCardinalSidePair,
  BRIDGE_WIDTH_MUL,
  PLOT_SHAPES,
  plotShapeLabel,
  quotePlotShapeChange,
  quotePlotLayerUpgrade,
  quotePlotAirwayLink,
  listAirwayTargets,
  listPlotAirways,
  movePlotFree,
  plotIsEmptyHolding,
  plotEmptyTax,
  plotStructureUpkeep,
  GARDEN_SPOT_COUNT,
  gardenSpotLocalOffsets,
  ensureGardenSpots,
  MAX_PLOT_LAYER,
};

/**
 * Buy a plaza plot (Task 4–5). Optional tenant stay for NPC home plots (Task 6).
 */
export function buyPlazaPlot(
  inv: InventoryState,
  plotKey: string,
  opts?: { keepTenant?: boolean; rentPolicy?: RentPolicy },
): { ok: boolean; msg: string; plot?: PlotState } {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const plot = getPlot(inv.plazaPlots, plotKey);
  if (!plot) return { ok: false, msg: 'Unknown plot.' };
  if (plot.owner === 'player') return { ok: false, msg: 'You already own this plot.' };
  if (!plot.forSale && plot.owner !== 'npc') {
    return { ok: false, msg: 'This plot is not for sale.' };
  }

  let affinity = 0;
  let clearedDebt = false;
  if (plot.npcOwnerId) {
    const n = getInvNeighbor(inv, plot.npcOwnerId);
    if (n) {
      affinity = n.affinity;
      clearedDebt = !n.debt && n.debtPaidToward > 0;
    }
  }
  const price = quotePlotBuyPrice(plot, {
    affinity,
    clearedDebtWithOwner: clearedDebt,
  });
  if (inv.brass < price) {
    return {
      ok: false,
      msg: `Need ${price.toLocaleString()} brass for this plot (you have ${inv.brass.toLocaleString()}).`,
    };
  }
  inv.brass -= price;
  const prevOwner = plot.owner;
  const prevNpc = plot.npcOwnerId;
  plot.owner = 'player';
  plot.forSale = false;
  plot.npcOwnerId = null;
  inv.softGoalFlags.ownedPlot = true;

  const keep = opts?.keepTenant !== false;
  const policy: RentPolicy = opts?.rentPolicy ?? 'fair';
  const hadTenant =
    !!plot.tenantNeighborId ||
    (prevOwner === 'npc' && !!prevNpc);

  if (keep && hadTenant && !plot.vacant) {
    const tid = plot.tenantNeighborId ?? prevNpc;
    plot.tenantNeighborId = tid;
    plot.rentPolicy = policy;
    plot.vacant = false;
    // Sync neighbor life if homeowner
    if (tid) {
      const n = getInvNeighbor(inv, tid);
      if (n) {
        n.homeOwner = 'player';
        n.isPlayerTenant = true;
        n.rentPolicy = policy;
        n.landlordId = null;
        if (n.drama === 'behind_on_rent') n.drama = 'none';
        if (n.debt) {
          n.debtPaidToward += n.debt.amount;
          n.debt = null;
          inv.softGoalFlags.clearedNeighborDebt = true;
        }
      }
    }
    if (policy === 'cheap') {
      applyStanding(inv, 3, { districtId: plot.districtId, districtDelta: 5 });
    } else if (policy === 'fair') {
      applyStanding(inv, 2, { districtId: plot.districtId, districtDelta: 3 });
    } else {
      applyStanding(inv, -2, { districtId: plot.districtId, districtDelta: -3 });
    }
  } else {
    plot.tenantNeighborId = null;
    plot.rentPolicy = null;
    plot.vacant = true;
    applyStanding(inv, 1, { districtId: plot.districtId, districtDelta: 2 });
  }

  const rentBit =
    plot.rentPolicy && plot.tenantNeighborId
      ? ` · tenant @ ${plot.rentPolicy} (${rentIncomeForPad(plot.listPrice, plot.rentPolicy).toLocaleString()}b/tick)`
      : ' · vacant lot';
  const dist = districtById(plot.districtId);
  return {
    ok: true,
    plot,
    msg:
      `Deed · ${dist?.name ?? plot.districtId} plot (${plot.cellX},${plot.cellY}) ` +
      `−${price.toLocaleString()}b · ${plot.zoningHint}${rentBit}`,
  };
}

export function setPlotRentPolicy(
  inv: InventoryState,
  plotKey: string,
  policy: RentPolicy,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  const plot = getPlot(inv.plazaPlots, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'You don’t own that plot.' };
  }
  if (!plot.tenantNeighborId || plot.vacant) {
    return { ok: false, msg: 'No tenant on this plot.' };
  }
  plot.rentPolicy = policy;
  const n = getInvNeighbor(inv, plot.tenantNeighborId);
  if (n) n.rentPolicy = policy;
  const rent = plotRentIncome(plot);
  if (policy === 'cheap') applyStanding(inv, 2, { districtId: plot.districtId, districtDelta: 3 });
  if (policy === 'predatory') applyStanding(inv, -2, { districtId: plot.districtId, districtDelta: -3 });
  return {
    ok: true,
    msg: `Plot rent → ${policy} (${rent.toLocaleString()}b/tick).`,
  };
}

/** Task 7: develop an owned plot (free local placement + yaw) */
export function developPlot(
  inv: InventoryState,
  plotKey: string,
  kind: PlotBuildKind,
  opts?: {
    lx?: number;
    lz?: number;
    yaw?: number;
    layer?: number;
  },
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const plot = getPlot(inv.plazaPlots, plotKey);
  if (!plot) return { ok: false, msg: 'Unknown plot.' };
  if (kind === 'bridge') return { ok: false, msg: 'Bridges are no longer available.' };
  const dist = districtById(plot.districtId);
  const layer = opts?.layer ?? 0;
  const q = quotePlotBuild(plot, kind, { layer });
  if (!q.ok) return { ok: false, msg: q.msg ?? 'Cannot build.' };
  if (inv.brass < q.cost) {
    return {
      ok: false,
      msg: `Need ${q.cost.toLocaleString()} brass (you have ${inv.brass.toLocaleString()}).`,
    };
  }
  const live = dist ? plotLivePos(plot, dist) : { cellSize: 20 };
  const clamped = clampLocalOnPlot(live.cellSize, opts?.lx ?? 0, opts?.lz ?? 0);
  const r = applyPlotBuild(plot, kind, {
    lx: clamped.lx,
    lz: clamped.lz,
    yaw: opts?.yaw ?? 0,
    cellSize: live.cellSize,
    layer,
  });
  if (!r.ok) return { ok: false, msg: r.msg };
  inv.brass -= r.cost;
  if (r.offZone) {
    applyStanding(inv, -1, { districtId: plot.districtId, districtDelta: -2 });
  } else if (kind === 'decor') {
    applyStanding(inv, 1, { districtId: plot.districtId, districtDelta: 2 });
  } else {
    applyStanding(inv, 1, { districtId: plot.districtId, districtDelta: 1 });
  }
  if (kind === 'retail') {
    const stall = ensureCityStall(inv, plot.districtId);
    if (!stall.owned) {
      stall.owned = true;
      stall.open = true;
    }
    plot.retailBound = true;
    inv.softGoalFlags.boundRetail = true;
  }
  if (kind === 'garden') {
    inv.softGoalFlags.plantedGarden = true;
  }
  // New housing starts vacant and ready for tenant offers
  if (kind === 'home' || kind === 'apartment') {
    if (!plot.tenantNeighborId) {
      plot.vacant = true;
      plot.rentPolicy = null;
    }
  }
  // Immediate fill offers so players don't wait a rent tick
  const seeded = seedOffersAfterBuild(inv, plotKey, kind);
  const seedBit = seeded.msgs.length ? ` · ${seeded.msgs[0]}` : '';
  return { ok: true, msg: r.msg + seedBit };
}

/** Task 8 */
export function rotatePlot(
  inv: InventoryState,
  plotKey: string,
  yaw?: number,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  return rotatePlayerPlot(inv.plazaPlots, plotKey, yaw);
}

/** Free-move platform within district limits */
export function movePlot(
  inv: InventoryState,
  plotKey: string,
  worldX: number,
  worldZ: number,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  const plot = getPlot(inv.plazaPlots, plotKey);
  if (!plot) return { ok: false, msg: 'Unknown plot.' };
  const d = districtById(plot.districtId);
  if (!d) return { ok: false, msg: 'Unknown district.' };
  return movePlotFree(inv.plazaPlots, plotKey, worldX, worldZ, d);
}

/** Task 10: remodel pad shape (square → octagon / circle / triangle). */
export function changePlotShape(
  inv: InventoryState,
  plotKey: string,
  shape: PlotShape,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const plot = getPlot(inv.plazaPlots, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to change its shape.' };
  }
  if (plot.shape === shape) {
    return { ok: false, msg: `Already ${plotShapeLabel(shape)}.` };
  }
  const cost = quotePlotShapeChange(plot, shape);
  if (cost <= 0) return { ok: false, msg: 'Nothing to remodel.' };
  if (inv.brass < cost) {
    return {
      ok: false,
      msg: `Need ${cost.toLocaleString()} brass (you have ${inv.brass.toLocaleString()}).`,
    };
  }
  inv.brass -= cost;
  const r = setPlotShape(inv.plazaPlots, plotKey, shape);
  if (!r.ok) {
    inv.brass += cost; // refund if apply failed after charge
    return { ok: false, msg: r.msg };
  }
  applyStanding(inv, 1, {
    districtId: plot.districtId,
    districtDelta: 1,
  });
  return { ok: true, msg: r.msg };
}

/** Task 11: unlock upper deck + climb rails on an owned plot. */
export function upgradePlotLayer(
  inv: InventoryState,
  plotKey: string,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const plot = getPlot(inv.plazaPlots, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Own the plot to add a deck.' };
  }
  const cost = quotePlotLayerUpgrade(plot);
  if (cost <= 0) {
    return { ok: false, msg: `Already at max deck L${MAX_PLOT_LAYER}.` };
  }
  if (inv.brass < cost) {
    return {
      ok: false,
      msg: `Need ${cost.toLocaleString()} brass (you have ${inv.brass.toLocaleString()}).`,
    };
  }
  inv.brass -= cost;
  const r = unlockPlotUpperDeck(inv.plazaPlots, plotKey);
  if (!r.ok) {
    inv.brass += cost;
    return { ok: false, msg: r.msg };
  }
  applyStanding(inv, 2, {
    districtId: plot.districtId,
    districtDelta: 2,
  });
  return { ok: true, msg: r.msg };
}

/** Task 12: link two owned plots with a boardable skyway. */
export function createPlotAirway(
  inv: InventoryState,
  fromId: string,
  toId: string,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const a = getPlot(inv.plazaPlots, fromId);
  const b = getPlot(inv.plazaPlots, toId);
  if (!a || !b || a.owner !== 'player' || b.owner !== 'player') {
    return { ok: false, msg: 'Both plots must be yours.' };
  }
  if (a.districtId !== b.districtId) {
    return { ok: false, msg: 'Airways link plots in the same district only (v1).' };
  }
  if (hasPlotAirway(inv.plazaPlots, fromId, toId)) {
    return { ok: false, msg: 'Airway already links these pads.' };
  }
  const cost = quotePlotAirwayLink(a, b);
  if (inv.brass < cost) {
    return {
      ok: false,
      msg: `Need ${cost.toLocaleString()} brass (you have ${inv.brass.toLocaleString()}).`,
    };
  }
  inv.brass -= cost;
  const r = linkPlotAirway(inv.plazaPlots, fromId, toId);
  if (!r.ok) {
    inv.brass += cost;
    return { ok: false, msg: r.msg };
  }
  applyStanding(inv, 1, { districtId: a.districtId, districtDelta: 2 });
  return { ok: true, msg: r.msg };
}

/**
 * Plant a held flower into an empty garden bed on an owned plot.
 * Consumes 1 flower; that bed becomes a harvest source of that type.
 */
export function plantPlotGardenSpot(
  inv: InventoryState,
  plotKey: string,
  buildingIndex: number,
  spotIndex: number,
  flowerId: CommodityId,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  if (!isFlowerCommodity(flowerId)) {
    return { ok: false, msg: 'Only blooms and cloudblooms can be planted here.' };
  }
  const plot = getPlot(inv.plazaPlots, plotKey);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'You need to own this pad.' };
  }
  const b = plot.buildings[buildingIndex];
  if (!b || b.kind !== 'garden') {
    return { ok: false, msg: 'No flower garden at that slot.' };
  }
  const spots = ensureGardenSpots(b);
  if (spotIndex < 0 || spotIndex >= spots.length) {
    return { ok: false, msg: 'Invalid garden bed.' };
  }
  if (spots[spotIndex]) {
    return {
      ok: false,
      msg: `Bed already grows ${COMMODITIES[spots[spotIndex] as CommodityId]?.name ?? spots[spotIndex]}. Harvest it first.`,
    };
  }
  if (getQty(inv, flowerId) < 1) {
    return {
      ok: false,
      msg: `Need 1 ${COMMODITIES[flowerId]?.name ?? flowerId} in pack to plant.`,
    };
  }
  removeItem(inv, flowerId, 1);
  spots[spotIndex] = flowerId;
  inv.softGoalFlags.plantedGarden = true;
  applyStanding(inv, 0.5, { districtId: plot.districtId, districtDelta: 1 });
  return {
    ok: true,
    msg: `Planted ${COMMODITIES[flowerId]?.name ?? flowerId} · bed ${spotIndex + 1}/5 · E to harvest later.`,
  };
}

/** List flower commodities the player currently holds (for garden plant UI). */
export function listHeldFlowers(inv: InventoryState): CommodityId[] {
  return FLOWER_IDS.filter((id) => getQty(inv, id) > 0) as CommodityId[];
}

function isFlowerCommodity(id: string): id is CommodityId {
  return (FLOWER_IDS as readonly string[]).includes(id);
}

/** Task 9: buy edge attachment cell then optionally take ownership immediately */
export function buyEdgePlot(
  inv: InventoryState,
  districtId: string,
  cellX: number,
  cellY: number,
): { ok: boolean; msg: string; plot?: PlotState } {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const d = districtById(districtId);
  if (!d) return { ok: false, msg: 'Unknown district.' };
  const lite = districtsLite().find((x) => x.id === districtId)!;
  const cands = listEdgeCandidates(inv.plazaPlots, districtId, lite);
  const cand = cands.find((c) => c.cellX === cellX && c.cellY === cellY);
  if (!cand) {
    return { ok: false, msg: 'That edge cell is not available (must attach to existing plots).' };
  }
  if (inv.brass < cand.price) {
    return {
      ok: false,
      msg: `Need ${cand.price.toLocaleString()} brass for edge growth (you have ${inv.brass.toLocaleString()}).`,
    };
  }
  inv.brass -= cand.price;
  const plot = createEdgePlot(inv.plazaPlots, lite, cellX, cellY);
  plot.owner = 'player';
  plot.forSale = false;
  plot.vacant = true;
  plot.isEdge = true;
  inv.softGoalFlags.ownedPlot = true;
  applyStanding(inv, 2, { districtId, districtDelta: 3 });
  return {
    ok: true,
    plot,
    msg: `Edge plot (${cellX},${cellY}) on ${d.name} (−${cand.price.toLocaleString()}b). Soft-infinite land.`,
  };
}

/**
 * Layer M2 — NPC livelihood: fictional wages, rent stress, force-close stand, homeless.
 * Runs on landlord rent clock (same cadence as player tenant collection).
 */
export function tickNpcLivelihoods(inv: InventoryState): {
  msgs: string[];
  homelessNew: { id: string; name: string }[];
  standsClosed: number;
} {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  const msgs: string[] = [];
  const homelessNew: { id: string; name: string }[] = [];
  let standsClosed = 0;

  for (const n of inv.neighborLife.neighbors) {
    const def = neighborDef(n.id);
    if (!def) continue;
    // On crew or player tenant: protected from NPC foreclosure path
    if (n.hiredAsWorkerId) {
      const still = inv.workers.some((w) => w.id === n.hiredAsWorkerId);
      if (still) continue;
      n.hiredAsWorkerId = null;
    }
    if (n.isPlayerTenant && n.homeOwner === 'player') continue;
    if (n.homeless) continue;

    // Soft wages from open stand (reduces fail pressure)
    let wageBuffer = 0;
    if (n.vendorOpen) {
      const base = 8 + Math.floor((def.basePrice / 10_000) * 4);
      const roll = base + Math.floor(Math.random() * 6);
      n.vendorEarned = (n.vendorEarned ?? 0) + roll;
      wageBuffer = roll;
      // Partial self-pay on debt when stand is earning
      if (n.debt && n.debt.amount > 0 && Math.random() < 0.35) {
        const cut = Math.min(n.debt.amount, Math.floor(roll * 0.6));
        n.debt.amount -= cut;
        if (n.debt.amount <= 0) {
          n.debt = null;
          if (n.drama === 'behind_on_rent') n.drama = 'none';
          msgs.push(`${def.name} scraped rent from stand wages.`);
        }
      }
    }

    // Stress: landlord debt, rent drama, or closed stand with landlord home
    const stressed =
      (n.debt && n.debt.amount > 0) ||
      n.drama === 'behind_on_rent' ||
      n.drama === 'tax_warning' ||
      (n.homeOwner === 'npc_landlord' && !n.vendorOpen);

    if (!stressed) continue;

    // Wage buffer softens fail chance
    const failChance =
      NPC_LIVELIHOOD_FAIL_CHANCE * (wageBuffer >= 12 ? 0.55 : wageBuffer > 0 ? 0.75 : 1);
    if (Math.random() > failChance) continue;

    n.livelihoodFails = (n.livelihoodFails ?? 0) + 1;

    // Escalate: close stand → grow debt → homeless
    if (n.vendorOpen) {
      n.vendorOpen = false;
      standsClosed++;
      if (n.drama === 'none') n.drama = 'behind_on_rent';
      msgs.push(`${def.name}'s stand closed — wages failed rent.`);
    }

    if (n.homeOwner === 'npc_landlord' || n.debt) {
      const landlord =
        (n.landlordId && landlordById(n.landlordId)) ||
        landlordById('landlord_mira') ||
        landlordById('landlord_city');
      const bump = Math.max(40, Math.round((def.startDebt ?? 400) * 0.08));
      if (!n.debt) {
        n.debt = {
          landlordId: landlord?.id ?? 'landlord_city',
          landlordName: landlord?.name ?? 'City Lease Office',
          amount: bump,
          plotKey: `home_${n.id}`,
        };
      } else {
        n.debt.amount += bump;
      }
      if (n.drama === 'none' || n.drama === 'workplace_fight') {
        n.drama = 'behind_on_rent';
      }
    }

    const startDebt = def.startDebt ?? 400;
    const debtTrigger =
      n.debt && n.debt.amount >= startDebt * NPC_HOMELESS_DEBT_MUL;
    const failTrigger = (n.livelihoodFails ?? 0) >= NPC_FAILS_BEFORE_HOMELESS;

    if (debtTrigger || failTrigger) {
      n.homeless = true;
      n.vacated = true;
      n.drama = 'homeless';
      n.vendorOpen = false;
      n.isPlayerTenant = false;
      n.rentPolicy = null;
      homelessNew.push({ id: n.id, name: def.name });
      msgs.push(
        `${def.name} lost their pad — homeless on the plazas. Hire, gift, or clear debt.`,
      );
    }
  }

  return { msgs, homelessNew, standsClosed };
}

/** Combined neighbor-pad + plaza-plot rent tick + NPC livelihood (Layer M). */
export function tickAllLandlordRents(inv: InventoryState): {
  collected: number;
  msgs: string[];
  left: string[];
  homelessNew?: string[];
} {
  const nb = tickNeighborRents(inv);
  ensureInvPlots(inv);
  const pr = collectPlotRents(
    inv.plazaPlots,
    (n) => {
      inv.brass += n;
      notePeakBrass(inv);
    },
    (empire, districtId, districtDelta) => {
      applyStanding(inv, empire, { districtId, districtDelta });
    },
  );
  // Sync vacated plot tenants to neighbor state
  for (const L of pr.left) {
    const n = getInvNeighbor(inv, L.tenantId);
    if (n) {
      n.vacated = true;
      n.isPlayerTenant = false;
      n.rentPolicy = null;
    }
  }
  const life = tickNpcLivelihoods(inv);
  const offers = tickTenantOffers(inv);
  const fill = tickPlotFillAndUse(inv);
  const collected = nb.collected + pr.collected + fill.brass;
  const msgs = [...nb.msgs, ...pr.msgs, ...life.msgs, ...offers.msgs, ...fill.msgs];
  const left = [
    ...nb.left.map((x) => x.name),
    ...pr.left.map((x) => x.tenantId),
  ];
  return {
    collected,
    msgs,
    left,
    homelessNew: life.homelessNew.map((h) => h.name),
  };
}

// ——— Plot fill: retail shopkeepers, factory crews, housing names ———

export type { PlotFillOffer, PlotFillKind } from './plotUse';
export { plotOccupancyLabel, plotHasRetail, plotHasFactory, plotHasHousing } from './plotUse';

export function listPendingFillOffers(inv: InventoryState): PlotFillOffer[] {
  ensureInvPlots(inv);
  return [...(inv.plazaPlots.pendingFillOffers ?? [])];
}

function freeNpcApplicants(inv: InventoryState): NeighborState[] {
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  // Anyone not already your tenant or on crew can apply (broad pool so offers always appear)
  return inv.neighborLife.neighbors.filter((n) => {
    if (n.hiredAsWorkerId) {
      const still = inv.workers.some((w) => w.id === n.hiredAsWorkerId);
      if (still) return false;
    }
    if (n.isPlayerTenant && !n.vacated) return false;
    return true;
  });
}

function pickNpcApplicant(
  inv: InventoryState,
  preferSeeking: boolean,
): NeighborState | undefined {
  const all = freeNpcApplicants(inv);
  if (!all.length) return undefined;
  if (preferSeeking) {
    const seeking = all.filter(
      (n) =>
        n.homeless ||
        n.drama === 'homeless' ||
        n.drama === 'behind_on_rent' ||
        n.vacated ||
        (n.debt && n.debt.amount > 0),
    );
    if (seeking.length) {
      return seeking[Math.floor(Math.random() * seeking.length)]!;
    }
  }
  return all[Math.floor(Math.random() * all.length)]!;
}

/**
 * Create one fill offer for a plot kind if the pad is empty and no offer pending.
 * Used after build + on door interact so players always see the system.
 */
export function ensureFillOfferForPlot(
  inv: InventoryState,
  plotId: string,
  kind: 'housing' | 'retail' | 'factory',
): PlotFillOffer | null {
  ensureInvPlots(inv);
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  if (!inv.plazaPlots.pendingFillOffers) inv.plazaPlots.pendingFillOffers = [];
  const plot = getPlot(inv.plazaPlots, plotId);
  if (!plot || plot.owner !== 'player') return null;

  if (kind === 'housing') {
    if (!plotHasHousing(plot) || (plot.tenantNeighborId && !plot.vacant)) return null;
  } else if (kind === 'retail') {
    if (!plotHasRetail(plot) || plot.retailOperatorId) return null;
  } else if (kind === 'factory') {
    if (!plotHasFactory(plot) || plot.factoryOperatorId) return null;
  }

  const existing = inv.plazaPlots.pendingFillOffers.find(
    (o) => o.plotId === plotId && o.kind === kind,
  );
  if (existing) return existing;

  let offer: PlotFillOffer | null = null;
  if (kind === 'housing') {
    const app = pickNpcApplicant(inv, true);
    if (!app) return null;
    const def = neighborDef(app.id);
    const pol = defaultHousingOfferPolicy();
    const rent = housingOfferRent(plot.listPrice || 12_000, pol);
    offer = {
      id: `fill_h_${plot.id}_${app.id}_${Date.now().toString(36)}`,
      plotId: plot.id,
      kind: 'housing',
      applicantId: app.id,
      applicantKind: 'npc',
      applicantName: def?.name ?? app.id,
      offeredPolicy: pol,
      offeredRent: rent,
      pitch: `${def?.name ?? 'Someone'} offers ${pol} rent (${rent.toLocaleString()}b/tick) for this home.`,
    };
  } else if (kind === 'retail') {
    const app = pickNpcApplicant(inv, false);
    if (!app) return null;
    const def = neighborDef(app.id);
    offer = {
      id: `fill_r_${plot.id}_${app.id}_${Date.now().toString(36)}`,
      plotId: plot.id,
      kind: 'retail',
      applicantId: app.id,
      applicantKind: 'npc',
      applicantName: def?.name ?? app.id,
      pitch: `${def?.name ?? 'A merchant'} wants to run this shop — stock goods you can buy.`,
    };
  } else {
    const idleCrew = inv.workers.filter((w) => w.job === 'idle' && !w.unpaid);
    if (idleCrew.length) {
      const w = idleCrew[Math.floor(Math.random() * idleCrew.length)]!;
      offer = {
        id: `fill_f_${plot.id}_${w.id}_${Date.now().toString(36)}`,
        plotId: plot.id,
        kind: 'factory',
        applicantId: w.id,
        applicantKind: 'worker',
        applicantName: w.name,
        pitch: `${w.name} (crew) offers to run this factory pad for works brass.`,
      };
    } else {
      const app = pickNpcApplicant(inv, false);
      if (!app) return null;
      const def = neighborDef(app.id);
      offer = {
        id: `fill_f_${plot.id}_${app.id}_${Date.now().toString(36)}`,
        plotId: plot.id,
        kind: 'factory',
        applicantId: app.id,
        applicantKind: 'npc',
        applicantName: def?.name ?? app.id,
        pitch: `${def?.name ?? 'A hand'} wants to operate this factory.`,
      };
    }
  }
  if (offer) inv.plazaPlots.pendingFillOffers.push(offer);
  return offer;
}

/** After building home/retail/factory — seed offers immediately. */
export function seedOffersAfterBuild(
  inv: InventoryState,
  plotId: string,
  buildKind: string,
): { msgs: string[] } {
  const msgs: string[] = [];
  const kinds: ('housing' | 'retail' | 'factory')[] = [];
  if (buildKind === 'home' || buildKind === 'apartment') kinds.push('housing');
  if (buildKind === 'retail') kinds.push('retail');
  if (buildKind === 'factory') kinds.push('factory');
  for (const k of kinds) {
    const o = ensureFillOfferForPlot(inv, plotId, k);
    if (o) msgs.push(o.pitch + ' · Lease office or E on the building to accept.');
  }
  return { msgs };
}

/**
 * Generate fill offers for vacant housing / retail / factory on player land,
 * restock open shops, pay factory operator wages to player.
 */
export function tickPlotFillAndUse(inv: InventoryState): {
  msgs: string[];
  brass: number;
  newOffers: PlotFillOffer[];
} {
  ensureInvPlots(inv);
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  if (!inv.plazaPlots.pendingFillOffers) inv.plazaPlots.pendingFillOffers = [];
  const offers = inv.plazaPlots.pendingFillOffers;
  const msgs: string[] = [];
  const newOffers: PlotFillOffer[] = [];
  let brass = 0;

  // Drop stale offers
  inv.plazaPlots.pendingFillOffers = offers.filter((o) => {
    const p = getPlot(inv.plazaPlots, o.plotId);
    if (!p || p.owner !== 'player') return false;
    if (o.kind === 'housing' && plotHasHousing(p) && (p.vacant || !p.tenantNeighborId)) {
      return true;
    }
    if (o.kind === 'retail' && plotHasRetail(p) && !p.retailOperatorId) return true;
    if (o.kind === 'factory' && plotHasFactory(p) && !p.factoryOperatorId) return true;
    return false;
  });

  // Restock + factory income
  for (const p of inv.plazaPlots.plots) {
    if (p.owner !== 'player') continue;
    if (p.retailOperatorId && plotHasRetail(p)) {
      restockPlotRetail(p);
    }
    if (p.factoryOperatorId && plotHasFactory(p)) {
      const pay = factoryPlotIncome(p);
      if (pay > 0) {
        inv.brass += pay;
        brass += pay;
      }
    }
  }
  if (brass > 0) {
    notePeakBrass(inv);
    msgs.push(`Factory works +${brass}b.`);
  }

  // Guarantee an offer for every fillable pad (not random miss)
  const fillable = listFillablePlayerPlots(inv.plazaPlots);
  for (const { plot, kinds } of fillable) {
    for (const kind of kinds) {
      const before = inv.plazaPlots.pendingFillOffers!.length;
      const o = ensureFillOfferForPlot(inv, plot.id, kind);
      if (o && inv.plazaPlots.pendingFillOffers!.length > before) {
        newOffers.push(o);
        msgs.push(o.pitch);
      }
    }
  }
  return { msgs, brass, newOffers };
}

export function rejectFillOffer(
  inv: InventoryState,
  offerId: string,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  const list = inv.plazaPlots.pendingFillOffers ?? [];
  const idx = list.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, msg: 'Offer gone.' };
  const o = list[idx]!;
  list.splice(idx, 1);
  return { ok: true, msg: `Declined ${o.applicantName}'s offer.` };
}

export function acceptFillOffer(
  inv: InventoryState,
  offerId: string,
): { ok: boolean; msg: string } {
  ensureInvPlots(inv);
  inv.neighborLife = ensureNeighborLife(inv.neighborLife);
  const list = inv.plazaPlots.pendingFillOffers ?? [];
  const idx = list.findIndex((o) => o.id === offerId);
  if (idx < 0) return { ok: false, msg: 'Offer expired.' };
  const o = list[idx]!;
  const plot = getPlot(inv.plazaPlots, o.plotId);
  if (!plot || plot.owner !== 'player') {
    list.splice(idx, 1);
    return { ok: false, msg: 'You no longer own that plot.' };
  }

  if (o.kind === 'housing') {
    if (!plotHasHousing(plot)) {
      list.splice(idx, 1);
      return { ok: false, msg: 'No housing on this plot.' };
    }
    if (plot.tenantNeighborId && !plot.vacant) {
      list.splice(idx, 1);
      return { ok: false, msg: 'Already tenanted.' };
    }
    const n = getInvNeighbor(inv, o.applicantId);
    if (!n) {
      list.splice(idx, 1);
      return { ok: false, msg: 'Applicant left.' };
    }
    const pol = o.offeredPolicy ?? 'fair';
    plot.vacant = false;
    plot.tenantNeighborId = o.applicantId;
    plot.rentPolicy = pol;
    n.homeOwner = 'player';
    n.isPlayerTenant = true;
    n.rentPolicy = pol;
    n.vacated = false;
    n.homeless = false;
    if (n.drama === 'homeless') n.drama = 'none';
    bumpNeighborAffinity(n, 8);
    list.splice(idx, 1);
    inv.plazaPlots.pendingFillOffers = list.filter(
      (x) => !(x.plotId === o.plotId && x.kind === 'housing') && x.applicantId !== o.applicantId,
    );
    return {
      ok: true,
      msg: `${o.applicantName} moves in · home named after them · ${pol} rent ${o.offeredRent?.toLocaleString() ?? '—'}b/tick.`,
    };
  }

  if (o.kind === 'retail') {
    if (!plotHasRetail(plot)) {
      list.splice(idx, 1);
      return { ok: false, msg: 'No retail front here.' };
    }
    if (plot.retailOperatorId) {
      list.splice(idx, 1);
      return { ok: false, msg: 'Shop already staffed.' };
    }
    plot.retailOperatorId = o.applicantId;
    plot.retailShelf = plot.retailShelf ?? {};
    // Opening stock
    for (let i = 0; i < 4; i++) {
      const id = PLOT_RETAIL_STOCK_POOL[Math.floor(Math.random() * PLOT_RETAIL_STOCK_POOL.length)]!;
      plot.retailShelf[id] = (plot.retailShelf[id] ?? 0) + 2 + Math.floor(Math.random() * 3);
    }
    list.splice(idx, 1);
    inv.plazaPlots.pendingFillOffers = list.filter(
      (x) => !(x.plotId === o.plotId && x.kind === 'retail'),
    );
    return {
      ok: true,
      msg: `${o.applicantName} opens the shop · E on the front to buy goods.`,
    };
  }

  // factory
  if (!plotHasFactory(plot)) {
    list.splice(idx, 1);
    return { ok: false, msg: 'No factory on this plot.' };
  }
  if (plot.factoryOperatorId) {
    list.splice(idx, 1);
    return { ok: false, msg: 'Works already staffed.' };
  }
  plot.factoryOperatorId = o.applicantId;
  plot.factoryOperatorKind = o.applicantKind;
  list.splice(idx, 1);
  inv.plazaPlots.pendingFillOffers = list.filter(
    (x) => !(x.plotId === o.plotId && x.kind === 'factory'),
  );
  return {
    ok: true,
    msg: `${o.applicantName} runs the factory · works brass each rent tick.`,
  };
}

/** Buy one unit from a plot shop shelf. */
export function buyFromPlotShop(
  inv: InventoryState,
  plotId: string,
  id: CommodityId,
  qty = 1,
): { ok: boolean; msg: string; spent?: number } {
  ensureInvPlots(inv);
  const plot = getPlot(inv.plazaPlots, plotId);
  if (!plot || plot.owner !== 'player') {
    return { ok: false, msg: 'Unknown shop.' };
  }
  if (!plot.retailOperatorId) {
    return { ok: false, msg: 'Shop is vacant — wait for a shopkeeper offer.' };
  }
  const have = plot.retailShelf?.[id] ?? 0;
  if (have < qty) {
    return { ok: false, msg: `Only ${have}× ${COMMODITIES[id]?.name ?? id} on shelf.` };
  }
  const unit = fairStallPrice(id, inv);
  const spent = unit * qty;
  if (inv.brass < spent) {
    return { ok: false, msg: `Need ${spent} brass.` };
  }
  if (!addItem(inv, id, qty)) {
    return { ok: false, msg: 'Inventory full for that good.' };
  }
  inv.brass -= spent;
  plot.retailShelf![id] = have - qty;
  if ((plot.retailShelf![id] ?? 0) <= 0) delete plot.retailShelf![id];
  // Operator cut already "paid" as shelf fiction; tiny standing for supporting shop
  if (Math.random() < 0.25) {
    applyStanding(inv, 0.5, { districtId: plot.districtId, districtDelta: 1 });
  }
  notePeakBrass(inv);
  return {
    ok: true,
    spent,
    msg: `Bought ${qty}× ${COMMODITIES[id].name} from shop @ ${unit}b (−${spent}).`,
  };
}

// ——— Task 13: plot ownership costs (empty tax, bureaucracy, structure/layer/airway) ———

/** First owned plot is free of multi-plot paperwork; extras scale (negligible). */
export function multiPlotBureaucracyFee(ownedCount: number): number {
  if (ownedCount <= 1) return 0;
  // 1b per extra plot after the first (was 12 + 10×(n−2) ramp)
  return ownedCount - 1;
}

export interface PlotOwnershipCostBreakdown {
  emptyTax: number;
  bureaucracy: number;
  structure: number;
  layer: number;
  shape: number;
  airway: number;
  total: number;
  owned: number;
  emptyPlots: number;
  /** Short HUD line */
  line: string;
}

/** Recurring land costs each upkeep tick (empire RE sink). */
export function plotOwnershipCostsDue(inv: InventoryState): PlotOwnershipCostBreakdown {
  ensureInvPlots(inv);
  ensureStandingState(inv);
  const owned = inv.plazaPlots.plots.filter((p) => p.owner === 'player');
  let emptyTax = 0;
  let structure = 0;
  let layer = 0;
  let shape = 0;
  let emptyPlots = 0;
  for (const p of owned) {
    const e = plotEmptyTax(p);
    if (e > 0) {
      emptyTax += e;
      emptyPlots += 1;
    }
    const s = plotStructureUpkeep(p);
    structure += s.building;
    layer += s.layer;
    shape += s.shape;
  }
  const bureaucracy = multiPlotBureaucracyFee(owned.length);
  // 1b per private airway (was 6)
  const airway = listPlotAirways(inv.plazaPlots).length * 1;
  const total = emptyTax + bureaucracy + structure + layer + shape + airway;
  const parts: string[] = [];
  if (emptyTax) parts.push(`empty ${emptyTax}`);
  if (bureaucracy) parts.push(`paper ${bureaucracy}`);
  if (structure + layer + shape) parts.push(`struct ${structure + layer + shape}`);
  if (airway) parts.push(`skyway ${airway}`);
  const line =
    total > 0
      ? `Land −${total}b` + (parts.length ? ` (${parts.join(' · ')})` : '')
      : 'Land upkeep 0';
  return {
    emptyTax,
    bureaucracy,
    structure,
    layer,
    shape,
    airway,
    total,
    owned: owned.length,
    emptyPlots,
    line,
  };
}

export interface PlotOwnershipTickResult {
  ok: boolean;
  paid: number;
  need: number;
  shortfall: number;
  msg?: string;
  breakdown: PlotOwnershipCostBreakdown;
}

/**
 * Charge plot ownership sinks. Partial pay allowed (takes all remaining brass);
 * unpaid land tax hurts standing slightly so empty land-banks still hurt.
 */
export function tickPlotOwnershipCosts(inv: InventoryState): PlotOwnershipTickResult {
  const breakdown = plotOwnershipCostsDue(inv);
  const need = breakdown.total;
  if (need <= 0) {
    return { ok: true, paid: 0, need: 0, shortfall: 0, breakdown };
  }
  if (inv.brass >= need) {
    inv.brass -= need;
    return {
      ok: true,
      paid: need,
      need,
      shortfall: 0,
      breakdown,
      msg: `${breakdown.line} · ${breakdown.owned} plot(s)`,
    };
  }
  const paid = inv.brass;
  inv.brass = 0;
  const shortfall = need - paid;
  // Light brand hit for tax delinquency (not as harsh as stiffing crew)
  applyStanding(inv, -1);
  return {
    ok: false,
    paid,
    need,
    shortfall,
    breakdown,
    msg: `Land tax short ${shortfall}b (paid ${paid}/${need}) — empty lots & multi-plot paper still due.`,
  };
}
