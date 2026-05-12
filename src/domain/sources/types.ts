import type { SourceKind } from "@/generated/prisma";

export type { SourceKind };

export interface ParsedItem {
  /** Public URL of the item (will be canonicalized later). */
  url: string;
  title: string;
  excerpt?: string;
  content?: string;
  publishedAt?: Date;
}

export interface ParserContext {
  sourceId: string;
  kind: SourceKind;
  key: string;
}
