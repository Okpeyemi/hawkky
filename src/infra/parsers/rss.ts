import { XMLParser } from "fast-xml-parser";
import type { ParsedItem } from "@/src/domain/sources/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
});

interface Raw {
  rss?: { channel?: { item?: unknown } };
  feed?: { entry?: unknown };
}

export function parseRss(xml: string): ParsedItem[] {
  let parsed: Raw;
  try {
    parsed = parser.parse(xml) as Raw;
  } catch {
    return [];
  }

  if (parsed.rss?.channel?.item) {
    return toArray(parsed.rss.channel.item).map(rssItem).filter(isItem);
  }
  if (parsed.feed?.entry) {
    return toArray(parsed.feed.entry).map(atomItem).filter(isItem);
  }
  return [];
}

function toArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

function isItem(x: ParsedItem | null): x is ParsedItem {
  return x !== null;
}

function rssItem(raw: unknown): ParsedItem | null {
  const r = raw as { title?: string; link?: string; description?: string; pubDate?: string };
  if (!r.link || !r.title) return null;
  return {
    url: r.link,
    title: r.title,
    excerpt: r.description,
    publishedAt: r.pubDate ? safeDate(r.pubDate) : undefined,
  };
}

function atomItem(raw: unknown): ParsedItem | null {
  const r = raw as {
    title?: string;
    link?: { "@href"?: string } | { "@href"?: string }[];
    summary?: string;
    updated?: string;
    published?: string;
  };
  const link = Array.isArray(r.link) ? r.link[0]?.["@href"] : r.link?.["@href"];
  if (!link || !r.title) return null;
  return {
    url: link,
    title: r.title,
    excerpt: r.summary,
    publishedAt: safeDate(r.published ?? r.updated ?? ""),
  };
}

function safeDate(s: string): Date | undefined {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
