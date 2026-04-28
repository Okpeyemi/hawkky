# Hawkky — Spec de design

> **Tagline** : Ta veille tech, distillée chaque matin.
>
> **Date** : 2026-04-27
> **Statut** : Validé pour entrée en plan d'implémentation

---

## 1. Vision et périmètre

Hawkky est un radar de veille personnalisé pour développeur·ses et profils tech-curieux. Chaque matin, à l'heure locale choisie par l'utilisateur, il livre un briefing court (lecture sous deux minutes) avec les items du jour pertinents pour ce profil, sur Email + Web app + WhatsApp.

Ce qui distingue Hawkky d'un agrégateur RSS classique : **Claude raisonne** sur les items en deux passes (scoring puis synthèse) en tenant compte du contexte explicite de l'utilisateur (intérêts, stack, projets, repos GitHub déclarés ou auto-détectés). Le briefing est trié par impact pour l'utilisateur, pas par popularité globale.

### Périmètre MVP (verrouillé)

- Auth email/password + GitHub OAuth + Google OAuth.
- Onboarding adaptatif (parcours dev / non-dev).
- Sources supportées : RSS générique, Hacker News (Algolia), GitHub Trending, repos GitHub suivis, subreddits.
- Pipeline IA : Claude Haiku 4.5 (scoring) puis Claude Sonnet 4.6 (synthèse).
- Briefing par email (Maileroo) + web app (lecture, archive, feedback).
- Briefing WhatsApp via Evolution API auto-hébergée — *Should* (selon stabilité du canal).
- Feedback "intéressant / pas pour moi" sur items — *Should* (data persistée dès J1, exploitation IA en post-MVP).
- Dedup inter-sources — *Should*.

### Hors périmètre MVP

Paywall et quotas commerciaux ; recherche dans l'archive ; briefings multi-quotidiens ; sources X/Twitter, YouTube, Product Hunt ; alertes événementielles temps réel.

---

## 2. Architecture technique

### Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                       Vercel (région: Paris)                 │
│                                                              │
│   ┌──────────────────────┐      ┌──────────────────────┐     │
│   │   Next.js App Router │      │   API routes /api/*  │     │
│   │  (UI + onboarding +  │◄────►│   (auth, profil,     │     │
│   │   dashboard briefing │      │    sources, briefing │     │
│   │   shadcn + HugeIcons)│      │    feedback)         │     │
│   └──────────────────────┘      └──────────┬───────────┘     │
│                                            │                 │
│   ┌──────────────────────────────┐         │                 │
│   │  Inngest functions (jobs)    │◄────────┘                 │
│   │  - cron: hourly tick         │                           │
│   │  - workflow: ingest sources  │                           │
│   │  - workflow: score+synth+send│                           │
│   └────────┬─────────┬───────────┘                           │
└────────────┼─────────┼───────────────────────────────────────┘
             │         │
             ▼         ▼
   ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐
   │ Postgres (Neon) │  │  Anthropic API   │  │   Maileroo     │
   │  via Prisma     │  │ Haiku + Sonnet   │  │   (email)      │
   └─────────────────┘  └──────────────────┘  └────────────────┘
                                              ┌────────────────┐
                                              │ Evolution API  │
                                              │ (VPS perso —   │
                                              │  HTTP calls)   │
                                              └────────────────┘
```

### Choix techniques verrouillés

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js (App Router) | Front + API routes en un seul déploiement |
| Hébergement | Vercel | Pas de VPS à gérer, scaling auto |
| Base de données | Postgres managé (Neon) | Branches DB pour previews, fit serverless |
| ORM | Prisma | Schéma DSL lisible, migrations robustes |
| Auth | Auth.js v5 (Credentials + GitHub + Google) | Mature, très répandu, providers prêts |
| Jobs | Inngest | Workflow steps retryables, cron natif, dev local CLI |
| LLM | Anthropic API (Haiku 4.5 + Sonnet 4.6) | Validé pour le pipeline 2 étapes |
| Email | Maileroo | Choix utilisateur |
| WhatsApp | Evolution API auto-hébergée (HTTP) | Déjà opérationnelle sur le VPS de l'utilisateur |
| UI | shadcn/ui complet + HugeIcons + Tailwind | Choix utilisateur |
| Polices | Inter (UI) + JetBrains Mono (code) | Standard tech, lisibilité |

### Principes d'isolation

- Aucun état mutable hors Postgres (Inngest reprend automatiquement les jobs interrompus).
- L'intégration Evolution API est un client HTTP isolé : remplaçable par WhatsApp Business API officielle sans toucher au reste du code.
- Le client Anthropic est server-only : la clé API n'est jamais exposée au navigateur.
- Le worker IA (jobs Inngest) scale indépendamment du front sans changement de code.

---

## 3. Modèle de données

### Principe

Un même item (par exemple un post Hacker News) peut intéresser plusieurs utilisateurs. L'`Item` est donc une **entité globale dédupée**, et le scoring/raisonnement se fait par utilisateur via `BriefingItem`. Cela économise les fetchs et permet la dedup inter-sources via un hash d'URL canonique.

### Entités

| Entité | Rôle |
|---|---|
| `User`, `Account`, `Session`, `VerificationToken` | Standard Auth.js v5 (adapter Prisma) |
| `Profile` (1-1 User) | Préférences + contexte personnel + token GitHub chiffré |
| `Source` | Source globale partagée — dedupée par `(kind, key)` |
| `Subscription` (User × Source) | "Cet utilisateur suit cette source" + paramètres éventuels |
| `Item` | Article ingéré, dedupé par `hash` (sha256 sur URL canonique) |
| `SourceFetch` | État du dernier fetch d'une `Source` (ETag, lastFetchedAt, lastError) |
| `Briefing` | Briefing quotidien d'un utilisateur (date locale, summary Markdown, timestamps d'envoi par canal) |
| `BriefingItem` | Lien Briefing × Item + `score` + `reason` + `position` |
| `ItemFeedback` | User × Item × `interesting` ou `not_for_me` |
| `RedirectLink` | ID opaque pour les liens trackés WhatsApp |
| `ClickEvent` | Événement de clic sur un lien tracké |
| `LlmCallLog` | Trace des appels Anthropic (modèle, tokens, coût, user) |

### Champs clés

**`Profile`** :

```
userId, isDeveloper, timezone (IANA), briefingHourLocal (0-23),
interests text[], stackTags text[], projectsDescription text,
githubLogin?, githubAccessTokenEnc?,  // AES-GCM, clé en env Vercel
whatsappNumber?, whatsappEnabled bool,
emailVerifiedAt
```

**`Source`** :

```
id, kind: enum { rss, hn_top, reddit_subreddit, github_trending_lang, github_repo },
key: text,           // URL RSS, "programming" pour subreddit, "vercel/next.js", etc.
displayName, addedAt
unique(kind, key)
```

**`Item`** :

```
id, sourceId, urlCanonical, hash (sha256, unique),
title, excerpt, content?, publishedAt, fetchedAt
```

**`Briefing`** : `id, userId, localDate, summaryMd, emailSentAt?, emailMessageId?, whatsappSentAt?, whatsappStatus?, createdAt` — `unique(userId, localDate)`.

**`BriefingItem`** : `id, briefingId, itemId, score (0-100), reason (≤ 18 mots), position`.

**`ItemFeedback`** : `id, userId, itemId, value: enum { interesting, not_for_me }, createdAt` — `unique(userId, itemId)`.

### Conservation

- `Item` : purge après 90 jours sauf ceux référencés par un `BriefingItem` (gardés tant que le briefing parent existe).
- `Briefing` : conservation 12 mois, puis suppression.
- `SourceFetch`, `ClickEvent`, `LlmCallLog` : log glissant 30 jours.

### Sécurité données

- Token GitHub OAuth chiffré au repos avec **AES-256-GCM**, clé dans `ENCRYPTION_KEY` env Vercel (rotation manuelle pour le MVP).
- Aucun secret en clair dans la DB.
- `googleId` / `githubId` (depuis Auth.js) restent dans `Account`, jamais exposés côté client.

---

## 4. Pipeline d'ingestion et raisonnement Claude

### Orchestration Inngest

Trois fonctions, chacune en steps individuellement retryables :

```
1) hourly-tick                           (cron "0 * * * *")
   ├─ findUsersDue()                     → users dont c'est l'heure locale
   └─ fan-out → événement "user.briefing.requested" pour chaque user

2) ingest-source                          (event "source.ingest.requested", dédupé par sourceId)
   ├─ fetch (GET avec ETag/If-Modified-Since selon kind)
   ├─ parse (parser dédié par kind)
   ├─ upsertItems (hash sha256 sur URL canonique)
   └─ updateSourceFetch

3) user-briefing                          (event "user.briefing.requested")
   ├─ collectSubscriptions(user)
   ├─ ensureSourceFreshness()             → trigger ingest-source en parallèle si stale
   ├─ buildCandidatePool()                → items 24-48h, hors déjà-envoyés et "not_for_me"
   ├─ scoreItems(Haiku 4.5)               → batches de 12-15 items → score + raison
   ├─ pickTopN(N=12)
   ├─ synthesizeBriefing(Sonnet 4.6)      → Markdown final < 600 mots
   ├─ persistBriefing()
   ├─ sendEmail(Maileroo)                 ─┐ canaux indépendants :
   └─ sendWhatsApp(Evolution API si actif) ─┘ un échec n'empêche pas l'autre
```

### Étalement automatique

Pour éviter un pic Anthropic à 7h00 dans un fuseau commun, le déclenchement effectif de `user-briefing` ajoute un jitter aléatoire de 0 à 15 minutes par utilisateur.

### Prompts Claude

**Scoring (Haiku 4.5)**
- System prompt **cacheable** (réutilisé sur tous les batches du user) : rôle ("juge la pertinence pour CET utilisateur"), schéma de sortie JSON strict, **contexte utilisateur en cache** (intérêts, stack, projets, repos suivis).
- User prompt = batch de 12-15 items `{id, title, source, excerpt}`.
- Sortie attendue : `[{itemId, score 0-100, reason ≤ 18 mots}]`.

**Synthèse (Sonnet 4.6)**
- System prompt **cacheable** : rôle ("rédige un briefing personnalisé court"), ton, format Markdown attendu, **même contexte utilisateur en cache**.
- User prompt = top 12 items (titre, URL, source, raison de pertinence du scoring).
- Sortie : briefing Markdown structuré (intro 1-2 phrases, items groupés par thème implicite, lien direct sur chaque item, ton concis).

**Prompt caching** : le contexte utilisateur (1-3k tokens) est marqué `cache_control` dans les system prompts. Réutilisé entre les batches de scoring **et** entre scoring et synthèse pour le même user. Économie estimée : 60-80 % sur les tokens input répétés.

### Coûts estimés (par user/jour)

| Étape | Tokens approx | Coût approx |
|---|---|---|
| Scoring Haiku 4.5 (~80 items, 7 batches) | 40k in / 5k out | ~$0.05 |
| Synthèse Sonnet 4.6 (top 12) | 8k in / 2k out | ~$0.05 |
| **Total IA / user / jour** | | **~$0.10** |

Soit environ $3/user/mois en IA pure, environ $3.50/user/mois infra incluse (Maileroo, Vercel, Neon).

### Robustesse

- Steps Inngest retryables individuellement (reprise au point d'échec, pas de re-fetch coûteux).
- Si la synthèse Sonnet échoue après 3 retries → **fallback "briefing simple"** : top items + raison du scoring, sans rédaction LLM, + log incident.
- WhatsApp et email sont en steps séparés : l'un peut échouer sans bloquer l'autre.
- Idempotence : un user ne peut pas avoir deux briefings pour la même `localDate` (clé unique).

### Dedup intra-pool

- **Niveau 1 (MVP)** : hash URL canonique (déjà fait au niveau `Item`).
- **Niveau 2 (Should)** : titres normalisés (lowercase, strip diacritics, strip ponctuation) → matching exact pour éliminer le même article repris ailleurs.
- **Niveau 3 (post-MVP)** : embeddings + cosine similarity. Hors scope.

---

## 5. UX et flow utilisateur

### Onboarding (5 écrans)

```
[1] Auth                  → email/pwd OU "Continuer avec GitHub" OU "Continuer avec Google"
[2] Tu es ?               → ◯ Développeur·se   ◯ Curieux·se tech (non-dev)
[3] Centres d'intérêt     → tags pré-remplis (IA, frontend, devops, sécurité, design,
                            startups, IA agentique, OSS…) — multi-select + champ libre
[4a] Si dev :
       - "Connecter GitHub pour scanner ton stack ?" (bouton OAuth, optionnel)
         → si accepté : on fetch ses repos publics + langages dominants → propose
           une liste éditable de stackTags + repos suivis
       - sinon : champ libre stack (langages/frameworks/libs) + textarea "tes projets"
[4b] Si non-dev :
       - skip stack, juste "tes sources préférées"
       - input pour ajouter des URLs RSS
       - subreddits (input texte → "r/<nom>")
[5] Livraison
       - fuseau (auto-détecté navigateur, éditable)
       - heure du briefing (sélecteur 0-23h, défaut 7h)
       - canaux : ☑ Email (obligatoire) ☐ WhatsApp (optionnel + numéro si coché)
       - bouton "Recevoir mon premier briefing demain matin"
```

L'étape 4 a deux variantes selon le choix étape 2 — pas un mur de questions.

### Dashboard (`/`)

- En-tête : briefing du jour si déjà généré, sinon "Prochain briefing demain à 7h12 (Europe/Paris)".
- Liste d'items : carte par item avec titre, source (avec favicon), raison de pertinence, deux boutons icône HugeIcons (👍 intéressant / 👎 pas pour moi → POST `ItemFeedback`), lien direct vers la source en bouton primaire.
- Sidebar gauche (shadcn) : Dashboard / Sources / Profil / Paramètres.

### Archive (`/archive`)

Liste des briefings passés (date, nombre d'items, accès en lecture seule).

### Sources (`/sources`)

- Liste des `Subscription` actuelles regroupées par `kind` (RSS, HN, Reddit, GitHub).
- Bouton "+ Ajouter" → modal avec sélecteur du `kind`, puis champ approprié (URL RSS, nom de subreddit, "owner/name" pour repo, langage pour GitHub Trending).
- État de fetch visible (dernier fetch OK/erreur, nombre d'items récents).

### Profil (`/profile`)

- Édition de tout ce qui a été demandé à l'onboarding : intérêts, stack, projets, repos suivis, fuseau, heure briefing, canaux.
- Bouton "Régénérer le scan GitHub" si OAuth GitHub connecté.
- Bouton "Déconnecter GitHub" → supprime le token chiffré.
- Bouton "Supprimer mon compte" → cascade delete + révocation OAuth.

### Format email (Maileroo)

- Template HTML responsive (table-based pour compat clients mail).
- En-tête : logo Hawkky + date + bouton "Voir dans le navigateur".
- Intro courte (1-2 phrases du Sonnet).
- Jusqu'à 12 cards d'items (selon la taille du pool) : titre lien, source en small caps, raison en italique, CTA "Lire" + 👍/👎 (liens trackés vers webhook auth-less avec token signé HMAC).
- Footer : "Réglages" + "Désabonner cette catégorie".

### Format WhatsApp (Evolution API)

Canal court → version condensée :

```
☀️ Briefing Hawkky — lundi 27 avril

Aujourd'hui, 3 sujets pour toi :

1. *React 20 freeze — impact direct sur ton projet "checkout-v2"*
   https://hawkky.app/r/abc123

2. *Une nouvelle lib remplace ce que tu utilises avec react-query*
   https://hawkky.app/r/abc124

3. *Thread HN sur le bug que tu avais la semaine dernière*
   https://hawkky.app/r/abc125

→ Voir tout : https://hawkky.app/today
```

Les liens `hawkky.app/r/<id>` redirigent vers la source (302) et enregistrent un `ClickEvent`. Signal de feedback implicite réutilisable plus tard.

### Identité visuelle

- shadcn/ui complet (composants stricts, modifiables localement).
- HugeIcons React pour toutes les icônes.
- Palette : décision UX prise lors de la première itération d'implémentation UI (deux variantes — sombre tech à accent unique, ou claire neutre — proposées au build, pas dans cette spec).
- Polices : Inter (UI) + JetBrains Mono (code/source).

---

## 6. Sécurité

### Authentification & sessions

- Auth.js v5 avec adaptateur Prisma. Sessions JWT signées (`AUTH_SECRET`).
- Cookie session : `httpOnly`, `secure`, `sameSite: lax`.
- Email/password : hash bcrypt (cost 12).
- OAuth GitHub demande seulement `read:user` + `public_repo` au login. Le scope `repo` (privés) est demandé en opt-in séparé après login si l'utilisateur veut scanner ses repos privés.

### Multi-tenancy (risque #1 d'un SaaS)

- Toutes les queries Prisma scopées par `userId` via une couche helper `forUser(session.userId)` — interdiction d'accéder à `prisma.briefing.findUnique({where: {id}})` directement depuis du code applicatif.
- Tests d'intégration dédiés : tentatives d'accès cross-user → 404 (pas 403, pour ne pas leak l'existence).

### Secrets et chiffrement

- `ENCRYPTION_KEY` (32 bytes, env Vercel) → AES-256-GCM pour les `githubAccessTokenEnc`.
- `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `MAILEROO_API_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `DATABASE_URL`, `FEEDBACK_SECRET` : tous en env Vercel, jamais loggés, jamais exposés client.
- `.env.example` documenté, `.env.local` dans `.gitignore`.

### SSRF (risque clé de l'ingestion RSS)

Mitigations dès le MVP :
- Résolution DNS côté serveur, **blocklist IP** (RFC1918, loopback, link-local, IPv6 ULA, métadonnées cloud `169.254.169.254`).
- Schémas autorisés : `http://` et `https://` uniquement.
- Timeout strict 10s, taille max réponse 5 MB.
- User-Agent identifié `Hawkky/1.0 (+https://hawkky.app/bot)`.
- Refus des redirections 30x vers une IP non autorisée après résolution.

### Webhooks et liens trackés

- Liens 👍/👎 dans email : URL `/api/feedback?token=<HMAC>` où le token = `HMAC-SHA256(userId|itemId|value, FEEDBACK_SECRET)`. Pas besoin d'être loggé pour cliquer.
- Liens trackés WhatsApp `/r/<id>` : ID opaque via `nanoid`. Click → 302 + insert `ClickEvent`.
- Pas de webhook entrant Maileroo / Evolution API au MVP (à brancher plus tard pour bounce handling).

### Validation des entrées (Zod)

Toutes les API routes valident leur payload avec un schéma Zod avant Prisma. Limites strictes sur tous les `text` user-provided ; format strict pour subreddit/repo.

### Anti-abuse

- Rate limiting (Vercel KV ou Upstash Redis) : 10 ajouts de sources/min/user, 60 requêtes API/min/user.
- Vérification email obligatoire avant le 1er briefing.

### Logs et observabilité

- Logs structurés JSON (`pino`), jamais de secret ni d'access token.
- Inngest dashboard pour suivre les jobs.
- Sentry pour erreurs front + serveur.

### Conformité

- Pas de données sensibles (RGPD-light) : email + préférences + items publics.
- Page "Supprimer mon compte" → cascade delete + révocation OAuth GitHub.
- CGU + politique de confidentialité minimales (à rédiger avant la mise en ligne, hors scope produit).

---

## 7. Tests et observabilité

### Stratégie de tests

**Vitest unit + integration** (rapides, en CI sur chaque PR) :
- **Parsers de sources** (1 test par `kind` avec fixtures réelles capturées) — RSS, HN Algolia, Reddit JSON, GitHub Trending HTML, GitHub repo events.
- **Dedup** : hash URL canonique stable sur variantes (trailing slash, paramètres UTM, schéma).
- **SSRF** : tableau d'URLs malicieuses (loopback, RFC1918, métadonnées cloud) → must reject.
- **Encryption helpers** : round-trip AES-GCM + détection de tampering.
- **Multi-tenancy** : tentatives d'accès aux ressources d'un autre user → 404.
- **Prompts Claude** : tests de format avec mock du SDK (parsing du JSON Haiku, gestion refus / output malformé). Pas de tests "qualité du contenu".

**Playwright E2E** (lent, en CI nightly + pre-deploy) :
- Signup email/pwd → onboarding dev → connexion GitHub mockée → 1er briefing déclenché manuellement (route admin) → réception visible dans `/`.
- Signup Google OAuth → onboarding non-dev → ajout RSS → briefing déclenché → vu.
- Click sur 👍 dans un email (lien signé HMAC) → `ItemFeedback` persisté.

**Inngest local dev** : `inngest-cli dev` pour tester les workflows en local sans Vercel.

### Observabilité

| Couche | Outil |
|---|---|
| Jobs (workflows, retries, latence par step) | Inngest dashboard (natif) |
| Erreurs serveur + client | Sentry (gratuit jusqu'à 5k events/mois) |
| Logs applicatifs | `pino` JSON, captés par Vercel Logs |
| Coûts Anthropic | Headers `anthropic-ratelimit-*` + token usage logué → `LlmCallLog(userId, model, inputTokens, outputTokens, cachedTokens, costUsd, occurredAt)` |
| Santé sources | Vue admin `/admin/sources-health` listant `SourceFetch` avec `lastError` non null |

### Métriques produit (instrumenter dès maintenant, exploiter plus tard)

- Briefings envoyés / jour
- Taux d'ouverture email (pixel Maileroo)
- Clics par item / briefing
- Ratio 👍/👎 par utilisateur (signal de qualité du scoring)
- Coût Anthropic moyen par briefing (alerte si > $0.20)

### CI/CD

- GitHub Actions : lint (Biome ou ESLint+Prettier), typecheck, vitest, build Next.js sur chaque PR.
- E2E Playwright en nightly cron + sur la branche `main`.
- Déploiement Vercel automatique sur `main` (preview deploys sur les PRs avec branche Neon dédiée).
- Migrations Prisma : `prisma migrate deploy` en post-build hook.

---

## 8. Structure de code, risques et plan B

### Structure du repo

Découpage par domaine métier — chaque domaine a sa propre frontière (entité, service, types, tests).

```
hawkky/
├── app/                          # Next.js App Router (pages + API routes)
│   ├── (marketing)/              # landing publique
│   ├── (auth)/                   # signin, signup, callbacks OAuth
│   ├── (app)/                    # zone authentifiée
│   │   ├── page.tsx              # dashboard / briefing du jour
│   │   ├── archive/
│   │   ├── sources/
│   │   └── profile/
│   └── api/
│       ├── auth/[...nextauth]/   # Auth.js
│       ├── inngest/              # endpoint Inngest
│       ├── feedback/             # webhook 👍/👎 signé HMAC
│       └── r/[id]/               # redirect tracker WhatsApp
├── src/
│   ├── domain/                   # logique métier pure (testable, sans I/O)
│   │   ├── profile/
│   │   ├── sources/              # types Source par kind, validation
│   │   ├── ingestion/            # parsers (rss, hn, reddit, gh-trending, gh-repo)
│   │   ├── dedup/                # canonicalize URL, hash
│   │   ├── briefing/             # types Briefing, BriefingItem
│   │   └── llm/                  # prompts (scoring, synthesis), schemas Zod sortie
│   ├── infra/                    # adaptateurs I/O (mockables en test)
│   │   ├── prisma.ts
│   │   ├── anthropic.ts          # client + prompt cache helpers
│   │   ├── maileroo.ts
│   │   ├── evolution.ts          # client WhatsApp
│   │   ├── http-fetcher.ts       # GET avec SSRF guard
│   │   └── crypto.ts             # AES-GCM
│   ├── jobs/                     # fonctions Inngest
│   │   ├── hourly-tick.ts
│   │   ├── ingest-source.ts
│   │   └── user-briefing.ts
│   ├── auth.ts                   # config Auth.js
│   └── ui/                       # composants partagés (shadcn extensions)
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── fixtures/                 # XML/JSON capturés des sources réelles
│   ├── unit/
│   ├── integration/
│   └── e2e/                      # Playwright
└── package.json
```

**Règle d'or** : `domain/*` ne dépend jamais de `infra/*` ni de Prisma. C'est de la logique pure (parsing, validation, scoring déterministe, formatting). Les `jobs/` orchestrent en injectant les dépendances `infra/`. Cela rend `domain/` ultra-testable sans mock complexe.

### Risques majeurs et plan B

| Risque | Probabilité | Plan B |
|---|---|---|
| Anthropic API rate limit sur pic d'utilisateurs au même fuseau | Moyenne | Jitter aléatoire 0-15min sur le déclenchement effectif (déjà prévu §4) |
| Evolution API instable / WhatsApp ban | Élevée (canal non-officiel) | Canal isolé. Si > 5 échecs consécutifs ou > 50 % d'échecs sur 24h pour un user, désactivation auto + email d'alerte. WhatsApp Business API officielle = chemin de migration |
| Coût Claude qui dérape | Moyenne | Métrique `LlmCallLog` + alerte si > $0.20/briefing. Cap dur : si user > $1/jour, briefing du lendemain en mode dégradé |
| Source RSS retourne du HTML géant | Moyenne | Limite 5MB, timeout 10s, parser strict, retry exponentiel max 3x |
| GitHub Trending = scraping HTML (pas d'API officielle) | Moyenne | Parser robuste avec sélecteurs multiples + monitoring dédié. Plan B : agrégateur tiers (`ghapi.huchen.dev`) |
| Sonnet refuse de répondre (contenu litigieux dans un item) | Faible | Fallback "briefing simple" sans synthèse |
| Drift de qualité du scoring sur un user | Moyenne (long terme) | Si ratio 👍/👎 < 0.3 sur 14 jours → re-onboarding partiel proposé |

### Anticipé dans l'architecture mais hors MVP

- **Feedback exploité dans le prompt** (D du pipeline) : `ItemFeedback` existe dès J1, prompt Sonnet le consomme plus tard (~1 jour de travail).
- **Embeddings pour dedup avancée** : non utilisée en MVP. L'extension `pgvector` est activée sur Neon dès J1 (pas de coût, évite une migration douloureuse plus tard) mais aucune colonne `embedding` n'est ajoutée à `Item` avant qu'on en ait besoin.
- **Briefing événementiel** : pipeline déjà event-driven Inngest, route `triggerInstantBriefing(user, item)` brancheable plus tard.
- **Comptes Pro + paywall** : champ `User.plan: enum { free, pro }` prévu mais sans logique active.

---

## Annexe — Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion Postgres Neon |
| `AUTH_SECRET` | Signature JWT Auth.js |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | OAuth GitHub |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth Google |
| `ENCRYPTION_KEY` | 32 bytes (hex) — AES-GCM pour tokens GitHub |
| `FEEDBACK_SECRET` | HMAC pour les liens 👍/👎 dans les emails |
| `ANTHROPIC_API_KEY` | Claude (Haiku 4.5 + Sonnet 4.6) |
| `MAILEROO_API_KEY` | Email transactionnel |
| `EVOLUTION_API_URL` | URL HTTP de l'instance Evolution API auto-hébergée |
| `EVOLUTION_API_KEY` | Auth Evolution API |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Endpoint Inngest |
| `SENTRY_DSN` | Erreurs (optionnel mais recommandé dès J1) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
