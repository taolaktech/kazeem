/** Canonical, provider-agnostic OHLCV candle used across the application. */
export interface MarketCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleTimespan = 'minute' | 'hour' | 'day';

export interface HistoricalCandlesOptions {
  multiplier: number;
  timespan: CandleTimespan;
  /** Inclusive start of the range, as YYYY-MM-DD or epoch milliseconds. */
  from: string;
  /** Inclusive end of the range, as YYYY-MM-DD or epoch milliseconds. */
  to: string;
}

/** Implemented by every market data provider adapter. */
export interface MarketDataProvider {
  getHistoricalCandles(
    symbol: string,
    options: HistoricalCandlesOptions,
  ): Promise<MarketCandle[]>;
}
