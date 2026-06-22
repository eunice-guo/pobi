import type { Metadata } from "next";
import { Newsreader, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Option C design system — editorial serif (Newsreader + Noto Serif SC) for
// titles & reading body, a humanist sans (Instrument Sans + Noto Sans SC) for
// chrome, and IBM Plex Mono for timestamps/eyebrows. The Latin faces load via
// next/font; the CJK companions (Noto Serif/Sans SC) load via the <link> below
// (next/font can't preload the chinese-simplified subset), with Songti/PingFang
// as the system fallback.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});
const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "破壁 · GlobalInfo — 每日跟踪",
  description:
    "面向有经验的中文投资者：把可信的英文一手信源（X / Substack / 业绩记录 / 资管观点 / 播客访谈 / 收藏）忠实翻译成中文并摘要，按来源跟踪每日动态。帮你看懂，不给买卖建议。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${newsreader.variable} ${instrument.variable} ${plexMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&family=Noto+Serif+SC:wght@500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
