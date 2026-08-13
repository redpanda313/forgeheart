/**
 * Shared sim surface for SP browser + future Node room host.
 * Prefer importing pure modules from here when adding MP authority.
 */

export * from './mode';
export * from './protocol';

// Re-export pure market / labor formulas (no Three.js)
export {
  combineMarketDemand,
  categoryServeMul,
  reputationSalesMul,
  decorSalesMul,
  formatSalesDrivers,
  canGrantTalkAffinity,
  canGrantGiftAffinity,
  TALK_AFFINITY_COOLDOWN_MS,
  GIFT_AFFINITY_COOLDOWN_MS,
  NPC_LIVELIHOOD_FAIL_CHANCE,
  type CustomerNeed,
  type MarketDemandBundle,
} from '../marketSim';

export {
  computeLaborMarket,
  laborMarketFromInv,
  countPlayerHousing,
  LABOR_BASELINE_POOL,
  LABOR_HOUSING_SOFT_START,
  type LaborMarketSnapshot,
  type HousingCapacity,
} from '../laborMarket';
