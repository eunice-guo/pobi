# 破壁 / GlobalInfo — 中美投资信息差 · 信源整合工具

> Name: **破壁** (Chinese) · **GlobalInfo** (English).

> Spec · 2026-06-03 · status: **approved, pre-plan**
> Sibling product to `simple-research` (投研平权). This is product #1 of two;
> #2 (gamified investment learning) is a separate spec/cycle.

---

## 1. One-liner

A daily Chinese-language digest that breaks the China–US information gap for
sophisticated Chinese retail investors: it pulls from a **buyside-curated** set of
English sources (X / Substack / earnings transcripts), faithfully translates each
item into Chinese, adds a concise summary, tags it by ticker, and serves it as a
feed they can filter to their own watchlist.

**Not investment advice.** Same red lines as `simple-research`: faithful, source-linked,
二手观点明确标注, 不编内容, 不给买卖建议.

---

## 2. User & problem

**Primary user:** *sophisticated* Chinese retail investors. They understand investing
(P/E, margins, theses) but are blocked by two walls:

1. **Language** — the best takes are in English.
2. **Access / curation** — they don't know *which* English voices are credible, and
   the best sources (X fintwit, paywalled Substacks) are hard to find and follow.

The product's value is **removing both walls at once**: someone with buyside taste has
already picked the voices worth reading, and the app delivers them in Chinese, daily,
organized by the names the user cares about.

**Why this user, not "me as creator":** decided in brainstorming — design for the
CN-retail reader first; the synthesis *is* the product others consume.

---

## 3. Goals / non-goals

**Goals (v1)**
- Daily digest of curated English investing sources, in Chinese.
- Faithful translation + concise summary per item (NOT synthetic "consensus").
- Ticker tagging so items are findable by name.
- Watchlist filter + "new since last visit" flags (the lightweight "alert").
- Curation lives in a config file the owner controls — the editorial moat.
- Legal & cheap to operate: official APIs only, no scraping.

**Non-goals (v1)**
- ❌ Per-ticker on-demand "smart money dossier" (dropped in brainstorming — feed-first).
- ❌ Synthetic bull/bear consensus that merges/distorts authors.
- ❌ Push notifications / email / server-side accounts.
- ❌ Paywalled Substack full text (legal/ToS) — public RSS posts only.
- ❌ Discord (cut: public investing Discords are retail signal-chasing; the useful
  ones are closed and un-scrapeable).
- ❌ Gamified learning — that's the *other* product.

---

## 4. Architecture — the two halves (Zara pattern)

Adopted from `zarazhangrui/follow-builders`: **all heavy/expensive/legally-sensitive
work runs once/day in a trusted scheduled job; the app only reads a static feed.**

```
┌─────────────────────────── BUILDER (GitHub Actions, daily) ───────────────────────────┐
│  sources.json (curated)                                                                │
│        │                                                                               │
│   ┌────┴─────┬──────────────┬───────────────────┐                                      │
│   ▼          ▼              ▼                   ▼                                       │
│  X API v2   Substack RSS   Earnings transcripts  (phase 2: YouTube/podcast transcripts) │
│   │          │              │                                                           │
│   └────┬─────┴──────────────┘                                                           │
│        ▼                                                                                │
│   normalize → for each item: Claude { faithful 中文 translation + TL;DR + tickers[] }   │
│        ▼                                                                                │
│   write dated feed JSON  →  commit to repo  (feed/YYYY-MM-DD.json + feed/latest.json)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                        │  (public raw JSON, no key, no rate limit)
                                        ▼
┌─────────────────────────────── APP (Next.js, static read) ─────────────────────────────┐
│  Daily digest  (grouped by ticker / sector, newest first)                              │
│  Watchlist     (localStorage tickers → filter feed + 🔴 "new since last visit")         │
│  Card:  中文 summary  →  expand  →  faithful translation  →  link to original           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Why static feed, not a DB:** the builder is the only writer, runs once/day, and the
output is small. Committing JSON to the repo (Zara-style) gives free hosting, free CDN
via raw GitHub / Vercel, versioned history, and zero infra. A datastore can come later
if volume or per-user state demands it.

---

## 5. Ingestion channels

### 5.1 X (Twitter) — Zara pattern, token-gated
- **Official X API v2**, base `https://api.x.com/2`.
- Auth: single `X_BEARER_TOKEN`, stored as a **GitHub Actions secret**.
- Flow: `/users/by?usernames=…` (resolve IDs) → `/users/{id}/tweets` with
  `exclude=retweets,replies`, `start_time=` last 24h, `max_results=5`,
  `tweet.fields=created_at,public_metrics,referenced_tweets,note_tweet`; keep top ~3/author.
- Retry 5xx with backoff; bail on 429.
- **Gating:** if `X_BEARER_TOKEN` is absent, the X step is skipped entirely (app still
  builds on Substack + transcripts) — mirrors v1 gating AI search on `ANTHROPIC_API_KEY`.
- **Cost honesty:** X free tier (~100 post reads/mo) is too small for a daily
  multi-account pull. Real use wants the **Basic tier (~$200/mo)**. This is a switch the
  owner flips later by funding + setting the token; v1 ships without it.

### 5.2 Substack — free RSS only
- Each curated author's public feed: `https://<author>.substack.com/feed`.
- Parse RSS → title, link, published, content (public posts/teasers only).
- **Paywalled authors** (SemiAnalysis, Citrini, Doomberg, TSOH) yield teasers only —
  accepted limitation; do not attempt paywall bypass.

### 5.3 Earnings transcripts — reuse simple-research
- Port the EDGAR/IR transcript fetch from `simple-research` (`src/lib/edgar/*`,
  `src/lib/transcript.ts`). Pull transcripts for **watchlist tickers around earnings dates**.

### 5.4 Phase 2 — YouTube / podcasts
- Same architecture, separate `feed-podcasts.json`. Fetch transcript → translate+summarize.
- Seed: Asianometry, Odd Lots, ChinaTalk. Lower priority than X/Substack.

---

## 6. Synthesis (in the builder, server-side)

Per item, one Claude call produces a structured object. **Fidelity-first** (decided in
brainstorming as "3 + summarize"): translate faithfully, summarize for triage, do NOT
fabricate a merged consensus.

```jsonc
{
  "id": "x:1234567890",            // channel:source-id
  "channel": "x" | "substack" | "transcript",
  "author": "@dylan522p",
  "authorName": "Dylan Patel (SemiAnalysis)",
  "url": "https://x.com/...",       // original, always linked
  "publishedAt": "2026-06-03T12:00:00Z",
  "lang": "en",
  "summaryZh": "一句到三句中文摘要（为什么重要）",
  "translationZh": "忠实的全文中文翻译",
  "tickers": ["NVDA", "TSM"],       // Claude-extracted; [] if none
  "sectors": ["AI-SEMIS"],
  "secondHand": true                 // 二手观点标注
}
```

Prompts live in `prompts/` (translate.md, summarize.md, extract-tickers.md) so the
owner can tune voice without touching code.

---

## 7. Feed schema (committed JSON)

- `feed/YYYY-MM-DD.json` — that day's items (array of the object above).
- `feed/latest.json` — last N days merged, newest first (what the app reads by default).
- `feed/index.json` — list of available dates.

---

## 8. sources.json — the editorial moat (seed)

Owner-curated. Buyside-filtered (X > Substack > podcasts; Discord excluded by design).

| Source | Channel | Priority |
|---|---|---|
| @dylan522p (SemiAnalysis), @Citrini7 (Citrini), @mule_capital (Fabricated Knowledge) | X | P0 |
| @TSOH_Investing, @buccocapital, @AndrewRangeley (Yet Another Value), @benthompson (Stratechery) | X | P1 |
| ChinaTalk (Jordan Schneider), Interconnected (Kevin Xu) | Substack RSS (free) | P0 — China-AI line |
| Fabricated Knowledge, Cassandra Unchained (Michael Burry) | Substack RSS (public) | P1 |
| SemiAnalysis, Citrini Research, Doomberg, TSOH | Substack RSS (teasers, paywalled) | P2 |
| Asianometry, Odd Lots, ChinaTalk podcast | YouTube/podcast transcript | Phase 2 |

Schema per entry: `{ handle, displayName, channel, priority, sectors[], enabled }`.

---

## 9. App surfaces (Next.js)

**Daily digest** (`/`)
- Reads `feed/latest.json`. Groups by ticker, then by sector for untagged items.
- Card: author + time + channel badge → **中文 summary** → expand to **faithful
  translation** → **link to original**. 二手观点 badge.

**Watchlist** (`/watchlist` or a toggle)
- Tickers in `localStorage`. Filters the digest to the user's names.
- "🔴 new since last visit" computed client-side from a stored `lastSeenAt` timestamp —
  this *is* the v1 "alert", no push infra.

**Shared:** bilingual scaffolding (reuse v1 `i18n.tsx`), warm-paper editorial design
language consistent with `simple-research`, prominent disclaimer.

---

## 10. Tech stack & reuse

- **Next.js** (App Router), TypeScript — same stack as `simple-research`.
- **Standalone repo** at `~/pobi`. Copy (don't share-package yet) the small helpers it
  needs from v1: `edgar/*`, `transcript.ts`, `i18n.tsx`, disclaimer, design tokens.
- **Builder**: Node script(s) under `scripts/`, run by `.github/workflows/generate-feed.yml`
  on a daily cron; secrets `X_BEARER_TOKEN`, `ANTHROPIC_API_KEY`.
- **Claude**: Anthropic SDK in the builder only (translation/summary/ticker extraction);
  app does no LLM calls at read time.
- **Hosting**: Vercel for the app; feed JSON served from the repo.

---

## 11. Red lines (inherited from simple-research)

- Faithful translation; never fabricate or paraphrase into a different claim.
- Always link the original; mark everything 二手观点.
- No buy/sell advice; "帮你看懂，风险自负."
- No scraping; official APIs / public RSS only; respect paywalls.

---

## 12. Scope & phases

**v1 (this spec):** Substack RSS + transcripts ingestion, Claude translate/summary/tag,
static feed, digest UI, watchlist + new-since-last-visit. X pipeline **built but
token-gated** (ships off until funded).

**Phase 2:** fund + enable X; add YouTube/podcast channel; optional per-ticker history
view; consider a datastore if volume/per-user state grows.

---

## 13. Risks / open questions

- **X cost** — Basic tier ~$200/mo is the gate to X being useful. Mitigated by gating.
- **Paywalled Substacks** — best sources give teasers only; X carries the alpha. Accept.
- **Translation quality at volume** — Claude cost scales with item count; cap items/day
  per source (top ~3) and tune prompts. Monitor.
- **Ticker extraction precision** — false tags pollute watchlist filter; keep extraction
  conservative (only confidently-mentioned tickers).
- **Substack RSS variance** — feeds differ; need a tolerant parser + per-source overrides.

---

## 14. Success criteria

- A CN-retail reader opens the app and, in under a minute, sees *today's* credible
  English takes on the names they hold — in Chinese, with one tap to the original.
- Zero fabricated content; every item traces to a real source.
- Adding/removing a source is a one-line `sources.json` edit.
- Operating cost is ~$0 until X is intentionally funded.
