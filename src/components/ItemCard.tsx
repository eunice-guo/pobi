"use client";
import Link from "next/link";
import type { FeedItem } from "@/lib/types";
import { dayLabel } from "@/lib/date";

const CHANNEL_LABEL: Record<string, string> = { x: "X", substack: "Substack", transcript: "业绩记录", research: "资管观点" };
const SECTOR_LABEL: Record<string, string> = {
  "CHINA-TECH": "中国科技",
  "AI-SEMIS": "AI · 半导体",
  THEMATIC: "主题",
  SOFTWARE: "软件",
  QUALITY: "优质公司",
  "SPECIAL-SITS": "特殊事件",
  "TECH-STRATEGY": "科技战略",
  MACRO: "宏观",
  ENERGY: "能源",
  SHORT: "做空",
  EARNINGS: "业绩",
  "ASSET-MGR": "资管",
};

export default function ItemCard({
  item,
  isNew,
  index = 0,
  watchlist = [],
  isRead = false,
  onToggleRead,
  onRead,
}: {
  item: FeedItem;
  isNew: boolean;
  index?: number;
  watchlist?: string[];
  isRead?: boolean;
  onToggleRead?: (id: string) => void;
  onRead?: (id: string) => void;
}) {
  const markRead = () => onRead?.(item.id);
  const href = `/read?id=${encodeURIComponent(item.id)}`;
  const hasTickers = item.tickers.length > 0;

  return (
    <article
      className="rise group rounded-lg border p-5 transition-shadow hover:shadow-[0_2px_20px_-8px_rgba(0,0,0,0.18)]"
      style={{
        background: "var(--surface)",
        borderColor: "var(--line)",
        animationDelay: `${Math.min(index, 8) * 45}ms`,
        opacity: isRead ? 0.55 : 1,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs" style={{ color: "var(--ink-soft)" }}>
        <span className="font-mono tabular-nums" style={{ color: "var(--ink-faint)" }}>
          {dayLabel(item.publishedAt)}
        </span>
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide"
          style={{ background: "var(--teal-soft)", color: "var(--teal)" }}
        >
          {CHANNEL_LABEL[item.channel] ?? item.channel}
        </span>
        <span className="font-medium" style={{ color: "var(--ink)" }}>
          {item.authorName}
        </span>
        {isNew && (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--flag)" }}>
            ● new
          </span>
        )}
      </div>

      {item.title && (
        <Link href={href} onClick={markRead}>
          <h3 className="font-display mt-2.5 text-[21px] font-semibold leading-snug transition-colors group-hover:text-[var(--teal)]">
            {item.title}
          </h3>
        </Link>
      )}

      {/* which ticker(s) / theme this info relates to */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--ink-faint)" }}>
          相关
        </span>
        {hasTickers ? (
          item.tickers.map((t) => {
            const watched = watchlist.includes(t);
            return (
              <span
                key={t}
                className="ticker rounded px-1.5 py-0.5 text-[11px] font-medium"
                style={
                  watched
                    ? { background: "var(--teal)", color: "var(--paper)" }
                    : { border: "1px solid var(--line)", color: "var(--ink-soft)" }
                }
                title={watched ? "在你的 watchlist 中" : undefined}
              >
                ${t}
              </span>
            );
          })
        ) : item.sectors.length ? (
          item.sectors.map((s) => (
            <span
              key={s}
              className="rounded px-1.5 py-0.5 text-[11px]"
              style={{ background: "var(--paper-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}
            >
              {SECTOR_LABEL[s] ?? s}
            </span>
          ))
        ) : (
          <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
            宏观 · 暂无个股标的
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {item.summaryZh ?? (
          <span style={{ color: "var(--ink-faint)" }}>（翻译待生成）{item.textEn.slice(0, 160)}…</span>
        )}
      </p>

      <div className="mt-3.5 flex items-center gap-4 text-xs">
        {item.translationZh && (
          <Link href={href} onClick={markRead} className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--teal)" }}>
            阅读全文译文 →
          </Link>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markRead}
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--ink-faint)" }}
        >
          {item.channel === "transcript" ? "SEC 原文 ↗" : "原文 ↗"}
        </a>
        {onToggleRead && (
          <button
            type="button"
            onClick={() => onToggleRead(item.id)}
            className="ml-auto rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors"
            style={
              isRead
                ? { borderColor: "var(--teal)", color: "var(--teal)", background: "var(--teal-soft)" }
                : { borderColor: "var(--line)", color: "var(--ink-faint)" }
            }
            title={isRead ? "点按标回待读" : "标为已读"}
          >
            {isRead ? "✓ 已读" : "标为已读"}
          </button>
        )}
      </div>
    </article>
  );
}
