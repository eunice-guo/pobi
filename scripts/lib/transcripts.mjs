// Earnings-call TRANSCRIPTS (业绩记录) via The Motley Fool — replaces the old
// 8-K filing channel. Motley Fool publishes full, free earnings-call transcripts
// (prepared remarks + Q&A) at canonical public URLs. There is no transcript RSS/
// API, so we discover the latest transcript per 龙头 from Fool's monthly sitemaps
// (https://www.fool.com/sitemap/{YYYY}/{MM}), which list every transcript URL.
// Link-style item (we link the real transcript as 原文, 永远链接原文 / 绝不编造);
// the enricher writes the Chinese summary. We never fabricate a URL — if a ticker
// isn't found in the look-back window we skip it.

const UA = process.env.FOOL_USER_AGENT ||
  "Mozilla/5.0 (compatible; pobi-globalinfo/1.0; +https://github.com/eunice-guo/pobi)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// All Motley Fool transcript URLs listed in one month's sitemap.
async function monthTranscriptUrls(year, month) {
  const url = `https://www.fool.com/sitemap/${year}/${String(month).padStart(2, "0")}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const text = await res.text();
  const re = /https:\/\/www\.fool\.com\/earnings\/call-transcripts\/\d{4}\/\d{2}\/\d{2}\/[^<\s"]+/g;
  return text.match(re) || [];
}

// /YYYY/MM/DD/ in the URL = publish date; use it to sort newest-first.
function dateFromUrl(u) {
  const m = u.match(/\/call-transcripts\/(\d{4})\/(\d{2})\/(\d{2})\//);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

// Pull the latest earnings-call transcript per company.
// monthsBack covers the quarterly cadence (a company's latest call may be a few
// months old) — 4 months is a safe default. NOT gated by the lookback window.
export async function fetchTranscripts(companies, monthsBack = Number(process.env.TRANSCRIPT_MONTHS || 4)) {
  const now = new Date();
  const all = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    try {
      const got = await monthTranscriptUrls(d.getFullYear(), d.getMonth() + 1);
      all.push(...got);
      console.log(`  fool sitemap ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}: ${got.length} transcript URL(s)`);
    } catch (err) {
      console.warn(`  ! fool sitemap ${d.getFullYear()}/${d.getMonth() + 1} failed: ${err.message}`);
    }
    await sleep(250); // be polite
  }
  const uniq = [...new Set(all)];

  const out = [];
  for (const co of companies) {
    const tk = co.ticker.toLowerCase();
    // the ticker appears between hyphens in the slug, e.g. nvidia-nvda-q1-2027-...
    const matches = uniq.filter((u) => u.toLowerCase().includes(`-${tk}-`));
    if (!matches.length) continue;
    matches.sort((a, b) => (dateFromUrl(a) < dateFromUrl(b) ? 1 : -1));
    const url = matches[0];
    const date = dateFromUrl(url);
    if (!date) continue; // no parseable /YYYY/MM/DD/ in URL → skip (never stamp "now" / Invalid Date)
    // pull a human quarter label from the slug if present (…-q1-2027-…)
    const q = url.match(/-q(\d)-(\d{4})-/i);
    const qLabel = q ? `FY${q[2]} Q${q[1]}` : "";

    // Surface the CALL ITSELF (video/audio), not just the transcript text: a
    // YouTube SEARCH for the earnings call so 用户 can watch/listen. We link a
    // search results page (NOT a fabricated specific video URL) → 绝不编造, and
    // it always resolves. enName = the ASCII half of the 中文+英文 source name.
    const enName = co.name.replace(/[^\x00-\x7f]/g, "").trim() || co.ticker;
    const ytQuery = q ? `${enName} Q${q[1]} ${q[2]} earnings call` : `${enName} ${date.slice(0, 4)} earnings call`;
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`;

    out.push({
      id: `transcript:${tk}:${date}`,
      channel: "transcript",
      author: co.ticker,
      authorName: co.name,
      url,
      altUrl: ytUrl,
      altPlatform: "▶ 电话会 · YouTube",
      publishedAt: new Date(`${date}T13:00:00Z`).toISOString(),
      lang: "en",
      title: `${co.name}（$${co.ticker}）财报电话会实录${qLabel ? ` · ${qLabel}` : ""}`,
      textEn: [
        `Earnings call transcript for ${co.name} (${co.ticker})${qLabel ? `, ${qLabel}` : ""}, published ${date} by The Motley Fool.`,
        `Full prepared remarks and Q&A (free, complete transcript): ${url}`,
      ].join("\n"),
      summaryZh: null,
      translationZh: null,
      tickers: [co.ticker],
      sectors: ["EARNINGS"],
      secondHand: true,
      enriched: false,
      reportDate: date,
    });
  }
  return out;
}
