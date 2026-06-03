"use client";
import { useEffect, useMemo, useState } from "react";
import type { Feed, FeedItem } from "@/lib/types";
import ItemCard from "./ItemCard";

const WATCH_KEY = "pobi.watchlist";
const SEEN_KEY = "pobi.lastSeenAt";

export default function DigestFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [onlyWatched, setOnlyWatched] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    fetch("/feed/latest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setFeed)
      .catch((e) => setError(String(e)));
    try {
      setWatchlist(JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"));
      setLastSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    } catch {}
  }, []);

  // Mark "seen" on unmount-ish: record visit time once feed is loaded.
  useEffect(() => {
    if (feed) localStorage.setItem(SEEN_KEY, String(Date.now()));
  }, [feed]);

  function saveWatch(next: string[]) {
    setWatchlist(next);
    localStorage.setItem(WATCH_KEY, JSON.stringify(next));
  }
  function addTicker() {
    const t = draft.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (t && !watchlist.includes(t)) saveWatch([...watchlist, t]);
    setDraft("");
  }

  const items: FeedItem[] = feed?.items ?? [];
  const visible = useMemo(() => {
    if (!onlyWatched || watchlist.length === 0) return items;
    return items.filter((i) => i.tickers.some((t) => watchlist.includes(t)));
  }, [items, onlyWatched, watchlist]);

  const isNew = (i: FeedItem) => lastSeen > 0 && new Date(i.publishedAt).getTime() > lastSeen;
  const newCount = items.filter(isNew).length;

  if (error) return <p className="text-sm" style={{ color: "var(--flag)" }}>读取信源失败：{error}（先跑 <code>npm run build:feed</code>）</p>;
  if (!feed) return <p className="text-sm" style={{ color: "var(--ink-soft)" }}>加载中…</p>;

  return (
    <div>
      {/* watchlist controls */}
      <div className="mb-6 rounded-lg border p-4" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">我的持仓</span>
          {watchlist.length === 0 && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>加几个代码，按持仓筛选</span>}
          {watchlist.map((t) => (
            <button key={t} onClick={() => saveWatch(watchlist.filter((x) => x !== t))} className="rounded border px-1.5 py-0.5 font-mono text-xs hover:line-through" style={{ borderColor: "var(--line)" }} title="点击删除">
              ${t} ✕
            </button>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
            placeholder="NVDA"
            className="w-20 rounded border bg-transparent px-2 py-0.5 text-xs uppercase outline-none"
            style={{ borderColor: "var(--line)" }}
          />
          <button onClick={addTicker} className="text-xs font-medium" style={{ color: "var(--teal)" }}>+ 加入</button>
          <label className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={onlyWatched} onChange={(e) => setOnlyWatched(e.target.checked)} />
            只看持仓
          </label>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs" style={{ color: "var(--ink-soft)" }}>
        <span>
          {feed.date} · 共 {feed.itemCount} 条{newCount > 0 && <> · <strong style={{ color: "var(--flag)" }}>{newCount} 条新</strong></>}
          {!feed.enriched && <> · ⚠ 未启用翻译（缺 ANTHROPIC_API_KEY）</>}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {visible.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>该筛选下暂无内容。</p>
        ) : (
          visible.map((i) => <ItemCard key={i.id} item={i} isNew={isNew(i)} />)
        )}
      </div>
    </div>
  );
}
