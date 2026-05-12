import type { ParsedItem } from "@/src/domain/sources/types";

interface RedditPost {
  id: string;
  title: string;
  url?: string;
  permalink: string;
  created_utc?: number;
  over_18?: boolean;
  stickied?: boolean;
  is_self?: boolean;
  selftext?: string;
}

interface RedditListing {
  data?: { children?: Array<{ data?: RedditPost }> };
}

export function parseReddit(listing: RedditListing): ParsedItem[] {
  const children = listing?.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter((p): p is RedditPost => !!p && !!p.id && !!p.title)
    .filter((p) => !p.over_18 && !p.stickied)
    .map((p) => ({
      url: p.is_self || !p.url ? `https://www.reddit.com${p.permalink}` : p.url,
      title: p.title,
      excerpt: p.selftext || undefined,
      publishedAt: p.created_utc ? new Date(p.created_utc * 1000) : undefined,
    }));
}
