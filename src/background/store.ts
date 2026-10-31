/** Settings and conversation history, persisted in the miniapp's own localStorage on the phone. */

export type ListenMode = "wake" | "always" | "off"
export type Effort = "auto" | "none" | "low" | "medium" | "high"
export type SttLanguage = "ru-RU" | "auto"

export interface Settings {
  apiKey: string
  model: string
  effort: Effort
  aboutMe: string
  instructions: string
  wakeWords: string[]
  listenMode: ListenMode
  sttLanguage: SttLanguage
  answerWords: number
  historyMessages: number
  webSearch: boolean
  /** Seconds per screen for automatic page turning; 0 = only by voice. */
  autoAdvanceSec: number
  /** Clear the glasses this many seconds after the last page was shown; 0 = keep. */
  clearAfterSec: number
  /** Seconds after an answer during which a question needs no wake phrase; 0 = off. */
  followUpSec: number
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "gpt-6.1-terra",
  effort: "auto",
  aboutMe: "",
  instructions: "",
  wakeWords: ["вопрос", "ассистент", "джипити", "чат джипити", "чат gpt", "chat gpt", "chatgpt", "гпт"],
  listenMode: "wake",
  sttLanguage: "ru-RU",
  answerWords: 60,
  historyMessages: 20,
  webSearch: false,
  autoAdvanceSec: 0,
  clearAfterSec: 90,
  followUpSec: 0,
}

export interface Message {
  role: "user" | "assistant"
  content: string
  at: number
}

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const SETTINGS_KEY = "g1gpt.settings.v1"
const HISTORY_KEY = "g1gpt.history.v1"

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10)
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizeSettings(raw: Partial<Settings> | null | undefined, base: Settings = DEFAULT_SETTINGS): Settings {
  const r = raw ?? {}
  const pick = <K extends keyof Settings>(k: K): Settings[K] => (r[k] !== undefined ? (r[k] as Settings[K]) : base[k])
  const wake = pick("wakeWords")
  const wakeWords = (Array.isArray(wake) ? wake : String(wake).split(","))
    .map((w) => String(w).trim())
    .filter(Boolean)
    .slice(0, 20)
  const listenMode = pick("listenMode")
  const effort = pick("effort")
  const stt = pick("sttLanguage")
  return {
    apiKey: String(pick("apiKey") ?? "").trim(),
    model: String(pick("model") || DEFAULT_SETTINGS.model).trim(),
    effort: (["auto", "none", "low", "medium", "high"] as Effort[]).includes(effort) ? effort : "auto",
    aboutMe: String(pick("aboutMe") ?? "").slice(0, 4000),
    instructions: String(pick("instructions") ?? "").slice(0, 4000),
    wakeWords: wakeWords.length ? wakeWords : DEFAULT_SETTINGS.wakeWords,
    listenMode: (["wake", "always", "off"] as ListenMode[]).includes(listenMode) ? listenMode : "wake",
    sttLanguage: stt === "auto" ? "auto" : "ru-RU",
    answerWords: clampInt(pick("answerWords"), 15, 400, DEFAULT_SETTINGS.answerWords),
    historyMessages: clampInt(pick("historyMessages"), 0, 60, DEFAULT_SETTINGS.historyMessages),
    webSearch: Boolean(pick("webSearch")),
    autoAdvanceSec: clampInt(pick("autoAdvanceSec"), 0, 60, 0),
    clearAfterSec: clampInt(pick("clearAfterSec"), 0, 3600, DEFAULT_SETTINGS.clearAfterSec),
    followUpSec: clampInt(pick("followUpSec"), 0, 120, 0),
  }
}

export class Store {
  constructor(private readonly kv: KV | null) {}

  private read<T>(key: string): T | null {
    try {
      const s = this.kv?.getItem(key)
      return s ? (JSON.parse(s) as T) : null
    } catch {
      return null
    }
  }

  private write(key: string, value: unknown): void {
    try {
      this.kv?.setItem(key, JSON.stringify(value))
    } catch {
      // storage full or unavailable: keep working in memory
    }
  }

  loadSettings(): Settings {
    return normalizeSettings(this.read<Partial<Settings>>(SETTINGS_KEY))
  }

  saveSettings(s: Settings): void {
    this.write(SETTINGS_KEY, s)
  }

  loadHistory(): Message[] {
    const h = this.read<Message[]>(HISTORY_KEY)
    return Array.isArray(h) ? h.filter((m) => m && typeof m.content === "string") : []
  }

  saveHistory(h: Message[]): void {
    // keep at most 200 messages on disk; only the last N go to the model
    this.write(HISTORY_KEY, h.slice(-200))
  }
}
