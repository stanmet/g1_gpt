/**
 * Lecture mode: the glasses keep listening to the lecturer and show the gist as short key
 * points instead of a word-for-word translation. When the lecturer asks the audience a
 * question, a short answer is shown right away.
 *
 *   speech ──▶ buffer ──(every N s — 15 by default — or a pause)──▶ AI: 1–2 key points ──▶ glasses
 *      └──▶ question to the audience? ──▶ AI: short answer ──▶ glasses (held 30 s)
 *
 * The glasses show a rolling feed: the newest points at the bottom («• »), earlier ones above («· »).
 *
 * Independent of Mentra and of the assistant, so it can be tested with fakes.
 */
import {G1_LINES, sanitizeForG1, wrapLines} from "./g1text"
import {detectLang, normalize, type Lang} from "./voice"

export interface LectureNote {
  t: number
  /**
   * point = key point from the lecture; qa = someone asked (the lecturer, the other person), the AI
   * answered; you = the user asked («Вопрос, …»); hint = the user trailed off («X — это…») and got a prompt.
   */
  kind: "point" | "qa" | "you" | "hint" | "tip" | "quote"
  text: string
  q?: string
}

export interface LectureRecord {
  startedAt: number
  endedAt?: number
  notes: LectureNote[]
}

/** How often key points come by default, in seconds (setting «Тезисы каждые»). */
export const DEFAULT_LECTURE_EVERY_SEC = 15
export const LECTURE_EVERY_MIN_SEC = 10
export const LECTURE_EVERY_MAX_SEC = 60

export interface LectureTiming {
  /** Summarise once minWords have been heard and this much time has passed since the last summary… */
  intervalMs: number
  minWords: number
  /** …or right away when the buffer gets this long. */
  maxWords: number
  /** A pause this long flushes what was said, if it is at least flushMinWords long. */
  flushMs: number
  flushMinWords: number
  /** Key points per summary. */
  maxPoints: number
}

/** Lecturers speak about 2–2.5 words a second; thresholds follow the chosen interval. */
export function lectureTiming(everySec: number): LectureTiming {
  const sec = Math.max(LECTURE_EVERY_MIN_SEC, Math.min(LECTURE_EVERY_MAX_SEC, Math.round(Number(everySec) || DEFAULT_LECTURE_EVERY_SEC)))
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))
  return {
    intervalMs: sec * 1000,
    minWords: clamp(sec * 1.2, 10, 70),
    maxWords: clamp(sec * 4, 50, 240),
    flushMs: clamp(sec * 500, 4000, 12000),
    flushMinWords: 8,
    maxPoints: sec <= 25 ? 2 : 3,
  }
}

/** An answer stays on the glasses this long before key points take the screen again. */
export const LECTURE_ANSWER_HOLD_MS = 30_000
/** Words of recent lecture speech given to the AI as context for a question. */
const CONTEXT_WORDS = 600
/** Restarting within this time after a stop continues the same notes (e.g. after a quick switch to translation). */
export const LECTURE_RESUME_MS = 20 * 60_000
/** Earlier key points given to the AI so it does not repeat them. */
const PREV_POINTS = 8
const NOTES_MAX = 400
const ERROR_SHOW_EVERY_MS = 60_000

export function wordCount(s: string): number {
  return String(s ?? "")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

// ───────────────────────── questions to the audience ─────────────────────────

/** Organisational questions nobody needs an answer to. */
const HOUSEKEEPING = [
  "any questions", "are there any questions", "do you have any questions", "any more questions", "any other questions",
  "questions so far", "can you hear me", "can everyone hear", "can you all hear", "can you see", "can everyone see",
  "is that clear", "is this clear", "does that make sense", "does this make sense", "are you with me", "are we ready",
  "everyone ready", "is everyone ready", "are you ready", "is everyone here", "shall we start", "shall we begin",
  "shall we continue", "ok", "okay", "right", "yes", "all right", "alright", "you know",
  "есть вопросы", "есть ли вопросы", "какие то вопросы", "все слышат", "всем слышно", "меня слышно", "понятно",
  "всем понятно", "всё понятно", "все понятно", "готовы", "продолжим", "начнем", "начинаем", "да",
]
/** Phrases that address the audience even without a question mark from speech recognition. */
const AUDIENCE_CUES = [
  "does anyone", "does anybody", "can anyone", "can anybody", "can someone", "could anyone", "could someone",
  "anyone know", "anybody know", "who can tell", "who knows", "who can explain", "who wants to", "any ideas",
  "any guesses", "what do you think", "what would you say", "raise your hand", "hands up", "who remembers",
  "кто знает", "кто может", "кто скажет", "кто нибудь", "как вы думаете", "есть идеи", "кто помнит", "поднимите руку",
]

/**
 * The sentence in which the lecturer asks the audience something, or null.
 * Speech recognition usually adds "?"; explicit cues ("does anyone know…") count without it.
 */
export function findAudienceQuestion(text: string): string | null {
  const sentences = String(text ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i]
    const n = normalize(s)
    if (wordCount(s) < 4) continue
    if (HOUSEKEEPING.some((h) => n === h || n.startsWith(h + " "))) continue
    if (/\?["»”')\s]*$/.test(s) || AUDIENCE_CUES.some((c) => (" " + n + " ").includes(" " + c + " "))) return s
  }
  return null
}

// ───────────────────────── prompts ─────────────────────────

function langName(lang: Lang): string {
  return lang === "en" ? "английском (English)" : "русском"
}

export function buildPointsPrompt(prevPoints: string[], chunk: string, lang: Lang, maxPoints = 2): {system: string; user: string} {
  const system = [
    "Ты помогаешь студенту на лекции. Твой ответ показывается на крошечном дисплее умных очков: 5 строк примерно по 30 символов.",
    "Тебе дают свежий фрагмент речи лектора, распознанный автоматически: возможны ошибки распознавания и обрывки фраз — угадывай смысл по контексту.",
    `Выдели суть: ${maxPoints <= 1 ? "один короткий тезис" : `1–${maxPoints} коротких тезиса (чаще хватает одного)`} на ${langName(lang)} языке, каждый с новой строки и начинается с «• », не длиннее 12 слов.`,
    "Не переводи и не пересказывай дословно — только главное: определения, утверждения, формулы, числа и даты, примеры, выводы. Термины можно оставлять в оригинале.",
    "Если лектор цитирует кого-то, сделай отдельный тезис «Цитата: автор (источник) — суть»; если цитату приписали не тому — укажи настоящего автора.",
    "Не повторяй уже записанные тезисы. Если во фрагменте нет ничего содержательного (приветствие, организационные моменты, шум, повтор), ответь ровно SKIP.",
    "Без Markdown, без вступлений и пояснений.",
  ].join("\n")
  const prev = prevPoints.length ? `Уже записанные тезисы:\n${prevPoints.map((p) => "• " + p).join("\n")}\n\n` : ""
  return {system, user: `${prev}Новый фрагмент лекции:\n«${chunk.trim()}»`}
}

export function buildAnswerPrompt(
  context: string,
  question: string,
  lang: Lang,
  fromUser: boolean,
): {system: string; user: string} {
  const system = fromUser
    ? [
        "Студент сидит на лекции и тихо задаёт тебе вопрос. Ответ показывается на крошечном дисплее умных очков.",
        `Ответь коротко и по делу, не больше 30 слов, на ${langName(lang)} языке. Если вопрос относится к лекции — учитывай её контекст.`,
        "Формат ровно две строки:\nQ: <вопрос, до 8 слов>\nA: <ответ>",
        "Без Markdown и вступлений.",
      ].join("\n")
    : [
        "Ты помогаешь студенту на лекции. Лектор только что обратился к аудитории с вопросом; текст распознан автоматически, возможны ошибки.",
        `Дай короткий правильный ответ, который студент может сказать вслух: не больше 25 слов, на ${langName(lang)} языке. Учитывай контекст лекции.`,
        "Формат ровно две строки:\nQ: <вопрос лектора, до 8 слов>\nA: <ответ>",
        "Если это организационный вопрос (есть ли вопросы, слышно ли, понятно ли, готовы ли) или вопрос, на который нечего ответить по существу, ответь ровно SKIP.",
        "Без Markdown и вступлений.",
      ].join("\n")
  const ctx = context.trim() ? `Недавно на лекции:\n«${context.trim()}»\n\n` : ""
  return {system, user: `${ctx}${fromUser ? "Вопрос студента" : "Вопрос лектора"}: «${question.trim()}»`}
}

const isSkip = (t: string) => /^\s*skip\b/i.test(t) || /^\s*[—–-]\s*$/.test(t)

/** Key points from the AI reply; [] when the fragment had nothing worth noting. */
export function parsePoints(text: string): string[] {
  if (!String(text ?? "").trim() || isSkip(text)) return []
  return String(text)
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[•*\-–—]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l && !isSkip(l))
    .slice(0, 3)
}

/**
 * Rolling feed for the glasses: the newest points at the bottom marked «• », earlier ones above
 * marked «· », as many as fit on the screen.
 */
export function feedScreen(allPoints: string[], newCount: number): string {
  const blocks: string[][] = []
  let used = 0
  for (let i = allPoints.length - 1; i >= 0; i--) {
    const isNew = i >= allPoints.length - newCount
    const lines = wrapLines(sanitizeForG1((isNew ? "• " : "· ") + allPoints[i]))
    if (used + lines.length > G1_LINES) {
      if (!blocks.length) blocks.unshift(lines) // the newest point alone is too long: pointsScreen trims it
      break
    }
    blocks.unshift(lines)
    used += lines.length
  }
  const lines = blocks.flat()
  if (lines.length <= G1_LINES) return lines.join("\n")
  return pointsScreen(allPoints.slice(-1))
}

/** {q, a} from "Q: …\nA: …"; null for SKIP. Tolerates a reply without the markers. */
export function parseAnswer(text: string, fallbackQ: string): {q: string; a: string} | null {
  const t = String(text ?? "").trim()
  if (!t || isSkip(t)) return null
  const q = /^\s*(?:Q|В|Вопрос)\s*[:：]\s*(.+)$/im.exec(t)?.[1]?.trim()
  const aMatch = /^\s*(?:A|О|Ответ)\s*[:：]\s*([\s\S]+)$/im.exec(t)
  const a = (aMatch ? aMatch[1] : t.replace(/^\s*(?:Q|В|Вопрос)\s*[:：].*$/im, ""))
    .replace(/\*\*/g, "")
    .replace(/\s*\n\s*/g, " ")
    .trim()
  if (!a || isSkip(a)) return null
  return {q: q || fallbackQ, a}
}

// ───────────────────────── screens ─────────────────────────

export function pointsScreen(points: string[]): string {
  const lines = wrapLines(sanitizeForG1(points.map((p) => "• " + p).join("\n")))
  if (lines.length <= G1_LINES) return lines.join("\n")
  const kept = lines.slice(0, G1_LINES)
  kept[G1_LINES - 1] = kept[G1_LINES - 1].replace(/\s*\S*$/, "") + "…"
  return kept.join("\n")
}

/** One line for the question, up to four for the answer. */
export function answerScreen(q: string, a: string): string {
  const qLines = wrapLines(sanitizeForG1("? " + q))
  const qLine = qLines.length > 1 ? qLines[0].replace(/\s*\S*$/, "") + "…" : qLines[0] ?? ""
  const aLines = wrapLines(sanitizeForG1("→ " + a))
  const room = G1_LINES - (qLine ? 1 : 0)
  const shown = aLines.slice(0, room)
  if (aLines.length > room) shown[room - 1] = shown[room - 1].replace(/\s*\S*$/, "") + "…"
  return [qLine, ...shown].filter(Boolean).join("\n")
}

// ───────────────────────── the mode itself ─────────────────────────

export interface LectureDeps {
  /** One AI call with its own system prompt and no conversation history. */
  complete(system: string, user: string): Promise<string>
  /** Turns an AI error into a short message for the glasses. */
  explainError(e: unknown): string
  show(text: string): void
  clear(): void
  log(kind: "lecture" | "error" | "info", msg: string): void
  /** Language for key points and answers (the «Язык перевода и тезисов» setting). */
  lang(): Lang
  /** How often key points come, in seconds (setting «Тезисы каждые»). */
  everySec?(): number
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(id: unknown): void
  save(record: LectureRecord): void
  onChange(): void
}

export class Lecture {
  active = false
  record: LectureRecord | null
  screen = ""

  private session = 0
  private buffer: string[] = []
  private recent: string[] = []
  private lastSummaryAt = 0
  private summarizing = false
  private answering = false
  private pendingQuestion: {text: string; fromUser: boolean} | null = null
  private holdUntil = 0
  /** Key points arrived while an answer was held; show the feed when the hold ends. */
  private pendingFeed = false
  private lastNewCount = 0
  private flushTimer: unknown = null
  private holdTimer: unknown = null
  private lastErrorShownAt = -Infinity

  constructor(
    private readonly deps: LectureDeps,
    saved: LectureRecord | null = null,
  ) {
    this.record = saved
  }

  start(): void {
    this.stopTimers()
    this.session++
    this.active = true
    this.buffer = []
    this.recent = []
    this.summarizing = false
    this.answering = false
    this.pendingQuestion = null
    this.pendingFeed = false
    this.holdUntil = 0
    this.lastSummaryAt = this.deps.now()
    const prev = this.record
    const resume = Boolean(prev?.endedAt && this.deps.now() - prev.endedAt < LECTURE_RESUME_MS)
    if (resume && prev) delete prev.endedAt
    else this.record = {startedAt: this.deps.now(), notes: []}
    this.deps.save(this.record!)
    const en = this.deps.lang() === "en"
    const sec = this.timing().intervalMs / 1000
    this.setScreen(
      en
        ? `Lecture mode\n• key points every ~${sec} s\n• answers to the lecturer's questions\nStop: «стоп лекция»`
        : `Режим лекции\n• тезисы примерно раз в ${sec} с\n• ответы на вопросы лектора\nВыключить: «стоп лекция»`,
    )
    this.deps.log("lecture", resume ? "Режим лекции включён — продолжаю прежний конспект" : "Режим лекции включён")
    this.deps.onChange()
  }

  stop(): {points: number; answers: number} {
    const notes = this.record?.notes ?? []
    const summary = {points: notes.filter((n) => n.kind === "point").length, answers: notes.filter((n) => n.kind !== "point").length}
    if (!this.active) return summary
    this.active = false
    this.session++
    this.stopTimers()
    this.buffer = []
    this.pendingQuestion = null
    this.pendingFeed = false
    this.screen = ""
    if (this.record) {
      this.record.endedAt = this.deps.now()
      this.deps.save(this.record)
    }
    this.deps.log("lecture", `Режим лекции выключен: тезисов ${summary.points}, ответов ${summary.answers}`)
    this.deps.onChange()
    return summary
  }

  /** A final transcript of what was heard (the lecturer). */
  onSpeech(text: string): void {
    if (!this.active) return
    const t = String(text ?? "").trim()
    if (!t) return
    this.buffer.push(t)
    this.recent.push(t)
    this.trimRecent()

    const q = findAudienceQuestion(t)
    if (q) this.answer(q, false)

    const tm = this.timing()
    const words = wordCount(this.buffer.join(" "))
    const since = this.deps.now() - this.lastSummaryAt
    if (words >= tm.maxWords || (words >= tm.minWords && since >= tm.intervalMs)) this.summarize()
    this.armFlush()
  }

  /** Something answered on its own path («как будет по-английски …»): shown like an answer, held, noted. */
  async aside(placeholder: string, run: () => Promise<{q: string; a: string} | null>): Promise<void> {
    if (!this.active) return
    const session = this.session
    this.setScreen(answerScreen(placeholder, "…"))
    try {
      const qa = await run()
      if (session !== this.session || !qa) return
      this.addNote({t: this.deps.now(), kind: "you", q: qa.q, text: qa.a})
      this.setScreen(answerScreen(qa.q, qa.a))
      this.hold()
    } catch (e) {
      if (session !== this.session) return
      this.showError(e)
    }
  }

  /** The user's own question during the lecture («Вопрос, …»). */
  askUser(question: string): void {
    if (!this.active || !question.trim()) return
    this.answer(question.trim(), true)
  }

  // ── internals ──

  private trimRecent(): void {
    let words = wordCount(this.recent.join(" "))
    while (this.recent.length > 1 && words > CONTEXT_WORDS) {
      words -= wordCount(this.recent.shift()!)
    }
  }

  private timing(): LectureTiming {
    return lectureTiming(this.deps.everySec?.() ?? DEFAULT_LECTURE_EVERY_SEC)
  }

  private armFlush(): void {
    if (this.flushTimer != null) this.deps.clearTimer(this.flushTimer)
    const tm = this.timing()
    this.flushTimer = this.deps.setTimer(() => {
      this.flushTimer = null
      if (this.active && wordCount(this.buffer.join(" ")) >= tm.flushMinWords) this.summarize()
    }, tm.flushMs)
  }

  private allPoints(): string[] {
    return (this.record?.notes ?? []).filter((n) => n.kind === "point").map((n) => n.text)
  }

  private async summarize(): Promise<void> {
    if (this.summarizing || !this.buffer.length) return
    const session = this.session
    const chunk = this.buffer.join(" ")
    this.buffer = []
    this.summarizing = true
    this.lastSummaryAt = this.deps.now()
    const prev = this.allPoints().slice(-PREV_POINTS)
    const {system, user} = buildPointsPrompt(prev, chunk, this.deps.lang(), this.timing().maxPoints)
    try {
      const reply = await this.deps.complete(system, user)
      if (session !== this.session) return
      const points = parsePoints(reply)
      if (!points.length) {
        this.deps.log("lecture", `Тезисов нет (${wordCount(chunk)} слов без сути)`)
        return
      }
      const t = this.deps.now()
      for (const p of points) this.addNote({t, kind: "point", text: p})
      this.deps.log("lecture", points.map((p) => "• " + p).join(" "))
      this.lastNewCount = points.length
      if (this.deps.now() < this.holdUntil) this.pendingFeed = true
      else this.setScreen(feedScreen(this.allPoints(), points.length))
    } catch (e) {
      if (session !== this.session) return
      this.showError(e)
    } finally {
      if (session === this.session) {
        this.summarizing = false
        // speech kept coming while the AI was busy
        if (wordCount(this.buffer.join(" ")) >= this.timing().maxWords) void this.summarize()
      }
    }
  }

  private async answer(question: string, fromUser: boolean): Promise<void> {
    if (this.answering) {
      // keep only the latest; the user's own question wins over the lecturer's
      if (fromUser || !this.pendingQuestion?.fromUser) this.pendingQuestion = {text: question, fromUser}
      return
    }
    const session = this.session
    this.answering = true
    this.deps.log("lecture", `${fromUser ? "Ваш вопрос" : "Вопрос лектора"}: ${question}`)
    if (fromUser) this.setScreen(answerScreen(question, "…думаю"))
    const {system, user} = buildAnswerPrompt(this.recent.join(" "), question, fromUser ? detectLang(question) : this.deps.lang(), fromUser)
    try {
      const reply = await this.deps.complete(system, user)
      if (session !== this.session) return
      const qa = parseAnswer(reply, question)
      if (!qa) {
        this.deps.log("lecture", "Организационный вопрос — без ответа")
        return
      }
      this.addNote({t: this.deps.now(), kind: fromUser ? "you" : "qa", q: qa.q, text: qa.a})
      this.deps.log("lecture", `→ ${qa.a}`)
      this.setScreen(answerScreen(qa.q, qa.a))
      this.hold()
    } catch (e) {
      if (session !== this.session) return
      this.showError(e)
    } finally {
      if (session === this.session) {
        this.answering = false
        const next = this.pendingQuestion
        this.pendingQuestion = null
        if (next) void this.answer(next.text, next.fromUser)
      }
    }
  }

  private hold(): void {
    this.holdUntil = this.deps.now() + LECTURE_ANSWER_HOLD_MS
    if (this.holdTimer != null) this.deps.clearTimer(this.holdTimer)
    this.holdTimer = this.deps.setTimer(() => {
      this.holdTimer = null
      this.holdUntil = 0
      if (!this.active) return
      if (this.pendingFeed) {
        this.setScreen(feedScreen(this.allPoints(), this.lastNewCount))
        this.pendingFeed = false
      }
    }, LECTURE_ANSWER_HOLD_MS)
  }

  private addNote(n: LectureNote): void {
    if (!this.record) this.record = {startedAt: n.t, notes: []}
    this.record.notes.push(n)
    if (this.record.notes.length > NOTES_MAX) this.record.notes.splice(0, this.record.notes.length - NOTES_MAX)
    this.deps.save(this.record)
    this.deps.onChange()
  }

  private setScreen(text: string): void {
    this.screen = text
    this.deps.show(text)
    this.deps.onChange()
  }

  private showError(e: unknown): void {
    const human = this.deps.explainError(e)
    this.deps.log("error", `Лекция: ${human}`)
    const now = this.deps.now()
    if (now - this.lastErrorShownAt < ERROR_SHOW_EVERY_MS) return
    this.lastErrorShownAt = now
    if (now >= this.holdUntil) this.setScreen(human)
  }

  private stopTimers(): void {
    for (const k of ["flushTimer", "holdTimer"] as const) {
      if (this[k] != null) this.deps.clearTimer(this[k])
      this[k] = null
    }
  }
}

/** Plain-text notes for copying: key points, then questions with answers, in order. */
export function notesAsText(
  record: LectureRecord | null,
  fmtTime: (t: number) => string,
  opts: {title?: string; asked?: string} = {},
): string {
  if (!record?.notes.length) return ""
  const head = `${opts.title ?? "Конспект лекции"} — ${fmtTime(record.startedAt)}`
  const label = (k: LectureNote["kind"]) => (k === "you" ? "Мой вопрос" : k === "hint" ? "Подсказка" : (opts.asked ?? "Вопрос лектора"))
  const lines = record.notes.map((n) =>
    n.kind === "point"
      ? `• ${n.text}`
      : n.kind === "tip"
        ? `${n.q}: ${n.text}`
        : n.kind === "quote"
          ? `Цитата: «${n.q ?? ""}» — ${n.text}`
          : `${label(n.kind)}: ${n.q ?? ""}\n  → ${n.text}`,
  )
  return [head, "", ...lines].join("\n")
}
