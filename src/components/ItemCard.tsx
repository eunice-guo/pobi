"use client";
import { useState } from "react";
import type { FeedItem } from "@/lib/types";

const CHANNEL_LABEL: Record<string, string> = { x: "X", substack: "Substack", transcript: "业绩记录" };

export default function ItemCard({ item, isNew }: { item: FeedItem; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  const when = new Date(item.publishedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

  return (
    <article
      className="rounded-lg border p-4 transition-shadow hover:shadow-sm"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
        {isNew && (
          <span className="font-semibold" style={{ color: "var(--flag)" }}>
            ● 新
          </span>
        )}
        <span
          className="rounded px-1.5 py-0.5 font-medium"
          style={{ background: "var(--teal-soft)", color: "var(--teal)" }}
        >
          {CHANNEL_LABEL[item.channel] ?? item.channel}
        </span>
        <span className="font-medium" style={{ color: "var(--ink)" }}>
          {item.authorName}
        </span>
        <span>·</span>
        <span>{when}</span>
        {item.tickers.map((t) => (
          <span key={t} className="rounded border px-1 font-mono" style={{ borderColor: "var(--line)" }}>
            ${t}
          </span>
        ))}
      </div>

      {item.title && <h3 className="font-display mt-2 text-lg leading-snug">{item.title}</h3>}

      <p className="mt-2 text-[15px] leading-relaxed">
        {item.summaryZh ?? (
          <span style={{ color: "var(--ink-soft)" }}>
            （翻译待生成）{item.textEn.slice(0, 180)}…
          </span>
        )}
      </p>

      <div className="mt-3 flex items-center gap-4 text-xs">
        {item.translationZh && (
          <button onClick={() => setOpen((v) => !v)} className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--teal)" }}>
            {open ? "收起译文" : "展开忠实译文"}
          </button>
        )}
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline" style={{ color: "var(--ink-soft)" }}>
          原文 ↗
        </a>
      </div>

      {open && item.translationZh && (
        <div className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm leading-relaxed" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
          {item.translationZh}
        </div>
      )}
    </article>
  );
}
