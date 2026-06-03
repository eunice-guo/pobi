// Claude enrichment: faithful Chinese translation + concise summary + ticker tags.
// Fidelity-first — translate faithfully, do NOT invent a merged "consensus".
// Gated by the caller on ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ENRICH_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM = `你是中美投资信息差的翻译与摘要助手。给你一段英文投资观点（来自 X 或 Substack），你要：
1) summaryZh：1-3 句中文摘要，点明"在说什么 + 为什么对投资者重要"。客观，不加买卖建议。
2) translationZh：忠实的中文全文翻译，保留原意与语气，不增删观点、不编造。术语首次出现就地用括号简释。
3) tickers：文中明确提及的美股代码数组（大写，如 ["NVDA","TSM"]）。不确定就不要放，宁缺毋滥。
只输出 JSON：{"summaryZh":"...","translationZh":"...","tickers":["..."]}。不要任何额外文字。`;

export function makeEnricher() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });

  return async function enrich(item) {
    const userText =
      (item.title ? `标题：${item.title}\n\n` : "") + `正文：${item.textEn}`;
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const raw = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(json);
    return {
      ...item,
      summaryZh: parsed.summaryZh || null,
      translationZh: parsed.translationZh || null,
      tickers: Array.isArray(parsed.tickers) ? parsed.tickers.map((t) => String(t).toUpperCase()) : [],
      enriched: true,
    };
  };
}
