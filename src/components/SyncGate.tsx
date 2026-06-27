"use client";
// Wraps the whole app. When signed in, it merges cloud ⇄ local once before
// revealing the UI (so components read synced data), then keeps mirroring local
// changes up to the cloud. When signed out, it's a transparent pass-through.
import { useEffect, useRef, useState } from "react";
import { PBBrand } from "@/components/pb";
import { useUser } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase/client";
import { pushNow, syncOnLoad } from "@/lib/sync";

export default function SyncGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current) return;
    const sb = supabaseBrowser();
    if (!user || !sb) {
      setReady(true); // anonymous / unconfigured → behave exactly like before
      return;
    }
    started.current = true;
    const userId = user.id;

    // Initial merge, with a safety timeout so a slow network can't trap the app.
    const sync = syncOnLoad(sb, userId).catch((e) =>
      console.warn("pobi sync failed", e)
    );
    const timeout = new Promise<boolean>((r) => setTimeout(() => r(true), 6000));
    Promise.race([sync.then(() => false), timeout]).then((timedOut) => {
      setReady(true);
      if (timedOut) {
        // Finished after we already revealed local data → reload once to show merge.
        sync.then(() => {
          try {
            if (!sessionStorage.getItem("pobi.syncReloaded")) {
              sessionStorage.setItem("pobi.syncReloaded", "1");
              window.location.reload();
            }
          } catch {
            /* ignore */
          }
        });
      }
    });

    // Ongoing: mirror local writes up to the cloud (debounced) + on tab-hide + periodically.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => pushNow(sb, userId).catch(() => {}), 2500);
    };

    // Patch setItem once so any component's pobi.* write triggers a push.
    type Patchable = Storage & { __pobiPatched?: boolean };
    const ls = window.localStorage as Patchable;
    if (!ls.__pobiPatched) {
      const orig = ls.setItem.bind(ls);
      ls.setItem = (k: string, v: string) => {
        orig(k, v);
        if (typeof k === "string" && k.startsWith("pobi.")) schedule();
      };
      ls.__pobiPatched = true;
    }

    const onHide = () => {
      if (document.visibilityState === "hidden") pushNow(sb, userId).catch(() => {});
    };
    document.addEventListener("visibilitychange", onHide);
    const interval = setInterval(() => pushNow(sb, userId).catch(() => {}), 30000);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
      clearInterval(interval);
    };
  }, [user, loading]);

  if (ready) return <>{children}</>;

  // Brief sync screen — only shown to signed-in users during the first merge.
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "var(--paper)",
      }}
    >
      <PBBrand size={36} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--faint)" }}>
        正在同步…
      </span>
    </div>
  );
}
