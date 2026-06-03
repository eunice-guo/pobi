// X / Twitter ingestion — Zara two-half pattern. Official API v2, bearer token.
// Gated: if X_BEARER_TOKEN is absent, the caller skips this entirely.

const X_API = "https://api.x.com/2";
const RETRY_STATUS = new Set([500, 502, 503, 504]);

async function xGet(path, token, attempt = 1) {
  const res = await fetch(`${X_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    throw new Error("X rate limit (429) — stopping X pull");
  }
  if (RETRY_STATUS.has(res.status) && attempt <= 3) {
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return xGet(path, token, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// handles: array of X usernames (no @). Returns FeedItem-shaped objects (pre-enrichment).
export async function fetchX(sources, token, sinceMs) {
  const byHandle = new Map(sources.map((s) => [s.handle.toLowerCase(), s]));
  const handles = [...byHandle.keys()];
  const items = [];
  // Resolve usernames -> ids (batched, up to 100).
  const lookup = await xGet(`/users/by?usernames=${handles.join(",")}`, token);
  const users = lookup.data || [];
  for (const u of users) {
    const src = byHandle.get(u.username.toLowerCase());
    const startTime = new Date(sinceMs).toISOString();
    const q =
      `/users/${u.id}/tweets?exclude=retweets,replies&max_results=5` +
      `&start_time=${startTime}&tweet.fields=created_at,public_metrics,note_tweet`;
    let data;
    try {
      data = await xGet(q, token);
    } catch (err) {
      console.warn(`  ! X pull failed for @${u.username}: ${err.message}`);
      continue;
    }
    const tweets = (data.data || []).slice(0, 3); // keep top 3/author
    for (const t of tweets) {
      const text = t.note_tweet?.text || t.text || "";
      items.push({
        id: `x:${t.id}`,
        channel: "x",
        author: src?.handle || u.username,
        authorName: src?.displayName || `@${u.username}`,
        url: `https://x.com/${u.username}/status/${t.id}`,
        publishedAt: t.created_at || new Date().toISOString(),
        lang: "en",
        title: null,
        textEn: text,
        summaryZh: null,
        translationZh: null,
        tickers: [],
        sectors: src?.sectors || [],
        secondHand: true,
        enriched: false,
      });
    }
  }
  return items;
}
