import type { OptionContract } from '../options-data/interfaces/option-contract.interface.js';
import {
  ATM_TOLERANCE_PERCENT,
  COMPLETENESS_FIELDS,
  DELTA_BAND,
  DELTA_FALLOFF,
  DTE_BAND_SCORES,
  IV_BAND,
  IV_ELEVATED,
  IV_ELEVATED_SCORE,
  IV_UNKNOWN_SCORE,
  LOW_OPEN_INTEREST_FLAG,
  LOW_VOLUME_FLAG,
  OPEN_INTEREST_SATURATION,
  SCORE_WEIGHTS,
  SELECTION_FILTERS,
  SPREAD_MAX_PERCENT,
  SPREAD_TIGHT_PERCENT,
  VOLUME_SATURATION,
} from './constants/option-selection-thresholds.js';
import type { Moneyness } from './enums/option-selection-status.enum.js';
import type {
  OptionCandidate,
  OptionScoreBreakdown,
} from './interfaces/option-candidate-score.interface.js';
import {
  isWithinBudget,
  resolvePremium,
  type PremiumPriceSource,
} from './premium-pricing.js';

/** Scores one contract against the underlying price. Never mutates its input. */
export function scoreCandidate(
  contract: OptionContract,
  underlyingPrice: number,
  maxBudget: number,
): OptionCandidate {
  const strikeDistancePercent =
    Math.abs(contract.strikePrice - underlyingPrice) / underlyingPrice;
  const quoteAvailable = hasTwoSidedQuote(contract);
  const dataCompleteness = completenessOf(contract);
  const pricing = resolvePremium(contract);
  const spreadPercent = quoteAvailable ? contract.bidAskSpreadPercent : null;

  const breakdown: OptionScoreBreakdown = {
    delta: SCORE_WEIGHTS.delta * deltaScore(contract.delta),
    strikeProximity:
      SCORE_WEIGHTS.strikeProximity * proximityScore(strikeDistancePercent),
    dte: SCORE_WEIGHTS.dte * dteScore(contract.daysToExpiration),
    volume:
      SCORE_WEIGHTS.volume * saturating(contract.volume, VOLUME_SATURATION),
    openInterest:
      SCORE_WEIGHTS.openInterest *
      saturating(contract.openInterest, OPEN_INTEREST_SATURATION),
    iv: SCORE_WEIGHTS.iv * ivScore(contract.impliedVolatility),
    spread: SCORE_WEIGHTS.spread * spreadScore(spreadPercent),
    dataQuality: SCORE_WEIGHTS.dataQuality * dataCompleteness,
  };

  return {
    symbol: contract.symbol,
    contractType: contract.contractType,
    strikePrice: contract.strikePrice,
    expirationDate: contract.expirationDate,
    daysToExpiration: contract.daysToExpiration,
    moneyness: moneynessOf(contract, underlyingPrice),
    strikeDistancePercent: round(strikeDistancePercent, 4),
    bid: contract.bid,
    ask: contract.ask,
    lastPrice: contract.lastPrice,
    volume: contract.volume,
    openInterest: contract.openInterest,
    impliedVolatility: contract.impliedVolatility,
    delta: contract.delta,
    gamma: contract.gamma,
    theta: contract.theta,
    vega: contract.vega,
    premiumPriceUsed: pricing.premiumPriceUsed,
    premiumPriceSource: pricing.premiumPriceSource,
    estimatedContractCost: pricing.estimatedContractCost,
    withinBudget: isWithinBudget(pricing, maxBudget),
    score: round(sum(breakdown), 2),
    scoreBreakdown: roundBreakdown(breakdown),
    quoteAvailable,
    dataCompleteness: round(dataCompleteness, 2),
    riskFlags: candidateRiskFlags(
      contract,
      quoteAvailable,
      spreadPercent,
      pricing.premiumPriceSource,
    ),
  };
}

export function moneynessOf(
  contract: OptionContract,
  underlyingPrice: number,
): Moneyness {
  const distancePercent =
    Math.abs(contract.strikePrice - underlyingPrice) / underlyingPrice;
  if (distancePercent <= ATM_TOLERANCE_PERCENT) {
    return 'ATM';
  }
  const strikeBelow = contract.strikePrice < underlyingPrice;
  if (contract.contractType === 'CALL') {
    return strikeBelow ? 'ITM' : 'OTM';
  }
  return strikeBelow ? 'OTM' : 'ITM';
}

export function hasTwoSidedQuote(contract: OptionContract): boolean {
  return (
    contract.bid !== null &&
    contract.ask !== null &&
    contract.bid > 0 &&
    contract.ask >= contract.bid
  );
}

/** Fraction of the tracked provider fields that carry a usable value. */
export function completenessOf(contract: OptionContract): number {
  const present = COMPLETENESS_FIELDS.filter(
    (field) => contract[field] !== null,
  ).length;
  return present / COMPLETENESS_FIELDS.length;
}

/**
 * Full marks inside the preferred |delta| band, decaying linearly outside it.
 * A deep-ITM contract therefore stays eligible without dominating the ranking.
 */
function deltaScore(delta: number | null): number {
  if (delta === null) {
    return 0;
  }
  const magnitude = Math.abs(delta);
  if (magnitude >= DELTA_BAND.min && magnitude <= DELTA_BAND.max) {
    return 1;
  }
  const distance =
    magnitude < DELTA_BAND.min
      ? DELTA_BAND.min - magnitude
      : magnitude - DELTA_BAND.max;
  return clamp(1 - distance / DELTA_FALLOFF);
}

function proximityScore(strikeDistancePercent: number): number {
  return clamp(
    1 - strikeDistancePercent / SELECTION_FILTERS.maxStrikeDistancePercent,
  );
}

function dteScore(daysToExpiration: number): number {
  if (daysToExpiration <= 0) {
    return DTE_BAND_SCORES.zero;
  }
  if (daysToExpiration <= 2) {
    return DTE_BAND_SCORES.oneToTwo;
  }
  if (daysToExpiration <= 7) {
    return DTE_BAND_SCORES.threeToSeven;
  }
  return DTE_BAND_SCORES.beyond;
}

/** Logarithmic so a hugely traded contract cannot outweigh every other factor. */
function saturating(value: number, saturation: number): number {
  if (value <= 0) {
    return 0;
  }
  return clamp(Math.log10(1 + value) / Math.log10(1 + saturation));
}

function ivScore(impliedVolatility: number | null): number {
  if (impliedVolatility === null) {
    return IV_UNKNOWN_SCORE;
  }
  if (impliedVolatility >= IV_ELEVATED) {
    return IV_ELEVATED_SCORE;
  }
  if (impliedVolatility >= IV_BAND.min && impliedVolatility <= IV_BAND.max) {
    return 1;
  }
  return 0.7;
}

function spreadScore(spreadPercent: number | null): number {
  if (spreadPercent === null) {
    return 0;
  }
  if (spreadPercent <= SPREAD_TIGHT_PERCENT) {
    return 1;
  }
  if (spreadPercent >= SPREAD_MAX_PERCENT) {
    return 0;
  }
  return (
    (SPREAD_MAX_PERCENT - spreadPercent) /
    (SPREAD_MAX_PERCENT - SPREAD_TIGHT_PERCENT)
  );
}

function candidateRiskFlags(
  contract: OptionContract,
  quoteAvailable: boolean,
  spreadPercent: number | null,
  premiumPriceSource: PremiumPriceSource,
): string[] {
  const flags: string[] = [];
  if (premiumPriceSource === 'LAST_PRICE') {
    flags.push(
      'Budget eligibility estimated from last trade price; current ask unavailable.',
    );
  }
  if (contract.daysToExpiration <= 0) {
    flags.push('0DTE contract with elevated theta and gamma risk');
  }
  if (!quoteAvailable) {
    flags.push('Real-time bid/ask quote unavailable');
  } else if (spreadPercent !== null && spreadPercent > SPREAD_MAX_PERCENT) {
    flags.push(`Wide bid/ask spread (${round(spreadPercent, 2)}%)`);
  }
  if (
    contract.impliedVolatility !== null &&
    contract.impliedVolatility >= IV_ELEVATED
  ) {
    flags.push('Implied volatility is elevated; premium is expensive');
  }
  if (contract.impliedVolatility === null) {
    flags.push('Implied volatility unavailable');
  }
  if (contract.delta === null) {
    flags.push('Greeks unavailable');
  }
  if (contract.volume < LOW_VOLUME_FLAG) {
    flags.push(`Thin volume (${contract.volume})`);
  }
  if (contract.openInterest < LOW_OPEN_INTEREST_FLAG) {
    flags.push(`Low open interest (${contract.openInterest})`);
  }
  return flags;
}

function sum(breakdown: OptionScoreBreakdown): number {
  return Object.values(breakdown).reduce((total, points) => total + points, 0);
}

function roundBreakdown(breakdown: OptionScoreBreakdown): OptionScoreBreakdown {
  return {
    delta: round(breakdown.delta, 2),
    strikeProximity: round(breakdown.strikeProximity, 2),
    dte: round(breakdown.dte, 2),
    volume: round(breakdown.volume, 2),
    openInterest: round(breakdown.openInterest, 2),
    iv: round(breakdown.iv, 2),
    spread: round(breakdown.spread, 2),
    dataQuality: round(breakdown.dataQuality, 2),
  };
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
