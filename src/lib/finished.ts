// 读完 (finished) knowledge store + graph model.
//
// When a user 确认读完 an item we SNAPSHOT the bits we need into localStorage —
// title, url, source, channel, sectors, AI topics, summary — plus an optional
// takeaway note. Snapshotting (vs. re-reading the live feed) is deliberate: feed
// items age out of the lookback window, but a knowledge graph of what you've read
// must persist. Connections are drawn by shared TOPIC (AI-extracted) and by
// hand-typed #tags / [[links]] in the takeaway — never by source.
import type { FeedItem } from "./types";

export const FINISHED_KEY = "pobi.finished"; // { [id]: FinishedNote }

export interface FinishedNote {
  id: string;
  title: string;
  url: string;
  authorName: string;
  channel: string;
  sectors: string[];
  topics: string[]; // AI-extracted (from feed) + falls back to sectors
  summaryZh: string | null;
  readAt: string; // ISO
  takeaway: string; // user note, "" if skipped
}

export function loadFinished(): Record<string, FinishedNote> {
  try {
    return JSON.parse(localStorage.getItem(FINISHED_KEY) || "{}") as Record<string, FinishedNote>;
  } catch {
    return {};
  }
}

function save(all: Record<string, FinishedNote>) {
  try {
    localStorage.setItem(FINISHED_KEY, JSON.stringify(all));
  } catch {}
}

// Snapshot an item as finished. Keeps an existing takeaway/readAt if re-finished.
export function snapshotFinished(item: FeedItem, takeaway: string, nowIso: string) {
  const all = loadFinished();
  const prev = all[item.id];
  all[item.id] = {
    id: item.id,
    title: item.title || item.textEn.slice(0, 60),
    url: item.url,
    authorName: item.authorName,
    channel: item.channel,
    sectors: item.sectors || [],
    topics: (item.topics && item.topics.length ? item.topics : item.sectors || []).slice(0, 8),
    summaryZh: item.summaryZh,
    readAt: prev?.readAt || nowIso,
    takeaway: takeaway || prev?.takeaway || "",
  };
  save(all);
}

export function setTakeaway(id: string, text: string) {
  const all = loadFinished();
  if (all[id]) {
    all[id].takeaway = text;
    save(all);
  }
}

export function removeFinished(id: string) {
  const all = loadFinished();
  delete all[id];
  save(all);
}

// --- takeaway parsing: #tags and [[links]] ---
export function hashtagsOf(text: string): string[] {
  return [...(text || "").matchAll(/#([\p{L}\p{N}_\-]+)/gu)].map((m) => m[1]);
}
export function wikilinksOf(text: string): string[] {
  return [...(text || "").matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Every connectable tag for a note: AI topics + hand-typed #tags.
export function tagsOf(note: FinishedNote): string[] {
  const set = new Set<string>();
  for (const t of note.topics || []) if (t) set.add(norm(t));
  for (const h of hashtagsOf(note.takeaway)) set.add(norm(h));
  return [...set];
}

export interface GraphNode {
  id: string;
  label: string;
  channel: string;
  hasTakeaway: boolean;
  note: FinishedNote;
}
export interface GraphEdge {
  a: string;
  b: string;
  kind: "topic" | "link";
  via: string; // the shared tag / link target (for tooltips)
}

// Build the connection graph. Edges:
//  - topic: two notes share a normalized tag (AI topic or hand #tag)
//  - link:  a note's takeaway [[links]] to another note's title
export function buildGraph(all: Record<string, FinishedNote>): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const notes = Object.values(all).sort((a, b) => (a.readAt < b.readAt ? 1 : -1));
  const nodes: GraphNode[] = notes.map((n) => ({
    id: n.id,
    label: n.title,
    channel: n.channel,
    hasTakeaway: !!n.takeaway.trim(),
    note: n,
  }));

  const edgeKey = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (a: string, b: string, kind: GraphEdge["kind"], via: string) => {
    if (a === b) return;
    // one edge per pair+kind (multiple shared topics collapse to a single line)
    const k = [a, b].sort().join("|") + "|" + kind;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    edges.push({ a, b, kind, via });
  };

  // topic edges — group note ids by tag, connect within each group
  const byTag = new Map<string, string[]>();
  for (const n of notes) for (const t of tagsOf(n)) (byTag.get(t) || byTag.set(t, []).get(t)!).push(n.id);
  for (const [tag, ids] of byTag) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) add(ids[i], ids[j], "topic", tag);
  }

  // [[link]] edges — match a wikilink to another note's title (contains, case-insensitive)
  for (const n of notes) {
    for (const link of wikilinksOf(n.takeaway)) {
      const target = notes.find((m) => m.id !== n.id && norm(m.title).includes(norm(link)));
      if (target) add(n.id, target.id, "link", link);
    }
  }

  return { nodes, edges };
}

// Per-source signal for /sources: of a source's finished reads, how many got a
// takeaway. A source you finish but never note may be worth unsubscribing.
export function takeawayRateBySource(all: Record<string, FinishedNote>): Record<string, { finished: number; noted: number }> {
  const out: Record<string, { finished: number; noted: number }> = {};
  for (const n of Object.values(all)) {
    const k = n.authorName;
    const r = out[k] || (out[k] = { finished: 0, noted: 0 });
    r.finished++;
    if (n.takeaway.trim()) r.noted++;
  }
  return out;
}
