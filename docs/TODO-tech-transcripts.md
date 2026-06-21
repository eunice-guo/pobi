# TODO · 看 tech 公司 transcript（财报电话会 / IR 转录）

> 目标：让 App 能看到科技公司的 earnings call transcript —— 忠实翻译成中文 + 摘要，
> 按持仓 ticker 筛选。沿用 Zara 两段式：重活在 builder 里跑，App 只读静态 JSON。
>
> 现状：`transcript` channel 已在类型与 spec 里定义，但 **builder 尚未接线**
> （见 `scripts/generate-feed.mjs:63` 的 `transcripts: not yet wired`）。
>
> 设计依据：`docs/specs/2026-06-03-pobi-info-gap-design.md` §5.3 / §12（v1 scope）。
> 红线：官方 API / 公开数据，不爬墙、不绕 paywall；二手观点明确标注；不给买卖建议。

---

## 0. 决策（先定后做）

- [ ] **transcript 数据源选型**。候选：
  - 公司 IR 页 / EDGAR 8-K 附件（合规、免费，但 transcript 不是必披露项，覆盖不全）
  - 第三方 API（如 API Ninjas / Financial Modeling Prep / Seeking Alpha）—— 看 ToS 与成本
  - 决定：v1 先做哪一个？（建议先 EDGAR + IR，零成本起步）
- [ ] **覆盖范围**：哪些 tech 公司？建议绑定 watchlist ticker + 一个种子清单
      （NVDA / TSM / MSFT / GOOGL / AMD / AVGO …）。
- [ ] **触发时机**：每日 cron 全量扫，还是只在 earnings date 前后窗口拉？
      （spec §5.3：watchlist tickers around earnings dates。）

## 1. 数据层 / 类型

- [ ] 复用 `src/lib/types.ts` 里现有的 `channel: "transcript"`，确认 `FeedItem` 字段够用
      （transcript 可能需要 `title`=「{公司} {季度} Earnings Call」、`tickers`、`publishedAt`=会议日期）。
- [ ] 在 `src/data/sources.json` 增加 transcript 源条目（`channel: "transcript"`），
      schema 与现有一致：`{ handle, displayName, channel, priority, sectors[], enabled }`。
      `handle` 可放 ticker 或 IR/EDGAR 标识。

## 2. Builder：接线 transcript ingestion

- [ ] 新建 `scripts/lib/transcript.mjs`，导出 `fetchTranscripts(sources, sinceMs)`，
      返回 `FeedItem[]`（与 `fetchSubstack` / `fetchX` 同形状）。
  - [ ] 从选定数据源拉取 transcript 原文（英文）
  - [ ] normalize 成 `FeedItem`：`id = "transcript:{ticker}:{date}"`，`url` 指向原始 IR/EDGAR 页
  - [ ] 长文处理：截断 `textEn`（参考其它 channel 的截断逻辑），全文留给 enrich 阶段
- [ ] 在 `scripts/generate-feed.mjs` 把第 63-64 行的占位 note 换成真实调用：
  - [ ] `import { fetchTranscripts } from "./lib/transcript.mjs";`
  - [ ] 过滤 `sources.filter(s => s.channel === "transcript")`，try/catch + push 到 `items`，
        失败时 `notes.push(...)`（对齐 substack/x 的错误处理风格）
  - [ ] 数据源缺 key/不可用时整段跳过并记 note（对齐 X 的 token-gating 模式）

## 3. Enrichment（已有，确认兼容）

- [ ] 确认 `scripts/lib/enrich.mjs` 对 transcript 长文本能跑：忠实中文翻译 + TL;DR 摘要 + ticker 标注。
- [ ] transcript 远长于推文 —— 评估是否需要分段 / 单独的 prompt / 调高 `MAX_ENRICH` 预算或单独限量。
- [ ] 成本守护：transcript 条数少但 token 大，确认不会炸预算（必要时给 transcript 单独的截断/采样）。

## 4. App：展示

- [ ] `src/components/ItemCard.tsx`：给 `channel === "transcript"` 加 badge（如「财报电话会」），
      复用现有 中文摘要 → 展开忠实翻译 → 链接原文 的卡片结构。
- [ ] 确认 `src/components/DigestFeed.tsx` / `Watchlist.tsx` 的 ticker 筛选对 transcript item 生效。
- [ ] （可选）`src/components/Calendar.tsx`：如果有 earnings calendar，把 transcript 与财报日关联。

## 5. 验证 / 收尾

- [ ] 本地跑通：`node --env-file=.env.local scripts/generate-feed.mjs`，确认 `public/feed/latest.json`
      里出现 `channel: "transcript"` 的 item，且 `notes` 不再有 "not yet wired"。
- [ ] `npm run dev` 看卡片渲染、翻译、ticker 筛选正常。
- [ ] `npm run lint` 通过。
- [ ] 更新 `README.md`（架构段落把 transcript 从 phase 2 / 待办挪到已实现）与
      `docs/specs/...` 的 scope 状态。
- [ ] `.env.example` / GitHub Actions secrets：若新数据源需要 key，补上并文档化（沿用 gating 写法）。

---

### 备注
- 合规优先：只用官方 / 公开来源，永远链接原文、标注二手观点。
- 增量交付：先让**一个** tech 公司的一份 transcript 端到端跑通（拉取→翻译→卡片），再扩源。
