import {
  type AddSubscriptionInput,
  addSubscriptionInputSchema,
} from "@/src/domain/sources/schemas";
import { prisma } from "@/src/infra/prisma";

const STALE_AFTER_MS = 30 * 60 * 1000;

export async function findStaleSourceIds(now: Date = new Date()): Promise<string[]> {
  const threshold = new Date(now.getTime() - STALE_AFTER_MS);
  const rows = await prisma.source.findMany({
    where: {
      subscriptions: { some: {} },
      OR: [
        { fetchState: null },
        { fetchState: { lastFetchedAt: null } },
        { fetchState: { lastFetchedAt: { lt: threshold } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

function defaultDisplayName(kind: string, key: string): string {
  switch (kind) {
    case "rss":
      return new URL(key).hostname;
    case "hn_top":
      return "Hacker News — Top";
    case "reddit_subreddit":
      return `r/${key}`;
    case "github_trending_lang":
      return `GitHub Trending — ${key}`;
    case "github_repo":
      return key;
    default:
      return key;
  }
}

export async function addSubscription(userId: string, raw: AddSubscriptionInput) {
  const parsed = addSubscriptionInputSchema.parse(raw);
  const source = await prisma.source.upsert({
    where: { kind_key: { kind: parsed.kind, key: parsed.key } },
    create: {
      kind: parsed.kind,
      key: parsed.key,
      displayName: defaultDisplayName(parsed.kind, parsed.key),
    },
    update: {},
  });
  const sub = await prisma.subscription.upsert({
    where: { userId_sourceId: { userId, sourceId: source.id } },
    create: { userId, sourceId: source.id },
    update: {},
  });
  return { id: sub.id, sourceId: source.id };
}

export async function listForUser(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    include: { source: { include: { fetchState: true } } },
    orderBy: { addedAt: "desc" },
  });
}

export async function removeSubscription(userId: string, subscriptionId: string) {
  const r = await prisma.subscription.deleteMany({
    where: { id: subscriptionId, userId },
  });
  if (r.count === 0) throw new Error("subscription not found or not owned by user");
  return { id: subscriptionId };
}
