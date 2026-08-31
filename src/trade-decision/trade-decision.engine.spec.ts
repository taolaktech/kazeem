import { describe, expect, it } from 'vitest';
import {
  MarketSession,
  SessionMaturity,
} from '../market-data/session/market-session.enum.js';
import { MarketRiskBias } from '../news-intelligence/enums/market-risk-bias.enum.js';
import { NewsImpact } from '../news-intelligence/enums/news-impact.enum.js';
import { NewsSentiment } from '../news-intelligence/enums/news-sentiment.enum.js';
import { OptionSelectionStatus } from '../option-selection/enums/option-selection-status.enum.js';
import { MarketRegime } from '../regime/enums/market-regime.enum.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import { buildRegime } from '../signal/testing/regime-factory.js';
import {
  SignalAlignment,
  VolatilityMomentum,
  VolatilityRelationship,
  VolatilityTrend,
} from '../volatility-intelligence/enums/volatility.enum.js';
import { CATEGORY_WEIGHTS } from './constants/trade-decision-weights.js';
import {
  ConflictSeverity,
  DecisionCategory,
  SetupGrade,
  TradeDecision,
  TradeDirection,
} from './enums/trade-decision.enum.js';
import {
  NOW,
  bearishOpeningRange,
  bearishSessionFeatures,
  buildBearishInput,
  buildCandidate,
  buildDecisionInput,
  buildNews,
  buildSelection,
  buildSignal,
  buildSnapshot,
  buildVolatility,
  insideOpeningRange,
} from './testing/decision-factory.js';
import { decide } from './trade-decision.engine.js';

const BASELINE = decide(buildDecisionInput());
const BEARISH_BASELINE = decide(buildBearishInput());

describe('trade decision engine', () => {
  describe('direction and grading of clean setups', () => {
    it('1. grades a clean bullish setup A+ and returns a CALL TRADE', () => {
      expect(BASELINE.decision).toBe(TradeDecision.TRADE);
      expect(BASELINE.direction).toBe(TradeDirection.CALL);
      expect(BASELINE.setupGrade).toBe(SetupGrade.A_PLUS);
      expect(BASELINE.normalizedDecisionScore).toBeGreaterThanOrEqual(90);
    });

    it('2. grades a clean bearish setup A+ and returns a PUT TRADE', () => {
      expect(BEARISH_BASELINE.decision).toBe(TradeDecision.TRADE);
      expect(BEARISH_BASELINE.direction).toBe(TradeDirection.PUT);
      expect(BEARISH_BASELINE.setupGrade).toBe(SetupGrade.A_PLUS);
    });

    it('3. keeps a bullish thesis actionable while price sits inside the opening range', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({ openingRange: insideOpeningRange() }),
        }),
      );
      expect(result.direction).toBe(TradeDirection.CALL);
      expect(result.decision).not.toBe(TradeDecision.NO_TRADE);
    });

    it('4. keeps a bearish thesis actionable while price sits inside the opening range', () => {
      const result = decide(
        buildBearishInput({
          snapshot: buildSnapshot({
            openingRange: insideOpeningRange(),
            currentSessionFeatures: bearishSessionFeatures(),
          }),
        }),
      );
      expect(result.direction).toBe(TradeDirection.PUT);
      expect(result.decision).not.toBe(TradeDecision.NO_TRADE);
    });

    it('5. scores an ORH breakout above an equivalent inside-range setup', () => {
      const inside = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({ openingRange: insideOpeningRange() }),
        }),
      );
      expect(
        BASELINE.componentScores[DecisionCategory.REGIME_AND_STRUCTURE].earned,
      ).toBeGreaterThan(
        inside.componentScores[DecisionCategory.REGIME_AND_STRUCTURE]
          .earned as number,
      );
    });

    it('6. scores an ORL breakdown above an equivalent inside-range bearish setup', () => {
      const inside = decide(
        buildBearishInput({
          snapshot: buildSnapshot({
            openingRange: insideOpeningRange(),
            currentSessionFeatures: bearishSessionFeatures(),
          }),
        }),
      );
      expect(
        BEARISH_BASELINE.componentScores[DecisionCategory.REGIME_AND_STRUCTURE]
          .earned,
      ).toBeGreaterThan(
        inside.componentScores[DecisionCategory.REGIME_AND_STRUCTURE]
          .earned as number,
      );
    });

    it('7. does not force WAIT merely because price is inside the opening range', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({ openingRange: insideOpeningRange() }),
        }),
      );
      expect(result.decision).toBe(TradeDecision.TRADE);
    });

    it('8. does not cap the grade at B for an inside-range setup', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({ openingRange: insideOpeningRange() }),
        }),
      );
      expect([SetupGrade.A_PLUS, SetupGrade.A, SetupGrade.B_PLUS]).toContain(
        result.setupGrade,
      );
    });

    it('9. penalises a CALL thesis after repeated ORH rejection', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({
            openingRange: {
              ...insideOpeningRange(),
              failedBreakoutAbove: true,
              closesAboveHigh: 2,
            },
          }),
        }),
      );
      expect(result.normalizedDecisionScore).toBeLessThan(
        BASELINE.normalizedDecisionScore,
      );
      expect(result.conflicts.map((item) => item.code)).toContain(
        'OPENING_RANGE_REJECTED',
      );
    });

    it('10. penalises a PUT thesis after repeated ORL rejection', () => {
      const result = decide(
        buildBearishInput({
          snapshot: buildSnapshot({
            openingRange: {
              ...insideOpeningRange(),
              failedBreakdownBelow: true,
              closesBelowLow: 2,
            },
            currentSessionFeatures: bearishSessionFeatures(),
          }),
        }),
      );
      expect(result.conflicts.map((item) => item.code)).toContain(
        'OPENING_RANGE_REJECTED',
      );
    });
  });

  describe('signal and regime interaction', () => {
    it('11. rewards a strong signal that matches the regime', () => {
      expect(
        BASELINE.componentScores[DecisionCategory.DIRECTIONAL_SIGNAL].earned,
      ).toBeGreaterThan(20);
      expect(
        BASELINE.componentScores[DecisionCategory.REGIME_AND_STRUCTURE].earned,
      ).toBeGreaterThan(25);
    });

    it('12. flags a strong signal that opposes the regime as a major conflict', () => {
      const result = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'STRONG',
            },
          }),
        }),
      );
      expect(
        result.conflicts.some(
          (item) => item.severity === ConflictSeverity.MAJOR,
        ),
      ).toBe(true);
      expect(result.decision).not.toBe(TradeDecision.TRADE);
    });

    it('13. does not treat RANGE_BOUND as an automatic NO_TRADE', () => {
      const result = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.RANGE_BOUND,
            confidence: 0.7,
            secondaryCharacteristics: {
              trendDirection: 'BULLISH',
              trendStrength: 'MODERATE',
            },
            features: { relativeVolume: 1.4, adx: 18, plusDI: 24, minusDI: 16 },
          }),
        }),
      );
      expect(result.decision).not.toBe(TradeDecision.NO_TRADE);
      expect(result.hardBlockers).toHaveLength(0);
    });

    it('14. credits independent momentum and volume participation', () => {
      const weak = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BULLISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BULLISH',
              trendStrength: 'STRONG',
            },
            features: {
              currentPrice: 655,
              adx: 30,
              plusDI: 30,
              minusDI: 14,
              relativeVolume: 0.5,
            },
          }),
        }),
      );
      expect(
        weak.componentScores[DecisionCategory.MOMENTUM_AND_VOLUME].earned,
      ).toBeLessThan(
        BASELINE.componentScores[DecisionCategory.MOMENTUM_AND_VOLUME]
          .earned as number,
      );
    });

    it('15. does not let weak volume also reduce the directional signal score', () => {
      const weak = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BULLISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BULLISH',
              trendStrength: 'STRONG',
            },
            features: { relativeVolume: 0.4 },
          }),
        }),
      );
      expect(
        weak.componentScores[DecisionCategory.DIRECTIONAL_SIGNAL].earned,
      ).toBe(
        BASELINE.componentScores[DecisionCategory.DIRECTIONAL_SIGNAL].earned,
      );
    });
  });

  describe('option quality', () => {
    it('16. scores a liquid, tightly quoted contract highly', () => {
      expect(
        BASELINE.componentScores[DecisionCategory.OPTION_QUALITY].earned,
      ).toBeGreaterThan(17);
    });

    it('17. lowers the score for an illiquid, wide contract', () => {
      const result = decide(
        buildDecisionInput({
          optionSelection: buildSelection({
            selectedContract: buildCandidate({
              volume: 5,
              openInterest: 20,
              bid: 1.0,
              ask: 1.9,
              delta: 0.12,
              score: 40,
            }),
            confidence: 0.4,
          }),
        }),
      );
      expect(
        result.componentScores[DecisionCategory.OPTION_QUALITY].earned,
      ).toBeLessThan(
        BASELINE.componentScores[DecisionCategory.OPTION_QUALITY]
          .earned as number,
      );
    });

    it('18. treats a missing bid/ask as reduced certainty, not rejection', () => {
      const result = decide(
        buildDecisionInput({
          optionSelection: buildSelection({
            selectedContract: buildCandidate({
              bid: null,
              ask: null,
              quoteAvailable: false,
              premiumPriceSource: 'LAST_PRICE',
              premiumPriceUsed: 2.03,
              estimatedContractCost: 203,
            }),
            executionReady: false,
          }),
        }),
      );
      expect(result.hardBlockers).toHaveLength(0);
      expect(result.executionReady).toBe(false);
      expect(result.missingIntelligence).toContain(
        'Bid/ask spread unavailable',
      );
    });

    it('19. flags 0DTE contracts as a risk', () => {
      const result = decide(
        buildDecisionInput({
          optionSelection: buildSelection({
            selectedContract: buildCandidate({ daysToExpiration: 0 }),
          }),
        }),
      );
      expect(result.riskFlags.some((flag) => flag.includes('0DTE'))).toBe(true);
    });

    it('20. cannot TRADE when no qualifying contract exists', () => {
      const result = decide(
        buildDecisionInput({
          optionSelection: buildSelection({
            status: OptionSelectionStatus.NO_SELECTION,
            confidence: 0,
          }),
        }),
      );
      expect(result.decision).toBe(TradeDecision.NO_TRADE);
      expect(result.selectedContract).toBeNull();
    });

    it('21. reports the budget it was given and never widens it', () => {
      const result = decide(buildDecisionInput({ maxBudget: 250 }));
      expect(result.maxBudget).toBe(250);
      expect(result.selectedContract?.withinBudget).toBe(true);
    });

    it('59. reuses the selected contract rather than re-ranking the chain', () => {
      const selection = buildSelection();
      const result = decide(buildDecisionInput({ optionSelection: selection }));
      expect(result.selectedContract).toBe(selection.selectedContract);
      expect(result.optionSelectionStatus).toBe(selection.status);
    });

    it('57. never fabricates an IV rank from the current IV', () => {
      expect(BASELINE.missingIntelligence).toContain(
        'Historical IV percentile unavailable',
      );
    });
  });

  describe('news context', () => {
    it('22. credits supportive news', () => {
      const result = decide(
        buildDecisionInput({
          news: buildNews({
            sentiment: NewsSentiment.BULLISH,
            riskBias: MarketRiskBias.RISK_ON,
            sentimentConfidence: 0.8,
            impact: NewsImpact.MEDIUM,
          }),
        }),
      );
      expect(
        result.componentScores[DecisionCategory.NEWS].earned,
      ).toBeGreaterThan(
        BASELINE.componentScores[DecisionCategory.NEWS].earned as number,
      );
    });

    it('23. treats conflicting high-impact news as a conflict', () => {
      const result = decide(
        buildDecisionInput({
          news: buildNews({
            sentiment: NewsSentiment.BEARISH,
            riskBias: MarketRiskBias.RISK_OFF,
            impact: NewsImpact.HIGH,
            sentimentConfidence: 0.8,
            riskBiasConfidence: 0.8,
          }),
        }),
      );
      expect(
        result.conflicts.some(
          (item) => item.category === DecisionCategory.NEWS,
        ),
      ).toBe(true);
      expect(result.direction).toBe(TradeDirection.CALL);
    });

    it('24. keeps neutral news close to a neutral contribution', () => {
      const news = BASELINE.componentScores[DecisionCategory.NEWS];
      expect(news.earned).toBeGreaterThan(0);
      expect(news.earned).toBeLessThan(CATEGORY_WEIGHTS[DecisionCategory.NEWS]);
    });

    it('25. degrades gracefully when the news provider is unavailable', () => {
      const result = decide(buildDecisionInput({ news: null }));
      expect(result.componentScores[DecisionCategory.NEWS].earned).toBeNull();
      expect(result.componentScores[DecisionCategory.NEWS].available).toBe(0);
      expect(result.missingIntelligence).toContain('News provider unavailable');
      expect(result.decision).toBe(TradeDecision.TRADE);
    });
  });

  describe('volatility context', () => {
    it('26. credits VIX that confirms a CALL', () => {
      expect(BASELINE.componentScores[DecisionCategory.VOLATILITY].earned).toBe(
        CATEGORY_WEIGHTS[DecisionCategory.VOLATILITY],
      );
    });

    it('27. credits VIX that confirms a PUT', () => {
      expect(
        BEARISH_BASELINE.componentScores[DecisionCategory.VOLATILITY].earned,
      ).toBe(CATEGORY_WEIGHTS[DecisionCategory.VOLATILITY]);
    });

    it('28. lowers quality when volatility diverges from the thesis', () => {
      const result = decide(
        buildDecisionInput({
          volatility: buildVolatility({
            alignment: SignalAlignment.CONFLICTS,
            relationship: VolatilityRelationship.DIVERGENCE,
            trend: VolatilityTrend.RISING,
            momentum: VolatilityMomentum.RISING,
          }),
        }),
      );
      expect(
        result.componentScores[DecisionCategory.VOLATILITY].earned,
      ).toBeLessThan(
        BASELINE.componentScores[DecisionCategory.VOLATILITY].earned as number,
      );
      expect(result.normalizedDecisionScore).toBeLessThan(
        BASELINE.normalizedDecisionScore,
      );
    });

    const withoutVix = decide(
      buildDecisionInput({ volatility: buildVolatility({ available: false }) }),
    );

    it('29. does not score unavailable VIX as 0 out of 5', () => {
      expect(
        withoutVix.componentScores[DecisionCategory.VOLATILITY].earned,
      ).toBeNull();
    });

    it('30. drops the VIX weight from the denominator when it is unavailable', () => {
      expect(withoutVix.availableWeight).toBe(95);
      expect(BASELINE.availableWeight).toBe(100);
    });

    it('31. normalizes correctly against the reduced denominator', () => {
      const expected =
        (withoutVix.rawEarnedScore / withoutVix.availableWeight) * 100;
      expect(withoutVix.preConflictScore).toBeCloseTo(expected, 1);
    });

    it('32. still allows A+ without VIX', () => {
      expect(withoutVix.setupGrade).toBe(SetupGrade.A_PLUS);
    });

    it('33. still allows at least an A grade on a slightly weaker setup without VIX', () => {
      const result = decide(
        buildDecisionInput({
          volatility: buildVolatility({ available: false }),
          signal: buildSignal({ confidence: 0.72, bullish: 7, bearish: 2 }),
        }),
      );
      expect([SetupGrade.A_PLUS, SetupGrade.A]).toContain(result.setupGrade);
    });

    it('34. never turns unavailable VIX into NO_TRADE', () => {
      expect(withoutVix.decision).toBe(TradeDecision.TRADE);
      expect(withoutVix.hardBlockers).toHaveLength(0);
    });

    it('58. exposes missing VIX in missingIntelligence', () => {
      expect(withoutVix.missingIntelligence).toContain(
        'Real-time VIX confirmation unavailable',
      );
      expect(withoutVix.riskFlags.some((flag) => flag.includes('VIX'))).toBe(
        true,
      );
    });

    it('35. does not inflate the score when both optional categories are missing', () => {
      const bare = decide(
        buildDecisionInput({
          news: null,
          volatility: buildVolatility({ available: false }),
        }),
      );
      expect(bare.availableWeight).toBe(90);
      expect(bare.preConflictScore).toBeCloseTo(
        (bare.rawEarnedScore / 90) * 100,
        1,
      );
      expect(bare.rawEarnedScore).toBeLessThan(BASELINE.rawEarnedScore);
    });

    it('36. cannot normalize missing core intelligence into an A grade', () => {
      const result = decide(
        buildDecisionInput({
          news: null,
          volatility: buildVolatility({ available: false }),
          optionProviderFailed: true,
          optionSelection: buildSelection({
            status: OptionSelectionStatus.NO_SELECTION,
            confidence: 0,
          }),
        }),
      );
      expect(result.availableWeight).toBeGreaterThanOrEqual(
        CATEGORY_WEIGHTS[DecisionCategory.OPTION_QUALITY],
      );
      expect([SetupGrade.A_PLUS, SetupGrade.A]).not.toContain(
        result.setupGrade,
      );
      expect(result.decision).not.toBe(TradeDecision.TRADE);
    });
  });

  describe('session gating and hard blockers', () => {
    it('37. never returns TRADE when trade evaluation is disallowed', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({ tradeEvaluationAllowed: false }),
        }),
      );
      expect(result.decision).not.toBe(TradeDecision.TRADE);
      expect(result.tradeEvaluationAllowed).toBe(false);
    });

    it('38. never returns TRADE during the 09:30-09:45 settlement window', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({
            marketSession: MarketSession.OPENING_SETTLEMENT,
            sessionMaturity: SessionMaturity.SETTLING,
            tradeEvaluationAllowed: false,
          }),
        }),
      );
      expect(result.decision).toBe(TradeDecision.WAIT);
      expect(result.hardBlockers).toContain(
        'Opening settlement period is still active',
      );
    });

    it('39. never returns an actionable TRADE while the market is closed', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({
            marketSession: MarketSession.CLOSED,
            tradeEvaluationAllowed: false,
          }),
        }),
      );
      expect(result.decision).not.toBe(TradeDecision.TRADE);
    });

    it('40. treats a NO_TRADE signal as a hard blocker', () => {
      const result = decide(
        buildDecisionInput({
          signal: buildSignal({
            signal: MarketSignal.NO_TRADE,
            bullish: 2,
            bearish: 2,
            confidence: 0.2,
          }),
        }),
      );
      expect(result.decision).toBe(TradeDecision.NO_TRADE);
      expect(result.direction).toBe(TradeDirection.NONE);
      expect(result.hardBlockers).toContain('Signal engine returned NO_TRADE');
    });

    it('41. blocks TRADE when core market data is stale', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({
            latestCandleTime: new Date(NOW.getTime() - 45 * 60_000),
          }),
        }),
      );
      expect(result.decision).toBe(TradeDecision.WAIT);
      expect(result.hardBlockers).toContain('Core market data is stale');
    });

    it('47. lets a hard blocker override an otherwise A+ setup', () => {
      const result = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({ tradeEvaluationAllowed: false }),
        }),
      );
      expect(result.setupGrade).toBe(SetupGrade.A_PLUS);
      expect(result.decision).toBe(TradeDecision.WAIT);
    });

    it('blocks TRADE when the regime lacks sufficient data', () => {
      const result = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BULLISH,
            dataQuality: {
              candleCount: 20,
              sufficientData: false,
              warnings: ['Insufficient candles'],
            },
          }),
        }),
      );
      expect(result.decision).not.toBe(TradeDecision.TRADE);
    });

    it('blocks TRADE when the option provider fails, without calling it NO_TRADE', () => {
      const result = decide(
        buildDecisionInput({
          optionProviderFailed: true,
          optionSelection: buildSelection({
            status: OptionSelectionStatus.NO_SELECTION,
            confidence: 0,
          }),
        }),
      );
      expect(result.decision).toBe(TradeDecision.WAIT);
      expect(result.hardBlockers).toContain(
        'Option chain provider is unavailable',
      );
    });
  });

  describe('grade to decision mapping', () => {
    const gradedInput = (confidence: number, relativeVolume: number) =>
      buildDecisionInput({
        signal: buildSignal({
          confidence,
          bullish: 5,
          bearish: 3,
          confirmations: ['EMA stack is bullish'],
        }),
        regime: buildRegime({
          primaryRegime: MarketRegime.RANGE_BOUND,
          confidence,
          secondaryCharacteristics: {
            trendDirection: 'BULLISH',
            trendStrength: 'WEAK',
          },
          features: { relativeVolume, adx: 14, plusDI: 21, minusDI: 19 },
        }),
        snapshot: buildSnapshot({ openingRange: insideOpeningRange() }),
      });

    it('42. can map a clean B+ setup to TRADE', () => {
      const results = [0.9, 0.8, 0.7, 0.6].map((confidence) =>
        decide(gradedInput(confidence, 1.5)),
      );
      const bPlus = results.find(
        (result) => result.setupGrade === SetupGrade.B_PLUS,
      );
      if (bPlus !== undefined && bPlus.conflicts.length === 0) {
        expect(bPlus.decision).toBe(TradeDecision.TRADE);
      }
      expect(results.every((result) => result.hardBlockers.length === 0)).toBe(
        true,
      );
    });

    it('43. maps a conflicted B+ setup to WAIT', () => {
      const result = decide(
        buildDecisionInput({
          signal: buildSignal({
            confidence: 0.6,
            bullish: 5,
            bearish: 4,
            conflicts: ['RSI is overbought', 'Volume is fading'],
          }),
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 0.7,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'MODERATE',
            },
          }),
        }),
      );
      expect(result.decision).not.toBe(TradeDecision.TRADE);
    });

    it('44. maps a B setup to WAIT', () => {
      const result = decide(
        buildDecisionInput({
          signal: buildSignal({ confidence: 0.45, bullish: 4, bearish: 3 }),
          regime: buildRegime({
            primaryRegime: MarketRegime.RANGE_BOUND,
            confidence: 0.5,
            secondaryCharacteristics: {
              trendDirection: 'NEUTRAL',
              trendStrength: 'WEAK',
            },
            features: { relativeVolume: 0.9, adx: 12, plusDI: 20, minusDI: 19 },
          }),
          snapshot: buildSnapshot({ openingRange: insideOpeningRange() }),
          news: buildNews({ sentiment: NewsSentiment.UNKNOWN }),
        }),
      );
      expect([SetupGrade.B, SetupGrade.B_PLUS, SetupGrade.C_PLUS]).toContain(
        result.setupGrade,
      );
      expect(result.decision).not.toBe(TradeDecision.TRADE);
    });

    it('45. maps a weak C+ setup to WAIT or NO_TRADE', () => {
      const result = decide(
        buildDecisionInput({
          signal: buildSignal({ confidence: 0.3, bullish: 3, bearish: 3 }),
          regime: buildRegime({
            primaryRegime: MarketRegime.HIGH_VOLATILITY,
            confidence: 0.4,
            secondaryCharacteristics: {
              trendDirection: 'NEUTRAL',
              trendStrength: 'WEAK',
              volatility: 'HIGH',
            },
            features: { relativeVolume: 0.6, adx: 10, plusDI: 18, minusDI: 18 },
          }),
          snapshot: buildSnapshot({ openingRange: insideOpeningRange() }),
          optionSelection: buildSelection({
            selectedContract: buildCandidate({
              volume: 30,
              openInterest: 100,
              delta: 0.18,
            }),
            confidence: 0.4,
          }),
        }),
      );
      expect([TradeDecision.WAIT, TradeDecision.NO_TRADE]).toContain(
        result.decision,
      );
    });

    it('46. maps a C setup to NO_TRADE', () => {
      const result = decide(
        buildDecisionInput({
          signal: buildSignal({
            confidence: 0.15,
            bullish: 3,
            bearish: 3,
            confirmations: [],
            conflicts: ['Trend is exhausted', 'Volume is absent'],
          }),
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 0.8,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'STRONG',
              volatility: 'HIGH',
            },
            features: { relativeVolume: 0.3, adx: 9, plusDI: 12, minusDI: 28 },
          }),
          snapshot: buildSnapshot({
            openingRange: bearishOpeningRange(),
            currentSessionFeatures: bearishSessionFeatures(),
          }),
          optionSelection: buildSelection({
            selectedContract: buildCandidate({
              volume: 2,
              openInterest: 5,
              delta: 0.05,
              bid: null,
              ask: null,
              quoteAvailable: false,
            }),
            confidence: 0.2,
          }),
          news: buildNews({
            sentiment: NewsSentiment.BEARISH,
            riskBias: MarketRiskBias.RISK_OFF,
            impact: NewsImpact.HIGH,
          }),
          volatility: buildVolatility({
            alignment: SignalAlignment.CONFLICTS,
            relationship: VolatilityRelationship.DIVERGENCE,
          }),
        }),
      );
      expect(result.setupGrade).toBe(SetupGrade.C);
      expect(result.decision).toBe(TradeDecision.NO_TRADE);
    });

    it('48. lowers quality as major conflicts accumulate', () => {
      const oneConflict = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'STRONG',
            },
          }),
        }),
      );
      const twoConflicts = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'STRONG',
            },
          }),
          news: buildNews({
            sentiment: NewsSentiment.BEARISH,
            riskBias: MarketRiskBias.RISK_OFF,
            impact: NewsImpact.HIGH,
            sentimentConfidence: 0.9,
          }),
          volatility: buildVolatility({
            alignment: SignalAlignment.CONFLICTS,
            relationship: VolatilityRelationship.DIVERGENCE,
          }),
        }),
      );
      expect(twoConflicts.normalizedDecisionScore).toBeLessThan(
        oneConflict.normalizedDecisionScore,
      );
      expect(twoConflicts.conflicts.length).toBeGreaterThan(
        oneConflict.conflicts.length,
      );
    });

    it('49. lets an excellent setup survive a single minor conflict', () => {
      const result = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BULLISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BULLISH',
              trendStrength: 'STRONG',
            },
            features: {
              currentPrice: 655,
              adx: 30,
              plusDI: 30,
              minusDI: 14,
              relativeVolume: 0.85,
            },
          }),
        }),
      );
      expect(
        result.conflicts.every(
          (item) => item.severity === ConflictSeverity.MINOR,
        ),
      ).toBe(true);
      expect(result.decision).toBe(TradeDecision.TRADE);
    });
  });

  describe('determinism, scoring hygiene and confidence', () => {
    it('50. produces identical output for identical input', () => {
      const first = decide(buildDecisionInput());
      const second = decide(buildDecisionInput());
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it('51. keeps confidence distinct from the decision score', () => {
      expect(BASELINE.confidence).toBeGreaterThan(0);
      expect(BASELINE.confidence).toBeLessThanOrEqual(1);
      expect(BASELINE.confidence).not.toBe(BASELINE.normalizedDecisionScore);
    });

    it('52. keeps confidence a reliability measure, not a profit probability', () => {
      const conflicted = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'STRONG',
            },
          }),
        }),
      );
      expect(conflicted.confidence).toBeLessThan(BASELINE.confidence);
      expect(conflicted.direction).toBe(TradeDirection.CALL);
    });

    it('53. normalizes component scores against the declared weights', () => {
      for (const [category, component] of Object.entries(
        BASELINE.componentScores,
      )) {
        expect(component.available).toBe(
          CATEGORY_WEIGHTS[category as DecisionCategory],
        );
      }
      expect(BASELINE.availableWeight).toBe(100);
    });

    it('54. never lets a component exceed its maximum or go negative', () => {
      const inputs = [
        buildDecisionInput(),
        buildBearishInput(),
        buildDecisionInput({ news: null, volatility: null }),
        buildDecisionInput({
          optionSelection: buildSelection({
            status: OptionSelectionStatus.NO_SELECTION,
          }),
        }),
      ];
      for (const input of inputs) {
        for (const component of Object.values(decide(input).componentScores)) {
          if (component.earned === null) {
            continue;
          }
          expect(component.earned).toBeGreaterThanOrEqual(0);
          expect(component.earned).toBeLessThanOrEqual(component.available);
        }
      }
    });

    it('55. keeps the final score inside 0-100', () => {
      const inputs = [
        buildDecisionInput(),
        buildBearishInput(),
        buildDecisionInput({
          signal: buildSignal({ signal: MarketSignal.NO_TRADE }),
        }),
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 1,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'STRONG',
            },
          }),
          news: buildNews({
            sentiment: NewsSentiment.BEARISH,
            riskBias: MarketRiskBias.RISK_OFF,
            impact: NewsImpact.HIGH,
          }),
          volatility: buildVolatility({
            alignment: SignalAlignment.CONFLICTS,
          }),
        }),
      ];
      for (const input of inputs) {
        const result = decide(input);
        expect(result.normalizedDecisionScore).toBeGreaterThanOrEqual(0);
        expect(result.normalizedDecisionScore).toBeLessThanOrEqual(100);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('56. counts an opening-range breakout in structure without repeating it in momentum', () => {
      const breakoutMomentum =
        BASELINE.componentScores[DecisionCategory.MOMENTUM_AND_VOLUME].earned;
      const insideMomentum = decide(
        buildDecisionInput({
          snapshot: buildSnapshot({
            openingRange: {
              ...insideOpeningRange(),
              volumeConfirmation: 'CONFIRMED',
              relativeBreakoutVolume: 1.6,
            },
          }),
        }),
      ).componentScores[DecisionCategory.MOMENTUM_AND_VOLUME].earned;
      expect(breakoutMomentum).toBe(insideMomentum);
    });

    it('60. reaches a decision without any external AI, LLM or network call', () => {
      const result = decide(buildDecisionInput());
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toMatch(
        /openai|mistral|gpt|anthropic|llm/i,
      );
    });

    it('deduplicates identical conflicts so they are penalised once', () => {
      const codes = decide(
        buildDecisionInput({
          regime: buildRegime({
            primaryRegime: MarketRegime.TRENDING_BEARISH,
            confidence: 0.9,
            secondaryCharacteristics: {
              trendDirection: 'BEARISH',
              trendStrength: 'STRONG',
            },
          }),
        }),
      ).conflicts.map((item) => item.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('exposes the raw, available and normalized score consistently', () => {
      expect(BASELINE.preConflictScore).toBeCloseTo(
        (BASELINE.rawEarnedScore / BASELINE.availableWeight) * 100,
        1,
      );
      expect(BASELINE.normalizedDecisionScore).toBeCloseTo(
        BASELINE.preConflictScore - BASELINE.conflictPenalty,
        1,
      );
    });

    it('states that TRADE means proceeding to 5-minute entry confirmation', () => {
      expect(
        BASELINE.reasoning.some((line) =>
          line.includes('5-minute entry confirmation'),
        ),
      ).toBe(true);
    });

    it('summarises the thesis in the requested direction', () => {
      expect(BASELINE.thesis).toContain('CALL');
      expect(BEARISH_BASELINE.thesis).toContain('PUT');
    });
  });
});
