# Hawkky — Plan 1 : Foundation & Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrapper Hawkky avec Next.js 15 + Prisma/Neon + Auth.js v5 (email/pwd, GitHub, Google) + onboarding adaptatif 5 écrans + Profile complet en DB. Livrable testable : un utilisateur peut s'inscrire, vérifier son email, traverser l'onboarding et avoir un Profile prêt à recevoir un briefing (sans encore en générer).

**Architecture:** Next.js App Router monolithe sur Vercel ; Postgres Neon via Prisma 6 (driver serverless `@prisma/adapter-neon`) ; Auth.js v5 avec session JWT et adapter Prisma ; trois groupes de routes — `(marketing)` publique, `(auth)` signin/signup/verify, `(app)` protégée par middleware. Helpers `crypto` AES-GCM et `forUser()` multi-tenant prêts pour Plans 2-5.

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui · HugeIcons React · Prisma 6 + `@prisma/adapter-neon` · Auth.js v5 (`next-auth@beta` ou stable v5) · `bcryptjs` · `zod` · Resend (HTTP) · Biome (lint+format) · Vitest · Playwright · pnpm.

**Spec source:** [`docs/superpowers/specs/2026-04-27-hawkky-radar-veille-tech-design.md`](../specs/2026-04-27-hawkky-radar-veille-tech-design.md)

---

## File Structure

### À créer

```
package.json                                  # via pnpm create next-app
pnpm-lock.yaml
tsconfig.json
next.config.ts
biome.json                                    # lint + format unifiés
vitest.config.ts
playwright.config.ts
.env.example                                  # tracké
.gitignore                                    # complété (.env*, /generated, etc.)
.github/workflows/ci.yml                      # lint + typecheck + vitest + build
README.md                                     # minimal — pointage vers spec/plans

app/
├── layout.tsx                                # root layout (fonts Inter + JetBrains Mono)
├── globals.css                               # Tailwind v4 + variables shadcn
├── (marketing)/page.tsx                      # landing publique simple
├── (auth)/
│   ├── layout.tsx                            # layout signin/signup centré
│   ├── signin/page.tsx
│   ├── signup/page.tsx
│   └── verify/page.tsx                       # /verify?token=...
├── (app)/
│   ├── layout.tsx                            # sidebar shadcn + auth guard
│   ├── page.tsx                              # dashboard placeholder
│   ├── onboarding/page.tsx                   # multi-step onboarding
│   ├── profile/page.tsx
│   └── sources/page.tsx                      # placeholder Plan 2
├── api/auth/[...nextauth]/route.ts           # handlers Auth.js
└── api/verify-email/route.ts                 # GET ?token=...

prisma/
├── schema.prisma                             # User/Account/Session/VerificationToken/Profile
└── migrations/                                # généré par prisma migrate

src/
├── auth.config.ts                            # config edge-compatible (providers + callbacks)
├── auth.ts                                   # NextAuth instance + adapter Prisma
├── middleware.ts                             # protection (app)/*
├── env.ts                                    # validation Zod des env vars (server-only)
├── domain/
│   └── profile/
│       ├── types.ts                          # types domain (Interest, StackTag, ChannelPrefs, etc.)
│       └── schemas.ts                        # schémas Zod (OnboardingStep1..5, ProfileUpdate)
├── infra/
│   ├── prisma.ts                             # singleton + Neon adapter
│   ├── crypto.ts                             # AES-256-GCM encrypt/decrypt
│   └── resend.ts                             # POST transactional email
├── server/
│   ├── for-user.ts                           # multi-tenancy guard
│   ├── auth-actions.ts                       # signup, requestVerifyEmail (server actions)
│   └── profile-service.ts                    # CRUD Profile scoped
└── ui/
    ├── components/                            # composants shadcn (générés via CLI)
    ├── icons.tsx                             # ré-exports HugeIcons utilisés
    └── onboarding/
        ├── OnboardingShell.tsx               # progress + persistance step
        ├── Step1ProfileType.tsx
        ├── Step2Interests.tsx
        ├── Step3DevStack.tsx                 # branche dev
        ├── Step3NonDevSources.tsx            # branche non-dev
        ├── Step4Delivery.tsx
        └── Step5Done.tsx

tests/
├── unit/
│   ├── crypto.test.ts
│   ├── for-user.test.ts
│   └── profile-schemas.test.ts
├── integration/
│   └── auth-multi-tenant.test.ts
├── e2e/
│   └── signup-onboarding.spec.ts
└── setup/
    ├── prisma-test.ts                        # connexion DB de test (Neon branche dédiée)
    └── reset-db.ts
```

### Aucune modification de fichiers existants : repo vierge.

---

## Task 1 : Bootstrap Next.js + tooling de base

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/(marketing)/page.tsx`, `biome.json`, `.gitignore`, `.env.example`, `README.md`

- [ ] **Step 1: Bootstrap Next.js 15 avec pnpm**

```bash
cd /home/darellchooks/Bureau/hawkky
pnpm create next-app@latest . --ts --tailwind --app --src-dir=false --import-alias "@/*" --use-pnpm --no-eslint --skip-install --yes
pnpm install
```

Note : on désactive ESLint via `--no-eslint` car on utilisera Biome. Le flag `--src-dir=false` met `app/` à la racine (notre arbo). Si la CLI demande des choix interactifs malgré `--yes`, accepter les défauts proposés.

- [ ] **Step 2: Vérifier que le projet build et démarre**

```bash
pnpm dev
# Ouvrir http://localhost:3000 → page d'accueil Next.js par défaut visible
# Ctrl+C pour arrêter
pnpm build
```

Attendu : `pnpm build` se termine sans erreur, `.next/` créé.

- [ ] **Step 3: Installer Biome (lint + format unifié)**

```bash
pnpm add -D --save-exact @biomejs/biome
pnpm exec biome init
```

Remplacer le contenu de `biome.json` par :

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "useNodejsImportProtocol": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "semicolons": "always" }
  },
  "files": {
    "ignore": ["node_modules", ".next", "generated", "playwright-report", "test-results"]
  }
}
```

Ajouter dans `package.json` les scripts :

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "format": "biome format --write .",
    "fix": "biome check --write .",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 4: Compléter `.gitignore` et créer `.env.example`**

Append à `.gitignore` :

```
# Hawkky
.env
.env.local
.env.*.local
generated/
playwright-report/
test-results/
```

Créer `.env.example` avec toutes les variables nécessaires :

```env
# Database (Neon Postgres)
DATABASE_URL="postgresql://user:pwd@host/db?sslmode=require"

# Auth.js
AUTH_SECRET=""           # openssl rand -hex 32
NEXTAUTH_URL="http://localhost:3000"

# OAuth providers
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# Encryption (32 bytes hex pour AES-256-GCM)
ENCRYPTION_KEY=""        # openssl rand -hex 32

# HMAC pour les liens 👍/👎 (Plan 5)
FEEDBACK_SECRET=""       # openssl rand -hex 32

# Email (Resend)
RESEND_API_KEY=""
RESEND_FROM_EMAIL="briefing@hawkky.app"   # à ajuster quand le domaine sera vérifié sur Resend
RESEND_FROM_NAME="Hawkky"

# (Plans 2+) Anthropic, Inngest, Evolution API, Upstash, Sentry — laissés vides pour le Plan 1
ANTHROPIC_API_KEY=""
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""
EVOLUTION_API_URL=""
EVOLUTION_API_KEY=""
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
SENTRY_DSN=""
```

Créer `README.md` minimal :

```markdown
# Hawkky

Ta veille tech, distillée chaque matin.

- Spec: [`docs/superpowers/specs/2026-04-27-hawkky-radar-veille-tech-design.md`](docs/superpowers/specs/2026-04-27-hawkky-radar-veille-tech-design.md)
- Plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Setup local

\`\`\`bash
pnpm install
cp .env.example .env.local  # remplir les valeurs
pnpm dev
\`\`\`
```

- [ ] **Step 5: Tourner lint + typecheck**

```bash
pnpm fix
pnpm typecheck
```

Attendu : aucune erreur. Si Biome reformatte des fichiers générés par `create-next-app`, c'est normal.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js 15 + Tailwind + Biome (Plan 1 task 1)"
```

---

## Task 2 : Setup polices + Tailwind variables + globals

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`
- Modify: `app/(marketing)/page.tsx` (déplacer le contenu d'accueil par défaut dans le groupe marketing)

- [ ] **Step 1: Installer les polices Inter + JetBrains Mono via `next/font`**

Remplacer `app/layout.tsx` :

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hawkky — Ta veille tech, distillée chaque matin.",
  description:
    "Hawkky scrute Hacker News, GitHub, Reddit et tes sources préférées, " +
    "puis Claude te livre chaque matin l'essentiel pour ton stack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Configurer `globals.css` Tailwind v4 + variables shadcn**

Remplacer le contenu de `app/globals.css` :

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.5rem;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
}

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

(La palette définitive sera affinée plus tard ; ces variables permettent à shadcn de fonctionner.)

- [ ] **Step 3: Déplacer la page d'accueil dans `(marketing)`**

```bash
mkdir -p "app/(marketing)"
```

Créer `app/(marketing)/page.tsx` :

```tsx
export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-semibold tracking-tight">Hawkky</h1>
        <p className="text-xl text-muted-foreground">
          Ta veille tech, distillée chaque matin.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <a
            href="/signup"
            className="px-5 py-2.5 rounded-md bg-foreground text-background font-medium"
          >
            Commencer
          </a>
          <a
            href="/signin"
            className="px-5 py-2.5 rounded-md border border-border font-medium"
          >
            Se connecter
          </a>
        </div>
      </div>
    </main>
  );
}
```

Supprimer l'ancien `app/page.tsx` s'il existe encore :

```bash
rm -f app/page.tsx
```

- [ ] **Step 4: Vérifier le rendu**

```bash
pnpm dev
# http://localhost:3000 → "Hawkky — Ta veille tech, distillée chaque matin."
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): root layout, fonts and landing page (Plan 1 task 2)"
```

---

## Task 3 : Installer shadcn/ui + composants de base + HugeIcons

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/*` (générés)
- Create: `src/ui/icons.tsx`

- [ ] **Step 1: Init shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
```

Le flag `-d` accepte les défauts (style "default", base color "slate", CSS variables on, RSC on, alias `@/components`, alias utils `@/lib/utils`). Si l'init échoue car `globals.css` a déjà des variables, accepter l'écrasement (nos variables précédentes étaient déjà compatibles shadcn).

- [ ] **Step 2: Ajouter les composants nécessaires pour le Plan 1**

```bash
pnpm dlx shadcn@latest add button input label form card dialog select checkbox separator sonner badge tabs textarea
```

(Tabs et textarea pour l'onboarding ; sonner pour les toasts.)

- [ ] **Step 3: Installer HugeIcons React + créer la barrel `src/ui/icons.tsx`**

```bash
pnpm add @hugeicons/react @hugeicons/core-free-icons
```

Créer `src/ui/icons.tsx` (barrel des icônes utilisées — on n'importera que d'ici pour limiter le bundle) :

```tsx
"use client";

export { HugeiconsIcon } from "@hugeicons/react";
export {
  Mail01Icon,
  GoogleIcon,
  GithubIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  Settings02Icon,
  News01Icon,
  Rss01Icon,
  Bookmark02Icon,
  Logout03Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
```

(Les noms exacts peuvent légèrement varier selon la version d'HugeIcons publiée — si un import échoue, ouvrir `node_modules/@hugeicons/core-free-icons/index.d.ts` pour trouver le nom exact, et corriger la barrel. Cette barrel **est** la liste autoritative — interdiction d'importer une icône directement ailleurs dans le code.)

- [ ] **Step 4: Vérifier que le build passe avec shadcn + HugeIcons**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(ui): install shadcn/ui base components and HugeIcons barrel (Plan 1 task 3)"
```

---

## Task 4 : Setup Prisma + Neon + schéma initial

**Files:**
- Create: `prisma/schema.prisma`, `src/infra/prisma.ts`, `src/env.ts`

- [ ] **Step 1: Installer Prisma 6 + adapter Neon + Zod**

```bash
pnpm add @prisma/client @prisma/adapter-neon @neondatabase/serverless ws
pnpm add -D prisma @types/ws
pnpm add zod
```

- [ ] **Step 2: Initialiser Prisma**

```bash
pnpm exec prisma init --datasource-provider postgresql --output ../generated/prisma
```

Cela crée `prisma/schema.prisma` (à remplacer ci-dessous) et ajoute `DATABASE_URL` à `.env`.

- [ ] **Step 3: Définir le schéma initial complet**

Remplacer entièrement `prisma/schema.prisma` :

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../generated/prisma"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ────────────────────────────── Auth.js v5 standard ──────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?

  // Hawkky additions
  passwordHash  String?   // null si OAuth-only
  plan          UserPlan  @default(free)

  accounts Account[]
  sessions Session[]
  profile  Profile?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum UserPlan {
  free
  pro
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ────────────────────────────── Hawkky Profile ──────────────────────────────

model Profile {
  userId String @id

  isDeveloper           Boolean  @default(true)
  timezone              String   @default("Europe/Paris")  // IANA
  briefingHourLocal     Int      @default(7)               // 0..23
  interests             String[] @default([])
  stackTags             String[] @default([])
  projectsDescription   String?  @db.Text

  followedRepos         String[] @default([])              // owner/name (Plan 2)
  githubLogin           String?
  githubAccessTokenEnc  String?  @db.Text                  // chiffré AES-GCM (Plan 2)

  whatsappNumber        String?                            // E.164
  whatsappEnabled       Boolean  @default(false)

  onboardingCompletedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 4: Créer une branche Neon de dev et configurer `DATABASE_URL`**

Depuis l'UI Neon (https://console.neon.tech) : créer le projet `hawkky` (region `eu-central` ou `eu-west`) → copier l'URL "pooled" + l'URL "direct" pour les migrations.

Renseigner dans `.env.local` (à créer manuellement à partir de `.env.example`) :

```
DATABASE_URL="postgresql://...@...-pooler.../hawkky?sslmode=require"
DIRECT_URL="postgresql://...@.../hawkky?sslmode=require"
```

Et ajouter `directUrl` au datasource dans `prisma/schema.prisma` :

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- [ ] **Step 5: Première migration**

```bash
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
```

Attendu : migration créée dans `prisma/migrations/<timestamp>_init/`, client généré dans `generated/prisma/`.

- [ ] **Step 6: Créer `src/env.ts` (validation Zod des env vars server-only)**

Créer `src/env.ts` :

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
  RESEND_FROM_EMAIL: z.string().email(),
  RESEND_FROM_NAME: z.string().min(1),
});

export const env = serverEnvSchema.parse(process.env);
export type ServerEnv = z.infer<typeof serverEnvSchema>;
```

(Note : ce fichier importe `process.env` au top-level — il ne doit donc être importé que depuis du code server-only. Next.js refusera l'import depuis un client component.)

- [ ] **Step 7: Créer `src/infra/prisma.ts` — singleton + adapter Neon**

```ts
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../generated/prisma";
import ws from "ws";
import { env } from "@/env";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 8: Vérifier que `pnpm typecheck` et `pnpm build` passent**

```bash
pnpm typecheck
pnpm build
```

(Le build peut nécessiter un `pnpm exec prisma generate` au préalable s'il n'a pas été fait après la modification du schéma.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(db): Prisma schema (Auth.js + Profile) with Neon adapter (Plan 1 task 4)"
```

---

## Task 5 : Crypto helper AES-256-GCM (TDD)

**Files:**
- Create: `src/infra/crypto.ts`, `tests/unit/crypto.test.ts`, `vitest.config.ts`

- [ ] **Step 1: Installer Vitest**

```bash
pnpm add -D vitest @vitest/coverage-v8
```

Créer `vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: [],
    globals: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Ajouter dans `package.json` :

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 2: Écrire les tests crypto en premier (test fails)**

Créer `tests/unit/crypto.test.ts` :

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/src/infra/crypto";

beforeAll(() => {
  // Clé test 32 bytes (64 hex chars) — DOIT être dans process.env avant import du module
  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("crypto AES-256-GCM", () => {
  it("round-trips a string", () => {
    const plain = "ghp_super_secret_token_12345";
    const cipher = encrypt(plain);
    expect(cipher).not.toContain(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("detects tampering (auth tag mismatch)", () => {
    const cipher = encrypt("payload");
    // Modifier 1 char au milieu
    const tampered = cipher.slice(0, 30) + (cipher[30] === "a" ? "b" : "a") + cipher.slice(31);
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => decrypt("not-base64-and-too-short")).toThrow();
  });
});
```

- [ ] **Step 3: Tourner les tests pour confirmer qu'ils échouent**

```bash
pnpm test tests/unit/crypto.test.ts
```

Attendu : 4 fails ("module not found" ou "encrypt is not a function").

- [ ] **Step 4: Implémenter `src/infra/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY missing or invalid (must be 32 bytes hex)");
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt plaintext UTF-8 → base64 string `iv|tag|ciphertext`. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a base64 blob produced by `encrypt()`. Throws on tampering or malformed input. */
export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("ciphertext too short");
  }
  const key = getKey();
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 5: Tourner les tests pour confirmer qu'ils passent**

```bash
pnpm test tests/unit/crypto.test.ts
```

Attendu : 4 passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(infra): AES-256-GCM crypto helper with TDD (Plan 1 task 5)"
```

---

## Task 6 : `forUser()` multi-tenancy guard (TDD)

**Files:**
- Create: `src/server/for-user.ts`, `tests/unit/for-user.test.ts`

- [ ] **Step 1: Écrire les tests d'abord**

Créer `tests/unit/for-user.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { forUser } from "@/src/server/for-user";

describe("forUser() multi-tenancy guard", () => {
  it("forwards calls to the underlying delegate, injecting userId in where", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "b1", userId: "u1" });
    const update = vi.fn().mockResolvedValue({ id: "b1" });
    const delegate = { findFirst, update };

    const scoped = forUser(delegate, "u1");

    await scoped.findFirst({ where: { id: "b1" } });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "b1", userId: "u1" },
    });

    await scoped.update({ where: { id: "b1" }, data: { foo: 1 } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "b1", userId: "u1" },
      data: { foo: 1 },
    });
  });

  it("forces userId in `data` for create()", async () => {
    const create = vi.fn().mockResolvedValue({ id: "x" });
    const scoped = forUser({ create }, "u1");
    await scoped.create({ data: { name: "n", userId: "ATTACKER" } });
    expect(create).toHaveBeenCalledWith({ data: { name: "n", userId: "u1" } });
  });

  it("returns null/empty array when query has no userId match (delegate's job)", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const scoped = forUser({ findFirst }, "u1");
    const r = await scoped.findFirst({ where: { id: "b1" } });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier que les tests fail**

```bash
pnpm test tests/unit/for-user.test.ts
```

Attendu : module not found.

- [ ] **Step 3: Implémenter `src/server/for-user.ts`**

```ts
type AnyFn = (...args: unknown[]) => unknown;

type WithWhere = { where?: Record<string, unknown> };
type WithData = { data?: Record<string, unknown> };

const SCOPED_BY_WHERE = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
]);

const SCOPED_BY_DATA = new Set(["create", "createMany", "upsert"]);

/**
 * Wraps a Prisma model delegate so every read/write is implicitly scoped to a userId.
 *
 * Usage in a service:
 *   const briefings = forUser(prisma.briefing, session.user.id);
 *   await briefings.findFirst({ where: { id } });   // implicitly userId-scoped
 *
 * Application code MUST never reach into `prisma.briefing` directly with an
 * id-only `where`, otherwise it can read another tenant's row.
 */
export function forUser<T extends Record<string, unknown>>(delegate: T, userId: string): T {
  return new Proxy(delegate, {
    get(target, prop: string, receiver) {
      const orig = Reflect.get(target, prop, receiver) as AnyFn | undefined;
      if (typeof orig !== "function") return orig;

      if (SCOPED_BY_WHERE.has(prop)) {
        return (args: WithWhere = {}) => {
          const where = { ...(args.where ?? {}), userId };
          return orig.call(target, { ...args, where });
        };
      }

      if (SCOPED_BY_DATA.has(prop)) {
        return (args: WithData = {}) => {
          const data = { ...(args.data ?? {}), userId };
          return orig.call(target, { ...args, data });
        };
      }

      return orig.bind(target);
    },
  }) as T;
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
pnpm test tests/unit/for-user.test.ts
```

Attendu : 3 passing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): multi-tenancy forUser() guard with TDD (Plan 1 task 6)"
```

---

## Task 7 : Resend client (transactional email)

**Files:**
- Create: `src/infra/resend.ts`

- [ ] **Step 1: Implémenter le client minimal**

Resend expose une API REST simple. On code un client avec uniquement `sendTransactional` — appel `fetch` direct (pas le SDK npm `resend`, par cohérence avec les autres intégrations HTTP du projet).

Créer `src/infra/resend.ts` :

```ts
import { env } from "@/env";

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

const RESEND_API_BASE = "https://api.resend.com/emails";

/**
 * Sends a transactional email via Resend HTTP API.
 * Throws on non-2xx responses (caller's responsibility to retry / log).
 */
export async function sendTransactional(input: SendInput): Promise<{ messageId: string }> {
  const from = `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

  const res = await fetch(RESEND_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable>");
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as { id?: string };
  return { messageId: json.id ?? "unknown" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

Notes :
- Le `from` Resend est une string unique au format `"Name <email>"` (pas un objet `{ email, name }`).
- Tant que le domaine n'est pas vérifié sur Resend, `RESEND_FROM_EMAIL` peut être laissé sur un sender de test (`onboarding@resend.dev`) — à ajuster plus tard.
- Si l'endpoint ou le format diffère selon la doc Resend en vigueur — vérifier https://resend.com/docs/api-reference/emails/send-email et ajuster. Le contrat de `sendTransactional` ne doit pas changer.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(infra): Resend transactional email client (Plan 1 task 7)"
```

---

## Task 8 : Auth.js v5 — config + Prisma adapter + handlers

**Files:**
- Create: `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`, `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Installer Auth.js v5 + adapter + bcryptjs**

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

(Si v5 est passée stable au moment de l'exécution, remplacer `@beta` par `@latest` ou `@5`.)

- [ ] **Step 2: Créer `src/auth.config.ts` (edge-compatible)**

Cette config est utilisée par le `middleware` (qui tourne sur Edge) — elle ne doit donc importer ni Prisma ni bcrypt.

```ts
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export default {
  providers: [GitHub, Google],
  pages: {
    signIn: "/signin",
    verifyRequest: "/verify",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLogged = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isAppRoute =
        path.startsWith("/dashboard") ||
        path.startsWith("/onboarding") ||
        path.startsWith("/profile") ||
        path.startsWith("/sources") ||
        path.startsWith("/archive");
      if (isAppRoute) return isLogged;
      return true;
    },
  },
} satisfies NextAuthConfig;
```

- [ ] **Step 3: Créer `src/auth.ts` (node runtime, avec Prisma + Credentials)**

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/src/infra/prisma";
import authConfig from "@/src/auth.config";

const credsSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.emailVerified) return null;
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
```

- [ ] **Step 4: Créer le middleware**

`src/middleware.ts` :

```ts
import NextAuth from "next-auth";
import authConfig from "@/src/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protège le groupe (app) — qui se mappe à ces URLs :
  matcher: ["/", "/onboarding/:path*", "/profile/:path*", "/sources/:path*", "/archive/:path*"],
};
```

**Décision routing** : la route `/` est réservée à la landing publique (`(marketing)`). Le dashboard de l'app est `/dashboard` (donc `app/(app)/dashboard/page.tsx`, créé en Task 13). Cela évite toute ambiguïté entre route marketing et route app sur le même chemin. Les boutons "Commencer" / "Se connecter" de la landing pointent vers `/signup` et `/signin`.

- [ ] **Step 5: Créer le route handler Auth.js**

`app/api/auth/[...nextauth]/route.ts` :

```ts
import { handlers } from "@/src/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 6: Vérifier le typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): Auth.js v5 with Prisma adapter, GitHub/Google/Credentials providers (Plan 1 task 8)"
```

---

## Task 9 : Server actions de signup et vérification email

**Files:**
- Create: `src/server/auth-actions.ts`, `app/api/verify-email/route.ts`, `src/domain/profile/schemas.ts`

- [ ] **Step 1: Définir les schémas Zod du profile (déjà utilisés par `auth-actions` pour l'email)**

Créer `src/domain/profile/schemas.ts` :

```ts
import { z } from "zod";

export const emailSchema = z.string().email().toLowerCase().max(254);
export const passwordSchema = z
  .string()
  .min(8, "Au moins 8 caractères")
  .max(200, "Trop long");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const onboardingStep1Schema = z.object({
  isDeveloper: z.boolean(),
});

export const onboardingStep2Schema = z.object({
  interests: z.array(z.string().min(1).max(40)).min(1).max(20),
});

export const onboardingStep3DevSchema = z.object({
  stackTags: z.array(z.string().min(1).max(40)).max(40),
  projectsDescription: z.string().max(2000).optional(),
});

export const onboardingStep3NonDevSchema = z.object({
  rssUrls: z.array(z.string().url().max(2048)).max(20).default([]),
  subreddits: z
    .array(
      z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, "Subreddit invalide"),
    )
    .max(20)
    .default([]),
});

export const onboardingStep4Schema = z.object({
  timezone: z.string().min(1).max(60), // IANA, ex "Europe/Paris"
  briefingHourLocal: z.number().int().min(0).max(23),
  whatsappEnabled: z.boolean().default(false),
  whatsappNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Numéro E.164 attendu (+...)") 
    .optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
```

- [ ] **Step 2: Implémenter `auth-actions.ts`**

Créer `src/server/auth-actions.ts` :

```ts
"use server";

import { hash } from "bcryptjs";
import { randomBytes, createHmac } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/src/infra/prisma";
import { sendTransactional } from "@/src/infra/resend";
import { signupSchema, emailSchema } from "@/src/domain/profile/schemas";
import { env } from "@/env";

const VERIFY_TOKEN_TTL_MIN = 60 * 24; // 24h

function makeVerifyToken(email: string): string {
  const payload = `${email}|${Date.now()}|${randomBytes(16).toString("hex")}`;
  const hmac = createHmac("sha256", env.AUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

function parseVerifyToken(token: string): { email: string; issuedAt: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [email, ts, nonce, hmac] = parts;
    const expected = createHmac("sha256", env.AUTH_SECRET)
      .update(`${email}|${ts}|${nonce}`)
      .digest("hex");
    if (expected !== hmac) return null;
    return { email, issuedAt: Number(ts) };
  } catch {
    return null;
  }
}

export async function signupAction(input: unknown): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide" };
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.emailVerified) {
    return { ok: false, error: "Un compte existe déjà avec cet email" };
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      passwordHash,
      profile: { create: {} }, // crée Profile vide avec defaults
    },
  });

  const token = makeVerifyToken(email);
  const verifyUrl = `${env.NEXTAUTH_URL}/api/verify-email?token=${token}`;

  await sendTransactional({
    to: email,
    subject: "Confirme ton email pour Hawkky",
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:22px;margin:0 0 16px;">Bienvenue sur Hawkky 👋</h1>
        <p style="color:#444;line-height:1.5;">
          Confirme ton email pour activer ton compte et recevoir ton premier briefing demain matin.
        </p>
        <p style="margin:24px 0;">
          <a href="${verifyUrl}"
             style="display:inline-block;padding:12px 20px;background:#111;color:#fff;
                    border-radius:8px;text-decoration:none;font-weight:500;">
            Confirmer mon email
          </a>
        </p>
        <p style="color:#888;font-size:13px;">
          Ou colle ce lien dans ton navigateur :<br/>
          <span style="word-break:break-all">${verifyUrl}</span>
        </p>
      </div>
    `,
  });

  return { ok: true };
}

export async function consumeVerifyToken(
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const parsed = parseVerifyToken(token);
  if (!parsed) return { ok: false, error: "Lien invalide" };
  const ageMin = (Date.now() - parsed.issuedAt) / 1000 / 60;
  if (ageMin > VERIFY_TOKEN_TTL_MIN) return { ok: false, error: "Lien expiré" };

  const emailParse = emailSchema.safeParse(parsed.email);
  if (!emailParse.success) return { ok: false, error: "Email invalide" };
  const email = emailParse.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, error: "Compte introuvable" };
  if (user.emailVerified) return { ok: true, email };

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });
  return { ok: true, email };
}

export async function resendVerifyAction(emailRaw: unknown): Promise<{ ok: true }> {
  const email = emailSchema.parse(emailRaw);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return { ok: true }; // ne pas leak l'existence
  const token = makeVerifyToken(email);
  const verifyUrl = `${env.NEXTAUTH_URL}/api/verify-email?token=${token}`;
  await sendTransactional({
    to: email,
    subject: "Nouveau lien de confirmation Hawkky",
    html: `<p>Voici un nouveau lien de confirmation : <a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
  return { ok: true };
}
```

- [ ] **Step 3: Implémenter le route handler `/api/verify-email`**

Créer `app/api/verify-email/route.ts` :

```ts
import { NextResponse } from "next/server";
import { consumeVerifyToken } from "@/src/server/auth-actions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/verify?status=missing", url));
  }
  const result = await consumeVerifyToken(token);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/verify?status=error&msg=${encodeURIComponent(result.error)}`, url),
    );
  }
  return NextResponse.redirect(new URL("/verify?status=ok", url));
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): signup + email verification (HMAC token + Resend) (Plan 1 task 9)"
```

---

## Task 10 : Pages signin / signup / verify (UI shadcn)

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/signin/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/verify/page.tsx`

- [ ] **Step 1: Layout commun centré**

Créer `app/(auth)/layout.tsx` :

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Page signup**

Créer `app/(auth)/signup/page.tsx` :

```tsx
"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signupAction } from "@/src/server/auth-actions";

export default function SignupPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    startTransition(async () => {
      const r = await signupAction({ email, password });
      if (!r.ok) setError(r.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vérifie ta boîte mail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            On t'a envoyé un lien de confirmation. Clique dessus pour activer ton compte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte Hawkky</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Button variant="outline" onClick={() => signIn("github", { callbackUrl: "/onboarding" })}>
            Continuer avec GitHub
          </Button>
          <Button variant="outline" onClick={() => signIn("google", { callbackUrl: "/onboarding" })}>
            Continuer avec Google
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">ou</span>
          <Separator className="flex-1" />
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Création…" : "Créer mon compte"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center">
          Déjà un compte ?{" "}
          <a href="/signin" className="underline">Se connecter</a>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Page signin**

Créer `app/(auth)/signin/page.tsx` :

```tsx
"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SigninPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    startTransition(async () => {
      const r = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!r || r.error) {
        setError("Email ou mot de passe incorrect, ou compte non vérifié.");
      } else {
        window.location.href = "/dashboard";
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Button variant="outline" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
            Continuer avec GitHub
          </Button>
          <Button variant="outline" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
            Continuer avec Google
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">ou</span>
          <Separator className="flex-1" />
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center">
          Pas encore de compte ?{" "}
          <a href="/signup" className="underline">S'inscrire</a>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Page verify (rendu selon `?status=`)**

Créer `app/(auth)/verify/page.tsx` :

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Search = { status?: "ok" | "error" | "missing"; msg?: string };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { status, msg } = await searchParams;

  if (status === "ok") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email vérifié ✅</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ton compte est activé. Tu peux maintenant <a href="/signin" className="underline">te connecter</a>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "error" || status === "missing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lien invalide</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{msg ?? "Le lien est invalide ou expiré."}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Re-tente une inscription ou contacte le support.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérification email</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Si tu viens de t'inscrire, vérifie ta boîte mail et clique sur le lien reçu.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Tester manuellement le flow**

Avec `pnpm dev` :
1. Aller sur `/signup`, créer un compte avec un email de test → "Vérifie ta boîte mail" doit apparaître.
2. Récupérer le lien dans Resend (ou logs locaux) → cliquer → "Email vérifié ✅".
3. Aller sur `/signin`, se connecter → redirige vers `/dashboard` (qui n'existe pas encore — 404 attendue à ce stade).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): signin / signup / verify pages (Plan 1 task 10)"
```

---

## Task 11 : Profile service + onboarding shell + étape 1

**Files:**
- Create: `src/server/profile-service.ts`, `src/ui/onboarding/OnboardingShell.tsx`, `src/ui/onboarding/Step1ProfileType.tsx`, `app/(app)/onboarding/page.tsx`, `src/domain/profile/types.ts`

- [ ] **Step 1: Définir les types domain**

Créer `src/domain/profile/types.ts` :

```ts
export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export type ProfileSnapshot = {
  isDeveloper: boolean;
  timezone: string;
  briefingHourLocal: number;
  interests: string[];
  stackTags: string[];
  projectsDescription: string | null;
  followedRepos: string[];
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  onboardingCompletedAt: Date | null;
};
```

- [ ] **Step 2: Implémenter `profile-service.ts`**

Créer `src/server/profile-service.ts` :

```ts
import { prisma } from "@/src/infra/prisma";
import {
  onboardingStep1Schema,
  onboardingStep2Schema,
  onboardingStep3DevSchema,
  onboardingStep3NonDevSchema,
  onboardingStep4Schema,
} from "@/src/domain/profile/schemas";
import type { ProfileSnapshot, OnboardingStep } from "@/src/domain/profile/types";

export async function getOrInitProfile(userId: string): Promise<ProfileSnapshot> {
  const profile = await prisma.profile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return {
    isDeveloper: profile.isDeveloper,
    timezone: profile.timezone,
    briefingHourLocal: profile.briefingHourLocal,
    interests: profile.interests,
    stackTags: profile.stackTags,
    projectsDescription: profile.projectsDescription,
    followedRepos: profile.followedRepos,
    whatsappEnabled: profile.whatsappEnabled,
    whatsappNumber: profile.whatsappNumber,
    onboardingCompletedAt: profile.onboardingCompletedAt,
  };
}

export async function saveOnboardingStep(
  userId: string,
  step: OnboardingStep,
  data: unknown,
): Promise<void> {
  switch (step) {
    case 1: {
      const parsed = onboardingStep1Schema.parse(data);
      await prisma.profile.update({
        where: { userId },
        data: { isDeveloper: parsed.isDeveloper },
      });
      return;
    }
    case 2: {
      const parsed = onboardingStep2Schema.parse(data);
      await prisma.profile.update({
        where: { userId },
        data: { interests: parsed.interests },
      });
      return;
    }
    case 3: {
      const profile = await prisma.profile.findUniqueOrThrow({ where: { userId } });
      if (profile.isDeveloper) {
        const parsed = onboardingStep3DevSchema.parse(data);
        await prisma.profile.update({
          where: { userId },
          data: {
            stackTags: parsed.stackTags,
            projectsDescription: parsed.projectsDescription ?? null,
          },
        });
      } else {
        const _parsed = onboardingStep3NonDevSchema.parse(data);
        // Les sources (RSS, subreddits) seront persistées en Plan 2 dans Source/Subscription.
        // Pour le Plan 1, on accepte la donnée mais on ne la stocke pas encore — pas de `Source`
        // table à ce stade. Cette branche est volontairement no-op au niveau DB.
      }
      return;
    }
    case 4: {
      const parsed = onboardingStep4Schema.parse(data);
      await prisma.profile.update({
        where: { userId },
        data: {
          timezone: parsed.timezone,
          briefingHourLocal: parsed.briefingHourLocal,
          whatsappEnabled: parsed.whatsappEnabled,
          whatsappNumber: parsed.whatsappEnabled ? (parsed.whatsappNumber ?? null) : null,
        },
      });
      return;
    }
    case 5: {
      await prisma.profile.update({
        where: { userId },
        data: { onboardingCompletedAt: new Date() },
      });
      return;
    }
  }
}
```

(Note explicite dans le code : la branche non-dev de Step 3 est no-op tant qu'on n'a pas la table `Source`. Cette TODO est tracée par la spec, sera complétée en Plan 2.)

- [ ] **Step 3: Onboarding shell + step indicator**

Créer `src/ui/onboarding/OnboardingShell.tsx` :

```tsx
"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OnboardingShell({
  step,
  total,
  title,
  children,
}: {
  step: number;
  total: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="text-xs text-muted-foreground mb-2">
            Étape {step} / {total}
          </div>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Step 1 component**

Créer `src/ui/onboarding/Step1ProfileType.tsx` :

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveOnboardingStepAction } from "./actions";

export function Step1ProfileType({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(isDev: boolean) {
    startTransition(async () => {
      await saveOnboardingStepAction(1, { isDeveloper: isDev });
      router.push("/onboarding?step=2");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        On adapte les sources et les conseils à ton profil.
      </p>
      <div className="grid grid-cols-1 gap-3 mt-4">
        <Card
          className={`cursor-pointer hover:border-foreground transition ${initial ? "border-foreground" : ""}`}
          onClick={() => pick(true)}
        >
          <CardContent className="p-4">
            <div className="font-medium">Développeur·se</div>
            <div className="text-sm text-muted-foreground">
              On va te demander ton stack et tes projets pour personnaliser.
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer hover:border-foreground transition ${!initial ? "border-foreground" : ""}`}
          onClick={() => pick(false)}
        >
          <CardContent className="p-4">
            <div className="font-medium">Curieux·se tech (non-dev)</div>
            <div className="text-sm text-muted-foreground">
              On se base sur tes centres d'intérêt et tes sources préférées.
            </div>
          </CardContent>
        </Card>
      </div>
      <Button variant="ghost" disabled={pending} className="w-full mt-2">
        {pending ? "…" : "Choisis pour continuer"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Server action partagée pour les steps**

Créer `src/ui/onboarding/actions.ts` :

```ts
"use server";

import { auth } from "@/src/auth";
import { saveOnboardingStep } from "@/src/server/profile-service";
import type { OnboardingStep } from "@/src/domain/profile/types";

export async function saveOnboardingStepAction(step: OnboardingStep, data: unknown) {
  const session = await auth();
  if (!session?.user.id) throw new Error("Not authenticated");
  await saveOnboardingStep(session.user.id, step, data);
  return { ok: true };
}
```

- [ ] **Step 6: Page d'onboarding qui dispatch sur le bon step**

Créer `app/(app)/onboarding/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";
import { OnboardingShell } from "@/src/ui/onboarding/OnboardingShell";
import { Step1ProfileType } from "@/src/ui/onboarding/Step1ProfileType";
// les autres steps seront ajoutés Task 12

const TOTAL = 5;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/signin");

  const profile = await getOrInitProfile(session.user.id);
  if (profile.onboardingCompletedAt) redirect("/dashboard");

  const sp = await searchParams;
  const step = Math.min(Math.max(Number(sp.step ?? 1), 1), TOTAL);

  if (step === 1) {
    return (
      <OnboardingShell step={1} total={TOTAL} title="Tu es plutôt…">
        <Step1ProfileType initial={profile.isDeveloper} />
      </OnboardingShell>
    );
  }

  // Steps 2-5 ajoutés Task 12
  return (
    <OnboardingShell step={step} total={TOTAL} title="…">
      <p className="text-sm text-muted-foreground">À venir (Task 12)</p>
    </OnboardingShell>
  );
}
```

- [ ] **Step 7: Vérifier le flow Step 1 manuellement**

Avec `pnpm dev` :
1. Se connecter en tant qu'utilisateur vérifié.
2. Aller sur `/onboarding` → écran "Tu es plutôt…".
3. Choisir un type → en DB, `Profile.isDeveloper` est mis à jour.
4. La page se recharge sur `?step=2` (placeholder pour le moment).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(onboarding): profile service + shell + step 1 (profile type) (Plan 1 task 11)"
```

---

## Task 12 : Onboarding steps 2 à 5

**Files:**
- Create: `src/ui/onboarding/Step2Interests.tsx`, `Step3DevStack.tsx`, `Step3NonDevSources.tsx`, `Step4Delivery.tsx`, `Step5Done.tsx`
- Modify: `app/(app)/onboarding/page.tsx`

- [ ] **Step 1: Step 2 — centres d'intérêt (multi-select)**

Créer `src/ui/onboarding/Step2Interests.tsx` :

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveOnboardingStepAction } from "./actions";

const PRESETS = [
  "IA", "IA agentique", "LLMs", "Frontend", "Backend", "DevOps", "Sécurité",
  "Web3", "Design", "Startups", "Open source", "Mobile", "Data", "Cloud",
  "Performance", "Accessibilité", "Productivité",
];

export function Step2Interests({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustom() {
    const t = custom.trim();
    if (!t) return;
    if (!selected.includes(t)) setSelected((p) => [...p, t]);
    setCustom("");
  }

  function next() {
    start(async () => {
      await saveOnboardingStepAction(2, { interests: selected });
      router.push("/onboarding?step=3");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choisis au moins un sujet (et ajoute les tiens si besoin).
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set([...PRESETS, ...selected])).map((tag) => (
          <Badge
            key={tag}
            variant={selected.includes(tag) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggle(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Ajouter un sujet personnalisé"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button variant="outline" onClick={addCustom}>+</Button>
      </div>
      <Button onClick={next} disabled={pending || selected.length === 0} className="w-full">
        {pending ? "…" : "Continuer"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Step 3 dev — stack tags + projets**

Créer `src/ui/onboarding/Step3DevStack.tsx` :

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveOnboardingStepAction } from "./actions";

const PRESETS = [
  "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python", "Go",
  "Rust", "Postgres", "Redis", "Tailwind", "Prisma", "Docker", "Kubernetes",
  "Vercel", "AWS", "GCP", "Supabase", "tRPC", "GraphQL",
];

export function Step3DevStack({
  initialTags,
  initialDescription,
}: {
  initialTags: string[];
  initialDescription: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [custom, setCustom] = useState("");

  function toggle(t: string) {
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  }
  function addCustom() {
    const t = custom.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags((p) => [...p, t]);
    setCustom("");
  }

  function next() {
    start(async () => {
      await saveOnboardingStepAction(3, {
        stackTags: tags,
        projectsDescription: description || undefined,
      });
      router.push("/onboarding?step=4");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ton stack (langues, frameworks, libs). Plus c'est précis, plus le briefing sera ciblé.
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set([...PRESETS, ...tags])).map((t) => (
          <Badge
            key={t}
            variant={tags.includes(t) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggle(t)}
          >
            {t}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Ajouter une techno"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button variant="outline" onClick={addCustom}>+</Button>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">
          Tes projets en cours <span className="text-muted-foreground">(optionnel)</span>
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Ex: SaaS de gestion d'événements en Next.js, app mobile de méditation en React Native…"
        />
      </div>
      <Button onClick={next} disabled={pending} className="w-full">
        {pending ? "…" : "Continuer"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Step 3 non-dev — sources préférées**

Créer `src/ui/onboarding/Step3NonDevSources.tsx` :

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveOnboardingStepAction } from "./actions";

export function Step3NonDevSources() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rss, setRss] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [rssInput, setRssInput] = useState("");
  const [subInput, setSubInput] = useState("");

  function addRss() {
    const url = rssInput.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      return;
    }
    if (!rss.includes(url)) setRss((p) => [...p, url]);
    setRssInput("");
  }
  function addSub() {
    const s = subInput.trim().replace(/^r\//, "");
    if (!/^[a-zA-Z0-9_]+$/.test(s)) return;
    if (!subs.includes(s)) setSubs((p) => [...p, s]);
    setSubInput("");
  }

  function next() {
    start(async () => {
      await saveOnboardingStepAction(3, { rssUrls: rss, subreddits: subs });
      router.push("/onboarding?step=4");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Tes sources préférées (optionnel — tu pourras en ajouter plus tard).
      </p>

      <div>
        <label className="text-sm font-medium block mb-1">Flux RSS</label>
        <div className="flex gap-2">
          <Input
            value={rssInput}
            onChange={(e) => setRssInput(e.target.value)}
            placeholder="https://blog.exemple.com/feed.xml"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRss();
              }
            }}
          />
          <Button variant="outline" onClick={addRss}>+</Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {rss.map((u) => (
            <Badge key={u} variant="secondary" className="font-mono text-xs">
              {u.replace(/^https?:\/\//, "").slice(0, 40)}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Subreddits</label>
        <div className="flex gap-2">
          <Input
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            placeholder="programming"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
          />
          <Button variant="outline" onClick={addSub}>+</Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {subs.map((s) => (
            <Badge key={s} variant="secondary">r/{s}</Badge>
          ))}
        </div>
      </div>

      <Button onClick={next} disabled={pending} className="w-full">
        {pending ? "…" : "Continuer"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Step 4 — livraison (TZ, heure, WhatsApp)**

Créer `src/ui/onboarding/Step4Delivery.tsx` :

```tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { saveOnboardingStepAction } from "./actions";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function Step4Delivery({
  initialTimezone,
  initialHour,
  initialWhatsappEnabled,
  initialWhatsappNumber,
}: {
  initialTimezone: string;
  initialHour: number;
  initialWhatsappEnabled: boolean;
  initialWhatsappNumber: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tz, setTz] = useState(initialTimezone);
  const [hour, setHour] = useState(String(initialHour));
  const [waEnabled, setWaEnabled] = useState(initialWhatsappEnabled);
  const [waNumber, setWaNumber] = useState(initialWhatsappNumber ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTimezone === "Europe/Paris") {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) setTz(detected);
      } catch {
        // keep default
      }
    }
  }, [initialTimezone]);

  function next() {
    setError(null);
    if (waEnabled && !/^\+[1-9]\d{6,14}$/.test(waNumber)) {
      setError("Numéro WhatsApp attendu au format E.164 (+33...)");
      return;
    }
    start(async () => {
      await saveOnboardingStepAction(4, {
        timezone: tz,
        briefingHourLocal: Number(hour),
        whatsappEnabled: waEnabled,
        whatsappNumber: waEnabled ? waNumber : undefined,
      });
      // Marquer onboarding comme complété
      await saveOnboardingStepAction(5, {});
      router.push("/onboarding?step=5");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        On t'envoie ton briefing chaque matin à l'heure que tu préfères.
      </p>

      <div className="space-y-1">
        <Label htmlFor="tz">Fuseau horaire</Label>
        <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Format IANA (ex: Europe/Paris, America/New_York). Auto-détecté.
        </p>
      </div>

      <div className="space-y-1">
        <Label>Heure de réception</Label>
        <Select value={hour} onValueChange={setHour}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, "0")}:00
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="wa"
          checked={waEnabled}
          onCheckedChange={(c) => setWaEnabled(c === true)}
        />
        <Label htmlFor="wa" className="cursor-pointer">
          Recevoir aussi par WhatsApp
        </Label>
      </div>
      {waEnabled && (
        <div className="space-y-1">
          <Label htmlFor="wa-num">Numéro WhatsApp (E.164)</Label>
          <Input
            id="wa-num"
            value={waNumber}
            onChange={(e) => setWaNumber(e.target.value)}
            placeholder="+33612345678"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={next} disabled={pending} className="w-full">
        {pending ? "…" : "Recevoir mon premier briefing demain matin"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Step 5 — confirmation finale**

Créer `src/ui/onboarding/Step5Done.tsx` :

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function Step5Done({ hour, tz }: { hour: number; tz: string }) {
  const router = useRouter();
  return (
    <div className="space-y-4 text-center">
      <p className="text-2xl">🎉</p>
      <p className="text-sm text-muted-foreground">
        Tout est prêt. Ton premier briefing arrivera demain à
        <strong className="ml-1">
          {String(hour).padStart(2, "0")}:00 ({tz})
        </strong>
        .
      </p>
      <Button onClick={() => router.push("/dashboard")} className="w-full">
        Aller au dashboard
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Mettre à jour `app/(app)/onboarding/page.tsx` pour dispatcher tous les steps**

Remplacer entièrement le fichier :

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";
import { OnboardingShell } from "@/src/ui/onboarding/OnboardingShell";
import { Step1ProfileType } from "@/src/ui/onboarding/Step1ProfileType";
import { Step2Interests } from "@/src/ui/onboarding/Step2Interests";
import { Step3DevStack } from "@/src/ui/onboarding/Step3DevStack";
import { Step3NonDevSources } from "@/src/ui/onboarding/Step3NonDevSources";
import { Step4Delivery } from "@/src/ui/onboarding/Step4Delivery";
import { Step5Done } from "@/src/ui/onboarding/Step5Done";

const TOTAL = 5;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/signin");

  const profile = await getOrInitProfile(session.user.id);
  if (profile.onboardingCompletedAt) redirect("/dashboard");

  const sp = await searchParams;
  const step = Math.min(Math.max(Number(sp.step ?? 1), 1), TOTAL);

  switch (step) {
    case 1:
      return (
        <OnboardingShell step={1} total={TOTAL} title="Tu es plutôt…">
          <Step1ProfileType initial={profile.isDeveloper} />
        </OnboardingShell>
      );
    case 2:
      return (
        <OnboardingShell step={2} total={TOTAL} title="Tes centres d'intérêt">
          <Step2Interests initial={profile.interests} />
        </OnboardingShell>
      );
    case 3:
      return (
        <OnboardingShell
          step={3}
          total={TOTAL}
          title={profile.isDeveloper ? "Ton stack et tes projets" : "Tes sources préférées"}
        >
          {profile.isDeveloper ? (
            <Step3DevStack
              initialTags={profile.stackTags}
              initialDescription={profile.projectsDescription}
            />
          ) : (
            <Step3NonDevSources />
          )}
        </OnboardingShell>
      );
    case 4:
      return (
        <OnboardingShell step={4} total={TOTAL} title="Quand recevoir ton briefing ?">
          <Step4Delivery
            initialTimezone={profile.timezone}
            initialHour={profile.briefingHourLocal}
            initialWhatsappEnabled={profile.whatsappEnabled}
            initialWhatsappNumber={profile.whatsappNumber}
          />
        </OnboardingShell>
      );
    case 5:
      return (
        <OnboardingShell step={5} total={TOTAL} title="C'est prêt !">
          <Step5Done hour={profile.briefingHourLocal} tz={profile.timezone} />
        </OnboardingShell>
      );
  }
}
```

- [ ] **Step 7: Vérifier le flow complet manuellement**

Avec `pnpm dev` et un user vérifié :
1. `/onboarding` → step 1 → choix dev → step 2.
2. Step 2 → cocher quelques tags → continuer → step 3.
3. Step 3 (dev) → renseigner stack + description → step 4.
4. Step 4 → fixer tz + heure → "Recevoir mon premier briefing demain matin" → step 5.
5. Step 5 → "Aller au dashboard".
6. En DB : `Profile.onboardingCompletedAt` non null, tous les champs renseignés.
7. Refaire `/onboarding` → redirect vers `/dashboard` (pas de re-onboarding).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(onboarding): steps 2-5 (interests, stack/sources, delivery, done) (Plan 1 task 12)"
```

---

## Task 13 : Layout (app), dashboard placeholder, profile page, multi-tenancy integration test

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/profile/page.tsx`, `app/(app)/sources/page.tsx`, `tests/integration/auth-multi-tenant.test.ts`, `tests/setup/prisma-test.ts`

- [ ] **Step 1: Layout `(app)` avec sidebar shadcn + auth guard**

Créer `app/(app)/layout.tsx` :

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user.id) redirect("/signin");

  const profile = await getOrInitProfile(session.user.id);
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border p-4 flex flex-col gap-2 bg-muted/20">
        <div className="font-semibold text-lg mb-4">Hawkky</div>
        <Link href="/dashboard" className="text-sm hover:underline">Dashboard</Link>
        <Link href="/sources" className="text-sm hover:underline">Sources</Link>
        <Link href="/profile" className="text-sm hover:underline">Profil</Link>
        <Separator className="my-3" />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button variant="ghost" size="sm" type="submit" className="w-full justify-start">
            Se déconnecter
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-8 max-w-3xl mx-auto w-full">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Dashboard placeholder**

Créer `app/(app)/dashboard/page.tsx` :

```tsx
import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user.id) return null;
  const profile = await getOrInitProfile(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bonjour 👋</h1>
      <div className="rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground mb-2">Prochain briefing</p>
        <p className="text-lg font-medium">
          Demain à {String(profile.briefingHourLocal).padStart(2, "0")}:00 ({profile.timezone})
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Le pipeline d'ingestion et de génération sera branché aux prochains plans.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Profile page (édition)**

Créer `app/(app)/profile/page.tsx` :

```tsx
import { auth } from "@/src/auth";
import { getOrInitProfile } from "@/src/server/profile-service";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user.id) return null;
  const profile = await getOrInitProfile(session.user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profil</h1>
      <pre className="text-xs bg-muted p-4 rounded">
        {JSON.stringify(profile, null, 2)}
      </pre>
      <p className="text-sm text-muted-foreground">
        Édition fine ajoutée au Plan 2 (en même temps que la gestion des sources).
      </p>
    </div>
  );
}
```

(L'édition fine est volontairement réduite à un read-only pour le Plan 1 — l'onboarding écrit déjà tous les champs. L'édition complète est tracée dans `Plan 2` après ajout des sources.)

- [ ] **Step 4: Sources placeholder (sera implémenté Plan 2)**

Créer `app/(app)/sources/page.tsx` :

```tsx
export default function SourcesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sources</h1>
      <p className="text-sm text-muted-foreground">
        Disponible dans le Plan 2 — gestion des flux RSS, subreddits, repos GitHub suivis.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Test d'intégration multi-tenant**

Créer `tests/setup/prisma-test.ts` :

```ts
import { PrismaClient } from "../../generated/prisma";

// Utilise une URL de test séparée. À renseigner dans .env.test (gitignored).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!;

export const testPrisma = new PrismaClient();

export async function resetDb() {
  // Ordre respectant les FKs
  await testPrisma.session.deleteMany();
  await testPrisma.account.deleteMany();
  await testPrisma.verificationToken.deleteMany();
  await testPrisma.profile.deleteMany();
  await testPrisma.user.deleteMany();
}
```

Créer `tests/integration/auth-multi-tenant.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { testPrisma, resetDb } from "../setup/prisma-test";
import { forUser } from "@/src/server/for-user";

beforeAll(async () => {
  await resetDb();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe("multi-tenant isolation via forUser()", () => {
  it("prevents user A from reading user B's profile", async () => {
    const a = await testPrisma.user.create({
      data: { email: "a@test.local", profile: { create: {} } },
    });
    const b = await testPrisma.user.create({
      data: { email: "b@test.local", profile: { create: { interests: ["secret"] } } },
    });

    const scoped = forUser(testPrisma.profile, a.id);
    const found = await scoped.findFirst({ where: { userId: b.id } });
    expect(found).toBeNull();
  });

  it("prevents user A from updating user B's profile", async () => {
    const a = await testPrisma.user.create({
      data: { email: "a2@test.local", profile: { create: {} } },
    });
    const b = await testPrisma.user.create({
      data: { email: "b2@test.local", profile: { create: { interests: ["initial"] } } },
    });

    const scoped = forUser(testPrisma.profile, a.id);
    const result = await scoped.updateMany({
      where: { userId: b.id },
      data: { interests: ["hijacked"] },
    });
    expect(result.count).toBe(0);

    const bProfile = await testPrisma.profile.findUnique({ where: { userId: b.id } });
    expect(bProfile?.interests).toEqual(["initial"]);
  });
});
```

Ajouter dans `vitest.config.ts` la config pour les tests d'intégration :

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: [],
    globals: false,
    testTimeout: 15000, // intégration DB peut être un peu plus lente
    fileParallelism: false, // intégration DB → pas de parallélisme entre fichiers
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 6: Tourner tous les tests**

```bash
# Préalable : créer une branche Neon dédiée aux tests (depuis l'UI Neon → "Branches")
# et renseigner TEST_DATABASE_URL dans .env.local
pnpm exec prisma migrate deploy --schema prisma/schema.prisma  # sur la branche test
pnpm test
```

Attendu : tous les tests unit + intégration passent.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(app): app layout, dashboard, profile read-only, multi-tenancy integration tests (Plan 1 task 13)"
```

---

## Task 14 : CI GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Rédiger le workflow CI**

Créer `.github/workflows/ci.yml` :

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    name: Lint, typecheck, unit tests, build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm exec prisma generate

      - run: pnpm lint

      - run: pnpm typecheck

      - name: Unit tests (no DB)
        env:
          ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
          AUTH_SECRET: ci-secret-32chars-minimum-padding-padding
          NEXTAUTH_URL: http://localhost:3000
          DATABASE_URL: postgresql://noop:noop@localhost:5432/noop
          FEEDBACK_SECRET: ci-feedback-secret-32chars-padding-padding
          RESEND_API_KEY: ci-key
          RESEND_FROM_EMAIL: noreply@hawkky.app
          RESEND_FROM_NAME: Hawkky
        run: pnpm test tests/unit

      - name: Build
        env:
          ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
          AUTH_SECRET: ci-secret-32chars-minimum-padding-padding
          NEXTAUTH_URL: http://localhost:3000
          DATABASE_URL: postgresql://noop:noop@localhost:5432/noop
          FEEDBACK_SECRET: ci-feedback-secret-32chars-padding-padding
          RESEND_API_KEY: ci-key
          RESEND_FROM_EMAIL: noreply@hawkky.app
          RESEND_FROM_NAME: Hawkky
        run: pnpm build
```

(Les tests d'intégration nécessitent une DB → ils ne tournent **pas** en CI au Plan 1 ; ils tourneront en nightly via une branche Neon dédiée — à brancher Plan 5.)

- [ ] **Step 2: Push pour vérifier la CI sur GitHub**

```bash
git add -A
git commit -m "ci: lint + typecheck + unit tests + build (Plan 1 task 14)"
git push  # nécessite que le repo distant existe (à créer manuellement sur GitHub si pas fait)
```

Vérifier que le workflow passe au vert sur GitHub Actions.

---

## Task 15 : Test E2E Playwright (signup → onboarding)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/signup-onboarding.spec.ts`

- [ ] **Step 1: Installer Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

Créer `playwright.config.ts` :

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

Ajouter dans `package.json` :

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

- [ ] **Step 2: Helper de seed pour bypass de vérification email en E2E**

Pour ne pas avoir à intercepter Resend en CI, on autorise un endpoint admin de "force-verify" en mode test, gated par une env `E2E_TEST_SECRET` non publique.

Créer `app/api/test/force-verify/route.ts` :

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/src/infra/prisma";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || !process.env.E2E_TEST_SECRET) {
    return new NextResponse("Not found", { status: 404 });
  }
  const auth = req.headers.get("x-test-secret");
  if (auth !== process.env.E2E_TEST_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { email } = (await req.json()) as { email: string };
  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Test E2E**

Créer `tests/e2e/signup-onboarding.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

const E2E_SECRET = process.env.E2E_TEST_SECRET ?? "e2e-secret";

test("signup → verify (forced) → signin → onboarding → dashboard", async ({ page, request }) => {
  const email = `e2e+${Date.now()}@hawkky.test`;
  const password = "test-password-123";

  // 1) Signup
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: /créer mon compte/i }).click();
  await expect(page.getByText(/Vérifie ta boîte mail/i)).toBeVisible();

  // 2) Force verify (bypass Resend en E2E)
  const r = await request.post("/api/test/force-verify", {
    headers: { "x-test-secret": E2E_SECRET, "content-type": "application/json" },
    data: { email },
  });
  expect(r.ok()).toBeTruthy();

  // 3) Signin
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();

  // 4) Onboarding step 1
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByText(/Tu es plutôt/)).toBeVisible();
  await page.getByText(/Développeur/).click();

  // 5) Onboarding step 2
  await page.waitForURL(/step=2/);
  await page.getByText("IA", { exact: true }).first().click();
  await page.getByText("Frontend").click();
  await page.getByRole("button", { name: /continuer/i }).click();

  // 6) Step 3 dev
  await page.waitForURL(/step=3/);
  await page.getByText("TypeScript").first().click();
  await page.getByText("Next.js").click();
  await page.getByRole("button", { name: /continuer/i }).click();

  // 7) Step 4 livraison
  await page.waitForURL(/step=4/);
  await page.getByRole("button", { name: /Recevoir mon premier briefing/ }).click();

  // 8) Step 5 done → dashboard
  await page.waitForURL(/step=5/);
  await page.getByRole("button", { name: /Aller au dashboard/ }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(/Prochain briefing/)).toBeVisible();
});
```

- [ ] **Step 4: Lancer le test**

```bash
# Préalable : .env.local doit contenir E2E_TEST_SECRET=e2e-secret
pnpm exec playwright test
```

Attendu : test passing en ~10-30s.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): signup → onboarding → dashboard happy path (Plan 1 task 15)"
```

---

## Task 16 : Tag de release du Plan 1

- [ ] **Step 1: Vérifier l'état global**

```bash
pnpm lint
pnpm typecheck
pnpm test tests/unit
pnpm build
```

Tous doivent passer sans erreur.

- [ ] **Step 2: Tag**

```bash
git tag -a hawkky-v0.1.0-foundation -m "Plan 1 done: Foundation & Auth"
git push --tags
```

---

## Critères de complétion du Plan 1 (Definition of Done)

- [ ] Un nouveau visiteur peut s'inscrire à `/signup` avec email/password.
- [ ] L'email de vérification arrive (visible dans Resend) et le lien active le compte.
- [ ] Un visiteur peut s'inscrire/se connecter via "Continuer avec GitHub" et "Continuer avec Google".
- [ ] Un utilisateur connecté est redirigé vers `/onboarding` s'il n'a pas terminé l'onboarding.
- [ ] L'onboarding 5 étapes fonctionne dans les deux variantes (dev / non-dev).
- [ ] Après onboarding, le `Profile` en DB contient : `isDeveloper`, `interests`, `stackTags` (si dev) ou non (si non-dev), `timezone`, `briefingHourLocal`, `whatsappEnabled` (+ `whatsappNumber` si activé), `onboardingCompletedAt`.
- [ ] Le dashboard `/dashboard` affiche "Prochain briefing demain à HH:00 (TZ)".
- [ ] `/profile` affiche les données du profile (read-only).
- [ ] Tentative d'accès à `/dashboard` sans session → redirect vers `/signin`.
- [ ] Un user ne peut jamais lire/modifier le profile d'un autre user (test d'intégration vert).
- [ ] CI GitHub Actions verte (lint + typecheck + unit tests + build).
- [ ] Test E2E Playwright vert (signup → onboarding → dashboard).
- [ ] Tag `hawkky-v0.1.0-foundation` poussé.

---

## À ne PAS faire dans ce plan (rappel)

- Pas de `Source` / `Subscription` / `Item` / parsers — c'est le Plan 2.
- Pas d'Inngest — c'est les Plans 2-3.
- Pas d'appels Anthropic — c'est le Plan 3.
- Pas de génération réelle de briefing — c'est le Plan 3.
- Pas d'envoi WhatsApp — c'est le Plan 4.
- Pas de feedback 👍/👎 — c'est le Plan 5.
- **Pas de "Connecter GitHub pour scanner mon stack" en onboarding** : le bouton mentionné dans la spec § 5 (étape 4a) sera implémenté Plan 2 — il dépend du scope OAuth élargi (`public_repo`/`repo`), du chiffrement effectif du token via `crypto.encrypt()` (préparé Task 5), et de la création des `Source(kind=github_repo)` qui n'existe qu'en Plan 2. Le Plan 1 ne fait que la saisie manuelle du stack. La connexion GitHub comme **provider d'authentification** (login) est, elle, bien implémentée dès le Plan 1.

---

## Notes pour l'agent qui exécute ce plan

- **Si une commande shadcn/HugeIcons/Auth.js renvoie une syntaxe différente** de ce qui est documenté ici (parce que les libs ont évolué), tu dois consulter Context7 pour la version actuelle et adapter — le contrat fonctionnel (rôle de chaque fichier, signature des fonctions) reste prioritaire sur la syntaxe exacte.
- **Tous les `pnpm exec prisma migrate dev`** créent des fichiers dans `prisma/migrations/`. Toujours les commiter avec le code qui les utilise.
- **Ne pas pousser `.env.local`** ni aucune valeur secrète. Si Vercel doit recevoir les env vars (déploiement), c'est par l'UI Vercel et non via le repo.
- **Pour tester OAuth GitHub/Google en local**, créer une OAuth app GitHub avec callback `http://localhost:3000/api/auth/callback/github` et idem pour Google. Renseigner les `AUTH_*_ID` / `AUTH_*_SECRET` dans `.env.local`.
