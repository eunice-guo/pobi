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

  // Substack authors + asset-manager research both arrive as RSS; the channel
  // ("substack" | "research") is carried on each source and onto its items.
  const rssSources = sources.filter((s) => s.channel === "substack" || s.channel === "research");
  for (const s of rssSources) {
    try {
      const got = await fetchSubstack(s, sinceMs);
      console.log(`  ${s.channel} ${s.displayName}: ${got.length} item(s)`);
      items.push(...got);
    } catch (err) {
      const msg = `${s.channel} ${s.displayName} failed: ${err.message}`;
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

  // transcripts: documented next step — port EDGAR/IR fetch from simple-research.
  notes.push("transcripts: not yet wired (phase 2 — port from simple-research EDGAR)");

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
    const slice = items.slice(0, MAX_ENRICH);
    console.log(`  enrichment: ${slice.length} item(s) via OpenRouter free chain${process.env.ENRICH_MODEL ? ` (primary ${process.env.ENRICH_MODEL})` : ""}`);
    for (let i = 0; i < slice.length; i++) {
      try {
        items[i] = await enrich(slice[i]);
        process.stdout.write(`\r  enriched ${i + 1}/${slice.length}`);
      } catch (err) {
        console.warn(`\n  ! enrich failed for ${slice[i].id}: ${err.message}`);
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

main().catch((err) => {
  console.error("✗ builder failed:", err);
  process.exit(1);
});
