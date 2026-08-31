import {
  hasBroadRiskCatalyst,
  maxCatalystSeverity,
} from '../constants/catalyst-severity.js';
import { RELEVANCE_WEIGHTS } from '../constants/news-intelligence-thresholds.js';
import {
  INDEX_HEAVYWEIGHTS,
  SYMBOL_ENTITY_ALIASES,
  type SymbolContext,
} from '../constants/symbol-context.js';
import { MARKET_WIDE_KEYWORDS } from '../constants/news-keywords.js';
import { CatalystType } from '../enums/catalyst-type.enum.js';
import { hasMacroCatalyst } from './news-classification.util.js';
import { clamp01, containsAnyPhrase, roundTo } from './news-text.util.js';

export interface RelevanceAssessment {
  score: number;
  mentionsSymbolDirectly: boolean;
  reasoning: string[];
}

/**
 * Blends direct mention, entity overlap, symbol theme, macro applicability,
 * catalyst importance and recency into a single 0–1 score.
 */
export function scoreRelevance(
  context: SymbolContext,
  searchText: string,
  taggedSymbols: readonly string[],
  catalysts: readonly CatalystType[],
  recency: number,
): RelevanceAssessment {
  const reasoning: string[] = [];
  const upperSymbols = taggedSymbols.map((symbol) => symbol.toUpperCase());
  const aliases = SYMBOL_ENTITY_ALIASES[context.symbol] ?? [];

  const mentionsSymbolDirectly =
    upperSymbols.includes(context.symbol) ||
    containsAnyPhrase(searchText, [context.symbol.toLowerCase(), ...aliases]);

  const macroCatalyst = hasMacroCatalyst(catalysts);
  const marketWide = containsAnyPhrase(searchText, MARKET_WIDE_KEYWORDS);
  const broadRisk = hasBroadRiskCatalyst(catalysts);

  let direct = 0;
  if (mentionsSymbolDirectly) {
    direct = 1;
    reasoning.push(`Article references ${context.symbol} directly`);
  } else if (context.riskProxy && broadRisk) {
    direct = 1;
    reasoning.push(`Broad risk event is directly relevant to ${context.label}`);
  } else if (
    context.broadMarket &&
    (macroCatalyst || marketWide || broadRisk)
  ) {
    direct = 0.85;
    reasoning.push(
      `Broad-market story applies to ${context.label || context.symbol}`,
    );
  }

  const heavyweights = INDEX_HEAVYWEIGHTS[context.symbol] ?? [];
  const overlapping = upperSymbols.filter((symbol) =>
    heavyweights.includes(symbol),
  );
  let entity = 0;
  if (overlapping.length > 0) {
    entity = 1;
    reasoning.push(
      `Covers index heavyweight(s) ${overlapping.slice(0, 3).join(', ')}`,
    );
  } else if (!mentionsSymbolDirectly && upperSymbols.length > 0) {
    entity = 0.1;
  }

  let theme = 0;
  if (
    context.themes.length > 0 &&
    containsAnyPhrase(searchText, context.themes)
  ) {
    theme = 1;
    reasoning.push(`Matches ${context.label || context.symbol} themes`);
  } else if (context.riskProxy && broadRisk) {
    theme = 0.5;
    reasoning.push(
      'Broad uncertainty feeds implied volatility even without an explicit market angle',
    );
  }

  let macro = 0;
  if (macroCatalyst || (context.riskProxy && broadRisk)) {
    macro = context.broadMarket ? 1 : 0.35;
    if (context.broadMarket) {
      reasoning.push('Macro catalyst applies to a broad-market instrument');
    }
  }

  const contextCatalystHit = catalysts.some((catalyst) =>
    context.catalysts.includes(catalyst),
  );
  const severity = maxCatalystSeverity(catalysts);
  const catalystImportance = contextCatalystHit ? 1 : severity;

  const score = clamp01(
    direct * RELEVANCE_WEIGHTS.directSymbol +
      entity * RELEVANCE_WEIGHTS.entity +
      theme * RELEVANCE_WEIGHTS.symbolContext +
      macro * RELEVANCE_WEIGHTS.macro +
      catalystImportance * RELEVANCE_WEIGHTS.catalystImportance +
      clamp01(recency) * RELEVANCE_WEIGHTS.recency,
  );

  if (reasoning.length === 0) {
    reasoning.push(`No clear connection to ${context.symbol} was found`);
  }
  if (theme === 0 && broadRisk && direct > 0) {
    reasoning.push('Broad risk events widen uncertainty across the tape');
  }

  return { score: roundTo(score), mentionsSymbolDirectly, reasoning };
}
