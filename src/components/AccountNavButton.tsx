"use client";
// Account entry point for the app nav. Shows the user's Google avatar + name
// when signed in (with a "已同步" hint), or a "登录" prompt when signed out.
// Links to /account for sign-in/out. Two shapes: "rail" (desktop) / "icon" (mobile).
import Link from "next/link";
import { useUser } from "@/lib/auth";

function Person({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="5" r="2.4" />
      <path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" />
    </svg>
  );
}

export function AccountNavButton({ variant }: { variant: "rail" | "icon" }) {
  const { user } = useUser();
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = user?.user_metadata?.full_name as string | undefined;
  const name = fullName?.split(" ")[0];

  if (variant === "icon") {
    return (
      <Link
        href="/account"
        aria-label={user ? "我的账户" : "登录"}
        style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", textDecoration: "none", flex: "0 0 auto", overflow: "hidden" }}
      >
        {user && avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" width={34} height={34} style={{ borderRadius: 999, objectFit: "cover" }} />
        ) : (
          <Person size={15} />
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, textDecoration: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 500, border: "1px solid var(--line)", marginTop: 8 }}
    >
      {user && avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" width={18} height={18} style={{ borderRadius: 999, objectFit: "cover", flex: "0 0 auto" }} />
      ) : (
        <Person size={14} />
      )}
      {user ? name || "我的账户" : "登录"}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)", marginLeft: "auto" }}>
        {user ? "已同步" : "Sign in"}
      </span>
    </Link>
  );
}
