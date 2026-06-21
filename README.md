# 破壁 · GlobalInfo

打破中美投资信息差。面向**有经验的中文投资者**：把可信的英文一手信源
（X / Substack / 业绩记录）**忠实翻译成中文 + 摘要**，按你的持仓筛选。

**这不是投资建议。** 所有内容均为二手观点、链接原文、绝不编造。

## 架构（Zara 两段式）

重活每天在受信任的定时任务里跑一次，App 只读静态 JSON。

1. **Builder**（GitHub Actions，每日）：`scripts/generate-feed.mjs`
   - Substack 免费 RSS（`scripts/lib/rss.mjs`）
   - X / Twitter 官方 API v2，**需要 `X_BEARER_TOKEN`，没有则整段跳过**（`scripts/lib/x.mjs`）
   - 业绩记录：phase 2，从 simple-research 移植 EDGAR
   - Claude 忠实翻译 + 摘要 + ticker 标注，**需要 `ANTHROPIC_API_KEY`，没有则输出英文原文 + 标"翻译待生成"**（`scripts/lib/enrich.mjs`）
   - 写入 `public/feed/{latest,YYYY-MM-DD,index}.json` 并 commit
   - 头部资管研究：公开 RSS（`channel: "research"`，与 Substack 同路径），如 Apollo Academy（Torsten Sløk）、Oaktree（Howard Marks Memos）。Bridgewater / Carlyle 无公开 RSS，已登记待补合规拉取路径。
2. **App**（Next.js）：读 `public/feed/latest.json`，首屏「今日待读」（新的财报电话会 + 未读文章，逐篇已读状态存 localStorage）+ 每日 digest + 持仓筛选（localStorage）+「自上次访问以来的新内容」标记。

信源在 `src/data/sources.json` —— 这是编辑性护城河，你来调。

## 本地运行

```bash
npm install
cp .env.example .env.local          # 填 ANTHROPIC_API_KEY（可选 X_BEARER_TOKEN）
node --env-file=.env.local scripts/generate-feed.mjs   # 生成 feed
npm run dev                          # http://localhost:3000
```

无任何 key 也能跑：免费 Substack RSS 照常抓，只是不翻译、X 跳过。

## 成本

- App + GitHub Actions + feed JSON：**$0**
- X：免费档读取上限太小，真正用要 **Basic 档（约 $200/月）**。这是你日后自己开的开关。
- Claude：仅在 builder 里调用，按条数计；`MAX_ENRICH` 限量、默认 Haiku 控成本。

## 红线

忠实翻译、绝不编造；永远链接原文、标注二手观点；不给买卖建议。
