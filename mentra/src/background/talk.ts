/**
 * Conversation mode («Беседа»): a quiet prompter while you talk to someone.
 *
 *   someone asks a factual question («Кто такой Кант? Когда он родился?»)  ──▶ short answer on the glasses
 *   you start explaining and trail off («А категорический императив — это…») ──▶ the facts to finish with
 *
 *   and, every ~10 s of talk, one proactive hint toward the user's goal:
 *     «Факт: …», «Ответ: …», «Спроси: …», «Скажи: …»
 *
 * Questions go through a fast lane of their own (a placeholder shows at once, the answer replaces
 * it), checked locally first from the live transcript; proactive hints never hold them up. The
 * glasses show a rolling feed, newest at the bottom. Independent of Mentra, tested with fakes.
 */
import {feedScreen, LECTURE_RESUME_MS, parseAnswer, wordCount, type LectureNote, type LectureRecord} from "./lecture"
import {fitScreen} from "./g1text"
import {detectLang, normalize, parsePhraseRequest, type Lang} from "./voice"

/** A hint stays on the glasses this long, then the screen clears (the next hint replaces it sooner). */
export const TALK_SHOW_MS = 30_000
/** The same question heard again within this time (repeated, or re-sent by recognition) is ignored. */
export const TALK_DEDUPE_MS = 20_000
/**
 * Mentra's recognizer (Soniox) closes an utterance up to ~2.5 s after speech stops. The live
 * (interim) text is used instead: a finished «…?» is answered at once, a trailing «… это» once the
 * live text has not changed for this long.
 */
export const TALK_SETTLE_MS = 900
/** After «Как говорится…» + pause, the next phrase within this time is taken as the quote. */
export const TALK_QUOTE_WAIT_MS = 8000
/** The intro screen is cleared after this long. */
const INTRO_MS = 5000
const CONTEXT_WORDS = 300
const PREV_HINTS = 4
const PREV_TIPS = 6
/** Default and minimum interval of proactive hints, in seconds (setting «Подсказки по ходу»). */
export const DEFAULT_TALK_TIP_SEC = 10
export const TALK_TIP_MIN_SEC = 5
/** A proactive hint needs at least this many new words of conversation. */
export const TALK_TIP_MIN_WORDS = 6
/** A fresh answer to a question is not pushed up by a proactive hint for this long. */
export const TALK_ANSWER_PRIORITY_MS = 10_000
const NOTES_MAX = 300
const ERROR_SHOW_EVERY_MS = 60_000

export interface TalkTrigger {
  /**
   * question = someone asked; prompt = the speaker trailed off on «это», «родился в», «is»…;
   * quote = someone quoted («как говорил Черчилль, …», «есть такая фраза: …») — who said it, where.
   */
  kind: "question" | "prompt" | "quote"
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

const ENDS_WITH_QUESTION = /\?["»”')\s]*$/

/** A sentence that asks something worth a hint (not small talk), or null. */
function questionIn(s: string): TalkTrigger | null {
  const words = contentWords(normalize(s))
  if (words.length < 3) return null
  if (parsePhraseRequest(s)) return null // «как будет по-английски …» is translated on its own path
  const n = words.join(" ")
  if (SMALL_TALK.some((st) => n === st || n.startsWith(st + " "))) return null
  const asked = ENDS_WITH_QUESTION.test(s)
  // without «?» only if recognition did not close it with a full stop («Как я говорил, это важно.» is not a question)
  const open = !/(?<!\.)[.!]["»”')\s]*$/.test(s)
  const interrogative = open && (RU_Q.has(words[0]) || EN_Q.has(words[0]) || words[1] === "ли") && words.length <= 14
  return asked || interrogative ? {kind: "question", text: s} : null
}

/** Finished questions («…?») in live text, oldest first. */
export function finishedQuestions(text: string): TalkTrigger[] {
  return sentencesOf(text)
    .filter((s) => ENDS_WITH_QUESTION.test(s))
    .map(questionIn)
    .filter((t): t is TalkTrigger => t !== null)
}

/** Hesitation words people add after «это»: «это… ну… как бы». */
const TRAILING_FILLERS = new Set(["ну", "э", "эм", "ээ", "мм", "как", "бы", "вот", "типа", "uh", "um", "er", "like", "well"])

/** What in this utterance needs a hint, or null. Cheap and local: decides whether to call the AI. */
export function findTalkTrigger(text: string): TalkTrigger | null {
  const sentences = sentencesOf(text)
  for (let i = sentences.length - 1; i >= 0; i--) {
    const q = questionIn(sentences[i])
    if (q) return q
  }
  const last = sentences.at(-1)
  if (last) {
    const words = normalize(last).split(" ").filter(Boolean)
    while (words.length > 3 && TRAILING_FILLERS.has(words[words.length - 1])) words.pop()
    const n = words.join(" ")
    const closed = /(?<!\.)[.!]["»”')\s]*$/.test(last) // a single full stop; «...» and «…» trail off
    const cues = closed ? STRONG_CUES : [...STRONG_CUES, ...WEAK_CUES]
    if (n.split(" ").length >= 3 && cues.some((c) => n.endsWith(" " + c))) return {kind: "prompt", text: last}
  }
  return null
}

function langName(lang: Lang): string {
  return lang === "en" ? "английском (English)" : "русском"
}

// ───────────────────────── quotes ─────────────────────────

/** Words that announce a quote, normalized. */
const QUOTE_CUES = [
  "как говорил", "как говорила", "как говорили", "как сказал", "как сказала", "как писал", "как писала",
  "как говорится", "как гласит", "как учил", "есть такая фраза", "есть фраза", "есть такое выражение", "есть выражение",
  "есть такая поговорка", "есть поговорка", "есть пословица", "как в поговорке", "как в пословице", "по словам",
  "цитата", "цитирую", "процитирую", "крылатая фраза", "известная фраза", "знаменитая фраза", "сказал однажды",
  "говорил однажды", "однажды сказал", "as the saying goes", "there s a saying", "there is a saying", "to quote",
  "famously said", "once said", "in the words of", "as they say",
]
/** «as Churchill said», «as Einstein put it». */
const AS_SAID = /\bas\s+(?:[\p{L}.'-]+\s+){1,3}(?:said|says|wrote|put it)\b/iu
/** Words of the quote itself needed before asking who said it. */
const QUOTE_MIN_WORDS = 4

/**
 * A quote in the utterance: «Как говорил Черчилль, успех — это…», «Есть такая фраза: …», «as X said»,
 * or words in «quotes». `complete` is false while the quote itself has not been said yet
 * («Как говорится…» + pause) — then the next phrase completes it.
 */
export function findQuote(text: string): {text: string; complete: boolean} | null {
  const t = String(text ?? "").replace(/\s+/g, " ").trim()
  if (!t) return null
  const quoted = /[«“„"]([^»”"]{8,})[»”"]/u.exec(t)
  if (quoted && wordCount(quoted[1]) >= QUOTE_MIN_WORDS) return {text: t, complete: true}
  const words = normalize(t).split(" ").filter(Boolean)
  const padded = ` ${words.join(" ")} `
  let end = -1
  for (const c of QUOTE_CUES) {
    const i = padded.indexOf(` ${c} `)
    if (i < 0) continue
    const cueEnd = padded.slice(0, i).trim().split(" ").filter(Boolean).length + c.split(" ").length
    if (end < 0 || cueEnd < end) end = cueEnd
  }
  const as = AS_SAID.exec(t)
  if (as) {
    const cueEnd = normalize(t.slice(0, as.index + as[0].length)).split(" ").filter(Boolean).length
    if (end < 0 || cueEnd < end) end = cueEnd
  }
  if (end < 0) return null
  return {text: t, complete: words.length - end >= QUOTE_MIN_WORDS}
}

export function buildTalkPrompt(
  context: string,
  prevHints: {q: string; a: string}[],
  trigger: TalkTrigger,
  fromUser: boolean,
  lang: Lang,
): {system: string; user: string} {
  if (trigger.kind === "quote") return buildQuotePrompt(context, trigger.text, lang)
  const system = [
    "Ты — незаметный суфлёр в умных очках. Пользователь разговаривает с другим человеком; ты видишь распознанную речь (возможны ошибки, неизвестно, кто говорит). Ответ показывается на крошечном дисплее: 5 строк примерно по 30 символов.",
    "Если в последней реплике задан вопрос, требующий точной информации (люди, даты, места, числа, определения, термины, факты), дай эти сведения так, чтобы пользователь мог сразу сказать их вслух.",
    "Если пользователь начал объяснять и запнулся («Категорический императив — это…», «Он родился в…»), дай то, чем закончить фразу.",
    `Коротко: до 25 слов, сначала главное — даты, числа, суть. Пиши на ${langName(lang)} языке.`,
    "Учитывай разговор и прошлые подсказки: «он», «а это…» обычно относятся к той же теме.",
    "Формат ровно две строки:\nQ: <тема, до 6 слов>\nA: <сведения>",
    fromUser
      ? "Это прямой вопрос пользователя к тебе — ответь обязательно."
      : "Ответь ровно SKIP, только если реплика явно личная или бытовая (как дела, будешь кофе, где встретимся). Если сомневаешься — лучше дай короткую полезную справку по теме, чем промолчать.",
    "Без Markdown и вступлений.",
  ].join("\n")
  const ctx = context.trim() ? `Недавно в разговоре:\n«${context.trim()}»\n\n` : ""
  const prev = prevHints.length ? `Прошлые подсказки:\n${prevHints.map((h) => `— ${h.q}: ${h.a}`).join("\n")}\n\n` : ""
  const label = fromUser ? "Вопрос пользователя" : trigger.kind === "prompt" ? "Последняя реплика (оборвана)" : "Последняя реплика"
  return {system, user: `${ctx}${prev}${label}: «${trigger.text.trim()}»`}
}

export function buildQuotePrompt(context: string, text: string, lang: Lang): {system: string; user: string} {
  const system = [
    "Ты — незаметный суфлёр в умных очках. В разговоре только что прозвучала цитата, афоризм, крылатая фраза или пословица (речь распознана автоматически, возможны ошибки). Ответ показывается на крошечном дисплее.",
    "Определи, чья это цитата и откуда: автор, произведение или речь, год. Если цитату приписали не тому человеку или авторство спорно — так и скажи и назови настоящего автора. Для пословицы — чья она (например, русская пословица) и её смысл в двух словах.",
    `Коротко: до 20 слов, на ${langName(lang)} языке. Формат ровно две строки:\nQ: <начало цитаты, до 6 слов>\nA: <автор — источник, год>`,
    "Если это не цитата и не устойчивое выражение — ответь ровно SKIP. Без Markdown и вступлений.",
  ].join("\n")
  const ctx = context.trim() ? `Недавно в разговоре:\n«${context.trim()}»\n\n` : ""
  return {system, user: `${ctx}Реплика с цитатой: «${text.trim()}»`}
}

// ───────────────────────── proactive hints ─────────────────────────

export type TipLabel = "fact" | "answer" | "ask" | "say" | "quote"

const TIP_LABELS: Record<Lang, Record<TipLabel, string>> = {
  ru: {fact: "Факт", answer: "Ответ", ask: "Спроси", say: "Скажи", quote: "Цитата"},
  en: {fact: "Fact", answer: "Answer", ask: "Ask", say: "Say", quote: "Quote"},
}
const TIP_BY_WORD: Record<string, TipLabel> = {
  факт: "fact", ответ: "answer", ответь: "answer", спроси: "ask", вопрос: "ask", скажи: "say", идея: "say", мысль: "say",
  fact: "fact", answer: "answer", ask: "ask", say: "say", idea: "say", цитата: "quote", quote: "quote",
}

export function buildTipPrompt(
  context: string,
  prevTips: string[],
  goal: string,
  lang: Lang,
): {system: string; user: string} {
  const L = TIP_LABELS[lang]
  const system = [
    "Ты — суфлёр в умных очках и помогаешь пользователю вести живой разговор. Тебе дают свежую расшифровку речи (возможны ошибки, неизвестно, кто говорит). Подсказка показывается на крошечном дисплее и должна читаться за секунду.",
    `Цель пользователя в разговоре: ${goal.trim() || "поддерживать интересный и содержательный разговор"}.`,
    "Дай ОДНУ самую полезную прямо сейчас подсказку, до 15 слов, ровно в одной строке одного из видов:",
    `${L.quote}: <автор и источник — если только что прозвучала известная цитата, афоризм или крылатая фраза; это важнее остального>`,
    `${L.fact}: <точная справка о только что упомянутом человеке, месте, термине, событии, числе>`,
    `${L.answer}: <что ответить, если пользователю только что задали вопрос>`,
    `${L.ask}: <вопрос собеседнику, который продвинет разговор к цели или углубит тему>`,
    `${L.say}: <мысль, аргумент или пример, который стоит сказать сейчас>`,
    "Опирайся на последние реплики. Не повторяй прошлые подсказки. Факты — только точные.",
    `Пиши на ${lang === "en" ? "английском (English)" : "русском"} языке. Без Markdown и пояснений.`,
    "Если сейчас добавить нечего (пауза, бытовая мелочь, всё уже подсказано) — ответь ровно SKIP.",
  ].join("\n")
  const prev = prevTips.length ? `Прошлые подсказки:\n${prevTips.map((t) => "— " + t).join("\n")}\n\n` : ""
  return {system, user: `${prev}Разговор (последнее — внизу):\n«${context.trim()}»`}
}

/** {label, text} from «Спроси: …»; null for SKIP or an unknown shape. */
export function parseTip(text: string): {label: TipLabel; text: string} | null {
  const t = String(text ?? "").trim()
  if (!t || /^\s*skip\b/i.test(t)) return null
  const m = /^\s*[•*\-–—]?\s*([A-Za-zА-Яа-яЁё]+)\s*[:：]\s*(.+)$/m.exec(t)
  if (!m) return null
  const label = TIP_BY_WORD[m[1].toLowerCase()]
  const body = m[2].replace(/\*\*/g, "").trim()
  if (!label || !body || /^skip\b/i.test(body)) return null
  return {label, text: body}
}

export function tipLine(label: TipLabel, text: string, lang: Lang): string {
  return `${TIP_LABELS[lang][label]}: ${text}`
}

// ───────────────────────── the mode itself ─────────────────────────

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
  /** Proactive hints about every N seconds of conversation; 0 = only answers to questions. */
  everySec?(): number
  /** What the user wants from this conversation («договориться о скидке»); steers «Спроси»/«Скажи». */
  goal?(): string
}

interface FeedItem {
  id: number
  text: string
}

export class Talk {
  active = false
  record: LectureRecord | null
  screen = ""

  private session = 0
  private recent: string[] = []
  private interim = ""
  private settleTimer: unknown = null
  /** A quote was announced («Как говорится…») and its words are expected in the next phrase. */
  private quoteWait: {text: string; until: number} | null = null
  /** Recently handled triggers (normalized), so live text and the final do not ask twice. */
  private handled: {n: string; at: number}[] = []
  // questions lane — answers to what was asked, never wait for a proactive hint
  private qBusy = false
  private qPending: {trigger: TalkTrigger; fromUser: boolean} | null = null
  // proactive lane
  private tipBusy = false
  private lastTipAt = 0
  private wordsSinceTip = 0
  private lastAnswerAt = -Infinity
  // the glasses show a rolling feed, newest at the bottom
  private feed: FeedItem[] = []
  private feedSeq = 0
  private screenTimer: unknown = null
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
    this.interim = ""
    this.cancelSettle()
    this.handled = []
    this.qBusy = false
    this.qPending = null
    this.tipBusy = false
    this.lastTipAt = this.deps.now()
    this.wordsSinceTip = 0
    this.lastAnswerAt = -Infinity
    this.feed = []
    const prev = this.record
    const resume = Boolean(prev?.endedAt && this.deps.now() - prev.endedAt < LECTURE_RESUME_MS)
    if (resume && prev) delete prev.endedAt
    else this.record = {startedAt: this.deps.now(), notes: []}
    this.deps.save(this.record!)
    const goal = this.deps.goal?.().trim()
    const every = this.every()
    const ru = [
      "Режим беседы",
      "• ответы на вопросы с фактами",
      every ? `• подсказки примерно раз в ${every} с` : "• подскажу, если запнётесь",
      goal ? `• цель: ${goal}` : "Выключить: «стоп беседа»",
    ]
    const en = [
      "Conversation mode",
      "• answers to factual questions",
      every ? `• hints about every ${every} s` : "• a prompt when you trail off",
      goal ? `• goal: ${goal}` : "Stop: «стоп беседа»",
    ]
    this.paint(fitScreen((intro.en ? en : ru).join("\n")), INTRO_MS)
    this.deps.log("talk", resume ? "Режим беседы включён — продолжаю прежний список" : "Режим беседы включён")
    this.deps.onChange()
  }

  stop(): {hints: number} {
    const hints = this.record?.notes.length ?? 0
    if (!this.active) return {hints}
    this.active = false
    this.session++
    this.cancelScreenTimer()
    this.cancelSettle()
    this.qPending = null
    this.feed = []
    this.screen = ""
    if (this.record) {
      this.record.endedAt = this.deps.now()
      this.deps.save(this.record)
    }
    this.deps.log("talk", `Режим беседы выключен: подсказок ${hints}`)
    this.deps.onChange()
    return {hints}
  }

  /** Live text of the utterance still being spoken (by anyone). */
  onInterim(text: string): void {
    if (!this.active) return
    const t = String(text ?? "").trim()
    if (!t || t === this.interim) return
    this.interim = t
    // a finished «…?» inside the live text: answer now, not after the pause
    for (const q of finishedQuestions(t)) this.request(q, "на лету")
    // «… — это», «… родился в»: answer once the speaker has paused briefly
    this.cancelSettle()
    this.settleTimer = this.deps.setTimer(() => {
      this.settleTimer = null
      if (!this.active || this.interim !== t) return
      const quote = findQuote(t)
      if (quote?.complete) return this.request({kind: "quote", text: quote.text}, "пауза")
      if (quote) return // the quote itself is still to come
      const trigger = findTalkTrigger(t)
      if (trigger) this.request(trigger, "пауза")
    }, TALK_SETTLE_MS)
    this.maybeTip()
  }

  /** A final transcript of what was said (by anyone). */
  onSpeech(text: string): void {
    if (!this.active) return
    const t = String(text ?? "").trim()
    if (!t) return
    this.cancelSettle()
    this.interim = ""
    this.recent.push(t)
    let words = wordCount(this.recent.join(" "))
    while (this.recent.length > 1 && words > CONTEXT_WORDS) words -= wordCount(this.recent.shift()!)
    this.wordsSinceTip += wordCount(t)
    // «Как говорится…» + pause: the quote is the next phrase
    const waiting = this.quoteWait && this.deps.now() < this.quoteWait.until ? this.quoteWait.text : ""
    this.quoteWait = null
    const quote = findQuote(waiting ? `${waiting} ${t}` : t)
    if (quote?.complete) this.request({kind: "quote", text: quote.text}, "")
    else if (quote) this.quoteWait = {text: quote.text, until: this.deps.now() + TALK_QUOTE_WAIT_MS}
    else {
      const trigger = findTalkTrigger(t)
      if (trigger) this.request(trigger, "")
    }
    this.maybeTip()
  }

  /** The user's own question («Вопрос, …»): always answered. */
  askUser(question: string): void {
    if (!this.active || !question.trim()) return
    void this.answer({kind: "question", text: question.trim()}, true)
  }

  /**
   * Something the assistant answers on its own path («как будет по-английски стол»): a placeholder
   * shows at once in the feed, the result («стол → table») replaces it and goes to the list.
   */
  async aside(placeholder: string, run: () => Promise<{q: string; a: string} | null>, joiner = ": "): Promise<void> {
    if (!this.active) return
    const session = this.session
    const id = this.push(`${placeholder} …`)
    try {
      const qa = await run()
      if (session !== this.session) return
      if (!qa) return this.drop(id)
      this.addNote({t: this.deps.now(), kind: "you", q: qa.q, text: qa.a})
      this.lastAnswerAt = this.deps.now()
      this.replace(id, `${qa.q}${joiner}${qa.a}`)
    } catch (e) {
      if (session !== this.session) return
      this.drop(id)
      this.showError(e)
    }
  }

  // ── questions lane ──

  /** Asks the AI unless the same thing was just handled (from live text, a repeat, a re-send). */
  private request(trigger: TalkTrigger, via: string): void {
    const n = contentWords(normalize(trigger.text)).join(" ")
    const now = this.deps.now()
    this.handled = this.handled.filter((h) => now - h.at < TALK_DEDUPE_MS)
    const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 10 && (a.includes(b) || b.includes(a)))
    if (this.handled.some((h) => same(h.n, n))) return
    this.handled.push({n, at: now})
    if (via) this.deps.log("talk", `Услышал (${via}): ${trigger.text}`)
    void this.answer(trigger, false)
  }

  private async answer(trigger: TalkTrigger, fromUser: boolean): Promise<void> {
    if (this.qBusy) {
      // in a conversation only the newest matters; the user's own question wins
      if (fromUser || !this.qPending?.fromUser) this.qPending = {trigger, fromUser}
      return
    }
    const session = this.session
    this.qBusy = true
    const what = fromUser ? "Ваш вопрос" : {question: "Вопрос", prompt: "Подсказать", quote: "Цитата"}[trigger.kind]
    this.deps.log("talk", `${what}: ${trigger.text}`)
    // show at once that a hint is coming
    const placeholder = this.push(`${shorten(trigger.text, 40)} …`)
    const prev = (this.record?.notes ?? []).slice(-PREV_HINTS).map((x) => ({q: x.q ?? "", a: x.text}))
    const context = [...this.recent, this.interim].filter(Boolean).join(" ")
    const {system, user} = buildTalkPrompt(context, prev, trigger, fromUser, detectLang(trigger.text))
    try {
      const reply = await this.deps.complete(system, user)
      if (session !== this.session) return
      const qa = parseAnswer(reply, trigger.text)
      if (!qa) {
        this.deps.log("talk", "Подсказка не нужна")
        this.drop(placeholder)
        return
      }
      const kind: LectureNote["kind"] = fromUser ? "you" : ({question: "qa", prompt: "hint", quote: "quote"} as const)[trigger.kind]
      this.addNote({t: this.deps.now(), kind, q: qa.q, text: qa.a})
      this.deps.log("talk", `→ ${qa.a}`)
      this.lastAnswerAt = this.deps.now()
      this.replace(placeholder, kind === "quote" ? `«${qa.q}» — ${qa.a}` : `${qa.q}: ${qa.a}`)
    } catch (e) {
      if (session !== this.session) return
      this.drop(placeholder)
      this.showError(e)
    } finally {
      if (session === this.session) {
        this.qBusy = false
        const next = this.qPending
        this.qPending = null
        if (next) void this.answer(next.trigger, next.fromUser)
      }
    }
  }

  // ── proactive lane ──

  private every(): number {
    const v = Math.round(Number(this.deps.everySec?.() ?? 0))
    return v > 0 ? Math.max(TALK_TIP_MIN_SEC, Math.min(120, v)) : 0
  }

  private maybeTip(): void {
    const every = this.every()
    if (!every || this.tipBusy) return
    const words = this.wordsSinceTip + (this.interim ? wordCount(this.interim) : 0)
    if (words < TALK_TIP_MIN_WORDS || this.deps.now() - this.lastTipAt < every * 1000) return
    void this.tip()
  }

  private async tip(): Promise<void> {
    const session = this.session
    this.tipBusy = true
    this.lastTipAt = this.deps.now()
    this.wordsSinceTip = 0
    const context = [...this.recent, this.interim].filter(Boolean).join(" ")
    const lang = detectLang(context.split(/\s+/).slice(-60).join(" "))
    const prevTips = (this.record?.notes ?? []).slice(-PREV_TIPS).map((n) => `${n.q}: ${n.text}`)
    const {system, user} = buildTipPrompt(context, prevTips, this.deps.goal?.() ?? "", lang)
    try {
      const reply = await this.deps.complete(system, user)
      if (session !== this.session) return
      const tip = parseTip(reply)
      if (!tip) {
        this.deps.log("talk", "Подсказка по ходу: нечего добавить")
        return
      }
      const line = tipLine(tip.label, tip.text, lang)
      const seen = (this.record?.notes ?? []).slice(-PREV_TIPS).some((n) => normalize(`${n.q}: ${n.text}`) === normalize(line))
      if (seen) return
      this.addNote({t: this.deps.now(), kind: "tip", q: TIP_LABELS[lang][tip.label], text: tip.text})
      this.deps.log("talk", `Подсказка по ходу — ${line}`)
      // a fresh answer to a question stays on top for a while
      if (this.deps.now() - this.lastAnswerAt >= TALK_ANSWER_PRIORITY_MS) this.push(line)
    } catch (e) {
      if (session !== this.session) return
      this.deps.log("error", `Беседа: ${this.deps.explainError(e)}`)
    } finally {
      if (session === this.session) this.tipBusy = false
    }
  }

  // ── the glasses ──

  private push(text: string): number {
    const id = ++this.feedSeq
    this.feed.push({id, text})
    if (this.feed.length > 6) this.feed.splice(0, this.feed.length - 6)
    this.renderFeed()
    return id
  }

  private replace(id: number, text: string): void {
    const item = this.feed.find((f) => f.id === id)
    if (item) {
      // the answer moves to the bottom: it is the newest thing to read
      this.feed = this.feed.filter((f) => f.id !== id)
      this.feed.push({id, text})
    } else this.feed.push({id: ++this.feedSeq, text})
    this.renderFeed()
  }

  private drop(id: number): void {
    const before = this.feed.length
    this.feed = this.feed.filter((f) => f.id !== id)
    if (this.feed.length !== before) this.renderFeed()
  }

  private renderFeed(): void {
    if (!this.feed.length) return this.paint("")
    this.paint(
      feedScreen(
        this.feed.map((f) => f.text),
        1,
      ),
      TALK_SHOW_MS,
    )
  }

  private addNote(n: LectureNote): void {
    if (!this.record) this.record = {startedAt: n.t, notes: []}
    this.record.notes.push(n)
    if (this.record.notes.length > NOTES_MAX) this.record.notes.splice(0, this.record.notes.length - NOTES_MAX)
    this.deps.save(this.record)
    this.deps.onChange()
  }

  /** Show text; with `forMs`, clear it (and the feed) afterwards unless something newer came. */
  private paint(text: string, forMs = 0): void {
    this.cancelScreenTimer()
    this.screen = text
    if (text) this.deps.show(text)
    else this.deps.clear()
    if (forMs > 0 && text) {
      this.screenTimer = this.deps.setTimer(() => {
        this.screenTimer = null
        if (this.active && this.screen === text) {
          this.screen = ""
          this.feed = []
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

  private cancelSettle(): void {
    if (this.settleTimer != null) this.deps.clearTimer(this.settleTimer)
    this.settleTimer = null
  }

  private showError(e: unknown): void {
    const human = this.deps.explainError(e)
    this.deps.log("error", `Беседа: ${human}`)
    const now = this.deps.now()
    if (now - this.lastErrorShownAt < ERROR_SHOW_EVERY_MS) return
    this.lastErrorShownAt = now
    this.push(human)
  }
}

function shorten(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, "") + "…"
}
