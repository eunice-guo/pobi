// Shared shape between the builder (writes JSON) and the app (reads JSON).

export type Channel = "x" | "substack" | "transcript";

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
  sectors: string[];
  secondHand: true;
  enriched: boolean;
}

export interface Feed {
  generatedAt: string; // ISO
  date: string; // YYYY-MM-DD
  itemCount: number;
  enriched: boolean; // whether Claude enrichment ran
  notes: string[]; // e.g. "X skipped: no token"
  items: FeedItem[];
}
