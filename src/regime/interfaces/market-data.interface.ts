export interface MarketCandle {
  timestamp: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A candle that has passed validation: finite OHLCV values and a resolved timestamp. */
export interface NormalizedCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
