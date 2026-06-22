// 破壁 / GlobalInfo — daily feed builder (the "builder half" of the Zara pattern).
// Runs in GitHub Actions on a cron; writes static JSON the app reads.
//
// Local run:  node --env-file=.env.local scripts/generate-feed.mjs
// CI run:     env from Actions secrets, then  node scripts/generate-feed.mjs
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchSubstack } from "./lib/rss.mjs";
import { fetchX } from "./lib/x.mjs";
import { fetchEarnings } from "./lib/edgar.mjs";
import { fetchPodcasts, fetchBookmarks, fetchPapers } from "./lib/curated.mjs";
import { makeEnricher } from "./lib/enrich.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FEED_DIR = join(ROOT, "public", "feed");

const LOOKBACK_HOURS = Number(process.env.LOOKBACK_HOURS || 72);
const MAX_ENRICH = Number(process.env.MAX_ENRICH || 40); // cost guard

async function main() {
  const notes = [];
  const sinceMs = Date.now() - LOOKBACK_HOURS * 3600 * 1000;

  const cfg = JSON.parse(await readFile(join(ROOT, "src", "data", "sources.json"), "utf8"));
  const sources = cfg.sources.filter((s) => s.enabled);

  // ---- ingest ----
  let items = [];

  const substackSources = sources.filter((s) => s.channel === "substack" || s.channel === "research");
  for (const s of substackSources) {
    try {
      const got = await fetchSubstack(s, sinceMs);
      console.log(`  substack ${s.displayName}: ${got.length} item(s)`);
      items.push(...got);
    } catch (err) {
      const msg = `substack ${s.displayName} failed: ${err.message}`;
      console.warn(`  ! ${msg}`);
      notes.push(msg);
    }
  }

  const xSources = sources.filter((s) => s.channel === "x");
  if (xSources.length) {
    const token = process.env.X_BEARER_TOKEN;
    if (!token) {
      const msg = `X skipped: no X_BEARER_TOKEN (${xSources.length} handle(s) gated off)`;
      console.log(`  ${msg}`);
      notes.push(msg);
    } else {
      try {
        const got = await fetchX(xSources, token, sinceMs);
        console.log(`  x: ${got.length} tweet(s)`);
        items.push(...got);
      } catch (err) {
        const msg = `X pull failed: ${err.message}`;
        console.warn(`  ! ${msg}`);
        notes.push(msg);
      }
    }
  }

  // transcripts (业绩记录): latest earnings 8-K per 龙头 from SEC EDGAR.
  // Standing read-queue — not gated by the lookback window.
  try {
    const earningsCfg = JSON.parse(await readFile(join(ROOT, "src", "data", "earnings.json"), "utf8"));
    const perCompany = Number(process.env.EARNINGS_PER_CO || earningsCfg.perCompany || 1);
    const got = await fetchEarnings(earningsCfg.companies, perCompany);
    console.log(`  edgar: ${got.length} earnings filing(s) across ${earningsCfg.companies.length} 龙头`);
    items.push(...got);
    if (!got.length) notes.push("transcripts: EDGAR returned 0 (check SEC availability / User-Agent)");
  } catch (err) {
    const msg = `transcripts (EDGAR) failed: ${err.message}`;
    console.warn(`  ! ${msg}`);
    notes.push(msg);
  }

  // curated standing queues (播客访谈 + 收藏): hand-picked, evergreen, link-style.
  // Not gated by lookback. Ship pre-enriched (faithful Chinese already written).
  try {
    const got = await fetchPodcasts(join(ROOT, "src", "data", "podcasts.json"));
    console.log(`  podcasts: ${got.length} 访谈`);
    items.push(...got);
  } catch (err) {
    const msg = `podcasts failed: ${err.message}`;
    console.warn(`  ! ${msg}`);
    notes.push(msg);
  }
  try {
    const got = await fetchBookmarks(join(ROOT, "src", "data", "bookmarks.json"));
    console.log(`  bookmarks: ${got.length} 收藏`);
    items.push(...got);
  } catch (err) {
    const msg = `bookmarks failed: ${err.message}`;
    console.warn(`  ! ${msg}`);
    notes.push(msg);
  }
  try {
    const got = await fetchPapers(join(ROOT, "src", "data", "papers.json"));
    console.log(`  papers: ${got.length} 论文`);
    items.push(...got);
  } catch (err) {
    const msg = `papers failed: ${err.message}`;
    console.warn(`  ! ${msg}`);
    notes.push(msg);
  }

  // newest first
  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // ---- enrich (gated) ----
  const enrich = makeEnricher();
  let enriched = false;
  if (!enrich) {
    notes.push("enrichment skipped: no OPENROUTER_API_KEY (items shown in English, 翻译待生成)");
    console.log("  enrichment: SKIPPED (no key)");
  } else {
    enriched = true;
    // Priority for translation (within the MAX_ENRICH budget): 业绩记录 + 资管观点
    // first — they're the curated, standing read-list and the user's explicit
    // asks, and their filing dates sort old, so date-order alone starves them.
    // Then fill the rest by recency. Enrich by object reference (display order
    // is still the date sort above).
    const seen = new Set();
    const queue = [];
    const take = (arr) => {
      for (const it of arr) {
        if (queue.length >= MAX_ENRICH) break;
        // skip already-enriched (curated 播客/收藏 ship with faithful Chinese)
        if (it.enriched) continue;
        if (!seen.has(it.id)) { seen.add(it.id); queue.push(it); }
      }
    };
    take(items.filter((i) => i.channel === "transcript"));
    take(items.filter((i) => i.channel === "research"));
    take(items); // remainder, already newest-first
    const idxById = new Map(items.map((it, idx) => [it.id, idx]));
    console.log(`  enrichment: ${queue.length} item(s) via OpenRouter free chain${process.env.ENRICH_MODEL ? ` (primary ${process.env.ENRICH_MODEL})` : ""} (业绩记录/资管观点 prioritized)`);
    for (let k = 0; k < queue.length; k++) {
      const idx = idxById.get(queue[k].id);
      try {
        items[idx] = await enrich(items[idx]);
        process.stdout.write(`\r  enriched ${k + 1}/${queue.length}`);
      } catch (err) {
        console.warn(`\n  ! enrich failed for ${queue[k].id}: ${err.message}`);
      }
    }
    process.stdout.write("\n");
  }

  // ---- write ----
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const feed = {
    generatedAt: now.toISOString(),
    date,
    itemCount: items.length,
    enriched,
    notes,
    items,
  };

  await mkdir(FEED_DIR, { recursive: true });
  await writeFile(join(FEED_DIR, `${date}.json`), JSON.stringify(feed, null, 2));
  await writeFile(join(FEED_DIR, "latest.json"), JSON.stringify(feed, null, 2));

  const dates = (await readdir(FEED_DIR))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse();
  await writeFile(join(FEED_DIR, "index.json"), JSON.stringify({ dates }, null, 2));

  console.log(`\n✓ wrote ${items.length} items → public/feed/latest.json (${date})`);
  if (notes.length) console.log("  notes:\n   - " + notes.join("\n   - "));
}

// Force a clean exit on success too: an enrichment HTTP keep-alive socket (or
// other lingering handle) can keep Node's event loop alive after the feed is
// written, hanging the CI step until the 6h timeout kills it before it can
// commit. Exit explicitly once the work is done.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ builder failed:", err);
    process.exit(1);
  });
