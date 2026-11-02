/**
 * One interface over three providers, all called directly from the phone:
 *   OpenAI (ChatGPT)  — Responses API          (openai.ts)
 *   Anthropic (Claude) — Messages API
 *   Google (Gemini)    — generateContent API
 * The conversation history is shared, so you can switch AI mid-conversation.
 */
import {askOpenAI, buildInstructions, OpenAIError, type AskResult, type FetchLike} from "./openai"
import type {Message, Settings} from "./store"
import {detectLang} from "./voice"

export type Provider = "openai" | "anthropic" | "gemini"
export const PROVIDER_IDS: Provider[] = ["openai", "anthropic", "gemini"]

export interface ModelInfo {
  id: string
  label: string
}

export interface ProviderInfo {
  /** Name people use for the assistant. */
  label: string
  /** Company, for key-related messages. */
  company: string
  keyField: "apiKey" | "anthropicKey" | "geminiKey"
  modelField: "model" | "anthropicModel" | "geminiModel"
  keyPlaceholder: string
  keyWhere: string
  models: ModelInfo[]
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  openai: {
    label: "ChatGPT",
    company: "OpenAI",
    keyField: "apiKey",
    modelField: "model",
    keyPlaceholder: "sk-…",
    keyWhere: "platform.openai.com → API keys",
    models: [
      {id: "gpt-6.1-terra", label: "GPT‑6.1 Terra"},
      {id: "gpt-6-luna", label: "GPT‑6 Luna"},
      {id: "gpt-6.1-sol", label: "GPT‑6.1 Sol"},
      {id: "gpt-6-astra", label: "GPT‑6 Astra"},
    ],
  },
  anthropic: {
    label: "Claude",
    company: "Anthropic",
    keyField: "anthropicKey",
    modelField: "anthropicModel",
    keyPlaceholder: "sk-ant-…",
    keyWhere: "console.anthropic.com → API Keys",
    models: [
      {id: "claude-haiku-5-5", label: "Haiku 5.5"},
      {id: "claude-sonnet-5-5", label: "Sonnet 5.5"},
      {id: "claude-opus-5-5", label: "Opus 5.5"},
      {id: "claude-fable-5-1", label: "Fable 5.1"},
    ],
  },
  gemini: {
    label: "Gemini",
    company: "Google",
    keyField: "geminiKey",
    modelField: "geminiModel",
    keyPlaceholder: "AIza…",
    keyWhere: "aistudio.google.com → Get API key",
    models: [
      {id: "gemini-3.8-flash", label: "3.8 Flash"},
      {id: "gemini-3.5-flash-lite", label: "3.5 Flash‑Lite"},
      {id: "gemini-4-argon", label: "4 Argon"},
    ],
  },
}

export function asProvider(v: unknown): Provider {
  return v === "anthropic" || v === "gemini" ? v : "openai"
}

export function keyFor(s: Settings, p: Provider): string {
  return String(s[PROVIDERS[p].keyField] ?? "")
}

export function modelFor(s: Settings, p: Provider): string {
  return String(s[PROVIDERS[p].modelField] ?? "")
}

export function modelLabel(p: Provider, id: string): string {
  return PROVIDERS[p].models.find((m) => m.id === id)?.label ?? id
}

/** "Claude Haiku 5.5", "ChatGPT GPT‑6.1 Terra", "Gemini 3.8 Flash". */
export function displayName(s: Settings, p: Provider): string {
  return `${PROVIDERS[p].label} ${modelLabel(p, modelFor(s, p))}`
}

// ───────────────────────── errors ─────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: Provider,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = "LLMError"
  }
}

/** Short Russian explanation for the glasses. */
export function explainLLMError(p: Provider, status: number, code: string, message: string): string {
  const name = p === "openai" ? "OpenAI" : PROVIDERS[p].label
  const m = (message || "").toLowerCase()
  const c = (code || "").toLowerCase()
  if (c === "no_key") return `Нет ключа ${name}. Добавьте его в настройках приложения.`
  if (c === "timeout") return `${name} не ответил вовремя. Повторите вопрос.`
  if (status === 0) return `Нет связи с ${name}. Проверьте интернет на телефоне.`
  if (status === 401 || c === "authentication_error" || /api key not valid|invalid api key|invalid x-api-key/.test(m))
    return `Ключ ${name} не принят. Проверьте ключ в настройках.`
  if (c === "insufficient_quota" || /credit balance|billing|insufficient.*(funds|credit)/.test(m) || (p === "openai" && m.includes("quota")))
    return p === "openai"
      ? "На счёте OpenAI API нет средств. Пополните баланс на platform.openai.com."
      : `На счёте ${name} нет средств. Пополните баланс у ${PROVIDERS[p].company}.`
  if (p === "gemini" && (status === 429 || c === "resource_exhausted"))
    return "Лимит Gemini исчерпан. Подождите минуту или подключите оплату в Google AI Studio."
  if (status === 529 || c === "overloaded_error") return `${name} сейчас перегружен. Повторите через минуту.`
  if (status === 429) return `${name} просит подождать (лимит запросов). Повторите через минуту.`
  if (status === 404 || c === "model_not_found" || c === "not_found_error" || c === "not_found")
    return "Модель недоступна для вашего ключа. Выберите другую в настройках."
  if (status === 403) return `Доступ запрещён: проверьте ключ и права ${name}.`
  if (status >= 500) return `Сбой на стороне ${name}. Повторите вопрос.`
  return `Ошибка ${name} ${status}${code ? " (" + code + ")" : ""}.`
}

// ───────────────────────── shared helpers ─────────────────────────

/** History in strict user/assistant alternation, starting with a user turn (Claude and Gemini require it). */
export function alternatingHistory(history: Message[], limit: number): Message[] {
  const recent = limit > 0 ? history.slice(-limit) : []
  const out: Message[] = []
  for (const m of recent) {
    if (!out.length && m.role !== "user") continue
    if (out.length && out[out.length - 1].role === m.role) {
      out[out.length - 1] = {...out[out.length - 1], content: out[out.length - 1].content + "\n" + m.content}
    } else out.push(m)
  }
  if (out.length && out[out.length - 1].role === "user") out.pop() // the new question follows
  return out
}

function maxTokens(s: Settings): number {
  const base = Math.min(8000, Math.max(1024, s.answerWords * 12))
  if (s.effort === "high") return Math.max(base, 16000)
  if (s.effort === "medium") return Math.max(base, 8000)
  return base
}

interface HttpOpts {
  /** Replaces the assistant's system prompt (lecture notes, audience questions). */
  system?: string
  timeoutMs?: number
  setTimer?: typeof setTimeout
  now?: () => number
}

async function post(
  p: Provider,
  fetchFn: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: HttpOpts,
): Promise<{ok: boolean; status: number; raw: string}> {
  const setTimer = opts.setTimer ?? setTimeout
  const req = fetchFn(url, {method: "POST", headers, body: JSON.stringify(body)})
  let res
  try {
    res = await new Promise<Awaited<typeof req>>((resolve, reject) => {
      const t = setTimer(() => reject(new LLMError("timeout", p, 0, "timeout")), opts.timeoutMs ?? 60000)
      req.then(
        (v) => {
          clearTimeout(t as any)
          resolve(v)
        },
        (e) => {
          clearTimeout(t as any)
          reject(e)
        },
      )
    })
  } catch (e) {
    if (e instanceof LLMError) throw e
    throw new LLMError(String((e as Error)?.message ?? e), p, 0, "network")
  }
  return {ok: res.ok, status: res.status, raw: await res.text()}
}

function parseJson(p: Provider, status: number, raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    throw new LLMError(`bad json: ${raw.slice(0, 200)}`, p, status, "bad_json")
  }
}

// ───────────────────────── Anthropic (Claude) ─────────────────────────

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
export const ANTHROPIC_VERSION = "2023-06-01"

/** Thinking/effort fields for fast voice answers (Haiku/Sonnet can skip thinking; Opus/Fable always think). */
export function anthropicReasoning(s: Settings): Record<string, unknown> {
  const m = s.anthropicModel.toLowerCase()
  if (s.effort === "auto" || s.effort === "none") {
    if (m.includes("haiku")) return {thinking: {type: "disabled"}, output_config: {effort: "low"}}
    if (m.includes("sonnet")) return {thinking: {type: "between_tools"}, output_config: {effort: "low"}}
    return {output_config: {effort: "low"}}
  }
  return {output_config: {effort: s.effort}}
}

export function buildAnthropicBody(
  s: Settings,
  history: Message[],
  question: string,
  opts: {includeReasoning?: boolean; now?: Date; system?: string} = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: s.anthropicModel,
    max_tokens: maxTokens(s),
    system: opts.system ?? buildInstructions(s, opts.now, detectLang(question)),
    messages: [
      ...alternatingHistory(history, s.historyMessages).map((m) => ({role: m.role, content: m.content})),
      {role: "user", content: question},
    ],
  }
  if (opts.includeReasoning !== false) Object.assign(body, anthropicReasoning(s))
  if (s.webSearch) body.tools = [{type: "web_search_20250305", name: "web_search", max_uses: 3}]
  return body
}

/** The answer text; with web search, only the text after the last search result. */
export function extractAnthropicText(data: any): string {
  const blocks: any[] = Array.isArray(data?.content) ? data.content : []
  let start = 0
  blocks.forEach((b, i) => {
    if (b?.type === "web_search_tool_result") start = i + 1
  })
  const tail = blocks.slice(start).filter((b) => b?.type === "text" && typeof b.text === "string")
  const use = tail.length ? tail : blocks.filter((b) => b?.type === "text" && typeof b.text === "string")
  return use
    .map((b) => b.text)
    .join("")
    .trim()
}

async function askAnthropic(fetchFn: FetchLike, s: Settings, history: Message[], q: string, opts: HttpOpts): Promise<AskResult> {
  const key = s.anthropicKey
  if (!key) throw new LLMError("no key", "anthropic", 401, "no_key")
  const headers = {"content-type": "application/json", "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION}
  let r = await post("anthropic", fetchFn, ANTHROPIC_URL, headers, buildAnthropicBody(s, history, q, {system: opts.system}), opts)
  if (!r.ok && r.status === 400 && /thinking|effort|output_config/i.test(r.raw)) {
    r = await post("anthropic", fetchFn, ANTHROPIC_URL, headers, buildAnthropicBody(s, history, q, {includeReasoning: false, system: opts.system}), opts)
  }
  const data = parseJson("anthropic", r.status, r.raw)
  if (!r.ok) {
    throw new LLMError(String(data?.error?.message ?? r.raw.slice(0, 300)), "anthropic", r.status, String(data?.error?.type ?? ""))
  }
  const text = extractAnthropicText(data)
  if (!text) throw new LLMError(`empty answer (${data?.stop_reason ?? "?"})`, "anthropic", r.status, "empty")
  return {
    text,
    ms: 0,
    model: String(data?.model ?? s.anthropicModel),
    usage: {input_tokens: data?.usage?.input_tokens, output_tokens: data?.usage?.output_tokens},
  }
}

// ───────────────────────── Google (Gemini) ─────────────────────────

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/"

export function geminiThinkingLevel(s: Settings): string {
  if (s.effort === "low" || s.effort === "medium" || s.effort === "high") return s.effort
  // fastest level each model accepts: Flash‑Lite supports "minimal", 3.8 Flash and Argon start at "low"
  return s.geminiModel.toLowerCase().includes("lite") ? "minimal" : "low"
}

export function buildGeminiBody(
  s: Settings,
  history: Message[],
  question: string,
  opts: {includeReasoning?: boolean; now?: Date; system?: string} = {},
): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {maxOutputTokens: maxTokens(s)}
  if (opts.includeReasoning !== false) generationConfig.thinkingConfig = {thinkingLevel: geminiThinkingLevel(s)}
  const body: Record<string, unknown> = {
    systemInstruction: {parts: [{text: opts.system ?? buildInstructions(s, opts.now, detectLang(question))}]},
    contents: [
      ...alternatingHistory(history, s.historyMessages).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{text: m.content}],
      })),
      {role: "user", parts: [{text: question}]},
    ],
    generationConfig,
  }
  if (s.webSearch) body.tools = [{google_search: {}}]
  return body
}

export function extractGeminiText(data: any): string {
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? []
  return parts
    .filter((p) => p && !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim()
}

async function askGemini(fetchFn: FetchLike, s: Settings, history: Message[], q: string, opts: HttpOpts): Promise<AskResult> {
  const key = s.geminiKey
  if (!key) throw new LLMError("no key", "gemini", 401, "no_key")
  const url = `${GEMINI_BASE}${encodeURIComponent(s.geminiModel)}:generateContent`
  const headers = {"Content-Type": "application/json", "x-goog-api-key": key}
  let r = await post("gemini", fetchFn, url, headers, buildGeminiBody(s, history, q, {system: opts.system}), opts)
  if (!r.ok && r.status === 400 && /thinking/i.test(r.raw)) {
    r = await post("gemini", fetchFn, url, headers, buildGeminiBody(s, history, q, {includeReasoning: false, system: opts.system}), opts)
  }
  const data = parseJson("gemini", r.status, r.raw)
  if (!r.ok) {
    throw new LLMError(String(data?.error?.message ?? r.raw.slice(0, 300)), "gemini", r.status, String(data?.error?.status ?? ""))
  }
  const text = extractGeminiText(data)
  if (!text) {
    const reason = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason ?? "?"
    throw new LLMError(`empty answer (${reason})`, "gemini", r.status, "empty")
  }
  const u = data?.usageMetadata ?? {}
  return {
    text,
    ms: 0,
    model: String(data?.modelVersion ?? s.geminiModel),
    usage: {input_tokens: u.promptTokenCount, output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)},
  }
}

// ───────────────────────── dispatcher ─────────────────────────

export async function askLLM(
  fetchFn: FetchLike,
  s: Settings,
  provider: Provider,
  history: Message[],
  question: string,
  opts: HttpOpts = {},
): Promise<AskResult & {provider: Provider}> {
  const now = opts.now ?? Date.now
  const started = now()
  try {
    let res: AskResult
    if (provider === "anthropic") res = await askAnthropic(fetchFn, s, history, question, opts)
    else if (provider === "gemini") res = await askGemini(fetchFn, s, history, question, opts)
    else res = await askOpenAI(fetchFn, s, history, question, opts)
    return {...res, ms: now() - started, provider}
  } catch (e) {
    if (e instanceof LLMError) throw e
    if (e instanceof OpenAIError) throw new LLMError(e.message, "openai", e.status, e.code)
    throw new LLMError(String((e as Error)?.message ?? e), provider, 0, "network")
  }
}
