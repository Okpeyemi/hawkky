import type { ParsedItem } from "@/src/domain/sources/types";

export interface GhRelease {
  id: number;
  name?: string;
  tag_name?: string;
  html_url: string;
  body?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface GhCommit {
  sha: string;
  html_url: string;
  commit?: { message?: string; author?: { date?: string } };
}

export interface GhRepoInput {
  owner: string;
  repo: string;
  releases: GhRelease[];
  commits: GhCommit[];
}

export function parseGithubRepo(input: GhRepoInput): ParsedItem[] {
  const slug = `${input.owner}/${input.repo}`;
  const out: ParsedItem[] = [];

  for (const r of input.releases) {
    if (r.draft || r.prerelease) continue;
    const tag = r.tag_name ?? r.name ?? `release-${r.id}`;
    out.push({
      url: r.html_url,
      title: `${slug} — release ${tag}`,
      excerpt: r.body?.split("\n").slice(0, 3).join(" ").slice(0, 280),
      publishedAt: r.published_at ? new Date(r.published_at) : undefined,
    });
  }

  for (const c of input.commits) {
    const firstLine = c.commit?.message?.split("\n")[0]?.trim();
    if (!firstLine) continue;
    out.push({
      url: c.html_url,
      title: `${slug} — ${firstLine}`,
      publishedAt: c.commit?.author?.date ? new Date(c.commit.author.date) : undefined,
    });
  }

  return out;
}
