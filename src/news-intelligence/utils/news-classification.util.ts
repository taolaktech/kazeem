import {
  CATALYST_KEYWORDS,
  MARKET_WIDE_KEYWORDS,
  SENTIMENT_RULES,
} from '../constants/news-keywords.js';
import { maxCatalystSeverity } from '../constants/catalyst-severity.js';
import {
  HIGH_IMPACT_SCORE,
  MEDIUM_IMPACT_SCORE,
  SCOPE_BREADTH,
} from '../constants/news-intelligence-thresholds.js';
import {
  RISK_BIAS_CONFLICT_SPREAD,
  RISK_BIAS_RULES,
} from '../constants/risk-bias-rules.js';
import { MarketRiskBias } from '../enums/market-risk-bias.enum.js';
import {
  CatalystType,
  MACRO_CATALYSTS,
  SECTOR_CATALYSTS,
} from '../enums/catalyst-type.enum.js';
import { NewsImpact } from '../enums/news-impact.enum.js';
import { NewsScope } from '../enums/news-scope.enum.js';
import { NewsSentiment } from '../enums/news-sentiment.enum.js';
import { clamp01, containsAnyPhrase, roundTo } from './news-text.util.js';

export function detectCatalysts(searchText: string): CatalystType[] {
  const detected = Object.entries(CATALYST_KEYWORDS)
    .filter(([, phrases]) => containsAnyPhrase(searchText, phrases))
    .map(([catalyst]) => catalyst as CatalystType);
  return detected.length > 0 ? detected : [CatalystType.OTHER];
}

export function hasMacroCatalyst(catalysts: readonly CatalystType[]): boolean {
  return catalysts.some((catalyst) => MACRO_CATALYSTS.includes(catalyst));
}

export function detectScope(
  searchText: string,
  catalysts: readonly CatalystType[],
  mentionsSymbolDirectly: boolean,
): NewsScope {
  if (hasMacroCatalyst(catalysts)) {
    return NewsScope.MACRO;
  }
  if (containsAnyPhrase(searchText, MARKET_WIDE_KEYWORDS)) {
    return NewsScope.MARKET;
  }
  if (catalysts.some((catalyst) => SECTOR_CATALYSTS.includes(catalyst))) {
    return NewsScope.SECTOR;
  }
  return mentionsSymbolDirectly ? NewsScope.SYMBOL : NewsScope.MARKET;
}

export interface SentimentAssessment {
  sentiment: NewsSentiment;
  confidence: number;
  reasoning: string[];
}

/**
 * Rule-driven direction. Rules encode complete implications rather than single
 * words, and anything they do not cover stays UNKNOWN rather than guessing.
 */
export function classifySentiment(
  searchText: string,
  providerSentiment: NewsSentiment | null,
): SentimentAssessment {
  const reasoning: string[] = [];
  let bullish = 0;
  let bearish = 0;

  for (const rule of SENTIMENT_RULES) {
    if (!new RegExp(rule.pattern).test(searchText)) {
      continue;
    }
    reasoning.push(rule.reason);
    if (rule.direction === NewsSentiment.BULLISH) {
      bullish = Math.max(bullish, rule.confidence);
    } else {
      bearish = Math.max(bearish, rule.confidence);
    }
  }

  if (bullish > 0 && bearish > 0) {
    const spread = Math.abs(bullish - bearish);
    if (spread < 0.15) {
      return {
        sentiment: NewsSentiment.MIXED,
        confidence: roundTo(Math.min(bullish, bearish) * 0.5),
        reasoning: [...reasoning, 'Headline carries competing implications'],
      };
    }
  }

  if (bullish > 0 || bearish > 0) {
    const bullishWins = bullish >= bearish;
    return {
      sentiment: bullishWins ? NewsSentiment.BULLISH : NewsSentiment.BEARISH,
      confidence: roundTo(
        clamp01(Math.max(bullish, bearish) - Math.min(bullish, bearish) * 0.5),
      ),
      reasoning,
    };
  }

  if (
    providerSentiment !== null &&
    providerSentiment !== NewsSentiment.UNKNOWN
  ) {
    return {
      sentiment: providerSentiment,
      confidence: providerSentiment === NewsSentiment.NEUTRAL ? 0.2 : 0.45,
      reasoning: ['Provider supplied a directional assessment'],
    };
  }

  return {
    sentiment: NewsSentiment.UNKNOWN,
    confidence: 0,
    reasoning: ['No deterministic directional rule matched this headline'],
  };
}

export interface RiskBiasAssessment {
  bias: MarketRiskBias;
  confidence: number;
  reasoning: string[];
}

/**
 * Risk environment implied by the story, independent of direction. Escalation
 * and de-escalation are matched separately, so "ceasefire reached" and
 * "ceasefire collapses" cannot land on the same verdict, and a bare mention of
 * a country or of the word "war" resolves nothing on its own.
 */
export function classifyRiskBias(searchText: string): RiskBiasAssessment {
  const reasoning: string[] = [];
  let riskOff = 0;
  let riskOn = 0;
  let dampened = false;

  for (const rule of RISK_BIAS_RULES) {
    if (!new RegExp(rule.pattern, 'i').test(searchText)) {
      continue;
    }
    reasoning.push(rule.reason);
    dampened = dampened || rule.dampensEscalation === true;
    if (rule.bias === MarketRiskBias.RISK_OFF) {
      riskOff = Math.max(riskOff, rule.confidence);
    } else {
      riskOn = Math.max(riskOn, rule.confidence);
    }
  }

  if (dampened) {
    riskOff *= 0.5;
  }

  if (riskOff === 0 && riskOn === 0) {
    return { bias: MarketRiskBias.UNKNOWN, confidence: 0, reasoning: [] };
  }

  const spread = Math.abs(riskOff - riskOn);
  if (riskOff > 0 && riskOn > 0 && spread < RISK_BIAS_CONFLICT_SPREAD) {
    return {
      bias: MarketRiskBias.NEUTRAL,
      confidence: roundTo(spread),
      reasoning: [...reasoning, 'Escalation and de-escalation cues offset'],
    };
  }

  return {
    bias: riskOff > riskOn ? MarketRiskBias.RISK_OFF : MarketRiskBias.RISK_ON,
    confidence: roundTo(
      clamp01(Math.max(riskOff, riskOn) - Math.min(riskOff, riskOn) * 0.5),
    ),
    reasoning,
  };
}

/**
 * Potential market significance, not a prediction of movement. The strongest
 * catalyst's severity is scaled by how much of the market the story reaches
 * and by how relevant and fresh it is, so a macro shock is not demoted just
 * because its direction is unclear, and an unrelated small deal is not
 * promoted just because it is recent.
 */
export function classifyImpact(
  catalysts: readonly CatalystType[],
  relevanceScore: number,
  scope: NewsScope,
  recency: number,
  mentionsSymbolDirectly: boolean,
): NewsImpact {
  const severity = maxCatalystSeverity(catalysts);
  const breadth = mentionsSymbolDirectly ? 1 : SCOPE_BREADTH[scope];
  const score =
    severity *
    (0.4 + 0.6 * clamp01(relevanceScore)) *
    (0.6 + 0.4 * clamp01(recency)) *
    breadth;

  if (score >= HIGH_IMPACT_SCORE) {
    return NewsImpact.HIGH;
  }
  return score >= MEDIUM_IMPACT_SCORE ? NewsImpact.MEDIUM : NewsImpact.LOW;
}
