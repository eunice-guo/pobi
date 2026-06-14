"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Feed, FeedItem } from "@/lib/types";
import { fullDateLabel } from "@/lib/date";

const CHANNEL_LABEL: Record<string, string> = { x: "X", substack: "Substack", transcript: "业绩记录" };

// Some translations echo the "标题：… 正文：" scaffold from the prompt — strip it.
function cleanTranslation(t: string): string {
  return t.replace(/^\s*标题：[\s\S]*?正文：/, "").replace(/^\s*正文：/, "").trim();
}

function Reader() {
  const id = useSearchParams().get("id");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/feed/latest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setFeed)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <Shell><p style={{ color: "var(--flag)" }}>读取失败：{error}</p></Shell>;
  if (!feed) return <Shell><p className="font-mono text-sm" style={{ color: "var(--ink-soft)" }}>加载中…</p></Shell>;

  const item: FeedItem | undefined = feed.items.find((i) => i.id === id);
  if (!item)
    return (
      <Shell>
        <p style={{ color: "var(--ink-soft)" }}>没找到这条内容（可能已不在最新一期信源里）。</p>
        <Link href="/" className="mt-4 inline-block font-mono text-sm" style={{ color: "var(--teal)" }}>← 返回首页</Link>
      </Shell>
    );

  const body = item.translationZh ? cleanTranslation(item.translationZh) : null;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs" style={{ color: "var(--ink-soft)" }}>
        <span style={{ color: "var(--ink-faint)" }}>{fullDateLabel(item.publishedAt)}</span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}>
          {CHANNEL_LABEL[item.channel] ?? item.channel}
        </span>
        <span className="font-sans font-medium" style={{ color: "var(--ink)" }}>{item.authorName}</span>
        {item.tickers.map((t) => (
          <span key={t} className="ticker rounded border px-1 text-[11px]" style={{ borderColor: "var(--line)" }}>${t}</span>
        ))}
      </div>

      {item.title && <h1 className="font-display mt-4 text-[34px] font-semibold leading-[1.18] tracking-tight">{item.title}</h1>}

      {item.summaryZh && (
        <div className="mt-6 rounded-lg border-l-2 py-1 pl-4" style={{ borderColor: "var(--teal)" }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-faint)" }}>摘要</p>
          <p className="mt-1.5 text-[16px] leading-relaxed" style={{ color: "var(--ink)" }}>{item.summaryZh}</p>
        </div>
      )}

      {body ? (
        <div className="reading mt-8 whitespace-pre-wrap text-[17.5px] leading-[1.95]" style={{ color: "var(--ink)" }}>
          {body}
        </div>
      ) : (
        <p className="mt-8 text-[15px]" style={{ color: "var(--ink-faint)" }}>（此条暂无中文译文，请看原文。）</p>
      )}

      <div className="mt-10 flex items-center gap-5 border-t pt-5 text-sm" style={{ borderColor: "var(--line)" }}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--teal)" }}>
          阅读英文原文 ↗
        </a>
        <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
          忠实翻译 · 节选 · 不给买卖建议
        </span>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[680px] px-5 py-10 sm:px-6">
      <Link href="/" className="font-display text-lg font-semibold tracking-tight transition-colors hover:text-[var(--teal)]">
        ← 破壁 <span className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--ink-faint)" }}>GlobalInfo</span>
      </Link>
      <article className="mt-7">{children}</article>
    </main>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<Shell><p className="font-mono text-sm" style={{ color: "var(--ink-soft)" }}>加载中…</p></Shell>}>
      <Reader />
    </Suspense>
  );
}
