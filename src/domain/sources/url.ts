import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "yclid",
  "ref",
  "ref_src",
  "ref_url",
]);

export function canonicalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  u.protocol = u.protocol.toLowerCase();

  if (
    (u.protocol === "https:" && u.port === "443") ||
    (u.protocol === "http:" && u.port === "80")
  ) {
    u.port = "";
  }

  const entries = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()) && !k.toLowerCase().startsWith("utm_"))
    .sort(([a], [b]) => a.localeCompare(b));

  u.search = "";
  for (const [k, v] of entries) u.searchParams.append(k, v);

  let out = u.toString();
  if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
  if (u.pathname === "/" && !u.search) out = out.replace(/\/$/, "");
  return out;
}

export function urlHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
