// Public-RSS ingestion. Free posts / teasers only — no paywall bypass, no scraping.
// Handles Substack/blog RSS, podcast RSS (e.g. Carlyle on Castos), and YouTube
// playlist Atom feeds (e.g. Bridgewater Research & Insights).
import Parser from "rss-parser";

// media:* lets us read YouTube Atom descriptions; itunes:* covers podcast summaries.
const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: [
      ["media:group", "mediaGroup"],
      ["itunes:summary", "itunesSummary"],
    ],
  },
});

// Pull the text out of a YouTube Atom entry's <media:group><media:description>,
// tolerating the different shapes rss-parser/xml2js may produce.
function youtubeDescription(e) {
  const g = e.mediaGroup;
  const d = g && g["media:description"];
  if (!d) return "";
  const v = Array.isArray(d) ? d[0] : d;
  return typeof v === "string" ? v : v?._ || "";
}

// Strip HTML tags to plain text, collapse whitespace, cap length.
function toText(html, cap = 10000) {
  if (!html) return "";
  const txt = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return txt.length > cap ? txt.slice(0, cap) + "…" : txt;
}

// Fetch one RSS source, return FeedItem-shaped objects (pre-enrichment) within lookback window.
// Used for Substack authors, asset-manager podcasts, and YouTube research playlists; the
// channel comes from the source config (e.g. "substack" | "research").
export async function fetchSubstack(source, sinceMs) {
  const channel = source.channel || "substack";
  const feed = await parser.parseURL(source.handle);
  const items = [];
  for (const e of feed.items || []) {
    const ts = e.isoDate || e.pubDate;
    const when = ts ? new Date(ts).getTime() : 0;
    if (sinceMs && when && when < sinceMs) continue;
    let text = toText(
      e["content:encoded"] || e.content || e.itunesSummary || e.contentSnippet || e.summary || youtubeDescription(e)
    );
    // YouTube/podcast entries can have a thin or empty body; keep them on the
    // research channel by falling back to the title so the item still surfaces.
    if (!text && channel === "research") text = toText(e.title || "");
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
