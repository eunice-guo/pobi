// 破壁 / GlobalInfo — daily feed builder (the "builder half" of the Zara pattern).
// Runs in GitHub Actions on a cron; writes static JSON the app reads.
//
// Local run:  node --env-file=.env.local scripts/generate-feed.mjs
// CI run:     env from Actions secrets, then  node scripts/generate-feed.mjs
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchSubstack, fetchYouTube } from "./lib/rss.mjs";
import { fetchX } from "./lib/x.mjs";
import { fetchTranscripts } from "./lib/transcripts.mjs";
import { fetchArxivAuthors } from "./lib/arxiv.mjs";
import { fetchWorldLabs } from "./lib/worldlabs.mjs";
import { fetchBookmarks, fetchPapers } from "./lib/curated.mjs";
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

  // 播客访谈: each podcast SHOW is a subscription. A YouTube channel → its Atom
  // feed via fetchYouTube (Shorts filtered). A non-YouTube podcast RSS (e.g.
  // Simplecast/Libsyn) → fetchSubstack with NO lookback gating (like 世界模型) so
  // a ~weekly show stays populated instead of aging out of the 72h window; keep
  // the newest 6 so a long back-catalog (Simplecast ships ~100) doesn't flood 播客.
  const podcastSources = sources.filter((s) => s.channel === "podcast");
  for (const s of podcastSources) {
    try {
      const isYouTube = /youtube\.com\/feeds\/videos\.xml/.test(s.handle);
      const got = isYouTube
        ? await fetchYouTube(s)
        : (await fetchSubstack(s, 0)).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)).slice(0, 6);
      console.log(`  podcast ${s.displayName}: ${got.length} episode(s)`);
      items.push(...got);
    } catch (err) {
      const msg = `podcast ${s.displayName} failed: ${err.message}`;
      console.warn(`  ! ${msg}`);
      notes.push(msg);
    }
  }

  // 世界模型 (worldmodel): research-lab world-model sources. Standing queue —
  // NOT lookback-gated — so the low-volume channel always shows the latest posts
  // (like 论文/播客). Each source uses the right ingester: an RSS/Substack feed
  // (e.g. 李飞飞's drfeifei.substack.com) → fetchSubstack(…, 0) (no gating);
  // World Labs (no RSS) → scraped via fetchWorldLabs.
  const worldSources = sources.filter((s) => s.channel === "worldmodel");
  const worldItems = [];
  for (const s of worldSources) {
    try {
      const isRss = /substack\.com|\/feed\/?$|\/rss\/?$/.test(s.handle);
      const got = isRss ? await fetchSubstack(s, 0) : await fetchWorldLabs(s);
      console.log(`  worldmodel ${s.displayName}: ${got.length} post(s)`);
      worldItems.push(...got);
    } catch (err) {
      const msg = `worldmodel ${s.displayName} failed: ${err.message}`;
      console.warn(`  ! ${msg}`);
      notes.push(msg);
    }
  }
  // De-dup posts that appear on more than one world-model source (e.g. the same
  // essay on both World Labs and 李飞飞's Substack) by normalized title, keeping
  // the first (source order in sources.json).
  const seenWorldTitle = new Set();
  for (const it of worldItems) {
    const key = (it.title || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (/^coming soon\.?$/i.test(key)) continue; // Substack placeholder stub
    if (key && seenWorldTitle.has(key)) continue;
    if (key) seenWorldTitle.add(key);
    items.push(it);
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

  // transcripts (业绩记录): latest earnings-CALL transcript per 龙头 from The
  // Motley Fool (full prepared remarks + Q&A, free). Replaces the old 8-K filing.
  // Standing read-queue — not gated by the lookback window.
  try {
    const earningsCfg = JSON.parse(await readFile(join(ROOT, "src", "data", "earnings.json"), "utf8"));
    const got = await fetchTranscripts(earningsCfg.companies);
    console.log(`  transcripts: ${got.length} earnings-call transcript(s) across ${earningsCfg.companies.length} 龙头 (Motley Fool)`);
    items.push(...got);
    if (!got.length) notes.push("transcripts: Motley Fool discovery returned 0 (sitemap unavailable / no recent calls)");
  } catch (err) {
    const msg = `transcripts (Motley Fool) failed: ${err.message}`;
    console.warn(`  ! ${msg}`);
    notes.push(msg);
  }

  // 论文 author subscriptions: latest arXiv papers per followed author.
  try {
    const authorsCfg = JSON.parse(await readFile(join(ROOT, "src", "data", "authors.json"), "utf8"));
    const got = await fetchArxivAuthors(authorsCfg.authors, authorsCfg.perAuthor || 3);
    console.log(`  arxiv authors: ${got.length} paper(s) across ${authorsCfg.authors.length} author(s)`);
    items.push(...got);
  } catch (err) {
    const msg = `arxiv authors failed: ${err.message}`;
    console.warn(`  ! ${msg}`);
    notes.push(msg);
  }

  // curated standing queues (收藏 + 论文 reading-club picks): evergreen, link-style,
  // pre-enriched (faithful Chinese already written).
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
    // Translation budget (MAX_ENRICH) is shared FAIRLY across channels via
    // round-robin so no single channel (e.g. 资管观点 with many daily posts)
    // starves the others (播客/论文/etc.). Curated items (enriched:true) already
    // carry faithful Chinese and are skipped. Within each channel, newest first.
    const seen = new Set();
    const queue = [];
    const order = ["transcript", "research", "worldmodel", "podcast", "paper", "substack", "x"];
    const buckets = order.map((ch) => items.filter((i) => i.channel === ch && !i.enriched));
    let progress = true;
    while (queue.length < MAX_ENRICH && progress) {
      progress = false;
      for (const b of buckets) {
        if (queue.length >= MAX_ENRICH) break;
        const it = b.shift();
        if (!it) continue;
        progress = true;
        if (!seen.has(it.id)) { seen.add(it.id); queue.push(it); }
      }
    }
    const idxById = new Map(items.map((it, idx) => [it.id, idx]));
    console.log(`  enrichment: ${queue.length} item(s) via OpenRouter free chain${process.env.ENRICH_MODEL ? ` (primary ${process.env.ENRICH_MODEL})` : ""} (round-robin across channels)`);
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
