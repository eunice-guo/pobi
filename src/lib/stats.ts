// Reading-stats model for /stats (阅读统计 · 习惯打卡) and the /sources
// completion bars. We CANNOT measure time-on-page (reading happens on the
// original link), so everything is built from signals we actually capture:
//   received — items that arrived (derived from the feed, by publish day)
//   read     — items marked 确认读完 (pobi.readStat: per-day, per-source)
//   clicked  — items where the user opened 原文 (pobi.clickLog: per-day)
//   streak / 打卡 — days with ≥1 read
import type { FeedItem } from "./types";
import { toVM } from "./triage";

export const READSTAT_KEY = "pobi.readStat"; // { 'YYYY-MM-DD': { read, srcs:{key:n} } } — only 确认读完
export const CLICKLOG_KEY = "pobi.clickLog"; // { 'YYYY-MM-DD': count } — 原文 ↗ opens (深读)
export const OPENED_KEY = "pobi.openedIds"; // item ids opened in-app (点开, ≠ 读完)

export type DayStat = { read: number; srcs: Record<string, number> };
export type ReadStat = Record<string, DayStat>;
export type ClickLog = Record<string, number>;

function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface SourceMeta {
  key: string;
  cn: string;
  en: string;
  platform: string;
  channel: string;
  initials: string;
  tint: string;
}

export interface Stats {
  today: Date;
  streak: number;
  longest: number;
  daysActiveAll: number;
  week7Active: number; // 打卡 days this calendar week
  month30Active: number; // active days in last 30
  todayRead: number;
  week: { received: number; opened: number; read: number; clicked: number; backlog: number; rate: number };
  month: { read: number };
  heatmap: { weeks: { cells: { key: string; count: number; future: boolean; level: number }[]; monthLabel: string }[] };
  weekStrip: { w: string; done: boolean; future: boolean; today: boolean }[];
  topSources: { meta: SourceMeta; n: number; frac: number }[];
  journal: FeedItem[];
  badges: { label: string; done: boolean; prog: number; goal: number }[];
  // per-source this-week read/received (for /sources completion bars)
  weeklyFor: (key: string) => { read: number; recv: number };
}

export function loadReadStat(): ReadStat {
  try {
    return JSON.parse(localStorage.getItem(READSTAT_KEY) || "{}") as ReadStat;
  } catch {
    return {};
  }
}
export function loadClickLog(): ClickLog {
  try {
    return JSON.parse(localStorage.getItem(CLICKLOG_KEY) || "{}") as ClickLog;
  } catch {
    return {};
  }
}

// Record one finished read (确认读完 / open) against today + its source.
export function logRead(item: FeedItem) {
  try {
    const stat = loadReadStat();
    const d = isoDay(new Date());
    const day = stat[d] || (stat[d] = { read: 0, srcs: {} });
    day.read += 1;
    const k = item.author;
    day.srcs[k] = (day.srcs[k] || 0) + 1;
    localStorage.setItem(READSTAT_KEY, JSON.stringify(stat));
  } catch {}
}
export function logClick() {
  try {
    const log = loadClickLog();
    const d = isoDay(new Date());
    log[d] = (log[d] || 0) + 1;
    localStorage.setItem(CLICKLOG_KEY, JSON.stringify(log));
  } catch {}
}

const HEAT_LEVEL = (c: number) => (c <= 0 ? 0 : c <= 2 ? 1 : c <= 4 ? 2 : c <= 6 ? 3 : 4);

export function computeStats(
  feedItems: FeedItem[],
  readStat: ReadStat,
  clickLog: ClickLog,
  readIds: Set<string>,
  openedIds: Set<string>,
  starred: Set<string>,
  saved: Set<string>
): Stats {
  const today = new Date();
  const todayIso = isoDay(today);

  const readOf = (iso: string) => readStat[iso]?.read || 0;

  // streak (consecutive days up to today with a read)
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (readOf(isoDay(d)) > 0) streak++;
    else break;
    if (i > 800) break;
  }
  // longest + daysActive over all logged days
  const loggedDays = Object.keys(readStat).filter((k) => readStat[k].read > 0).sort();
  const daysActiveAll = loggedDays.length;
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of loggedDays) {
    const cur = new Date(k + "T00:00:00");
    if (prev && (cur.getTime() - prev.getTime()) / 86400000 === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = cur;
  }

  // this calendar week (Mon–Sun)
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - dow);
  const WD = ["一", "二", "三", "四", "五", "六", "日"];
  const weekStrip = WD.map((w, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return { w, done: readOf(isoDay(d)) > 0, future: d > today && isoDay(d) !== todayIso, today: isoDay(d) === todayIso };
  });
  let week7Active = 0;
  let weekClick = 0;
  for (let i = 0; i <= dow; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const iso = isoDay(d);
    if (readOf(iso) > 0) week7Active++;
    weekClick += clickLog[iso] || 0;
  }

  // last 30 days
  let month30Active = 0;
  let monthRead = 0;
  const srcsRead30: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = isoDay(d);
    const r = readStat[iso];
    if (r && r.read > 0) {
      month30Active++;
      monthRead += r.read;
      for (const k in r.srcs) srcsRead30[k] = (srcsRead30[k] || 0) + r.srcs[k];
    }
  }

  // heatmap — 16 weeks ending this week
  const WEEKS = 16;
  const hmStart = new Date(monday);
  hmStart.setDate(hmStart.getDate() - (WEEKS - 1) * 7);
  const weeks = [];
  for (let w = 0; w < WEEKS; w++) {
    const cells = [];
    let monthLabel = "";
    for (let dd = 0; dd < 7; dd++) {
      const d = new Date(hmStart);
      d.setDate(d.getDate() + w * 7 + dd);
      const iso = isoDay(d);
      const future = d > today && iso !== todayIso;
      if (dd === 0 && d.getDate() <= 7) monthLabel = `${d.getMonth() + 1}月`;
      const count = readOf(iso);
      cells.push({ key: iso, count, future, level: future ? -1 : HEAT_LEVEL(count) });
    }
    weeks.push({ cells, monthLabel });
  }

  // source metadata from the feed
  const srcMeta = new Map<string, SourceMeta>();
  for (const it of feedItems) {
    if (srcMeta.has(it.author)) continue;
    const vm = toVM(it);
    srcMeta.set(it.author, {
      key: it.author,
      cn: vm.cn,
      en: vm.en,
      platform: vm.platform,
      channel: it.channel,
      initials: vm.initials,
      tint: vm.tint,
    });
  }
  const topEntries = Object.entries(srcsRead30)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topMax = topEntries[0]?.[1] || 1;
  const topSources = topEntries.map(([key, n]) => ({
    meta: srcMeta.get(key) || { key, cn: key, en: "", platform: "", channel: "", initials: key.slice(0, 2).toUpperCase(), tint: "#8A5A2B" },
    n,
    frac: n / topMax,
  }));

  // journal — recently read items (then starred/saved) that are in the feed
  const seenJ = new Set<string>();
  const journal: FeedItem[] = [];
  for (const it of feedItems) {
    if ((readIds.has(it.id) || starred.has(it.id) || saved.has(it.id)) && !seenJ.has(it.id)) {
      seenJ.add(it.id);
      journal.push(it);
    }
    if (journal.length >= 6) break;
  }

  const badges = [
    { label: "连续 7 天", done: streak >= 7, prog: Math.min(streak, 7), goal: 7 },
    { label: "连续 30 天", done: streak >= 30, prog: streak, goal: 30 },
    { label: "周满五日", done: week7Active >= 5, prog: week7Active, goal: 5 },
    { label: "累计百日", done: daysActiveAll >= 100, prog: daysActiveAll, goal: 100 },
  ];

  // Completion = of THIS source's items currently in the feed (what arrived),
  // how many you've marked read. Keys off readIds so it updates the instant you
  // read — independent of publish dates (curated/old items would otherwise never
  // count as "received this week").
  const weeklyFor = (key: string) => {
    let read = 0;
    let recv = 0;
    for (const it of feedItems) {
      if (it.author !== key) continue;
      recv++;
      if (readIds.has(it.id)) read++;
    }
    return { read, recv };
  };

  // Overall funnel: of everything in the inbox — how much opened (点开) vs
  // actually finished (确认读完). Opening alone is NOT 读完.
  const feedTotal = feedItems.length;
  const feedRead = feedItems.filter((i) => readIds.has(i.id)).length;
  const feedOpened = feedItems.filter((i) => openedIds.has(i.id)).length;

  return {
    today,
    streak,
    longest: Math.max(longest, streak),
    daysActiveAll,
    week7Active,
    month30Active,
    todayRead: readOf(todayIso),
    week: { received: feedTotal, opened: feedOpened, read: feedRead, clicked: weekClick, backlog: Math.max(0, feedTotal - feedRead), rate: feedTotal ? feedRead / feedTotal : 0 },
    month: { read: monthRead },
    heatmap: { weeks },
    weekStrip,
    topSources,
    journal,
    badges,
    weeklyFor,
  };
}
