import * as cheerio from "cheerio";
import type { ParsedItem } from "@/src/domain/sources/types";

export function parseGithubTrending(html: string): ParsedItem[] {
  const $ = cheerio.load(html);
  const out: ParsedItem[] = [];
  $("article.Box-row").each((_, el) => {
    const href = $(el).find("h2 a").attr("href")?.trim();
    if (!href) return;
    const slug = href.replace(/^\//, "");
    const title = slug.replace(/\s+/g, "");
    if (!title.includes("/")) return;
    const desc = $(el).find("p.col-9").text().trim();
    out.push({
      url: `https://github.com${href}`,
      title,
      excerpt: desc || undefined,
    });
  });
  return out;
}
