import { describe, expect, it } from "vitest";
import { parseHnTop } from "@/src/infra/parsers/hn-top";

describe("parseHnTop", () => {
  it("maps story items to ParsedItem", () => {
    const stories = [
      { id: 1, type: "story", title: "Foo", url: "https://example.com/a", time: 1715500000 },
      { id: 2, type: "story", title: "Bar", url: "https://example.com/b", time: 1715600000 },
    ];
    const items = parseHnTop(stories);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ url: "https://example.com/a", title: "Foo" });
    expect(items[0].publishedAt instanceof Date).toBe(true);
  });

  it("uses HN discussion URL when item.url is missing (Ask HN)", () => {
    const stories = [{ id: 7, type: "story", title: "Ask HN: anything?", time: 1715500000 }];
    const items = parseHnTop(stories);
    expect(items[0].url).toBe("https://news.ycombinator.com/item?id=7");
  });

  it("filters non-story types and dead/deleted", () => {
    const stories = [
      { id: 1, type: "comment", title: "x", url: "https://a", time: 1 },
      { id: 2, type: "story", title: "y", url: "https://b", time: 1, dead: true },
      { id: 3, type: "story", title: "z", url: "https://c", time: 1, deleted: true },
      { id: 4, type: "story", title: "ok", url: "https://d", time: 1 },
    ];
    expect(parseHnTop(stories).map((i) => i.title)).toEqual(["ok"]);
  });

  it("returns [] on falsy input", () => {
    expect(parseHnTop([])).toEqual([]);
  });
});
