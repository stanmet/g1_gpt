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
        return {matched: true, rest}
      }
    }
    // only allow one unknown filler word before the wake phrase
    if (offset > start) break
  }
  return {matched: false, rest: ""}
}

export type VoiceCommand = "next" | "prev" | "first" | "repeat" | "hide" | "cancel" | "reset"

const COMMANDS: [VoiceCommand, string[]][] = [
  ["next", ["дальше", "далее", "следующая", "следующий", "следующая страница", "листай", "вперед", "еще", "продолжай",
    "next", "next page", "continue", "go on", "more"]],
  ["prev", ["назад", "предыдущая", "предыдущий", "предыдущая страница", "обратно",
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
  let n = normalize(text)
  if (!n) return null
  n = n
    .replace(/^(пожалуйста|ну|так|давай|а|please|ok|okay)\s+/, "")
    .replace(/\s+(пожалуйста|давай|please)$/, "")
  const words = n.split(" ")
  if (words.length > 4) return null
  return COMMAND_LOOKUP.get(n) ?? null
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
