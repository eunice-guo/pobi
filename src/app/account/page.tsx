"use client";
// Account / sign-in page. Google sign-in via Supabase; shows signed-in identity.
// Cross-device sync of reading data layers on top of this in the next step.
import { useEffect, useState } from "react";
import Link from "next/link";
import { PBBrand } from "@/components/pb";
import { useUser, signInWithGoogle, signOut } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AccountPage() {
  const { user, loading } = useUser();
  const configured = !!supabaseBrowser();
  const [authError, setAuthError] = useState(false);

  // Surface a failed sign-in passed back as ?auth_error=1.
  useEffect(() => {
    setAuthError(new URLSearchParams(window.location.search).has("auth_error"));
  }, []);

  // After sign-in, return to wherever the user started (saved before redirect).
  useEffect(() => {
    if (!user) return;
    let next: string | null = null;
    try {
      next = sessionStorage.getItem("pobi.authNext");
      sessionStorage.removeItem("pobi.authNext");
    } catch {
      /* ignore */
    }
    if (next && next !== "/account" && next.startsWith("/")) {
      window.location.replace(next);
    }
  }, [user]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--paper)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        gap: "1.75rem",
      }}
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <PBBrand size={40} />
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          border: "1px solid var(--line, rgba(0,0,0,0.08))",
          borderRadius: 16,
          padding: "1.75rem",
          background: "var(--card, #fff)",
          display: "flex",
          flexDirection: "column",
          gap: "1.1rem",
          textAlign: "center",
        }}
      >
        {!configured ? (
          <p style={{ fontFamily: "var(--font-serif)", color: "var(--faint)" }}>
            登录尚未配置。请稍后再试。
          </p>
        ) : loading ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--faint)", fontSize: 13 }}>
            加载中…
          </p>
        ) : user ? (
          <>
            {user.user_metadata?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.user_metadata.avatar_url as string}
                alt=""
                width={56}
                height={56}
                style={{ borderRadius: "50%", margin: "0 auto" }}
              />
            )}
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600 }}>
                {(user.user_metadata?.full_name as string) || "已登录"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--faint)", marginTop: 4 }}>
                {user.email}
              </div>
            </div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--faint)", lineHeight: 1.6 }}>
              ✓ 已登录。你的阅读记录即将跨设备同步。
            </p>
            <button onClick={() => signOut()} style={btn("ghost")}>
              退出登录
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, margin: 0 }}>
                登录 pobi
              </h1>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--faint)", marginTop: 8, lineHeight: 1.6 }}>
                登录后，你的已读 / 加星 / 待读 / 知识图谱将跨手机与电脑同步，并拥有你自己的订阅。
              </p>
            </div>
            {authError && (
              <p style={{ fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--seal)" }}>
                登录未完成，请重试。
              </p>
            )}
            <button onClick={() => signInWithGoogle()} style={btn("primary")}>
              <GoogleMark /> 使用 Google 登录
            </button>
          </>
        )}
      </div>

      <Link
        href="/"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--faint)", textDecoration: "none" }}
      >
        ← 返回阅读
      </Link>
    </main>
  );
}

function btn(kind: "primary" | "ghost"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "0.7rem 1rem",
    borderRadius: 10,
    fontFamily: "var(--font-sans, var(--font-serif))",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid var(--line, rgba(0,0,0,0.12))",
  };
  if (kind === "primary")
    return { ...base, background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" };
  return { ...base, background: "transparent", color: "var(--faint)" };
}

function GoogleMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 4.7 29.4 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 4.7 29.4 3 24 3 16 3 9.1 7.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.3 0 10.1-2 13.7-5.3l-6.3-5.4C29.3 35.9 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9 41.3 15.9 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.3 5.4C41.9 36.3 45 30.7 45 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
