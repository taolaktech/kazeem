import { BadRequestException } from '@nestjs/common';
import type {
  MarketCandle,
  NormalizedCandle,
} from './interfaces/market-data.interface.js';

export interface ValidatedCandles {
  candles: NormalizedCandle[];
  warnings: string[];
}

/**
 * Turns caller-supplied candles into a chronologically sorted series of finite
 * OHLCV values, rejecting anything that would silently corrupt the indicators.
 */
export function validateCandles(candles: MarketCandle[]): ValidatedCandles {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new BadRequestException('At least one market candle is required.');
  }

  const warnings: string[] = [];
  const normalized = candles.map((candle, index) =>
    normalizeCandle(candle, index),
  );

  const sorted = [...normalized].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
  if (sorted.some((candle, index) => candle !== normalized[index])) {
    warnings.push('Candles were not chronologically ordered and were sorted.');
  }

  const duplicates = countDuplicateTimestamps(sorted);
  if (duplicates > 0) {
    warnings.push(`${duplicates} candle(s) share a duplicate timestamp.`);
  }

  const zeroVolume = sorted.filter((candle) => candle.volume === 0).length;
  if (zeroVolume > 0) {
    warnings.push(`${zeroVolume} candle(s) have zero volume.`);
  }

  return { candles: sorted, warnings };
}

function normalizeCandle(
  candle: MarketCandle,
  index: number,
): NormalizedCandle {
  const timestamp = new Date(candle.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw new BadRequestException(
      `Candle at index ${index} has an invalid timestamp.`,
    );
  }

  const open = requireFinite(candle.open, index, 'open');
  const high = requireFinite(candle.high, index, 'high');
  const low = requireFinite(candle.low, index, 'low');
  const close = requireFinite(candle.close, index, 'close');
  const volume = requireFinite(candle.volume, index, 'volume');

  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    throw new BadRequestException(
      `Candle at index ${index} has a non-positive price.`,
    );
  }
  if (volume < 0) {
    throw new BadRequestException(
      `Candle at index ${index} has a negative volume.`,
    );
  }
  if (high < low || high < Math.max(open, close) || low > Math.min(open, close))
    throw new BadRequestException(
      `Candle at index ${index} has inconsistent high/low values.`,
    );

  return { timestamp, open, high, low, close, volume };
}

function requireFinite(value: number, index: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(
      `Candle at index ${index} has a non-numeric ${field} value.`,
    );
  }
  return value;
}

function countDuplicateTimestamps(candles: NormalizedCandle[]): number {
  let duplicates = 0;
  for (let index = 1; index < candles.length; index += 1) {
    if (
      candles[index].timestamp.getTime() ===
      candles[index - 1].timestamp.getTime()
    ) {
      duplicates += 1;
    }
  }
  return duplicates;
}
