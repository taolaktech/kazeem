import { MarketRiskBias } from '../../news-intelligence/enums/market-risk-bias.enum.js';
import { NewsImpact } from '../../news-intelligence/enums/news-impact.enum.js';
import { NewsSentiment } from '../../news-intelligence/enums/news-sentiment.enum.js';
import type { NewsIntelligenceResult } from '../../news-intelligence/interfaces/news-intelligence-result.interface.js';
import {
  CATEGORY_WEIGHTS,
  NEWS_CONFIDENCE_FLOOR,
  NEWS_FACTORS,
} from '../constants/trade-decision-weights.js';
import {
  ConflictSeverity,
  DecisionCategory,
  TradeDirection,
} from '../enums/trade-decision.enum.js';
import type {
  ComponentScore,
  DecisionConflict,
} from '../interfaces/component-score.interface.js';
import { clamp01, conflict, round2 } from './scoring.util.js';

const CATEGORY = DecisionCategory.NEWS;
const WEIGHT = CATEGORY_WEIGHTS[CATEGORY];
const LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Pulls a categorical factor back towards neutral when the news read itself is
 * weakly held, in either direction.
 */
function weightedByConfidence(factor: number, confidence: number): number {
  const scale =
    NEWS_CONFIDENCE_FLOOR + (1 - NEWS_CONFIDENCE_FLOOR) * clamp01(confidence);
  return NEWS_FACTORS.neutral + (factor - NEWS_FACTORS.neutral) * scale;
}

/**
 * Context, not a directional engine: news can confirm or contradict a thesis
 * but never sets or reverses its direction. When the providers are down the
 * category leaves the denominator instead of scoring zero.
 */
export function scoreNews(
  news: NewsIntelligenceResult | null,
  direction: TradeDirection,
): ComponentScore {
  if (news === null) {
    return {
      earned: null,
      available: 0,
      reason: 'NEWS_UNAVAILABLE',
      confirmations: [],
      conflicts: [],
      riskFlags: ['News intelligence is unavailable'],
      missingIntelligence: ['News provider unavailable'],
    };
  }
  if (direction === TradeDirection.NONE) {
    return {
      earned: round2(WEIGHT * NEWS_FACTORS.neutral),
      available: WEIGHT,
      confirmations: [],
      conflicts: [],
      riskFlags: [],
      missingIntelligence: [],
    };
  }

  const bullish = direction === TradeDirection.CALL;
  const confirmations: string[] = [];
  const conflicts: DecisionConflict[] = [];
  const riskFlags: string[] = [];

  const supportiveSentiment =
    news.overallSentiment ===
    (bullish ? NewsSentiment.BULLISH : NewsSentiment.BEARISH);
  const opposingSentiment =
    news.overallSentiment ===
    (bullish ? NewsSentiment.BEARISH : NewsSentiment.BULLISH);
  const supportiveRisk =
    news.marketRiskBias ===
    (bullish ? MarketRiskBias.RISK_ON : MarketRiskBias.RISK_OFF);
  const opposingRisk =
    news.marketRiskBias ===
    (bullish ? MarketRiskBias.RISK_OFF : MarketRiskBias.RISK_ON);
  const highImpact = news.newsImpact === NewsImpact.HIGH;

  // How strongly the categorical read is held; only the sides that actually
  // point at the thesis get a say.
  const evidenceConfidence = Math.max(
    supportiveSentiment || opposingSentiment ? news.sentimentConfidence : 0,
    supportiveRisk || opposingRisk ? news.riskBiasConfidence : 0,
  );

  let factor: number = NEWS_FACTORS.neutral;
  if (supportiveSentiment && supportiveRisk) {
    factor = NEWS_FACTORS.strongConfirmation;
    confirmations.push(
      `News sentiment and ${news.marketRiskBias} risk bias support the ${direction} thesis`,
    );
  } else if (supportiveSentiment || supportiveRisk) {
    factor = NEWS_FACTORS.confirmation;
    confirmations.push(
      `News context modestly supports the ${direction} thesis`,
    );
  } else if (opposingSentiment || opposingRisk) {
    factor = highImpact ? NEWS_FACTORS.strongConflict : NEWS_FACTORS.conflict;
    conflicts.push(
      conflict(
        CATEGORY,
        'NEWS_CONFLICT',
        highImpact ? ConflictSeverity.MODERATE : ConflictSeverity.MINOR,
        `News context (${news.overallSentiment}, ${news.marketRiskBias}) conflicts with the ${direction} thesis`,
        highImpact,
      ),
    );
  }

  if (
    factor !== NEWS_FACTORS.neutral &&
    evidenceConfidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    riskFlags.push(
      `News read is low confidence (${round2(evidenceConfidence)}); its weight is reduced`,
    );
  }
  if (news.riskBiasConflict) {
    riskFlags.push('News carries competing risk-on and risk-off narratives');
  }
  if (highImpact) {
    riskFlags.push('High-impact news catalyst is active');
  }

  return {
    earned: round2(WEIGHT * weightedByConfidence(factor, evidenceConfidence)),
    available: WEIGHT,
    confirmations,
    conflicts,
    riskFlags,
    missingIntelligence: [],
  };
}
