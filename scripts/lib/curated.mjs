// Curated channels — 播客访谈 (podcast) + 收藏 (bookmark).
// Hand-picked, evergreen read-queue: real videos / articles / courses, always
// linked, 绝不编造. Like the EDGAR channel these are LINK-style items (a pointer
// to the source, not scraped full text) and are NOT gated by the lookback window.
//
// Each item already carries a faithful Chinese summary written by the editor, so
// it ships enriched: true — the generate-feed enricher skips already-enriched
// items and won't overwrite the curation.
import { readFile } from "node:fs/promises";

// Turn a curated record into a FeedItem-shaped object.
function toItem(channel, x, { authorName, textEn }) {
  const when = new Date(`${x.date}T12:00:00Z`);
  if (isNaN(when.getTime())) {
    // Hand-curated data, but never fabricate "now" / emit Invalid Date — skip and flag.
    console.warn(`  ! curated ${channel} "${x.id}" skipped: invalid/missing date "${x.date}"`);
    return null;
  }
  return {
    id: `${channel}:${x.id}`,
    channel,
    author: x.show || x.source || x.id,
    authorName,
    url: x.url,
    publishedAt: when.toISOString(),
    lang: "en",
    title: x.title,
    textEn,
    summaryZh: x.summaryZh || null,
    translationZh: null,
    tickers: Array.isArray(x.tickers) ? x.tickers.map((t) => String(t).toUpperCase()) : [],
    sectors: x.sectors || [],
    secondHand: true,
    enriched: Boolean(x.summaryZh), // pre-curated → don't re-enrich/overwrite
    // extra metadata; ignored by strict FeedItem consumers, used by the cards
    guest: x.guest || null,
    platform: x.platform || null,
    altUrl: x.altUrl || null,
    altPlatform: x.altPlatform || null,
    kind: x.kind || null,
  };
}

// 播客访谈: long-form AI/tech interviews (WhynotTV, No Priors, Karpathy, …).
export async function fetchPodcasts(path) {
  const cfg = JSON.parse(await readFile(path, "utf8"));
  return (cfg.interviews || [])
    .filter((x) => x.enabled !== false)
    .map((x) =>
      toItem("podcast", x, {
        authorName: x.showZh || x.show,
        textEn: [
          x.guest ? `Guest: ${x.guest}` : null,
          x.show ? `Show: ${x.show}` : null,
          x.descEn || "",
          x.altUrl ? `Mirror (${x.altPlatform || "alt"}): ${x.altUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      })
    )
    .filter(Boolean);
}

// 收藏: evergreen good articles & courses worth re-reading (CS336, …).
export async function fetchBookmarks(path) {
  const cfg = JSON.parse(await readFile(path, "utf8"));
  return (cfg.bookmarks || [])
    .filter((x) => x.enabled !== false)
    .map((x) =>
      toItem("bookmark", x, {
        authorName: x.sourceZh || x.source || "收藏",
        textEn: [x.kind ? `Type: ${x.kind}` : null, x.descEn || ""].filter(Boolean).join("\n"),
      })
    )
    .filter(Boolean);
}

// X 收藏: hand-curated saved tweets from X. The user sends bookmarked tweet
// links; each is recorded with the real tweet date (DATE RULE: never fabricate),
// a faithful Chinese summary, and the tweet's English text as 原文. Link-style,
// always points back to the original x.com/… status, 绝不编造.
export async function fetchXBookmarks(path) {
  const cfg = JSON.parse(await readFile(path, "utf8"));
  return (cfg.bookmarks || [])
    .filter((x) => x.enabled !== false)
    .map((x) =>
      toItem("xbookmark", x, {
        authorName: x.sourceZh || x.source || "X 收藏",
        textEn: x.descEn || "",
      })
    )
    .filter(Boolean);
}

// 论文: a curated reading list of research papers (world models, …). Always
// linked to the arXiv / publisher original. authorName = paper authors.
export async function fetchPapers(path) {
  const cfg = JSON.parse(await readFile(path, "utf8"));
  return (cfg.papers || [])
    .filter((x) => x.enabled !== false)
    .map((x) =>
      toItem("paper", x, {
        authorName: x.authors || x.venue || "论文",
        textEn: [x.venue ? `Venue: ${x.venue}` : null, x.authors ? `Authors: ${x.authors}` : null, x.descEn || ""]
          .filter(Boolean)
          .join("\n"),
      })
    )
    .filter(Boolean);
}
