/**
 * The assistant's state machine, independent of Mentra so it can be tested with fakes.
 *
 * idle ──wake phrase──▶ capturing ──pause in speech──▶ thinking ──answer──▶ answering
 *   ▲                                                                           │
 *   └──────────── "скрой" / timeout / новый вопрос ◀───────────────────────────┘
 */
import {fitScreen, G1_LINES, paginate, sanitizeForG1, wrapLines} from "./g1text"
import {askLLM, asProvider, displayName, explainLLMError, keyFor, LLMError, PROVIDERS, type Provider} from "./llm"
import type {FetchLike} from "./openai"
import {normalizeSettings, Store, type Message, type Settings} from "./store"
import {
  detectLang,
  detectWake,
  isCommandPrefix,
  isMeaningful,
  normalize,
  parseCommand,
  parseSwitchCommand,
  parseTranslateCommand,
  aiForWakePhrase,
  AI_WAKE_WORDS,
  type VoiceCommand,
} from "./voice"

export type Phase = "idle" | "capturing" | "thinking" | "answering" | "translating"

export interface LogEntry {
  t: number
  kind: "stt" | "wake" | "cmd" | "ask" | "openai" | "display" | "error" | "info" | "touch" | "translate"
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
const LOG_MAX = 80
/** Ignore repeated head-up events closer than this (sensor bounce). */
const NOD_DEBOUNCE_MS = 1200

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
  private displayChecked = false

  private readonly now: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimerFn: (id: unknown) => void

  constructor(private readonly deps: AssistantDeps) {
    this.now = deps.now ?? Date.now
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimerFn = deps.clearTimer ?? ((id) => clearTimeout(id as any))
    this.settings = deps.store.loadSettings()
    this.history = deps.store.loadHistory()
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

  private show(text: string): void {
    let r: Promise<DisplayResultInfo | void> | void
    try {
      r = this.deps.show(text)
    } catch (e) {
      this.addLog("error", `Дисплей: ${String((e as Error)?.message ?? e)}`)
      return
    }
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

  private clearDisplay(): void {
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
    this.settings = merged
    this.deps.store.saveSettings(merged)
    this.addLog("info", "Настройки сохранены")
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
    }, ms)
  }

  // ───────────────────────────── input ─────────────────────────────

  /** User activators plus AI names («Клод», «Джемини», «Чат GPT»). */
  private wakeWords(): string[] {
    return [...this.settings.wakeWords, ...AI_WAKE_WORDS]
  }

  private wake(t: string) {
    return detectWake(t, this.wakeWords())
  }

  onTranscript(text: string, isFinal: boolean): void {
    if (this.settings.listenMode === "off") return
    const t = String(text ?? "").trim()
    if (!t) return
    if (isFinal) {
      this.lastTranscript = t
      this.addLog("stt", t)
    }

    if (this.phase === "translating") {
      if (isFinal) this.onTranscriptWhileTranslating(t)
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

    if (parseTranslateCommand(body) === "start") {
      this.startTranslation("voice")
      return
    }

    const switchTo = parseSwitchCommand(body)
    if (switchTo) {
      this.switchProvider(switchTo, "voice")
      return
    }

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
    if (position !== "up" || !this.settings.headNod) return
    if (this.phase !== "answering" || this.page >= this.pages.length - 1) return
    const now = this.now()
    if (now - this.lastNodAt < NOD_DEBOUNCE_MS) return
    this.lastNodAt = now
    this.command("next", "head")
  }

  command(cmd: VoiceCommand, source: CommandSource): void {
    this.addLog("cmd", `${cmd} (${source})`)
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

  // ───────────────────────────── state for the phone UI ─────────────────────────────

  snapshot() {
    const hint = (k: string) => (k ? `${k.slice(0, k.startsWith("sk-ant-") ? 7 : 3)}…${k.slice(-4)}` : "")
    const provider = asProvider(this.settings.provider)
    const key = keyFor(this.settings, provider)
    return {
      phase: this.phase,
      page: this.page,
      pages: this.pages.length,
      currentScreen: this.phase === "translating" ? this.translationScreen : this.pages[this.page] ?? "",
      translating: this.phase === "translating",
      lastTranscript: this.lastTranscript,
      lastQuestion: this.lastQuestion,
      lastAnswer: this.lastAnswer,
      lastError: this.lastError,
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
      log: this.log.slice(-60),
    }
  }
}
