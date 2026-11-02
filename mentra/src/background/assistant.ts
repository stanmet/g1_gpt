/**
 * The assistant's state machine, independent of Mentra so it can be tested with fakes.
 *
 * idle ──wake phrase──▶ capturing ──pause in speech──▶ thinking ──answer──▶ answering
 *   ▲                                                                           │
 *   └──────────── "скрой" / timeout / новый вопрос ◀───────────────────────────┘
 */
import {fitScreen, paginate, sanitizeForG1} from "./g1text"
import {askOpenAI, explainError, OpenAIError, type FetchLike} from "./openai"
import {normalizeSettings, Store, type Message, type Settings} from "./store"
import {detectWake, isMeaningful, normalize, parseCommand, type VoiceCommand} from "./voice"

export type Phase = "idle" | "capturing" | "thinking" | "answering"

export interface LogEntry {
  t: number
  kind: "stt" | "wake" | "cmd" | "ask" | "openai" | "display" | "error" | "info" | "touch"
  msg: string
}

export interface DisplayResultInfo {
  status?: string
  degraded?: boolean
  reason?: string
}

export interface AssistantDeps {
  show(text: string): Promise<DisplayResultInfo | void> | void
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

  onTranscript(text: string, isFinal: boolean): void {
    if (this.settings.listenMode === "off") return
    const t = String(text ?? "").trim()
    if (!t) return
    if (isFinal) {
      this.lastTranscript = t
      this.addLog("stt", t)
    }

    if (this.phase === "capturing") {
      this.captureText(t, isFinal)
      return
    }

    if (!isFinal) {
      // Show early feedback as soon as the wake phrase is heard,
      // or as soon as the user starts replying to a counter-question.
      const inReplyWindow = this.now() < this.followUpUntil && this.phase === "answering"
      if (
        (this.settings.listenMode === "wake" && detectWake(t, this.settings.wakeWords).matched) ||
        (inReplyWindow && isMeaningful(t) && !parseCommand(t))
      ) {
        if (inReplyWindow) this.addLog("wake", "Ответ на встречный вопрос / уточнение без активатора")
        this.startCapture(true, inReplyWindow)
        this.captureText(t, false)
      }
      return
    }

    const wake = detectWake(t, this.settings.wakeWords)
    const body = wake.matched ? wake.rest : t

    const cmd = parseCommand(body)
    if (cmd && (wake.matched || this.commandRelevant(cmd))) {
      this.command(cmd, "voice")
      return
    }

    const followUp = this.now() < this.followUpUntil
    const accept =
      wake.matched || this.settings.listenMode === "always" || (followUp && this.phase !== "thinking")

    if (!accept) return
    if (wake.matched) this.addLog("wake", wake.rest ? `Фраза-активатор, вопрос: «${wake.rest}»` : "Фраза-активатор")
    else if (followUp) this.addLog("wake", "Уточнение без активатора")

    // A reply to a counter-question may be very short ("да", "в евро").
    const shortReplyOk = !wake.matched && followUp && normalize(body).length > 0
    if (!body || (!isMeaningful(body) && !shortReplyOk)) {
      if (wake.matched) {
        this.startCapture(false)
      }
      return
    }
    this.startCapture(false, !wake.matched && followUp)
    this.captureText(body, true)
  }

  private commandRelevant(cmd: VoiceCommand): boolean {
    if (cmd === "reset") return true
    if (cmd === "cancel") return this.phase === "thinking" || this.phase === "answering"
    if (cmd === "hide") return this.phase === "answering"
    return this.pages.length > 0 && (this.phase === "answering" || cmd === "repeat")
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
    const w = detectWake(t, this.settings.wakeWords)
    return w.matched ? w.rest : t
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
    void this.ask(q, "voice")
  }

  // ───────────────────────────── asking ─────────────────────────────

  async ask(question: string, source: "voice" | "ui" | "touch"): Promise<void> {
    const q = question.trim()
    if (!q) return
    const seq = ++this.requestSeq
    this.cancelTimer("silenceTimer")
    this.cancelTimer("wakeTimer")
    this.cancelTimer("pageTimer")
    this.cancelTimer("clearTimer_")
    this.phase = "thinking"
    this.lastQuestion = q
    this.lastError = ""
    this.addLog("ask", `${source === "ui" ? "[с телефона] " : ""}${q}`)

    if (!this.settings.apiKey) {
      this.fail("Нет ключа OpenAI. Откройте приложение на телефоне и вставьте ключ.", seq)
      return
    }
    this.show(fitScreen(`» ${q}\n…думаю`))

    try {
      const res = await askOpenAI(this.deps.fetch, this.settings, this.history, q, {
        setTimer: ((fn: () => void, ms: number) => this.setTimer(fn, ms)) as unknown as typeof setTimeout,
        now: this.now,
      })
      if (seq !== this.requestSeq) {
        this.addLog("info", "Ответ на отменённый вопрос пропущен")
        return
      }
      const usage = res.usage ? `, токены ${res.usage.input_tokens ?? "?"}→${res.usage.output_tokens ?? "?"}` : ""
      this.addLog("openai", `Ответ за ${(res.ms / 1000).toFixed(1)} с (${res.model}${usage})`)
      const at = this.now()
      this.history.push({role: "user", content: q, at}, {role: "assistant", content: res.text, at})
      this.deps.store.saveHistory(this.history)
      this.lastAnswer = res.text
      const clean = sanitizeForG1(res.text)
      // If the assistant asked something back ("Из какого города?"), the user's reply
      // must be accepted without the wake phrase.
      const asksBack = endsWithQuestion(clean)
      this.pages = paginate(clean.length ? clean + (asksBack ? "\n» ответьте голосом" : "") : "(пустой ответ)")
      this.page = 0
      this.phase = "answering"
      const windowSec = Math.max(this.settings.followUpSec, asksBack ? REPLY_WINDOW_SEC : 0)
      this.followUpUntil = windowSec > 0 ? this.now() + windowSec * 1000 : 0
      this.addLog("display", `Ответ: ${this.pages.length} экр.`)
      if (asksBack) this.addLog("info", `Встречный вопрос — жду ответ без активатора ${windowSec} с`)
      this.showPage(0)
    } catch (e) {
      if (seq !== this.requestSeq) return
      const err = e as OpenAIError
      const status = typeof err?.status === "number" ? err.status : 0
      const code = String(err?.code ?? "")
      const human = code === "timeout" ? "OpenAI не ответил вовремя. Повторите вопрос." : explainError(status, code, err?.message ?? "")
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
    if (this.settings.clearAfterSec > 0) {
      this.clearTimer_ = this.setTimer(() => {
        this.clearTimer_ = null
        if (this.phase === "answering") {
          this.phase = "idle"
          this.clearDisplay()
          this.changed()
        }
      }, this.settings.clearAfterSec * 1000 + (last ? 0 : this.settings.autoAdvanceSec * 1000 * (this.pages.length - 1 - this.page)))
    }
    this.changed()
  }

  command(cmd: VoiceCommand, source: "voice" | "ui" | "touch"): void {
    this.addLog("cmd", `${cmd} (${source})`)
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
    const key = this.settings.apiKey
    return {
      phase: this.phase,
      page: this.page,
      pages: this.pages.length,
      currentScreen: this.pages[this.page] ?? "",
      lastTranscript: this.lastTranscript,
      lastQuestion: this.lastQuestion,
      lastAnswer: this.lastAnswer,
      lastError: this.lastError,
      glassesConnected: this.glassesConnected,
      settings: {...this.settings, apiKey: "", hasKey: Boolean(key), keyHint: key ? `${key.slice(0, 3)}…${key.slice(-4)}` : ""},
      historyCount: this.history.length,
      history: this.history.slice(-10),
      log: this.log.slice(-60),
    }
  }
}
