import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/src/infra/prisma";
import { upsertItems } from "@/src/server/items-service";

async function makeSource() {
  return prisma.source.create({
    data: { kind: "rss", key: `https://example.com/${crypto.randomUUID()}`, displayName: "Ex" },
  });
}

describe("upsertItems", () => {
  let sourceId: string;
  beforeEach(async () => {
    const s = await makeSource();
    sourceId = s.id;
  });
  afterEach(async () => {
    await prisma.item.deleteMany({ where: { sourceId } });
    await prisma.source.delete({ where: { id: sourceId } });
  });

  it("inserts new items and dedupes by hash on rerun", async () => {
    const parsed = [
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/b", title: "B" },
    ];
    const first = await upsertItems(parsed, sourceId);
    expect(first.inserted).toBe(2);
    const second = await upsertItems(parsed, sourceId);
    expect(second.inserted).toBe(0);
    const all = await prisma.item.count({ where: { sourceId } });
    expect(all).toBe(2);
  });

  it("treats tracking-paramed URL as the same item", async () => {
    await upsertItems([{ url: "https://example.com/x", title: "X" }], sourceId);
    const out = await upsertItems(
      [{ url: "https://example.com/x?utm_source=hn", title: "X (dup)" }],
      sourceId,
    );
    expect(out.inserted).toBe(0);
  });
});
