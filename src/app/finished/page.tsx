"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PBBrand, PBDisclaimer } from "@/components/pb";
import {
  loadFinished,
  buildGraph,
  setTakeaway as persistTakeaway,
  removeFinished,
  tagsOf,
  type FinishedNote,
  type GraphNode,
  type GraphEdge,
} from "@/lib/finished";

// channel → accent (the 读完 graph colors nodes by where the read came from)
const CH_TINT: Record<string, string> = {
  worldmodel: "oklch(0.58 0.13 280)",
  research: "oklch(0.60 0.12 200)",
  transcript: "oklch(0.55 0.18 33)",
  podcast: "oklch(0.60 0.14 50)",
  paper: "oklch(0.55 0.10 150)",
  bookmark: "oklch(0.56 0.12 320)",
  substack: "oklch(0.52 0.11 30)",
  x: "oklch(0.50 0.02 260)",
};
const CH_LABEL: Record<string, string> = {
  worldmodel: "世界模型",
  research: "资管观点",
  transcript: "业绩记录",
  podcast: "播客访谈",
  paper: "论文",
  bookmark: "收藏",
  substack: "Substack",
  x: "X",
};

// Deterministic spring layout — circle seed + repulsion/spring/centering iters.
function layout(nodes: GraphNode[], edges: GraphEdge[]) {
  const W = 1000;
  const H = 640;
  const n = nodes.length || 1;
  const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
  nodes.forEach((nd, i) => {
    const a = (2 * Math.PI * i) / n;
    pos[nd.id] = { x: W / 2 + Math.cos(a) * Math.min(W, H) * 0.34, y: H / 2 + Math.sin(a) * Math.min(W, H) * 0.34, vx: 0, vy: 0 };
  });
  const adj = edges.map((e) => [e.a, e.b] as const);
  const iters = n > 60 ? 200 : 320;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const A = pos[nodes[i].id];
        const B = pos[nodes[j].id];
        let dx = A.x - B.x;
        let dy = A.y - B.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const d = Math.sqrt(d2);
        const rep = 2600 / d2;
        const fx = (dx / d) * rep;
        const fy = (dy / d) * rep;
        A.vx += fx;
        A.vy += fy;
        B.vx -= fx;
        B.vy -= fy;
      }
    for (const [a, b] of adj) {
      const A = pos[a];
      const B = pos[b];
      if (!A || !B) continue;
      let dx = B.x - A.x;
      let dy = B.y - A.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const k = (d - 95) * 0.02;
      const fx = (dx / d) * k;
      const fy = (dy / d) * k;
      A.vx += fx;
      A.vy += fy;
      B.vx -= fx;
      B.vy -= fy;
    }
    for (const nd of nodes) {
      const P = pos[nd.id];
      P.vx += (W / 2 - P.x) * 0.002;
      P.vy += (H / 2 - P.y) * 0.002;
      P.x += P.vx * 0.85;
      P.y += P.vy * 0.85;
      P.vx *= 0.86;
      P.vy *= 0.86;
    }
  }
  // fit to a padded viewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const nd of nodes) {
    const P = pos[nd.id];
    minX = Math.min(minX, P.x);
    minY = Math.min(minY, P.y);
    maxX = Math.max(maxX, P.x);
    maxY = Math.max(maxY, P.y);
  }
  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = W; maxY = H;
  }
  const pad = 60;
  return { pos, vb: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}` };
}

export default function FinishedPage() {
  const [all, setAll] = useState<Record<string, FinishedNote> | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const reload = useCallback(() => setAll(loadFinished()), []);
  useEffect(() => {
    reload();
    const onVis = () => !document.hidden && reload();
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  const { nodes, edges } = useMemo(() => (all ? buildGraph(all) : { nodes: [], edges: [] }), [all]);
  const { pos, vb } = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const topicCount = useMemo(() => {
    const s = new Set<string>();
    for (const n of nodes) for (const t of tagsOf(n.note)) s.add(t);
    return s.size;
  }, [nodes]);

  const neighbors = useMemo(() => {
    if (!sel) return new Set<string>();
    const s = new Set<string>();
    for (const e of edges) {
      if (e.a === sel) s.add(e.b);
      if (e.b === sel) s.add(e.a);
    }
    return s;
  }, [sel, edges]);

  const saveEdit = (id: string) => {
    persistTakeaway(id, draft.trim());
    setEditing(null);
    reload();
  };
  const remove = (id: string) => {
    if (!window.confirm("从读完图谱移除这一篇？")) return;
    removeFinished(id);
    if (sel === id) setSel(null);
    reload();
  };

  const TopBar = () => (
    <div style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in oklch, var(--paper) 85%, transparent)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>
          <svg width="9" height="14" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7.5 1.5L1.5 7.5l6 6" />
          </svg>
          每日跟踪
        </Link>
        <span style={{ width: 1, height: 18, background: "var(--line)" }} />
        <PBBrand size={24} />
        <span style={{ flex: 1 }} />
        <Link href="/stats" style={{ textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>阅读统计</Link>
        <Link href="/sources" style={{ textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>来源管理</Link>
      </div>
    </div>
  );

  if (!all)
    return (
      <div style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
        <TopBar />
        <p style={{ padding: "48px 28px", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>加载中…</p>
      </div>
    );

  const selNote = sel ? all[sel] : null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
      <TopBar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px 80px" }}>
        <header style={{ marginBottom: 22 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 34, margin: 0 }}>读完 · 知识图谱</h1>
          <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            {nodes.length} 篇读完 · {edges.length} 条连接 · {topicCount} 个主题
          </div>
        </header>

        {nodes.length === 0 ? (
          <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", padding: "48px 28px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600 }}>还没有读完的文章</div>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.7 }}>
              回收件箱「确认读完」一篇，写一句收获，它就会出现在这里。<br />共享主题（AI 识别）或你写的 #标签 / [[标题]] 会把它们连成一张知识网。
            </p>
            <Link href="/" style={{ display: "inline-block", marginTop: 16, padding: "9px 18px", borderRadius: 999, background: "var(--seal)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>去阅读</Link>
          </div>
        ) : (
          <>
            {/* graph */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", padding: 12, marginBottom: 22 }}>
              <svg viewBox={vb} width="100%" style={{ display: "block", height: "min(64vh, 640px)", cursor: "default" }} onClick={() => setSel(null)}>
                {edges.map((e, i) => {
                  const A = pos[e.a];
                  const B = pos[e.b];
                  if (!A || !B) return null;
                  const active = sel === e.a || sel === e.b;
                  return (
                    <line
                      key={i}
                      x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                      stroke={e.kind === "link" ? "var(--seal)" : "var(--line-strong)"}
                      strokeWidth={active ? 2.2 : 1}
                      strokeDasharray={e.kind === "link" ? "5 4" : undefined}
                      opacity={sel && !active ? 0.12 : e.kind === "link" ? 0.8 : 0.5}
                    />
                  );
                })}
                {nodes.map((nd) => {
                  const P = pos[nd.id];
                  if (!P) return null;
                  const isSel = sel === nd.id;
                  const dim = !!sel && !isSel && !neighbors.has(nd.id);
                  const tint = CH_TINT[nd.channel] || "var(--ink-soft)";
                  const r = nd.hasTakeaway ? 11 : 7;
                  return (
                    <g
                      key={nd.id}
                      transform={`translate(${P.x} ${P.y})`}
                      style={{ cursor: "pointer", opacity: dim ? 0.25 : 1 }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSel((s) => (s === nd.id ? null : nd.id));
                      }}
                    >
                      <circle r={r} fill={tint} stroke={nd.hasTakeaway ? "var(--seal)" : "var(--surface)"} strokeWidth={nd.hasTakeaway ? 2.5 : 1.5} />
                      <text x={r + 5} y={4} fontSize={13} fill="var(--ink)" style={{ fontWeight: isSel ? 700 : 500, paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}>
                        {nd.label.length > 26 ? nd.label.slice(0, 26) + "…" : nd.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {/* legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "8px 8px 4px", fontSize: 11, color: "var(--faint)", fontFamily: "var(--font-mono)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--ink-soft)", border: "2px solid var(--seal)" }} /> 有收获</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 22, height: 0, borderTop: "1px solid var(--line-strong)" }} /> 共享主题</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 22, height: 0, borderTop: "2px dashed var(--seal)" }} /> [[链接]]</span>
              </div>
            </div>

            {/* selected detail */}
            {selNote && (
              <div style={{ border: "1px solid var(--seal)", borderRadius: 14, background: "color-mix(in oklch, var(--seal) 4%, var(--surface))", padding: "18px 20px", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: CH_TINT[selNote.channel] || "var(--muted)" }}>{CH_LABEL[selNote.channel] || selNote.channel}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)" }}>{selNote.authorName}</span>
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600, margin: "6px 0 8px", lineHeight: 1.35 }}>{selNote.title}</div>
                {selNote.summaryZh && <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 10px" }}>{selNote.summaryZh}</p>}
                {tagsOf(selNote).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {tagsOf(selNote).map((t) => (
                      <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "var(--wash)", color: "var(--ink-soft)" }}>#{t}</span>
                    ))}
                  </div>
                )}
                {selNote.takeaway ? (
                  <div style={{ borderLeft: "3px solid var(--seal)", paddingLeft: 12, fontSize: 14, color: "var(--ink)", lineHeight: 1.7, fontStyle: "italic" }}>{selNote.takeaway}</div>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--faint)" }}>（这篇没写收获）</div>
                )}
                <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                  <a href={selNote.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--seal)", fontWeight: 600, textDecoration: "none" }}>原文 ↗</a>
                  <button onClick={() => { setEditing(selNote.id); setDraft(selNote.takeaway); }} style={{ border: "none", background: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>编辑收获</button>
                  <button onClick={() => remove(selNote.id)} style={{ border: "none", background: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>移除</button>
                </div>
              </div>
            )}

            {/* list */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", margin: "4px 2px 12px" }}>全部读完 · 按时间</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nodes.map((nd) => {
                const note = nd.note;
                return (
                  <div key={nd.id} style={{ border: "1px solid " + (sel === nd.id ? "var(--seal)" : "var(--line)"), borderRadius: 12, background: "var(--surface)", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: CH_TINT[note.channel] || "var(--ink-soft)", marginTop: 6, flex: "0 0 auto", outline: note.takeaway ? "2px solid var(--seal)" : "none", outlineOffset: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, lineHeight: 1.4, cursor: "pointer" }} onClick={() => setSel(nd.id)}>{note.title}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", marginTop: 3 }}>{CH_LABEL[note.channel] || note.channel} · {note.authorName} · {note.readAt.slice(0, 10)}</div>
                        {editing === nd.id ? (
                          <div style={{ marginTop: 10 }}>
                            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="一句收获…用 #标签 / [[标题]] 关联" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line-strong)", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.6, outline: "none" }} />
                            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                              <button onClick={() => saveEdit(nd.id)} style={{ padding: "6px 14px", borderRadius: 999, border: "none", background: "var(--seal)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>保存</button>
                              <button onClick={() => setEditing(null)} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}>取消</button>
                            </div>
                          </div>
                        ) : note.takeaway ? (
                          <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, fontStyle: "italic", borderLeft: "3px solid color-mix(in oklch, var(--seal) 50%, transparent)", paddingLeft: 10 }}>{note.takeaway}</div>
                        ) : (
                          <button onClick={() => { setEditing(nd.id); setDraft(""); }} style={{ marginTop: 8, border: "none", background: "none", color: "var(--faint)", fontSize: 12.5, cursor: "pointer", padding: 0 }}>+ 补一句收获</button>
                        )}
                      </div>
                      <a href={note.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--seal)", textDecoration: "none", flex: "0 0 auto" }}>↗</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
          <PBDisclaimer />
        </div>
      </div>
    </div>
  );
}
