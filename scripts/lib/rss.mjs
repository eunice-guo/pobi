// Substack ingestion via public RSS. Free posts / teasers only — no paywall bypass.
import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });

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

// 播客访谈: a podcast SHOW subscription = its YouTube channel Atom feed
// (https://www.youtube.com/feeds/videos.xml?channel_id=...). We take the latest
// `max` episodes (NOT lookback-gated, so the channel stays populated and new
// episodes surface automatically). author = the feed handle, so 来源管理 manages
// the show and removing it hides all its episodes.
export async function fetchYouTube(source, max = 6) {
  const res = await fetch(source.handle, {
    headers: { "User-Agent": "pobi-globalinfo (eg.eunice.guo@gmail.com)" },
  });
  if (!res.ok) throw new Error(`YouTube feed HTTP ${res.status}`);
  const xml = await res.text();
  const items = [];
  for (const e of xml.split("<entry>").slice(1, max + 1)) {
    const vid = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = decodeEntities((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").trim();
    const link =
      (e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || [])[1] ||
      (vid ? `https://www.youtube.com/watch?v=${vid}` : "");
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    const desc = decodeEntities((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || "").trim();
    if (!title || !link) continue;
    const text = (title + (desc ? "\n\n" + desc : "")).slice(0, 8000);
    items.push({
      id: `podcast:${vid || link}`,
      channel: "podcast",
      author: source.handle,
      authorName: source.displayName,
      url: link,
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
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

// Fetch one RSS source, return FeedItem-shaped objects (pre-enrichment) within lookback window.
// Handles both the "substack" and "research" (资管观点) channels — same mechanics,
// the channel is taken from the source so the app can filter them apart.
export async function fetchSubstack(source, sinceMs) {
  const channel = source.channel === "research" ? "research" : "substack";
  const feed = await parser.parseURL(source.handle);
  const items = [];
  for (const e of feed.items || []) {
    const ts = e.isoDate || e.pubDate;
    const when = ts ? new Date(ts).getTime() : 0;
    if (sinceMs && when && when < sinceMs) continue;
    const text = toText(e["content:encoded"] || e.content || e.contentSnippet || e.summary || "");
    if (!text) continue;
    items.push({
      id: `${channel}:${e.guid || e.link}`,
      channel,
      author: source.handle,
      authorName: source.displayName,
      url: e.link,
      publishedAt: ts ? new Date(ts).toISOString() : new Date().toISOString(),
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
