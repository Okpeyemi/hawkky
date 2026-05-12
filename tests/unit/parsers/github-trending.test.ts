import { describe, expect, it } from "vitest";
import { parseGithubTrending } from "@/src/infra/parsers/github-trending";

const html = `
<main>
  <article class="Box-row">
    <h2><a href="/vercel/next.js"> vercel / next.js </a></h2>
    <p class="col-9 color-fg-muted my-1 pr-4">The React framework for production.</p>
  </article>
  <article class="Box-row">
    <h2><a href="/owner/no-desc">owner / no-desc</a></h2>
  </article>
</main>
`;

describe("parseGithubTrending", () => {
  it("extracts owner/name and description", () => {
    const items = parseGithubTrending(html);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://github.com/vercel/next.js",
      title: "vercel/next.js",
      excerpt: "The React framework for production.",
    });
    expect(items[1].title).toBe("owner/no-desc");
    expect(items[1].excerpt).toBeUndefined();
  });

  it("returns [] on empty/unknown HTML", () => {
    expect(parseGithubTrending("<html><body>nope</body></html>")).toEqual([]);
  });
});
