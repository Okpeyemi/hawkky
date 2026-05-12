import { request } from "undici";
import { assertSafeUrl } from "@/src/infra/ssrf";

export type FetchResult =
  | { status: "ok"; body: string; etag: string | null; lastModified: string | null }
  | { status: "not_modified" }
  | { status: "error"; error: string };

export interface FetchOptions {
  etag?: string | null;
  lastModified?: string | null;
  /** When true, skip the SSRF guard (use only for trusted hosts like api.github.com). */
  trustedHost?: boolean;
  /** Hard timeout in ms (default 15s). */
  timeoutMs?: number;
  /** Max body size in bytes (default 4 MiB). */
  maxBytes?: number;
}

export async function safeFetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  if (!opts.trustedHost) await assertSafeUrl(url);

  const headers: Record<string, string> = {
    "User-Agent": "Hawkky/0.2 (+https://hawkky.app)",
    Accept: "*/*",
  };
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 4 * 1024 * 1024;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await request(url, {
      method: "GET",
      headers,
      maxRedirections: 3,
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (res.statusCode === 304) return { status: "not_modified" };
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return { status: "error", error: `HTTP ${res.statusCode}` };
    }

    const body = await res.body.text();
    if (Buffer.byteLength(body, "utf-8") > maxBytes) {
      return { status: "error", error: `body exceeds ${maxBytes} bytes` };
    }
    const etag = pickHeader(res.headers, "etag");
    const lastModified = pickHeader(res.headers, "last-modified");
    return { status: "ok", body, etag, lastModified };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

function pickHeader(h: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = h[key] ?? h[key.toLowerCase()];
  if (!v) return null;
  return Array.isArray(v) ? v[0] : v;
}
