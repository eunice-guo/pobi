// Shared shape between the builder (writes JSON) and the app (reads JSON).

export type Channel = "x" | "substack" | "transcript" | "research" | "podcast" | "bookmark" | "paper" | "worldmodel";

export interface Source {
  handle: string; // X username, or RSS URL for substack
  displayName: string;
  channel: Channel;
  priority: "P0" | "P1" | "P2";
  sectors: string[];
  enabled: boolean;
}

export interface FeedItem {
  id: string; // `${channel}:${sourceId}`
  channel: Channel;
  author: string; // handle
  authorName: string; // displayName
  url: string; // original, always linked
  publishedAt: string; // ISO
  lang: "en";
  title: string | null;
  textEn: string; // original English text (truncated)
  summaryZh: string | null; // null when not yet enriched
  translationZh: string | null;
  tickers: string[];
  topics?: string[]; // AI-extracted topic tags for the 读完 knowledge graph
  sectors: string[];
  secondHand: true;
  enriched: boolean;
  // optional metadata for curated channels (podcast / bookmark); ignored elsewhere
  guest?: string | null;
  platform?: string | null; // e.g. "YouTube", "Bilibili"
  altUrl?: string | null; // mirror link (e.g. Bilibili for 国内 viewers)
  altPlatform?: string | null;
  kind?: string | null; // bookmark: "course" | "article" | "paper"
}

export interface Feed {
  generatedAt: string; // ISO
  date: string; // YYYY-MM-DD
  itemCount: number;
  enriched: boolean; // whether Claude enrichment ran
  notes: string[]; // e.g. "X skipped: no token"
  items: FeedItem[];
}
