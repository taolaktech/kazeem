import {
  CATALYST_KEYWORDS,
  MARKET_WIDE_KEYWORDS,
  SENTIMENT_RULES,
} from '../constants/news-keywords.js';
import {
  HIGH_IMPACT_CATALYSTS,
  HIGH_IMPACT_RELEVANCE_THRESHOLD,
  MEDIUM_IMPACT_CATALYSTS,
  MEDIUM_IMPACT_RELEVANCE_THRESHOLD,
} from '../constants/news-intelligence-thresholds.js';
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

/** Potential market significance, not a prediction of movement. */
export function classifyImpact(
  catalysts: readonly CatalystType[],
  relevanceScore: number,
): NewsImpact {
  const highCatalyst = catalysts.some((catalyst) =>
    HIGH_IMPACT_CATALYSTS.includes(catalyst),
  );
  if (highCatalyst && relevanceScore >= HIGH_IMPACT_RELEVANCE_THRESHOLD) {
    return NewsImpact.HIGH;
  }
  const mediumCatalyst = catalysts.some((catalyst) =>
    MEDIUM_IMPACT_CATALYSTS.includes(catalyst),
  );
  if (
    (highCatalyst || mediumCatalyst) &&
    relevanceScore >= MEDIUM_IMPACT_RELEVANCE_THRESHOLD
  ) {
    return NewsImpact.MEDIUM;
  }
  return NewsImpact.LOW;
}
