// Substack ingestion via public RSS. Free posts / teasers only — no paywall bypass.
import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Strip HTML to plain text but PRESERVE paragraph structure: block-level tags
// become blank-line breaks and <br> a single newline, so the enricher receives
// (and can mirror) real paragraphs instead of one unreadable wall of text.
function toText(html, cap = 10000) {
  if (!html) return "";
  const txt = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article|tr|ul|ol|figure)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "· ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t\f\v]+/g, " ") // collapse intra-line whitespace only
    .replace(/ *\n */g, "\n") // trim around newlines
    .replace(/\n{3,}/g, "\n\n") // cap blank runs at one blank line
    .trim();
  return txt.length > cap ? txt.slice(0, cap) + "…" : txt;
}

// Decode the handful of HTML entities YouTube/Atom feeds emit in text fields.
function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

// YouTube channel Atom feeds interleave Shorts with long-form episodes and carry
// no duration. A Short *stays* at /shorts/<id> (HTTP 200, no redirect); a long-form
// video redirects to /watch. Probe with a cheap HEAD and treat "did not redirect"
// as a Short, so 播客访谈 keeps only long-form video/audio podcasts.
async function isYouTubeShort(videoId) {
  if (!videoId) return false;
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (pobi-globalinfo; +eg.eunice.guo@gmail.com)" },
    });
    return res.ok && !res.redirected && res.url.includes("/shorts/");
  } catch {
    return false; // network hiccup → fail open (keep the item) rather than drop it
  }
}

// 播客访谈: a podcast SHOW subscription = its YouTube channel Atom feed
// (https://www.youtube.com/feeds/videos.xml?channel_id=...). We keep the latest
// `max` LONG-FORM episodes — Shorts are filtered out (isYouTubeShort) — and it's
// NOT lookback-gated, so the channel stays populated and new episodes surface
// automatically. author = the feed handle, so 来源管理 manages the show and
// removing it hides all its episodes.
export async function fetchYouTube(source, max = 6) {
  // The Atom feed is the critical request — retry once before giving up so a
  // transient YouTube 4xx/5xx (rate-limit blip) doesn't blank the whole show.
  let xml = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(source.handle, { headers: { "User-Agent": "pobi-globalinfo (eg.eunice.guo@gmail.com)" } });
    if (res.ok) {
      xml = await res.text();
      break;
    }
    if (attempt === 2) throw new Error(`YouTube feed HTTP ${res.status}`);
    await sleep(1500);
  }
  const items = [];
  // Scan the latest entries instead of a fixed head slice: since Shorts are
  // dropped, keep going until we've collected `max` long-form episodes. Cap the
  // scan + throttle the per-video Shorts probes so we don't trip YouTube's bot
  // protection (which would 4xx the feed itself).
  let scanned = 0;
  for (const e of xml.split("<entry>").slice(1)) {
    if (items.length >= max || scanned >= 14) break;
    scanned++;
    if (scanned > 1) await sleep(350); // gentle pacing between Shorts probes
    const vid = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = decodeEntities((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").trim();
    const link =
      (e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || [])[1] ||
      (vid ? `https://www.youtube.com/watch?v=${vid}` : "");
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    const pub = published ? new Date(published) : null;
    const desc = decodeEntities((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || "").trim();
    if (!title || !link || !pub || isNaN(pub.getTime())) continue; // no valid date → skip (never stamp "now")
    if (await isYouTubeShort(vid)) continue; // long-form podcasts only — drop Shorts
    const text = (title + (desc ? "\n\n" + desc : "")).slice(0, 8000);
    items.push({
      id: `podcast:${vid || link}`,
      channel: "podcast",
      author: source.handle,
      authorName: source.displayName,
      url: link,
      publishedAt: pub.toISOString(),
      lang: "en",
      title,
      textEn: text,
      summaryZh: null,
      translationZh: null,
      tickers: [],
      sectors: source.sectors || [],
      secondHand: true,
      enriched: false,
      platform: "YouTube",
    });
  }
  return items;
}

// Recover a real publish date for feeds whose RSS omits one (e.g. some WordPress
// feeds — Apollo Academy ships every item with NO <pubDate>). Fetch the article
// page and read the Open Graph article:published_time / JSON-LD datePublished.
// Returns an ISO string or null. Callers must NOT fall back to "now": that
// mislabels old posts as 今日 AND lets them slip past the lookback window
// (a dateless item evades a `when < sinceMs` check), which is exactly the bug
// that surfaced an 11-day-old Apollo post as today.
async function fetchPageDate(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (pobi-globalinfo; +eg.eunice.guo@gmail.com)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(/property=["']article:published_time["'][^>]*content=["']([^"']+)/i) ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']article:published_time/i) ||
      html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
    if (!m) return null;
    const d = new Date(m[1]);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// Fetch one RSS source, return FeedItem-shaped objects (pre-enrichment) within lookback window.
// Handles both the "substack" and "research" (资管观点) channels — same mechanics,
// the channel is taken from the source so the app can filter them apart.
export async function fetchSubstack(source, sinceMs) {
  const channel = source.channel === "research" ? "research" : "substack";
  const feed = await parser.parseURL(source.handle);
  const items = [];
  for (const e of feed.items || []) {
    let ts = e.isoDate || e.pubDate || e["dc:date"] || e.date || null;
    // Feed omitted a date → recover the real one from the article page rather
    // than fabricating "now". If it's still unknown, SKIP the item: we'd rather
    // drop one post than mislabel an old one as today and leak it past lookback.
    if (!ts && e.link) ts = await fetchPageDate(e.link);
    if (!ts) continue;
    const when = new Date(ts).getTime();
    if (!when) continue;
    if (sinceMs && when < sinceMs) continue;
    const text = toText(e["content:encoded"] || e.content || e.contentSnippet || e.summary || "");
    if (!text) continue;
    items.push({
      id: `${channel}:${e.guid || e.link}`,
      channel,
      author: source.handle,
      authorName: source.displayName,
      url: e.link,
      publishedAt: new Date(ts).toISOString(),
      lang: "en",
      title: e.title || null,
      textEn: text,
      summaryZh: null,
      translationZh: null,
      tickers: [],
      sectors: source.sectors || [],
      secondHand: true,
      enriched: false,
    });
  }
  return items;
}
