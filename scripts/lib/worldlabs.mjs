// 世界模型 (worldmodel) channel — World Labs research blog (Fei-Fei Li's lab).
// World Labs ships NO RSS feed and its post pages carry NO article:published_time
// meta, so we scrape: the /blog index lists post slugs, and each post page has
// og:title + og:description plus a visible "Month D, YYYY" date in the body.
// Low-volume (≈monthly), so this is a STANDING queue like 论文/播客 — NOT
// lookback-gated — so the channel always shows the latest posts.
const UA = "Mozilla/5.0 (pobi-globalinfo; +eg.eunice.guo@gmail.com)";

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`(${MONTHS})\\s+\\d{1,2},\\s+\\d{4}`);

async function getHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function meta(html, prop) {
  const m =
    html.match(new RegExp(`property=["']${prop}["'][^>]*content=["']([^"']+)`, "i")) ||
    html.match(new RegExp(`content=["']([^"']+)["'][^>]*property=["']${prop}["']`, "i"));
  return m ? m[1].trim() : null;
}

function decode(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

// Pull readable body paragraphs, dropping the nav/footer mash and the lead date
// line so the enricher receives real prose (not the site chrome).
function bodyText(html, cap = 3500) {
  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")))
    .filter((t) => t.length > 60) // skip captions / one-liners
    .filter((t) => !/AboutResearch|Careers|Privacy|©|All rights reserved/i.test(t)); // nav/footer
  const seen = new Set();
  const out = [];
  for (const p of ps) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.join("\n\n").length > cap) break;
  }
  const joined = out.join("\n\n");
  return joined.length > cap ? joined.slice(0, cap) + "…" : joined;
}

// source: { handle (blog index URL), displayName, sectors }. max = latest N posts.
export async function fetchWorldLabs(source, max = 8) {
  const index = await getHtml(source.handle);
  const origin = new URL(source.handle).origin;
  // Post links look like /blog/<slug>; drop pagination ("page-…") + the index.
  const slugs = [];
  for (const m of index.matchAll(/\/blog\/([a-z0-9][a-z0-9-]+)/gi)) {
    const slug = m[1].toLowerCase();
    if (slug.startsWith("page-") || slugs.includes(slug)) continue;
    slugs.push(slug);
    if (slugs.length >= max) break;
  }

  const items = [];
  for (const slug of slugs) {
    const url = `${origin}/blog/${slug}`;
    let html;
    try {
      html = await getHtml(url);
    } catch (err) {
      console.warn(`  ! worldlabs ${slug}: ${err.message}`);
      continue;
    }
    const title = decode(meta(html, "og:title") || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || "");
    if (!title) continue;
    const desc = decode(meta(html, "og:description") || "");
    const dateStr = (html.match(DATE_RE) || [])[0];
    const when = dateStr ? new Date(dateStr) : null;
    const publishedAt = when && !isNaN(when.getTime()) ? when.toISOString() : null;
    if (!publishedAt) continue; // no date → skip (never fabricate "today")
    const body = bodyText(html);
    const textEn = [desc, body].filter(Boolean).join("\n\n").slice(0, 6000);
    items.push({
      id: `worldmodel:${url}`,
      channel: "worldmodel",
      author: source.handle,
      authorName: source.displayName,
      url,
      publishedAt,
      lang: "en",
      title,
      textEn: textEn || title,
      summaryZh: null,
      translationZh: null,
      tickers: [],
      sectors: source.sectors || ["WORLD-MODEL"],
      secondHand: true,
      enriched: false,
      platform: "World Labs",
    });
  }
  return items;
}
