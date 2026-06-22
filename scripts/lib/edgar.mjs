// Earnings ingestion via SEC EDGAR — the "业绩记录" channel (phase 2).
// Free, official, dated, 绝不编造: we read each company's filing history and pick
// the most recent earnings 8-K (Item 2.02 "Results of Operations and Financial
// Condition"), then link the official SEC filing + the IR webcast replay.
//
// This is a LINK-style read queue: we do NOT scrape the full transcript (those
// are paywalled). We surface the real filing as a to-read item, pre-tagged with
// the ticker so it drops straight into the watchlist.

// SEC asks for a descriptive User-Agent with contact info on automated requests.
const UA = process.env.SEC_USER_AGENT || "pobi-globalinfo (eg.eunice.guo@gmail.com)";

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`EDGAR HTTP ${res.status} for ${url}`);
  return res.json();
}

// Build the canonical SEC links for one filing.
function filingLinks(cik, accession, primaryDoc) {
  const cikNum = String(Number(cik)); // SEC archive paths drop leading zeros
  const accNoDashes = accession.replace(/-/g, "");
  const dir = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}`;
  return {
    index: `${dir}/${accession}-index.htm`, // human-readable filing index (all exhibits)
    primary: primaryDoc ? `${dir}/${primaryDoc}` : `${dir}/`,
  };
}

// One company → up to `perCompany` most-recent earnings 8-Ks as FeedItem-shaped objects.
async function fetchOne(co, perCompany) {
  const data = await getJson(`https://data.sec.gov/submissions/CIK${co.cik}.json`);
  const r = data.filings?.recent;
  if (!r) return [];

  const out = [];
  for (let i = 0; i < r.form.length && out.length < perCompany; i++) {
    if (r.form[i] !== "8-K") continue;
    if (!String(r.items[i] || "").includes("2.02")) continue; // 2.02 = Results of Operations (earnings)

    const filed = r.filingDate[i]; // YYYY-MM-DD
    const reportDate = r.reportDate[i] || "";
    const { index, primary } = filingLinks(co.cik, r.accessionNumber[i], r.primaryDocument[i]);

    // English body for the enricher to translate. Link-style: pointers, not transcript text.
    const textEn = [
      `${data.name} (${co.ticker}) filed an earnings release with the SEC on ${filed}` +
        (reportDate ? ` for the period ended ${reportDate}` : "") + `.`,
      `Form 8-K, Item 2.02 — Results of Operations and Financial Condition.`,
      `Official filing (press release + financial exhibits): ${index}`,
      `Earnings-call webcast / replay (investor relations): ${co.ir}`,
    ].join("\n");

    out.push({
      id: `transcript:${r.accessionNumber[i]}`,
      channel: "transcript",
      author: co.ticker,
      authorName: co.name,
      url: index,
      publishedAt: new Date(`${filed}T13:00:00Z`).toISOString(),
      lang: "en",
      title: `${co.name}（$${co.ticker}）季度业绩发布 · 8-K`,
      textEn,
      summaryZh: null,
      translationZh: null,
      tickers: [co.ticker],
      sectors: ["EARNINGS"],
      secondHand: true,
      enriched: false,
      // extra metadata the app can use; ignored by the strict FeedItem consumers
      ir: co.ir,
      reportDate,
    });
  }
  return out;
}

// Fetch the latest earnings 8-K(s) for every configured company.
// NOT gated by the lookback window — this is a standing "latest earnings per
// 龙头" read queue, refreshed whenever a new quarter is filed.
export async function fetchEarnings(companies, perCompany = 1) {
  const all = [];
  for (const co of companies) {
    try {
      const got = await fetchOne(co, perCompany);
      console.log(`  edgar ${co.ticker}: ${got.length} earnings filing(s)`);
      all.push(...got);
      await new Promise((r) => setTimeout(r, 150)); // be polite to SEC (≈10 req/s cap)
    } catch (err) {
      console.warn(`  ! edgar ${co.ticker} failed: ${err.message}`);
    }
  }
  return all;
}
