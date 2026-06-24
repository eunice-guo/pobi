"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Channel, Feed } from "@/lib/types";
import sourcesCfg from "@/data/sources.json";
import earningsCfg from "@/data/earnings.json";
import authorsCfg from "@/data/authors.json";
import { PBBrand, PBAvatar, PBPlatform, PBDisclaimer } from "@/components/pb";
import { pobiBurst, pobiCelebrate } from "@/lib/confetti";
import { CHANNEL_META, CHANNEL_ORDER, DISABLED_SOURCES_KEY, RENAMES_KEY, initialsOf, tintOf } from "@/lib/triage";
import { computeStats, loadReadStat, loadClickLog } from "@/lib/stats";
import { loadFinished, takeawayRateBySource } from "@/lib/finished";

const REMOVED_KEY = "pobi.sourceRemovals";
const ADDS_KEY = "pobi.sourceAdds";

type Entry = { key: string; channel: Channel; name: string; sub: string; buildEnabled: boolean; website?: string; github?: string };
type AddDraft = { channel: Channel; name: string; en: string; handle: string; sectors: string };

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function baseEntries(): Entry[] {
  const out: Entry[] = [];
  for (const s of sourcesCfg.sources as Array<{ handle: string; displayName: string; channel: string; sectors?: string[]; enabled: boolean }>) {
    const ch = s.channel as Channel;
    const tags = (s.sectors || []).join(" / ");
    const sub = ch === "x" ? `@${s.handle}` : ch === "podcast" ? `YouTube · ${tags || "播客"}` : domainOf(s.handle);
    out.push({ key: s.handle, channel: ch, name: s.displayName, sub, buildEnabled: s.enabled, website: ch === "podcast" || ch === "substack" || ch === "research" || ch === "worldmodel" ? s.handle.replace(/\/feed\/?$|\/rss\/?$/, "") : undefined });
  }
  for (const c of earningsCfg.companies as Array<{ ticker: string; name: string; ir?: string }>) {
    out.push({ key: c.ticker, channel: "transcript", name: c.name, sub: `$${c.ticker} · 财报电话会`, buildEnabled: true, website: c.ir });
  }
  for (const a of authorsCfg.authors as Array<{ name: string; displayName?: string; website?: string; github?: string; enabled?: boolean }>) {
    out.push({ key: a.name, channel: "paper", name: a.displayName || a.name, sub: `arXiv · ${a.name}`, buildEnabled: a.enabled !== false, website: a.website || undefined, github: a.github || undefined });
  }
  return out;
}

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]") as string[]);
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
    return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "9px 11px",
  fontFamily: "var(--font-sans)",
  fontSize: 13.5,
  color: "var(--ink)",
  background: "var(--surface)",
  outline: "none",
  width: "100%",
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>{label}</span>
      {children}
    </label>
  );
}

export default function SourcesPage() {
  const entries = useMemo(baseEntries, []);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [adds, setAdds] = useState<AddDraft[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean } & AddDraft>({ open: false, channel: "substack", name: "", en: "", handle: "", sectors: "" });
  const [copied, setCopied] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // bumps on focus to re-read localStorage
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/feed/latest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((f) => f && setFeed(f))
      .catch(() => {});
    setDisabled(loadSet(DISABLED_SOURCES_KEY));
    setRemoved(loadSet(REMOVED_KEY));
    setRenames(loadMap(RENAMES_KEY));
    try {
      const r = localStorage.getItem(ADDS_KEY);
      if (r) setAdds(JSON.parse(r) as AddDraft[]);
    } catch {}
    // refresh per-source completion when returning to the page after reading
    const bump = () => setRefreshTick((t) => t + 1);
    const onVis = () => {
      if (!document.hidden) bump();
    };
    window.addEventListener("focus", bump);
    window.addEventListener("pageshow", bump);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("pageshow", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // per-source this-week read/received for the completion bars (recomputed on focus)
  const weeklyFor = useMemo(() => {
    if (!feed) return () => ({ read: 0, recv: 0 });
    return computeStats(feed.items, loadReadStat(), loadClickLog(), loadSet("pobi.readIds"), loadSet("pobi.openedIds"), loadSet("pobi.starredIds"), loadSet("pobi.savedIds")).weeklyFor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, refreshTick]);

  // 读完但从不写收获的来源 → 取消订阅候选。keyed by the source name stored on
  // each finished note (= the source displayName at read time).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const takeawayBy = useMemo(() => takeawayRateBySource(loadFinished()), [refreshTick]);

  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };
  const persistDisabled = (s: Set<string>) => {
    setDisabled(new Set(s));
    saveSet(DISABLED_SOURCES_KEY, s);
  };
  const persistRemoved = (s: Set<string>) => {
    setRemoved(new Set(s));
    saveSet(REMOVED_KEY, s);
  };
  const persistRenames = (m: Record<string, string>) => {
    setRenames({ ...m });
    try {
      localStorage.setItem(RENAMES_KEY, JSON.stringify(m));
    } catch {}
  };
  const persistAdds = (a: AddDraft[]) => {
    setAdds(a);
    try {
      localStorage.setItem(ADDS_KEY, JSON.stringify(a));
    } catch {}
  };
  const nameOf = (e: Entry) => renames[e.key] ?? e.name;

  function togglePause(key: string) {
    const n = new Set(disabled);
    n.has(key) ? n.delete(key) : n.add(key);
    persistDisabled(n);
  }
  function unsubscribe(e: Entry) {
    persistRemoved(new Set(removed).add(e.key));
    persistDisabled(new Set(disabled).add(e.key));
    pobiBurst(rootRef.current, { originX: 0.5, originY: 0.16, count: 26, power: 9 });
    flash(`已取消订阅「${nameOf(e)}」`);
  }
  function saveRename(key: string) {
    const v = draft.trim();
    if (v) persistRenames({ ...renames, [key]: v });
    setEditing(null);
  }
  function addSource(ev: React.FormEvent) {
    ev.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    persistAdds([{ channel: form.channel, name, en: form.en.trim(), handle: form.handle.trim(), sectors: form.sectors.trim() }, ...adds]);
    setForm({ open: false, channel: form.channel, name: "", en: "", handle: "", sectors: "" });
    pobiCelebrate(rootRef.current, { count: 90 });
    flash(`已订阅「${name}」`);
  }

  const liveEntries = entries.filter((e) => !removed.has(e.key));
  const paused = liveEntries.filter((e) => e.buildEnabled && disabled.has(e.key));
  const removedEntries = entries.filter((e) => removed.has(e.key));
  const renamedEntries = entries.filter((e) => renames[e.key] && !removed.has(e.key));
  const changeCount = paused.length + removedEntries.length + renamedEntries.length + adds.length;
  const trackingCount = liveEntries.filter((e) => !disabled.has(e.key)).length;

  const instruction = useMemo(() => {
    const L: string[] = ["请更新 pobi 来源配置（src/data/*.json），然后重建并部署："];
    if (adds.length) {
      L.push("", "【新增订阅】");
      for (const a of adds) L.push(`- [${CHANNEL_META[a.channel]?.label ?? a.channel}] 译名：${a.name}${a.en ? ` | 原名：${a.en}` : ""}${a.handle ? ` | handle/URL：${a.handle}` : ""}${a.sectors ? ` | sectors：${a.sectors}` : ""}`);
    }
    if (removedEntries.length) {
      L.push("", "【取消订阅】");
      for (const e of removedEntries) L.push(`- [${CHANNEL_META[e.channel]?.label ?? e.channel}] ${e.name} — ${e.sub}`);
    }
    if (paused.length) {
      L.push("", "【暂停（停止抓取，可恢复）】");
      for (const e of paused) L.push(`- [${CHANNEL_META[e.channel]?.label ?? e.channel}] ${nameOf(e)} — ${e.sub}`);
    }
    if (renamedEntries.length) {
      L.push("", "【重命名译名】");
      for (const e of renamedEntries) L.push(`- ${e.name} → ${renames[e.key]}`);
    }
    if (changeCount === 0) L.push("", "（暂无更改）");
    return L.join("\n");
  }, [adds, removedEntries, paused, renamedEntries, renames, changeCount]);

  const copyInstruction = async () => {
    try {
      await navigator.clipboard.writeText(instruction);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const grouped = CHANNEL_ORDER.map((ch) => ({ channel: ch, items: liveEntries.filter((e) => e.channel === ch) })).filter((g) => g.items.length);

  const SourceCard = ({ src }: { src: Entry }) => {
    const wk = weeklyFor(src.key);
    const rate = wk.recv ? Math.round((wk.read / wk.recv) * 100) : 0;
    const low = wk.recv >= 3 && wk.read / wk.recv < 0.34;
    const paused = disabled.has(src.key);
    // 读完 ≥3 篇却从不写收获 → 低价值，建议取消订阅
    const tk = takeawayBy[src.name] || { finished: 0, noted: 0 };
    const suggestDrop = !paused && tk.finished >= 3 && tk.noted === 0;
    return (
      <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", padding: 16, display: "flex", flexDirection: "column", gap: 12, opacity: paused ? 0.6 : 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <PBAvatar initials={initialsOf(nameOf(src))} tint={tintOf(src.name)} size={42} />
          <div style={{ minWidth: 0, flex: 1 }}>
            {editing === src.key ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => saveRename(src.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") saveRename(src.key);
                }}
                style={{ ...inputStyle, padding: "3px 7px", fontSize: 15, fontWeight: 600 }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(src)}</span>
                <button onClick={() => { setEditing(src.key); setDraft(nameOf(src)); }} title="重命名" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--faint)", padding: 1, display: "inline-flex", flex: "0 0 auto" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10z" />
                  </svg>
                </button>
              </div>
            )}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{src.sub}</div>
            {(src.website || src.github) && (
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {src.website && (
                  <a href={src.website} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--seal)", textDecoration: "none" }}>网站 ↗</a>
                )}
                {src.github && (
                  <a href={src.github} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--seal)", textDecoration: "none" }}>GitHub ↗</a>
                )}
              </div>
            )}
          </div>
          <PBPlatform name={CHANNEL_META[src.channel]?.label ?? src.channel} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--wash)", overflow: "hidden" }}>
            <div style={{ width: `${rate}%`, height: "100%", borderRadius: 999, background: low ? "var(--down)" : "var(--seal)", minWidth: wk.read ? 4 : 0 }} />
          </div>
          <span style={{ width: 34, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11.5, color: low ? "var(--down)" : "var(--muted)" }}>{rate}%</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
          <span>
            本周读完 <b style={{ color: "var(--ink)", fontWeight: 600 }}>{wk.read}</b>/{wk.recv}
          </span>
          <span style={{ flex: 1 }} />
          {paused && <span style={{ letterSpacing: "0.06em", color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "1px 6px" }}>暂停</span>}
        </div>

        {suggestDrop && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--down)", background: "color-mix(in oklch, var(--down) 8%, transparent)", border: "1px solid color-mix(in oklch, var(--down) 30%, transparent)", borderRadius: 9, padding: "7px 10px" }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "0 0 auto" }}>
              <path d="M8 1.5l6.5 11.5h-13z" />
              <path d="M8 6.5v3M8 11.5v.01" />
            </svg>
            <span>读完 {tk.finished} 篇但从不记收获 · 建议取消订阅</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <button onClick={() => togglePause(src.key)} style={{ flex: 1, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8, padding: "7px 0", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
            {paused ? "恢复" : "暂停"}
          </button>
          <button onClick={() => unsubscribe(src)} title="取消订阅" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "var(--muted)", display: "inline-flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5l.5-8.5" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div ref={rootRef} style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)", position: "relative" }}>
      {/* top bar */}
      <div style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in oklch, var(--paper) 85%, transparent)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: "none", margin: "0", padding: "16px 28px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>
            <svg width="9" height="14" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7.5 1.5L1.5 7.5l6 6" />
            </svg>
            每日跟踪
          </Link>
          <span style={{ width: 1, height: 18, background: "var(--line)" }} />
          <PBBrand size={24} />
          <span style={{ flex: 1 }} />
          {changeCount > 0 && (
            <button type="button" onClick={copyInstruction} style={{ border: "none", cursor: "pointer", background: "var(--seal)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600 }} title="把更改复制成一段指令发给 Claude 应用并重建">
              {copied ? "已复制 ✓" : `复制更改 (${changeCount})`}
            </button>
          )}
          <Link href="/finished" style={{ textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>知识图谱</Link>
          <Link href="/stats" style={{ textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>阅读统计</Link>
        </div>
      </div>

      <div style={{ maxWidth: "none", margin: "0", padding: "36px 28px 80px" }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 26, gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 34, margin: 0 }}>来源管理</h1>
            <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--muted)" }}>
              <span style={{ fontFamily: "var(--font-mono)" }}>{liveEntries.length} 个订阅</span> · {trackingCount} 跟踪中
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--faint)", maxWidth: 560, lineHeight: 1.6 }}>
              暂停 / 取消订阅即时生效（本机）；点「复制更改」把指令发给我即可永久应用并重建。
            </p>
          </div>
          {!form.open && (
            <button onClick={() => setForm((f) => ({ ...f, open: true }))} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, cursor: "pointer", border: "none", background: "var(--seal)", color: "#fff", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ fontSize: 17 }}>+</span> 添加来源
            </button>
          )}
        </header>

        {form.open && (
          <form onSubmit={addSource} style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", padding: 18, marginBottom: 30, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Field label="译名 (中文)">
                <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：战略链" style={inputStyle} />
              </Field>
              <Field label="原名 / 频道">
                <input value={form.en} onChange={(e) => setForm((f) => ({ ...f, en: e.target.value }))} placeholder="Stratechery" style={inputStyle} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Field label="作者 / 句柄 / RSS / arXiv 作者名">
                <input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} placeholder="@handle / https://…/feed / Danijar Hafner" style={inputStyle} />
              </Field>
              <Field label="平台">
                <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as Channel }))} style={inputStyle}>
                  {CHANNEL_ORDER.map((ch) => (
                    <option key={ch} value={ch}>
                      {CHANNEL_META[ch].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="sectors (可选)">
                <input value={form.sectors} onChange={(e) => setForm((f) => ({ ...f, sectors: e.target.value }))} placeholder="MACRO / AI-SEMIS" style={inputStyle} />
              </Field>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)", flex: 1 }}>新内容将被忠实翻译并附摘要 · 不构成投资建议</span>
              <button type="button" onClick={() => setForm({ open: false, channel: "substack", name: "", en: "", handle: "", sectors: "" })} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 500, padding: "8px 10px" }}>
                取消
              </button>
              <button type="submit" style={{ border: "none", cursor: "pointer", background: "var(--seal)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600 }}>
                订阅
              </button>
            </div>
          </form>
        )}

        {adds.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--seal)", marginBottom: 8 }}>待新增（发给 Claude 后生效）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {adds.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 12, background: "var(--wash)", padding: "10px 14px" }}>
                  <PBAvatar initials={initialsOf(a.name)} tint={tintOf(a.name)} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{CHANNEL_META[a.channel]?.label} · {a.handle || a.en || "—"}</div>
                  </div>
                  <button type="button" onClick={() => persistAdds(adds.filter((_, idx) => idx !== i))} title="删除" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 7, padding: "6px 9px", cursor: "pointer", color: "var(--muted)" }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {grouped.map((g) => (
          <div key={g.channel} style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: CHANNEL_META[g.channel].seal ? "var(--seal)" : "var(--ink)" }}>{CHANNEL_META[g.channel].label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)" }}>{g.items.length}</span>
              <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {g.items.map((src) => (
                <SourceCard key={src.key} src={src} />
              ))}
            </div>
          </div>
        ))}

        {removedEntries.length > 0 && (
          <button
            type="button"
            onClick={() => {
              persistRemoved(new Set());
              const d = new Set(disabled);
              for (const e of removedEntries) d.delete(e.key);
              persistDisabled(d);
              flash("已恢复全部取消订阅");
            }}
            style={{ marginTop: 4, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-soft)" }}
          >
            撤销取消订阅（{removedEntries.length}）
          </button>
        )}

        <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
          <PBDisclaimer />
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "var(--paper)", borderRadius: 999, padding: "10px 20px", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, zIndex: 60, boxShadow: "0 8px 28px color-mix(in oklch, var(--ink) 22%, transparent)" }}>{toast}</div>
      )}
    </div>
  );
}
