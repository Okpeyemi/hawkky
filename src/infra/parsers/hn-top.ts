import type { ParsedItem } from "@/src/domain/sources/types";

export interface HnStory {
  id: number;
  type?: string;
  title?: string;
  url?: string;
  time?: number;
  dead?: boolean;
  deleted?: boolean;
  text?: string;
}

export function parseHnTop(stories: HnStory[]): ParsedItem[] {
  return stories
    .filter((s) => s.type === "story" && !s.dead && !s.deleted && s.title)
    .map((s) => ({
      url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
      title: s.title as string,
      excerpt: s.text,
      publishedAt: s.time ? new Date(s.time * 1000) : undefined,
    }));
}
