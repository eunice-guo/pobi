// 破壁 GlobalInfo — Option C shared presentation components.
// Ported from the design handoff (reference/shared.jsx): brand seal, source
// avatar, platform tag, and the standing disclaimer. Pure presentational.

export function PBBrand({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid shrink-0 place-items-center font-serif font-semibold text-[var(--paper)]"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.26,
          background: "var(--seal)",
          fontSize: size * 0.5,
          lineHeight: 1,
        }}
        aria-hidden
      >
        破
      </div>
      <div className="leading-none">
        <div className="font-serif text-[17px] font-semibold tracking-tight text-[var(--ink)]">破壁</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--faint)]">GlobalInfo</div>
      </div>
    </div>
  );
}

export function PBAvatar({
  initials,
  tint,
  size = 18,
}: {
  initials: string;
  tint: string;
  size?: number;
}) {
  return (
    <div
      className="grid shrink-0 place-items-center font-mono font-semibold uppercase text-[var(--surface)]"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: tint,
        fontSize: size * 0.42,
        lineHeight: 1,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function PBPlatform({ name, seal = false }: { name: string; seal?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em]"
      style={{ color: seal ? "var(--seal)" : "var(--faint)" }}
    >
      <span
        className="inline-block h-[5px] w-[5px] rounded-full"
        style={{ background: seal ? "var(--seal)" : "var(--line-strong)" }}
      />
      {name}
    </span>
  );
}

export function PBDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.04em]"
        style={{ borderColor: "var(--line)", color: "var(--muted)" }}
      >
        <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--seal)" }} />
        忠实翻译 · 非投资建议
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] tracking-[0.02em]" style={{ color: "var(--muted)" }}>
      忠实翻译 · 二手观点 · 永远链接原文 · 非投资建议
    </span>
  );
}
