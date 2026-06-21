# TODO · 「今日待读」(Today to Read) + 资管研究信源

> **Feature 愿景（重新定义）**：用户打开 pobi 网站，首屏有一个「今日待读 / Today to Read」
> 板块（session），聚合两类必读：
> 1. **新的 earnings call**（科技公司财报电话会 transcript，忠实翻译 + 摘要）
> 2. **未读文章**（unread articles）—— 按真正的「已读/未读」状态，而非只看「自上次访问以来」
>
> **信源扩展**：除了现有的 Substack / X，新增 **头部资管的观点与研究洞察**
> （leading asset managers' opinion & research insight），如 **Carlyle、Bridgewater** 等。
>
> 沿用 Zara 两段式：重活在 builder 里跑，App 只读静态 JSON。
> 红线不变：官方 / 公开来源，不爬墙、不绕 paywall；二手观点明确标注；不给买卖建议。
>
> 设计依据：`docs/specs/2026-06-03-pobi-info-gap-design.md`。

---

## ✅ 本分支已实施（claude/tech-transcript-todo-list-al5tsa）

- **首屏「今日待读」**：新组件 `src/components/TodayToRead.tsx`，渲染在 `DigestFeed` 顶部。
  聚合未读项，财报电话会优先、其余按时间倒序；逐篇「已读/未读」状态存 localStorage
  `pobi.readIds`（点标题 / 译文 / 原文 / 「已读」按钮即标记已读，刷新后从清单移出）；
  支持 watchlist ticker 联动、「全部已读」、收起/展开、空态「今天的都读完了 ✓」。
- **资管研究 channel**：`Channel` 增加 `"research"`（`src/lib/types.ts`）；RSS 拉取器
  `scripts/lib/rss.mjs` 改为按 `source.channel` 通用化；`generate-feed.mjs` 把 substack +
  research 一起走 RSS 路径；`ItemCard` / `read` 页加「资管研究」「财报电话会」角标。
- **信源**：`sources.json` 新增 Apollo Academy（Torsten Sløk）、Oaktree（Howard Marks Memos）
  为 `research` 且 enabled；**Bridgewater / Carlyle 已登记但 enabled:false**（无公开 RSS，待补合规拉取路径）。
- 验证：`tsc --noEmit` 与 `next build` 均通过。

**仍待办**：① earnings call transcript 的 builder 接线（下方 C，仍是占位）；
② Bridgewater / Carlyle 等无 RSS 资管源的合规拉取路径（官方 API / 公开页，禁爬墙）。

---

## A. 「今日待读」首屏板块（核心）— ✅ 已实施

现状：`DigestFeed.tsx` 已有 `pobi.lastSeenAt` 时间戳 + `isNew()`（发布时间晚于上次访问就标新），
但**没有真正的逐篇「已读/未读」状态**，也没有独立的「今日待读」入口。

- [ ] **决策：定义「待读」**。建议 = 满足任一即进待读：
      (a) 新的 earnings call transcript；(b) 未读的文章。已读后移出列表。
- [ ] **逐篇已读状态**：在 localStorage 加 `pobi.readIds`（已读 item id 集合）。
      在 `DigestFeed.tsx` 读取/写入，替代/补充现有的 `pobi.lastSeenAt` 单时间戳逻辑。
  - [ ] 标记已读的时机：卡片展开看忠实翻译 / 点击原文链接时，把 `item.id` 写入 `readIds`。
  - [ ] （可选）「全部标为已读」按钮。
- [ ] **新组件 `src/components/TodayToRead.tsx`**：渲染在首屏顶部（`page.tsx` / `DigestFeed` 上方）。
  - [ ] 内容 = `items.filter(待读)`，置顶排序：新 earnings call 优先，其次未读文章，按时间倒序。
  - [ ] 复用 `ItemCard` 渲染；顶部显示待读计数（如「今日待读 · 7 条」）。
  - [ ] 空态：「今天的都读完了 ✓」。
  - [ ] 尊重 watchlist 筛选（与现有 `selected` ticker 联动，可选）。
- [ ] **earnings call 角标**：`ItemCard.tsx` 给 `channel === "transcript"` 加 badge（如「财报电话会」），
      让待读列表里一眼区分财报 vs 文章。

## B. 信源扩展：头部资管研究 / 观点

现状：`Channel = "x" | "substack" | "transcript"`（`src/lib/types.ts`）。资管研究形态不同（多为
官网 Insights 页 / PDF / LinkedIn 长文），需要单独的拉取路径。

- [ ] **决策：合规拉取路径**。资管研究常为客户 gated 或网页/PDF，**红线禁爬墙/绕 paywall**。
      逐源确认公开入口：
  - **Bridgewater** —「Research & Insights」公开文章页 / Ray Dalio 公开长文；查是否有 RSS。
  - **Carlyle** —「Insights / The Globalization of …」公开 Insights 页（Jason Thomas 经济展望）；查 RSS。
  - 其它候选：Oaktree（Howard Marks Memos，有公开 RSS，强烈推荐）、Apollo（Torsten Slok 每日图表）、
    KKR（Henry McVey Insights）、BlackRock Investment Institute。
  - [ ] 优先选**有公开 RSS / 公开 feed** 的源（如 Oaktree memos），无 RSS 的标记为后续/手动。
- [ ] **类型**：在 `src/lib/types.ts` 给 `Channel` 增加 `"research"`（资管研究/观点）。
- [ ] **sources.json**：新增 `channel: "research"` 条目，schema 不变
      `{ handle, displayName, channel, priority, sectors[], enabled }`。
      `sectors` 用如 `["MACRO"]` / `["ALLOCATION"]`。
- [ ] **Builder ingestion**：
  - [ ] 有 RSS 的资管源 → 直接复用 `scripts/lib/rss.mjs`（与 Substack 同路径，只是 channel 标 research）。
  - [ ] 无 RSS 的 → 评估官方 API / 公开 sitemap；没有合规入口就**先不接**，记 note。
  - [ ] 在 `generate-feed.mjs` 过滤并 push（对齐现有 substack/x 的 try/catch + notes 风格）。

## C. earnings call transcript（喂给「今日待读」的财报源）

现状：`transcript` channel 已在类型/spec 定义，但 builder 未接线
（`scripts/generate-feed.mjs:63` 的 `transcripts: not yet wired`）。

- [ ] **决策：transcript 数据源**。建议先 EDGAR / 公司 IR（零成本、合规）起步；
      覆盖 watchlist + 种子科技股（NVDA / TSM / MSFT / GOOGL / AMD / AVGO …）。
- [ ] **新建 `scripts/lib/transcript.mjs`**，导出 `fetchTranscripts(sources, sinceMs)` → `FeedItem[]`
      （与 `fetchSubstack` / `fetchX` 同形状）。
  - [ ] normalize：`id = "transcript:{ticker}:{date}"`，`title = "{公司} {季度} Earnings Call"`，
        `url` 指原始 IR/EDGAR 页，`publishedAt` = 会议日期。
  - [ ] 长文截断 `textEn`，全文留给 enrich。
- [ ] 在 `generate-feed.mjs` 把第 63-64 行占位 note 换成真实 `fetchTranscripts` 调用（含 token-gating / 错误处理）。

## D. Enrichment（已有，确认兼容长文）

- [ ] 确认 `scripts/lib/enrich.mjs` 对 transcript / 资管研究**长文本**能跑：忠实中文翻译 + TL;DR + ticker 标注。
- [ ] 评估分段 / 单独 prompt / 调整 `MAX_ENRICH` 预算（长文 token 大，单独限量避免炸成本）。

## E. 验证 / 收尾

- [ ] 本地跑通：`node --env-file=.env.local scripts/generate-feed.mjs`，确认 `public/feed/latest.json`
      出现 `channel: "transcript"` 与 `channel: "research"` 的 item，`notes` 不再有 "not yet wired"。
- [ ] `npm run dev`：首屏「今日待读」正确显示新 earnings call + 未读文章；展开后标记已读、刷新后从待读消失。
- [ ] `npm run lint` 通过。
- [ ] 更新 `README.md`（信源列表加资管研究 channel）与 `docs/specs/...`（scope 状态）。
- [ ] `.env.example` / Actions secrets：若新源需要 key，补上并文档化（沿用 gating 写法）。

---

### 备注
- **增量交付**：先让首屏「今日待读」用现有 Substack 文章 + 一个**有公开 RSS 的资管源**（如 Oaktree memos）
  端到端跑通已读/未读；再接 earnings transcript；最后扩到 gated/无 RSS 的资管源。
- 合规优先：只用官方 / 公开来源，永远链接原文、标注二手观点，不给买卖建议。
