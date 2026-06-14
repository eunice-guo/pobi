"use client";
import { useEffect, useMemo, useState } from "react";
import type { Feed, FeedItem } from "@/lib/types";
import { localDay, fullDateLabel } from "@/lib/date";
import ItemCard from "./ItemCard";
import Watchlist from "./Watchlist";
import Calendar from "./Calendar";

const WATCH_KEY = "pobi.watchlist";
const SEEN_KEY = "pobi.lastSeenAt";

export default function DigestFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // ticker or null = all
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(0);

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

  useEffect(() => {
    if (feed) localStorage.setItem(SEEN_KEY, String(Date.now()));
  }, [feed]);

  function saveWatch(next: string[]) {
    setWatchlist(next);
    localStorage.setItem(WATCH_KEY, JSON.stringify(next));
  }
  const addTicker = (t: string) => {
    if (!watchlist.includes(t)) saveWatch([...watchlist, t]);
  };
  const removeTicker = (t: string) => {
    saveWatch(watchlist.filter((x) => x !== t));
    if (selected === t) setSelected(null);
  };
  const pickTicker = (t: string | null) => {
    setSelected(t);
    setSelectedDate(null); // reset date when scope changes
  };

  const items: FeedItem[] = feed?.items ?? [];

  // scope by ticker first (drives the calendar), then by clicked date (drives the list)
  const tickerScoped = useMemo(
    () => (selected ? items.filter((i) => i.tickers.includes(selected)) : items),
    [items, selected]
  );
  const visible = useMemo(
    () => (selectedDate ? tickerScoped.filter((i) => localDay(i.publishedAt) === selectedDate) : tickerScoped),
    [tickerScoped, selectedDate]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of watchlist) c[t] = items.filter((i) => i.tickers.includes(t)).length;
    return c;
  }, [items, watchlist]);

  const isNew = (i: FeedItem) => lastSeen > 0 && new Date(i.publishedAt).getTime() > lastSeen;

  if (error)
    return (
      <p className="text-sm" style={{ color: "var(--flag)" }}>
        读取信源失败：{error}（先跑 <code className="font-mono">npm run build:feed</code>）
      </p>
    );
  if (!feed)
    return (
      <p className="font-mono text-sm" style={{ color: "var(--ink-soft)" }}>
        加载中…
      </p>
    );

  return (
    <div className="grid gap-8 lg:grid-cols-[270px_minmax(0,1fr)]">
      {/* LEFT — watchlist + calendar almanac */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-xl border p-4" style={{ background: "var(--paper-2)", borderColor: "var(--line)" }}>
          <Watchlist
            tickers={watchlist}
            counts={counts}
            total={items.length}
            selected={selected}
            onSelect={pickTicker}
            onAdd={addTicker}
            onRemove={removeTicker}
          />
          <hr className="my-4 border-0 border-t" style={{ borderColor: "var(--line)" }} />
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ink-soft)" }}>
              Calendar
            </h2>
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-faint)" }}>
              {selected ? `$${selected}` : "全部"}
            </span>
          </div>
          <Calendar items={tickerScoped} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </div>
      </aside>

      {/* RIGHT — scrolling news column */}
      <section>
        <div
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-3 font-mono text-[11px] uppercase tracking-wide"
          style={{ color: "var(--ink-faint)", borderColor: "var(--line)" }}
        >
          <span style={{ color: "var(--ink-soft)" }}>
            {selected ? `$${selected}` : "全部信源"} · {visible.length} 条
          </span>
          {selectedDate && (
            <span style={{ color: "var(--teal)" }}>
              {fullDateLabel(visible[0]?.publishedAt ?? selectedDate + "T00:00:00")}
            </span>
          )}
          <span className="ml-auto normal-case">截至 {feed.date}</span>
        </div>

        <div className="flex flex-col gap-4">
          {visible.length === 0 ? (
            <div
              className="rounded-lg border border-dashed p-8 text-center text-sm"
              style={{ borderColor: "var(--line)", color: "var(--ink-faint)" }}
            >
              {selected ? (
                <>
                  这批信源里暂时没有提到 <span className="ticker">${selected}</span> 的内容。
                  <br />
                  目前一手信源以宏观 / 中国科技为主，个股标签会随 X 信源接入变多。
                </>
              ) : (
                "该筛选下暂无内容。"
              )}
            </div>
          ) : (
            visible.map((i, idx) => <ItemCard key={i.id} item={i} isNew={isNew(i)} index={idx} />)
          )}
        </div>
      </section>
    </div>
  );
}
