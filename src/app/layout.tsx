import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Editorial almanac serif for display + a terminal mono for tickers/dates.
// CJK falls back to PingFang/Songti (these Latin fonts carry no Han glyphs).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jb",
  display: "swap",
});

export const metadata: Metadata = {
  title: "破壁 · GlobalInfo — 中美投资信息差",
  description:
    "面向有经验的中文投资者：把可信的英文一手信源（X / Substack / 业绩记录）忠实翻译成中文，按 watchlist 跟踪。帮你看懂，不给买卖建议。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${fraunces.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
