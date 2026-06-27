// Cross-device sync: mirrors the browser's pobi.* localStorage into Supabase and
// merges cloud ⇄ local on login so reading progress follows the user across
// devices. Design goals:
//   • localStorage stays the source the UI reads/writes (offline-first, no UI rewrite)
//   • merge is UNION / "true wins" / "max wins" — progress is never lost
//   • everything no-ops when signed out or Supabase is unconfigured
import type { SupabaseClient } from "@supabase/supabase-js";

// ---- localStorage keys (must match the rest of the app) ---------------------
const SET_KEYS = [
  "pobi.readIds",
  "pobi.openedIds",
  "pobi.starredIds",
  "pobi.savedIds",
  "pobi.dismissedIds",
] as const;
const FINISHED_KEY = "pobi.finished";
const READSTAT_KEY = "pobi.readStat";
const CLICKLOG_KEY = "pobi.clickLog";
const PREFS_KEYS = [
  "pobi.lastSeenAt",
  "pobi.papersSeeded",
  "pobi.watchlist",
  "pobi.watchlist.seeded",
  "pobi.disabledSources",
  "pobi.sourceRenames",
  "pobi.sourceRemovals",
  "pobi.sourceAdds",
] as const;

type FinishedNote = {
  id: string;
  title?: string;
  url?: string;
  authorName?: string;
  channel?: string;
  sectors?: string[];
  topics?: string[];
  summaryZh?: string | null;
  readAt?: string;
  takeaway?: string;
};

type ItemRow = {
  item_id: string;
  read: boolean;
  opened: boolean;
  starred: boolean;
  saved: boolean;
  dismissed: boolean;
  finished_at: string | null;
  takeaway: string | null;
  snapshot: FinishedNote | null;
};

type LocalState = {
  items: Record<string, ItemRow>;
  readStat: Record<string, { read: number; srcs: Record<string, number> }>;
  clickLog: Record<string, number>;
  prefs: Record<string, string>; // raw localStorage string values, keyed by full key
};

// ---- low-level helpers ------------------------------------------------------
function getRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function getJSON<T>(key: string, fallback: T): T {
  const raw = getRaw(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function setRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — ignore */
  }
}

const SET_TO_FLAG: Record<string, keyof ItemRow> = {
  "pobi.readIds": "read",
  "pobi.openedIds": "opened",
  "pobi.starredIds": "starred",
  "pobi.savedIds": "saved",
  "pobi.dismissedIds": "dismissed",
};

// ---- read everything out of localStorage into a normalized shape ------------
export function readLocalState(): LocalState {
  const items: Record<string, ItemRow> = {};
  const ensure = (id: string): ItemRow =>
    (items[id] ||= {
      item_id: id,
      read: false,
      opened: false,
      starred: false,
      saved: false,
      dismissed: false,
      finished_at: null,
      takeaway: null,
      snapshot: null,
    });

  for (const key of SET_KEYS) {
    const flag = SET_TO_FLAG[key];
    for (const id of getJSON<string[]>(key, [])) ensure(id)[flag] = true as never;
  }

  const finished = getJSON<Record<string, FinishedNote>>(FINISHED_KEY, {});
  for (const [id, note] of Object.entries(finished)) {
    const row = ensure(id);
    row.read = true;
    row.snapshot = note;
    row.finished_at = note.readAt ?? row.finished_at;
    row.takeaway = note.takeaway ?? row.takeaway;
  }

  const prefs: Record<string, string> = {};
  for (const key of PREFS_KEYS) {
    const raw = getRaw(key);
    if (raw != null) prefs[key] = raw;
  }

  return {
    items,
    readStat: getJSON(READSTAT_KEY, {}),
    clickLog: getJSON(CLICKLOG_KEY, {}),
    prefs,
  };
}

// ---- merge (union / true-wins / max-wins) -----------------------------------
function mergeItems(
  a: Record<string, ItemRow>,
  b: Record<string, ItemRow>
): Record<string, ItemRow> {
  const out: Record<string, ItemRow> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id];
    const y = b[id];
    if (!x) { out[id] = y; continue; }
    if (!y) { out[id] = x; continue; }
    const finishedAt =
      [x.finished_at, y.finished_at].filter(Boolean).sort()[0] ?? null; // earliest
    const takeaway =
      (x.takeaway?.length ?? 0) >= (y.takeaway?.length ?? 0) ? x.takeaway : y.takeaway;
    out[id] = {
      item_id: id,
      read: x.read || y.read,
      opened: x.opened || y.opened,
      starred: x.starred || y.starred,
      saved: x.saved || y.saved,
      dismissed: x.dismissed || y.dismissed,
      finished_at: finishedAt,
      takeaway: takeaway ?? null,
      snapshot: x.snapshot ?? y.snapshot,
    };
  }
  return out;
}

function mergeReadStat(a: LocalState["readStat"], b: LocalState["readStat"]) {
  const out: LocalState["readStat"] = {};
  for (const date of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[date] ?? { read: 0, srcs: {} };
    const y = b[date] ?? { read: 0, srcs: {} };
    const srcs: Record<string, number> = {};
    for (const k of new Set([...Object.keys(x.srcs), ...Object.keys(y.srcs)])) {
      srcs[k] = Math.max(x.srcs[k] ?? 0, y.srcs[k] ?? 0);
    }
    out[date] = { read: Math.max(x.read, y.read), srcs };
  }
  return out;
}

function mergeClickLog(a: Record<string, number>, b: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const date of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[date] = Math.max(a[date] ?? 0, b[date] ?? 0);
  }
  return out;
}

function uniqArr(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}
function mergePrefValue(key: string, local: string | undefined, cloud: string | undefined): string | undefined {
  if (local == null) return cloud;
  if (cloud == null) return local;
  if (key === "pobi.lastSeenAt") return String(Math.max(Number(local) || 0, Number(cloud) || 0));
  if (key === "pobi.papersSeeded" || key === "pobi.watchlist.seeded") return "1";
  if (key === "pobi.sourceRenames") {
    try {
      return JSON.stringify({ ...JSON.parse(cloud), ...JSON.parse(local) });
    } catch { return local; }
  }
  if (key === "pobi.watchlist" || key === "pobi.disabledSources" || key === "pobi.sourceRemovals") {
    try {
      return JSON.stringify([...new Set([...uniqArr(JSON.parse(cloud)), ...uniqArr(JSON.parse(local))] as string[])]);
    } catch { return local; }
  }
  if (key === "pobi.sourceAdds") {
    try {
      const seen = new Set<string>();
      const merged = [...uniqArr(JSON.parse(local)), ...uniqArr(JSON.parse(cloud))].filter((x) => {
        const k = JSON.stringify(x);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return JSON.stringify(merged);
    } catch { return local; }
  }
  return local;
}

function mergePrefs(local: Record<string, string>, cloud: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const key of PREFS_KEYS) {
    const v = mergePrefValue(key, local[key], cloud[key]);
    if (v != null) out[key] = v;
  }
  return out;
}

function mergeState(local: LocalState, cloud: LocalState): LocalState {
  return {
    items: mergeItems(local.items, cloud.items),
    readStat: mergeReadStat(local.readStat, cloud.readStat),
    clickLog: mergeClickLog(local.clickLog, cloud.clickLog),
    prefs: mergePrefs(local.prefs, cloud.prefs),
  };
}

// ---- write merged state back into localStorage ------------------------------
function applyLocal(state: LocalState) {
  const sets: Record<string, string[]> = {
    "pobi.readIds": [], "pobi.openedIds": [], "pobi.starredIds": [],
    "pobi.savedIds": [], "pobi.dismissedIds": [],
  };
  const finished: Record<string, FinishedNote> = {};
  for (const row of Object.values(state.items)) {
    if (row.read) sets["pobi.readIds"].push(row.item_id);
    if (row.opened) sets["pobi.openedIds"].push(row.item_id);
    if (row.starred) sets["pobi.starredIds"].push(row.item_id);
    if (row.saved) sets["pobi.savedIds"].push(row.item_id);
    if (row.dismissed) sets["pobi.dismissedIds"].push(row.item_id);
    if (row.snapshot) {
      finished[row.item_id] = {
        ...row.snapshot,
        id: row.item_id,
        takeaway: row.takeaway ?? row.snapshot.takeaway ?? "",
        readAt: row.finished_at ?? row.snapshot.readAt,
      };
    }
  }
  for (const [key, arr] of Object.entries(sets)) setRaw(key, JSON.stringify(arr));
  setRaw(FINISHED_KEY, JSON.stringify(finished));
  setRaw(READSTAT_KEY, JSON.stringify(state.readStat));
  setRaw(CLICKLOG_KEY, JSON.stringify(state.clickLog));
  for (const key of PREFS_KEYS) {
    if (state.prefs[key] != null) setRaw(key, state.prefs[key]);
  }
}

// ---- cloud I/O --------------------------------------------------------------
async function pullCloud(sb: SupabaseClient, userId: string): Promise<LocalState> {
  const empty: LocalState = { items: {}, readStat: {}, clickLog: {}, prefs: {} };
  const [itemsRes, statsRes, prefsRes] = await Promise.all([
    sb.from("item_state").select("*").eq("user_id", userId),
    sb.from("user_stats").select("read_stat, click_log").eq("user_id", userId).maybeSingle(),
    sb.from("user_prefs").select("prefs").eq("user_id", userId).maybeSingle(),
  ]);
  const items: Record<string, ItemRow> = {};
  for (const r of (itemsRes.data ?? []) as ItemRow[]) items[r.item_id] = r;
  return {
    items,
    readStat: (statsRes.data?.read_stat as LocalState["readStat"]) ?? empty.readStat,
    clickLog: (statsRes.data?.click_log as LocalState["clickLog"]) ?? empty.clickLog,
    prefs: (prefsRes.data?.prefs as Record<string, string>) ?? empty.prefs,
  };
}

async function pushCloud(sb: SupabaseClient, userId: string, state: LocalState) {
  const rows = Object.values(state.items).map((r) => ({ ...r, user_id: userId }));
  await Promise.all([
    rows.length
      ? sb.from("item_state").upsert(rows, { onConflict: "user_id,item_id" })
      : Promise.resolve(),
    sb.from("user_stats").upsert(
      { user_id: userId, read_stat: state.readStat, click_log: state.clickLog },
      { onConflict: "user_id" }
    ),
    sb.from("user_prefs").upsert(
      { user_id: userId, prefs: state.prefs },
      { onConflict: "user_id" }
    ),
  ]);
}

// ---- public API -------------------------------------------------------------
// Login / load: pull cloud, merge with local, write merged locally, push merged
// back up. After this resolves, the UI can read localStorage and see synced data.
export async function syncOnLoad(sb: SupabaseClient, userId: string): Promise<void> {
  const local = readLocalState();
  const cloud = await pullCloud(sb, userId);
  const merged = mergeState(local, cloud);
  applyLocal(merged);
  await pushCloud(sb, userId, merged);
}

// Ongoing: upload current local state (idempotent upsert). Cheap to call often.
export async function pushNow(sb: SupabaseClient, userId: string): Promise<void> {
  await pushCloud(sb, userId, readLocalState());
}
