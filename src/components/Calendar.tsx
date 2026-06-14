"use client";
import { useMemo, useState } from "react";
import type { FeedItem } from "@/lib/types";
import { localDay } from "@/lib/date";

const WD = ["日", "一", "二", "三", "四", "五", "六"];
const MO = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// Calendar over the currently-selected scope (all news, or one ticker's news).
// Days that carry info are teal + dotted and clickable; clicking sets the date
// filter for the news column. `items` is already scoped by the parent.
export default function Calendar({
  items,
  selectedDate,
  onSelectDate,
}: {
  items: FeedItem[];
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
}) {
  // day -> count, for dotting cells
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = localDay(it.publishedAt);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [items]);

  // default view = month of the newest item (fallback today)
  const newest = items[0] ? new Date(items[0].publishedAt) : new Date();
  const [view, setView] = useState(() => new Date(newest.getFullYear(), newest.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const key = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label="上个月"
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="font-mono text-sm px-1.5 leading-none hover:opacity-100 opacity-50"
        >
          ‹
        </button>
        <span className="font-mono text-xs tracking-wide" style={{ color: "var(--ink-soft)" }}>
          {year} · {MO[month]}
        </span>
        <button
          aria-label="下个月"
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="font-mono text-sm px-1.5 leading-none hover:opacity-100 opacity-50"
        >
          ›
        </button>
      </div>

      <div className="cal-grid mb-1">
        {WD.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-mono"
            style={{ color: "var(--ink-faint)" }}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="cal-cell" aria-hidden />;
          const k = key(d);
          const has = counts.has(k);
          const sel = selectedDate === k;
          return (
            <button
              key={k}
              disabled={!has}
              onClick={() => onSelectDate(sel ? null : k)}
              className={`cal-cell ${has ? "has" : ""} ${sel ? "sel" : ""}`}
              title={has ? `${counts.get(k)} 条` : undefined}
            >
              {d}
              {has && <span className="dot" />}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <button
          onClick={() => onSelectDate(null)}
          className="mt-3 w-full font-mono text-[11px] tracking-wide hover:underline"
          style={{ color: "var(--teal)" }}
        >
          ✕ 清除日期筛选
        </button>
      )}
    </div>
  );
}
