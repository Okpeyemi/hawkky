import { describe, expect, it } from "vitest";
import { parseRss } from "@/src/infra/parsers/rss";

const sampleFeed = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item>
      <title>Hello world</title>
      <link>https://example.com/post-1</link>
      <description>An intro paragraph</description>
      <pubDate>Mon, 12 May 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second</title>
      <link>https://example.com/post-2</link>
      <pubDate>Mon, 12 May 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const atomFeed = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom entry</title>
    <link href="https://example.com/atom-1"/>
    <summary>Atom summary</summary>
    <updated>2026-05-12T09:00:00Z</updated>
  </entry>
</feed>`;

describe("parseRss", () => {
  it("parses RSS 2.0 items", () => {
    const items = parseRss(sampleFeed);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://example.com/post-1",
      title: "Hello world",
      excerpt: "An intro paragraph",
    });
    expect(items[0].publishedAt?.toISOString()).toBe("2026-05-12T09:00:00.000Z");
  });

  it("parses Atom feeds", () => {
    const items = parseRss(atomFeed);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://example.com/atom-1",
      title: "Atom entry",
      excerpt: "Atom summary",
    });
  });

  it("returns [] on garbage", () => {
    expect(parseRss("<html>nope</html>")).toEqual([]);
  });

  it("skips items missing a link", () => {
    const broken = `<?xml version="1.0"?><rss><channel><item><title>No link</title></item></channel></rss>`;
    expect(parseRss(broken)).toEqual([]);
  });
});
