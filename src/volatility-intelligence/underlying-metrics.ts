import type { MarketSessionSnapshot } from '../market-data/session/session-context.interface.js';
import { candleCloseTime } from '../market-data/session/session-clock.js';
import type { UnderlyingMetrics } from './interfaces/volatility-intelligence-result.interface.js';
import { percentOf, windowChangePercent } from './series-metrics.js';

/**
 * Comparable features of the requested underlying, taken from the session
 * snapshot the regime already ran on. This is deliberately a handful of price
 * measurements, not a second regime engine.
 */
export function buildUnderlyingMetrics(
  snapshot: MarketSessionSnapshot,
  momentumLookbackCandles: number,
): UnderlyingMetrics {
  const { currentSessionCandles, indicatorCandles, currentSessionFeatures } =
    snapshot;
  const latest =
    currentSessionCandles[currentSessionCandles.length - 1] ??
    indicatorCandles[indicatorCandles.length - 1];

  if (latest === undefined) {
    return {
      symbol: snapshot.symbol,
      current: null,
      asOf: null,
      previousClose: snapshot.previousSession.previousClose,
      changePercent: null,
      sessionOpen: null,
      changePercentFromOpen: null,
      shortMomentumPercent: null,
      premarketHigh: snapshot.premarket.high,
      premarketLow: snapshot.premarket.low,
      premarketGapPercent: snapshot.premarket.gapPercentFromPreviousClose,
    };
  }

  const current = latest.close;
  const previousClose = snapshot.previousSession.previousClose;
  const momentumCandles =
    currentSessionCandles.length > momentumLookbackCandles
      ? currentSessionCandles
      : indicatorCandles;

  return {
    symbol: snapshot.symbol,
    current,
    asOf: candleCloseTime(latest, snapshot.context.timeframeMinutes),
    previousClose,
    changePercent:
      previousClose === null
        ? null
        : percentOf(current - previousClose, previousClose),
    sessionOpen: currentSessionFeatures.open,
    changePercentFromOpen: currentSessionFeatures.changeFromOpenPercent,
    shortMomentumPercent: windowChangePercent(
      momentumCandles,
      momentumLookbackCandles,
    ),
    premarketHigh: snapshot.premarket.high,
    premarketLow: snapshot.premarket.low,
    premarketGapPercent: snapshot.premarket.gapPercentFromPreviousClose,
  };
}
