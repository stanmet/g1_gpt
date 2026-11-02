/** Settings and conversation history, persisted in the miniapp's own localStorage on the phone. */

export type ListenMode = "wake" | "always" | "off"
export type Effort = "auto" | "none" | "low" | "medium" | "high"
export type SttLanguage = "ru-RU" | "auto"
export type TranslateTarget = "ru-RU" | "en-US"

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
  /** Live translation ("транслейт") target language. */
  translateTo: TranslateTarget
  /** Settings schema version, for one-time migrations of stored settings. */
  v: number
}

export const SETTINGS_VERSION = 2

const OLD_DEFAULT_WAKE = ["вопрос", "ассистент", "джипити", "чат джипити", "чат gpt", "chat gpt", "chatgpt", "гпт"]

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "gpt-6.1-terra",
  effort: "auto",
  aboutMe: "",
  instructions: "",
  wakeWords: ["вопрос", "ассистент", "джипити", "чат джипити", "чат gpt", "chat gpt", "chatgpt", "гпт", "question"],
  listenMode: "wake",
  // Russian + English with automatic detection, so questions in either language are recognized.
  sttLanguage: "auto",
  answerWords: 60,
  historyMessages: 20,
  webSearch: false,
  autoAdvanceSec: 0,
  clearAfterSec: 90,
  followUpSec: 0,
  translateTo: "ru-RU",
  v: SETTINGS_VERSION,
}

/** One-time upgrades of settings saved by older versions. */
export function migrateSettings(raw: Partial<Settings> | null | undefined): Partial<Settings> | null | undefined {
  if (!raw) return raw
  const r: Partial<Settings> = {...raw}
  if ((r.v ?? 1) < 2) {
    // v1 defaulted to Russian-only recognition; v2 understands English questions too.
    if (r.sttLanguage === "ru-RU" || r.sttLanguage === undefined) r.sttLanguage = "auto"
    const wake = Array.isArray(r.wakeWords) ? r.wakeWords : null
    if (wake && wake.length === OLD_DEFAULT_WAKE.length && wake.every((w, i) => w === OLD_DEFAULT_WAKE[i])) {
      r.wakeWords = [...wake, "question"]
    }
  }
  r.v = SETTINGS_VERSION
  return r
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
    sttLanguage: stt === "ru-RU" ? "ru-RU" : "auto",
    answerWords: clampInt(pick("answerWords"), 15, 400, DEFAULT_SETTINGS.answerWords),
    historyMessages: clampInt(pick("historyMessages"), 0, 60, DEFAULT_SETTINGS.historyMessages),
    webSearch: Boolean(pick("webSearch")),
    autoAdvanceSec: clampInt(pick("autoAdvanceSec"), 0, 60, 0),
    clearAfterSec: clampInt(pick("clearAfterSec"), 0, 3600, DEFAULT_SETTINGS.clearAfterSec),
    followUpSec: clampInt(pick("followUpSec"), 0, 120, 0),
    translateTo: pick("translateTo") === "en-US" ? "en-US" : "ru-RU",
    v: SETTINGS_VERSION,
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
    return normalizeSettings(migrateSettings(this.read<Partial<Settings>>(SETTINGS_KEY)))
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
