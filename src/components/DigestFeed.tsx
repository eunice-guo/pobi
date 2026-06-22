"use client";
import { useEffect, useMemo, useState } from "react";
import type { Feed, FeedItem } from "@/lib/types";
import { localDay, fullDateLabel } from "@/lib/date";
import ItemCard from "./ItemCard";
import Watchlist from "./Watchlist";
import Calendar from "./Calendar";

const WATCH_KEY = "pobi.watchlist";
const SEEN_KEY = "pobi.lastSeenAt";
const READ_KEY = "pobi.readIds";

// Channel filter chips. null = all. transcript (业绩记录) + research (资管观点)
// are the "待读清单" lanes; combine with 只看待读 to get a clean reading queue.
const CHANNELS: { key: string | null; label: string }[] = [
  { key: null, label: "全部" },
  { key: "transcript", label: "业绩记录" },
  { key: "research", label: "资管观点" },
  { key: "podcast", label: "播客访谈" },
  { key: "bookmark", label: "收藏" },
  { key: "substack", label: "Substack" },
  { key: "x", label: "X" },
];

// 龙头 default watchlist — Magnificent 7 + AMD + SpaceX (private, tracked as a
// pseudo-ticker). Seeded on first visit so the rail isn't empty; the user can
// remove any of these. A one-time migration flag avoids re-adding removed ones.
const DEFAULT_WATCHLIST = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AMD", "SPACEX"];
const SEEDED_KEY = "pobi.watchlist.seeded";

export default function DigestFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // ticker or null = all
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [channel, setChannel] = useState<string | null>(null); // channel filter or null = all
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/feed/latest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setFeed)
      .catch((e) => setError(String(e)));
    try {
      const stored = localStorage.getItem(WATCH_KEY);
      const existing: string[] = stored ? JSON.parse(stored) : [];
      // One-time migration: merge the 龙头 defaults in (defaults first, dedup,
      // keep any extras the user added). Runs once per browser, then respects
      // every later add/remove. Fixes empty/sparse rails for existing visitors.
      if (!localStorage.getItem(SEEDED_KEY)) {
        const merged = [...new Set([...DEFAULT_WATCHLIST, ...existing])];
        setWatchlist(merged);
        localStorage.setItem(WATCH_KEY, JSON.stringify(merged));
        localStorage.setItem(SEEDED_KEY, "1");
      } else {
        setWatchlist(existing);
      }
      setLastSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
      const r = localStorage.getItem(READ_KEY);
      if (r) setReadIds(new Set(JSON.parse(r) as string[]));
    } catch {}
  }, []);

  const persistRead = (next: Set<string>) => {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    } catch {}
  };
  const toggleRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistRead(next);
      return next;
    });
  };
  // Auto-mark on open. Persist synchronously (not just inside the state updater)
  // because opening the title link unmounts this component mid-navigation — a
  // deferred write could be dropped before it ever runs.
  const markRead = (id: string) => {
    try {
      const cur = new Set<string>(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
      if (!cur.has(id)) {
        cur.add(id);
        localStorage.setItem(READ_KEY, JSON.stringify([...cur]));
      }
    } catch {}
    setReadIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

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
  const channelScoped = useMemo(
    () => (channel ? tickerScoped.filter((i) => i.channel === channel) : tickerScoped),
    [tickerScoped, channel]
  );
  const dateScoped = useMemo(
    () => (selectedDate ? channelScoped.filter((i) => localDay(i.publishedAt) === selectedDate) : channelScoped),
    [channelScoped, selectedDate]
  );
  const visible = useMemo(
    () => (unreadOnly ? dateScoped.filter((i) => !readIds.has(i.id)) : dateScoped),
    [dateScoped, unreadOnly, readIds]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of watchlist) c[t] = items.filter((i) => i.tickers.includes(t)).length;
    return c;
  }, [items, watchlist]);

  // per-channel counts within the current ticker scope (drives the filter chips)
  const channelCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of tickerScoped) c[i.channel] = (c[i.channel] || 0) + 1;
    return c;
  }, [tickerScoped]);

  // knowledge-tracker progress for the current scope (channel + ticker + date,
  // before the 只看待读 filter so the numbers stay stable as you read).
  const progress = useMemo(() => {
    const total = dateScoped.length;
    const read = dateScoped.reduce((n, i) => n + (readIds.has(i.id) ? 1 : 0), 0);
    const pct = total ? Math.round((read / total) * 100) : 0;
    return { total, read, unread: total - read, pct };
  }, [dateScoped, readIds]);

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
        {/* channel filter + 待读 toggle */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {CHANNELS.map((c) => {
            const active = channel === c.key;
            const n = c.key === null ? tickerScoped.length : channelCounts[c.key] || 0;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setChannel(c.key)}
                className="rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors"
                style={
                  active
                    ? { background: "var(--teal)", color: "var(--paper)", borderColor: "var(--teal)" }
                    : { borderColor: "var(--line)", color: "var(--ink-soft)" }
                }
              >
                {c.label}
                <span className="ml-1 tabular-nums" style={{ opacity: 0.7 }}>
                  {n}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className="ml-auto rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors"
            style={
              unreadOnly
                ? { background: "var(--teal-soft)", color: "var(--teal)", borderColor: "var(--teal)" }
                : { borderColor: "var(--line)", color: "var(--ink-faint)" }
            }
            title="只显示尚未标为已读的条目"
          >
            {unreadOnly ? "● 只看待读" : "只看待读"}
          </button>
        </div>

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
          {/* knowledge-tracker progress */}
          <span className="flex items-center gap-2 normal-case">
            <span title="本范围内已读 / 待读">
              <span style={{ color: "var(--teal)" }}>已读 {progress.read}</span>
              <span style={{ color: "var(--ink-faint)" }}> · 待读 {progress.unread}</span>
            </span>
            <span
              className="h-1.5 w-16 overflow-hidden rounded-full"
              style={{ background: "var(--line)" }}
              aria-label={`已读 ${progress.pct}%`}
            >
              <span
                className="block h-full rounded-full transition-all"
                style={{ width: `${progress.pct}%`, background: "var(--teal)" }}
              />
            </span>
          </span>
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
            visible.map((i, idx) => (
              <ItemCard
                key={i.id}
                item={i}
                isNew={isNew(i)}
                index={idx}
                watchlist={watchlist}
                isRead={readIds.has(i.id)}
                onToggleRead={toggleRead}
                onRead={markRead}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
