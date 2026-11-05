/**
 * «Как будет на английском стол?» — a word or phrase translated by the selected AI and shown as
 * «стол → table». Works in every mode; the request is recognised by voice.ts/parsePhraseRequest.
 */
import {PHRASE_LANG_NAME, type PhraseLang} from "./voice"

export function buildPhrasePrompt(phrase: string, lang: PhraseLang): {system: string; user: string} {
  const target = PHRASE_LANG_NAME[lang]
  const system = [
    `Ты — переводчик в умных очках. Переведи слово или фразу на ${target} язык.`,
    "Дай самый употребительный вариант. Если у слова несколько значений или есть важный вариант — добавь ещё 1–2 через запятую, с короткой пометкой в скобках по-русски.",
    "Фраза распознана с речи и может содержать ошибки — угадай смысл.",
    "Не больше 12 слов. Без кавычек, Markdown, транскрипции и пояснений — только перевод.",
  ].join("\n")
  return {system, user: phrase.trim()}
}

/** The AI reply without labels or wrapping quotes. */
export function cleanPhraseReply(text: string): string {
  return String(text ?? "")
    .replace(/\*\*/g, "")
    .replace(/^\s*(?:перевод|translation|ответ|answer)\s*[:：]\s*/i, "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ")
    .replace(/^[«"“„]+|[»"”]+$/gu, "")
    .trim()
}
