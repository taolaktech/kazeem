import type { OptionContract } from './interfaces/option-contract.interface.js';
import type { OptionChainQuery } from './interfaces/option-data-provider.interface.js';

/**
 * Applies the caller's filters to normalized contracts. Provider queries push
 * most of this down to Massive, but the filters are re-applied locally so the
 * result is identical regardless of what the provider honoured.
 */
export function filterContracts(
  contracts: OptionContract[],
  query: OptionChainQuery,
  underlyingPrice: number,
): OptionContract[] {
  return contracts.filter((contract) => {
    if (
      query.contractType !== undefined &&
      query.contractType !== 'ALL' &&
      contract.contractType !== query.contractType
    ) {
      return false;
    }
    if (
      query.expirationDate !== undefined &&
      contract.expirationDate.toISOString().slice(0, 10) !==
        query.expirationDate
    ) {
      return false;
    }
    if (
      query.minDaysToExpiration !== undefined &&
      contract.daysToExpiration < query.minDaysToExpiration
    ) {
      return false;
    }
    if (
      query.maxDaysToExpiration !== undefined &&
      contract.daysToExpiration > query.maxDaysToExpiration
    ) {
      return false;
    }
    if (
      query.strikeRange !== undefined &&
      Math.abs(contract.strikePrice - underlyingPrice) > query.strikeRange
    ) {
      return false;
    }
    if (query.minVolume !== undefined && contract.volume < query.minVolume) {
      return false;
    }
    if (
      query.minOpenInterest !== undefined &&
      contract.openInterest < query.minOpenInterest
    ) {
      return false;
    }
    if (query.maxSpreadPercent !== undefined) {
      if (
        contract.bidAskSpreadPercent === null ||
        contract.bidAskSpreadPercent > query.maxSpreadPercent
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Orders contracts by data quality and liquidity only — this is not a trading
 * recommendation. Priority: a two-sided quote, then a tighter relative spread,
 * then volume, then open interest, then proximity to the underlying price.
 */
export function rankByLiquidity(
  contracts: OptionContract[],
  underlyingPrice: number,
): OptionContract[] {
  return [...contracts].sort((a, b) => {
    const quoted = Number(hasTwoSidedQuote(b)) - Number(hasTwoSidedQuote(a));
    if (quoted !== 0) {
      return quoted;
    }

    const spread = spreadRank(a) - spreadRank(b);
    if (spread !== 0) {
      return spread;
    }

    if (a.volume !== b.volume) {
      return b.volume - a.volume;
    }
    if (a.openInterest !== b.openInterest) {
      return b.openInterest - a.openInterest;
    }

    const distance =
      Math.abs(a.strikePrice - underlyingPrice) -
      Math.abs(b.strikePrice - underlyingPrice);
    if (distance !== 0) {
      return distance;
    }

    return a.symbol.localeCompare(b.symbol);
  });
}

function hasTwoSidedQuote(contract: OptionContract): boolean {
  return (
    contract.bid !== null &&
    contract.ask !== null &&
    contract.bid > 0 &&
    contract.ask > 0
  );
}

function spreadRank(contract: OptionContract): number {
  return contract.bidAskSpreadPercent ?? Number.POSITIVE_INFINITY;
}
