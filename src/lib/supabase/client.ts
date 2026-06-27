// Browser-side Supabase client (singleton). Safe to import in client components.
// Uses the publishable/anon key — all access is gated by Row-Level Security.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Returns null when env isn't configured yet, so the app degrades gracefully to
// localStorage-only (anonymous) mode instead of crashing.
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!cached) cached = createBrowserClient(url, key);
  return cached;
}
