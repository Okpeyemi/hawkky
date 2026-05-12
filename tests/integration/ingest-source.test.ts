import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/infra/prisma";

vi.mock("@/src/infra/parsers/registry", () => ({
  drivers: {
    rss: vi.fn(async () => ({
      items: [{ url: "https://example.com/a", title: "A" }],
      etag: '"v1"',
      lastModified: null,
      notModified: false,
    })),
    hn_top: vi.fn(),
    reddit_subreddit: vi.fn(),
    github_trending_lang: vi.fn(),
    github_repo: vi.fn(),
  },
}));

import { runIngestSource } from "@/src/inngest/functions/ingest-source";

describe("runIngestSource", () => {
  let sourceId: string;
  beforeEach(async () => {
    const s = await prisma.source.create({
      data: { kind: "rss", key: `https://example.com/${crypto.randomUUID()}`, displayName: "Ex" },
    });
    sourceId = s.id;
  });
  afterEach(async () => {
    await prisma.item.deleteMany({ where: { sourceId } });
    await prisma.sourceFetch.deleteMany({ where: { sourceId } });
    await prisma.source.delete({ where: { id: sourceId } });
  });

  it("inserts items and writes SourceFetch on success", async () => {
    const out = await runIngestSource(sourceId);
    expect(out.inserted).toBe(1);
    const fetchRow = await prisma.sourceFetch.findUnique({ where: { sourceId } });
    expect(fetchRow?.etag).toBe('"v1"');
    expect(fetchRow?.lastError).toBeNull();
    expect(fetchRow?.lastSuccessAt).toBeInstanceOf(Date);
  });
});
