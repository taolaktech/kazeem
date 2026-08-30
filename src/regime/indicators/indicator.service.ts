import { Injectable } from '@nestjs/common';
import { ADX, ATR, BollingerBands, EMA, RSI, SMA } from 'technicalindicators';
import {
  ADX_PERIOD,
  ATR_PERIOD,
  BOLLINGER_EXPANSION_WINDOW,
  BOLLINGER_PERIOD,
  BOLLINGER_STD_DEV,
  EMA_FAST_PERIOD,
  EMA_MEDIUM_PERIOD,
  EMA_SLOW_PERIOD,
  MOMENTUM_LOOKBACK,
  RELATIVE_VOLUME_PERIOD,
  RSI_PERIOD,
  VOLATILITY_HISTORY_WINDOW,
} from '../regime.constants.js';
import type { EmaAlignment } from '../enums/market-regime.enum.js';
import type {
  IndicatorSnapshot,
  RegimeFeatures,
} from '../interfaces/indicator-features.interface.js';
import type { NormalizedCandle } from '../interfaces/market-data.interface.js';

/** Computes the indicator set the regime scoring rules operate on. */
@Injectable()
export class IndicatorService {
  computeSnapshot(candles: NormalizedCandle[]): IndicatorSnapshot {
    const close = candles.map((candle) => candle.close);
    const high = candles.map((candle) => candle.high);
    const low = candles.map((candle) => candle.low);
    const volume = candles.map((candle) => candle.volume);
    const currentPrice = close[close.length - 1];
    const warnings: string[] = [];

    const ema9 = last(
      EMA.calculate({ period: EMA_FAST_PERIOD, values: close }),
    );
    const ema21 = last(
      EMA.calculate({ period: EMA_MEDIUM_PERIOD, values: close }),
    );
    const ema50 = last(
      EMA.calculate({ period: EMA_SLOW_PERIOD, values: close }),
    );
    const rsi = last(RSI.calculate({ period: RSI_PERIOD, values: close }));

    const adxSeries = ADX.calculate({
      period: ADX_PERIOD,
      close,
      high,
      low,
    });
    const adxPoint = adxSeries[adxSeries.length - 1] as
      { adx: number; pdi: number; mdi: number } | undefined;

    const atrSeries = ATR.calculate({
      period: ATR_PERIOD,
      close,
      high,
      low,
    }).filter(isFiniteNumber);
    const atr = last(atrSeries);
    const atrPercentSeries = toAtrPercentSeries(atrSeries, close);
    const atrPercent = last(atrPercentSeries);

    const bollingerSeries = BollingerBands.calculate({
      period: BOLLINGER_PERIOD,
      stdDev: BOLLINGER_STD_DEV,
      values: close,
    });
    const bollingerWidthSeries = bollingerSeries
      .map((band) => (band.upper - band.lower) / band.middle)
      .filter(isFiniteNumber);
    const bollingerWidth = last(bollingerWidthSeries);

    const relativeVolume = this.computeRelativeVolume(volume, warnings);

    const features: RegimeFeatures = {
      currentPrice,
      ema9,
      ema21,
      ema50,
      adx: adxPoint?.adx,
      plusDI: adxPoint?.pdi,
      minusDI: adxPoint?.mdi,
      rsi,
      atr,
      atrPercent,
      bollingerWidth,
      relativeVolume,
    };

    return {
      features,
      emaAlignment: resolveEmaAlignment(currentPrice, ema9, ema21, ema50),
      momentum: computeMomentum(close),
      distanceFromEma21:
        ema21 === undefined || ema21 === 0
          ? undefined
          : (currentPrice - ema21) / ema21,
      atrPercentRank: percentileRank(atrPercentSeries),
      bollingerWidthRank: percentileRank(bollingerWidthSeries),
      bollingerWidthExpansion: expansionRatio(bollingerWidthSeries),
      warnings,
    };
  }

  private computeRelativeVolume(
    volume: number[],
    warnings: string[],
  ): number | undefined {
    if (volume.length < RELATIVE_VOLUME_PERIOD) {
      return undefined;
    }
    const averageVolume = last(
      SMA.calculate({ period: RELATIVE_VOLUME_PERIOD, values: volume }),
    );
    if (averageVolume === undefined || averageVolume <= 0) {
      warnings.push(
        'Average volume over the last 20 periods is zero; relative volume is unavailable.',
      );
      return undefined;
    }
    return volume[volume.length - 1] / averageVolume;
  }
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function last(values: number[]): number | undefined {
  const value = values[values.length - 1];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

/** ATR expressed as a percentage of price, so it is comparable across symbols. */
function toAtrPercentSeries(atrSeries: number[], close: number[]): number[] {
  const offset = close.length - atrSeries.length;
  return atrSeries
    .map((value, index) => {
      const price = close[offset + index];
      return price > 0 ? (value / price) * 100 : Number.NaN;
    })
    .filter(isFiniteNumber);
}

function computeMomentum(close: number[]): number {
  const reference = close[close.length - 1 - MOMENTUM_LOOKBACK];
  if (reference === undefined || reference === 0) {
    return 0;
  }
  return (close[close.length - 1] - reference) / reference;
}

function resolveEmaAlignment(
  price: number,
  ema9?: number,
  ema21?: number,
  ema50?: number,
): EmaAlignment {
  if (ema9 === undefined || ema21 === undefined || ema50 === undefined) {
    return 'MIXED';
  }
  if (price > ema9 && ema9 > ema21 && ema21 > ema50) {
    return 'BULLISH';
  }
  if (price < ema9 && ema9 < ema21 && ema21 < ema50) {
    return 'BEARISH';
  }
  return 'MIXED';
}

/**
 * Fraction of the recent history the latest value sits above, in [0, 1].
 * Ranking against the symbol's own history avoids one universal threshold.
 */
function percentileRank(series: number[]): number | undefined {
  if (series.length < 2) {
    return undefined;
  }
  const window = series.slice(-VOLATILITY_HISTORY_WINDOW);
  const current = window[window.length - 1];
  const history = window.slice(0, -1);
  const belowOrEqual = history.filter((value) => value <= current).length;
  return belowOrEqual / history.length;
}

function expansionRatio(series: number[]): number | undefined {
  if (series.length < BOLLINGER_EXPANSION_WINDOW + 1) {
    return undefined;
  }
  const current = series[series.length - 1];
  const previous = series.slice(-(BOLLINGER_EXPANSION_WINDOW + 1), -1);
  const average =
    previous.reduce((sum, value) => sum + value, 0) / previous.length;
  return average > 0 ? current / average : undefined;
}
