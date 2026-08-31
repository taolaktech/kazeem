import { describe, expect, it } from 'vitest';
import {
  candleAt,
  easternInstant,
} from '../../test/factories/session-candles.js';
import type { MarketCandle } from '../market-data/interfaces/market-candle.interface.js';
import { partitionSessionCandles } from '../market-data/session/session-partition.js';
import { MarketRiskBias } from '../news-intelligence/enums/market-risk-bias.enum.js';
import { NewsImpact } from '../news-intelligence/enums/news-impact.enum.js';
import { NewsSentiment } from '../news-intelligence/enums/news-sentiment.enum.js';
import { OptionSelectionStatus } from '../option-selection/enums/option-selection-status.enum.js';
import { MarketRegime } from '../regime/enums/market-regime.enum.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import { buildRegime } from '../signal/testing/regime-factory.js';
import { VolatilityRelationship } from '../volatility-intelligence/enums/volatility.enum.js';
import { CONFLICT_PENALTIES } from './constants/trade-decision-weights.js';
import {
  ConflictSeverity,
  TradeDecision,
  TradeDirection,
} from './enums/trade-decision.enum.js';
import {
  bearishSessionFeatures,
  buildBearishInput,
  buildDecisionInput,
  buildNews,
  buildSelection,
  buildSignal,
  buildSnapshot,
  buildVolatility,
} from './testing/decision-factory.js';
import { decide } from './trade-decision.engine.js';

const TIMEFRAME = 3;
const MAX_WINDOW = 80;
const SESSION_OPEN_TIME = easternInstant(2026, 8, 28, 9, 30);
const AFTER_CLOSE = easternInstant(2026, 8, 28, 16, 0);

interface WindowShape {
  /** Open of the first candle inside the trailing 80-candle window. */
  windowOpen: number;
  /** Close of the final candle, i.e. the current price. */
  lastClose: number;
}

/**
 * A 130-candle regular session whose trailing 80-candle window deliberately
 * disagrees with the day: the 724.125 high and the 719.74 open both fall
 * outside the window.
 */
function fullSession({ windowOpen, lastClose }: WindowShape): MarketCandle[] {
  const candles: MarketCandle[] = [];
  const at = (index: number) =>
    new Date(SESSION_OPEN_TIME.getTime() + index * TIMEFRAME * 60_000);

  for (let index = 0; index < 130; index += 1) {
    const inWindow = index >= 130 - MAX_WINDOW;
    if (index === 0) {
      candles.push(
        candleAt(at(index), {
          open: 719.74,
          close: 720,
          high: 720.2,
          low: 719.5,
        }),
      );
    } else if (index === 20) {
      candles.push(
        candleAt(at(index), {
          open: 720,
          close: 722,
          high: 724.125,
          low: 719.9,
        }),
      );
    } else if (index === 130 - MAX_WINDOW) {
      candles.push(
        candleAt(at(index), {
          open: windowOpen,
          close: windowOpen,
          high: windowOpen + 0.07,
          low: windowOpen - 0.4,
        }),
      );
    } else if (index === 100) {
      candles.push(
        candleAt(at(index), {
          open: 718.5,
          close: 718.7,
          high: 718.82,
          low: 718.3,
        }),
      );
    } else if (index === 120) {
      candles.push(
        candleAt(at(index), {
          open: 715.5,
          close: 715.6,
          high: 715.7,
          low: 715.085,
        }),
      );
    } else if (index === 129) {
      candles.push(
        candleAt(at(index), {
          open: lastClose + 0.16,
          close: lastClose,
          high: lastClose + 0.26,
          low: lastClose - 0.14,
        }),
      );
    } else if (inWindow) {
      candles.push(
        candleAt(at(index), {
          open: 717.5,
          close: 717.6,
          high: 717.8,
          low: 717.2,
        }),
      );
    } else {
      candles.push(
        candleAt(at(index), {
          open: 718.5,
          close: 718.6,
          high: 718.7,
          low: 718.4,
        }),
      );
    }
  }
  return candles;
}

function snapshotOf(shape: WindowShape) {
  return partitionSessionCandles(fullSession(shape), {
    symbol: 'QQQ',
    now: AFTER_CLOSE,
    timeframeMinutes: TIMEFRAME,
    maxIndicatorCandles: MAX_WINDOW,
    openingSettlementMinutes: 15,
  });
}

const SNAPSHOT = snapshotOf({ windowOpen: 717.93, lastClose: 716.44 });
const CONTEXT = decide(
  buildDecisionInput({
    snapshot: SNAPSHOT,
    regime: buildRegime({ features: { currentPrice: 716.44 } }),
  }),
).marketContext;

describe('decision market context scopes', () => {
  it('1. reports the true 09:30 session open, not the analysis-window open', () => {
    expect(SNAPSHOT.currentSessionFeatures.open).toBe(717.93);
    expect(CONTEXT.sessionOpen).toBe(719.74);
    expect(CONTEXT.currentPrice).toBe(716.44);
  });

  it('2. reports the true session high and low', () => {
    expect(SNAPSHOT.currentSessionFeatures.high).toBe(718.82);
    expect(CONTEXT.sessionHigh).toBe(724.125);
    expect(CONTEXT.sessionLow).toBe(715.085);
  });

  it('3. keeps the rolling analysis window separately accessible', () => {
    expect(CONTEXT.analysisWindow).toEqual({
      timeframeMinutes: 3,
      candleCount: 80,
      open: 717.93,
      high: 718.82,
      low: 715.085,
      close: 716.44,
      positionInRange: SNAPSHOT.currentSessionFeatures.positionInRange,
    });
    expect(CONTEXT.analysisWindow.open).not.toBe(CONTEXT.sessionOpen);
    expect(CONTEXT.analysisWindow.high).not.toBe(CONTEXT.sessionHigh);
  });

  it('4. separates the capped analytical count from the full-session count', () => {
    expect(CONTEXT.currentSessionCandleCount).toBe(80);
    expect(CONTEXT.totalSessionCandleCount).toBe(130);
  });

  it('5. positions price inside the true session range, not the window range', () => {
    // 716.44 sits high in the 715.085–718.82 window but low in the day's range.
    expect(SNAPSHOT.currentSessionFeatures.positionInRange).toBeGreaterThan(
      0.3,
    );
    expect(CONTEXT.sessionPositionInRange).toBeLessThan(0.2);
  });

  it('6. caps every analytical array at 80 candles for a 130-candle session', () => {
    expect(SNAPSHOT.currentSessionCandles.length).toBeLessThanOrEqual(80);
    expect(SNAPSHOT.indicatorCandles.length).toBeLessThanOrEqual(80);
    expect(SNAPSHOT.currentSessionFeatures.candleCount).toBeLessThanOrEqual(80);
  });

  it('7. keeps the opening range intact after the window has moved past it', () => {
    expect(SNAPSHOT.openingRange.available).toBe(true);
    expect(SNAPSHOT.openingRange.open).toBe(719.74);
    expect(SNAPSHOT.openingRange.candleCount).toBe(5);
    expect(SNAPSHOT.openingRange.high).toBe(720.2);
  });
});

describe('session structure rules use true session levels', () => {
  /** Price above the window open but still below the day's open. */
  const belowSessionOpen = snapshotOf({ windowOpen: 715.2, lastClose: 717 });

  it('8. treats price under the true session open as below the session open', () => {
    const features = belowSessionOpen.currentSessionFeatures;
    expect(features.close).toBeGreaterThan(features.open ?? 0);
    expect(features.close).toBeLessThan(features.sessionOpen ?? 0);
    expect(features.aboveSessionOpen).toBe(false);

    const result = decide(
      buildBearishInput({
        snapshot: belowSessionOpen,
        regime: buildRegime({
          primaryRegime: MarketRegime.TRENDING_BEARISH,
          secondaryCharacteristics: {
            trendDirection: 'BEARISH',
            trendStrength: 'STRONG',
          },
          features: { currentPrice: 717 },
        }),
      }),
    );
    expect(result.componentScores.regimeAndStructure.confirmations).toContain(
      'Price holds below the session open',
    );
  });

  it('9. never labels analytical-window drift as session evidence', () => {
    const labels =
      decide(buildDecisionInput()).componentScores.regimeAndStructure
        .confirmations;
    expect(labels).toContain('Analytical window is printing higher highs');
    expect(labels).not.toContain('Session is printing higher highs');
  });
});

describe('conflict penalties', () => {
  it('10. leaves a clean, aligned setup unpenalized', () => {
    const result = decide(buildDecisionInput());
    expect(result.conflictPenalty).toBe(0);
    expect(result.conflicts.every((item) => !item.penalized)).toBe(true);
  });

  it('11. penalizes a genuine cross-component contradiction once', () => {
    // Bullish signal and CALL contract, bearish regime pointing the other way.
    const result = decide(
      buildDecisionInput({
        regime: buildRegime({
          primaryRegime: MarketRegime.TRENDING_BEARISH,
          confidence: 0.9,
          secondaryCharacteristics: {
            trendDirection: 'BEARISH',
            trendStrength: 'STRONG',
          },
          features: { currentPrice: 655, adx: 30, plusDI: 14, minusDI: 30 },
        }),
      }),
    );
    const opposed = result.conflicts.find(
      (item) => item.code === 'REGIME_OPPOSED',
    );
    expect(opposed?.penalized).toBe(true);
    expect(result.conflictPenalty).toBe(
      CONFLICT_PENALTIES[ConflictSeverity.MAJOR],
    );
    expect(result.normalizedDecisionScore).toBeLessThan(
      result.preConflictScore,
    );
  });

  it('12. does not deduct twice for a range-bound regime', () => {
    const result = decide(
      buildDecisionInput({
        regime: buildRegime({
          primaryRegime: MarketRegime.RANGE_BOUND,
          confidence: 0.7,
          secondaryCharacteristics: {
            trendDirection: 'NEUTRAL',
            trendStrength: 'WEAK',
          },
          features: { currentPrice: 655, adx: 14 },
        }),
      }),
    );
    const rangeBound = result.conflicts.find(
      (item) => item.code === 'REGIME_RANGE_BOUND',
    );
    expect(rangeBound?.penalized).toBe(false);
    expect(result.conflictPenalty).toBe(0);
    expect(result.componentScores.regimeAndStructure.earned).toBeLessThan(
      decide(buildDecisionInput()).componentScores.regimeAndStructure.earned ??
        0,
    );
  });

  it('13. blocks the trade on a missing contract without a second deduction', () => {
    const result = decide(
      buildDecisionInput({
        optionSelection: buildSelection({
          status: OptionSelectionStatus.NO_SELECTION,
        }),
      }),
    );
    const blocker = result.conflicts.find(
      (item) => item.code === 'NO_CONTRACT_SELECTED',
    );
    expect(blocker?.severity).toBe(ConflictSeverity.CRITICAL);
    expect(blocker?.penalized).toBe(false);
    expect(result.componentScores.optionQuality.earned).toBe(0);
    expect(result.conflictPenalty).toBe(0);
    expect(result.decision).toBe(TradeDecision.NO_TRADE);
  });

  it('14. keeps a strong score while a hard blocker forces NO_TRADE', () => {
    const result = decide(
      buildDecisionInput({
        optionSelection: buildSelection({
          status: OptionSelectionStatus.NO_SELECTION,
        }),
      }),
    );
    expect(result.normalizedDecisionScore).toBeGreaterThan(60);
    expect(result.hardBlockers.length).toBeGreaterThan(0);
    expect(result.decision).toBe(TradeDecision.NO_TRADE);
  });

  it('15. never marks a zero-penalty severity as penalized', () => {
    const inputs = [
      buildDecisionInput(),
      buildBearishInput(),
      buildDecisionInput({
        snapshot: buildSnapshot({
          currentSessionFeatures: bearishSessionFeatures(),
        }),
      }),
    ];
    for (const input of inputs) {
      for (const item of decide(input).conflicts) {
        if (CONFLICT_PENALTIES[item.severity] === 0) {
          expect(item.penalized).toBe(false);
        }
      }
    }
  });
});

describe('unavailable optional intelligence', () => {
  it('16. drops VIX from the denominator instead of scoring it zero', () => {
    const result = decide(buildDecisionInput({ volatility: null }));
    expect(result.componentScores.volatility.available).toBe(0);
    expect(result.componentScores.volatility.earned).toBeNull();
    expect(result.componentScores.volatility.reason).toBe('VIX_UNAVAILABLE');
    expect(result.availableWeight).toBe(95);
  });
});

describe('news confidence weighting', () => {
  function putWithRiskOff(riskBiasConfidence: number) {
    return decide(
      buildBearishInput({
        news: buildNews({
          sentiment: NewsSentiment.NEUTRAL,
          sentimentConfidence: 0,
          riskBias: MarketRiskBias.RISK_OFF,
          riskBiasConfidence,
          impact: NewsImpact.HIGH,
        }),
      }),
    );
  }

  it('17. gives a confident RISK_OFF read more PUT support than a weak one', () => {
    const weak = putWithRiskOff(0.35);
    const strong = putWithRiskOff(0.9);
    expect(strong.componentScores.news.earned).toBeGreaterThan(
      weak.componentScores.news.earned ?? 0,
    );
    expect(weak.componentScores.news.riskFlags.join(' ')).toContain(
      'low confidence',
    );
  });

  it('18. keeps a weak RISK_OFF read above a neutral one but well below full marks', () => {
    const weak = putWithRiskOff(0.35).componentScores.news.earned ?? 0;
    const neutral =
      decide(buildBearishInput({ news: buildNews() })).componentScores.news
        .earned ?? 0;
    expect(weak).toBeGreaterThan(neutral);
    expect(weak).toBeLessThan(4);
  });

  it('19. keeps directional sentiment and market risk bias separate', () => {
    const result = decide(
      buildBearishInput({
        news: buildNews({
          sentiment: NewsSentiment.NEUTRAL,
          sentimentConfidence: 0,
          riskBias: MarketRiskBias.RISK_OFF,
          riskBiasConfidence: 0.9,
          impact: NewsImpact.HIGH,
        }),
      }),
    );
    expect(result.news.sentiment).toBe(NewsSentiment.NEUTRAL);
    expect(result.news.marketRiskBias).toBe(MarketRiskBias.RISK_OFF);
    expect(result.componentScores.news.earned).toBeGreaterThan(0);
  });
});

describe('score ordering', () => {
  it('20. applies conflicts after normalization and blockers after grading', () => {
    const result = decide(
      buildDecisionInput({
        volatility: buildVolatility({
          relationship: VolatilityRelationship.CONTRADICTING_BULLISH,
        }),
        signal: buildSignal({ signal: MarketSignal.BULLISH }),
        optionSelection: buildSelection({
          status: OptionSelectionStatus.NO_SELECTION,
        }),
      }),
    );
    expect(result.preConflictScore).toBe(
      Math.round(
        ((result.rawEarnedScore / result.availableWeight) * 100 +
          Number.EPSILON) *
          100,
      ) / 100,
    );
    expect(result.normalizedDecisionScore).toBe(
      Math.round((result.preConflictScore - result.conflictPenalty) * 100) /
        100,
    );
    expect(result.direction).toBe(TradeDirection.CALL);
    expect(result.decision).toBe(TradeDecision.NO_TRADE);
  });
});
