/**
 * Voice parsing: wake phrases and short navigation commands, in Russian.
 * Speech recognition output varies ("Чат GPT", "чат джипити", "ChatGPT,"), so
 * everything is compared after normalization.
 */

export function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Words people often say before the wake phrase. */
const LEAD_INS = new Set(["эй", "ну", "окей", "ок", "хей", "алло", "так", "слушай", "hey", "ok", "okay", "so", "um", "uh"])

export interface WakeResult {
  matched: boolean
  /** Text after the wake phrase, in the original spelling (punctuation trimmed). */
  rest: string
  /** The wake phrase that matched, normalized ("вопрос", "клод"). */
  phrase?: string
}

/** Original-text words with their normalized forms, so we can cut the original string. */
function tokenize(text: string): {orig: string; norm: string}[] {
  return String(text ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((orig) => ({orig, norm: normalize(orig)}))
    .flatMap((t) => {
      // "чат-джипити" normalizes to two words; keep them as separate tokens
      const parts = t.norm.split(" ").filter(Boolean)
      if (parts.length <= 1) return [{orig: t.orig, norm: t.norm}]
      return parts.map((p, i) => ({orig: i === parts.length - 1 ? t.orig : "", norm: p}))
    })
    .filter((t) => t.norm.length > 0)
}

/**
 * Detect a wake phrase within the first few words of an utterance.
 * "Вопрос, сколько времени лететь до Рима?" → {matched, rest: "сколько времени лететь до Рима?"}
 */
export function detectWake(text: string, wakePhrases: string[]): WakeResult {
  const tokens = tokenize(text)
  const phrases = wakePhrases
    .map((p) => normalize(p).split(" ").filter(Boolean))
    .filter((p) => p.length > 0)
    .sort((a, b) => b.length - a.length)

  let start = 0
  while (start < tokens.length && start < 2 && LEAD_INS.has(tokens[start].norm)) start++

  for (let offset = start; offset <= Math.min(start + 1, tokens.length - 1); offset++) {
    for (const phrase of phrases) {
      if (offset + phrase.length > tokens.length) continue
      let ok = true
      for (let j = 0; j < phrase.length; j++) {
        if (tokens[offset + j].norm !== phrase[j]) {
          ok = false
          break
        }
      }
      if (ok) {
        const rest = tokens
          .slice(offset + phrase.length)
          .map((t) => t.orig)
          .filter(Boolean)
          .join(" ")
          .replace(/^[\s,.:;!?—–-]+/, "")
          .trim()
        return {matched: true, rest, phrase: phrase.join(" ")}
      }
    }
    // only allow one unknown filler word before the wake phrase
    if (offset > start) break
  }
  return {matched: false, rest: ""}
}

export type VoiceCommand = "next" | "prev" | "first" | "repeat" | "hide" | "cancel" | "reset"

const COMMANDS: [VoiceCommand, string[]][] = [
  ["next", ["дальше", "далее", "следующая", "следующий", "следующую", "следующая страница", "следующую страницу",
    "листай", "листай дальше", "покажи дальше", "вперед", "еще", "продолжай", "продолжи",
    "next", "next page", "continue", "go on", "more"]],
  ["prev", ["назад", "предыдущая", "предыдущий", "предыдущую", "предыдущая страница", "предыдущую страницу", "обратно",
    "вернись", "верни назад",
    "back", "go back", "previous", "previous page"]],
  ["first", ["сначала", "с начала", "в начало", "первая страница", "к началу", "first page", "from the start", "from the beginning"]],
  ["repeat", ["повтори", "покажи снова", "покажи еще раз", "покажи ответ", "еще раз", "repeat", "again", "show again"]],
  ["hide", ["скрой", "скрыть", "убери", "убрать", "закрой", "закрыть", "спрячь", "очисти", "хватит", "достаточно",
    "hide", "close", "clear", "dismiss"]],
  ["cancel", ["стоп", "отмена", "отмени", "отменить", "не надо", "stop", "cancel", "never mind", "nevermind"]],
  ["reset", ["новый разговор", "новый чат", "начни заново", "забудь разговор", "сбрось контекст", "очисти историю", "новая тема",
    "new conversation", "new chat", "new topic", "start over", "reset", "forget it"]],
]

const COMMAND_LOOKUP = new Map<string, VoiceCommand>()
for (const [cmd, phrases] of COMMANDS) for (const p of phrases) COMMAND_LOOKUP.set(normalize(p), cmd)

/**
 * A command only counts when it is (almost) the whole utterance, so a question
 * like "что дальше делать с визой" is not mistaken for "дальше".
 */
export function parseCommand(text: string): VoiceCommand | null {
  const n = normalize(text)
  if (!n) return null
  // strip fillers ("ну давай дальше", "окей, дальше пожалуйста") and repeats ("дальше дальше")
  const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|хорошо|ладно|ага|угу|please|ok|okay|alright|so)$/
  let words = n.split(" ").filter(Boolean)
  while (words.length > 1 && FILLERS.test(words[0])) words = words.slice(1)
  while (words.length > 1 && FILLERS.test(words[words.length - 1])) words = words.slice(0, -1)
  if (words.length > 1 && words.every((w) => w === words[0])) words = [words[0]]
  if (words.length > 4) return null
  return COMMAND_LOOKUP.get(words.join(" ")) ?? null
}

/** True if the (interim) text could still become a command, e.g. "даль" → "дальше". */
export function isCommandPrefix(text: string): boolean {
  const n = normalize(text)
  if (!n) return false
  for (const phrase of COMMAND_LOOKUP.keys()) if (phrase.startsWith(n)) return true
  return false
}

/** True if an utterance has enough content to be worth sending to the model. */
export function isMeaningful(text: string): boolean {
  const n = normalize(text)
  return n.replace(/\s/g, "").length >= 3
}

export type Lang = "ru" | "en"

/**
 * Language of a question or answer by its letters: mostly Latin → English,
 * otherwise Russian. "Что такое Kubernetes?" stays Russian; "What is the time in Moscow" is English.
 */
export function detectLang(text: string): Lang {
  // Count words, not letters: one long English term must not flip a Russian sentence.
  let cyr = 0
  let lat = 0
  for (const word of String(text ?? "").split(/\s+/)) {
    const c = (word.match(/[а-яё]/gi) ?? []).length
    const l = (word.match(/[a-z]/gi) ?? []).length
    if (c === 0 && l === 0) continue
    if (c >= l) cyr++
    else lat++
  }
  return lat > cyr ? "en" : "ru"
}

export type TranslateCommand = "start" | "stop"

const TRANSLATE_START = [
  "транслейт", "трансляйт", "транслэйт", "translate", "переводи", "переводчик", "перевод", "режим перевода",
  "включи перевод", "включи переводчик", "начни перевод", "переводи мне", "translation", "translation mode",
  "start translation", "start translating", "translate mode",
]
const TRANSLATE_STOP = [
  "стоп перевод", "стоп", "хватит", "хватит переводить", "выключи перевод", "выключи переводчик", "закончи перевод",
  "конец перевода", "перестань переводить", "отключи перевод", "останови перевод", "транслейт стоп", "стоп транслейт",
  "stop translation", "stop translating", "translation off", "end translation",
]
const TRANSLATE_LOOKUP = new Map<string, TranslateCommand>()
for (const p of TRANSLATE_START) TRANSLATE_LOOKUP.set(normalize(p), "start")
for (const p of TRANSLATE_STOP) TRANSLATE_LOOKUP.set(normalize(p), "stop")

/**
 * "транслейт" / "translate" (whole utterance) starts live translation;
 * "стоп перевод" / "хватит переводить" stops it. Bare English "stop" is NOT a stop
 * phrase: while translating, other people around may say it.
 */
export function parseTranslateCommand(text: string): TranslateCommand | null {
  const n = normalize(text)
  if (!n) return null
  const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|please|ok|okay)$/
  let words = n.split(" ").filter(Boolean)
  while (words.length > 1 && FILLERS.test(words[0])) words = words.slice(1)
  while (words.length > 1 && FILLERS.test(words[words.length - 1])) words = words.slice(0, -1)
  if (words.length > 4) return null
  return TRANSLATE_LOOKUP.get(words.join(" ")) ?? null
}

// ───────────────────────── AI names ─────────────────────────

export type AiName = "openai" | "anthropic" | "gemini"

/** Names that work as activators AND pick that AI for the question: «Клод, …», «Джемини, …». */
export const AI_WAKE: Record<AiName, string[]> = {
  openai: ["чат gpt", "chat gpt", "chatgpt", "чатгпт", "чат джипити", "джипити", "гпт", "gpt", "openai", "опенай"],
  anthropic: ["клод", "claude", "клауд", "клоуд", "клот"],
  gemini: ["джемини", "джемени", "гемини", "джеминай", "джимини", "gemini"],
}

const AI_BY_PHRASE = new Map<string, AiName>()
for (const [ai, names] of Object.entries(AI_WAKE) as [AiName, string[]][]) for (const n of names) AI_BY_PHRASE.set(normalize(n), ai)

/** All AI names, to append to the user's activators. */
export const AI_WAKE_WORDS: string[] = Object.values(AI_WAKE).flat()

/** The AI a matched wake phrase refers to, or null for a generic activator ("вопрос"). */
export function aiForWakePhrase(phrase: string | undefined): AiName | null {
  return phrase ? AI_BY_PHRASE.get(normalize(phrase)) ?? null : null
}

// declensions people use after "переключись на …" / "спроси …"
const AI_FORMS: Record<AiName, string[]> = {
  openai: [...AI_WAKE.openai, "чат gpt", "чатгпт", "gpt", "джипити", "open ai", "openai"],
  anthropic: [...AI_WAKE.anthropic, "клода", "клоду", "клодом", "клоде", "claude"],
  gemini: [...AI_WAKE.gemini, "gemini", "джемини", "гугл", "google"],
}
const AI_BY_FORM = new Map<string, AiName>()
for (const [ai, forms] of Object.entries(AI_FORMS) as [AiName, string[]][]) for (const f of forms) AI_BY_FORM.set(normalize(f), ai)

/**
 * "Переключись на Клода", "используй джемини", "switch to ChatGPT" → that AI becomes the default.
 * Whole short utterance only.
 */
export function parseSwitchCommand(text: string): AiName | null {
  const n = normalize(text)
  if (!n || n.split(" ").length > 6) return null
  const m = /^(?:(?:ну |давай |пожалуйста )*)(?:переключись|переключи|переключиться|перейди|используй|включи|поставь|switch|use|change)(?: на| to)? (.+)$/.exec(n)
  if (!m) return null
  return AI_BY_FORM.get(m[1].trim()) ?? null
}

// ───────────────────────── lecture mode ─────────────────────────

export type LectureCommand = "start" | "stop"

const LECTURE_START = [
  "лекция", "режим лекции", "лекционный режим", "включи лекцию", "включи режим лекции", "начни лекцию",
  "конспект", "конспектируй", "веди конспект", "включи конспект", "начни конспект",
  "lecture", "lecture mode", "start lecture", "take notes", "start notes",
]
const LECTURE_STOP = [
  "стоп лекция", "стоп лекции", "стоп конспект", "конец лекции", "лекция окончена", "лекция закончилась",
  "выключи лекцию", "выключи режим лекции", "закончи лекцию", "выйди из лекции", "останови лекцию",
  "выключи конспект", "закончи конспект", "останови конспект", "хватит конспектировать",
  "stop lecture", "end lecture", "lecture off", "stop notes", "stop taking notes",
]
const LECTURE_LOOKUP = new Map<string, LectureCommand>()
for (const p of LECTURE_START) LECTURE_LOOKUP.set(normalize(p), "start")
for (const p of LECTURE_STOP) LECTURE_LOOKUP.set(normalize(p), "stop")

/** «Лекция» / «конспект» (whole utterance) starts lecture mode; «стоп лекция» / «конец лекции» stops it. */
export function parseLectureCommand(text: string): LectureCommand | null {
  const n = normalize(text)
  if (!n) return null
  const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|please|ok|okay)$/
  let words = n.split(" ").filter(Boolean)
  while (words.length > 1 && FILLERS.test(words[0])) words = words.slice(1)
  while (words.length > 1 && FILLERS.test(words[words.length - 1])) words = words.slice(0, -1)
  return LECTURE_LOOKUP.get(words.join(" ")) ?? null
}
