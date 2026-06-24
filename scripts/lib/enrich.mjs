// Enrichment: faithful Chinese translation + concise summary + ticker tags.
// Runs on OpenRouter's FREE model chain (zero cost) — mirrors the proven
// fallback+retry pattern from the morning-builders digest. Fidelity-first:
// translate faithfully, do NOT invent a merged "consensus".
// Gated by the caller on OPENROUTER_API_KEY.

// Free models, tried in order. Free providers get busy → 429 is retryable; we
// fall through to the next model on hard failure. Override the primary with
// ENRICH_MODEL (it's prepended to the chain).
const FREE_MODELS = [
  "openai/gpt-oss-120b:free", // primary: clean, fast, bilingual
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];
const MAX_RETRIES_PER_MODEL = 2;
const MAX_TOKENS = 4096; // full-length faithful translation, not a half

const SYSTEM = `你是中美投资信息差的翻译与摘要助手。给你一段英文投资观点（来自 X 或 Substack），你要：
1) summaryZh：1-3 句中文摘要，点明"在说什么 + 为什么对投资者重要"。客观，不加买卖建议。
2) translationZh：忠实的中文全文翻译，保留原意与语气，不增删观点、不编造。术语首次出现就地用括号简释。**必须保留原文的段落结构：每个自然段之间空一行（用 \n\n 分段），不要把全文挤成一整块**，确保可读性。
3) topics：3-6 个用于知识图谱连接的简洁主题标签（中文优先，如 ["世界模型","推理算力","私募信贷","AI 资本开支"]）。
要选**跨文章可共享的概念/主题**（投资主题、技术方向、宏观议题），不要太具体、不要写公司名（公司用 tickers）。无则空数组 []。
4) tickers：文中提及或直接相关的美股 / 中概股代码数组（大写，如 ["NVDA","TSM","BABA"]）。
包括以中英文公司名出现、但有对应美股代码的。重点龙头务必命中：
苹果→AAPL，微软→MSFT，谷歌/Alphabet→GOOGL，亚马逊→AMZN，英伟达→NVDA，Meta/脸书→META，
特斯拉→TSLA，AMD/超威→AMD，台积电→TSM，比亚迪→BYDDY，阿里巴巴→BABA，腾讯→TCEHY。
未上市但极具影响力的科技龙头用约定俗成的伪代码：SpaceX/星链/Starlink→SPACEX，OpenAI→OPENAI，
xAI→XAI，Anthropic→ANTHROPIC。无对应代码的未上市公司（如宁德时代A股）则不放。
仍宁缺毋滥，但不要漏掉明确点名的龙头公司。无则空数组 []。
只输出 JSON：{"summaryZh":"...","translationZh":"...","topics":["..."],"tickers":["..."]}。不要任何额外文字。`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Strips chain-of-thought wrappers some reasoning models leak into content.
function cleanOutput(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
}

// Pulls the JSON object out of a model reply. Free models wrap JSON in ```fences,
// add prose, or append a stray brace / second object — so we scan for the FIRST
// brace-balanced object (string- and escape-aware) rather than first{…last}.
function extractJson(raw) {
  const s = cleanOutput(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = s.indexOf("{");
  if (start === -1) return JSON.parse(s); // let it throw with context
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  return JSON.parse(s.slice(start)); // unbalanced — throw with context
}

async function callModel(apiKey, model, userText) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 90_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/eunice-guo/pobi",
        "X-Title": "Pobi GlobalInfo", // ASCII only — HTTP headers are Latin-1
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userText },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      return { retryable: res.status === 429, status: res.status, retryAfter, error: errText };
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return { retryable: false, status: 200, error: "empty content" };
    return { content };
  } catch (err) {
    return { retryable: true, status: 0, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// Tries each model in order; retries transient 429s; falls through on hard
// failure. Returns the raw model text, or throws if every model fails.
async function callLLM(apiKey, models, userText) {
  const failures = [];
  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      const r = await callModel(apiKey, model, userText);
      if (r.content) return { content: r.content, model };
      failures.push(`${model} -> HTTP ${r.status}`);
      if (r.retryable && attempt < MAX_RETRIES_PER_MODEL) {
        await sleep(Math.min((r.retryAfter || 2) * 1000, 8000));
        continue;
      }
      break; // non-retryable or out of attempts → next model
    }
  }
  throw new Error(`all enrich models failed: ${failures.join("; ")}`);
}

export function makeEnricher() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  // ENRICH_MODEL (if set) jumps the queue; de-dup against the default chain.
  const override = process.env.ENRICH_MODEL?.trim();
  const models = override
    ? [override, ...FREE_MODELS.filter((m) => m !== override)]
    : FREE_MODELS;

  return async function enrich(item) {
    const userText =
      (item.title ? `标题：${item.title}\n\n` : "") + `正文：${item.textEn}`;
    const { content, model } = await callLLM(apiKey, models, userText);
    const parsed = extractJson(content);
    return {
      ...item,
      summaryZh: parsed.summaryZh || null,
      translationZh: parsed.translationZh || null,
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
        : [],
      tickers: Array.isArray(parsed.tickers)
        ? parsed.tickers.map((t) => String(t).toUpperCase())
        : [],
      enriched: true,
      enrichModel: model,
    };
  };
}
