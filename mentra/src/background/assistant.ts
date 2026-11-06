/**
 * The assistant's state machine, independent of Mentra so it can be tested with fakes.
 *
 * idle ──wake phrase──▶ capturing ──pause in speech──▶ thinking ──answer──▶ answering
 *   ▲                                                                           │
 *   └──────────── "скрой" / timeout / новый вопрос ◀───────────────────────────┘
 */
import {fitScreen, G1_LINES, paginate, sanitizeForG1, wrapLines} from "./g1text"
import {askLLM, asProvider, displayName, explainLLMError, keyFor, LLMError, PROVIDERS, type Provider} from "./llm"
import {Lecture, type LectureRecord} from "./lecture"
import {
  buildMapQueryPrompt,
  cleanMapQuery,
  explainNavError,
  modeLabel,
  Navigator,
  type NavHost,
  type NavScreenKind,
  type NavTrip,
  type Place,
  type PlaceSuggestion,
} from "./navigator"
import {buildPhrasePrompt, cleanPhraseReply} from "./phrase"
import {Talk} from "./talk"
import type {FetchLike} from "./openai"
import {normalizeSettings, Store, type Message, type Settings} from "./store"
import {
  detectLang,
  detectWake,
  isCommandPrefix,
  isMeaningful,
  normalize,
  parseCommand,
  parseLectureCommand,
  parseNavCommand,
  parsePhraseRequest,
  parseSwitchCommand,
  PHRASE_LANG_NAME,
  type PhraseLang,
  parseTalkCommand,
  parseTranslateCommand,
  aiForWakePhrase,
  AI_WAKE_WORDS,
  type TravelMode,
  type VoiceCommand,
} from "./voice"

export type Phase = "idle" | "capturing" | "thinking" | "answering" | "translating" | "lecture" | "talk"

export interface LogEntry {
  t: number
  kind: "stt" | "wake" | "cmd" | "ask" | "openai" | "display" | "error" | "info" | "touch" | "translate" | "head" | "lecture" | "talk" | "nav"
  msg: string
}

export interface DisplayResultInfo {
  status?: string
  degraded?: boolean
  reason?: string
}

/** One live-translation result from Mentra (interim results are replaced by the final one). */
export interface TranslationEvent {
  text: string
  isFinal: boolean
  sourceLanguage?: string
  targetLanguage?: string
  originalText?: string
  utteranceId?: string
  speakerId?: string
}

export interface AssistantDeps {
  show(text: string): Promise<DisplayResultInfo | void> | void
  /** Subscribe to live translation of everything the glasses hear into `target`; returns unsubscribe. */
  startTranslation?: (target: string, handler: (ev: TranslationEvent) => void) => () => void
  clear(): void
  fetch: FetchLike
  store: Store
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (id: unknown) => void
  onChange?: () => void
  /** Mentra's location, place search and navigator; absent where the host has no navigation. */
  nav?: NavHost
  /** A full-screen picture on the glasses (base64 G1 BMP) — the navigation map. */
  showBitmap?(base64: string): void
}

/** How long a pause in speech ends a question. */
export const SILENCE_MS = 1600
/** In translation mode, clear the glasses after this much silence (mode stays on). */
export const TRANSLATE_IDLE_MS = 20_000
const TRANSLATE_RENDER_MS = 350
const TRANSLATE_KEEP = 12

function primaryLang(tag?: string): string {
  return String(tag ?? "").toLowerCase().split(/[-_]/)[0]
}

/** Speech already in the target language (e.g. the wearer's own Russian) — not a translation. */
export function isPassthrough(ev: TranslationEvent, target: string): boolean {
  const src = primaryLang(ev.sourceLanguage)
  if (src && src !== "auto") return src === primaryLang(target)
  return !ev.originalText
}
/** After an answer that ends with a question, accept the reply without the wake phrase for this long. */
export const REPLY_WINDOW_SEC = 25

/** True if the last sentence of the text is a question. */
export function endsWithQuestion(text: string): boolean {
  const t = String(text ?? "").trim().replace(/[\s»")\]]+$/, "")
  return t.endsWith("?")
}
/** How long we wait for a question after a bare wake phrase. */
export const WAKE_WAIT_MS = 9000
const INTERIM_THROTTLE_MS = 450
const LOG_MAX = 150
/** Ignore repeated head-up events closer than this (sensor bounce). */
const NOD_DEBOUNCE_MS = 1200
/**
 * While Mentra thinks the head is up and its "Contextual Dashboard" is on, it shows its own
 * dashboard (time, date, battery) and holds back everything apps send. Head up for longer than
 * this means the answer the user waits for is not on the glasses.
 */
export const HEAD_UP_HIDES_MS = 4000
const DASHBOARD_WARN_EVERY_MS = 60_000
export const DASHBOARD_WARNING =
  "Mentra считает, что голова поднята, и показывает свою панель (время, заряд) вместо ответа. " +
  "Опустите голову. Если не помогает: Mentra → Settings → Dashboard → выключите Contextual Dashboard " +
  "или увеличьте Adjust Head-Up Angle."

/** After «Как будет на английском…» and a pause, the next phrase is taken as the word to translate. */
export const PHRASE_WAIT_MS = 8000

/** After «Навигатор» without a destination, the next phrase is taken as the place. */
export const NAV_WAIT_MS = 9000
/** A coming turn shown over an answer, notes or translation for this long. */
export const NAV_TURN_MS = 4500
/** «Ищу…», «Маршрут до…» stay on screen at most this long if Mentra does not answer. */
const NAV_BUSY_MS = 25_000
const NAV_MSG_MS = 6000
/** A trip saved longer ago than this is not resumed after a restart. */
const NAV_RESUME_MS = 3 * 3600_000

/** Where a paging command came from; shown in the log. key = Bluetooth remote or keyboard. */
export type CommandSource = "voice" | "ui" | "touch" | "head" | "key"

export class Assistant {
  settings: Settings
  history: Message[]
  phase: Phase = "idle"
  pages: string[] = []
  page = 0
  lastTranscript = ""
  lastQuestion = ""
  lastAnswer = ""
  lastError = ""
  glassesConnected: boolean | null = null
  log: LogEntry[] = []

  private committed: string[] = []
  private interim = ""
  private silenceTimer: unknown = null
  private wakeTimer: unknown = null
  private pageTimer: unknown = null
  private clearTimer_: unknown = null
  private lastInterimShow = 0
  private requestSeq = 0
  private followUpUntil = 0
  private captureIsReply = false
  /** AI chosen for the question being captured ("Клод, …"), or null for the default. */
  private captureProvider: Provider | null = null
  /** AI that wrote the last answer — a reply to its counter-question goes back to it. */
  private lastProvider: Provider | null = null
  // live translation state
  private translateUnsub: (() => void) | null = null
  private trFinals: string[] = []
  private trInterim: {id: string; text: string} | null = null
  private trLastRender = 0
  private trRenderTimer: unknown = null
  private trIdleTimer: unknown = null
  translationScreen = ""
  /** The answer was removed by the clear timer (not by the user), so paging may bring it back. */
  private autoHidden = false
  private lastNodAt = 0
  /** Last head position reported by Mentra (G1 head-up sensor); unknown until the first event. */
  headUp = false
  private headUpSince = 0
  private lastDashboardWarnAt = -Infinity
  private displayChecked = false
  /** Mentra's speaker label of the voice that last said the activator — taken to be the wearer's. */
  ownerVoice: string | null = null
  /** Waiting for the word after «Как будет на английском…» + pause. */
  private phraseWait: {lang: PhraseLang; until: number} | null = null
  /** Waiting for the place after «Навигатор». */
  private navWait: {mode: TravelMode | null; until: number} | null = null
  /** Turn-by-turn directions (Mentra's navigator) on the glasses. */
  readonly nav: Navigator
  /** Lecture mode: key points of what the lecturer says + answers to questions to the audience. */
  readonly lecture: Lecture
  /** Conversation mode: facts when someone asks, a prompt when the user trails off. */
  readonly talk: Talk

  private readonly now: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimerFn: (id: unknown) => void

  constructor(private readonly deps: AssistantDeps) {
    this.now = deps.now ?? Date.now
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimerFn = deps.clearTimer ?? ((id) => clearTimeout(id as any))
    this.settings = deps.store.loadSettings()
    this.history = deps.store.loadHistory()
    this.lecture = new Lecture(
      {
        complete: (system, user) => this.completeOnce(system, user),
        explainError: (e) => {
          const err = e as LLMError
          return explainLLMError(err?.provider ?? asProvider(this.settings.provider), Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""))
        },
        show: (t) => this.show(t),
        clear: () => this.clearDisplay(),
        log: (kind, msg) => this.addLog(kind, msg),
        lang: () => (this.settings.translateTo === "en-US" ? "en" : "ru"),
        everySec: () => this.settings.lectureEverySec,
        now: () => this.now(),
        setTimer: (fn, ms) => this.setTimer(fn, ms),
        clearTimer: (id) => this.clearTimerFn(id),
        save: (r) => this.deps.store.saveLecture(r),
        onChange: () => this.changed(),
      },
      deps.store.loadLecture(),
    )
    this.talk = new Talk(
      {
        complete: (system, user) => this.completeOnce(system, user),
        explainError: (e) => {
          const err = e as LLMError
          return explainLLMError(err?.provider ?? asProvider(this.settings.provider), Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""))
        },
        show: (t) => this.show(t),
        clear: () => this.clearDisplay(),
        log: (kind, msg) => this.addLog(kind, msg),
        now: () => this.now(),
        setTimer: (fn, ms) => this.setTimer(fn, ms),
        clearTimer: (id) => this.clearTimerFn(id),
        save: (r) => this.deps.store.saveTalk(r),
        onChange: () => this.changed(),
        everySec: () => this.settings.talkEverySec,
        goal: () => this.settings.talkGoal,
      },
      deps.store.loadTalk(),
    )
    this.nav = new Navigator({
      search: (q) => this.findPlace(q),
      start: (place, mode) =>
        deps.nav ? deps.nav.start(place, mode) : Promise.resolve({ok: false, error: "navigation adapter not configured"}),
      stop: () => deps.nav?.stop(),
      screen: (text, kind) => this.navScreen(text, kind),
      log: (kind, msg) => this.addLog(kind, msg),
      now: () => this.now(),
      setTimer: (fn, ms) => this.setTimer(fn, ms),
      clearTimer: (id) => this.clearTimerFn(id),
      onChange: () => this.changed(),
      save: (t) => deps.store.saveNav(t),
      ended: () => {
        if (this.phase === "idle" && this.clearTimer_ == null) this.clearDisplay()
      },
      mapOn: () => this.navMapOn(),
      roads: deps.nav?.roads ? (c, r, m) => deps.nav!.roads!(c, r, m) : undefined,
      watch: deps.nav?.watch ? (cb) => deps.nav!.watch!(cb) : undefined,
    })
  }

  /**
   * One request with its own system prompt and no conversation history (lecture mode).
   * Quick by design: no web search, light reasoning.
   */
  private async completeOnce(system: string, user: string): Promise<string> {
    const provider = asProvider(this.settings.provider)
    const quick: Settings = {
      ...this.settings,
      webSearch: false,
      historyMessages: 0,
      answerWords: 40,
      effort: this.settings.effort === "medium" || this.settings.effort === "high" ? "low" : this.settings.effort,
    }
    const res = await askLLM(this.deps.fetch, quick, provider, [], user, {
      system,
      timeoutMs: 30000,
      setTimer: ((fn: () => void, ms: number) => this.setTimer(fn, ms)) as unknown as typeof setTimeout,
      now: this.now,
    })
    const usage = res.usage ? `, токены ${res.usage.input_tokens ?? "?"}→${res.usage.output_tokens ?? "?"}` : ""
    this.addLog("openai", `${PROVIDERS[provider].label}: ${(res.ms / 1000).toFixed(1)} с (${res.model}${usage})`)
    return res.text
  }

  // ───────────────────────────── logging / UI ─────────────────────────────

  addLog(kind: LogEntry["kind"], msg: string): void {
    this.log.push({t: this.now(), kind, msg: msg.slice(0, 400)})
    if (this.log.length > LOG_MAX) this.log.splice(0, this.log.length - LOG_MAX)
    this.changed()
  }

  private changed(): void {
    try {
      this.deps.onChange?.()
    } catch {
      // UI may be closed
    }
  }

  /** The navigation screen is a picture with a map (setting, and a host that can show pictures). */
  navMapOn(): boolean {
    return this.settings.navMap && Boolean(this.deps.showBitmap)
  }

  /** The glasses show a picture now (the navigation map), not text. */
  glassesBitmap = false
  private lastBitmap = ""

  private showBitmap(b64: string): void {
    if (this.glassesBitmap && b64 === this.lastBitmap) return
    try {
      this.deps.showBitmap?.(b64)
    } catch (e) {
      this.addLog("error", `Дисплей (картинка): ${String((e as Error)?.message ?? e)}`)
      return
    }
    this.glassesBitmap = true
    this.lastBitmap = b64
    this.warnIfDashboard()
    this.changed()
  }

  /** The route on the glasses: the map picture, or text when the map is off. */
  private showRoute(): void {
    if (this.navMapOn() && this.nav.frame) this.showBitmap(this.nav.frame)
    else if (this.nav.screen) this.show(fitScreen(this.nav.screen))
  }

  private show(text: string): void {
    if (this.glassesBitmap) {
      this.glassesBitmap = false
      this.changed()
    }
    let r: Promise<DisplayResultInfo | void> | void
    try {
      r = this.deps.show(text)
    } catch (e) {
      this.addLog("error", `Дисплей: ${String((e as Error)?.message ?? e)}`)
      return
    }
    this.warnIfDashboard()
    if (r && typeof (r as Promise<unknown>).then === "function") {
      ;(r as Promise<DisplayResultInfo | void>).then(
        (res) => {
          if (!res) return
          if (res.status === "blocked") {
            this.addLog("display", `Дисплей занят другим приложением${res.reason ? ": " + res.reason : ""}`)
          } else if (!this.displayChecked && res.status) {
            this.displayChecked = true
            this.addLog("display", `Дисплей: ${res.status}${res.degraded ? " (текстовый режим G1)" : ""}`)
          }
        },
        () => {},
      )
    }
  }

  /** Nothing else to show: the glasses go blank, or show the route while a trip is on. */
  private clearDisplay(): void {
    if (this.nav.active && (this.nav.screen || (this.navMapOn() && this.nav.frame))) {
      this.showRoute()
      return
    }
    this.glassesBitmap = false
    try {
      this.deps.clear()
    } catch {
      // ignore
    }
  }

  private cancelTimer(name: "silenceTimer" | "wakeTimer" | "pageTimer" | "clearTimer_"): void {
    if (this[name] != null) {
      this.clearTimerFn(this[name])
      this[name] = null
    }
  }

  // ───────────────────────────── settings ─────────────────────────────

  updateSettings(patch: Partial<Settings>): Settings {
    const merged = normalizeSettings({...this.settings, ...patch})
    // an empty apiKey in a patch means "keep the stored key" unless clearing explicitly
    if (patch.apiKey === undefined || patch.apiKey === null) merged.apiKey = this.settings.apiKey
    if (patch.anthropicKey === undefined || patch.anthropicKey === null) merged.anthropicKey = this.settings.anthropicKey
    if (patch.geminiKey === undefined || patch.geminiKey === null) merged.geminiKey = this.settings.geminiKey
    const mapWas = this.navMapOn()
    this.settings = merged
    this.deps.store.saveSettings(merged)
    this.addLog("info", "Настройки сохранены")
    if (mapWas !== this.navMapOn()) {
      this.nav.mapChanged()
      if (this.nav.active && this.phase === "idle" && this.clearTimer_ == null) this.clearDisplay()
    }
    return merged
  }

  resetConversation(announce = true): void {
    this.history = []
    this.deps.store.saveHistory(this.history)
    this.pages = []
    this.page = 0
    this.lastAnswer = ""
    this.followUpUntil = 0
    this.addLog("cmd", "Новый разговор: контекст очищен")
    if (announce) this.flash("Новый разговор.\nКонтекст очищен.", 2500)
  }

  private flash(text: string, ms: number): void {
    this.cancelTimer("clearTimer_")
    this.show(fitScreen(text))
    this.clearTimer_ = this.setTimer(() => {
      this.clearTimer_ = null
      if (this.phase === "idle") this.clearDisplay()
      else if (this.phase === "answering") this.showPage(this.page)
      else if (this.phase === "lecture") this.lecture.screen ? this.show(this.lecture.screen) : this.clearDisplay()
      else if (this.phase === "talk") this.talk.screen ? this.show(this.talk.screen) : this.clearDisplay()
      else if (this.phase === "translating") this.translationScreen ? this.show(this.translationScreen) : this.clearDisplay()
    }, ms)
  }

  // ───────────────────────────── input ─────────────────────────────

  /**
   * «Только мой голос»: whoever says the activator is taken to be the wearer. With the setting on,
   * speech from other voices still feeds lecture notes and conversation hints, but it cannot give
   * commands without the activator. Returns true when the utterance was handled that way.
   */
  private fromAnotherVoice(t: string, isFinal: boolean, speaker: string | null): boolean {
    if (!speaker) return false
    const wake = this.wake(t).matched
    if (isFinal && wake && this.ownerVoice !== speaker) {
      this.ownerVoice = speaker
      this.addLog("info", `Ваш голос — «голос ${speaker}»${this.settings.voiceLock ? ": команды без активатора теперь только от него" : ""}`)
      this.changed()
    }
    if (!this.settings.voiceLock || !this.ownerVoice || speaker === this.ownerVoice || wake) return false
    if (this.phase === "talk") {
      if (isFinal) this.talk.onSpeech(t, "other")
      else this.talk.onInterim(t)
    } else if (this.phase === "lecture") {
      if (isFinal) this.lecture.onSpeech(t)
    } else if (isFinal && looksLikeCommand(t)) {
      this.addLog("info", `Команда чужим голосом пропущена: «${t}»`)
    }
    return true
  }

  /** User activators plus AI names («Клод», «Джемини», «Чат GPT»). */
  private wakeWords(): string[] {
    return [...this.settings.wakeWords, ...AI_WAKE_WORDS]
  }

  private wake(t: string) {
    return detectWake(t, this.wakeWords())
  }

  onTranscript(text: string, isFinal: boolean, speakerId?: string | number | null): void {
    if (this.settings.listenMode === "off") return
    const t = String(text ?? "").trim()
    if (!t) return
    const speaker = speakerId != null && String(speakerId).trim() ? String(speakerId).trim() : null
    if (isFinal) {
      this.lastTranscript = t
      this.addLog("stt", speaker ? `[голос ${speaker}] ${t}` : t)
    }
    if (this.fromAnotherVoice(t, isFinal, speaker)) return

    if (this.phase === "translating") {
      if (isFinal) this.onTranscriptWhileTranslating(t)
      return
    }
    if (this.phase === "lecture") {
      if (isFinal) this.onTranscriptWhileLecture(t)
      return
    }
    if (this.phase === "talk") {
      if (isFinal) this.onTranscriptWhileTalk(t, speaker)
      else if (!this.wake(t).matched) this.talk.onInterim(t) // «Вопрос, …» waits for the final
      return
    }

    if (this.phase === "capturing") {
      this.captureText(t, isFinal)
      return
    }

    if (!isFinal) {
      // Show early feedback as soon as the wake phrase is heard,
      // or as soon as the user starts replying to a counter-question.
      const inReplyWindow = this.now() < this.followUpUntil && this.phase === "answering"
      const w = this.wake(t)
      if (
        (this.settings.listenMode === "wake" && w.matched) ||
        (inReplyWindow && isMeaningful(t) && !parseCommand(t) && !isCommandPrefix(t))
      ) {
        if (inReplyWindow && !w.matched) this.addLog("wake", "Ответ на встречный вопрос / уточнение без активатора")
        this.startCapture(true, inReplyWindow && !w.matched)
        this.captureProvider = w.matched ? aiForWakePhrase(w.phrase) : inReplyWindow ? this.lastProvider : null
        this.captureText(t, false)
      }
      return
    }

    const wake = this.wake(t)
    const body = wake.matched ? wake.rest : t

    if (this.tryPhrase(body)) return
    if (parseTranslateCommand(body) === "start") {
      this.startTranslation("voice")
      return
    }
    if (parseLectureCommand(body) === "start") {
      this.startLecture("voice")
      return
    }
    if (parseTalkCommand(body) === "start") {
      this.startTalk("voice")
      return
    }
    if (wake.matched) {
      const goal = goalIn(t)
      if (goal !== null) return this.setGoal(goal)
    }

    const switchTo = parseSwitchCommand(body)
    if (switchTo) {
      this.switchProvider(switchTo, "voice")
      return
    }

    const nav = this.navIntent(body)
    if (nav) return nav()

    const cmd = parseCommand(body)
    if (cmd && (wake.matched || this.commandRelevant(cmd))) {
      this.command(cmd, "voice")
      return
    }

    const followUp = this.now() < this.followUpUntil
    const accept =
      wake.matched || this.settings.listenMode === "always" || (followUp && this.phase !== "thinking")

    if (!accept) return
    const named = wake.matched ? aiForWakePhrase(wake.phrase) : null
    if (wake.matched)
      this.addLog(
        "wake",
        `${named ? `Вопрос для ${PROVIDERS[named].label}` : "Фраза-активатор"}${wake.rest ? `: «${wake.rest}»` : ""}`,
      )
    else if (followUp) this.addLog("wake", "Уточнение без активатора")

    // A reply to a counter-question may be very short ("да", "в евро").
    const shortReplyOk = !wake.matched && followUp && normalize(body).length > 0
    if (!body || (!isMeaningful(body) && !shortReplyOk)) {
      if (wake.matched) {
        this.startCapture(false)
        this.captureProvider = named
      }
      return
    }
    this.startCapture(false, !wake.matched && followUp)
    this.captureProvider = named ?? (!wake.matched && followUp ? this.lastProvider : null)
    this.captureText(body, true)
  }

  private commandRelevant(cmd: VoiceCommand): boolean {
    if (cmd === "reset") return true
    if (cmd === "cancel") return this.phase === "thinking" || this.phase === "answering"
    if (cmd === "hide") return this.phase === "answering"
    // Paging works while the answer is shown, and also after it was hidden by the timer
    // (then "назад"/"повтори" bring it back). After an explicit "скрой" only "повтори" does.
    return this.pages.length > 0 && (this.phase === "answering" || (this.phase === "idle" && this.autoHidden) || cmd === "repeat")
  }

  onTouch(kind: string): void {
    this.addLog("touch", kind)
    if (this.phase === "lecture" || this.phase === "talk") return
    if (kind === "single_tap" || kind === "swipe_down") {
      if (this.pages.length) this.command("next", "touch")
    } else if (kind === "double_tap" || kind === "swipe_up") {
      if (this.pages.length) this.command("prev", "touch")
    } else if (kind === "long_press" || kind === "triple_tap") {
      if (this.phase !== "capturing") this.startCapture(false)
    }
  }

  private startCapture(fromInterim: boolean, isReply = false): void {
    if (this.phase === "thinking") this.requestSeq++ // a new question supersedes the pending one
    this.phase = "capturing"
    this.captureIsReply = isReply
    this.captureProvider = null
    this.committed = []
    this.interim = ""
    this.cancelTimer("pageTimer")
    this.cancelTimer("clearTimer_")
    this.cancelTimer("silenceTimer")
    this.cancelTimer("wakeTimer")
    this.wakeTimer = this.setTimer(() => {
      this.wakeTimer = null
      if (this.phase === "capturing" && !this.captured()) {
        this.addLog("info", "Вопрос не прозвучал — жду активатор снова")
        this.phase = "idle"
        this.clearDisplay()
        this.changed()
      }
    }, WAKE_WAIT_MS)
    this.show("Слушаю…")
    if (!fromInterim) this.addLog("info", "Слушаю вопрос")
    this.changed()
  }

  /** Strip a repeated wake phrase at the start (the final repeats what the interim already showed). */
  private stripWake(t: string): string {
    const w = this.wake(t)
    if (!w.matched) return t
    const named = aiForWakePhrase(w.phrase)
    if (named) this.captureProvider = named
    return w.rest
  }

  private captured(): string {
    return [...this.committed, this.interim]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
      .trim()
  }

  private captureText(t: string, isFinal: boolean): void {
    const clean = this.stripWake(t)
    if (isFinal) {
      const sw = this.committed.length === 0 ? parseSwitchCommand(clean) : null
      if (sw) {
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.interim = ""
        this.phase = this.pages.length ? "answering" : "idle"
        this.switchProvider(sw, "voice")
        return
      }
      if (this.committed.length === 0 && parseTranslateCommand(clean) === "start") {
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.interim = ""
        this.startTranslation("voice")
        return
      }
      if (this.committed.length === 0 && parseLectureCommand(clean) === "start") {
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.interim = ""
        this.startLecture("voice")
        return
      }
      if (this.committed.length === 0 && parseTalkCommand(clean) === "start") {
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.interim = ""
        this.startTalk("voice")
        return
      }
      if (this.committed.length === 0) {
        const back: Phase = this.pages.length ? "answering" : "idle"
        if (parsePhraseRequest(clean)) {
          this.cancelTimer("silenceTimer")
          this.cancelTimer("wakeTimer")
          this.interim = ""
          this.phase = back
          this.tryPhrase(clean)
          return
        }
      }
      const nav = this.committed.length === 0 ? this.navIntent(clean) : null
      if (nav) {
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.interim = ""
        this.phase = this.pages.length ? "answering" : "idle"
        nav()
        return
      }
      const goal = this.committed.length === 0 ? goalIn(t) : null
      if (goal !== null) {
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.interim = ""
        this.phase = this.pages.length ? "answering" : "idle"
        this.setGoal(goal)
        return
      }
      // "Ассистент, дальше" or "отмена" said while capturing is a command, not a question
      const cmd = parseCommand(clean)
      if (cmd && (this.committed.length === 0 || cmd === "cancel" || cmd === "hide")) {
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.committed = []
        this.interim = ""
        this.phase = this.pages.length ? "answering" : "idle"
        this.command(cmd, "voice")
        return
      }
      if (clean) this.committed.push(clean)
      this.interim = ""
    } else {
      this.interim = clean
    }

    const q = this.captured()
    if (q) {
      this.cancelTimer("wakeTimer")
      const now = this.now()
      if (isFinal || now - this.lastInterimShow > INTERIM_THROTTLE_MS) {
        this.lastInterimShow = now
        this.show(fitScreen(`» ${q}`))
      }
    }

    // Each new piece of speech pushes the end of the question further out.
    this.cancelTimer("silenceTimer")
    if (q) {
      this.silenceTimer = this.setTimer(() => {
        this.silenceTimer = null
        this.submitCapture()
      }, isFinal ? SILENCE_MS : SILENCE_MS + 1200)
    }
    this.changed()
  }

  private submitCapture(): void {
    if (this.phase !== "capturing") return
    const q = this.captured()
    this.committed = []
    this.interim = ""
    this.cancelTimer("wakeTimer")
    if (!isMeaningful(q) && !(this.captureIsReply && normalize(q).length > 0)) {
      this.phase = "idle"
      this.clearDisplay()
      this.changed()
      return
    }
    void this.ask(q, "voice", this.captureProvider ?? undefined)
  }

  /** Make another AI the default (voice: «переключись на Клода», or from the phone). */
  switchProvider(p: Provider, source: "voice" | "ui"): void {
    this.updateSettings({provider: p})
    const name = displayName(this.settings, p)
    const hasKey = Boolean(keyFor(this.settings, p))
    this.addLog("cmd", `Теперь отвечает ${name} (${source === "ui" ? "с телефона" : "голосом"})`)
    if (source === "voice" || this.phase === "idle") {
      this.flash(hasKey ? `Теперь отвечает ${name}.` : `Теперь отвечает ${name}.\nНет ключа ${PROVIDERS[p].label} — добавьте в приложении.`, 3000)
    }
  }

  // ───────────────────────────── asking ─────────────────────────────

  async ask(question: string, source: "voice" | "ui" | "touch", providerOverride?: Provider): Promise<void> {
    const q = question.trim()
    if (!q) return
    if (this.phase === "lecture" || this.phase === "talk") {
      this.addLog("ask", `${source === "ui" ? "[с телефона] " : ""}${q}`)
      if (this.phase === "lecture") this.lecture.askUser(q)
      else this.talk.askUser(q)
      return
    }
    if (this.phase === "translating") this.stopTranslation("question", false)
    const seq = ++this.requestSeq
    this.cancelTimer("silenceTimer")
    this.cancelTimer("wakeTimer")
    this.cancelTimer("pageTimer")
    this.cancelTimer("clearTimer_")
    this.phase = "thinking"
    this.lastQuestion = q
    this.lastError = ""
    const provider = providerOverride ?? asProvider(this.settings.provider)
    const label = PROVIDERS[provider].label
    this.addLog("ask", `${source === "ui" ? "[с телефона] " : ""}${providerOverride ? `[${label}] ` : ""}${q}`)

    if (!keyFor(this.settings, provider)) {
      this.fail(explainLLMError(provider, 401, "no_key", ""), seq)
      return
    }
    this.show(fitScreen(`» ${q}\n…${providerOverride || provider !== "openai" ? label + " " : ""}думает`))

    try {
      const res = await askLLM(this.deps.fetch, this.settings, provider, this.history, q, {
        setTimer: ((fn: () => void, ms: number) => this.setTimer(fn, ms)) as unknown as typeof setTimeout,
        now: this.now,
      })
      if (seq !== this.requestSeq) {
        this.addLog("info", "Ответ на отменённый вопрос пропущен")
        return
      }
      const usage = res.usage ? `, токены ${res.usage.input_tokens ?? "?"}→${res.usage.output_tokens ?? "?"}` : ""
      this.addLog("openai", `${label}: ответ за ${(res.ms / 1000).toFixed(1)} с (${res.model}${usage})`)
      const at = this.now()
      this.history.push({role: "user", content: q, at}, {role: "assistant", content: res.text, at, by: provider})
      this.lastProvider = provider
      this.deps.store.saveHistory(this.history)
      this.lastAnswer = res.text
      const clean = sanitizeForG1(res.text)
      // If the assistant asked something back ("Из какого города?"), the user's reply
      // must be accepted without the wake phrase.
      const asksBack = endsWithQuestion(clean)
      const lang = detectLang(clean)
      const replyHint = lang === "en" ? "\n» reply by voice" : "\n» ответьте голосом"
      this.pages = paginate(clean.length ? clean + (asksBack ? replyHint : "") : "(пустой ответ)", {lang})
      this.page = 0
      this.phase = "answering"
      const windowSec = Math.max(this.settings.followUpSec, asksBack ? REPLY_WINDOW_SEC : 0)
      this.followUpUntil = windowSec > 0 ? this.now() + windowSec * 1000 : 0
      this.addLog("display", `Ответ: ${this.pages.length} экр.`)
      if (asksBack) this.addLog("info", `Встречный вопрос — жду ответ без активатора ${windowSec} с`)
      this.showPage(0)
    } catch (e) {
      if (seq !== this.requestSeq) return
      const err = e as LLMError
      const status = typeof err?.status === "number" ? err.status : 0
      const code = String(err?.code ?? "")
      const human = explainLLMError(err?.provider ?? provider, status, code, err?.message ?? "")
      this.addLog("error", `${human} [${status} ${code}] ${String(err?.message ?? "").slice(0, 160)}`)
      this.fail(human, seq)
    }
  }

  private fail(message: string, seq: number): void {
    if (seq !== this.requestSeq) return
    this.lastError = message
    this.phase = "idle"
    this.pages = []
    this.flash(message, 8000)
    this.changed()
  }

  // ───────────────────────────── paging ─────────────────────────────

  private showPage(i: number): void {
    if (!this.pages.length) return
    this.page = Math.max(0, Math.min(this.pages.length - 1, i))
    this.phase = "answering"
    this.show(this.pages[this.page])
    this.cancelTimer("pageTimer")
    this.cancelTimer("clearTimer_")
    const last = this.page >= this.pages.length - 1
    if (this.settings.autoAdvanceSec > 0 && !last) {
      this.pageTimer = this.setTimer(() => {
        this.pageTimer = null
        if (this.phase === "answering") this.showPage(this.page + 1)
      }, this.settings.autoAdvanceSec * 1000)
    }
    // The answer stays on the glasses until its last page has been shown;
    // only then does the "clear after N seconds" timer start.
    if (this.settings.clearAfterSec > 0 && last) {
      this.clearTimer_ = this.setTimer(() => {
        this.clearTimer_ = null
        if (this.phase === "answering") {
          this.phase = "idle"
          this.autoHidden = true
          this.clearDisplay()
          this.addLog("display", "Ответ убран по таймеру (последняя страница прочитана)")
          this.changed()
        }
      }, this.settings.clearAfterSec * 1000)
    }
    this.autoHidden = false
    this.changed()
  }

  // ───────────────────────────── live translation ─────────────────────────────

  get translating(): boolean {
    return this.phase === "translating"
  }

  startTranslation(source: "voice" | "ui"): void {
    if (!this.deps.startTranslation) {
      this.addLog("error", "Перевод недоступен в этой версии Mentra")
      this.flash("Перевод недоступен.", 3000)
      return
    }
    if (this.phase === "lecture" || this.phase === "talk") this.leaveListeningMode()
    if (this.phase === "thinking") this.requestSeq++
    for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"] as const) this.cancelTimer(t)
    this.stopTranslationStream()
    this.committed = []
    this.interim = ""
    this.trFinals = []
    this.trInterim = null
    this.translationScreen = ""
    this.phase = "translating"
    const target = this.settings.translateTo
    try {
      this.translateUnsub = this.deps.startTranslation(target, (ev) => this.onTranslation(ev))
    } catch (e) {
      this.phase = "idle"
      this.addLog("error", `Не удалось включить перевод: ${String((e as Error)?.message ?? e)}`)
      this.flash("Не удалось включить перевод.", 3000)
      return
    }
    const ru = target === "ru-RU"
    this.addLog("translate", `Перевод включён (${source === "ui" ? "с телефона" : "голосом"}) → ${ru ? "русский" : "английский"}`)
    this.show(ru ? "Перевод включён → русский\nВыключить: «стоп перевод»" : "Translation on → English\nTo stop: «стоп перевод»")
    this.armTranslateIdle()
    this.changed()
  }

  // ───────────────────────────── lecture mode ─────────────────────────────

  startLecture(source: "voice" | "ui"): void {
    const provider = asProvider(this.settings.provider)
    if (!keyFor(this.settings, provider)) {
      const msg = explainLLMError(provider, 401, "no_key", "")
      this.addLog("error", `Режим лекции: ${msg}`)
      this.flash(msg, 6000)
      return
    }
    if (this.phase === "translating" || this.phase === "talk") this.leaveListeningMode()
    if (this.phase === "thinking") this.requestSeq++
    for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"] as const) this.cancelTimer(t)
    this.committed = []
    this.interim = ""
    this.followUpUntil = 0
    this.phase = "lecture"
    if (this.settings.sttLanguage === "ru-RU") {
      this.addLog("error", "Распознавание настроено только на русский: английскую лекцию очки не поймут. Настройки → Язык распознавания → русский + английский.")
    }
    this.warnIfMicOff()
    this.lecture.start()
    this.addLog("lecture", `Тезисы и ответы пишет ${displayName(this.settings, provider)} (${source === "ui" ? "включено с телефона" : "включено голосом"})`)
  }

  stopLecture(source: "voice" | "ui" | "switch", announce = true): void {
    if (this.phase !== "lecture") return
    const {points, answers} = this.lecture.stop()
    this.phase = "idle"
    this.pages = []
    if (announce) {
      const en = this.settings.translateTo === "en-US"
      this.flash(
        en
          ? `Lecture mode off.
Key points: ${points}, answers: ${answers}.
Notes are in the app.`
          : `Лекция выключена.
Тезисов: ${points}, ответов: ${answers}.
Конспект — в приложении.`,
        4000,
      )
    } else this.clearDisplay()
    if (source === "ui") this.addLog("cmd", "Режим лекции выключен с телефона")
    this.changed()
  }

  private onTranscriptWhileLecture(t: string): void {
    const wake = this.wake(t)
    const body = wake.matched ? wake.rest : t
    const lc = parseLectureCommand(body)
    if (lc === "stop") return this.stopLecture("voice")
    if (lc === "start") return
    // The user's own commands: Russian, or after an activator. English phrases are the lecturer's.
    const mine = wake.matched || detectLang(body) === "ru"
    if (mine && this.trySwitchMode(body)) return
    if (mine && this.tryPhrase(body)) return
    const nav = mine ? this.navIntent(body, !wake.matched) : null
    if (nav) return nav()
    const cmd = parseCommand(body)
    if (mine && (cmd === "hide" || cmd === "cancel" || parseTranslateCommand(body) === "stop")) return this.stopLecture("voice")
    // «Вопрос, что такое энтропия?» — the user's own question, answered without leaving the lecture
    if (wake.matched && detectLang(body) === "ru" && isMeaningful(body) && !cmd) {
      this.addLog("ask", body)
      this.lecture.askUser(body)
      return
    }
    this.lecture.onSpeech(t)
  }

  // ───────────────────────────── «как будет на английском …» ─────────────────────────────

  /**
   * «Как будет на английском стол?» in any listening mode but translation. True when the utterance
   * was handled: a translation request, or the word that followed «Как будет на английском…».
   */
  private tryPhrase(body: string): boolean {
    const waiting = this.phraseWait && this.now() < this.phraseWait.until ? this.phraseWait : null
    this.phraseWait = null
    const req = parsePhraseRequest(body)
    if (req) {
      if (!req.phrase) {
        this.phraseWait = {lang: req.lang, until: this.now() + PHRASE_WAIT_MS}
        this.addLog("cmd", `Перевод на ${PHRASE_LANG_NAME[req.lang]}: жду слово или фразу`)
        this.flash(`Как будет: ${PHRASE_LANG_NAME[req.lang]}\nСкажите слово или фразу`, PHRASE_WAIT_MS)
        return true
      }
      void this.translatePhrase(req.phrase, req.lang)
      return true
    }
    const cmd = parseCommand(body)
    if (waiting && normalize(body).length > 0 && cmd !== "cancel" && cmd !== "hide") {
      void this.translatePhrase(body.replace(/[?？!.…]+$/u, "").trim(), waiting.lang)
      return true
    }
    return false
  }

  /** Translates a word or phrase with the selected AI and shows «стол → table» in the current mode. */
  async translatePhrase(phrase: string, lang: PhraseLang): Promise<void> {
    const provider = asProvider(this.settings.provider)
    if (!keyFor(this.settings, provider)) {
      this.flash(explainLLMError(provider, 401, "no_key", ""), 6000)
      return
    }
    this.addLog("ask", `Перевод на ${PHRASE_LANG_NAME[lang]}: ${phrase}`)
    const run = async () => {
      const {system, user} = buildPhrasePrompt(phrase, lang)
      const a = cleanPhraseReply(await this.completeOnce(system, user))
      if (!a) return null
      this.addLog("display", `${phrase} → ${a}`)
      return {q: phrase, a}
    }
    if (this.phase === "talk") return this.talk.aside(phrase, run, " → ")
    if (this.phase === "lecture") return this.lecture.aside(phrase, run)

    // assistant mode: shown like an answer, so paging, «скрой» and the clear timer apply
    if (this.phase === "translating") this.stopTranslation("question", false)
    const seq = ++this.requestSeq
    for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"] as const) this.cancelTimer(t)
    this.committed = []
    this.interim = ""
    this.phase = "thinking"
    this.lastQuestion = phrase
    this.lastError = ""
    this.show(fitScreen(`${phrase} → …`))
    this.changed()
    try {
      const qa = await run()
      if (seq !== this.requestSeq) return
      if (!qa) return this.fail(`Не получилось перевести «${phrase}».`, seq)
      const at = this.now()
      this.history.push(
        {role: "user", content: `Как будет (${PHRASE_LANG_NAME[lang]}): ${phrase}`, at},
        {role: "assistant", content: qa.a, at, by: provider},
      )
      this.lastProvider = provider
      this.deps.store.saveHistory(this.history)
      this.lastAnswer = qa.a
      this.pages = paginate(sanitizeForG1(`${phrase} → ${qa.a}`))
      this.page = 0
      this.followUpUntil = 0
      this.showPage(0)
    } catch (e) {
      if (seq !== this.requestSeq) return
      const err = e as LLMError
      const human = explainLLMError(err?.provider ?? provider, Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""))
      this.addLog("error", `${human} [${err?.status ?? 0} ${err?.code ?? ""}]`)
      this.fail(human, seq)
    }
  }

  // ───────────────────────────── conversation mode ─────────────────────────────

  startTalk(source: "voice" | "ui"): void {
    const provider = asProvider(this.settings.provider)
    if (!keyFor(this.settings, provider)) {
      const msg = explainLLMError(provider, 401, "no_key", "")
      this.addLog("error", `Режим беседы: ${msg}`)
      this.flash(msg, 6000)
      return
    }
    if (this.phase === "translating" || this.phase === "lecture") this.leaveListeningMode()
    if (this.phase === "thinking") this.requestSeq++
    for (const t of ["silenceTimer", "wakeTimer", "pageTimer", "clearTimer_"] as const) this.cancelTimer(t)
    this.committed = []
    this.interim = ""
    this.followUpUntil = 0
    this.phase = "talk"
    this.warnIfMicOff()
    this.talk.start({en: this.settings.translateTo === "en-US"})
    this.addLog("talk", `Подсказки пишет ${displayName(this.settings, provider)} (${source === "ui" ? "включено с телефона" : "включено голосом"})`)
  }

  stopTalk(source: "voice" | "ui" | "switch", announce = true): void {
    if (this.phase !== "talk") return
    const {hints} = this.talk.stop()
    this.phase = "idle"
    this.pages = []
    if (announce) {
      const en = this.settings.translateTo === "en-US"
      this.flash(en ? `Conversation mode off.\nHints: ${hints}. The list is in the app.` : `Беседа выключена.\nПодсказок: ${hints}. Список — в приложении.`, 4000)
    } else this.clearDisplay()
    if (source === "ui") this.addLog("cmd", "Режим беседы выключен с телефона")
    this.changed()
  }

  private onTranscriptWhileTalk(t: string, speaker: string | null = null): void {
    const wake = this.wake(t)
    const body = wake.matched ? wake.rest : t
    const tc = parseTalkCommand(body)
    if (tc === "stop") return this.stopTalk("voice")
    if (tc === "start") return
    // In a conversation «стоп», «хватит» or «лекция» are ordinary words: switching or stopping needs the
    // activator («Вопрос, стоп») or an unambiguous phrase («транслейт», «режим лекции», «стоп беседа»).
    const unambiguous = wake.matched || parseTranslateCommand(body) === "start" || normalize(body).split(" ").length >= 2
    if (unambiguous && this.trySwitchMode(body)) return
    if (this.tryPhrase(body)) return
    const nav = this.navIntent(body, !wake.matched)
    if (nav) return nav()
    // «Вопрос, цель: договориться о скидке» — what the hints should steer toward
    const goal = wake.matched ? goalIn(t) : null
    if (goal !== null) return this.setGoal(goal)
    const cmd = parseCommand(body)
    if (wake.matched && (cmd === "hide" || cmd === "cancel")) return this.stopTalk("voice")
    if (wake.matched && isMeaningful(body) && !cmd) {
      this.addLog("ask", body)
      this.talk.askUser(body)
      return
    }
    // who said it, when Mentra tells voices apart and the wearer's voice is known (said the activator)
    const who = speaker && this.ownerVoice ? (speaker === this.ownerVoice ? "me" : "other") : undefined
    this.talk.onSpeech(t, who)
  }

  /** Conversation goal, said by voice («Вопрос, цель: …») or typed in the app. */
  setGoal(goal: string): void {
    this.updateSettings({talkGoal: goal})
    this.addLog("talk", goal ? `Цель беседы: ${goal}` : "Цель беседы убрана")
    this.flash(goal ? `Цель беседы:\n${goal}` : "Цель беседы убрана.", 3000)
  }

  /** «Транслейт», «Лекция», «Беседа» said in another listening mode switch to that mode. */
  private trySwitchMode(body: string): boolean {
    const target =
      parseTranslateCommand(body) === "start"
        ? "translating"
        : parseLectureCommand(body) === "start"
          ? "lecture"
          : parseTalkCommand(body) === "start"
            ? "talk"
            : null
    if (!target) return false
    if (target === this.phase) return true
    if (target === "translating") this.startTranslation("voice")
    else if (target === "lecture") this.startLecture("voice")
    else this.startTalk("voice")
    return true
  }

  /** Quietly leaves translation, lecture or conversation mode (before another one starts). */
  private leaveListeningMode(): void {
    if (this.phase === "translating") this.stopTranslation("question", false)
    else if (this.phase === "lecture") this.stopLecture("switch", false)
    else if (this.phase === "talk") this.stopTalk("switch", false)
  }

  stopTranslation(source: "voice" | "ui" | "question", announce = true): void {
    if (this.phase !== "translating") return
    this.stopTranslationStream()
    this.phase = "idle"
    this.translationScreen = ""
    this.addLog("translate", `Перевод выключен (${source === "ui" ? "с телефона" : source === "question" ? "задан вопрос" : "голосом"})`)
    if (announce) this.flash("Перевод выключен.", 1500)
    else this.clearDisplay()
    this.changed()
  }

  private stopTranslationStream(): void {
    if (this.translateUnsub) {
      try {
        this.translateUnsub()
      } catch {
        // ignore
      }
      this.translateUnsub = null
    }
    if (this.trRenderTimer != null) {
      this.clearTimerFn(this.trRenderTimer)
      this.trRenderTimer = null
    }
    if (this.trIdleTimer != null) {
      this.clearTimerFn(this.trIdleTimer)
      this.trIdleTimer = null
    }
  }

  private onTranscriptWhileTranslating(t: string): void {
    const wake = this.wake(t)
    const body = wake.matched ? wake.rest : t
    const tcmd = parseTranslateCommand(body)
    if (tcmd === "stop") {
      this.stopTranslation("voice")
      return
    }
    if (tcmd === "start") return // already translating
    if (this.trySwitchMode(body)) return
    const nav = this.navIntent(body, !wake.matched)
    if (nav) return nav()
    // "скрой"/"отмена" in Russian also stop; bare English "stop" may come from people around.
    const cmd = parseCommand(body)
    if ((cmd === "hide" || cmd === "cancel") && (wake.matched || detectLang(body) === "ru")) {
      this.stopTranslation("voice")
      return
    }
    // "Вопрос, …" leaves translation and asks the assistant.
    if (wake.matched && isMeaningful(body) && !cmd) {
      this.stopTranslation("question", false)
      this.startCapture(false)
      this.captureProvider = aiForWakePhrase(wake.phrase)
      this.captureText(body, true)
    }
  }

  private onTranslation(ev: TranslationEvent): void {
    if (this.phase !== "translating") return
    const text = sanitizeForG1(String(ev?.text ?? "")).replace(/\n+/g, " ").trim()
    if (!text) return
    if (isPassthrough(ev, this.settings.translateTo)) return
    const id = ev.utteranceId ?? "_"
    if (ev.isFinal) {
      this.trFinals.push(text)
      if (this.trFinals.length > TRANSLATE_KEEP) this.trFinals.splice(0, this.trFinals.length - TRANSLATE_KEEP)
      if (!this.trInterim || this.trInterim.id === id) this.trInterim = null
      this.addLog("translate", `${ev.sourceLanguage ? "[" + primaryLang(ev.sourceLanguage) + "] " : ""}${text}`)
    } else {
      this.trInterim = {id, text}
    }
    this.armTranslateIdle()
    this.scheduleTranslationRender(ev.isFinal)
  }

  private scheduleTranslationRender(immediate: boolean): void {
    const now = this.now()
    const due = immediate || now - this.trLastRender >= TRANSLATE_RENDER_MS
    if (due) {
      if (this.trRenderTimer != null) {
        this.clearTimerFn(this.trRenderTimer)
        this.trRenderTimer = null
      }
      this.renderTranslation()
    } else if (this.trRenderTimer == null) {
      this.trRenderTimer = this.setTimer(() => {
        this.trRenderTimer = null
        this.renderTranslation()
      }, TRANSLATE_RENDER_MS - (now - this.trLastRender))
    }
  }

  private renderTranslation(): void {
    if (this.phase !== "translating") return
    const parts = [...this.trFinals]
    if (this.trInterim) parts.push(this.trInterim.text)
    const lines = wrapLines(parts.join(" "))
    const screen = lines.slice(-G1_LINES).join("\n")
    this.trLastRender = this.now()
    if (screen && screen !== this.translationScreen) {
      this.translationScreen = screen
      this.show(screen)
      this.changed()
    }
  }

  private armTranslateIdle(): void {
    if (this.trIdleTimer != null) this.clearTimerFn(this.trIdleTimer)
    this.trIdleTimer = this.setTimer(() => {
      this.trIdleTimer = null
      if (this.phase !== "translating") return
      // silence: clear the glasses, start the next phrase on a clean screen
      this.trFinals = []
      this.trInterim = null
      this.translationScreen = ""
      this.clearDisplay()
      this.changed()
    }, TRANSLATE_IDLE_MS)
  }

  /**
   * G1 head-up sensor (Mentra forwards it as head_position). Looking up past the angle set in
   * Mentra shows the next page of a long answer; nothing happens on the last page or when no
   * answer is on screen, so glancing up at other times is harmless.
   */
  onHeadPosition(position: string): void {
    if (position !== "up" && position !== "down") return
    const up = position === "up"
    if (up !== this.headUp) {
      this.headUp = up
      this.headUpSince = this.now()
      this.addLog("head", up ? "Голова поднята" : "Голова опущена")
      if (!up && this.phase === "answering" && this.pages.length) this.show(this.pages[this.page]) // repaint after the dashboard
      if (!up && this.phase === "lecture" && this.lecture.screen) this.show(this.lecture.screen)
      if (!up && this.phase === "talk" && this.talk.screen) this.show(this.talk.screen)
      if (!up && this.phase === "idle" && this.nav.active && this.clearTimer_ == null) {
        this.lastBitmap = "" // the dashboard covered it: send again
        this.showRoute()
      }
      this.changed()
    }
    if (!up || !this.settings.headNod) return
    if (this.phase !== "answering" || this.page >= this.pages.length - 1) return
    const now = this.now()
    if (now - this.lastNodAt < NOD_DEBOUNCE_MS) return
    this.lastNodAt = now
    this.command("next", "head")
  }

  /** Lecture and conversation modes hear nothing when the microphone is off in Settings. */
  private warnIfMicOff(): void {
    if (this.settings.listenMode === "off")
      this.addLog("error", "Микрофон выключен в настройках (Режим прослушивания) — очки ничего не услышат")
  }

  /** True when Mentra is most likely showing its dashboard instead of what this app sends. */
  dashboardLikely(): boolean {
    return this.headUp && this.now() - this.headUpSince >= HEAD_UP_HIDES_MS
  }

  private warnIfDashboard(): void {
    if (!this.dashboardLikely()) return
    const now = this.now()
    if (now - this.lastDashboardWarnAt < DASHBOARD_WARN_EVERY_MS) return
    this.lastDashboardWarnAt = now
    this.addLog("error", DASHBOARD_WARNING)
  }

  command(cmd: VoiceCommand, source: CommandSource): void {
    this.addLog("cmd", `${cmd} (${source})`)
    if (this.phase === "lecture" || this.phase === "talk") {
      const by = source === "ui" ? "ui" : "voice"
      if (cmd === "hide" || cmd === "cancel") this.phase === "lecture" ? this.stopLecture(by) : this.stopTalk(by)
      else if (cmd === "reset") this.resetConversation(false)
      return
    }
    if (this.phase === "translating") {
      if (cmd === "hide" || cmd === "cancel") this.stopTranslation(source === "ui" ? "ui" : "voice")
      else if (cmd === "reset") this.resetConversation(false)
      return
    }
    if (!this.pages.length && (cmd === "next" || cmd === "prev" || cmd === "first" || cmd === "repeat")) {
      if (this.phase === "idle") this.clearDisplay()
      return
    }
    switch (cmd) {
      case "next":
        if (this.pages.length) this.showPage(this.page + 1)
        break
      case "prev":
        if (this.pages.length) this.showPage(this.page - 1)
        break
      case "first":
        if (this.pages.length) this.showPage(0)
        break
      case "repeat":
        if (this.pages.length) this.showPage(this.page)
        break
      case "hide":
      case "cancel":
        if (this.phase === "thinking") {
          this.requestSeq++
          this.addLog("info", "Запрос отменён")
        }
        this.cancelTimer("silenceTimer")
        this.cancelTimer("wakeTimer")
        this.cancelTimer("pageTimer")
        this.cancelTimer("clearTimer_")
        this.committed = []
        this.interim = ""
        this.phase = "idle"
        this.autoHidden = false
        this.clearDisplay()
        this.changed()
        break
      case "reset":
        this.phase = "idle"
        this.resetConversation(true)
        break
    }
  }

  // ───────────────────────────── navigator ─────────────────────────────

  /**
   * A navigator command in what was said, as an action to run, or null. `strict` (lecture,
   * conversation and translation without the activator): other people talk there, so only the
   * unambiguous «стоп навигация» counts — and the place right after «Навигатор».
   */
  private navIntent(body: string, strict = false): (() => void) | null {
    const waiting = this.navWait && this.now() < this.navWait.until ? this.navWait : null
    const c = parseNavCommand(body)
    if (c) {
      if (strict && !(c.kind === "stop" && (this.nav.active || this.nav.busy))) return null
      switch (c.kind) {
        case "go":
          return () => {
            this.navWait = null
            void this.navigate(c.query, c.mode ?? this.settings.navMode, "voice")
          }
        case "stop":
          return () => {
            this.navWait = null
            this.stopNav("voice")
          }
        case "status":
          return this.nav.active ? () => this.flash(this.nav.status(), 5000) : null
        case "ask":
          return () => this.askDestination(c.mode)
      }
    }
    if (!waiting) return null
    const cmd = parseCommand(body)
    if (cmd === "cancel" || cmd === "hide") {
      return () => {
        this.navWait = null
        this.addLog("cmd", "Навигатор: отменено")
        this.flash("Маршрут отменён.", 1500)
      }
    }
    const place = body
      .replace(/[?？!.…]+$/u, "")
      .replace(/^(?:до|к|ко|в|во|на|to)\s+/iu, "")
      .trim()
    if (!normalize(place) || place.split(/\s+/).length > 10) return null
    return () => {
      this.navWait = null
      void this.navigate(place, waiting.mode ?? this.settings.navMode, "voice")
    }
  }

  /** «Навигатор» without a place: ask where to and take the next phrase as the destination. */
  private askDestination(mode: TravelMode | null): void {
    if (!this.navAvailable()) return
    this.navWait = {mode, until: this.now() + NAV_WAIT_MS}
    this.addLog("cmd", "Навигатор: жду, куда")
    this.flash(`Навигатор${mode ? ", " + modeLabel(mode) : ""}: куда?\nСкажите место или адрес`, NAV_WAIT_MS)
  }

  /** "" when the navigator can work, otherwise why not. */
  navProblem(): string {
    if (!this.deps.nav) return "Навигация недоступна в этой версии Mentra"
    try {
      return this.deps.nav.problem?.() ?? ""
    } catch {
      return ""
    }
  }

  private navAvailable(): boolean {
    const problem = this.navProblem()
    if (!problem) return true
    this.addLog("error", `Навигатор: ${problem}`)
    this.flash(`${problem}.`, 6000)
    return false
  }

  /** Searches the spoken or typed place near the user and starts the route. */
  async navigate(query: string, mode: TravelMode, source: "voice" | "ui"): Promise<void> {
    const q = String(query ?? "").trim()
    if (!q || !this.navAvailable()) return
    this.addLog("cmd", `Навигатор: «${q}», ${modeLabel(mode)} (${source === "ui" ? "с телефона" : "голосом"})`)
    await this.nav.go(q, mode)
  }

  /** Starts the route to a place picked from the search results in the app. */
  async navigateTo(place: Place, mode: TravelMode): Promise<void> {
    if (!this.navAvailable()) return
    this.addLog("cmd", `Навигатор: ${place.name}, ${modeLabel(mode)} (с телефона)`)
    await this.nav.goTo(place, mode)
  }

  stopNav(source: "voice" | "ui"): void {
    if (!this.nav.active && !this.nav.busy) {
      if (source === "voice") this.flash("Маршрута нет.", 2000)
      return
    }
    const wasActive = this.nav.active
    this.nav.stop(source)
    if (source === "voice") this.flash(wasActive ? "Маршрут завершён." : "Поиск маршрута отменён.", 2000)
    else if (!wasActive && this.phase === "idle") {
      // «Ищу…» is no longer true
      this.cancelTimer("clearTimer_")
      this.clearDisplay()
    }
  }

  /** After a restart: picks up the trip Mentra's navigator may still be running. */
  async resumeNav(trip: NavTrip | null, hostActive: boolean): Promise<void> {
    if (!trip) return
    if (!hostActive || this.now() - trip.startedAt > NAV_RESUME_MS || !this.deps.nav) {
      this.deps.store.saveNav(null)
      return
    }
    await this.nav.resume(trip)
  }

  /**
   * Where the navigator shows its screens. Searching and errors come as short messages; during a
   * trip the route stays on the glasses when nothing else is shown, and a turn that is close
   * shows for a few seconds over answers, notes or translation.
   */
  private navScreen(text: string, kind: NavScreenKind): void {
    if (kind === "message") this.flash(text, this.nav.busy ? NAV_BUSY_MS : NAV_MSG_MS)
    else if (this.phase === "idle" && this.clearTimer_ == null) {
      if (this.navMapOn() && this.nav.frame) this.showBitmap(this.nav.frame)
      else this.show(fitScreen(text))
    } else if (kind === "turn") this.flash(text, NAV_TURN_MS)
  }

  /** «Проверить карту»: a test picture on the glasses for a few seconds. */
  testBitmap(b64: string): boolean {
    if (!this.deps.showBitmap) return false
    this.cancelTimer("clearTimer_")
    this.lastBitmap = ""
    this.showBitmap(b64)
    this.addLog("display", "Проверка картинки на очках")
    this.clearTimer_ = this.setTimer(() => {
      this.clearTimer_ = null
      if (this.phase === "idle") this.clearDisplay()
      else if (this.phase === "answering") this.showPage(this.page)
    }, 8000)
    return true
  }

  private async locate(): Promise<{lat: number; lng: number} | null> {
    try {
      return (await this.deps.nav?.locate()) ?? null
    } catch (e) {
      this.addLog("info", `Геопозиция: ${explainNavError((e as Error)?.message ?? e)} — ищу без неё`)
      return null
    }
  }

  /** What to type into the map search: a Russian name is first turned into what the map knows. */
  private async mapQueries(query: string, near: {lat: number; lng: number} | null): Promise<string[]> {
    const queries: string[] = []
    const provider = asProvider(this.settings.provider)
    if (/[а-яё]/iu.test(query) && keyFor(this.settings, provider)) {
      try {
        const {system, user} = buildMapQueryPrompt(query, near)
        const q = cleanMapQuery(await this.completeOnce(system, user))
        if (q) {
          queries.push(q)
          if (normalize(q) !== normalize(query)) this.addLog("nav", `Ищу на карте: ${q}`)
        }
      } catch (e) {
        const err = e as LLMError
        this.addLog("error", `Не удалось уточнить место: ${explainLLMError(err?.provider ?? provider, Number(err?.status) || 0, String(err?.code ?? ""), String(err?.message ?? ""))}`)
      }
    }
    if (!queries.includes(query)) queries.push(query)
    return queries
  }

  /** Place search near the user for a spoken destination: the best match with coordinates. */
  private async findPlace(query: string): Promise<Place | null> {
    const host = this.deps.nav
    if (!host) return null
    const near = await this.locate()
    for (const q of await this.mapQueries(query, near)) {
      const found = await host.suggest(q, near)
      for (const sug of found.slice(0, 3)) {
        const place = await this.placeFor(sug)
        if (place) {
          this.addLog("nav", `Найдено: ${place.name}${place.address ? ", " + place.address : ""}`)
          return place
        }
      }
    }
    return null
  }

  /** Coordinates for a search result; null when Mentra cannot resolve it. */
  async placeFor(sug: PlaceSuggestion): Promise<Place | null> {
    let place: Place | null = null
    try {
      place = (await this.deps.nav?.details(sug.placeId)) ?? null
    } catch {
      place = null
    }
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return null
    return {...place, name: place.name || sug.mainText, address: place.address || sug.secondaryText}
  }

  /** Search from the app: the list to pick from. */
  async searchPlaces(query: string): Promise<PlaceSuggestion[]> {
    const host = this.deps.nav
    const q = String(query ?? "").trim()
    if (!host || !q) return []
    const near = await this.locate()
    const seen = new Set<string>()
    const out: PlaceSuggestion[] = []
    for (const mq of await this.mapQueries(q, near)) {
      for (const sug of await host.suggest(mq, near)) {
        if (seen.has(sug.placeId)) continue
        seen.add(sug.placeId)
        out.push(sug)
      }
      if (out.length >= 5) break
    }
    return out.slice(0, 8)
  }

  // ───────────────────────────── state for the phone UI ─────────────────────────────

  snapshot() {
    const hint = (k: string) => (k ? `${k.slice(0, k.startsWith("sk-ant-") ? 7 : 3)}…${k.slice(-4)}` : "")
    const provider = asProvider(this.settings.provider)
    const key = keyFor(this.settings, provider)
    return {
      phase: this.phase,
      page: this.page,
      pages: this.pages.length,
      currentScreen:
        this.phase === "translating"
          ? this.translationScreen
          : this.phase === "lecture"
            ? this.lecture.screen
            : this.phase === "talk"
              ? this.talk.screen
              : this.phase === "idle" && this.nav.active
                ? this.nav.screen
                : this.pages[this.page] ?? "",
      translating: this.phase === "translating",
      /** The glasses show the navigation map picture (the phone mirrors it). */
      glassesBitmap: this.glassesBitmap,
      lastTranscript: this.lastTranscript,
      lastQuestion: this.lastQuestion,
      lastAnswer: this.lastAnswer,
      lastError: this.lastError,
      dashboardLikely: this.dashboardLikely(),
      ownerVoice: this.ownerVoice,
      lecture: lectureSnapshot(this.lecture.active, this.lecture.record),
      talk: lectureSnapshot(this.talk.active, this.talk.record),
      nav: {
        problem: this.navProblem(),
        active: this.nav.active,
        busy: this.nav.busy,
        dest: this.nav.dest,
        mode: this.nav.mode,
        screen: this.nav.screen,
        message: this.nav.message,
        left: this.nav.left(),
        map: this.navMapOn(),
        canMap: Boolean(this.deps.showBitmap),
        frameId: this.nav.frameId,
        streets: this.nav.roads.length,
      },
      glassesConnected: this.glassesConnected,
      settings: {
        ...this.settings,
        apiKey: "",
        anthropicKey: "",
        geminiKey: "",
        hasKey: Boolean(key),
        keyHint: hint(key),
        keys: {
          openai: {has: Boolean(this.settings.apiKey), hint: hint(this.settings.apiKey)},
          anthropic: {has: Boolean(this.settings.anthropicKey), hint: hint(this.settings.anthropicKey)},
          gemini: {has: Boolean(this.settings.geminiKey), hint: hint(this.settings.geminiKey)},
        },
        aiName: displayName(this.settings, provider),
      },
      historyCount: this.history.length,
      history: this.history.slice(-40),
      log: this.log.slice(-100),
    }
  }
}

/** What the phone UI needs about lecture mode; the latest notes only. */
function lectureSnapshot(active: boolean, r: LectureRecord | null) {
  return {
    active,
    startedAt: r?.startedAt ?? 0,
    endedAt: r?.endedAt ?? 0,
    total: r?.notes.length ?? 0,
    notes: (r?.notes ?? []).slice(-120),
  }
}

/**
 * «цель: договориться о скидке», «цель беседы — …», «моя цель — …», «goal: …»; "" for «цель: нет»;
 * null when it is not a goal phrase («цель жизни — это что?» is a question, not a goal).
 */
export function parseGoal(body: string): string | null {
  const m = /^\s*(моя\s+|my\s+)?(?:цель|goal)(\s+(?:беседы|разговора|of the conversation))?(\s*[:—–-]\s*|\s+(?:это|is)\s+|\s+)(.+)$/i.exec(body)
  if (!m) return null
  const [, mine, qualifier, sep, rest] = m
  // a bare space or «это» counts only after «моя цель» / «цель беседы»
  if (!/[:—–-]/.test(sep) && !mine && !qualifier) return null
  const g = rest.trim().replace(/[.!]+$/, "")
  if (/^(нет|никакой|убрать|сбросить|none|no|clear)$/i.test(g)) return ""
  return g.slice(0, 300)
}

/**
 * The goal phrase right after the activator, read from the raw transcript (the activator parser
 * drops a standalone «—», which tells «цель — …» from «цель жизни …»).
 */
export function goalIn(raw: string): string | null {
  const m = /(?:^|[\s,.:;!?«"])((?:моя\s+|my\s+)?(?:цель|goal)(?![\p{L}\p{N}]))/iu.exec(raw)
  if (!m) return null
  const start = m.index + m[0].length - m[1].length
  if (normalize(raw.slice(0, start)).split(" ").filter(Boolean).length > 3) return null
  return parseGoal(raw.slice(start))
}

/** Anything a bystander could set off by accident: mode switches, paging, translation requests. */
function looksLikeCommand(t: string): boolean {
  return Boolean(
    parseCommand(t) ||
      parseTranslateCommand(t) ||
      parseLectureCommand(t) ||
      parseTalkCommand(t) ||
      parsePhraseRequest(t) ||
      parseSwitchCommand(t),
  )
}
