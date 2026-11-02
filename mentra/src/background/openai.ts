/** OpenAI Responses API call, made directly from the phone (no server in between). */
import type {Message, Settings} from "./store"
import {detectLang, type Lang} from "./voice"

export const OPENAI_URL = "https://api.openai.com/v1/responses"

export type FetchLike = (
  url: string,
  init: {method: string; headers: Record<string, string>; body: string; signal?: unknown},
) => Promise<{ok: boolean; status: number; text(): Promise<string>}>

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

/** Local date/time without Intl (the background runtime is a bare JS engine). */
export function localDateTime(d: Date = new Date()): string {
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"]
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? "+" : "-"
  const tz = `UTC${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} (${days[d.getDay()]}, ${tz})`
}

export function buildInstructions(s: Settings, now: Date = new Date(), questionLang: Lang = "ru"): string {
  const parts = [
    "Ты — голосовой помощник. Твои ответы показываются на крошечном дисплее умных очков Even Realities G1: 5 строк примерно по 30 символов, монохромный текст. Пользователь не видит телефон.",
    "Отвечай на том же языке, на котором задан последний вопрос: на русский вопрос — по-русски, на английский — по-английски (English question → answer in English). Если пользователь прямо попросил другой язык — используй его.",
    "Пиши обычным текстом без Markdown: без заголовков, звёздочек, таблиц, ссылок, эмодзи и блоков кода.",
    `Начинай сразу с сути, без вступлений и повторения вопроса. По умолчанию уложись примерно в ${s.answerWords} слов. Если пользователь просит подробнее или вопрос этого требует — можно длиннее, короткими абзацами.`,
    "Списки оформляй короткими строками, каждая начинается с «• ». Числа пиши цифрами.",
    "Вопрос получен через распознавание речи и может содержать ошибки — угадывай смысл по контексту.",
    "Старайся отвечать сразу, без встречных вопросов: если чего-то не хватает (например, города отправления), сделай разумное предположение — по сведениям о пользователе, если они есть, — коротко назови его и ответь. Переспрашивай, только если без уточнения ответ бесполезен, и тогда задай один короткий вопрос.",
    "Учитывай предыдущие реплики разговора: пользователь может задавать уточняющие вопросы.",
    `Текущие дата и время у пользователя: ${localDateTime(now)}.`,
  ]
  if (s.aboutMe.trim()) parts.push(`Что известно о пользователе (учитывай, когда уместно):\n${s.aboutMe.trim()}`)
  if (s.instructions.trim()) parts.push(`Дополнительные пожелания пользователя:\n${s.instructions.trim()}`)
  // Explicit per-question language, so a Russian system prompt never pulls an English answer into Russian.
  parts.push(
    questionLang === "en"
      ? "The latest question was asked in English. Answer in English (unless the user explicitly asks for another language)."
      : "Последний вопрос задан по-русски — отвечай по-русски (если пользователь прямо не попросил другой язык).",
  )
  return parts.join("\n\n")
}

/** Reasoning effort to send, or null to omit the parameter. */
export function effortFor(s: Settings): string | null {
  if (s.effort !== "auto") return s.effort
  const m = s.model.toLowerCase()
  // Fast answers matter more than deep thinking for voice. Sol does not accept "none".
  if (m.includes("terra") || m.includes("luna")) return "none"
  if (m.includes("sol") || m.includes("astra")) return "low"
  return null
}

export function buildRequestBody(
  s: Settings,
  history: Message[],
  question: string,
  opts: {includeReasoning?: boolean; now?: Date; system?: string} = {},
): Record<string, unknown> {
  const recent = s.historyMessages > 0 ? history.slice(-s.historyMessages) : []
  const input = [
    ...recent.map((m) => ({role: m.role, content: m.content})),
    {role: "user", content: question},
  ]
  const body: Record<string, unknown> = {
    model: s.model,
    instructions: opts.system ?? buildInstructions(s, opts.now, detectLang(question)),
    input,
    store: false,
    max_output_tokens: Math.min(8000, Math.max(600, s.answerWords * 12)),
  }
  const effort = effortFor(s)
  if (effort && opts.includeReasoning !== false) body.reasoning = {effort}
  if (s.webSearch) body.tools = [{type: "web_search"}]
  return body
}

/** Extract the answer text from a Responses API result. */
export function extractText(data: any): string {
  if (data && typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim()
  const out: string[] = []
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== "message") continue
    for (const c of Array.isArray(item.content) ? item.content : []) {
      if ((c?.type === "output_text" || c?.type === "text") && typeof c.text === "string") out.push(c.text)
    }
  }
  return out.join("\n").trim()
}

export class OpenAIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly raw: string,
  ) {
    super(message)
    this.name = "OpenAIError"
  }
}

/** Human-readable (Russian) explanation for an API failure, short enough for the glasses. */
export function explainError(status: number, code: string, message: string): string {
  const m = (message || "").toLowerCase()
  if (status === 0) return "Нет связи с OpenAI. Проверьте интернет на телефоне."
  if (status === 401) return "Ключ OpenAI не принят. Проверьте ключ в настройках."
  if (code === "insufficient_quota" || m.includes("quota") || m.includes("billing"))
    return "На счёте OpenAI API нет средств. Пополните баланс на platform.openai.com."
  if (status === 429) return "OpenAI просит подождать (лимит запросов). Повторите через минуту."
  if (status === 404 || code === "model_not_found") return "Модель недоступна для вашего ключа. Выберите другую в настройках."
  if (status === 403) return "Доступ запрещён: проверьте права ключа и проекта OpenAI."
  if (status >= 500) return "Сбой на стороне OpenAI. Повторите вопрос."
  return `Ошибка OpenAI ${status}${code ? " (" + code + ")" : ""}.`
}

function parseError(status: number, raw: string): OpenAIError {
  let code = ""
  let message = raw.slice(0, 300)
  try {
    const j = JSON.parse(raw)
    code = String(j?.error?.code ?? j?.error?.type ?? "")
    message = String(j?.error?.message ?? message)
  } catch {
    // not JSON
  }
  return new OpenAIError(message, status, code, raw.slice(0, 1000))
}

function withTimeout<T>(p: Promise<T>, ms: number, setTimer: typeof setTimeout): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimer(() => reject(new OpenAIError("timeout", 0, "timeout", "")), ms)
    p.then(
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
}

export interface AskResult {
  text: string
  ms: number
  model: string
  usage?: {input_tokens?: number; output_tokens?: number}
}

export async function askOpenAI(
  fetchFn: FetchLike,
  s: Settings,
  history: Message[],
  question: string,
  opts: {timeoutMs?: number; setTimer?: typeof setTimeout; now?: () => number; system?: string} = {},
): Promise<AskResult> {
  if (!s.apiKey) throw new OpenAIError("no key", 401, "no_key", "")
  const now = opts.now ?? Date.now
  const setTimer = opts.setTimer ?? setTimeout
  const started = now()

  const send = async (includeReasoning: boolean) => {
    const body = JSON.stringify(buildRequestBody(s, history, question, {includeReasoning, system: opts.system}))
    let res
    try {
      res = await withTimeout(
        fetchFn(OPENAI_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}`},
          body,
        }),
        opts.timeoutMs ?? 60000,
        setTimer,
      )
    } catch (e) {
      if (e instanceof OpenAIError) throw e
      throw new OpenAIError(String((e as Error)?.message ?? e), 0, "network", "")
    }
    const raw = await res.text()
    return {res, raw}
  }

  let {res, raw} = await send(true)
  // Some models reject the reasoning parameter (or a given effort value): retry once without it.
  if (!res.ok && res.status === 400 && /reasoning|effort/i.test(raw) && effortFor(s)) {
    ;({res, raw} = await send(false))
  }
  if (!res.ok) throw parseError(res.status, raw)

  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    throw new OpenAIError("bad json", res.status, "bad_json", raw.slice(0, 300))
  }
  const text = extractText(data)
  if (!text) {
    const reason = data?.incomplete_details?.reason ?? data?.status ?? "empty"
    throw new OpenAIError(`empty answer (${reason})`, res.status, "empty", raw.slice(0, 300))
  }
  return {text, ms: now() - started, model: String(data?.model ?? s.model), usage: data?.usage}
}
