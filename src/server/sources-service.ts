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
