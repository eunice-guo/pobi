"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Channel, Feed } from "@/lib/types";
import { dayLabel, fullDateLabel } from "@/lib/date";
import { PBBrand, PBAvatar, PBPlatform, PBDisclaimer } from "./pb";
import { pobiBurst, pobiCelebrate } from "@/lib/confetti";
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  CHANNEL_EN,
  SECTOR_LABEL,
  FOLDERS,
  type Folder,
  toVM,
  type TriageVM,
  sourceKeyOf,
  DISABLED_SOURCES_KEY,
  RENAMES_KEY,
} from "@/lib/triage";

const READ_KEY = "pobi.readIds";
const STAR_KEY = "pobi.starredIds";
const SAVE_KEY = "pobi.savedIds";
const DISMISS_KEY = "pobi.dismissedIds";
const SEEN_KEY = "pobi.lastSeenAt";
const PAPER_SEED_KEY = "pobi.papersSeeded";

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
function loadMap(key: string): Record<string, string> {
  try {
    const r = localStorage.getItem(key);
    return r ? (JSON.parse(r) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// ── icons ──────────────────────────────────────────────────────────────────
const StarIcon = ({ filled, size = 13 }: { filled?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <path d="M7 1l1.8 3.7 4 .6-2.9 2.8.7 4L7 10.9 3.4 12.1l.7-4L1.2 5.3l4-.6z" strokeLinejoin="round" />
  </svg>
);
const SaveIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <path d="M3.5 2h7v10l-3.5-2.3L3.5 12z" strokeLinejoin="round" />
  </svg>
);
const StarSolid = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="var(--seal)" style={{ flex: "0 0 auto" }} aria-hidden>
    <path d="M7 1l1.8 3.7 4 .6-2.9 2.8.7 4L7 10.9 3.4 12.1l.7-4L1.2 5.3l4-.6z" />
  </svg>
);

// ── reading-pane pill (desktop) ──────────────────────────────────────────────
function PaneAct({ on, onClick, title, children }: { on?: boolean; onClick?: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 8,
        cursor: "pointer",
        border: "1px solid " + (on ? "color-mix(in oklch, var(--seal) 40%, transparent)" : "var(--line)"),
        background: on ? "color-mix(in oklch, var(--seal) 8%, transparent)" : "var(--surface)",
        color: on ? "var(--seal)" : "var(--ink-soft)",
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

// ── list row ─────────────────────────────────────────────────────────────────
function ItemRow({
  vm,
  cn,
  active,
  isRead,
  isStarred,
  isTriage,
  hov,
  mobile = false,
  onOpen,
  onHover,
  onConfirm,
}: {
  vm: TriageVM;
  cn: string;
  active: boolean;
  isRead: boolean;
  isStarred: boolean;
  isTriage: boolean;
  hov: boolean;
  mobile?: boolean;
  onOpen: () => void;
  onHover?: (v: boolean) => void;
  onConfirm?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      style={{
        display: "flex",
        gap: mobile ? 12 : 11,
        padding: mobile ? "15px 20px" : "13px 20px",
        cursor: "pointer",
        position: "relative",
        borderBottom: "1px solid var(--line)",
        background: active ? "var(--wash)" : hov ? "color-mix(in oklch, var(--wash) 45%, transparent)" : "transparent",
      }}
    >
      {active && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2.5, background: "var(--seal)" }} />}
      <div style={{ paddingTop: mobile ? 5 : 4, flex: "0 0 auto" }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            display: "block",
            background: isRead ? "transparent" : "var(--seal)",
            boxShadow: isRead ? "inset 0 0 0 1px var(--line-strong)" : "none",
          }}
        />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: mobile ? 6 : 5 }}>
          <PBAvatar initials={vm.initials} tint={vm.tint} size={18} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {cn}
          </span>
          <PBPlatform name={vm.platform} />
          <span style={{ flex: 1 }} />
          {!mobile && hov && isTriage && onConfirm ? (
            <button
              type="button"
              onClick={onConfirm}
              title="确认读完 (E)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                border: "1px solid color-mix(in oklch, var(--seal) 35%, transparent)",
                background: "color-mix(in oklch, var(--seal) 8%, transparent)",
                color: "var(--seal)",
                borderRadius: 999,
                padding: "2px 8px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 10.5,
                fontWeight: 600,
                flex: "0 0 auto",
              }}
            >
              ✓ 读完
            </button>
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)", flex: "0 0 auto" }}>{dayLabel(vm.item.publishedAt)}</span>
          )}
        </div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: mobile ? 16 : 15,
            lineHeight: mobile ? 1.42 : 1.4,
            color: isRead && !mobile ? "var(--muted)" : "var(--ink)",
            fontWeight: isRead ? 500 : 600,
            marginBottom: mobile ? 5 : 4,
          }}
        >
          {vm.titleCn}
        </div>
        <div
          style={{
            fontSize: mobile ? 13 : 12.5,
            lineHeight: mobile ? 1.55 : 1.5,
            color: "var(--muted)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {vm.summaryCn}
        </div>
      </div>
      {isStarred && (
        <span style={{ flex: "0 0 auto", marginTop: mobile ? 4 : 3 }}>
          <StarSolid />
        </span>
      )}
    </div>
  );
}

// ── reading article body (shared desktop + mobile) ───────────────────────────
function ReaderArticle({
  vm,
  cn,
  showEn,
  mobile = false,
  onToggleEn,
}: {
  vm: TriageVM;
  cn: string;
  showEn: boolean;
  mobile?: boolean;
  onToggleEn?: () => void;
}) {
  const effShowEn = showEn || !vm.bodyCn;
  const catLabel = vm.item.sectors[0] ? SECTOR_LABEL[vm.item.sectors[0]] ?? vm.item.sectors[0] : null;
  const meta = [vm.platform, catLabel, fullDateLabel(vm.item.publishedAt), `约 ${vm.readMins} 分钟`].filter(Boolean).join(" · ");
  return (
    <div style={{ maxWidth: mobile ? "none" : 620 }}>
      <header style={{ display: "flex", alignItems: "center", gap: mobile ? 11 : 12, marginBottom: mobile ? 18 : 22 }}>
        <PBAvatar initials={vm.initials} tint={vm.tint} size={mobile ? 40 : 42} />
        <div style={{ minWidth: 0 }}>
          {mobile ? (
            <>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{cn}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{vm.en}</div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{cn}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--faint)" }}>{vm.en}</span>
            </div>
          )}
          {!mobile && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{meta}</div>}
        </div>
      </header>

      {vm.summaryCn && (
        <div style={{ display: "flex", gap: mobile ? 10 : 12, padding: mobile ? "13px 15px" : "14px 16px", borderRadius: mobile ? 11 : 10, background: "var(--wash)", marginBottom: mobile ? 20 : 24 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: mobile ? 9.5 : 10, letterSpacing: "0.12em", color: "var(--seal)", textTransform: "uppercase", flex: "0 0 auto", paddingTop: mobile ? 3 : 2 }}>
            摘要
          </span>
          <span style={{ fontSize: mobile ? 13 : 13.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>{vm.summaryCn}</span>
        </div>
      )}

      <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: mobile ? 23 : 27, lineHeight: mobile ? 1.36 : 1.34, margin: mobile ? "0 0 8px" : "0 0 18px", letterSpacing: "0.005em", color: "var(--ink)" }}>
        {vm.titleCn}
      </h1>

      {mobile && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 18, fontFamily: "var(--font-mono)" }}>{meta}</div>}

      {/* quiet investor signal — tickers when present */}
      {vm.tickers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: mobile ? "0 0 16px" : "-6px 0 18px" }}>
          {vm.tickers.map((t) => (
            <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 500, color: "var(--seal)", border: "1px solid color-mix(in oklch, var(--seal) 40%, transparent)", borderRadius: 4, padding: "1px 6px" }}>
              ${t}
            </span>
          ))}
        </div>
      )}

      {vm.bodyCn ? (
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 16.5, lineHeight: 1.85, color: "var(--ink-soft)", margin: 0, whiteSpace: "pre-wrap", textWrap: "pretty" }}>
          {vm.bodyCn}
        </p>
      ) : (
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--muted)", margin: 0 }}>
          本条为链接型条目（{vm.platform}）—— 下面是英文原文要点，完整内容请前往来源阅读。
        </p>
      )}

      {/* mobile inline toggle sits between body and the EN original (matches reference order) */}
      {mobile && onToggleEn && vm.bodyCn && (
        <button
          type="button"
          onClick={onToggleEn}
          style={{
            marginTop: 20,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            borderRadius: 999,
            padding: "7px 13px",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 600,
            color: showEn ? "var(--seal)" : "var(--ink-soft)",
          }}
        >
          {showEn ? "隐藏原文" : "对照原文 EN"}
        </button>
      )}

      {effShowEn && vm.bodyEn && (
        <div style={{ marginTop: mobile ? 16 : 22, paddingTop: mobile ? 18 : 22, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: mobile ? 9.5 : 10, letterSpacing: "0.14em", color: "var(--faint)", textTransform: "uppercase", marginBottom: mobile ? 10 : 12 }}>
            {mobile ? "Original · 原文" : `Original · 原文（${vm.platform}）`}
          </div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: mobile ? 14.5 : 15, lineHeight: 1.75, color: "var(--muted)", margin: 0, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
            {vm.bodyEn}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Triage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sel, setSel] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder>("today");
  const [cat, setCat] = useState<Channel | null>(null);
  const [showEn, setShowEn] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const [mobileView, setMobileView] = useState<"list" | "read">("list");

  const [read, setRead] = useState<Set<string>>(new Set());
  const [star, setStar] = useState<Set<string>>(new Set());
  const [save, setSave] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [disabledSources, setDisabledSources] = useState<Set<string>>(new Set());
  const [renames, setRenames] = useState<Record<string, string>>({});

  const rootRef = useRef<HTMLDivElement>(null);
  const mobileRootRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // fast first paint from whatever is stored
    setRead(loadSet(READ_KEY));
    setStar(loadSet(STAR_KEY));
    setSave(loadSet(SAVE_KEY));
    setDismissed(loadSet(DISMISS_KEY));
    setDisabledSources(loadSet(DISABLED_SOURCES_KEY));
    setRenames(loadMap(RENAMES_KEY));
    try {
      // drop legacy keys from the pre-Option-C build (watchlist/calendar removed)
      ["pobi.watchlist", "pobi.watchlist.seeded"].forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {}

    fetch("/feed/latest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((f: Feed) => {
        setFeed(f);
        // ── localStorage hygiene ────────────────────────────────────────────
        // The read/star/save/dismissed sets store full item IDs and otherwise
        // grow unbounded as the daily feed turns over. Prune each to the IDs
        // present in the current feed — the app can only ever show feed items,
        // so dropping stale IDs is lossless and caps storage at ~feed size.
        const valid = new Set(f.items.map((i) => i.id));
        const prune = (key: string): Set<string> => {
          const cur = loadSet(key);
          const next = new Set([...cur].filter((id) => valid.has(id)));
          if (next.size !== cur.size) saveSet(key, next);
          return next;
        };
        prune(READ_KEY);
        prune(STAR_KEY);
        let saved = prune(SAVE_KEY);
        prune(DISMISS_KEY);

        // one-time: seed the 论文 reading list into 待读 (after prune so it sticks)
        try {
          if (!localStorage.getItem(PAPER_SEED_KEY)) {
            saved = new Set(saved);
            for (const it of f.items) if (it.channel === "paper") saved.add(it.id);
            saveSet(SAVE_KEY, saved);
            localStorage.setItem(PAPER_SEED_KEY, "1");
          }
        } catch {}

        setRead(loadSet(READ_KEY));
        setStar(loadSet(STAR_KEY));
        setSave(saved);
        setDismissed(loadSet(DISMISS_KEY));
      })
      .catch((e) => setError(String(e)));
  }, []);

  const allVms = useMemo<TriageVM[]>(() => (feed?.items ?? []).map(toVM), [feed]);
  const vms = useMemo(() => allVms.filter((v) => !disabledSources.has(sourceKeyOf(v.item))), [allVms, disabledSources]);
  const displayCn = useCallback((vm: TriageVM) => renames[sourceKeyOf(vm.item)] ?? vm.cn, [renames]);

  const isTriage = folder === "today" || folder === "unread";

  const visibleFor = useCallback(
    (f: Folder, c: Channel | null, dis: Set<string>) => {
      let arr = vms.filter((v) => {
        if (f === "today") return !dis.has(v.id);
        if (f === "unread") return !read.has(v.id) && !dis.has(v.id);
        if (f === "starred") return star.has(v.id);
        if (f === "reading") return save.has(v.id);
        return true;
      });
      if (c) arr = arr.filter((v) => v.channel === c);
      return arr;
    },
    [vms, read, star, save]
  );
  const visible = useMemo(() => visibleFor(folder, cat, dismissed), [visibleFor, folder, cat, dismissed]);

  // keep a valid selection within the current view (drives the desktop pane)
  useEffect(() => {
    if (!visible.length) {
      if (sel !== null) setSel(null);
      return;
    }
    if (!visible.some((v) => v.id === sel)) setSel(visible[0].id);
  }, [folder, cat, visible, sel]);

  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [sel]);

  const item = useMemo(() => (sel ? vms.find((v) => v.id === sel) ?? null : null), [vms, sel]);

  const markRead = useCallback((id: string) => {
    setRead((r) => {
      if (r.has(id)) return r;
      const n = new Set(r).add(id);
      saveSet(READ_KEY, n);
      return n;
    });
  }, []);

  const tog = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => (id: string) =>
    setter((x) => {
      const n = new Set(x);
      n.has(id) ? n.delete(id) : n.add(id);
      saveSet(key, n);
      return n;
    });
  const togStar = tog(setStar, STAR_KEY);
  const togSave = tog(setSave, SAVE_KEY);

  // Desktop: showEn is sticky across selections (matches reference open()).
  const open = useCallback(
    (id: string) => {
      setSel(id);
      markRead(id);
    },
    [markRead]
  );

  // 确认读完 (markDone=true) / 移除 (false): drop from triage view, auto-advance, 撒花.
  const dismiss = useCallback(
    (id: string, markDone: boolean, host: HTMLElement | null) => {
      const remaining = visible.filter((v) => v.id !== id);
      if (id === sel) {
        const idx = visible.findIndex((v) => v.id === id);
        const next = remaining[idx] || remaining[idx - 1] || remaining[0] || null;
        setSel(next ? next.id : null);
      }
      setDismissed((d) => {
        const n = new Set(d).add(id);
        saveSet(DISMISS_KEY, n);
        return n;
      });
      if (markDone) {
        markRead(id);
        setDoneCount((n) => n + 1);
      }
      if (isTriage && remaining.length === 0) requestAnimationFrame(() => pobiCelebrate(host));
      else pobiBurst(host, { originX: 0.78, originY: 0.12, count: 30, power: 10 });
    },
    [visible, sel, isTriage, markRead]
  );

  // keyboard triage (desktop): j/k move · e 确认读完 · s 加星 · x 移除
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const idx = visible.findIndex((v) => v.id === sel);
      if (e.key === "j") {
        e.preventDefault();
        const n = visible[Math.min(idx + 1, visible.length - 1)];
        if (n) open(n.id);
      } else if (e.key === "k") {
        e.preventDefault();
        const n = visible[Math.max(idx - 1, 0)];
        if (n) open(n.id);
      } else if (e.key === "e" && item) {
        e.preventDefault();
        dismiss(item.id, true, rootRef.current);
      } else if (e.key === "x" && item && isTriage) {
        e.preventDefault();
        dismiss(item.id, false, rootRef.current);
      } else if (e.key === "s" && item) {
        e.preventDefault();
        togStar(item.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // counts
  const todayCount = useMemo(() => visibleFor("today", null, dismissed).length, [visibleFor, dismissed]);
  const unreadCount = useMemo(() => vms.filter((v) => !read.has(v.id) && !dismissed.has(v.id)).length, [vms, read, dismissed]);
  const starCount = useMemo(() => vms.filter((v) => star.has(v.id)).length, [vms, star]);
  const saveCount = useMemo(() => vms.filter((v) => save.has(v.id)).length, [vms, save]);
  const folderCount: Record<Folder, number> = { today: todayCount, unread: unreadCount, starred: starCount, reading: saveCount };

  const sourceCount = useMemo(() => new Set(visible.map((v) => displayCn(v))).size, [visible, displayCn]);
  const activeFolder = FOLDERS.find((f) => f.key === folder)!;
  const feedWeekday = feed ? new Date(feed.date + "T12:00:00").toLocaleDateString("zh-CN", { weekday: "long" }) : "";
  const feedDate = feed ? new Date(feed.date + "T12:00:00").toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : "";

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

  return (
    <>
      {/* ══════════ DESKTOP ══════════ */}
      <div ref={rootRef} tabIndex={0} className="hidden lg:flex" style={{ width: "100%", height: "100dvh", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)", outline: "none" }}>
        {/* rail */}
        <aside style={{ width: 212, flex: "0 0 auto", borderRight: "1px solid var(--line)", padding: "22px 14px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ paddingLeft: 6 }}>
            <PBBrand size={28} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {FOLDERS.map((f) => {
              const active = folder === f.key;
              const accent = f.key === "unread";
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setFolder(f.key);
                    setCat(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 7,
                    cursor: "pointer",
                    width: "100%",
                    border: "none",
                    textAlign: "left",
                    fontFamily: "var(--font-sans)",
                    background: active ? "var(--surface)" : "transparent",
                    boxShadow: active ? "inset 0 0 0 1px var(--line)" : "none",
                    color: active ? "var(--ink)" : "var(--ink-soft)",
                    fontWeight: active ? 600 : 500,
                    fontSize: 13.5,
                  }}
                >
                  <span>{f.cn}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>{f.en}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: accent && folderCount[f.key] ? "var(--seal)" : "var(--faint)" }}>{folderCount[f.key]}</span>
                </button>
              );
            })}
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--faint)", textTransform: "uppercase", padding: "0 10px 6px" }}>分类</div>
            {CHANNEL_ORDER.map((ch) => {
              const on = cat === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setCat(on ? null : ch)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 7,
                    cursor: "pointer",
                    width: "100%",
                    border: "none",
                    textAlign: "left",
                    background: on ? "var(--wash)" : "transparent",
                    fontSize: 13,
                    fontFamily: "var(--font-sans)",
                    color: on ? "var(--ink)" : "var(--ink-soft)",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  <span>{CHANNEL_META[ch].label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)" }}>{CHANNEL_EN[ch]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <Link
            href="/sources"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500, border: "1px solid var(--line)" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <circle cx="8" cy="5" r="2.4" />
              <path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" />
            </svg>
            来源管理
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)", marginLeft: "auto" }}>Sources</span>
          </Link>
        </aside>

        {/* list */}
        <section style={{ width: 372, flex: "0 0 auto", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: "0 0 auto", height: 70, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600 }}>
                {activeFolder.cn}
                {cat && <span style={{ color: "var(--muted)", fontWeight: 500 }}> · {CHANNEL_META[cat].label}</span>}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)", letterSpacing: "0.08em" }}>
                {visible.length} 条 · {sourceCount} 来源
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--muted)" }}>最新 ↓</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {visible.length === 0 ? (
              <div style={{ padding: "48px 28px", textAlign: "center", color: "var(--muted)" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-soft)", marginBottom: 6 }}>{isTriage ? "今日已清空 🎉" : "暂无内容"}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{isTriage ? "所有更新都已处理完毕。" : "换个文件夹或分类看看。"}</div>
              </div>
            ) : (
              visible.map((vm) => (
                <ItemRow
                  key={vm.id}
                  vm={vm}
                  cn={displayCn(vm)}
                  active={vm.id === sel}
                  isRead={read.has(vm.id)}
                  isStarred={star.has(vm.id)}
                  isTriage={isTriage}
                  hov={hover === vm.id}
                  onOpen={() => open(vm.id)}
                  onHover={(v) => setHover(v ? vm.id : hover === vm.id ? null : hover)}
                  onConfirm={(e) => {
                    e.stopPropagation();
                    dismiss(vm.id, true, rootRef.current);
                  }}
                />
              ))
            )}
          </div>
        </section>

        {/* reading pane */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {item ? (
            <>
              <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "14px 32px", borderBottom: "1px solid var(--line)" }}>
                <PaneAct on={star.has(item.id)} onClick={() => togStar(item.id)} title="加星 (S)">
                  <StarIcon filled={star.has(item.id)} />
                  加星
                </PaneAct>
                <PaneAct on={save.has(item.id)} onClick={() => togSave(item.id)}>
                  <SaveIcon filled={save.has(item.id)} />
                  {save.has(item.id) ? "已加入待读" : "加入待读"}
                </PaneAct>
                <PaneAct on={showEn} onClick={() => setShowEn((v) => !v)}>
                  对照原文 EN
                </PaneAct>
                <span style={{ flex: 1 }} />
                {isTriage && (
                  <button
                    type="button"
                    onClick={() => dismiss(item.id, false, rootRef.current)}
                    title="移除 (X)"
                    style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "7px 8px" }}
                  >
                    移除
                  </button>
                )}
                {isTriage && (
                  <button
                    type="button"
                    onClick={() => dismiss(item.id, true, rootRef.current)}
                    title="确认读完 (E)"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", background: "var(--ink)", color: "var(--paper)", borderRadius: 8, padding: "8px 14px", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600 }}
                  >
                    ✓ 确认读完
                  </button>
                )}
              </div>

              <div ref={paneRef} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "30px 40px" }}>
                <ReaderArticle vm={item} cn={displayCn(item)} showEn={showEn} />
              </div>

              <div style={{ flex: "0 0 auto", padding: "12px 32px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
                <PBDisclaimer />
                <span style={{ flex: 1 }} />
                {item.altUrl && (
                  <a href={item.altUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--seal)", fontWeight: 500, textDecoration: "none" }}>
                    {item.altPlatform ?? "镜像"} ↗
                  </a>
                )}
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--seal)", fontWeight: 500, textDecoration: "none" }}>
                  原文 ↗ {item.domain}
                </a>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40 }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "color-mix(in oklch, var(--seal) 10%, transparent)", color: "var(--seal)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{isTriage ? "今日已清空" : "暂无内容"}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", color: "var(--faint)", textTransform: "uppercase", marginBottom: 18 }}>Inbox Zero</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--muted)", maxWidth: 320 }}>
                {isTriage ? `今天的 ${doneCount} 篇更新都已处理完。明早 7 点会有新的内容到达。` : "换个文件夹或分类继续浏览。"}
              </div>
              {isTriage && doneCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDismissed(new Set());
                    saveSet(DISMISS_KEY, new Set());
                    setSel(vms[0]?.id ?? null);
                  }}
                  style={{ marginTop: 24, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}
                >
                  重新查看今日
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ══════════ MOBILE ══════════ */}
      <div ref={mobileRootRef} className="flex lg:hidden" style={{ height: "100dvh", flexDirection: "column", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
        {mobileView === "list" ? (
          <>
            <div style={{ flex: "0 0 auto", padding: "54px 20px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PBBrand size={22} />
                <span style={{ flex: 1 }} />
                <Link
                  href="/sources"
                  aria-label="来源管理"
                  style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", textDecoration: "none", flex: "0 0 auto" }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <circle cx="8" cy="5" r="2.4" />
                    <path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" />
                  </svg>
                </Link>
              </div>
              <div style={{ marginTop: 18 }}>
                <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 30, margin: 0, letterSpacing: "0.01em" }}>{activeFolder.cn}</h1>
              </div>
              <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {feedDate} · {feedWeekday}
                </span>
                <span style={{ color: "var(--faint)" }}>·</span>
                <span>
                  {unreadCount} 条新内容 · {sourceCount} 来源
                </span>
              </div>
            </div>

            <div className="no-scrollbar" style={{ flex: "0 0 auto", display: "flex", gap: 7, padding: "16px 20px 14px", overflowX: "auto" }}>
              {FOLDERS.map((f) => {
                const on = folder === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFolder(f.key);
                      setCat(null);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 6,
                      padding: "7px 13px",
                      borderRadius: 999,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      border: "1px solid " + (on ? "var(--ink)" : "var(--line)"),
                      background: on ? "var(--ink)" : "transparent",
                      color: on ? "var(--paper)" : "var(--ink-soft)",
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      fontWeight: on ? 600 : 500,
                    }}
                  >
                    {f.cn}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: on ? 0.85 : 0.55 }}>{folderCount[f.key]}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {visible.length === 0 ? (
                <div style={{ padding: "48px 28px", textAlign: "center", color: "var(--muted)" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-soft)", marginBottom: 6 }}>{isTriage ? "今日已清空 🎉" : "暂无内容"}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{isTriage ? "所有更新都已处理完毕。" : "换个文件夹或分类看看。"}</div>
                </div>
              ) : (
                visible.map((vm) => (
                  <ItemRow
                    key={vm.id}
                    vm={vm}
                    cn={displayCn(vm)}
                    active={false}
                    isRead={read.has(vm.id)}
                    isStarred={star.has(vm.id)}
                    isTriage={isTriage}
                    hov={false}
                    mobile
                    onOpen={() => {
                      open(vm.id);
                      setShowEn(false);
                      setMobileView("read");
                    }}
                  />
                ))
              )}
            </div>

            <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--line)", background: "var(--surface)", padding: "12px 20px 30px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PBDisclaimer compact />
            </div>
          </>
        ) : (
          item && (
            <>
              <div style={{ flex: "0 0 auto", padding: "54px 16px 12px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
                <button type="button" onClick={() => setMobileView("list")} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", color: "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, padding: 0 }}>
                  <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M7.5 1.5L1.5 7.5l6 6" />
                  </svg>
                  收件箱
                </button>
                <span style={{ flex: 1 }} />
                {isTriage && (
                  <button type="button" onClick={() => dismiss(item.id, false, mobileRootRef.current)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, padding: "0 4px" }}>
                    移除
                  </button>
                )}
                <PBPlatform name={item.platform} />
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "22px 22px 28px" }}>
                <ReaderArticle vm={item} cn={displayCn(item)} showEn={showEn} mobile onToggleEn={() => setShowEn((v) => !v)} />
              </div>

              <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--line)", background: "var(--surface)", padding: "12px 16px 28px", display: "flex", flexDirection: "column", gap: 9 }}>
                {isTriage && (
                  <button
                    type="button"
                    onClick={() => dismiss(item.id, true, mobileRootRef.current)}
                    style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 0", borderRadius: 11, cursor: "pointer", border: "none", background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600 }}
                  >
                    ✓ 确认读完 · 撒花
                  </button>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <button
                    type="button"
                    onClick={() => togStar(item.id)}
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 11, cursor: "pointer", border: "1px solid " + (star.has(item.id) ? "color-mix(in oklch, var(--seal) 40%, transparent)" : "var(--line)"), background: star.has(item.id) ? "color-mix(in oklch, var(--seal) 8%, transparent)" : "var(--surface)", color: star.has(item.id) ? "var(--seal)" : "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600 }}
                  >
                    <StarIcon filled={star.has(item.id)} />
                    加星
                  </button>
                  <button
                    type="button"
                    onClick={() => togSave(item.id)}
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 11, cursor: "pointer", border: "1px solid " + (save.has(item.id) ? "color-mix(in oklch, var(--seal) 40%, transparent)" : "var(--line)"), background: save.has(item.id) ? "color-mix(in oklch, var(--seal) 8%, transparent)" : "var(--surface)", color: save.has(item.id) ? "var(--seal)" : "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600 }}
                  >
                    <SaveIcon filled={save.has(item.id)} />
                    {save.has(item.id) ? "已加待读" : "待读"}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 11, cursor: "pointer", border: "none", background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
                  >
                    原文 <span style={{ fontFamily: "var(--font-mono)" }}>↗</span>
                  </a>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </>
  );
}
