import { CatalystType } from '../enums/catalyst-type.enum.js';
import { BROAD_RISK_SEVERITY } from './news-intelligence-thresholds.js';

/**
 * Single source of truth for how much market breadth a catalyst can carry,
 * on a 0-1 scale. Severity is potential significance only: it says nothing
 * about direction, and it is always combined with relevance, recency and
 * scope before an article is called high impact.
 */
export const CATALYST_SEVERITY: Record<CatalystType, number> = {
  [CatalystType.SYSTEMIC_RISK]: 1,
  [CatalystType.MILITARY_CONFLICT]: 0.95,
  [CatalystType.FEDERAL_RESERVE]: 0.95,
  [CatalystType.CPI]: 0.9,
  [CatalystType.BANKING_STRESS]: 0.9,
  [CatalystType.OIL_SUPPLY_DISRUPTION]: 0.9,
  [CatalystType.JOBS]: 0.85,
  [CatalystType.INTEREST_RATES]: 0.85,
  [CatalystType.INFLATION]: 0.85,
  [CatalystType.GEOPOLITICAL]: 0.8,
  [CatalystType.PPI]: 0.75,
  [CatalystType.TREASURY_YIELDS]: 0.75,
  [CatalystType.TARIFFS]: 0.75,
  [CatalystType.CREDIT]: 0.75,
  [CatalystType.GDP]: 0.7,
  [CatalystType.MARKET_MOVING]: 0.7,
  [CatalystType.ENERGY]: 0.6,
  [CatalystType.SEMICONDUCTORS]: 0.55,
  [CatalystType.AI]: 0.5,
  [CatalystType.EARNINGS]: 0.6,
  [CatalystType.GUIDANCE]: 0.6,
  [CatalystType.REGULATORY]: 0.45,
  [CatalystType.MERGER_ACQUISITION]: 0.35,
  [CatalystType.ANALYST_DOWNGRADE]: 0.3,
  [CatalystType.ANALYST_UPGRADE]: 0.3,
  [CatalystType.LEGAL]: 0.25,
  [CatalystType.OTHER]: 0.1,
};

export function maxCatalystSeverity(
  catalysts: readonly CatalystType[],
): number {
  return catalysts.reduce(
    (highest, catalyst) => Math.max(highest, CATALYST_SEVERITY[catalyst]),
    0,
  );
}

/** Catalysts that can move an entire index on their own when relevant. */
export const BROAD_RISK_CATALYSTS: readonly CatalystType[] = Object.entries(
  CATALYST_SEVERITY,
)
  .filter(([, severity]) => severity >= BROAD_RISK_SEVERITY)
  .map(([catalyst]) => catalyst as CatalystType);

export function hasBroadRiskCatalyst(
  catalysts: readonly CatalystType[],
): boolean {
  return maxCatalystSeverity(catalysts) >= BROAD_RISK_SEVERITY;
}
