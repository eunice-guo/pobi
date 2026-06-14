"use client";
import { useState } from "react";

// Left rail. The watchlist is a set of tickers (e.g. NVDA). Selecting one scopes
// the calendar + news column to that ticker; "全部" is the everything view.
export default function Watchlist({
  tickers,
  counts,
  total,
  selected,
  onSelect,
  onAdd,
  onRemove,
}: {
  tickers: string[];
  counts: Record<string, number>;
  total: number;
  selected: string | null;
  onSelect: (t: string | null) => void;
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (t) onAdd(t);
    setDraft("");
  }

  const Row = ({
    label,
    count,
    active,
    onClick,
    onX,
  }: {
    label: React.ReactNode;
    count: number;
    active: boolean;
    onClick: () => void;
    onX?: () => void;
  }) => (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition-colors"
      style={{
        background: active ? "var(--teal)" : "transparent",
        color: active ? "var(--paper)" : "var(--ink)",
      }}
    >
      <span className="ticker flex-1 text-[13px]">{label}</span>
      <span
        className="font-mono text-[11px] tabular-nums"
        style={{ color: active ? "var(--paper)" : count ? "var(--ink-soft)" : "var(--ink-faint)" }}
      >
        {count}
      </span>
      {onX && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onX();
          }}
          aria-label={`移除 ${label}`}
          className="font-mono text-xs opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
          style={{ color: active ? "var(--paper)" : "var(--flag)" }}
        >
          ✕
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ink-soft)" }}>
          Watchlist
        </h2>
        <span className="font-mono text-[10px]" style={{ color: "var(--ink-faint)" }}>
          {tickers.length} 只
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <Row label="全部 · All" count={total} active={selected === null} onClick={() => onSelect(null)} />
        {tickers.map((t) => (
          <Row
            key={t}
            label={`$${t}`}
            count={counts[t] || 0}
            active={selected === t}
            onClick={() => onSelect(selected === t ? null : t)}
            onX={() => onRemove(t)}
          />
        ))}
      </div>

      <div
        className="mt-3 flex items-center gap-1 rounded-md border px-2 py-1.5"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <span className="ticker text-[13px]" style={{ color: "var(--ink-faint)" }}>$</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="NVDA"
          className="ticker w-full bg-transparent text-[13px] uppercase outline-none placeholder:normal-case"
          style={{ color: "var(--ink)" }}
        />
        <button onClick={add} className="font-mono text-xs font-medium" style={{ color: "var(--teal)" }}>
          加入
        </button>
      </div>
      {tickers.length === 0 && (
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
          加入你关心的代码，按 ticker 跟踪当日新闻。
        </p>
      )}
    </div>
  );
}
