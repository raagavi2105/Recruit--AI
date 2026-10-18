// src/lib/llm.js — server-only. Talks to any OpenAI-compatible chat API (Groq, OpenAI, OpenRouter,
// Together, Gemini's OpenAI endpoint, ...). Configure with LLM_API_KEY / LLM_BASE_URL / LLM_MODEL;
// GROQ_API_KEY is still honoured for backwards compatibility.

const KEY = () => process.env.LLM_API_KEY || process.env.GROQ_API_KEY || "";
const BASE = () => (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const MODEL = () => process.env.LLM_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const llmConfigured = () => Boolean(KEY());
export const llmModel = () => MODEL();

export function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

async function post(body) {
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY()}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) {
    const err = new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/** Ask the model for a JSON object. Throws if no key is configured or the reply is not valid JSON. */
export async function llmJSON({ system, user, maxTokens = 1800, temperature = 0.3 }) {
  if (!llmConfigured()) throw new Error("LLM not configured");
  const body = {
    model: MODEL(),
    temperature,
    // reasoning models (gpt-oss) spend part of max_tokens on hidden thinking, so leave headroom
    max_tokens: maxTokens + (/gpt-oss|qwen3/.test(MODEL()) ? 2000 : 0),
    ...(/gpt-oss/.test(MODEL()) ? { reasoning_effort: "low" } : {}),
    messages: [
      { role: "system", content: `${system}\n\nRespond with a single valid JSON object only. No markdown, no commentary.` },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  };
  let content;
  try {
    content = await post(body);
  } catch (e) {
    // some providers/models reject response_format — retry without it once
    if (e.status === 400) {
      delete body.response_format;
      content = await post(body);
    } else throw e;
  }
  const parsed = safeParseJSON(content);
  if (!parsed || typeof parsed !== "object") throw new Error("LLM returned non-JSON");
  return parsed;
}
