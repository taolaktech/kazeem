import type { OptionType } from '../enums/option-type.enum.js';
import { daysToExpiration, parseExpirationDate } from '../expiration.util.js';
import type { OptionContract } from '../interfaces/option-contract.interface.js';
import type { MassiveOptionSnapshot } from './massive-options.types.js';

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

export interface NormalizationResult {
  contract: OptionContract | null;
  warning: string | null;
}

/**
 * Converts one Massive snapshot into a canonical {@link OptionContract}.
 * Malformed contracts are rejected individually with a warning instead of
 * failing the whole chain.
 */
export function normalizeOptionSnapshot(
  snapshot: MassiveOptionSnapshot,
  underlyingSymbol: string,
  now: Date,
): NormalizationResult {
  const details = snapshot.details;
  const symbol = typeof details?.ticker === 'string' ? details.ticker : '';
  if (symbol.trim() === '') {
    return reject('contract without a ticker');
  }

  const contractType = toOptionType(details?.contract_type);
  if (contractType === null) {
    return reject(`${symbol}: unsupported contract type`);
  }

  const strikePrice = details?.strike_price;
  if (!isPositive(strikePrice)) {
    return reject(`${symbol}: invalid strike price`);
  }

  const expirationDate =
    typeof details?.expiration_date === 'string'
      ? parseExpirationDate(details.expiration_date)
      : null;
  if (expirationDate === null) {
    return reject(`${symbol}: invalid expiration date`);
  }

  const dte = daysToExpiration(expirationDate, now);
  if (dte < 0) {
    return reject(`${symbol}: already expired`);
  }

  const quote = toQuote(snapshot.last_quote?.bid, snapshot.last_quote?.ask);
  if (quote === null) {
    return reject(`${symbol}: inconsistent bid/ask quote`);
  }

  const volume = toCount(snapshot.day?.volume);
  if (volume === null) {
    return reject(`${symbol}: invalid volume`);
  }

  const openInterest = toCount(snapshot.open_interest);
  if (openInterest === null) {
    return reject(`${symbol}: invalid open interest`);
  }

  const midpoint =
    quote.bid !== null && quote.ask !== null
      ? (quote.bid + quote.ask) / 2
      : null;
  const bidAskSpread =
    quote.bid !== null && quote.ask !== null ? quote.ask - quote.bid : null;
  const bidAskSpreadPercent =
    bidAskSpread !== null && midpoint !== null && midpoint > 0
      ? (bidAskSpread / midpoint) * 100
      : null;

  const contract: OptionContract = {
    symbol,
    underlyingSymbol:
      typeof snapshot.underlying_asset?.ticker === 'string' &&
      snapshot.underlying_asset.ticker.trim() !== ''
        ? snapshot.underlying_asset.ticker.toUpperCase()
        : underlyingSymbol,
    contractType,
    strikePrice,
    expirationDate,
    daysToExpiration: dte,
    bid: quote.bid,
    ask: quote.ask,
    lastPrice: toPrice(snapshot.last_trade?.price),
    midpoint,
    bidAskSpread,
    bidAskSpreadPercent,
    volume,
    openInterest,
    impliedVolatility: toNonNegative(snapshot.implied_volatility),
    delta: toFinite(snapshot.greeks?.delta),
    gamma: toFinite(snapshot.greeks?.gamma),
    theta: toFinite(snapshot.greeks?.theta),
    vega: toFinite(snapshot.greeks?.vega),
    underlyingPrice: toPrice(snapshot.underlying_asset?.price),
    timestamp: toTimestamp(snapshot, now),
  };

  return { contract, warning: null };
}

function reject(warning: string): NormalizationResult {
  return { contract: null, warning };
}

function toOptionType(value: unknown): OptionType | null {
  if (value === 'call') {
    return 'CALL';
  }
  if (value === 'put') {
    return 'PUT';
  }
  return null;
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function toFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toNonNegative(value: unknown): number | null {
  const finite = toFinite(value);
  return finite !== null && finite >= 0 ? finite : null;
}

function toPrice(value: unknown): number | null {
  return toNonNegative(value);
}

/** Quotes are all-or-nothing: an ask below the bid invalidates the contract. */
function toQuote(
  bidValue: unknown,
  askValue: unknown,
): { bid: number | null; ask: number | null } | null {
  const bid = toNonNegative(bidValue);
  const ask = toNonNegative(askValue);
  if (bid !== null && ask !== null && ask < bid) {
    return null;
  }
  return { bid, ask };
}

function toCount(value: unknown): number | null {
  if (value === undefined) {
    return 0;
  }
  const finite = toFinite(value);
  if (finite === null || finite < 0) {
    return null;
  }
  return finite;
}

/** Massive reports timestamps in nanoseconds since the Unix epoch. */
function toTimestamp(snapshot: MassiveOptionSnapshot, now: Date): Date {
  const nanoseconds =
    toFinite(snapshot.last_quote?.last_updated) ??
    toFinite(snapshot.last_trade?.sip_timestamp) ??
    toFinite(snapshot.day?.last_updated) ??
    toFinite(snapshot.underlying_asset?.last_updated);
  if (nanoseconds === null || nanoseconds <= 0) {
    return now;
  }
  return new Date(nanoseconds / NANOSECONDS_PER_MILLISECOND);
}
