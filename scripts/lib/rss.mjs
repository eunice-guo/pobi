// Substack ingestion via public RSS. Free posts / teasers only — no paywall bypass.
import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });

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
