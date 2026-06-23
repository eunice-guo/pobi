// 破壁 GlobalInfo — shared UI atoms, ported 1:1 from the design reference
// (reference/shared.jsx). Consume the CSS custom properties in globals.css.

export function PBBrand({ size = 30 }: { size?: number }) {
  // "The Open Ring" mark: a near-complete circle opened at the top-right with a
  // seal-red dot flowing out of the gap (破壁 — information crossing the wall).
  // Per the brand handoff, the ring stroke thickens as it scales down so it stays
  // legible, and the dot diameter equals the stroke weight (dropped below ~18px).
  const sw = size <= 16 ? 14 : size <= 24 ? 12 : size <= 40 ? 11 : 9;
  const showDot = size >= 18;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.34 }}>
      <svg width={size} height={size} viewBox="12 12 76 76" fill="none" style={{ flex: "0 0 auto" }} aria-hidden>
        <path d="M71 27 A30 30 0 1 0 80 50" fill="none" stroke="var(--ink)" strokeWidth={sw} strokeLinecap="round" />
        {showDot && <circle cx="75.5" cy="38.5" r={sw / 2} fill="var(--seal)" />}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: size * 0.6, color: "var(--ink)", letterSpacing: "0.02em" }}>
          破壁
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: size * 0.3,
            letterSpacing: "0.18em",
            color: "var(--faint)",
            textTransform: "uppercase",
            marginTop: size * 0.12,
          }}
        >
          GlobalInfo
        </span>
      </div>
    </div>
  );
}

// Rounded-square monogram tinted per source.
export function PBAvatar({ initials, tint, size = 36 }: { initials: string; tint: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        flex: "0 0 auto",
        background: tint,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        fontSize: size * 0.4,
        letterSpacing: "0.01em",
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

// 业绩记录 reads as the cinnabar accent; X gets an ink dot; others stay quiet.
export function PBPlatform({ name }: { name: string }) {
  const isTrack = name === "业绩记录";
  const isX = name === "X";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flex: "0 0 auto",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: isTrack ? "var(--seal)" : "var(--muted)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          flex: "0 0 auto",
          background: isTrack ? "var(--seal)" : isX ? "var(--ink)" : "var(--faint)",
        }}
      />
      {name}
    </span>
  );
}

// "忠实翻译 · 非投资建议" — the product's standing promise. compact = inline pill.
export function PBDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 999,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--muted)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--seal)", flex: "0 0 auto" }} />
        忠实翻译 · 非投资建议
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--seal)", flex: "0 0 auto" }} />
      所有内容均为二手观点并链接原文 · 忠实翻译 + 摘要 · 不构成投资建议
    </span>
  );
}
