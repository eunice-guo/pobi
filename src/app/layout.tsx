import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "破壁 · GlobalInfo — 中美投资信息差",
  description:
    "面向有经验的中文投资者：把可信的英文一手信源（X / Substack / 业绩记录）忠实翻译成中文，按持仓筛选。帮你看懂，不给买卖建议。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
