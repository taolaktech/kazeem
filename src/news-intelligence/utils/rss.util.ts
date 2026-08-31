export interface RssItem {
  title: string | null;
  link: string | null;
  description: string | null;
  guid: string | null;
  pubDate: Date | null;
  categories: string[];
}

const ITEM_PATTERN = /<item[\s>][\s\S]*?<\/item>/gi;
const CDATA_PATTERN = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/;
const TAG_PATTERN = /<[^>]*>/g;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function cleanValue(raw: string): string {
  const cdata = CDATA_PATTERN.exec(raw);
  const inner = cdata ? cdata[1] : raw;
  return decodeEntities(inner.replace(TAG_PATTERN, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function readTag(block: string, tag: string): string | null {
  const match = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,
    'i',
  ).exec(block);
  if (!match) {
    return null;
  }
  const value = cleanValue(match[1]);
  return value.length > 0 ? value : null;
}

function readCategories(block: string): string[] {
  const matches = block.matchAll(
    /<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi,
  );
  const categories: string[] = [];
  for (const match of matches) {
    const value = cleanValue(match[1]);
    if (value.length > 0) {
      categories.push(value);
    }
  }
  return categories;
}

function readDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * Minimal RSS 2.0 item reader. Feeds consumed here are small and well-formed,
 * so this avoids pulling in a general XML parser.
 */
export function parseRssItems(xml: string): RssItem[] {
  const blocks = xml.match(ITEM_PATTERN) ?? [];
  return blocks.map((block) => ({
    title: readTag(block, 'title'),
    link: readTag(block, 'link'),
    description:
      readTag(block, 'description') ?? readTag(block, 'content:encoded'),
    guid: readTag(block, 'guid'),
    pubDate: readDate(readTag(block, 'pubDate')),
    categories: readCategories(block),
  }));
}
