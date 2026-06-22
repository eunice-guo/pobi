"use client";
import { useEffect, useMemo, useState } from "react";
import type { Channel, Feed } from "@/lib/types";
import { dayLabel, fullDateLabel } from "@/lib/date";
import { PBBrand, PBAvatar, PBPlatform, PBDisclaimer } from "./pb";
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  CHANNEL_EN,
  SECTOR_LABEL,
  FOLDERS,
  type Folder,
  toVM,
  type TriageVM,
} from "@/lib/triage";

const READ_KEY = "pobi.readIds";
const STAR_KEY = "pobi.starredIds";
const SAVE_KEY = "pobi.savedIds";
const SEEN_KEY = "pobi.lastSeenAt";
const PAPER_SEED_KEY = "pobi.papersSeeded"; // one-time: papers → 待读清单

function loadSet(key: string): Set<string> {
  try {
    const r = localStorage.getItem(key);
    return r ? new Set(JSON.parse(r) as string[]) : new Set();
  } catch {
    return new Set();
  }
}
function saveSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch {}
}

// ── small star glyph ───────────────────────────────────────────────────────
function Star({ filled, size = 12 }: { filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
      fill={filled ? "var(--seal)" : "none"} stroke={filled ? "var(--seal)" : "currentColor"} strokeWidth={1.6}>
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9 6.2 20.9l1.1-6.47L2.6 9.85l6.5-.95z" strokeLinejoin="round" />
    </svg>
  );
}

// ── pill action button (reading pane) ──────────────────────────────────────
function PaneAct({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3 py-1.5 font-mono text-[11px] tracking-[0.02em] transition-colors"
      style={
        on
          ? { color: "var(--seal)", background: "var(--seal-wash)", borderColor: "var(--seal-line)" }
          : { color: "var(--ink-soft)", borderColor: "var(--line)" }
      }
    >
      {children}
    </button>
  );
}

// ── one list row (desktop + mobile) ────────────────────────────────────────
function ItemRow({
  vm,
  active,
  unread,
  starred,
  onOpen,
  mobile = false,
}: {
  vm: TriageVM;
  active: boolean;
  unread: boolean;
  starred: boolean;
  onOpen: () => void;
  mobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex w-full flex-col gap-1.5 px-5 py-3.5 text-left transition-colors"
      style={{
        borderBottom: "1px solid var(--line)",
        background: active ? "var(--wash)" : "transparent",
      }}
    >
      {active && (
        <span className="absolute left-0 top-0 h-full" style={{ width: 2.5, background: "var(--seal)" }} />
      )}
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 rounded-full"
          style={{
            width: 7,
            height: 7,
            background: unread ? "var(--seal)" : "transparent",
            border: unread ? "none" : "1px solid var(--line-strong)",
          }}
        />
        <PBAvatar initials={vm.initials} tint={vm.tint} size={18} />
        <span className="truncate font-sans text-[12.5px] font-semibold" style={{ color: "var(--ink-soft)" }}>
          {vm.cn}
        </span>
        <PBPlatform name={vm.platform} seal={vm.platformSeal} />
        <span className="ml-auto shrink-0 font-mono text-[10.5px]" style={{ color: "var(--faint)" }}>
          {dayLabel(vm.item.publishedAt)}
        </span>
        {starred && <Star filled size={12} />}
      </div>
      <div
        className="font-serif leading-snug"
        style={{ fontSize: mobile ? 16 : 15, fontWeight: unread ? 600 : 500, color: "var(--ink)" }}
      >
        {vm.titleCn}
      </div>
      {vm.summaryCn && (
        <div
          className="overflow-hidden text-[12px] leading-relaxed"
          style={{
            color: "var(--muted)",
            display: "-webkit-box",
            WebkitLineClamp: mobile ? 2 : 1,
            WebkitBoxOrient: "vertical",
          }}
        >
          {vm.summaryCn}
        </div>
      )}
    </button>
  );
}

// ── reading article body (shared) ──────────────────────────────────────────
function ReaderArticle({
  vm,
  showEnglish,
  onToggleEnglish,
  mobile = false,
}: {
  vm: TriageVM;
  showEnglish: boolean;
  onToggleEnglish: () => void;
  mobile?: boolean;
}) {
  const showEn = showEnglish || !vm.bodyCn; // link-style items default to original
  return (
    <article className="mx-auto w-full" style={{ maxWidth: mobile ? "none" : 620 }}>
      {/* source header */}
      <div className="flex items-center gap-3">
        <PBAvatar initials={vm.initials} tint={vm.tint} size={mobile ? 40 : 42} />
        <div className="min-w-0">
          <div className="font-sans text-[16px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>
            {vm.cn}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px]" style={{ color: "var(--faint)" }}>
            {vm.en}
          </div>
        </div>
      </div>

      <div className="mt-3 font-mono text-[11px] tracking-[0.02em]" style={{ color: "var(--faint)" }}>
        {vm.platform} · {fullDateLabel(vm.item.publishedAt)} · 约 {vm.readMins} 分钟
      </div>

      {/* 摘要 */}
      {vm.summaryCn && (
        <div className="mt-5 rounded-[10px] px-4 py-3.5" style={{ background: "var(--wash)" }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--seal)" }}>
            摘要
          </div>
          <p className="mt-1.5 text-[13.5px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
            {vm.summaryCn}
          </p>
        </div>
      )}

      {/* title */}
      <h1
        className="font-serif mt-6 font-semibold"
        style={{ fontSize: mobile ? 23 : 27, lineHeight: mobile ? 1.36 : 1.34, color: "var(--ink)" }}
      >
        {vm.titleCn}
      </h1>

      {/* tickers / sectors — quiet investor signal */}
      {(vm.tickers.length > 0 || vm.item.sectors.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {vm.tickers.map((t) => (
            <span
              key={t}
              className="rounded px-1.5 py-0.5 font-mono text-[10.5px] font-medium"
              style={{ color: "var(--seal)", border: "1px solid var(--seal-line)" }}
            >
              ${t}
            </span>
          ))}
          {vm.tickers.length === 0 &&
            vm.item.sectors.map((s) => (
              <span
                key={s}
                className="rounded px-1.5 py-0.5 text-[10.5px]"
                style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
              >
                {SECTOR_LABEL[s] ?? s}
              </span>
            ))}
        </div>
      )}

      {/* body — faithful Chinese translation, when available */}
      {vm.bodyCn ? (
        <div
          className="reading-serif mt-6 whitespace-pre-wrap"
          style={{ fontSize: 16.5, lineHeight: 1.85, color: "var(--ink-soft)" }}
        >
          {vm.bodyCn}
        </div>
      ) : (
        <p className="mt-6 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
          本条为链接型条目（{vm.platform}）——下面是英文原文要点，完整内容请前往来源阅读。
        </p>
      )}

      {/* mobile inline toggle */}
      {mobile && vm.bodyCn && (
        <button
          type="button"
          onClick={onToggleEnglish}
          className="mt-6 rounded-lg border px-3 py-1.5 font-mono text-[11px]"
          style={
            showEnglish
              ? { color: "var(--seal)", background: "var(--seal-wash)", borderColor: "var(--seal-line)" }
              : { color: "var(--ink-soft)", borderColor: "var(--line)" }
          }
        >
          对照原文 EN
        </button>
      )}

      {/* English original */}
      {showEn && vm.bodyEn && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--line)" }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>
            Original · 原文（{vm.platform}）
          </div>
          <div
            className="reading-serif mt-3 whitespace-pre-wrap italic"
            style={{ fontSize: 15, lineHeight: 1.75, color: "var(--muted)" }}
          >
            {vm.bodyEn}
          </div>
        </div>
      )}
    </article>
  );
}

export default function Triage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [folder, setFolder] = useState<Folder>("today");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "read">("list");
  const [showEnglish, setShowEnglish] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => {
    fetch("/feed/latest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((f: Feed) => {
        setFeed(f);
        // one-time: drop the curated 论文 reading list into 待读清单 ("to read")
        try {
          if (!localStorage.getItem(PAPER_SEED_KEY)) {
            const saved = loadSet(SAVE_KEY);
            for (const it of f.items) if (it.channel === "paper") saved.add(it.id);
            saveSet(SAVE_KEY, saved);
            setSavedIds(saved);
            localStorage.setItem(PAPER_SEED_KEY, "1");
          }
        } catch {}
      })
      .catch((e) => setError(String(e)));

    setReadIds(loadSet(READ_KEY));
    setStarredIds(loadSet(STAR_KEY));
    setSavedIds((prev) => {
      const s = loadSet(SAVE_KEY);
      return s.size ? s : prev;
    });
    try {
      setLastSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    } catch {}
  }, []);

  useEffect(() => {
    if (feed) {
      try {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {}
    }
  }, [feed]);

  const vms = useMemo<TriageVM[]>(() => (feed?.items ?? []).map(toVM), [feed]);

  const markRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveSet(READ_KEY, next);
      return next;
    });
  };
  const toggleStar = (id: string) =>
    setStarredIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveSet(STAR_KEY, next);
      return next;
    });
  const toggleSave = (id: string) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveSet(SAVE_KEY, next);
      return next;
    });

  const openItem = (id: string) => {
    setSelectedId(id);
    setShowEnglish(false);
    setMobileView("read");
    markRead(id);
  };

  // folder filter (read-state lanes)
  const folderItems = useMemo(() => {
    switch (folder) {
      case "unread":
        return vms.filter((v) => !readIds.has(v.id));
      case "starred":
        return vms.filter((v) => starredIds.has(v.id));
      case "reading":
        return vms.filter((v) => savedIds.has(v.id));
      default:
        return vms;
    }
  }, [vms, folder, readIds, starredIds, savedIds]);

  // channel (分类) filter within the folder
  const visible = useMemo(
    () => (channel ? folderItems.filter((v) => v.channel === channel) : folderItems),
    [folderItems, channel]
  );

  const folderCounts = useMemo(
    () => ({
      today: vms.length,
      unread: vms.filter((v) => !readIds.has(v.id)).length,
      starred: vms.filter((v) => starredIds.has(v.id)).length,
      reading: vms.filter((v) => savedIds.has(v.id)).length,
    }),
    [vms, readIds, starredIds, savedIds]
  );

  const channelCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of folderItems) c[v.channel] = (c[v.channel] || 0) + 1;
    return c;
  }, [folderItems]);

  const newCount = useMemo(() => visible.filter((v) => !readIds.has(v.id)).length, [visible, readIds]);
  const sourceCount = useMemo(() => new Set(visible.map((v) => v.cn)).size, [visible]);

  const selected = useMemo(() => vms.find((v) => v.id === selectedId) ?? null, [vms, selectedId]);
  const activeFolder = FOLDERS.find((f) => f.key === folder)!;

  if (error)
    return (
      <div className="grid min-h-[100dvh] place-items-center p-8 text-center">
        <p className="text-sm" style={{ color: "var(--seal)" }}>
          读取信源失败：{error}
          <br />
          先跑 <code className="font-mono">npm run build:feed</code>
        </p>
      </div>
    );
  if (!feed)
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <p className="font-mono text-sm" style={{ color: "var(--muted)" }}>
          加载中…
        </p>
      </div>
    );

  const feedWeekday = new Date(feed.date + "T12:00:00").toLocaleDateString("zh-CN", { weekday: "long" });
  const feedDate = new Date(feed.date + "T12:00:00").toLocaleDateString("zh-CN", { month: "long", day: "numeric" });

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      {/* ══ DESKTOP: rail ══ */}
      <aside
        className="hidden shrink-0 flex-col gap-[18px] lg:flex"
        style={{ width: 212, borderRight: "1px solid var(--line)", padding: "22px 14px" }}
      >
        <PBBrand size={28} />

        <nav className="flex flex-col gap-0.5">
          {FOLDERS.map((f) => {
            const on = folder === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFolder(f.key);
                  setChannel(null);
                }}
                className="flex items-center justify-between rounded-[7px] px-2.5 py-[7px] text-left transition-colors"
                style={
                  on
                    ? { background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" }
                    : undefined
                }
              >
                <span className="text-[13px]" style={{ color: "var(--ink)", fontWeight: on ? 600 : 400 }}>
                  {f.cn}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: f.key === "unread" ? "var(--seal)" : "var(--faint)" }}
                >
                  {folderCounts[f.key]}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-1 flex flex-col gap-0.5">
          <div className="px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--faint)" }}>
            分类 Channels
          </div>
          <button
            type="button"
            onClick={() => setChannel(null)}
            className="flex items-center justify-between rounded-[7px] px-2.5 py-[6px] text-left"
            style={channel === null ? { background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" } : undefined}
          >
            <span className="text-[12.5px]" style={{ color: "var(--ink-soft)", fontWeight: channel === null ? 600 : 400 }}>
              全部
            </span>
            <span className="font-mono text-[10.5px]" style={{ color: "var(--faint)" }}>
              {folderItems.length}
            </span>
          </button>
          {CHANNEL_ORDER.map((ch) => {
            const on = channel === ch;
            const n = channelCounts[ch] || 0;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className="flex items-center justify-between rounded-[7px] px-2.5 py-[6px] text-left transition-colors"
                style={on ? { background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" } : undefined}
              >
                <span className="flex items-baseline gap-1.5 truncate">
                  <span
                    className="text-[12.5px]"
                    style={{ color: CHANNEL_META[ch].seal ? "var(--seal)" : "var(--ink-soft)", fontWeight: on ? 600 : 400 }}
                  >
                    {CHANNEL_META[ch].label}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
                    {CHANNEL_EN[ch]}
                  </span>
                </span>
                <span className="font-mono text-[10.5px]" style={{ color: "var(--faint)" }}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto">
          <PBDisclaimer compact />
        </div>
      </aside>

      {/* ══ DESKTOP: list ══ */}
      <section
        className="hidden shrink-0 flex-col lg:flex"
        style={{ width: 372, borderRight: "1px solid var(--line)" }}
      >
        <header
          className="flex shrink-0 items-end justify-between px-5"
          style={{ height: 70, borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <div className="font-serif text-[18px] font-semibold" style={{ color: "var(--ink)" }}>
              {activeFolder.cn}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--faint)" }}>
              {newCount} NEW · {sourceCount} SOURCES
            </div>
          </div>
          <span className="pb-1 font-mono text-[10.5px]" style={{ color: "var(--faint)" }}>
            最新 ↓
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="p-8 text-center text-[13px]" style={{ color: "var(--faint)" }}>
              该筛选下暂无内容。
            </p>
          ) : (
            visible.map((vm) => (
              <ItemRow
                key={vm.id}
                vm={vm}
                active={vm.id === selectedId}
                unread={!readIds.has(vm.id)}
                starred={starredIds.has(vm.id)}
                onOpen={() => openItem(vm.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* ══ DESKTOP: reading pane ══ */}
      <section className="hidden min-w-0 flex-1 flex-col lg:flex">
        {selected ? (
          <>
            <div
              className="flex shrink-0 items-center gap-2 px-8"
              style={{ height: 70, borderBottom: "1px solid var(--line)" }}
            >
              <PaneAct on={starredIds.has(selected.id)} onClick={() => toggleStar(selected.id)}>
                {starredIds.has(selected.id) ? "★ 已加星" : "加星"}
              </PaneAct>
              <PaneAct on={savedIds.has(selected.id)} onClick={() => toggleSave(selected.id)}>
                {savedIds.has(selected.id) ? "✓ 待读" : "加入待读"}
              </PaneAct>
              <PaneAct on={showEnglish} onClick={() => setShowEnglish((v) => !v)}>
                对照原文 EN
              </PaneAct>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto font-mono text-[11px] hover:underline"
                style={{ color: "var(--seal)" }}
              >
                原文 ↗ {selected.domain}
              </a>
              {selected.altUrl && (
                <a
                  href={selected.altUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] hover:underline"
                  style={{ color: "var(--seal)" }}
                >
                  {selected.altPlatform ?? "镜像"} ↗
                </a>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: "30px 40px" }}>
              <ReaderArticle vm={selected} showEnglish={showEnglish} onToggleEnglish={() => setShowEnglish((v) => !v)} />
            </div>
            <div
              className="flex shrink-0 items-center justify-between px-8 py-3"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <PBDisclaimer />
              <span className="font-mono text-[10.5px]" style={{ color: "var(--faint)" }}>
                二手观点 · 仅供理解，自负风险
              </span>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-10 text-center">
            <div>
              <p className="font-serif text-[18px]" style={{ color: "var(--ink-soft)" }}>
                选择左侧条目开始阅读
              </p>
              <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--faint)" }}>
                {activeFolder.cn} · {visible.length} 条
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ══ MOBILE ══ */}
      <div className="flex min-w-0 flex-1 flex-col lg:hidden">
        {mobileView === "list" ? (
          <>
            <header className="shrink-0 px-5 pt-[54px]">
              <div className="flex items-center justify-between">
                <PBBrand size={22} />
                <span
                  className="grid h-[34px] w-[34px] place-items-center rounded-full"
                  style={{ border: "1px solid var(--line)", color: "var(--ink-soft)" }}
                  aria-hidden
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                </span>
              </div>
              <h1 className="font-serif mt-4 text-[30px] font-semibold" style={{ color: "var(--ink)" }}>
                {activeFolder.cn}
              </h1>
              <div className="mt-1 font-mono text-[11px]" style={{ color: "var(--faint)" }}>
                {feedDate} · {feedWeekday} · {newCount} 条新内容 · {sourceCount} 来源
              </div>
            </header>

            {/* segmented filter (folders) */}
            <div className="no-scrollbar mt-4 flex shrink-0 gap-2 overflow-x-auto px-5 pb-3">
              {FOLDERS.map((f) => {
                const on = folder === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFolder(f.key);
                      setChannel(null);
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors"
                    style={
                      on
                        ? { background: "var(--ink)", color: "var(--paper)", fontWeight: 600 }
                        : { border: "1px solid var(--line)", color: "var(--ink-soft)" }
                    }
                  >
                    {f.cn}
                    <span className="font-mono text-[10px]" style={{ opacity: 0.7 }}>
                      {folderCounts[f.key]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto" style={{ borderTop: "1px solid var(--line)" }}>
              {visible.length === 0 ? (
                <p className="p-8 text-center text-[13px]" style={{ color: "var(--faint)" }}>
                  该筛选下暂无内容。
                </p>
              ) : (
                visible.map((vm) => (
                  <ItemRow
                    key={vm.id}
                    vm={vm}
                    active={false}
                    unread={!readIds.has(vm.id)}
                    starred={starredIds.has(vm.id)}
                    onOpen={() => openItem(vm.id)}
                    mobile
                  />
                ))
              )}
            </div>

            <div
              className="shrink-0 px-5 pb-[30px] pt-3 text-center"
              style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}
            >
              <PBDisclaimer compact />
            </div>
          </>
        ) : (
          selected && (
            <>
              <div
                className="flex shrink-0 items-center px-4 pt-[54px] pb-3"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="text-[14px] font-medium"
                  style={{ color: "var(--ink-soft)" }}
                >
                  ‹ {activeFolder.cn}
                </button>
                <span className="ml-auto">
                  <PBPlatform name={selected.platform} seal={selected.platformSeal} />
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: "22px 22px 28px" }}>
                <ReaderArticle vm={selected} showEnglish={showEnglish} onToggleEnglish={() => setShowEnglish((v) => !v)} mobile />
              </div>
              <div
                className="flex shrink-0 items-center gap-2 px-4 pb-[28px] pt-3"
                style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}
              >
                <button
                  type="button"
                  onClick={() => toggleStar(selected.id)}
                  className="flex-1 rounded-lg border py-2 text-[13px]"
                  style={
                    starredIds.has(selected.id)
                      ? { color: "var(--seal)", background: "var(--seal-wash)", borderColor: "var(--seal-line)" }
                      : { color: "var(--ink-soft)", borderColor: "var(--line)" }
                  }
                >
                  {starredIds.has(selected.id) ? "★ 已加星" : "加星"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSave(selected.id)}
                  className="flex-1 rounded-lg border py-2 text-[13px]"
                  style={
                    savedIds.has(selected.id)
                      ? { color: "var(--seal)", background: "var(--seal-wash)", borderColor: "var(--seal-line)" }
                      : { color: "var(--ink-soft)", borderColor: "var(--line)" }
                  }
                >
                  {savedIds.has(selected.id) ? "✓ 待读" : "待读"}
                </button>
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg py-2 text-center text-[13px] font-medium"
                  style={{ background: "var(--ink)", color: "var(--paper)" }}
                >
                  原文 ↗
                </a>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
