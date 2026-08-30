import type { OptionType } from '../enums/option-type.enum.js';

/**
 * Canonical, provider-agnostic option contract.
 *
 * Every field a provider does not supply is `null`; nothing is estimated or
 * back-filled locally. `impliedVolatility`, `delta`, `gamma`, `theta` and
 * `vega` are passed through untouched from the provider.
 */
export interface OptionContract {
  /** OCC contract symbol, e.g. `O:SPY260904C00650000`. */
  symbol: string;
  underlyingSymbol: string;
  contractType: OptionType;
  strikePrice: number;
  /** Expiration day at 00:00 UTC; options expire at the close of this date. */
  expirationDate: Date;
  /**
   * Whole calendar days between today and the expiration day, both taken in
   * US/Eastern (the exchange timezone). `0` means the contract expires today
   * (0DTE); the value is never negative for a tradable contract. This is a
   * calendar-day count, not a trading-day count: weekends and market holidays
   * are included.
   */
  daysToExpiration: number;
  bid: number | null;
  ask: number | null;
  lastPrice: number | null;
  /** `(bid + ask) / 2`, only when both sides of the quote are valid. */
  midpoint: number | null;
  /** `ask - bid`, only when both sides of the quote are valid. */
  bidAskSpread: number | null;
  /** `(spread / midpoint) * 100`, only when the midpoint is positive. */
  bidAskSpreadPercent: number | null;
  volume: number;
  openInterest: number;
  /** Decimal fraction as reported by the provider: `0.25` means 25%. */
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  underlyingPrice: number | null;
  /** Freshness of the quote/trade data backing this contract. */
  timestamp: Date;
}
