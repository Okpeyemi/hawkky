# Hawkky — Plan 2 — Pipeline d'ingestion (Sources / Items / Inngest / Parsers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le pipeline d'ingestion de contenu : modèle `Source` / `Subscription` / `Item` / `SourceFetch`, parsers par `kind` (RSS, HN top, Reddit subreddit, GitHub trending, GitHub repo), orchestration Inngest (`hourly-tick` + `ingest-source`), UI `/sources` (lister + ajouter + état de fetch), et bouton onboarding « Connecter GitHub pour scanner mon stack ».

**Architecture :**
- Une `Source` est globale et dédupée sur `(kind, key)`. Un `Subscription(userId, sourceId)` matérialise l'abonnement d'un user. Les `Item` sont globaux, dédupés sur un hash sha256 de l'URL canonique. `SourceFetch` stocke `etag` / `lastModified` / `lastFetchedAt` / `lastError` pour appliquer un fetch conditionnel.
- Les parsers vivent dans `src/infra/parsers/<kind>.ts`, exposent une signature unique `parse(rawBody, source) -> ParsedItem[]`. Un fetcher générique `src/infra/fetcher.ts` applique ETag/If-Modified-Since et passe par un **SSRF guard** (résolution DNS + reject des IP privées) sur les URLs user-provided (RSS).
- L'orchestration utilise **Inngest** : `hourly-tick` (cron `*/15 * * * *`) trouve les sources stales et fan-out via `step.sendEvent`. `ingest-source` (event-driven, idempotent par `sourceId` via `step.run`) fetch + parse + upsert items + met à jour `SourceFetch`.
- L'UI `/sources` est server-rendered (RSC) avec server actions pour `add` / `remove`, scoped par `forUser()`. Le bouton onboarding « Connecter GitHub » étend le scope OAuth GitHub à `public_repo`, lit `/user/repos`, agrège langages dominants → propose des `stackTags` éditables.

**Tech Stack :**
- Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- Prisma 7 + Neon adapter (Postgres)
- Inngest (`inngest` + `inngest/next` adapter)
- `fast-xml-parser` (RSS), `cheerio` (GitHub trending HTML), `undici` (HTTP fetch sécurisé)
- Zod 4 (validation des entrées), Vitest 4 (unit + integration), Playwright (E2E)

---

## File Structure

### À créer

```
prisma/
  schema.prisma                                 # MODIF: + Source, Subscription, Item, SourceFetch, enum SourceKind
  migrations/<ts>_add_ingestion_models/         # nouvelle migration

src/
  domain/
    sources/
      types.ts                                   # SourceKind, ParsedItem, FetchOutcome
      schemas.ts                                 # Zod schemas pour add-subscription
      url.ts                                     # canonicalizeUrl(), urlHash()
  infra/
    fetcher.ts                                   # safeFetch() avec ETag + SSRF guard
    ssrf.ts                                      # isSafeHost(), resolveAndCheck()
    parsers/
      rss.ts                                     # parseRssFeed(body, source) -> ParsedItem[]
      hn-top.ts                                  # parseHnTop(jsonStories) — appelle API HN
      reddit.ts                                  # parseRedditSubreddit(jsonListing, source)
      github-trending.ts                         # parseGithubTrending(html, source)
      github-repo.ts                             # parseGithubRepo(eventsOrReleases, source)
      registry.ts                                # MAP { kind -> { fetch, parse } }
  server/
    sources-service.ts                           # listForUser, addSubscription, removeSubscription, findStaleSources
    items-service.ts                             # upsertItems(parsed[], sourceId)
    github-link-service.ts                       # linkGithubForStack(): échange code, scope élargi, encrypt, scan repos
  inngest/
    client.ts                                    # new Inngest({ id: "hawkky" })
    functions/
      hourly-tick.ts                             # cron, fan-out via step.sendEvent("source.ingest.requested")
      ingest-source.ts                           # event "source.ingest.requested", fetch + parse + upsert
      index.ts                                   # export array of functions

app/
  (app)/
    sources/
      page.tsx                                   # MODIF: liste + état de fetch
      actions.ts                                 # server actions: addSubscription, removeSubscription
      add-source-dialog.tsx                      # client component (modal shadcn)
      source-row.tsx                             # client component (suppression)
  api/
    inngest/
      route.ts                                   # serve(inngest, functions) pour GET/POST/PUT

  (app)/onboarding/github-callback/page.tsx       # callback après OAuth GitHub scope élargi
src/ui/onboarding/Step3DevStack.tsx               # MODIF: bouton "Connecter GitHub"
src/ui/onboarding/github-scan-result.tsx          # affichage langages détectés + édition stackTags

tests/
  unit/
    url.test.ts                                  # canonicalize + hash
    ssrf.test.ts                                 # isSafeHost
    parsers/
      rss.test.ts
      hn-top.test.ts
      reddit.test.ts
      github-trending.test.ts
      github-repo.test.ts
  integration/
    sources-service.test.ts                      # multi-tenancy sur Subscription
    items-service.test.ts                        # dedup hash
    ingest-source.test.ts                        # fetcher mocké, e2e d'une fonction Inngest
  e2e/
    sources-flow.spec.ts                         # ajouter une RSS, voir l'état de fetch

.github/workflows/
  ci.yml                                          # MODIF: + secrets Inngest si nécessaire

.env.example                                      # MODIF: + INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
```

### Modifications de fichiers existants

- `src/env.ts` — ajouter `INNGEST_EVENT_KEY` (optionnel en dev), `INNGEST_SIGNING_KEY` (optionnel en dev).
- `prisma/schema.prisma` — extension du schéma (cf. Task 1).
- `app/(app)/sources/page.tsx` — passage du placeholder à la vraie page.
- `src/ui/onboarding/Step3DevStack.tsx` — ajout du bouton « Connecter GitHub ».
- `package.json` — ajout deps `inngest`, `fast-xml-parser`, `cheerio`, `undici`.

---

## Pré-requis et hypothèses

- Plan 1 (`hawkky-v0.1.0-foundation`) terminé : Auth.js v5, Profile, multi-tenancy `forUser()`, crypto AES-GCM, Resend.
- Auth.js GitHub provider configuré avec `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`. Pour le scope élargi (`public_repo`), on n'utilise **pas** le flow Auth.js : on déclenche un mini OAuth manuel vers `https://github.com/login/oauth/authorize` avec `scope=read:user public_repo` et un `state` HMAC signé, puis on échange le code côté serveur.
- Pas d'Anthropic dans ce plan. Les items sont juste persistés ; le scoring/synthèse est Plan 3.
- Pas d'envoi WhatsApp / pas de RedirectLink dans ce plan (Plan 3 pour `/r/[id]`, Plan 4 pour WhatsApp).
- Pas de fonction `user-briefing` Inngest dans ce plan — elle dépend de Claude (Plan 3).

---

## Task 1 : Schéma DB — `Source`, `Subscription`, `Item`, `SourceFetch`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_ingestion_models/migration.sql` (généré par Prisma)

- [ ] **Step 1 : Ajouter l'enum `SourceKind` et les 4 modèles à `prisma/schema.prisma`**

Append à la fin du fichier `prisma/schema.prisma` (après le modèle `Profile`) :

```prisma
// ────────────────────────────── Ingestion ──────────────────────────────

enum SourceKind {
  rss
  hn_top
  reddit_subreddit
  github_trending_lang
  github_repo
}

model Source {
  id          String     @id @default(cuid())
  kind        SourceKind
  key         String     @db.Text
  displayName String

  addedAt DateTime @default(now())

  subscriptions Subscription[]
  items         Item[]
  fetchState    SourceFetch?

  @@unique([kind, key])
  @@index([kind])
}

model Subscription {
  id       String   @id @default(cuid())
  userId   String
  sourceId String
  addedAt  DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@unique([userId, sourceId])
  @@index([userId])
  @@index([sourceId])
}

model Item {
  id           String    @id @default(cuid())
  sourceId     String
  urlCanonical String    @db.Text
  hash         String    @unique
  title        String    @db.Text
  excerpt      String?   @db.Text
  content      String?   @db.Text
  publishedAt  DateTime?
  fetchedAt    DateTime  @default(now())

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@index([sourceId, fetchedAt(sort: Desc)])
  @@index([publishedAt(sort: Desc)])
}

model SourceFetch {
  sourceId      String    @id
  lastFetchedAt DateTime?
  lastSuccessAt DateTime?
  lastError     String?   @db.Text
  etag          String?
  lastModified  String?

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2 : Ajouter la back-relation `subscriptions Subscription[]` sur `User`**

Dans le modèle `User` existant, ajouter une ligne au niveau des relations :

```prisma
model User {
  // ... champs existants ...

  accounts      Account[]
  sessions      Session[]
  profile       Profile?
  subscriptions Subscription[]   // ← AJOUT

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3 : Générer la migration**

```bash
pnpm exec prisma migrate dev --name add_ingestion_models
```

Vérifier que `prisma/migrations/<ts>_add_ingestion_models/migration.sql` est créé.

- [ ] **Step 4 : Vérifier la génération du client Prisma**

```bash
pnpm exec prisma generate
pnpm typecheck
```

Doit passer. Si non, lire l'erreur et corriger le schéma.

- [ ] **Step 5 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): Source/Subscription/Item/SourceFetch models (Plan 2 task 1)"
```

---

## Task 2 : URL canonical + hash sha256 (TDD)

**Files:**
- Create: `src/domain/sources/url.ts`
- Test: `tests/unit/url.test.ts`

But : produire une URL « canonique » (lowercase host, strip trailing slash, retirer fragments + paramètres de tracking `utm_*` / `gclid` / `fbclid`) et son hash sha256 hex. Sert de clé de dedup inter-sources.

- [ ] **Step 1 : Tests d'abord**

Créer `tests/unit/url.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { canonicalizeUrl, urlHash } from "@/src/domain/sources/url";

describe("canonicalizeUrl", () => {
  it("lowercases host and scheme, strips trailing slash and fragment", () => {
    expect(canonicalizeUrl("HTTPS://Example.COM/Path/#frag")).toBe("https://example.com/Path");
  });

  it("strips utm_ and tracking params", () => {
    const out = canonicalizeUrl(
      "https://example.com/a?utm_source=hn&utm_medium=x&id=42&gclid=abc&fbclid=xyz",
    );
    expect(out).toBe("https://example.com/a?id=42");
  });

  it("keeps non-tracking query params and sorts them", () => {
    expect(canonicalizeUrl("https://example.com/a?b=2&a=1")).toBe(
      "https://example.com/a?a=1&b=2",
    );
  });

  it("normalizes default port", () => {
    expect(canonicalizeUrl("https://example.com:443/x")).toBe("https://example.com/x");
    expect(canonicalizeUrl("http://example.com:80/x")).toBe("http://example.com/x");
  });

  it("throws on invalid URL", () => {
    expect(() => canonicalizeUrl("not a url")).toThrow();
  });
});

describe("urlHash", () => {
  it("is stable for the same input", () => {
    expect(urlHash("https://example.com/a")).toBe(urlHash("https://example.com/a"));
  });

  it("differs for different inputs", () => {
    expect(urlHash("https://example.com/a")).not.toBe(urlHash("https://example.com/b"));
  });

  it("returns 64 hex chars (sha256)", () => {
    expect(urlHash("https://example.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2 : Vérifier qu'ils échouent**

```bash
pnpm test tests/unit/url.test.ts
```

Attendu : 7 fails avec « Cannot find module '@/src/domain/sources/url' ».

- [ ] **Step 3 : Implémentation minimale**

Créer `src/domain/sources/url.ts` :

```ts
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
pnpm test tests/unit/url.test.ts
```

Attendu : 7 pass.

- [ ] **Step 5 : Commit**

```bash
git add src/domain/sources/url.ts tests/unit/url.test.ts
git commit -m "feat(domain): canonicalizeUrl + sha256 urlHash with TDD (Plan 2 task 2)"
```

---

## Task 3 : SSRF guard (TDD)

**Files:**
- Create: `src/infra/ssrf.ts`
- Test: `tests/unit/ssrf.test.ts`

But : empêcher qu'un user ajoute une URL RSS pointant vers `127.0.0.1`, `169.254.169.254` (metadata cloud AWS/GCP), `10.0.0.0/8`, etc. On résout le hostname en IP et on reject toutes les plages privées / loopback / link-local.

- [ ] **Step 1 : Tests d'abord**

Créer `tests/unit/ssrf.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { isPrivateIp, assertSafeUrl } from "@/src/infra/ssrf";

describe("isPrivateIp", () => {
  it("flags loopback v4", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.255.255.255")).toBe(true);
  });

  it("flags RFC1918 ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("flags link-local and cloud metadata", () => {
    expect(isPrivateIp("169.254.169.254")).toBe(true);
  });

  it("flags loopback v6 and unique-local v6", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
  });

  it("does not flag public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow(/scheme/i);
    await expect(assertSafeUrl("gopher://example.com/")).rejects.toThrow(/scheme/i);
  });

  it("rejects localhost host literal", async () => {
    await expect(assertSafeUrl("http://localhost/x")).rejects.toThrow();
    await expect(assertSafeUrl("http://127.0.0.1/x")).rejects.toThrow();
  });

  it("accepts a clearly public host", async () => {
    await expect(assertSafeUrl("https://cloudflare.com/")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
pnpm test tests/unit/ssrf.test.ts
```

- [ ] **Step 3 : Implémentation**

Créer `src/infra/ssrf.ts` :

```ts
import { promises as dns } from "node:dns";
import { isIP } from "node:net";

const V4_PRIVATE_RANGES: Array<[number, number]> = [
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")],
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")],
];

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipToInt(ip);
    return V4_PRIVATE_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
  }
  if (version === 6) {
    const norm = ip.toLowerCase();
    if (norm === "::1" || norm === "::") return true;
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique-local fc00::/7
    if (norm.startsWith("fe80:")) return true; // link-local
    if (norm.startsWith("::ffff:")) {
      const v4 = norm.slice("::ffff:".length);
      if (isIP(v4) === 4) return isPrivateIp(v4);
    }
    return false;
  }
  return false;
}

export async function assertSafeUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Disallowed scheme: ${u.protocol}`);
  }
  if (u.hostname === "localhost") throw new Error("Disallowed host: localhost");
  if (isIP(u.hostname)) {
    if (isPrivateIp(u.hostname)) throw new Error(`Disallowed IP: ${u.hostname}`);
    return;
  }
  const resolved = await dns.lookup(u.hostname, { all: true });
  for (const r of resolved) {
    if (isPrivateIp(r.address)) {
      throw new Error(`Host ${u.hostname} resolves to private IP ${r.address}`);
    }
  }
}
```

- [ ] **Step 4 : Vérifier les tests**

```bash
pnpm test tests/unit/ssrf.test.ts
```

Attendu : tous pass. Le test « accepte cloudflare.com » fait un vrai DNS lookup ; en CI offline il échouera — si c'est le cas, **mocker** `node:dns` dans le test ou marquer le test `it.skipIf(process.env.CI === "true")`. Préférer le mock pour rester déterministe :

```ts
import { vi } from "vitest";

vi.mock("node:dns", () => ({
  promises: {
    lookup: vi.fn(async (host: string) => {
      if (host === "cloudflare.com") return [{ address: "1.1.1.1", family: 4 }];
      throw new Error("ENOTFOUND");
    }),
  },
}));
```

Réintroduire ce mock en tête du fichier `ssrf.test.ts` si nécessaire.

- [ ] **Step 5 : Commit**

```bash
git add src/infra/ssrf.ts tests/unit/ssrf.test.ts
git commit -m "feat(infra): SSRF guard with private IP detection (Plan 2 task 3)"
```

---

## Task 4 : HTTP fetcher générique avec ETag/If-Modified-Since

**Files:**
- Create: `src/infra/fetcher.ts`
- Test: `tests/unit/fetcher.test.ts`

But : un fetcher qui (a) applique le SSRF guard sur les URLs user-provided, (b) envoie `If-None-Match` et `If-Modified-Since` à partir de `SourceFetch`, (c) renvoie un résultat structuré : `{ status: "ok", body, etag, lastModified } | { status: "not_modified" } | { status: "error", error }`. Timeout strict, taille max.

- [ ] **Step 1 : Installer `undici`**

```bash
pnpm add undici
```

- [ ] **Step 2 : Tests d'abord**

Créer `tests/unit/fetcher.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeFetch } from "@/src/infra/fetcher";

const mockRequest = vi.hoisted(() => vi.fn());

vi.mock("undici", () => ({
  request: mockRequest,
}));

vi.mock("@/src/infra/ssrf", () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
}));

describe("safeFetch", () => {
  beforeEach(() => mockRequest.mockReset());

  it("returns ok with body and caching headers on 200", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: { etag: '"abc"', "last-modified": "Wed, 21 Oct 2024 07:28:00 GMT" },
      body: { text: async () => "hello" },
    });
    const r = await safeFetch("https://example.com/feed", {});
    expect(r).toEqual({
      status: "ok",
      body: "hello",
      etag: '"abc"',
      lastModified: "Wed, 21 Oct 2024 07:28:00 GMT",
    });
  });

  it("returns not_modified on 304", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 304,
      headers: {},
      body: { text: async () => "" },
    });
    const r = await safeFetch("https://example.com/feed", { etag: '"abc"' });
    expect(r).toEqual({ status: "not_modified" });
  });

  it("sends If-None-Match and If-Modified-Since when present", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: { text: async () => "x" },
    });
    await safeFetch("https://example.com/feed", {
      etag: '"abc"',
      lastModified: "Wed, 21 Oct 2024 07:28:00 GMT",
    });
    const call = mockRequest.mock.calls[0];
    expect(call[1].headers["If-None-Match"]).toBe('"abc"');
    expect(call[1].headers["If-Modified-Since"]).toBe("Wed, 21 Oct 2024 07:28:00 GMT");
  });

  it("returns error on non-2xx/304", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 500,
      headers: {},
      body: { text: async () => "" },
    });
    const r = await safeFetch("https://example.com/feed", {});
    expect(r.status).toBe("error");
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

```bash
pnpm test tests/unit/fetcher.test.ts
```

- [ ] **Step 4 : Implémentation**

Créer `src/infra/fetcher.ts` :

```ts
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
```

- [ ] **Step 5 : Vérifier les tests**

```bash
pnpm test tests/unit/fetcher.test.ts
```

Attendu : 4 pass.

- [ ] **Step 6 : Commit**

```bash
git add src/infra/fetcher.ts tests/unit/fetcher.test.ts package.json pnpm-lock.yaml
git commit -m "feat(infra): safeFetch with ETag + SSRF guard + body cap (Plan 2 task 4)"
```

---

## Task 5 : Types et parser RSS (TDD)

**Files:**
- Create: `src/domain/sources/types.ts`
- Create: `src/infra/parsers/rss.ts`
- Test: `tests/unit/parsers/rss.test.ts`

- [ ] **Step 1 : Installer `fast-xml-parser`**

```bash
pnpm add fast-xml-parser
```

- [ ] **Step 2 : Types partagés**

Créer `src/domain/sources/types.ts` :

```ts
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
```

- [ ] **Step 3 : Tests d'abord pour RSS**

Créer `tests/unit/parsers/rss.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parseRss } from "@/src/infra/parsers/rss";

const sampleFeed = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item>
      <title>Hello world</title>
      <link>https://example.com/post-1</link>
      <description>An intro paragraph</description>
      <pubDate>Mon, 12 May 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second</title>
      <link>https://example.com/post-2</link>
      <pubDate>Mon, 12 May 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const atomFeed = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom entry</title>
    <link href="https://example.com/atom-1"/>
    <summary>Atom summary</summary>
    <updated>2026-05-12T09:00:00Z</updated>
  </entry>
</feed>`;

describe("parseRss", () => {
  it("parses RSS 2.0 items", () => {
    const items = parseRss(sampleFeed);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://example.com/post-1",
      title: "Hello world",
      excerpt: "An intro paragraph",
    });
    expect(items[0].publishedAt?.toISOString()).toBe("2026-05-12T09:00:00.000Z");
  });

  it("parses Atom feeds", () => {
    const items = parseRss(atomFeed);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://example.com/atom-1",
      title: "Atom entry",
      excerpt: "Atom summary",
    });
  });

  it("returns [] on garbage", () => {
    expect(parseRss("<html>nope</html>")).toEqual([]);
  });

  it("skips items missing a link", () => {
    const broken = `<?xml version="1.0"?><rss><channel><item><title>No link</title></item></channel></rss>`;
    expect(parseRss(broken)).toEqual([]);
  });
});
```

- [ ] **Step 4 : Vérifier l'échec**

```bash
pnpm test tests/unit/parsers/rss.test.ts
```

- [ ] **Step 5 : Implémentation**

Créer `src/infra/parsers/rss.ts` :

```ts
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
```

- [ ] **Step 6 : Vérifier les tests**

```bash
pnpm test tests/unit/parsers/rss.test.ts
```

Attendu : 4 pass.

- [ ] **Step 7 : Commit**

```bash
git add src/domain/sources/types.ts src/infra/parsers/rss.ts tests/unit/parsers/rss.test.ts package.json pnpm-lock.yaml
git commit -m "feat(parsers): RSS 2.0 + Atom parser with TDD (Plan 2 task 5)"
```

---

## Task 6 : Parser Hacker News top (TDD)

**Files:**
- Create: `src/infra/parsers/hn-top.ts`
- Test: `tests/unit/parsers/hn-top.test.ts`

But : appeler `https://hacker-news.firebaseio.com/v0/topstories.json` puis hydrater les premiers 30 IDs via `/v0/item/<id>.json`. Le parser reçoit une liste d'items hydratés (le fetcher orchestre les appels HTTP).

- [ ] **Step 1 : Tests d'abord**

Créer `tests/unit/parsers/hn-top.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parseHnTop } from "@/src/infra/parsers/hn-top";

describe("parseHnTop", () => {
  it("maps story items to ParsedItem", () => {
    const stories = [
      { id: 1, type: "story", title: "Foo", url: "https://example.com/a", time: 1715500000 },
      { id: 2, type: "story", title: "Bar", url: "https://example.com/b", time: 1715600000 },
    ];
    const items = parseHnTop(stories);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ url: "https://example.com/a", title: "Foo" });
    expect(items[0].publishedAt instanceof Date).toBe(true);
  });

  it("uses HN discussion URL when item.url is missing (Ask HN)", () => {
    const stories = [{ id: 7, type: "story", title: "Ask HN: anything?", time: 1715500000 }];
    const items = parseHnTop(stories);
    expect(items[0].url).toBe("https://news.ycombinator.com/item?id=7");
  });

  it("filters non-story types and dead/deleted", () => {
    const stories = [
      { id: 1, type: "comment", title: "x", url: "https://a", time: 1 },
      { id: 2, type: "story", title: "y", url: "https://b", time: 1, dead: true },
      { id: 3, type: "story", title: "z", url: "https://c", time: 1, deleted: true },
      { id: 4, type: "story", title: "ok", url: "https://d", time: 1 },
    ];
    expect(parseHnTop(stories).map((i) => i.title)).toEqual(["ok"]);
  });

  it("returns [] on falsy input", () => {
    expect(parseHnTop([])).toEqual([]);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
pnpm test tests/unit/parsers/hn-top.test.ts
```

- [ ] **Step 3 : Implémentation**

Créer `src/infra/parsers/hn-top.ts` :

```ts
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
```

- [ ] **Step 4 : Vérifier les tests**

```bash
pnpm test tests/unit/parsers/hn-top.test.ts
```

Attendu : 4 pass.

- [ ] **Step 5 : Commit**

```bash
git add src/infra/parsers/hn-top.ts tests/unit/parsers/hn-top.test.ts
git commit -m "feat(parsers): Hacker News top stories parser (Plan 2 task 6)"
```

---

## Task 7 : Parser Reddit subreddit (TDD)

**Files:**
- Create: `src/infra/parsers/reddit.ts`
- Test: `tests/unit/parsers/reddit.test.ts`

But : Reddit JSON endpoint `https://www.reddit.com/r/<sub>/top.json?t=day&limit=25` retourne un Listing `{ data: { children: [{ data: {...} }, ...] } }`. Filtrer NSFW + stickied. URL → `https://www.reddit.com<permalink>` ou `url` externe.

- [ ] **Step 1 : Tests**

Créer `tests/unit/parsers/reddit.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parseReddit } from "@/src/infra/parsers/reddit";

const listing = {
  data: {
    children: [
      {
        data: {
          id: "1",
          title: "TypeScript 5.6",
          url: "https://example.com/ts56",
          permalink: "/r/programming/comments/1/typescript_56/",
          created_utc: 1715500000,
          over_18: false,
          stickied: false,
          selftext: "Release notes...",
        },
      },
      {
        data: {
          id: "2",
          title: "NSFW post",
          url: "https://example.com/n",
          permalink: "/r/x/comments/2/",
          created_utc: 1715500001,
          over_18: true,
          stickied: false,
        },
      },
      {
        data: {
          id: "3",
          title: "Stickied announcement",
          url: "https://example.com/s",
          permalink: "/r/x/comments/3/",
          created_utc: 1715500002,
          over_18: false,
          stickied: true,
        },
      },
    ],
  },
};

describe("parseReddit", () => {
  it("maps non-NSFW non-stickied entries", () => {
    const items = parseReddit(listing);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("TypeScript 5.6");
    expect(items[0].url).toBe("https://example.com/ts56");
    expect(items[0].excerpt).toBe("Release notes...");
  });

  it("falls back to permalink for self posts (no external url)", () => {
    const self = {
      data: {
        children: [
          {
            data: {
              id: "10",
              title: "Self only",
              url: "",
              permalink: "/r/x/comments/10/self_only/",
              created_utc: 1715500000,
              is_self: true,
            },
          },
        ],
      },
    };
    expect(parseReddit(self)[0].url).toBe("https://www.reddit.com/r/x/comments/10/self_only/");
  });

  it("returns [] when shape is broken", () => {
    expect(parseReddit({} as never)).toEqual([]);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
pnpm test tests/unit/parsers/reddit.test.ts
```

- [ ] **Step 3 : Implémentation**

Créer `src/infra/parsers/reddit.ts` :

```ts
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
```

- [ ] **Step 4 : Vérifier les tests**

```bash
pnpm test tests/unit/parsers/reddit.test.ts
```

Attendu : 3 pass.

- [ ] **Step 5 : Commit**

```bash
git add src/infra/parsers/reddit.ts tests/unit/parsers/reddit.test.ts
git commit -m "feat(parsers): Reddit subreddit listing parser (Plan 2 task 7)"
```

---

## Task 8 : Parser GitHub trending (TDD)

**Files:**
- Create: `src/infra/parsers/github-trending.ts`
- Test: `tests/unit/parsers/github-trending.test.ts`

But : `https://github.com/trending/<lang>?since=daily` ne renvoie pas de JSON. On parse le HTML avec `cheerio` : sélecteur `article.Box-row` pour chaque repo.

- [ ] **Step 1 : Installer `cheerio`**

```bash
pnpm add cheerio
```

- [ ] **Step 2 : Tests d'abord**

Créer `tests/unit/parsers/github-trending.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parseGithubTrending } from "@/src/infra/parsers/github-trending";

const html = `
<main>
  <article class="Box-row">
    <h2><a href="/vercel/next.js"> vercel / next.js </a></h2>
    <p class="col-9 color-fg-muted my-1 pr-4">The React framework for production.</p>
  </article>
  <article class="Box-row">
    <h2><a href="/owner/no-desc">owner / no-desc</a></h2>
  </article>
</main>
`;

describe("parseGithubTrending", () => {
  it("extracts owner/name and description", () => {
    const items = parseGithubTrending(html);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://github.com/vercel/next.js",
      title: "vercel/next.js",
      excerpt: "The React framework for production.",
    });
    expect(items[1].title).toBe("owner/no-desc");
    expect(items[1].excerpt).toBeUndefined();
  });

  it("returns [] on empty/unknown HTML", () => {
    expect(parseGithubTrending("<html><body>nope</body></html>")).toEqual([]);
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

```bash
pnpm test tests/unit/parsers/github-trending.test.ts
```

- [ ] **Step 4 : Implémentation**

Créer `src/infra/parsers/github-trending.ts` :

```ts
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
```

- [ ] **Step 5 : Vérifier les tests**

```bash
pnpm test tests/unit/parsers/github-trending.test.ts
```

Attendu : 2 pass.

- [ ] **Step 6 : Commit**

```bash
git add src/infra/parsers/github-trending.ts tests/unit/parsers/github-trending.test.ts package.json pnpm-lock.yaml
git commit -m "feat(parsers): GitHub trending HTML parser (Plan 2 task 8)"
```

---

## Task 9 : Parser GitHub repo (releases + commits) (TDD)

**Files:**
- Create: `src/infra/parsers/github-repo.ts`
- Test: `tests/unit/parsers/github-repo.test.ts`

But : pour `kind=github_repo, key="owner/name"`, on requête `https://api.github.com/repos/<owner>/<name>/releases?per_page=5` (releases) puis `/commits?per_page=10` (commits récents). Le parser prend ces deux listes et produit des `ParsedItem`. La fetcher orchestrera les 2 appels en amont.

- [ ] **Step 1 : Tests**

Créer `tests/unit/parsers/github-repo.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parseGithubRepo } from "@/src/infra/parsers/github-repo";

const releases = [
  {
    id: 1,
    name: "v15.2.0",
    tag_name: "v15.2.0",
    html_url: "https://github.com/vercel/next.js/releases/tag/v15.2.0",
    published_at: "2026-05-10T12:00:00Z",
    body: "## Breaking changes\nXYZ",
    draft: false,
    prerelease: false,
  },
  { id: 2, name: "v15.1", html_url: "https://x", draft: true, published_at: "2026-05-01T00:00:00Z" },
];

const commits = [
  {
    sha: "abc123",
    html_url: "https://github.com/vercel/next.js/commit/abc123",
    commit: { message: "fix(router): handle X", author: { date: "2026-05-12T08:00:00Z" } },
  },
];

describe("parseGithubRepo", () => {
  it("maps releases (skips draft/prerelease)", () => {
    const items = parseGithubRepo({ owner: "vercel", repo: "next.js", releases, commits: [] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://github.com/vercel/next.js/releases/tag/v15.2.0",
      title: "vercel/next.js — release v15.2.0",
    });
  });

  it("maps commits with first line of message as title", () => {
    const items = parseGithubRepo({ owner: "vercel", repo: "next.js", releases: [], commits });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("vercel/next.js — fix(router): handle X");
    expect(items[0].url).toBe("https://github.com/vercel/next.js/commit/abc123");
  });

  it("returns [] when both lists are empty", () => {
    expect(parseGithubRepo({ owner: "o", repo: "r", releases: [], commits: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
pnpm test tests/unit/parsers/github-repo.test.ts
```

- [ ] **Step 3 : Implémentation**

Créer `src/infra/parsers/github-repo.ts` :

```ts
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
```

- [ ] **Step 4 : Vérifier les tests**

```bash
pnpm test tests/unit/parsers/github-repo.test.ts
```

Attendu : 3 pass.

- [ ] **Step 5 : Commit**

```bash
git add src/infra/parsers/github-repo.ts tests/unit/parsers/github-repo.test.ts
git commit -m "feat(parsers): GitHub repo releases + commits parser (Plan 2 task 9)"
```

---

## Task 10 : Registry parser + `items-service.upsertItems()` (TDD)

**Files:**
- Create: `src/infra/parsers/registry.ts`
- Create: `src/server/items-service.ts`
- Test: `tests/integration/items-service.test.ts`

But : le registry expose `getKindDriver(kind)` qui retourne `{ fetch, parse }` — un wrapper qui sait construire les bonnes URLs HTTP et parser. `upsertItems(parsed, sourceId)` insère/dédup les items via `urlCanonical + hash`.

- [ ] **Step 1 : Registry (sans test dédié — c'est un assemblage, couvert par les tests d'intégration)**

Créer `src/infra/parsers/registry.ts` :

```ts
import type { Source } from "@/generated/prisma";
import { safeFetch, type FetchResult } from "@/src/infra/fetcher";
import type { ParsedItem } from "@/src/domain/sources/types";
import { parseRss } from "@/src/infra/parsers/rss";
import { parseHnTop, type HnStory } from "@/src/infra/parsers/hn-top";
import { parseReddit } from "@/src/infra/parsers/reddit";
import { parseGithubTrending } from "@/src/infra/parsers/github-trending";
import { parseGithubRepo, type GhCommit, type GhRelease } from "@/src/infra/parsers/github-repo";

export interface IngestOutcome {
  items: ParsedItem[];
  etag: string | null;
  lastModified: string | null;
  notModified: boolean;
}

type FetchAndParse = (source: Pick<Source, "kind" | "key">, prev: PrevFetch) => Promise<IngestOutcome | { error: string }>;
export interface PrevFetch {
  etag: string | null;
  lastModified: string | null;
}

const HN_TOP_LIMIT = 30;

export const drivers: Record<Source["kind"], FetchAndParse> = {
  rss: async (s, prev) => {
    const r = await safeFetch(s.key, prev);
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
        const r = await safeFetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          { trustedHost: true },
        );
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
    return { items: parseGithubTrending(r.body), etag: null, lastModified: null, notModified: false };
  },

  github_repo: async (s) => {
    const [owner, repo] = s.key.split("/");
    if (!owner || !repo) return { error: "bad key (expected owner/name)" };
    const [rel, com] = await Promise.all([
      safeFetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, { trustedHost: true }),
      safeFetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`, { trustedHost: true }),
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
```

- [ ] **Step 2 : Tests pour upsertItems**

Créer `tests/integration/items-service.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/src/infra/prisma";
import { upsertItems } from "@/src/server/items-service";

async function makeSource() {
  return prisma.source.create({
    data: { kind: "rss", key: `https://example.com/${crypto.randomUUID()}`, displayName: "Ex" },
  });
}

describe("upsertItems", () => {
  let sourceId: string;
  beforeEach(async () => {
    const s = await makeSource();
    sourceId = s.id;
  });
  afterEach(async () => {
    await prisma.item.deleteMany({ where: { sourceId } });
    await prisma.source.delete({ where: { id: sourceId } });
  });

  it("inserts new items and dedupes by hash on rerun", async () => {
    const parsed = [
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/b", title: "B" },
    ];
    const first = await upsertItems(parsed, sourceId);
    expect(first.inserted).toBe(2);
    const second = await upsertItems(parsed, sourceId);
    expect(second.inserted).toBe(0);
    const all = await prisma.item.count({ where: { sourceId } });
    expect(all).toBe(2);
  });

  it("treats tracking-paramed URL as the same item", async () => {
    await upsertItems([{ url: "https://example.com/x", title: "X" }], sourceId);
    const out = await upsertItems(
      [{ url: "https://example.com/x?utm_source=hn", title: "X (dup)" }],
      sourceId,
    );
    expect(out.inserted).toBe(0);
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

```bash
pnpm test tests/integration/items-service.test.ts
```

- [ ] **Step 4 : Implémentation**

Créer `src/server/items-service.ts` :

```ts
import { prisma } from "@/src/infra/prisma";
import { canonicalizeUrl, urlHash } from "@/src/domain/sources/url";
import type { ParsedItem } from "@/src/domain/sources/types";

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
```

- [ ] **Step 5 : Vérifier les tests**

```bash
pnpm test tests/integration/items-service.test.ts
```

Attendu : 2 pass. Si fail réseau DB, vérifier `DATABASE_URL` dans `.env.local` et que la migration de Task 1 a bien tourné.

- [ ] **Step 6 : Commit**

```bash
git add src/infra/parsers/registry.ts src/server/items-service.ts tests/integration/items-service.test.ts
git commit -m "feat(server): parser registry + upsertItems with dedup (Plan 2 task 10)"
```

---

## Task 11 : Inngest setup (client + serve route)

**Files:**
- Create: `src/inngest/client.ts`
- Create: `src/inngest/functions/index.ts`
- Create: `app/api/inngest/route.ts`
- Modify: `src/env.ts`
- Modify: `.env.example` et `src/auth.config.ts` (whitelister `/api/inngest`)

- [ ] **Step 1 : Installer Inngest**

```bash
pnpm add inngest
```

- [ ] **Step 2 : Étendre `src/env.ts`**

Modifier le schéma :

```ts
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, "32 bytes hex required"),
  FEEDBACK_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
});

export const env = serverEnvSchema.parse(process.env);
export type ServerEnv = z.infer<typeof serverEnvSchema>;
```

- [ ] **Step 3 : Client Inngest**

Créer `src/inngest/client.ts` :

```ts
import { Inngest, EventSchemas } from "inngest";

export type IngestRequestedEvent = {
  name: "source.ingest.requested";
  data: { sourceId: string };
};

type Events = { "source.ingest.requested": { data: { sourceId: string } } };

export const inngest = new Inngest({
  id: "hawkky",
  schemas: new EventSchemas().fromRecord<Events>(),
});
```

- [ ] **Step 4 : Stub des fonctions**

Créer `src/inngest/functions/index.ts` (sera étendu en Tasks 12-13) :

```ts
import type { InngestFunction } from "inngest";

export const inngestFunctions: InngestFunction.Any[] = [];
```

- [ ] **Step 5 : Route handler**

Créer `app/api/inngest/route.ts` :

```ts
import { serve } from "inngest/next";
import { inngest } from "@/src/inngest/client";
import { inngestFunctions } from "@/src/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
```

- [ ] **Step 6 : Whitelister `/api/inngest` dans `authorized`**

`src/auth.config.ts` doit déjà laisser passer les routes non listées comme « app routes ». Vérifier que `/api/inngest` n'est pas matché par `isAppRoute` (ce n'est pas le cas — il ne commence pas par les préfixes listés). RAS.

- [ ] **Step 7 : Vérification build**

```bash
pnpm typecheck
pnpm build
```

Doit passer.

- [ ] **Step 8 : Dev — vérifier le handshake**

Dans un terminal :

```bash
pnpm dev
```

Dans un second :

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

L'UI Inngest sur `http://localhost:8288` doit afficher l'app `hawkky` connectée (aucune fonction listée pour l'instant, c'est attendu).

- [ ] **Step 9 : Commit**

```bash
git add src/inngest src/env.ts app/api/inngest package.json pnpm-lock.yaml
git commit -m "feat(inngest): client + Next.js serve route (Plan 2 task 11)"
```

---

## Task 12 : Inngest function `ingest-source` (event-driven)

**Files:**
- Create: `src/inngest/functions/ingest-source.ts`
- Modify: `src/inngest/functions/index.ts`
- Test: `tests/integration/ingest-source.test.ts`

But : pour un `event "source.ingest.requested" { sourceId }`, charger la source, lire le `SourceFetch` précédent, appeler le driver, upsert les items, mettre à jour `SourceFetch` (success ou error). Idempotent par `sourceId` (concurrency par id).

- [ ] **Step 1 : Test d'intégration (driver mocké)**

Créer `tests/integration/ingest-source.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/infra/prisma";
import { runIngestSource } from "@/src/inngest/functions/ingest-source";

vi.mock("@/src/infra/parsers/registry", () => ({
  drivers: {
    rss: vi.fn(async () => ({
      items: [{ url: "https://example.com/a", title: "A" }],
      etag: '"v1"',
      lastModified: null,
      notModified: false,
    })),
    hn_top: vi.fn(),
    reddit_subreddit: vi.fn(),
    github_trending_lang: vi.fn(),
    github_repo: vi.fn(),
  },
}));

describe("runIngestSource", () => {
  let sourceId: string;
  beforeEach(async () => {
    const s = await prisma.source.create({
      data: { kind: "rss", key: `https://example.com/${crypto.randomUUID()}`, displayName: "Ex" },
    });
    sourceId = s.id;
  });
  afterEach(async () => {
    await prisma.item.deleteMany({ where: { sourceId } });
    await prisma.sourceFetch.deleteMany({ where: { sourceId } });
    await prisma.source.delete({ where: { id: sourceId } });
  });

  it("inserts items and writes SourceFetch on success", async () => {
    const out = await runIngestSource(sourceId);
    expect(out.inserted).toBe(1);
    const fetchRow = await prisma.sourceFetch.findUnique({ where: { sourceId } });
    expect(fetchRow?.etag).toBe('"v1"');
    expect(fetchRow?.lastError).toBeNull();
    expect(fetchRow?.lastSuccessAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

```bash
pnpm test tests/integration/ingest-source.test.ts
```

- [ ] **Step 3 : Implémentation**

Créer `src/inngest/functions/ingest-source.ts` :

```ts
import { inngest } from "@/src/inngest/client";
import { prisma } from "@/src/infra/prisma";
import { drivers } from "@/src/infra/parsers/registry";
import { upsertItems } from "@/src/server/items-service";

/**
 * Pure async helper, easy to call from tests without spinning up the Inngest runtime.
 */
export async function runIngestSource(sourceId: string): Promise<{ inserted: number; notModified: boolean }> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: { fetchState: true },
  });
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const driver = drivers[source.kind];
  const prev = {
    etag: source.fetchState?.etag ?? null,
    lastModified: source.fetchState?.lastModified ?? null,
  };

  const r = await driver({ kind: source.kind, key: source.key }, prev);

  if ("error" in r) {
    await prisma.sourceFetch.upsert({
      where: { sourceId },
      create: { sourceId, lastFetchedAt: new Date(), lastError: r.error },
      update: { lastFetchedAt: new Date(), lastError: r.error },
    });
    return { inserted: 0, notModified: false };
  }

  let inserted = 0;
  if (!r.notModified) {
    const u = await upsertItems(r.items, sourceId);
    inserted = u.inserted;
  }
  await prisma.sourceFetch.upsert({
    where: { sourceId },
    create: {
      sourceId,
      lastFetchedAt: new Date(),
      lastSuccessAt: new Date(),
      etag: r.etag,
      lastModified: r.lastModified,
      lastError: null,
    },
    update: {
      lastFetchedAt: new Date(),
      lastSuccessAt: new Date(),
      etag: r.etag,
      lastModified: r.lastModified,
      lastError: null,
    },
  });
  return { inserted, notModified: r.notModified };
}

export const ingestSource = inngest.createFunction(
  {
    id: "ingest-source",
    concurrency: { key: "event.data.sourceId", limit: 1 },
    retries: 3,
  },
  { event: "source.ingest.requested" },
  async ({ event, step }) => {
    return step.run("fetch-parse-upsert", () => runIngestSource(event.data.sourceId));
  },
);
```

- [ ] **Step 4 : Brancher dans le registry des fonctions**

`src/inngest/functions/index.ts` :

```ts
import type { InngestFunction } from "inngest";
import { ingestSource } from "./ingest-source";

export const inngestFunctions: InngestFunction.Any[] = [ingestSource];
```

- [ ] **Step 5 : Vérifier les tests**

```bash
pnpm test tests/integration/ingest-source.test.ts
```

Attendu : 1 pass.

- [ ] **Step 6 : Test manuel via le dev server Inngest**

```bash
pnpm dev
# dans un autre shell :
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Dans l'UI Inngest (`http://localhost:8288`), envoyer un event :

```json
{ "name": "source.ingest.requested", "data": { "sourceId": "<un sourceId réel>" } }
```

(Crée d'abord une `Source` via `pnpm exec prisma studio` ou un script.)

Vérifier que le run apparaît et termine en `Completed`, et que `prisma studio` montre des `Item` et un `SourceFetch` à jour.

- [ ] **Step 7 : Commit**

```bash
git add src/inngest/functions tests/integration/ingest-source.test.ts
git commit -m "feat(inngest): ingest-source function (fetch + parse + upsert) (Plan 2 task 12)"
```

---

## Task 13 : Inngest function `hourly-tick` (cron + fan-out)

**Files:**
- Create: `src/inngest/functions/hourly-tick.ts`
- Modify: `src/inngest/functions/index.ts`
- Modify: `src/server/sources-service.ts` (helper `findStaleSourceIds`)

But : toutes les 15 min (`*/15 * * * *`), trouver les `Source` actives (≥ 1 `Subscription`) dont le dernier fetch a > 30 min ou n'a jamais eu lieu, et envoyer un event `source.ingest.requested` par source. Le concurrency-by-sourceId de Task 12 garantit qu'on n'en lance pas deux en parallèle.

- [ ] **Step 1 : Helper côté service**

Créer/compléter `src/server/sources-service.ts` (ce fichier sera enrichi en Task 14 pour la CRUD multi-tenant ; ici on n'expose que `findStaleSourceIds`) :

```ts
import { prisma } from "@/src/infra/prisma";

const STALE_AFTER_MS = 30 * 60 * 1000;

export async function findStaleSourceIds(now: Date = new Date()): Promise<string[]> {
  const threshold = new Date(now.getTime() - STALE_AFTER_MS);
  const rows = await prisma.source.findMany({
    where: {
      subscriptions: { some: {} },
      OR: [
        { fetchState: null },
        { fetchState: { lastFetchedAt: null } },
        { fetchState: { lastFetchedAt: { lt: threshold } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
```

- [ ] **Step 2 : Fonction Inngest**

Créer `src/inngest/functions/hourly-tick.ts` :

```ts
import { inngest } from "@/src/inngest/client";
import { findStaleSourceIds } from "@/src/server/sources-service";

export const hourlyTick = inngest.createFunction(
  { id: "hourly-tick" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const ids = await step.run("find-stale", () => findStaleSourceIds());
    if (ids.length === 0) return { fanned: 0 };
    await step.sendEvent(
      "fan-out-ingest",
      ids.map((sourceId) => ({
        name: "source.ingest.requested" as const,
        data: { sourceId },
      })),
    );
    return { fanned: ids.length };
  },
);
```

- [ ] **Step 3 : Enregistrer**

`src/inngest/functions/index.ts` :

```ts
import type { InngestFunction } from "inngest";
import { ingestSource } from "./ingest-source";
import { hourlyTick } from "./hourly-tick";

export const inngestFunctions: InngestFunction.Any[] = [hourlyTick, ingestSource];
```

- [ ] **Step 4 : Test manuel**

Dans l'UI Inngest dev, déclencher `hourly-tick` manuellement (« Invoke »). Vérifier dans les logs que `fanned > 0` si on a au moins une `Source` avec une `Subscription`. Vérifier que des runs de `ingest-source` apparaissent ensuite.

- [ ] **Step 5 : Commit**

```bash
git add src/inngest/functions/hourly-tick.ts src/inngest/functions/index.ts src/server/sources-service.ts
git commit -m "feat(inngest): hourly-tick cron with fan-out to ingest-source (Plan 2 task 13)"
```

---

## Task 14 : Sources service multi-tenant (TDD)

**Files:**
- Modify: `src/server/sources-service.ts` (ajouter `listForUser`, `addSubscription`, `removeSubscription`)
- Create: `src/domain/sources/schemas.ts`
- Test: `tests/integration/sources-service.test.ts`

But : exposer 3 fonctions scopées par user. `addSubscription(userId, kind, key, displayName?)` : upsert `Source` puis `Subscription`. `removeSubscription(userId, subscriptionId)` : delete (scoped). `listForUser(userId)` : retourne les `Subscription` + `Source` + `SourceFetch`.

- [ ] **Step 1 : Schemas Zod**

Créer `src/domain/sources/schemas.ts` :

```ts
import { z } from "zod";

export const sourceKindSchema = z.enum([
  "rss",
  "hn_top",
  "reddit_subreddit",
  "github_trending_lang",
  "github_repo",
]);

export const addSubscriptionInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rss"), key: z.string().url() }),
  z.object({ kind: z.literal("hn_top"), key: z.literal("global") }),
  z.object({
    kind: z.literal("reddit_subreddit"),
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_]+$/, "invalid subreddit name"),
  }),
  z.object({
    kind: z.literal("github_trending_lang"),
    key: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9+-]+$/, "lowercase letters, digits, + or -"),
  }),
  z.object({
    kind: z.literal("github_repo"),
    key: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "expected owner/name"),
  }),
]);

export type AddSubscriptionInput = z.infer<typeof addSubscriptionInputSchema>;
```

- [ ] **Step 2 : Tests d'abord**

Créer `tests/integration/sources-service.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/src/infra/prisma";
import {
  addSubscription,
  listForUser,
  removeSubscription,
} from "@/src/server/sources-service";

async function makeUser() {
  return prisma.user.create({ data: { email: `u-${crypto.randomUUID()}@test.local` } });
}

describe("sources-service multi-tenancy", () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    userA = (await makeUser()).id;
    userB = (await makeUser()).id;
  });

  afterEach(async () => {
    await prisma.subscription.deleteMany({ where: { OR: [{ userId: userA }, { userId: userB }] } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.source.deleteMany({ where: { subscriptions: { none: {} } } });
  });

  it("addSubscription creates a Source on first add and reuses it on second", async () => {
    const r1 = await addSubscription(userA, { kind: "rss", key: "https://example.com/feed.xml" });
    const r2 = await addSubscription(userB, { kind: "rss", key: "https://example.com/feed.xml" });
    expect(r1.sourceId).toBe(r2.sourceId);
    const sources = await prisma.source.count();
    expect(sources).toBeGreaterThanOrEqual(1);
  });

  it("listForUser returns only own subscriptions", async () => {
    await addSubscription(userA, { kind: "rss", key: "https://a.com/feed" });
    await addSubscription(userB, { kind: "rss", key: "https://b.com/feed" });
    const a = await listForUser(userA);
    const b = await listForUser(userB);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].source.key).toBe("https://a.com/feed");
    expect(b[0].source.key).toBe("https://b.com/feed");
  });

  it("removeSubscription scoped: user A cannot delete user B's subscription", async () => {
    const sub = await addSubscription(userB, { kind: "rss", key: "https://b.com/feed" });
    await expect(removeSubscription(userA, sub.id)).rejects.toThrow();
    const stillThere = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(stillThere).not.toBeNull();
  });

  it("addSubscription is idempotent for same (user, source)", async () => {
    const a = await addSubscription(userA, { kind: "rss", key: "https://x.com/feed" });
    const b = await addSubscription(userA, { kind: "rss", key: "https://x.com/feed" });
    expect(a.id).toBe(b.id);
  });

  it("rejects invalid subreddit key", async () => {
    await expect(
      addSubscription(userA, { kind: "reddit_subreddit", key: "bad name!" } as never),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

```bash
pnpm test tests/integration/sources-service.test.ts
```

- [ ] **Step 4 : Implémentation**

Compléter `src/server/sources-service.ts` (en gardant `findStaleSourceIds` de Task 13) :

```ts
import { prisma } from "@/src/infra/prisma";
import {
  addSubscriptionInputSchema,
  type AddSubscriptionInput,
} from "@/src/domain/sources/schemas";

const STALE_AFTER_MS = 30 * 60 * 1000;

export async function findStaleSourceIds(now: Date = new Date()): Promise<string[]> {
  const threshold = new Date(now.getTime() - STALE_AFTER_MS);
  const rows = await prisma.source.findMany({
    where: {
      subscriptions: { some: {} },
      OR: [
        { fetchState: null },
        { fetchState: { lastFetchedAt: null } },
        { fetchState: { lastFetchedAt: { lt: threshold } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

function defaultDisplayName(kind: string, key: string): string {
  switch (kind) {
    case "rss":
      return new URL(key).hostname;
    case "hn_top":
      return "Hacker News — Top";
    case "reddit_subreddit":
      return `r/${key}`;
    case "github_trending_lang":
      return `GitHub Trending — ${key}`;
    case "github_repo":
      return key;
    default:
      return key;
  }
}

export async function addSubscription(userId: string, raw: AddSubscriptionInput) {
  const parsed = addSubscriptionInputSchema.parse(raw);
  const source = await prisma.source.upsert({
    where: { kind_key: { kind: parsed.kind, key: parsed.key } },
    create: {
      kind: parsed.kind,
      key: parsed.key,
      displayName: defaultDisplayName(parsed.kind, parsed.key),
    },
    update: {},
  });
  const sub = await prisma.subscription.upsert({
    where: { userId_sourceId: { userId, sourceId: source.id } },
    create: { userId, sourceId: source.id },
    update: {},
  });
  return { id: sub.id, sourceId: source.id };
}

export async function listForUser(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    include: { source: { include: { fetchState: true } } },
    orderBy: { addedAt: "desc" },
  });
}

export async function removeSubscription(userId: string, subscriptionId: string) {
  // deleteMany scopes by (id, userId) ; if the row is owned by someone else, count = 0
  const r = await prisma.subscription.deleteMany({
    where: { id: subscriptionId, userId },
  });
  if (r.count === 0) throw new Error("subscription not found or not owned by user");
  return { id: subscriptionId };
}
```

- [ ] **Step 5 : Vérifier les tests**

```bash
pnpm test tests/integration/sources-service.test.ts
```

Attendu : 5 pass.

- [ ] **Step 6 : Commit**

```bash
git add src/server/sources-service.ts src/domain/sources/schemas.ts tests/integration/sources-service.test.ts
git commit -m "feat(server): sources-service CRUD scoped per user with TDD (Plan 2 task 14)"
```

---

## Task 15 : Page `/sources` UI

**Files:**
- Modify: `app/(app)/sources/page.tsx`
- Create: `app/(app)/sources/actions.ts`
- Create: `app/(app)/sources/add-source-dialog.tsx`
- Create: `app/(app)/sources/source-row.tsx`

But : la page liste les `Subscription` du user (groupées par `kind`), avec état de fetch. Un bouton « + Ajouter une source » ouvre une modal avec un sélecteur de `kind` puis le champ approprié. Server actions pour add/remove.

- [ ] **Step 1 : Server actions**

Créer `app/(app)/sources/actions.ts` :

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/src/auth";
import {
  addSubscription,
  removeSubscription,
} from "@/src/server/sources-service";
import { addSubscriptionInputSchema } from "@/src/domain/sources/schemas";
import { inngest } from "@/src/inngest/client";

export async function addSourceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthenticated");

  const parsed = addSubscriptionInputSchema.parse({
    kind: formData.get("kind"),
    key: formData.get("key"),
  });
  const r = await addSubscription(session.user.id, parsed);
  // Kick off an immediate ingest for the new source
  await inngest.send({ name: "source.ingest.requested", data: { sourceId: r.sourceId } });
  revalidatePath("/sources");
}

export async function removeSourceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthenticated");
  const id = formData.get("id");
  if (typeof id !== "string") throw new Error("missing id");
  await removeSubscription(session.user.id, id);
  revalidatePath("/sources");
}
```

- [ ] **Step 2 : Source row component (client)**

Créer `app/(app)/sources/source-row.tsx` :

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { removeSourceAction } from "./actions";

interface Props {
  id: string;
  displayName: string;
  kind: string;
  lastFetchedAt: string | null;
  lastError: string | null;
}

export function SourceRow({ id, displayName, kind, lastFetchedAt, lastError }: Props) {
  const status = lastError ? "error" : lastFetchedAt ? "ok" : "pending";
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="space-y-1">
        <div className="font-medium">{displayName}</div>
        <div className="text-xs text-muted-foreground">
          {kind} ·{" "}
          {status === "error"
            ? `erreur : ${lastError}`
            : status === "ok"
              ? `OK — ${new Date(lastFetchedAt as string).toLocaleString("fr-FR")}`
              : "en attente du premier fetch"}
        </div>
      </div>
      <form action={removeSourceAction}>
        <input type="hidden" name="id" value={id} />
        <Button variant="ghost" size="sm" type="submit">
          Supprimer
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3 : Dialog d'ajout (client)**

Créer `app/(app)/sources/add-source-dialog.tsx` :

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSourceAction } from "./actions";

const KINDS = [
  { value: "rss", label: "Flux RSS", placeholder: "https://example.com/feed.xml" },
  { value: "hn_top", label: "Hacker News — Top", placeholder: "global" },
  { value: "reddit_subreddit", label: "Subreddit", placeholder: "programming" },
  { value: "github_trending_lang", label: "GitHub Trending (langage)", placeholder: "typescript" },
  { value: "github_repo", label: "GitHub Repo", placeholder: "vercel/next.js" },
] as const;

export function AddSourceDialog() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("rss");
  const current = KINDS.find((k) => k.value === kind)!;

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Ajouter une source</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Ajouter une source</h2>
            <form
              action={async (fd) => {
                await addSourceAction(fd);
                setOpen(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="kind">Type</Label>
                <select
                  id="kind"
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="key">Identifiant</Label>
                <Input id="key" name="key" placeholder={current.placeholder} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">Ajouter</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4 : Page server-rendered**

Remplacer `app/(app)/sources/page.tsx` :

```tsx
import { auth } from "@/src/auth";
import { listForUser } from "@/src/server/sources-service";
import { AddSourceDialog } from "./add-source-dialog";
import { SourceRow } from "./source-row";

export default async function SourcesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const subs = await listForUser(session.user.id);

  const grouped = subs.reduce<Record<string, typeof subs>>((acc, s) => {
    (acc[s.source.kind] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <AddSourceDialog />
      </header>

      {subs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune source pour l'instant — ajoute un flux RSS, un subreddit ou un repo GitHub.
        </p>
      )}

      {Object.entries(grouped).map(([kind, items]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {kind}
          </h2>
          <div className="space-y-2">
            {items.map((s) => (
              <SourceRow
                key={s.id}
                id={s.id}
                displayName={s.source.displayName}
                kind={s.source.kind}
                lastFetchedAt={s.source.fetchState?.lastFetchedAt?.toISOString() ?? null}
                lastError={s.source.fetchState?.lastError ?? null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5 : Vérification visuelle**

```bash
pnpm dev
```

Aller sur `http://localhost:3000/sources` (connecté). Ajouter une RSS (par ex. `https://hnrss.org/frontpage`). Vérifier qu'elle apparaît, puis lancer `npx inngest-cli dev -u http://localhost:3000/api/inngest` et vérifier que la source passe en état OK après le premier fetch automatique (le `inngest.send` dans l'action déclenche `ingest-source`).

- [ ] **Step 6 : Commit**

```bash
git add app/\(app\)/sources
git commit -m "feat(sources): /sources page (list, add, remove) with immediate ingest (Plan 2 task 15)"
```

---

## Task 16 : Bouton onboarding « Connecter GitHub » (scope élargi + scan repos)

**Files:**
- Modify: `src/ui/onboarding/Step3DevStack.tsx`
- Create: `src/server/github-link-service.ts`
- Create: `app/api/github-link/start/route.ts`
- Create: `app/api/github-link/callback/route.ts`
- Create: `src/ui/onboarding/github-scan-result.tsx`

But : un clic sur « Connecter GitHub » lance une mini-OAuth avec scope `read:user public_repo`. Au retour, on échange le code, chiffre le token (AES-GCM via `src/infra/crypto.ts`) dans `Profile.githubAccessTokenEnc`, on fetch `/user/repos?per_page=100` et on calcule les 5 langages dominants → on les propose comme `stackTags`.

- [ ] **Step 1 : Service**

Créer `src/server/github-link-service.ts` :

```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { encrypt } from "@/src/infra/crypto";
import { env } from "@/src/env";
import { prisma } from "@/src/infra/prisma";

const STATE_TTL_MS = 10 * 60 * 1000;

interface StatePayload {
  userId: string;
  ts: number;
  nonce: string;
}

function signState(p: StatePayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  const mac = createHmac("sha256", env.FEEDBACK_SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState(state: string): StatePayload {
  const [body, mac] = state.split(".");
  if (!body || !mac) throw new Error("bad state");
  const expected = createHmac("sha256", env.FEEDBACK_SECRET).update(body).digest("base64url");
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw new Error("bad signature");
  const p = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as StatePayload;
  if (Date.now() - p.ts > STATE_TTL_MS) throw new Error("state expired");
  return p;
}

export function buildAuthorizeUrl(userId: string): string {
  if (!env.AUTH_GITHUB_ID) throw new Error("AUTH_GITHUB_ID missing");
  const state = signState({ userId, ts: Date.now(), nonce: randomBytes(8).toString("hex") });
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", env.AUTH_GITHUB_ID);
  u.searchParams.set("scope", "read:user public_repo");
  u.searchParams.set("state", state);
  u.searchParams.set(
    "redirect_uri",
    new URL("/api/github-link/callback", env.NEXTAUTH_URL).toString(),
  );
  return u.toString();
}

export async function exchangeCodeAndScan(userId: string, code: string) {
  if (!env.AUTH_GITHUB_ID || !env.AUTH_GITHUB_SECRET) throw new Error("github oauth not configured");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.AUTH_GITHUB_ID,
      client_secret: env.AUTH_GITHUB_SECRET,
      code,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) throw new Error(tokenJson.error ?? "no access_token");

  const headers = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Hawkky/0.2",
  };

  const me = (await (await fetch("https://api.github.com/user", { headers })).json()) as {
    login?: string;
  };

  const repos = (await (
    await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", { headers })
  ).json()) as Array<{ language: string | null; full_name: string; fork: boolean; archived: boolean }>;

  const langCount = new Map<string, number>();
  for (const r of repos) {
    if (r.fork || r.archived || !r.language) continue;
    langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
  }
  const topLanguages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  const encToken = encrypt(tokenJson.access_token);
  await prisma.profile.update({
    where: { userId },
    data: {
      githubLogin: me.login ?? null,
      githubAccessTokenEnc: encToken,
    },
  });

  return { topLanguages, repoCount: repos.length };
}
```

- [ ] **Step 2 : Route « start »**

Créer `app/api/github-link/start/route.ts` :

```ts
import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { buildAuthorizeUrl } from "@/src/server/github-link-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/signin", process.env.NEXTAUTH_URL));
  return NextResponse.redirect(buildAuthorizeUrl(session.user.id));
}
```

- [ ] **Step 3 : Route « callback »**

Créer `app/api/github-link/callback/route.ts` :

```ts
import { NextResponse } from "next/server";
import { verifyState, exchangeCodeAndScan } from "@/src/server/github-link-service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const onboarding = new URL("/onboarding", url.origin);

  if (!code || !state) {
    onboarding.searchParams.set("gh_error", "missing_params");
    return NextResponse.redirect(onboarding);
  }

  let payload;
  try {
    payload = verifyState(state);
  } catch {
    onboarding.searchParams.set("gh_error", "bad_state");
    return NextResponse.redirect(onboarding);
  }

  try {
    const scan = await exchangeCodeAndScan(payload.userId, code);
    onboarding.searchParams.set("gh_langs", scan.topLanguages.join(","));
    return NextResponse.redirect(onboarding);
  } catch (e) {
    onboarding.searchParams.set("gh_error", e instanceof Error ? e.message : "unknown");
    return NextResponse.redirect(onboarding);
  }
}
```

- [ ] **Step 4 : Composant client de visualisation**

Créer `src/ui/onboarding/github-scan-result.tsx` :

```tsx
"use client";

interface Props {
  languages: string[];
  onAccept: (langs: string[]) => void;
}

export function GithubScanResult({ languages, onAccept }: Props) {
  if (languages.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="mb-2 font-medium">Langages détectés depuis tes repos :</div>
      <div className="flex flex-wrap gap-2">
        {languages.map((l) => (
          <span key={l} className="rounded-full bg-background px-2 py-1 text-xs">
            {l}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onAccept(languages)}
        className="mt-3 text-xs underline"
      >
        Pré-remplir ma stack avec ces langages
      </button>
    </div>
  );
}
```

- [ ] **Step 5 : Bouton dans Step3DevStack**

Modifier `src/ui/onboarding/Step3DevStack.tsx` pour ajouter le bouton `Connecter GitHub`. Lecture du fichier existant requise — chercher l'endroit où s'affiche le champ `stackTags` et insérer (avant) :

```tsx
import { GithubScanResult } from "./github-scan-result";

// ... à côté du composant principal :
function ConnectGithubButton() {
  return (
    <a
      href="/api/github-link/start"
      className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-accent"
    >
      Connecter GitHub pour scanner mon stack
    </a>
  );
}
```

Puis lire `searchParams.gh_langs` côté server component parent (`OnboardingShell` ou la page) pour passer la liste au `Step3DevStack`. Pour minimiser le diff, lire la query string côté client via `useSearchParams()` :

```tsx
import { useSearchParams } from "next/navigation";
// ...
const sp = useSearchParams();
const ghLangs = sp.get("gh_langs")?.split(",").filter(Boolean) ?? [];
// ...
return (
  <>
    <ConnectGithubButton />
    {ghLangs.length > 0 && (
      <GithubScanResult languages={ghLangs} onAccept={(langs) => setStackTags([...stackTags, ...langs])} />
    )}
    {/* ... champs existants ... */}
  </>
);
```

Adapter aux noms réels du composant (`setStackTags`, etc.).

- [ ] **Step 6 : Vérification manuelle**

```bash
pnpm dev
```

Créer une OAuth app GitHub avec callback `http://localhost:3000/api/github-link/callback` (en plus de celle d'Auth.js). Renseigner `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`. Aller dans l'onboarding step 3 (dev), cliquer le bouton, accepter l'autorisation GitHub, vérifier le retour avec `?gh_langs=...` et la pré-sélection des stackTags. Vérifier dans `prisma studio` que `Profile.githubAccessTokenEnc` est rempli (et illisible).

- [ ] **Step 7 : Commit**

```bash
git add src/server/github-link-service.ts app/api/github-link src/ui/onboarding/Step3DevStack.tsx src/ui/onboarding/github-scan-result.tsx
git commit -m "feat(onboarding): connect GitHub for stack scan (OAuth scope élargi + AES-GCM token) (Plan 2 task 16)"
```

---

## Task 17 : Test E2E Playwright — flow Sources

**Files:**
- Create: `tests/e2e/sources-flow.spec.ts`

But : depuis un user connecté (réutiliser le helper de Plan 1 task 15), aller sur `/sources`, ajouter une source RSS de test (fixture statique servie par un endpoint `/api/test/rss-fixture`), déclencher manuellement l'ingest via `inngest.send` côté serveur ou via une route de test, et vérifier l'apparition du statut OK.

- [ ] **Step 1 : Endpoint test pour ingest synchrone**

Créer `app/api/test/run-ingest/route.ts` (protégé : ne fonctionne que si `NODE_ENV !== "production"`) :

```ts
import { NextResponse } from "next/server";
import { runIngestSource } from "@/src/inngest/functions/ingest-source";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("forbidden", { status: 403 });
  const { sourceId } = (await req.json()) as { sourceId: string };
  const out = await runIngestSource(sourceId);
  return NextResponse.json(out);
}
```

- [ ] **Step 2 : Endpoint test pour servir une RSS fixture**

Créer `app/api/test/rss-fixture/route.ts` :

```ts
import { NextResponse } from "next/server";

const FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item><title>Hello E2E</title><link>https://example.com/e2e-1</link><pubDate>Mon, 12 May 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`;

export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(FIXTURE, { headers: { "Content-Type": "application/rss+xml" } });
}
```

Mais : cet endpoint est en `localhost`, donc le SSRF guard de Task 3 le **rejettera**. Pour l'E2E, on bypass via le flag `trustedHost` côté driver — sauf que `rss` ne le passe pas. Solution : ajouter dans le driver RSS un check d'env :

```ts
rss: async (s, prev) => {
  const r = await safeFetch(s.key, {
    ...prev,
    trustedHost: process.env.NODE_ENV !== "production" && s.key.startsWith(process.env.NEXTAUTH_URL ?? ""),
  });
  return toOutcome(r, parseRss);
},
```

Mettre à jour `src/infra/parsers/registry.ts` en conséquence.

- [ ] **Step 3 : Spec Playwright**

Créer `tests/e2e/sources-flow.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

test("user can add a RSS source and see it ingest", async ({ page, request }) => {
  // Réutilise le helper signupAndComplete du test de Plan 1 si présent.
  // Sinon, factorise-le ; pour le scope ici, on suppose une session déjà active via fixture.

  await page.goto("/sources");
  await page.getByRole("button", { name: /Ajouter une source/i }).click();
  await page.selectOption("select[name=kind]", "rss");
  await page.getByLabel(/Identifiant/).fill("http://localhost:3000/api/test/rss-fixture");
  await page.getByRole("button", { name: "Ajouter" }).click();

  // The row should appear with status "en attente"
  await expect(page.getByText("Test")).toBeVisible({ timeout: 5_000 });

  // Trigger ingest synchronously
  const sub = await page.locator("[data-source-id]").first().getAttribute("data-source-id");
  // For simplicity, fetch the source id from the API:
  const list = await request.get("/sources").then((r) => r.text());
  // Extract first sourceId is harder — alternative: call a debug endpoint that returns user's first source id.

  // Trigger ingest via debug endpoint
  // (Adapt: the test endpoint takes sourceId; expose a `/api/test/first-source-id` if needed.)
  // For now, just assert that within 30s the row eventually shows "OK" if Inngest dev is running.
});
```

> **Note** : ce test est *best-effort* dans un dev local. Il documente le flow ; la vraie couverture E2E sera étendue dans un plan ultérieur. **Le rendre `test.fixme()` si l'infra Inngest n'est pas dispo en CI** — ce qui est attendu (on ne fait pas tourner inngest-cli en CI dans ce plan).

- [ ] **Step 4 : Marquer le test comme skip en CI**

```ts
import { test, expect } from "@playwright/test";

test.skip(!!process.env.CI, "Requires inngest-cli running locally");

test("user can add a RSS source and see it ingest", async ({ page }) => {
  // ... (cf. ci-dessus, simplifié)
});
```

- [ ] **Step 5 : Commit**

```bash
git add tests/e2e/sources-flow.spec.ts app/api/test src/infra/parsers/registry.ts
git commit -m "test(e2e): sources add flow with RSS fixture (skipped in CI) (Plan 2 task 17)"
```

---

## Task 18 : Vérification globale + CI + Tag

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml` (si besoin)

- [ ] **Step 1 : Mettre à jour `.env.example`**

Ajouter :

```
# Inngest (laisser vide en dev local — l'inngest-cli ne les exige pas)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

- [ ] **Step 2 : Tour de vérification complet**

```bash
pnpm lint
pnpm typecheck
pnpm test tests/unit
pnpm test tests/integration
pnpm build
```

Tous doivent passer.

- [ ] **Step 3 : Commit final si fichiers modifiés (env.example, etc.)**

```bash
git add .env.example
git commit -m "chore(env): document Inngest env vars (Plan 2 task 18)" || true
```

- [ ] **Step 4 : Tag**

```bash
git tag -a hawkky-v0.2.0-ingestion -m "Plan 2 done: Ingestion (Sources/Items/Inngest)"
git push --tags
```

---

## Critères de complétion du Plan 2 (Definition of Done)

- [ ] Schéma Prisma contient `Source`, `Subscription`, `Item`, `SourceFetch` avec les unique indexes spécifiés.
- [ ] Un user peut ajouter une source RSS via `/sources` ; un `Subscription` est créé ; un event Inngest est déclenché immédiatement.
- [ ] La fonction `ingest-source` Inngest fetch + parse + insère des `Item`, met à jour `SourceFetch.lastFetchedAt` et `etag`.
- [ ] Sur le re-fetch, les items identiques (même `hash` après canonicalisation) ne sont pas dupliqués.
- [ ] Le cron `hourly-tick` (toutes les 15 min) fan-out vers les sources stales (> 30 min).
- [ ] La page `/sources` affiche les subscriptions du user (groupées par `kind`), avec date du dernier fetch ou message d'erreur.
- [ ] Le bouton « Connecter GitHub » dans l'onboarding (variante dev) déclenche un OAuth scope `public_repo`, chiffre le token dans `Profile.githubAccessTokenEnc`, et propose les 5 langages dominants.
- [ ] Le SSRF guard rejette `http://localhost/`, `http://127.0.0.1/`, `http://169.254.169.254/`.
- [ ] Tests unit verts : `url`, `ssrf`, `fetcher`, `parsers/{rss,hn-top,reddit,github-trending,github-repo}`.
- [ ] Tests integration verts : `items-service`, `sources-service`, `ingest-source`.
- [ ] CI verte (lint + typecheck + unit tests + build).
- [ ] Tag `hawkky-v0.2.0-ingestion` poussé.

---

## À ne PAS faire dans ce plan (rappel)

- Pas de `Briefing` / `BriefingItem` / scoring Haiku / synthèse Sonnet — c'est le Plan 3.
- Pas de `RedirectLink` / endpoint `/r/[id]` — c'est le Plan 3 (utilisé par WhatsApp Plan 4 mais introduit avec l'email rich Plan 3).
- Pas d'envoi d'email contenant des items (le simple email de vérification de Plan 1 reste le seul).
- Pas de WhatsApp / pas d'`ItemFeedback`.
- Pas de page `/archive`.

---

## Notes pour l'agent qui exécute ce plan

- **Si l'API Inngest a évolué** (`createFunction` renvoie un type différent, le serve adapter change, etc.), consulter Context7 (`/inngest/inngest-js`) et adapter — la sémantique reste : un cron + un event-driven, fan-out via `step.sendEvent`, concurrency par `event.data.sourceId`.
- **`fast-xml-parser` vs `rss-parser`** : si `fast-xml-parser` peine sur des feeds étranges, basculer sur `rss-parser` (plus permissif). La signature `parseRss(xml) -> ParsedItem[]` reste la même.
- **Reddit** sert son JSON depuis `https://www.reddit.com` qui demande un `User-Agent` non vide — déjà géré dans `safeFetch`.
- **GitHub API rate limit** : sans token, 60 req/h par IP. Acceptable pour le MVP (un repo = 2 req, on a une dizaine de repos par user max). Si plus de volume, lire le token user de `Profile.githubAccessTokenEnc` (Task 16) pour le passer en `Authorization` — laissé pour un plan ultérieur.
- **Idempotence Inngest** : `concurrency.key: "event.data.sourceId"` + `retries: 3` suffit pour le MVP. Si une source plante de manière répétée, `SourceFetch.lastError` permettra de la masquer en UI plus tard.
- **Ne pas pousser `.env.local`**.
