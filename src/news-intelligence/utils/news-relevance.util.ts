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

const IMPORTANT_CATALYSTS: readonly CatalystType[] = [
  CatalystType.FEDERAL_RESERVE,
  CatalystType.CPI,
  CatalystType.PPI,
  CatalystType.INFLATION,
  CatalystType.INTEREST_RATES,
  CatalystType.JOBS,
  CatalystType.GDP,
  CatalystType.TREASURY_YIELDS,
  CatalystType.EARNINGS,
  CatalystType.GEOPOLITICAL,
  CatalystType.TARIFFS,
  CatalystType.CREDIT,
  CatalystType.MARKET_MOVING,
];

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

  let direct = 0;
  if (mentionsSymbolDirectly) {
    direct = 1;
    reasoning.push(`Article references ${context.symbol} directly`);
  } else if (context.broadMarket && (macroCatalyst || marketWide)) {
    direct = 0.8;
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
  }

  let macro = 0;
  if (macroCatalyst) {
    macro = context.broadMarket ? 1 : 0.35;
    if (context.broadMarket) {
      reasoning.push('Macro catalyst applies to a broad-market instrument');
    }
  }

  const contextCatalystHit = catalysts.some((catalyst) =>
    context.catalysts.includes(catalyst),
  );
  const importantHit = catalysts.some((catalyst) =>
    IMPORTANT_CATALYSTS.includes(catalyst),
  );
  const catalystImportance = contextCatalystHit ? 1 : importantHit ? 0.4 : 0;

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

  return { score: roundTo(score), mentionsSymbolDirectly, reasoning };
}
