import { parseRssItems } from './rss.util.js';

const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Breaking News</title>
  <item>
    <title>ONEOK to buy Permian assets in $4.42B deal</title>
    <link>https://seekingalpha.com/news/1?utm_source=feed</link>
    <category domain="https://seekingalpha.com/symbol/OKE">oke</category>
    <category domain="https://seekingalpha.com/symbol/APO">apo</category>
    <pubDate>Sun, 30 Aug 2026 22:15:03 -0400</pubDate>
    <guid>https://seekingalpha.com/news/1</guid>
  </item>
  <item>
    <title><![CDATA[Fed holds rates steady & signals patience]]></title>
    <link>https://seekingalpha.com/news/2</link>
    <description><![CDATA[<p>Policymakers left the target range unchanged.</p>]]></description>
    <pubDate>not a date</pubDate>
  </item>
</channel></rss>`;

describe('parseRssItems', () => {
  it('reads titles, links, categories and dates', () => {
    const [first] = parseRssItems(FEED);

    expect(first.title).toBe('ONEOK to buy Permian assets in $4.42B deal');
    expect(first.categories).toEqual(['oke', 'apo']);
    expect(first.pubDate?.toISOString()).toBe('2026-08-31T02:15:03.000Z');
  });

  it('decodes entities, strips markup and rejects invalid dates', () => {
    const [, second] = parseRssItems(FEED);

    expect(second.title).toBe('Fed holds rates steady & signals patience');
    expect(second.description).toBe(
      'Policymakers left the target range unchanged.',
    );
    expect(second.pubDate).toBeNull();
  });

  it('returns nothing for a feed without items', () => {
    expect(parseRssItems('<rss><channel></channel></rss>')).toEqual([]);
  });
});
