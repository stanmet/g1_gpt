/** Settings and conversation history, persisted in the miniapp's own localStorage on the phone. */

import type {LectureRecord} from "./lecture"
import type {NavTrip} from "./navigator"
export type ListenMode = "wake" | "always" | "off"
export type Effort = "auto" | "none" | "low" | "medium" | "high"
export type SttLanguage = "ru-RU" | "auto"
export type TranslateTarget = "ru-RU" | "en-US"
export type ProviderId = "openai" | "anthropic" | "gemini"

export interface Settings {
  /** Which AI answers by default: ChatGPT, Claude or Gemini. */
  provider: ProviderId
  /** OpenAI key (name kept for compatibility with saved settings). */
  apiKey: string
  anthropicKey: string
  geminiKey: string
  /** OpenAI model. */
  model: string
  anthropicModel: string
  geminiModel: string
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
  /** Look up (G1 head-up sensor) to show the next page of a long answer. */
  headNod: boolean
  /**
   * Commands without the activator only from the voice that last said the activator (Mentra's
   * speaker labels; experimental). The activator itself always works.
   */
  voiceLock: boolean
  /** Seconds after an answer during which a question needs no wake phrase; 0 = off. */
  followUpSec: number
  /** Live translation ("транслейт") target language; also the language of lecture notes. */
  translateTo: TranslateTarget
  /** Lecture mode: key points about every N seconds. */
  lectureEverySec: number
  /** Conversation mode: a proactive hint about every N seconds of talk; 0 = only answers to questions. */
  talkEverySec: number
  /** Conversation mode: what the user wants from the conversation; steers «Спроси»/«Скажи». */
  talkGoal: string
  /** Navigator: how to travel when the command does not say («пешком», «на машине»). */
  navMode: NavMode
  /** Settings schema version, for one-time migrations of stored settings. */
  v: number
}

export type NavMode = "walking" | "driving" | "cycling"

export const SETTINGS_VERSION = 2

const OLD_DEFAULT_WAKE = ["вопрос", "ассистент", "джипити", "чат джипити", "чат gpt", "chat gpt", "chatgpt", "гпт"]

export const DEFAULT_SETTINGS: Settings = {
  provider: "openai",
  apiKey: "",
  anthropicKey: "",
  geminiKey: "",
  model: "gpt-6.1-terra",
  anthropicModel: "claude-haiku-5-5",
  geminiModel: "gemini-3.8-flash",
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
  headNod: true,
  voiceLock: false,
  followUpSec: 0,
  translateTo: "ru-RU",
  lectureEverySec: 15,
  talkEverySec: 10,
  talkGoal: "",
  navMode: "walking",
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
  /** Which AI wrote an assistant message ("openai" | "anthropic" | "gemini"). */
  by?: ProviderId
}

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Values are stored as "~g1:" + JSON. Mentra 3.2.1 on iOS bridges localStorage through
 * a polyfill that JSON-parses whatever native returns and drops anything that is not a
 * string — so a plain JSON value ('{"apiKey":…}') was saved but read back as null,
 * and settings (with the API keys) were lost on every Mentra restart. The prefix makes
 * the stored text non-JSON, so it comes back intact.
 */
const STORE_PREFIX = "~g1:"
const PROBE_KEY = "g1gpt.probe"
const SETTINGS_KEY = "g1gpt.settings.v1"
const HISTORY_KEY = "g1gpt.history.v1"
const LECTURE_KEY = "g1gpt.lecture.v1"
const TALK_KEY = "g1gpt.talk.v1"
const NAV_KEY = "g1gpt.nav.v1"

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
  const provider = pick("provider")
  return {
    provider: provider === "anthropic" || provider === "gemini" ? provider : "openai",
    apiKey: String(pick("apiKey") ?? "").trim(),
    anthropicKey: String(pick("anthropicKey") ?? "").trim(),
    geminiKey: String(pick("geminiKey") ?? "").trim(),
    model: String(pick("model") || DEFAULT_SETTINGS.model).trim(),
    anthropicModel: String(pick("anthropicModel") || DEFAULT_SETTINGS.anthropicModel).trim(),
    geminiModel: String(pick("geminiModel") || DEFAULT_SETTINGS.geminiModel).trim(),
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
    headNod: pick("headNod") !== false,
    voiceLock: pick("voiceLock") === true,
    followUpSec: clampInt(pick("followUpSec"), 0, 120, 0),
    translateTo: pick("translateTo") === "en-US" ? "en-US" : "ru-RU",
    lectureEverySec: clampInt(pick("lectureEverySec"), 10, 60, DEFAULT_SETTINGS.lectureEverySec),
    talkEverySec: clampInt(pick("talkEverySec"), 0, 60, DEFAULT_SETTINGS.talkEverySec),
    talkGoal: String(pick("talkGoal") ?? "").trim().slice(0, 300),
    navMode: (["walking", "driving", "cycling"] as NavMode[]).includes(pick("navMode")) ? pick("navMode") : "walking",
    v: SETTINGS_VERSION,
  }
}

export class Store {
  constructor(private readonly kv: KV | null) {}

  private read<T>(key: string): T | null {
    try {
      const s = this.kv?.getItem(key)
      if (typeof s !== "string" || !s) return null
      return JSON.parse(s.startsWith(STORE_PREFIX) ? s.slice(STORE_PREFIX.length) : s) as T
    } catch {
      return null
    }
  }

  private write(key: string, value: unknown): void {
    try {
      this.kv?.setItem(key, STORE_PREFIX + JSON.stringify(value))
    } catch {
      // storage full or unavailable: keep working in memory
    }
  }

  /** Write and read back a value, to confirm that saved settings survive a restart. */
  selfTest(): boolean {
    if (!this.kv) return false
    try {
      this.write(PROBE_KEY, {ok: 1, at: Date.now()})
      return this.read<{ok: number}>(PROBE_KEY)?.ok === 1
    } catch {
      return false
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

  /** Notes of the last lecture (lecture mode), kept until the next one starts. */
  loadLecture(): LectureRecord | null {
    const r = this.read<LectureRecord>(LECTURE_KEY)
    return r && typeof r.startedAt === "number" && Array.isArray(r.notes) ? r : null
  }

  saveLecture(r: LectureRecord): void {
    this.write(LECTURE_KEY, r)
  }

  /** Hints of the last conversation (conversation mode). */
  loadTalk(): LectureRecord | null {
    const r = this.read<LectureRecord>(TALK_KEY)
    return r && typeof r.startedAt === "number" && Array.isArray(r.notes) ? r : null
  }

  saveTalk(r: LectureRecord): void {
    this.write(TALK_KEY, r)
  }

  /** The running navigator trip, if any. */
  loadNav(): NavTrip | null {
    const t = this.read<NavTrip>(NAV_KEY)
    const d = t?.dest
    return t && d && typeof d.name === "string" && Number.isFinite(d.lat) && Number.isFinite(d.lng) && typeof t.startedAt === "number" ? t : null
  }

  saveNav(t: NavTrip | null): void {
    if (t) this.write(NAV_KEY, t)
    else {
      try {
        this.kv?.removeItem(NAV_KEY)
      } catch {
        // ignore
      }
    }
  }
}
