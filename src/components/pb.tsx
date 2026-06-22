// 破壁 GlobalInfo — shared UI atoms, ported 1:1 from the design reference
// (reference/shared.jsx). Consume the CSS custom properties in globals.css.

export function PBBrand({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.34 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.2,
          flex: "0 0 auto",
          background: "var(--seal)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-serif)",
          fontWeight: 600,
          fontSize: size * 0.62,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}
        aria-hidden
      >
        破
      </div>
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
