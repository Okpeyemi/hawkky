import type { Source } from "@/generated/prisma";
import type { ParsedItem } from "@/src/domain/sources/types";
import { type FetchResult, safeFetch } from "@/src/infra/fetcher";
import { type GhCommit, type GhRelease, parseGithubRepo } from "@/src/infra/parsers/github-repo";
import { parseGithubTrending } from "@/src/infra/parsers/github-trending";
import { type HnStory, parseHnTop } from "@/src/infra/parsers/hn-top";
import { parseReddit } from "@/src/infra/parsers/reddit";
import { parseRss } from "@/src/infra/parsers/rss";

export interface IngestOutcome {
  items: ParsedItem[];
  etag: string | null;
  lastModified: string | null;
  notModified: boolean;
}

export interface PrevFetch {
  etag: string | null;
  lastModified: string | null;
}

type FetchAndParse = (
  source: Pick<Source, "kind" | "key">,
  prev: PrevFetch,
) => Promise<IngestOutcome | { error: string }>;

const HN_TOP_LIMIT = 30;

export const drivers: Record<Source["kind"], FetchAndParse> = {
  rss: async (s, prev) => {
    const isLocalFixture =
      process.env.NODE_ENV !== "production" &&
      !!process.env.NEXTAUTH_URL &&
      s.key.startsWith(process.env.NEXTAUTH_URL);
    const r = await safeFetch(s.key, { ...prev, trustedHost: isLocalFixture });
    return toOutcome(r, parseRss);
  },

  hn_top: async () => {
    const top = await safeFetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
      trustedHost: true,
    });
    if (top.status !== "ok") return { error: top.status === "error" ? top.error : "no-body" };
    const ids = (JSON.parse(top.body) as number[]).slice(0, HN_TOP_LIMIT);
    const stories = await Promise.all(
      ids.map(async (id) => {
        const r = await safeFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          trustedHost: true,
        });
        return r.status === "ok" ? (JSON.parse(r.body) as HnStory) : null;
      }),
    );
    return {
      items: parseHnTop(stories.filter((s): s is HnStory => !!s)),
      etag: null,
      lastModified: null,
      notModified: false,
    };
  },

  reddit_subreddit: async (s, prev) => {
    const url = `https://www.reddit.com/r/${s.key}/top.json?t=day&limit=25`;
    const r = await safeFetch(url, { ...prev, trustedHost: true });
    if (r.status === "not_modified")
      return { items: [], etag: prev.etag, lastModified: prev.lastModified, notModified: true };
    if (r.status === "error") return { error: r.error };
    return {
      items: parseReddit(JSON.parse(r.body)),
      etag: r.etag,
      lastModified: r.lastModified,
      notModified: false,
    };
  },

  github_trending_lang: async (s) => {
    const url = `https://github.com/trending/${encodeURIComponent(s.key)}?since=daily`;
    const r = await safeFetch(url, { trustedHost: true });
    if (r.status !== "ok") return { error: r.status === "error" ? r.error : "no-body" };
    return {
      items: parseGithubTrending(r.body),
      etag: null,
      lastModified: null,
      notModified: false,
    };
  },

  github_repo: async (s) => {
    const [owner, repo] = s.key.split("/");
    if (!owner || !repo) return { error: "bad key (expected owner/name)" };
    const [rel, com] = await Promise.all([
      safeFetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
        trustedHost: true,
      }),
      safeFetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`, {
        trustedHost: true,
      }),
    ]);
    if (rel.status !== "ok" || com.status !== "ok") {
      return { error: "github api failed" };
    }
    return {
      items: parseGithubRepo({
        owner,
        repo,
        releases: JSON.parse(rel.body) as GhRelease[],
        commits: JSON.parse(com.body) as GhCommit[],
      }),
      etag: null,
      lastModified: null,
      notModified: false,
    };
  },
};

function toOutcome(
  r: FetchResult,
  parser: (body: string) => ParsedItem[],
): IngestOutcome | { error: string } {
  if (r.status === "not_modified")
    return { items: [], etag: null, lastModified: null, notModified: true };
  if (r.status === "error") return { error: r.error };
  return { items: parser(r.body), etag: r.etag, lastModified: r.lastModified, notModified: false };
}
