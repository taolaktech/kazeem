const NON_WORD = /[^a-z0-9$.&\s-]+/g;
const WHITESPACE = /\s+/g;

/** Lowercased title and description, used for every keyword lookup. */
export function toSearchText(
  title: string,
  description: string | null,
): string {
  return `${title} ${description ?? ''}`
    .toLowerCase()
    .replace(NON_WORD, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary match, so `ai` never matches inside `said`. */
export function containsPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`).test(
    text,
  );
}

export function containsAnyPhrase(
  text: string,
  phrases: readonly string[],
): boolean {
  return phrases.some((phrase) => containsPhrase(text, phrase));
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'after',
  'over',
  'says',
  'said',
]);

/** Comparable token set for duplicate detection. */
export function titleTokens(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(WHITESPACE)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return new Set(tokens);
}

export function normalizeTitle(title: string): string {
  return [...titleTokens(title)].sort().join(' ');
}

export function jaccardSimilarity(
  left: Set<string>,
  right: Set<string>,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) {
      shared += 1;
    }
  }
  return shared / (left.size + right.size - shared);
}

/** Drops tracking parameters so syndicated links compare equal. */
export function normalizeUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return `${parsed.host.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase() || null;
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
