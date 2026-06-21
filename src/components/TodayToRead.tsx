"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FeedItem } from "@/lib/types";
import { dayLabel } from "@/lib/date";

const CHANNEL_LABEL: Record<string, string> = {
  x: "X",
  substack: "Substack",
  transcript: "财报电话会",
  research: "资管研究",
};

// 「今日待读 / Today to Read」— 打开 pobi 首屏看到的必读清单：
// 新的 earnings call（财报电话会 transcript）+ 未读文章。已读后从清单移出。
// 「未读」是逐篇状态（localStorage pobi.readIds），区别于「自上次访问以来」的 new 标记。
export default function TodayToRead({
  items,
  readIds,
  selected,
  onRead,
  onReadAll,
}: {
  items: FeedItem[];
  readIds: Set<string>;
  selected: string | null;
  onRead: (id: string) => void;
  onReadAll: (ids: string[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // unread, earnings calls first, then newest-first.
  const unread = useMemo(() => {
    const scoped = selected ? items.filter((i) => i.tickers.includes(selected)) : items;
    return scoped
      .filter((i) => !readIds.has(i.id))
      .sort((a, b) => {
        const ea = a.channel === "transcript" ? 0 : 1;
        const eb = b.channel === "transcript" ? 0 : 1;
        if (ea !== eb) return ea - eb;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }, [items, readIds, selected]);

  const calls = unread.filter((i) => i.channel === "transcript").length;
  const shown = unread.slice(0, 12);

  return (
    <section
      className="mb-8 rounded-xl border p-5"
      style={{ background: "var(--paper-2)", borderColor: "var(--line)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[20px] font-semibold leading-none">今日待读</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--teal)" }}>
          Today to Read
        </span>
        <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
          {unread.length} 条未读{calls > 0 ? ` · ${calls} 场财报电话会` : ""}
          {selected ? ` · $${selected}` : ""}
        </span>
        {unread.length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="font-mono text-[11px] underline-offset-2 hover:underline"
              style={{ color: "var(--ink-faint)" }}
            >
              {collapsed ? "展开" : "收起"}
            </button>
            <button
              onClick={() => onReadAll(unread.map((i) => i.id))}
              className="font-mono text-[11px] underline-offset-2 hover:underline"
              style={{ color: "var(--ink-faint)" }}
            >
              全部已读
            </button>
          </div>
        )}
      </div>

      {unread.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--ink-faint)" }}>
          今天的都读完了 ✓
        </p>
      ) : collapsed ? null : (
        <ul className="mt-4 flex flex-col divide-y" style={{ borderColor: "var(--line)" }}>
          {shown.map((i) => {
            const href = `/read?id=${encodeURIComponent(i.id)}`;
            const isCall = i.channel === "transcript";
            return (
              <li key={i.id} className="flex items-start gap-3 py-2.5 first:pt-0">
                <span
                  className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide"
                  style={
                    isCall
                      ? { background: "var(--teal)", color: "var(--paper)" }
                      : { background: "var(--teal-soft)", color: "var(--teal)" }
                  }
                >
                  {CHANNEL_LABEL[i.channel] ?? i.channel}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    onClick={() => onRead(i.id)}
                    className="block truncate text-[15px] font-medium leading-snug transition-colors hover:text-[var(--teal)]"
                    style={{ color: "var(--ink)" }}
                    title={i.title ?? i.summaryZh ?? i.textEn}
                  >
                    {i.title ?? i.summaryZh ?? `${i.authorName}：${i.textEn.slice(0, 60)}…`}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    <span className="truncate">{i.authorName}</span>
                    <span className="font-mono tabular-nums">{dayLabel(i.publishedAt)}</span>
                    {i.tickers.slice(0, 3).map((t) => (
                      <span key={t} className="ticker" style={{ color: "var(--ink-soft)" }}>
                        ${t}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => onRead(i.id)}
                  className="mt-0.5 shrink-0 font-mono text-[11px] underline-offset-2 hover:underline"
                  style={{ color: "var(--ink-faint)" }}
                  title="标为已读"
                >
                  已读
                </button>
              </li>
            );
          })}
          {unread.length > shown.length && (
            <li className="pt-2.5 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
              还有 {unread.length - shown.length} 条，下滑到信息流查看 ↓
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
