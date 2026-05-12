import { drivers } from "@/src/infra/parsers/registry";
import { prisma } from "@/src/infra/prisma";
import { inngest } from "@/src/inngest/client";
import { upsertItems } from "@/src/server/items-service";

/**
 * Pure async helper, easy to call from tests without the Inngest runtime.
 */
export async function runIngestSource(
  sourceId: string,
): Promise<{ inserted: number; notModified: boolean }> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: { fetchState: true },
  });
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const driver = drivers[source.kind];
  const prev = {
    etag: source.fetchState?.etag ?? null,
    lastModified: source.fetchState?.lastModified ?? null,
  };

  const r = await driver({ kind: source.kind, key: source.key }, prev);

  if ("error" in r) {
    await prisma.sourceFetch.upsert({
      where: { sourceId },
      create: { sourceId, lastFetchedAt: new Date(), lastError: r.error },
      update: { lastFetchedAt: new Date(), lastError: r.error },
    });
    return { inserted: 0, notModified: false };
  }

  let inserted = 0;
  if (!r.notModified) {
    const u = await upsertItems(r.items, sourceId);
    inserted = u.inserted;
  }
  await prisma.sourceFetch.upsert({
    where: { sourceId },
    create: {
      sourceId,
      lastFetchedAt: new Date(),
      lastSuccessAt: new Date(),
      etag: r.etag,
      lastModified: r.lastModified,
      lastError: null,
    },
    update: {
      lastFetchedAt: new Date(),
      lastSuccessAt: new Date(),
      etag: r.etag,
      lastModified: r.lastModified,
      lastError: null,
    },
  });
  return { inserted, notModified: r.notModified };
}

export const ingestSource = inngest.createFunction(
  {
    id: "ingest-source",
    triggers: [{ event: "source.ingest.requested" }],
    concurrency: { key: "event.data.sourceId", limit: 1 },
    retries: 3,
  },
  async ({ event, step }) => {
    const data = event.data as { sourceId: string };
    return step.run("fetch-parse-upsert", () => runIngestSource(data.sourceId));
  },
);
