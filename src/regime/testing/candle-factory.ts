import type { MarketCandle } from '../interfaces/market-data.interface.js';

const CANDLE_INTERVAL_MS = 60_000;
const SERIES_START = Date.UTC(2026, 0, 5, 14, 30);

export interface CandleSpec {
  /** Close price for candle `index`. */
  close: (index: number) => number;
  /** High/low range as a fraction of the close price. */
  range?: (index: number) => number;
  volume?: (index: number) => number;
}

/** Builds a deterministic OHLCV series; no market data provider involved. */
export function buildCandles(count: number, spec: CandleSpec): MarketCandle[] {
  const range = spec.range ?? (() => 0.002);
  const volume = spec.volume ?? (() => 1_000_000);
  const candles: MarketCandle[] = [];

  for (let index = 0; index < count; index += 1) {
    const close = spec.close(index);
    const open = index === 0 ? close : spec.close(index - 1);
    const halfRange = (close * range(index)) / 2;
    candles.push({
      timestamp: new Date(SERIES_START + index * CANDLE_INTERVAL_MS),
      open,
      high: Math.max(open, close) + halfRange,
      low: Math.min(open, close) - halfRange,
      close,
      volume: volume(index),
    });
  }

  return candles;
}
