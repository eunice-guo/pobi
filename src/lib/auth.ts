"use client";
// Client-side auth helpers: a useUser() hook plus Google sign-in / sign-out.
// Everything degrades to no-op when Supabase isn't configured (anonymous mode).
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange(
      (_e: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
      }
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export async function signInWithGoogle() {
  const sb = supabaseBrowser();
  if (!sb) return;
  // Remember where to return to AFTER login. Kept in sessionStorage (not as a
  // query param) because Supabase's redirect allowlist won't match callback
  // URLs that carry a query string — it would fall back to the Site URL.
  try {
    sessionStorage.setItem("pobi.authNext", window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function signOut() {
  const sb = supabaseBrowser();
  if (!sb) return;
  await sb.auth.signOut();
}
