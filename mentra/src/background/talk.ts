/**
 * Conversation mode («Беседа»): a quiet prompter while you talk to someone.
 *
 *   someone asks a factual question («Кто такой Кант? Когда он родился?»)  ──▶ short answer on the glasses
 *   you start explaining and trail off («А категорический императив — это…») ──▶ the facts to finish with
 *
 * Every final utterance is checked locally first; only questions and trailing statements go to the
 * AI, which answers or says SKIP for small talk. Recent conversation and earlier hints go along, so
 * follow-ups («а он когда умер?») are understood. Independent of Mentra, tested with fakes.
 */
import {answerScreen, LECTURE_RESUME_MS, parseAnswer, wordCount, type LectureNote, type LectureRecord} from "./lecture"
import {detectLang, normalize, type Lang} from "./voice"

/** A hint stays on the glasses this long, then the screen clears (the next hint replaces it sooner). */
export const TALK_SHOW_MS = 30_000
/** The same question heard again within this time (repeated, or re-sent by recognition) is ignored. */
export const TALK_DEDUPE_MS = 20_000
/** The intro screen is cleared after this long. */
const INTRO_MS = 5000
const CONTEXT_WORDS = 300
const PREV_HINTS = 4
const NOTES_MAX = 300
const ERROR_SHOW_EVERY_MS = 60_000

export interface TalkTrigger {
  /** question = someone asked; prompt = the speaker trailed off on «это», «родился в», «is»… */
  kind: "question" | "prompt"
  text: string
}

const LEAD = new Set(["а", "и", "но", "так", "ну", "слушай", "скажи", "скажите", "кстати", "and", "so", "but", "well", "hey", "by"])
const RU_Q = new Set([
  "кто", "что", "когда", "где", "куда", "откуда", "почему", "зачем", "как", "сколько", "какой", "какая", "какое",
  "какие", "каким", "какую", "каких", "каком", "чей", "чья", "чье", "чьи", "скольких",
])
const EN_Q = new Set(["who", "what", "when", "where", "why", "how", "which", "whose", "whom"])
/** Personal and small-talk questions: never worth a request. */
const SMALL_TALK = [
  "как дела", "как ты", "как вы", "как сам", "как жизнь", "что нового", "что делаешь", "что ты делаешь", "ты понял",
  "вы поняли", "понимаешь", "понятно", "правда", "серьезно", "да", "нет", "ну что", "что скажешь", "как тебе",
  "как вам", "ты где", "где ты", "когда встретимся", "что будем", "будешь", "хочешь", "how are you", "whats up",
  "what s up", "how is it going", "how s it going", "really", "right", "you know", "do you understand", "are you ok",
  "ok", "okay", "what do you want", "do you want", "shall we",
]
/**
 * Endings that leave a factual sentence hanging («… — это», «… родился в»), normalized.
 * Strong ones count even when recognition put a full stop after them («Императив — это.»).
 */
const STRONG_CUES = [
  "это", "это значит", "означает", "называется", "является", "родился в", "родилась в", "умер в", "умерла в",
  "в году", "равен", "равна", "равно", "составляет", "то есть", "а именно", "это когда", "means", "is called",
  "was born in", "born in", "died in", "equals", "namely", "which is",
]
/** Weak ones only when the sentence visibly trails off (no full stop: «…», «...», «,» or nothing). */
const WEAK_CUES = [
  "значит", "являлся", "являлась", "был", "была", "было", "были", "родился", "родилась", "году", "около", "примерно",
  "is", "are", "was", "were", "about", "around", "approximately", "in the year", "is basically",
]

function sentencesOf(text: string): string[] {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function contentWords(n: string): string[] {
  const w = n.split(" ").filter(Boolean)
  let i = 0
  while (i < 2 && i < w.length - 1 && LEAD.has(w[i])) i++
  return w.slice(i)
}

/** What in this utterance needs a hint, or null. Cheap and local: decides whether to call the AI. */
export function findTalkTrigger(text: string): TalkTrigger | null {
  const sentences = sentencesOf(text)
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i]
    const words = contentWords(normalize(s))
    if (words.length < 3) continue
    const n = words.join(" ")
    if (SMALL_TALK.some((st) => n === st || n.startsWith(st + " "))) continue
    const asked = /\?["»”')\s]*$/.test(s)
    // without «?» only if recognition did not close it with a full stop («Как я говорил, это важно.» is not a question)
    const open = !/(?<!\.)[.!]["»”')\s]*$/.test(s)
    const interrogative = open && (RU_Q.has(words[0]) || EN_Q.has(words[0]) || words[1] === "ли") && words.length <= 14
    if (asked || interrogative) return {kind: "question", text: s}
  }
  const last = sentences.at(-1)
  if (last) {
    const n = normalize(last)
    const closed = /(?<!\.)[.!]["»”')\s]*$/.test(last) // a single full stop; «...» and «…» trail off
    const cues = closed ? STRONG_CUES : [...STRONG_CUES, ...WEAK_CUES]
    if (n.split(" ").length >= 3 && cues.some((c) => n.endsWith(" " + c))) return {kind: "prompt", text: last}
  }
  return null
}

function langName(lang: Lang): string {
  return lang === "en" ? "английском (English)" : "русском"
}

export function buildTalkPrompt(
  context: string,
  prevHints: {q: string; a: string}[],
  trigger: TalkTrigger,
  fromUser: boolean,
  lang: Lang,
): {system: string; user: string} {
  const system = [
    "Ты — незаметный суфлёр в умных очках. Пользователь разговаривает с другим человеком; ты видишь распознанную речь (возможны ошибки, неизвестно, кто говорит). Ответ показывается на крошечном дисплее: 5 строк примерно по 30 символов.",
    "Если в последней реплике задан вопрос, требующий точной информации (люди, даты, места, числа, определения, термины, факты), дай эти сведения так, чтобы пользователь мог сразу сказать их вслух.",
    "Если пользователь начал объяснять и запнулся («Категорический императив — это…», «Он родился в…»), дай то, чем закончить фразу.",
    `Коротко: до 25 слов, сначала главное — даты, числа, суть. Пиши на ${langName(lang)} языке.`,
    "Учитывай разговор и прошлые подсказки: «он», «а это…» обычно относятся к той же теме.",
    "Формат ровно две строки:\nQ: <тема, до 6 слов>\nA: <сведения>",
    fromUser
      ? "Это прямой вопрос пользователя к тебе — ответь обязательно."
      : "Если реплика личная или бытовая (как дела, будешь кофе, где встретимся), мнение без фактов или нечего подсказать по существу — ответь ровно SKIP.",
    "Без Markdown и вступлений.",
  ].join("\n")
  const ctx = context.trim() ? `Недавно в разговоре:\n«${context.trim()}»\n\n` : ""
  const prev = prevHints.length ? `Прошлые подсказки:\n${prevHints.map((h) => `— ${h.q}: ${h.a}`).join("\n")}\n\n` : ""
  const label = fromUser ? "Вопрос пользователя" : trigger.kind === "prompt" ? "Последняя реплика (оборвана)" : "Последняя реплика"
  return {system, user: `${ctx}${prev}${label}: «${trigger.text.trim()}»`}
}

export interface TalkDeps {
  complete(system: string, user: string): Promise<string>
  explainError(e: unknown): string
  show(text: string): void
  clear(): void
  log(kind: "talk" | "error" | "info", msg: string): void
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(id: unknown): void
  save(record: LectureRecord): void
  onChange(): void
}

export class Talk {
  active = false
  record: LectureRecord | null
  screen = ""

  private session = 0
  private recent: string[] = []
  private busy = false
  private pending: {trigger: TalkTrigger; fromUser: boolean} | null = null
  private screenTimer: unknown = null
  private last = {n: "", at: -Infinity}
  private lastErrorShownAt = -Infinity

  constructor(
    private readonly deps: TalkDeps,
    saved: LectureRecord | null = null,
  ) {
    this.record = saved
  }

  start(intro: {en: boolean}): void {
    this.session++
    this.active = true
    this.recent = []
    this.busy = false
    this.pending = null
    this.last = {n: "", at: -Infinity}
    const prev = this.record
    const resume = Boolean(prev?.endedAt && this.deps.now() - prev.endedAt < LECTURE_RESUME_MS)
    if (resume && prev) delete prev.endedAt
    else this.record = {startedAt: this.deps.now(), notes: []}
    this.deps.save(this.record!)
    this.setScreen(
      intro.en
        ? "Conversation mode\n• facts when someone asks\n• a prompt when you trail off\nStop: «стоп беседа»"
        : "Режим беседы\n• факты, когда спрашивают\n• подскажу, если запнётесь\nВыключить: «стоп беседа»",
      INTRO_MS,
    )
    this.deps.log("talk", resume ? "Режим беседы включён — продолжаю прежний список" : "Режим беседы включён")
    this.deps.onChange()
  }

  stop(): {hints: number} {
    const hints = this.record?.notes.length ?? 0
    if (!this.active) return {hints}
    this.active = false
    this.session++
    this.cancelScreenTimer()
    this.pending = null
    this.screen = ""
    if (this.record) {
      this.record.endedAt = this.deps.now()
      this.deps.save(this.record)
    }
    this.deps.log("talk", `Режим беседы выключен: подсказок ${hints}`)
    this.deps.onChange()
    return {hints}
  }

  /** A final transcript of what was said (by anyone). */
  onSpeech(text: string): void {
    if (!this.active) return
    const t = String(text ?? "").trim()
    if (!t) return
    this.recent.push(t)
    let words = wordCount(this.recent.join(" "))
    while (this.recent.length > 1 && words > CONTEXT_WORDS) words -= wordCount(this.recent.shift()!)
    const trigger = findTalkTrigger(t)
    if (trigger) void this.hint(trigger, false)
  }

  /** The user's own question («Вопрос, …»): always answered. */
  askUser(question: string): void {
    if (!this.active || !question.trim()) return
    void this.hint({kind: "question", text: question.trim()}, true)
  }

  // ── internals ──

  private async hint(trigger: TalkTrigger, fromUser: boolean, queued = false): Promise<void> {
    if (!queued) {
      const n = normalize(trigger.text)
      const now = this.deps.now()
      if (!fromUser && n === this.last.n && now - this.last.at < TALK_DEDUPE_MS) return
      this.last = {n, at: now}
    }
    if (this.busy) {
      // in a conversation only the newest matters; the user's own question wins
      if (fromUser || !this.pending?.fromUser) this.pending = {trigger, fromUser}
      return
    }
    const session = this.session
    this.busy = true
    this.deps.log("talk", `${fromUser ? "Ваш вопрос" : trigger.kind === "prompt" ? "Подсказать" : "Вопрос"}: ${trigger.text}`)
    if (fromUser) this.setScreen(answerScreen(trigger.text, "…думаю"))
    const prev = (this.record?.notes ?? []).slice(-PREV_HINTS).map((x) => ({q: x.q ?? "", a: x.text}))
    const context = this.recent.slice(0, -1).join(" ")
    const {system, user} = buildTalkPrompt(context, prev, trigger, fromUser, detectLang(trigger.text))
    try {
      const reply = await this.deps.complete(system, user)
      if (session !== this.session) return
      const qa = parseAnswer(reply, trigger.text)
      if (!qa) {
        this.deps.log("talk", "Подсказка не нужна")
        if (fromUser) this.setScreen("")
        return
      }
      const kind: LectureNote["kind"] = fromUser ? "you" : trigger.kind === "prompt" ? "hint" : "qa"
      this.addNote({t: this.deps.now(), kind, q: qa.q, text: qa.a})
      this.deps.log("talk", `→ ${qa.a}`)
      this.setScreen(answerScreen(qa.q, qa.a), TALK_SHOW_MS)
    } catch (e) {
      if (session !== this.session) return
      this.showError(e)
    } finally {
      if (session === this.session) {
        this.busy = false
        const next = this.pending
        this.pending = null
        if (next) void this.hint(next.trigger, next.fromUser, true)
      }
    }
  }

  private addNote(n: LectureNote): void {
    if (!this.record) this.record = {startedAt: n.t, notes: []}
    this.record.notes.push(n)
    if (this.record.notes.length > NOTES_MAX) this.record.notes.splice(0, this.record.notes.length - NOTES_MAX)
    this.deps.save(this.record)
    this.deps.onChange()
  }

  /** Show text; with `forMs`, clear it afterwards unless something newer replaced it. */
  private setScreen(text: string, forMs = 0): void {
    this.cancelScreenTimer()
    this.screen = text
    if (text) this.deps.show(text)
    else this.deps.clear()
    if (forMs > 0 && text) {
      this.screenTimer = this.deps.setTimer(() => {
        this.screenTimer = null
        if (this.active && this.screen === text) {
          this.screen = ""
          this.deps.clear()
          this.deps.onChange()
        }
      }, forMs)
    }
    this.deps.onChange()
  }

  private cancelScreenTimer(): void {
    if (this.screenTimer != null) this.deps.clearTimer(this.screenTimer)
    this.screenTimer = null
  }

  private showError(e: unknown): void {
    const human = this.deps.explainError(e)
    this.deps.log("error", `Беседа: ${human}`)
    const now = this.deps.now()
    if (now - this.lastErrorShownAt < ERROR_SHOW_EVERY_MS) return
    this.lastErrorShownAt = now
    this.setScreen(human, TALK_SHOW_MS)
  }
}
