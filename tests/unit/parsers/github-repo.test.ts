import { describe, expect, it } from "vitest";
import { parseGithubRepo } from "@/src/infra/parsers/github-repo";

const releases = [
  {
    id: 1,
    name: "v15.2.0",
    tag_name: "v15.2.0",
    html_url: "https://github.com/vercel/next.js/releases/tag/v15.2.0",
    published_at: "2026-05-10T12:00:00Z",
    body: "## Breaking changes\nXYZ",
    draft: false,
    prerelease: false,
  },
  {
    id: 2,
    name: "v15.1",
    html_url: "https://x",
    draft: true,
    published_at: "2026-05-01T00:00:00Z",
  },
];

const commits = [
  {
    sha: "abc123",
    html_url: "https://github.com/vercel/next.js/commit/abc123",
    commit: { message: "fix(router): handle X", author: { date: "2026-05-12T08:00:00Z" } },
  },
];

describe("parseGithubRepo", () => {
  it("maps releases (skips draft/prerelease)", () => {
    const items = parseGithubRepo({ owner: "vercel", repo: "next.js", releases, commits: [] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://github.com/vercel/next.js/releases/tag/v15.2.0",
      title: "vercel/next.js — release v15.2.0",
    });
  });

  it("maps commits with first line of message as title", () => {
    const items = parseGithubRepo({ owner: "vercel", repo: "next.js", releases: [], commits });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("vercel/next.js — fix(router): handle X");
    expect(items[0].url).toBe("https://github.com/vercel/next.js/commit/abc123");
  });

  it("returns [] when both lists are empty", () => {
    expect(parseGithubRepo({ owner: "o", repo: "r", releases: [], commits: [] })).toEqual([]);
  });
});
