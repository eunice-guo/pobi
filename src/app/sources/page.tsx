"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Channel, Feed } from "@/lib/types";
import sourcesCfg from "@/data/sources.json";
import earningsCfg from "@/data/earnings.json";
import podcastsCfg from "@/data/podcasts.json";
import bookmarksCfg from "@/data/bookmarks.json";
import papersCfg from "@/data/papers.json";
import { PBBrand, PBAvatar, PBPlatform, PBDisclaimer } from "@/components/pb";
import { pobiBurst, pobiCelebrate } from "@/lib/confetti";
import {
  CHANNEL_META,
  CHANNEL_ORDER,
  DISABLED_SOURCES_KEY,
  RENAMES_KEY,
  sourceKeyOf,
  initialsOf,
  tintOf,
} from "@/lib/triage";

const REMOVED_KEY = "pobi.sourceRemovals";
const ADDS_KEY = "pobi.sourceAdds";

type Entry = { key: string; channel: Channel; name: string; sub: string; buildEnabled: boolean };
type AddDraft = { channel: Channel; name: string; en: string; handle: string; sectors: string };

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Build the managed-source list from the curated config files (matches the
// keys sourceKeyOf() assigns in the feed, so toggles hide the right items).
function baseEntries(): Entry[] {
  const out: Entry[] = [];
  for (const s of sourcesCfg.sources as Array<{ handle: string; displayName: string; channel: string; priority?: string; sectors?: string[]; enabled: boolean }>) {
    const ch = s.channel as Channel;
    const sub = ch === "x" ? `@${s.handle} · ${(s.sectors || []).join("/")}` : `${domainOf(s.handle)} · ${(s.sectors || []).join("/")}`;
    out.push({ key: s.handle, channel: ch, name: s.displayName, sub, buildEnabled: s.enabled });
  }
  for (const c of earningsCfg.companies as Array<{ ticker: string; name: string }>) {
    out.push({ key: c.ticker, channel: "transcript", name: c.name, sub: `$${c.ticker} · SEC EDGAR`, buildEnabled: true });
  }
  for (const x of podcastsCfg.interviews as Array<{ id: string; title: string; show?: string; guest?: string; enabled?: boolean }>)
    out.push({ key: `podcast:${x.id}`, channel: "podcast", name: x.title, sub: [x.show, x.guest].filter(Boolean).join(" · "), buildEnabled: x.enabled !== false });
  for (const x of papersCfg.papers as Array<{ id: string; title: string; authors?: string; venue?: string; enabled?: boolean }>)
    out.push({ key: `paper:${x.id}`, channel: "paper", name: x.title, sub: [x.venue, x.authors].filter(Boolean).join(" · "), buildEnabled: x.enabled !== false });
  for (const x of bookmarksCfg.bookmarks as Array<{ id: string; title: string; source?: string; kind?: string; enabled?: boolean }>)
    out.push({ key: `bookmark:${x.id}`, channel: "bookmark", name: x.title, sub: [x.kind, x.source].filter(Boolean).join(" · "), buildEnabled: x.enabled !== false });
  return out;
}

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
  }, []);

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

  // weekly = items from this source in the latest feed (~7-day window)
  const weeklyOf = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of feed?.items ?? []) {
      const k = sourceKeyOf(it);
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [feed]);

  const nameOf = (e: Entry) => renames[e.key] ?? e.name;

  function togglePause(key: string) {
    const n = new Set(disabled);
    n.has(key) ? n.delete(key) : n.add(key);
    persistDisabled(n);
  }
  function unsubscribe(e: Entry) {
    const n = new Set(removed).add(e.key);
    persistRemoved(n);
    const d = new Set(disabled).add(e.key); // also hide live
    persistDisabled(d);
    pobiBurst(rootRef.current, { originX: 0.5, originY: 0.18, count: 28, power: 9 });
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

  // change set for the export-to-Claude instruction
  const liveEntries = entries.filter((e) => !removed.has(e.key));
  const paused = liveEntries.filter((e) => e.buildEnabled && disabled.has(e.key));
  const removedEntries = entries.filter((e) => removed.has(e.key));
  const renamedEntries = entries.filter((e) => renames[e.key] && !removed.has(e.key));
  const changeCount = paused.length + removedEntries.length + renamedEntries.length + adds.length;

  const instruction = useMemo(() => {
    const L: string[] = ["请更新 pobi 来源配置（src/data/*.json），然后重建并部署："];
    if (adds.length) {
      L.push("", "【新增订阅】");
      for (const a of adds) L.push(`- [${CHANNEL_META[a.channel]?.label ?? a.channel}] 译名：${a.name}${a.en ? ` | 原名：${a.en}` : ""}${a.handle ? ` | handle/URL：${a.handle}` : ""}${a.sectors ? ` | sectors：${a.sectors}` : ""}`);
    }
    if (removedEntries.length) {
      L.push("", "【取消订阅 / 移除】");
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

  const totalActive = liveEntries.filter((e) => !disabled.has(e.key)).length;
  const totalPaused = liveEntries.filter((e) => disabled.has(e.key)).length;

  const grouped = CHANNEL_ORDER.map((ch) => ({ channel: ch, items: liveEntries.filter((e) => e.channel === ch) })).filter((g) => g.items.length);

  return (
    <div ref={rootRef} style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)", position: "relative" }}>
      {/* top bar */}
      <div style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in oklch, var(--paper) 85%, transparent)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", gap: 16 }}>
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
            <button
              type="button"
              onClick={copyInstruction}
              style={{ border: "none", cursor: "pointer", background: "var(--seal)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600 }}
              title="把更改复制成一段指令发给 Claude，由我改配置并重建部署"
            >
              {copied ? "已复制 ✓" : `复制更改给 Claude (${changeCount})`}
            </button>
          )}
          <PBDisclaimer compact />
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 28px 80px" }}>
        <header style={{ marginBottom: 26 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 34, margin: 0, letterSpacing: "0.01em" }}>来源管理</h1>
          <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>{liveEntries.length} 个订阅</span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>
              {totalActive} 个跟踪中 · {totalPaused} 个已暂停
            </span>
          </div>
          <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: "var(--muted)", maxWidth: 620 }}>
            暂停 / 取消订阅即时生效（本机）；点右上角「复制更改给 Claude」即可永久应用并重建。
          </p>
        </header>

        {/* add source */}
        {!form.open ? (
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, open: true }))}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "15px 18px", borderRadius: 12, cursor: "pointer", border: "1px dashed var(--line-strong)", background: "var(--surface)", color: "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, marginBottom: 30 }}
          >
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--seal)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, lineHeight: 1, flex: "0 0 auto" }}>+</span>
            添加来源 <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", fontWeight: 400 }}>Substack · X · 业绩记录 · 播客 · 论文 · 收藏</span>
          </button>
        ) : (
          <form onSubmit={addSource} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)", padding: 18, marginBottom: 30, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Field label="译名 (中文)">
                <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：战略链" style={inputStyle} />
              </Field>
              <Field label="原名 / 频道">
                <input value={form.en} onChange={(e) => setForm((f) => ({ ...f, en: e.target.value }))} placeholder="Stratechery" style={inputStyle} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Field label="作者 / 句柄 / RSS">
                <input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} placeholder="@handle 或 https://…/feed" style={inputStyle} />
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

        {/* pending adds */}
        {adds.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--seal)", marginBottom: 8 }}>待新增（发给 Claude 后生效）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {adds.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 10, background: "var(--wash)", padding: "10px 14px" }}>
                  <PBAvatar initials={initialsOf(a.name)} tint={tintOf(a.name)} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)" }}>
                      {CHANNEL_META[a.channel]?.label} · {a.handle || a.en || "—"}
                    </div>
                  </div>
                  <button type="button" onClick={() => persistAdds(adds.filter((_, idx) => idx !== i))} title="删除" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 7, padding: "6px 9px", cursor: "pointer", color: "var(--muted)" }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* grouped list */}
        {grouped.map((g) => (
          <div key={g.channel} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <PBPlatform name={CHANNEL_META[g.channel].label} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)" }}>{g.items.length}</span>
              <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
              {g.items.map((s, i) => {
                const paused = disabled.has(s.key);
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderTop: i ? "1px solid var(--line)" : "none", opacity: paused ? 0.55 : 1 }}>
                    <PBAvatar initials={initialsOf(nameOf(s))} tint={tintOf(s.name)} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {editing === s.key ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => saveRename(s.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(s.key);
                            if (e.key === "Escape") setEditing(null);
                          }}
                          style={{ ...inputStyle, padding: "4px 8px", fontSize: 15, fontWeight: 600, width: 220 }}
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{nameOf(s)}</span>
                          <button type="button" onClick={() => { setEditing(s.key); setDraft(nameOf(s)); }} title="重命名译名" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--faint)", padding: 2, display: "inline-flex" }}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10z" />
                            </svg>
                          </button>
                          {paused && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.08em", color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "1px 7px" }}>已暂停</span>}
                        </div>
                      )}
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--faint)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sub}</div>
                    </div>
                    <div style={{ textAlign: "right", flex: "0 0 auto", marginRight: 4 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-soft)" }}>{weeklyOf[s.key] || 0}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.06em", color: "var(--faint)", textTransform: "uppercase" }}>本周</div>
                    </div>
                    <button type="button" onClick={() => togglePause(s.key)} title={paused ? "恢复跟踪" : "暂停跟踪"} style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 7, padding: "6px 11px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", flex: "0 0 auto" }}>
                      {paused ? "恢复" : "暂停"}
                    </button>
                    <button type="button" onClick={() => unsubscribe(s)} title="取消订阅" style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 7, padding: "6px 9px", cursor: "pointer", color: "var(--muted)", flex: "0 0 auto", display: "inline-flex" }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5l.5-8.5" />
                      </svg>
                    </button>
                  </div>
                );
              })}
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
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "var(--paper)", borderRadius: 999, padding: "10px 20px", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, zIndex: 60, boxShadow: "0 8px 28px color-mix(in oklch, var(--ink) 22%, transparent)" }}>{toast}</div>
      )}
    </div>
  );
}
