export enum CatalystType {
  FEDERAL_RESERVE = 'FEDERAL_RESERVE',
  INTEREST_RATES = 'INTEREST_RATES',
  INFLATION = 'INFLATION',
  CPI = 'CPI',
  PPI = 'PPI',
  JOBS = 'JOBS',
  GDP = 'GDP',
  TREASURY_YIELDS = 'TREASURY_YIELDS',

  EARNINGS = 'EARNINGS',
  GUIDANCE = 'GUIDANCE',

  ANALYST_UPGRADE = 'ANALYST_UPGRADE',
  ANALYST_DOWNGRADE = 'ANALYST_DOWNGRADE',

  SEMICONDUCTORS = 'SEMICONDUCTORS',
  AI = 'AI',

  REGULATORY = 'REGULATORY',
  LEGAL = 'LEGAL',

  MERGER_ACQUISITION = 'MERGER_ACQUISITION',

  GEOPOLITICAL = 'GEOPOLITICAL',
  MILITARY_CONFLICT = 'MILITARY_CONFLICT',
  TARIFFS = 'TARIFFS',

  ENERGY = 'ENERGY',
  OIL_SUPPLY_DISRUPTION = 'OIL_SUPPLY_DISRUPTION',
  CREDIT = 'CREDIT',
  BANKING_STRESS = 'BANKING_STRESS',
  SYSTEMIC_RISK = 'SYSTEMIC_RISK',

  MARKET_MOVING = 'MARKET_MOVING',

  OTHER = 'OTHER',
}

/** Catalysts that move the whole market rather than a single issuer. */
export const MACRO_CATALYSTS: readonly CatalystType[] = [
  CatalystType.FEDERAL_RESERVE,
  CatalystType.INTEREST_RATES,
  CatalystType.INFLATION,
  CatalystType.CPI,
  CatalystType.PPI,
  CatalystType.JOBS,
  CatalystType.GDP,
  CatalystType.TREASURY_YIELDS,
  CatalystType.GEOPOLITICAL,
  CatalystType.MILITARY_CONFLICT,
  CatalystType.TARIFFS,
  CatalystType.OIL_SUPPLY_DISRUPTION,
  CatalystType.BANKING_STRESS,
  CatalystType.SYSTEMIC_RISK,
];

/** Catalysts that describe a sector-wide theme. */
export const SECTOR_CATALYSTS: readonly CatalystType[] = [
  CatalystType.SEMICONDUCTORS,
  CatalystType.AI,
  CatalystType.ENERGY,
  CatalystType.CREDIT,
];
