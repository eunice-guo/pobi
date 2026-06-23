// 论文 author SUBSCRIPTIONS via the arXiv API. For each followed author we pull
// their most recent submissions (au:"Name", newest first) so new papers appear
// automatically. Link-style item to the arXiv abstract page (永远链接原文); the
// enricher translates title + abstract. author = the author name, so 来源管理
// manages the person and removing them hides their auto-fetched papers.
// arXiv asks for ≤1 request / 3s — we sleep between authors.

const UA = process.env.ARXIV_USER_AGENT || "pobi-globalinfo (eg.eunice.guo@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchArxivAuthors(authors, perAuthor = 3) {
  const out = [];
  for (const a of (authors || []).filter((x) => x.enabled !== false)) {
    const q = encodeURIComponent(`au:"${a.name}"`);
    const url = `https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=${perAuthor}&sortBy=submittedDate&sortOrder=descending`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.warn(`  ! arxiv ${a.name}: HTTP ${res.status}`);
        await sleep(3000);
        continue;
      }
      const xml = await res.text();
      let n = 0;
      for (const e of xml.split("<entry>").slice(1)) {
        const idRaw = (e.match(/<id>(https?:\/\/arxiv\.org\/abs\/[^<]+)<\/id>/) || [])[1];
        if (!idRaw) continue;
        const arxivId = idRaw.split("/abs/")[1];
        const title = decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
        const abs = decode((e.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || "");
        const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
        const pub = published ? new Date(published) : null;
        if (!title || !pub || isNaN(pub.getTime())) continue; // no valid date → skip (never stamp "now")
        out.push({
          id: `paper:${arxivId}`,
          channel: "paper",
          author: a.name, // groups under the author subscription
          authorName: a.displayName || a.name,
          url: `https://arxiv.org/abs/${arxivId}`,
          publishedAt: pub.toISOString(),
          lang: "en",
          title,
          textEn: abs ? `${title}\n\n${abs}` : title,
          summaryZh: null,
          translationZh: null,
          tickers: [],
          sectors: a.sectors || ["AI-RESEARCH"],
          secondHand: true,
          enriched: false,
          website: a.website || null,
          github: a.github || null,
        });
        n++;
      }
      console.log(`  arxiv ${a.name}: ${n} paper(s)`);
    } catch (err) {
      console.warn(`  ! arxiv ${a.name} failed: ${err.message}`);
    }
    await sleep(3000);
  }
  return out;
}
