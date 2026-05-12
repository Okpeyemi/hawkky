import type { ParsedItem } from "@/src/domain/sources/types";
import { canonicalizeUrl, urlHash } from "@/src/domain/sources/url";
import { prisma } from "@/src/infra/prisma";

export interface UpsertOutcome {
  inserted: number;
  skipped: number;
}

export async function upsertItems(parsed: ParsedItem[], sourceId: string): Promise<UpsertOutcome> {
  let inserted = 0;
  let skipped = 0;
  for (const p of parsed) {
    let canonical: string;
    try {
      canonical = canonicalizeUrl(p.url);
    } catch {
      skipped += 1;
      continue;
    }
    const hash = urlHash(canonical);
    const existing = await prisma.item.findUnique({ where: { hash }, select: { id: true } });
    if (existing) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.item.create({
        data: {
          sourceId,
          urlCanonical: canonical,
          hash,
          title: p.title.slice(0, 500),
          excerpt: p.excerpt?.slice(0, 1000),
          content: p.content?.slice(0, 10_000),
          publishedAt: p.publishedAt,
        },
      });
      inserted += 1;
    } catch {
      // race: another concurrent ingest just inserted this hash
      skipped += 1;
    }
  }
  return { inserted, skipped };
}
