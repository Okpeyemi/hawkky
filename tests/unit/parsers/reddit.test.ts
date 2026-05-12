import { describe, expect, it } from "vitest";
import { parseReddit } from "@/src/infra/parsers/reddit";

const listing = {
  data: {
    children: [
      {
        data: {
          id: "1",
          title: "TypeScript 5.6",
          url: "https://example.com/ts56",
          permalink: "/r/programming/comments/1/typescript_56/",
          created_utc: 1715500000,
          over_18: false,
          stickied: false,
          selftext: "Release notes...",
        },
      },
      {
        data: {
          id: "2",
          title: "NSFW post",
          url: "https://example.com/n",
          permalink: "/r/x/comments/2/",
          created_utc: 1715500001,
          over_18: true,
          stickied: false,
        },
      },
      {
        data: {
          id: "3",
          title: "Stickied announcement",
          url: "https://example.com/s",
          permalink: "/r/x/comments/3/",
          created_utc: 1715500002,
          over_18: false,
          stickied: true,
        },
      },
    ],
  },
};

describe("parseReddit", () => {
  it("maps non-NSFW non-stickied entries", () => {
    const items = parseReddit(listing);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("TypeScript 5.6");
    expect(items[0].url).toBe("https://example.com/ts56");
    expect(items[0].excerpt).toBe("Release notes...");
  });

  it("falls back to permalink for self posts (no external url)", () => {
    const self = {
      data: {
        children: [
          {
            data: {
              id: "10",
              title: "Self only",
              url: "",
              permalink: "/r/x/comments/10/self_only/",
              created_utc: 1715500000,
              is_self: true,
            },
          },
        ],
      },
    };
    expect(parseReddit(self)[0].url).toBe("https://www.reddit.com/r/x/comments/10/self_only/");
  });

  it("returns [] when shape is broken", () => {
    expect(parseReddit({} as never)).toEqual([]);
  });
});
