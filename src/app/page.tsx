import DigestFeed from "@/components/DigestFeed";
import Disclaimer from "@/components/Disclaimer";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          破壁 <span className="text-2xl font-normal" style={{ color: "var(--ink-soft)" }}>· GlobalInfo</span>
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          打破中美投资信息差。可信英文一手信源（X / Substack / 业绩记录）→ 忠实中文翻译 + 摘要，按持仓筛选。
        </p>
      </header>

      <DigestFeed />
      <Disclaimer />
    </main>
  );
}
