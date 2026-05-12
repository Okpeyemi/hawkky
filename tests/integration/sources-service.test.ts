import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/src/infra/prisma";
import { addSubscription, listForUser, removeSubscription } from "@/src/server/sources-service";

async function makeUser() {
  return prisma.user.create({ data: { email: `u-${crypto.randomUUID()}@test.local` } });
}

describe("sources-service multi-tenancy", () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    userA = (await makeUser()).id;
    userB = (await makeUser()).id;
  });

  afterEach(async () => {
    await prisma.subscription.deleteMany({ where: { OR: [{ userId: userA }, { userId: userB }] } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.source.deleteMany({ where: { subscriptions: { none: {} } } });
  });

  it("addSubscription creates a Source on first add and reuses it on second", async () => {
    const r1 = await addSubscription(userA, { kind: "rss", key: "https://example.com/feed.xml" });
    const r2 = await addSubscription(userB, { kind: "rss", key: "https://example.com/feed.xml" });
    expect(r1.sourceId).toBe(r2.sourceId);
    const sources = await prisma.source.count();
    expect(sources).toBeGreaterThanOrEqual(1);
  });

  it("listForUser returns only own subscriptions", async () => {
    await addSubscription(userA, { kind: "rss", key: "https://a.com/feed" });
    await addSubscription(userB, { kind: "rss", key: "https://b.com/feed" });
    const a = await listForUser(userA);
    const b = await listForUser(userB);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].source.key).toBe("https://a.com/feed");
    expect(b[0].source.key).toBe("https://b.com/feed");
  });

  it("removeSubscription scoped: user A cannot delete user B's subscription", async () => {
    const sub = await addSubscription(userB, { kind: "rss", key: "https://b.com/feed" });
    await expect(removeSubscription(userA, sub.id)).rejects.toThrow();
    const stillThere = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(stillThere).not.toBeNull();
  });

  it("addSubscription is idempotent for same (user, source)", async () => {
    const a = await addSubscription(userA, { kind: "rss", key: "https://x.com/feed" });
    const b = await addSubscription(userA, { kind: "rss", key: "https://x.com/feed" });
    expect(a.id).toBe(b.id);
  });

  it("rejects invalid subreddit key", async () => {
    await expect(
      addSubscription(userA, { kind: "reddit_subreddit", key: "bad name!" } as never),
    ).rejects.toThrow();
  });
});
