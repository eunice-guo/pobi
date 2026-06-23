// Adapts the real feed (FeedItem) into the Option C view model — source
// avatar/initials/tint, platform label, reading-time estimate, clean meta.
import type { Channel, FeedItem } from "./types";

// Curated channels are managed as individual items; subscription channels
// (x/substack/research) are managed by their source handle.
export const CURATED_CHANNELS = new Set<Channel>(["podcast", "bookmark", "paper"]);

// localStorage keys shared by the /sources manager (writes) and the inbox
// (reads): disabled source identifiers (hide items live) + display-name renames.
export const DISABLED_SOURCES_KEY = "pobi.disabledSources";
export const RENAMES_KEY = "pobi.sourceRenames";

// Stable identity for "which source/subscription is this item from". Every
// channel now keys by item.author: a handle (x/substack/research), a YouTube
// show feed (podcast), a ticker (transcript), an arXiv author (paper), or the
// curated id (curated papers/bookmarks). Removing a subscription = hiding every
// item whose author matches — so removing a show/author clears all its items.
export function sourceKeyOf(item: FeedItem): string {
  return item.author;
}

export const CHANNEL_META: Record<string, { label: string; seal: boolean }> = {
  transcript: { label: "业绩记录", seal: true },
  research: { label: "资管观点", seal: false },
  worldmodel: { label: "世界模型", seal: false },
  podcast: { label: "播客访谈", seal: false },
  paper: { label: "论文", seal: false },
  bookmark: { label: "收藏", seal: false },
  substack: { label: "Substack", seal: false },
  x: { label: "X", seal: false },
};

// Ordered channel list for the rail's 分类 section (real channels, per product call).
export const CHANNEL_ORDER: Channel[] = [
  "transcript",
  "research",
  "worldmodel",
  "podcast",
  "paper",
  "bookmark",
  "substack",
  "x",
];

// English caption shown next to each channel in the rail.
export const CHANNEL_EN: Record<string, string> = {
  transcript: "Earnings",
  research: "Asset Mgrs",
  worldmodel: "World Models",
  podcast: "Podcasts",
  paper: "Papers",
  bookmark: "Bookmarks",
  substack: "Substack",
  x: "X",
};

// Folders (read-state lanes), matching the handoff.
export type Folder = "today" | "unread" | "starred" | "reading";
export const FOLDERS: { key: Folder; cn: string; en: string }[] = [
  { key: "today", cn: "今日收件箱", en: "Today" },
  { key: "unread", cn: "未读", en: "Unread" },
  { key: "starred", cn: "已加星", en: "Starred" },
  { key: "reading", cn: "待读清单", en: "Reading" },
];

export const SECTOR_LABEL: Record<string, string> = {
  "CHINA-TECH": "中国科技",
  "AI-SEMIS": "AI · 半导体",
  "AI-RESEARCH": "AI 研究",
  "WORLD-MODEL": "世界模型",
  ROBOTICS: "机器人",
  COURSE: "课程",
  THEMATIC: "主题",
  SOFTWARE: "软件",
  QUALITY: "优质公司",
  "SPECIAL-SITS": "特殊事件",
  "TECH-STRATEGY": "科技战略",
  MACRO: "宏观",
  ENERGY: "能源",
  SHORT: "做空",
  EARNINGS: "业绩",
  "ASSET-MGR": "资管",
  HUMANITIES: "人文",
};

// Avatar tints — the reference oklch palette (shared.jsx / option-c-sources.jsx),
// assigned deterministically per source so each stays stable.
const TINTS = [
  "oklch(0.62 0.13 250)",
  "oklch(0.55 0.10 150)",
  "oklch(0.60 0.14 50)",
  "oklch(0.50 0.12 280)",
  "oklch(0.58 0.11 200)",
  "oklch(0.56 0.12 320)",
  "oklch(0.52 0.11 30)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function isCJK(ch: string): boolean {
  return /[㐀-鿿]/.test(ch);
}

// 1–2 char monogram: first CJK glyph, else first two Latin letters.
export function initialsOf(name: string): string {
  const clean = (name || "").replace(/^[@$]/, "").trim();
  for (const ch of clean) {
    if (isCJK(ch)) return ch;
  }
  const letters = clean.replace(/[^A-Za-z]/g, "");
  return (letters.slice(0, 2) || clean.slice(0, 2) || "·").toUpperCase();
}

export function tintOf(name: string): string {
  return TINTS[hash(name || "x") % TINTS.length];
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Strip the "标题：… 正文：" scaffold some translations echo from the prompt.
export function cleanTranslation(t: string | null): string | null {
  if (!t) return null;
  return t.replace(/^\s*标题：[\s\S]*?正文：/, "").replace(/^\s*正文：/, "").trim() || null;
}

// Reading-time estimate: ~360 Han chars/min, ~220 EN words/min.
function readMinsOf(item: FeedItem): number {
  const zh = cleanTranslation(item.translationZh);
  if (zh) return Math.max(1, Math.round(zh.length / 360));
  const words = (item.textEn || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export interface TriageVM {
  item: FeedItem;
  id: string;
  channel: Channel;
  platform: string; // platform label (channel or YouTube/Bilibili)
  platformSeal: boolean;
  cn: string; // source 中文 name
  en: string; // mono secondary (handle / guest / domain)
  initials: string;
  tint: string;
  titleCn: string;
  summaryCn: string | null;
  bodyCn: string | null; // faithful Chinese full text (if any)
  bodyEn: string; // English original
  url: string;
  domain: string;
  altUrl: string | null;
  altPlatform: string | null;
  tickers: string[];
  readMins: number;
}

export function toVM(item: FeedItem): TriageVM {
  const meta = CHANNEL_META[item.channel] ?? { label: item.channel, seal: false };
  const domain = domainOf(item.url);

  // mono secondary line varies by channel so it reads naturally
  let en = "";
  if (item.channel === "x") en = `@${item.author}`;
  else if (item.channel === "transcript") en = `$${item.author}`;
  else if (item.channel === "podcast") en = item.guest || domain;
  else en = domain;

  const platform =
    item.channel === "podcast" && item.platform ? item.platform : meta.label;

  return {
    item,
    id: item.id,
    channel: item.channel,
    platform,
    platformSeal: meta.seal,
    cn: item.authorName,
    en,
    initials: initialsOf(item.authorName),
    tint: tintOf(item.authorName),
    titleCn: item.title || item.textEn.slice(0, 60),
    summaryCn: item.summaryZh,
    bodyCn: cleanTranslation(item.translationZh),
    bodyEn: item.textEn,
    url: item.url,
    domain,
    altUrl: item.altUrl ?? null,
    altPlatform: item.altPlatform ?? null,
    tickers: item.tickers,
    readMins: readMinsOf(item),
  };
}
