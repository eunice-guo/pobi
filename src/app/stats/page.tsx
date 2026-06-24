"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Feed } from "@/lib/types";
import { PBBrand, PBAvatar, PBDisclaimer } from "@/components/pb";
import { computeStats, loadReadStat, loadClickLog, READSTAT_KEY, CLICKLOG_KEY, OPENED_KEY, type Stats } from "@/lib/stats";

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

const HEAT = [
  "var(--wash)",
  "color-mix(in oklch, var(--seal) 24%, var(--surface))",
  "color-mix(in oklch, var(--seal) 46%, var(--surface))",
  "color-mix(in oklch, var(--seal) 68%, var(--surface))",
  "color-mix(in oklch, var(--seal) 92%, var(--surface))",
];

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", ...style }}>{children}</div>
);
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>{children}</div>
);
const Check = ({ size = 16, w = 3 }: { size?: number; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export default function StatsPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let current: Feed | null = null;
    // Recompute from localStorage every time — so reads logged in the inbox
    // show up the moment you return to this page (focus / bfcache restore /
    // tab re-visible), not only on a hard reload.
    const recompute = () => {
      if (!current) return;
      setStats(computeStats(current.items, loadReadStat(), loadClickLog(), loadSet("pobi.readIds"), loadSet("pobi.openedIds"), loadSet("pobi.starredIds"), loadSet("pobi.savedIds")));
    };
    fetch("/feed/latest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((f: Feed) => {
        current = f;
        setFeed(f);
        recompute();
      })
      .catch(() => setFeed({ generatedAt: "", date: "", itemCount: 0, enriched: false, notes: [], items: [] }));

    const onVis = () => {
      if (!document.hidden) recompute();
    };
    window.addEventListener("focus", recompute);
    window.addEventListener("pageshow", recompute);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", recompute);
      window.removeEventListener("pageshow", recompute);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const dateLine = useMemo(() => {
    const d = new Date();
    const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
    return `习惯打卡 · ${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${wd}`;
  }, []);

  const resetStats = () => {
    if (!window.confirm("确定清空阅读统计吗？\n\n将归零：连续打卡 streak、本周/本月/累计打卡、打卡日历热力图、最常读来源、跳转原文次数，以及已读 / 点开 篇数。\n\n注意：收件箱里所有文章会变回“未读”。\n\n会保留：你的加星 / 待读。\n\n此操作无法撤销。")) return;
    try {
      localStorage.removeItem(READSTAT_KEY);
      localStorage.removeItem(CLICKLOG_KEY);
      localStorage.removeItem(OPENED_KEY);
      localStorage.removeItem("pobi.readIds");
    } catch {}
    window.location.reload();
  };

  const R = 54;
  const C = 2 * Math.PI * R;

  const TopBar = () => (
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
        <Link href="/finished" style={{ textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>知识图谱</Link>
        <Link href="/sources" style={{ textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>来源管理</Link>
      </div>
    </div>
  );

  if (!stats)
    return (
      <div style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
        <TopBar />
        <p style={{ maxWidth: "none", margin: "0", padding: "48px 28px", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>加载中…</p>
      </div>
    );

  const s = stats;
  return (
    <div style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
      <TopBar />
      <div style={{ maxWidth: "none", margin: "0", padding: "36px 28px 80px" }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 34, margin: 0 }}>阅读统计</h1>
          <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{dateLine}</div>
        </header>

        {/* hero */}
        <Card style={{ padding: 0, marginBottom: 26, display: "flex", overflow: "hidden", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", padding: "26px 28px", borderRight: "1px solid var(--line)", background: "color-mix(in oklch, var(--seal) 5%, var(--surface))" }}>
            <Eyebrow>连续打卡 · Streak</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 64, lineHeight: 0.9, color: "var(--seal)", letterSpacing: "-0.02em" }}>{s.streak}</span>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-soft)" }}>天</span>
            </div>
            {s.todayRead > 0 ? (
              <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: "var(--seal)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                <Check size={12} /> 今日已打卡
              </div>
            ) : (
              <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line-strong)", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
                今日未打卡 · 读完一篇即打卡
              </div>
            )}
            <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
              最长纪录 {s.longest} 天 · 累计打卡 {s.daysActiveAll} 天
            </div>
          </div>
          <div style={{ flex: "1 1 320px", padding: "26px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <Eyebrow>本周打卡 · {s.week7Active}/7 天</Eyebrow>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                今日读完 <b style={{ color: "var(--ink)", fontWeight: 600 }}>{s.todayRead}</b> 篇
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              {s.weekStrip.map((d, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      maxWidth: 46,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: d.done ? "var(--seal)" : d.future ? "transparent" : "var(--wash)",
                      border: d.today ? "2px solid var(--seal)" : d.future ? "1px dashed var(--line-strong)" : "1px solid transparent",
                      color: d.done ? "#fff" : "var(--faint)",
                    }}
                  >
                    {d.done ? <Check size={16} /> : d.future ? "" : <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--line-strong)" }} />}
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: d.today ? "var(--seal)" : "var(--faint)", fontWeight: d.today ? 600 : 400 }}>{d.w}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* consistency */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 26 }}>
          {[
            { eb: "本周打卡", v: s.week7Active, u: "/ 7 天" },
            { eb: "本月打卡", v: s.month30Active, u: "/ 30 天" },
            { eb: "累计打卡", v: s.daysActiveAll, u: "天" },
          ].map((c, i) => (
            <Card key={i} style={{ padding: "18px 20px" }}>
              <Eyebrow>{c.eb}</Eyebrow>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
                <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 38, lineHeight: 1 }}>{c.v}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{c.u}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* completion */}
        <Card style={{ padding: 0, marginBottom: 26, display: "flex", overflow: "hidden", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", padding: "24px 28px", borderRight: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ position: "relative", width: 132, height: 132, flex: "0 0 auto" }}>
              <svg width="132" height="132">
                <circle cx="66" cy="66" r={R} fill="none" stroke="var(--wash)" strokeWidth="13" />
                <circle cx="66" cy="66" r={R} fill="none" stroke="var(--seal)" strokeWidth="13" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - s.week.rate)} transform="rotate(-90 66 66)" />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 32, lineHeight: 1 }}>{Math.round(s.week.rate * 100)}%</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "var(--faint)", textTransform: "uppercase", marginTop: 3 }}>完成率</span>
              </div>
            </div>
            <div>
              <Eyebrow>收件箱处理</Eyebrow>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  { k: "收到", v: s.week.received, c: "var(--line-strong)" },
                  { k: "点开", v: s.week.opened, c: "var(--faint)" },
                  { k: "读完", v: s.week.read, c: "var(--seal)" },
                  { k: "待清", v: s.week.backlog, c: "var(--muted)" },
                ].map((x, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: x.c, flex: "0 0 auto" }} />
                    <span style={{ fontSize: 13, color: "var(--ink-soft)", width: 34 }}>{x.k}</span>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600 }}>{x.v}</span>
                    <span style={{ fontSize: 11.5, color: "var(--faint)" }}>篇</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ flex: "1 1 220px", padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            <Eyebrow>跳转原文</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 34, lineHeight: 1 }}>{s.week.clicked}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>次</span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--faint)" }}>点击进入原文深读（阅读发生在原文链接）</span>
          </div>
        </Card>

        {/* heatmap */}
        <Card style={{ padding: "20px 24px", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Eyebrow>打卡日历 · 近 16 周</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--faint)" }}>
              少
              {HEAT.map((c, i) => (
                <span key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c, border: i === 0 ? "1px solid var(--line)" : "none" }} />
              ))}
              多
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 18 }}>
              {["一", "", "三", "", "五", "", "日"].map((w, i) => (
                <span key={i} style={{ height: 13, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)", lineHeight: "13px" }}>{w}</span>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 5, height: 13 }}>
                {s.heatmap.weeks.map((col, i) => (
                  <span key={i} style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)", lineHeight: "13px" }}>{col.monthLabel}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {s.heatmap.weeks.map((col, ci) => (
                  <div key={ci} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    {col.cells.map((cell, di) => (
                      <div
                        key={di}
                        title={cell.future ? "" : `${cell.key} · ${cell.count} 篇`}
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          borderRadius: 3,
                          background: cell.level < 0 ? "transparent" : HEAT[cell.level],
                          border: cell.level === 0 ? "1px solid var(--line)" : cell.level < 0 ? "1px dashed color-mix(in oklch, var(--line) 60%, transparent)" : "none",
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* top sources */}
        <Card style={{ padding: "20px 24px", marginBottom: 26 }}>
          <Eyebrow>最常读的来源 · 近 30 天</Eyebrow>
          {s.topSources.length === 0 ? (
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--faint)" }}>开始读完文章后，这里会显示你最常读的来源。</p>
          ) : (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {s.topSources.map((t, i) => (
                <div key={t.meta.key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--faint)", width: 22, flex: "0 0 auto" }}>{i + 1}</span>
                  <PBAvatar initials={t.meta.initials} tint={t.meta.tint} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.meta.cn}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", flex: "0 0 auto" }}>{t.meta.platform}</span>
                    </div>
                    <div style={{ marginTop: 6, height: 7, borderRadius: 999, background: "var(--wash)", overflow: "hidden" }}>
                      <div style={{ width: `${t.frac * 100}%`, height: "100%", borderRadius: 999, background: "var(--seal)" }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, flex: "0 0 auto" }}>
                    {t.n}
                    <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400, fontFamily: "var(--font-sans)" }}> 篇</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* reading journal */}
        <Card style={{ padding: "20px 24px", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <Eyebrow>读完清单 · 近期</Eyebrow>
            <span style={{ fontSize: 12, color: "var(--faint)" }}>近 30 天共 {s.month.read} 篇</span>
          </div>
          {s.journal.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--faint)" }}>还没有读完的内容，回到收件箱开始阅读吧。</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {s.journal.map((it, i) => (
                <div
                  key={it.id}
                  style={{ display: "flex", gap: 14, padding: "16px 0", borderTop: i ? "1px solid var(--line)" : "none", color: "inherit" }}
                >
                  <PBAvatar initials={(it.authorName || "·").slice(0, 1)} tint="var(--ink-soft)" size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.4, color: "var(--ink)", fontWeight: 500, marginBottom: 3 }}>{it.title || it.textEn.slice(0, 50)}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)" }}>{it.authorName}</div>
                  </div>
                  <span style={{ color: "var(--seal)", flex: "0 0 auto", marginTop: 4 }}>
                    <Check size={14} w={2.4} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* badges */}
        <Card style={{ padding: "20px 24px" }}>
          <Eyebrow>成就徽章</Eyebrow>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {s.badges.map((b, i) => (
              <div key={i} style={{ padding: "14px", borderRadius: 10, border: "1px solid var(--line)", background: b.done ? "color-mix(in oklch, var(--seal) 6%, var(--surface))" : "var(--surface)", textAlign: "center" }}>
                <div style={{ width: 38, height: 38, margin: "0 auto 10px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: b.done ? "var(--seal)" : "var(--wash)", color: b.done ? "#fff" : "var(--faint)" }}>
                  {b.done ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 2l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: b.done ? "var(--ink)" : "var(--muted)" }}>{b.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{b.done ? "已达成" : `${b.prog} / ${b.goal}`}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <button
            onClick={resetStats}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.04em",
              color: "var(--muted)",
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: 999,
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >
            清空阅读统计
          </button>
          <PBDisclaimer />
        </div>
      </div>
    </div>
  );
}
