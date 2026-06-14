"use client";
import Link from "next/link";
import type { FeedItem } from "@/lib/types";
import { dayLabel } from "@/lib/date";

const CHANNEL_LABEL: Record<string, string> = { x: "X", substack: "Substack", transcript: "业绩记录" };

export default function ItemCard({ item, isNew, index = 0 }: { item: FeedItem; isNew: boolean; index?: number }) {
  const href = `/read?id=${encodeURIComponent(item.id)}`;

  return (
    <article
      className="rise group rounded-lg border p-5 transition-shadow hover:shadow-[0_2px_20px_-8px_rgba(0,0,0,0.18)]"
      style={{ background: "var(--surface)", borderColor: "var(--line)", animationDelay: `${Math.min(index, 8) * 45}ms` }}
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
        <span className="ml-auto flex flex-wrap gap-1">
          {item.tickers.map((t) => (
            <span key={t} className="ticker rounded border px-1 text-[11px]" style={{ borderColor: "var(--line)" }}>
              ${t}
            </span>
          ))}
        </span>
      </div>

      {item.title && (
        <Link href={href}>
          <h3 className="font-display mt-2.5 text-[21px] font-semibold leading-snug transition-colors group-hover:text-[var(--teal)]">
            {item.title}
          </h3>
        </Link>
      )}

      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {item.summaryZh ?? (
          <span style={{ color: "var(--ink-faint)" }}>（翻译待生成）{item.textEn.slice(0, 160)}…</span>
        )}
      </p>

      <div className="mt-3.5 flex items-center gap-4 text-xs">
        {item.translationZh && (
          <Link
            href={href}
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--teal)" }}
          >
            阅读全文译文 →
          </Link>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--ink-faint)" }}
        >
          原文 ↗
        </a>
      </div>
    </article>
  );
}
