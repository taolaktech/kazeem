import {
  DUPLICATE_TIME_WINDOW_MS,
  DUPLICATE_TITLE_SIMILARITY,
} from '../constants/news-intelligence-thresholds.js';
import type { RawNewsArticle } from '../interfaces/news-article.interface.js';
import {
  jaccardSimilarity,
  normalizeTitle,
  normalizeUrl,
  titleTokens,
} from './news-text.util.js';

interface DedupEntry {
  article: RawNewsArticle;
  tokens: Set<string>;
}

function mergeSymbols(
  target: RawNewsArticle,
  duplicate: RawNewsArticle,
): string[] {
  return [...new Set([...target.symbols, ...duplicate.symbols])];
}

function preferred(
  current: RawNewsArticle,
  candidate: RawNewsArticle,
): RawNewsArticle {
  const currentDetail = (current.description ?? '').length;
  const candidateDetail = (candidate.description ?? '').length;
  if (candidateDetail > currentDetail) {
    return candidate;
  }
  if (candidateDetail === currentDetail && candidate.url && !current.url) {
    return candidate;
  }
  return current;
}

/**
 * Collapses the same story arriving from several providers. Exact provider id,
 * canonical URL and normalised title match first; near-identical headlines
 * published close together are then folded together so syndicated copies
 * cannot inflate confidence.
 */
export function deduplicateArticles(
  articles: readonly RawNewsArticle[],
): RawNewsArticle[] {
  const exactKeys = new Map<string, number>();
  const entries: DedupEntry[] = [];

  for (const article of articles) {
    const keys = [
      `id:${article.provider}:${article.id}`,
      normalizeUrl(article.url) ? `url:${normalizeUrl(article.url)}` : null,
      `title:${normalizeTitle(article.title)}`,
    ].filter((key): key is string => key !== null);

    const existingIndex = keys
      .map((key) => exactKeys.get(key))
      .find((index): index is number => index !== undefined);

    const tokens = titleTokens(article.title);

    const similarIndex =
      existingIndex ??
      entries.findIndex(
        (entry) =>
          Math.abs(
            entry.article.publishedAt.getTime() - article.publishedAt.getTime(),
          ) <= DUPLICATE_TIME_WINDOW_MS &&
          jaccardSimilarity(entry.tokens, tokens) >= DUPLICATE_TITLE_SIMILARITY,
      );

    if (similarIndex !== undefined && similarIndex >= 0) {
      const entry = entries[similarIndex];
      const symbols = mergeSymbols(entry.article, article);
      const winner = preferred(entry.article, article);
      entry.article = {
        ...winner,
        symbols,
        providerSentiment:
          winner.providerSentiment ??
          entry.article.providerSentiment ??
          article.providerSentiment,
      };
      entry.tokens = titleTokens(entry.article.title);
      for (const key of keys) {
        exactKeys.set(key, similarIndex);
      }
      continue;
    }

    entries.push({ article, tokens });
    for (const key of keys) {
      exactKeys.set(key, entries.length - 1);
    }
  }

  return entries.map((entry) => entry.article);
}
