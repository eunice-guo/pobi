import DigestFeed from "@/components/DigestFeed";
import Disclaimer from "@/components/Disclaimer";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-9 sm:px-8">
      <header className="mb-8 border-b pb-6" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[44px] font-semibold leading-none tracking-tight">
              破壁
              <span className="ml-2 align-middle font-mono text-sm font-normal uppercase tracking-[0.2em]" style={{ color: "var(--teal)" }}>
                GlobalInfo
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              打破中美投资信息差。可信英文一手信源（X / Substack / 业绩记录 / 资管观点）→ 忠实中文翻译 + 摘要，
              按 watchlist 跟踪每日动态,业绩记录可加入待读清单。
            </p>
          </div>
          <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] sm:block" style={{ color: "var(--ink-faint)" }}>
            不给买卖建议
          </span>
        </div>
      </header>

      <DigestFeed />
      <Disclaimer />
    </main>
  );
}
