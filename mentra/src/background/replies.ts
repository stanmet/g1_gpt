/**
 * Translation mode: what to answer. After the other person has spoken and paused, the glasses show
 * two short replies in their language, each with its meaning, so you can say one out loud.
 */
import {G1_LINES, sanitizeForG1, wrapLines} from "./g1text"

/** A pause after the other person's phrase before replies are suggested. */
export const REPLY_PAUSE_MS = 1600

export interface Heard {
  /** What they said, in their language (Mentra's original text; may be empty). */
  orig: string
  /** The translation shown on the glasses. */
  text: string
  /** Their language, «en», «de-DE»… («» when Mentra did not say). */
  lang: string
}

export interface Reply {
  /** What to say, in their language. */
  say: string
  /** What it means, in yours. */
  means: string
}

const LANG_RU: Record<string, string> = {
  en: "английском", de: "немецком", fr: "французском", es: "испанском", it: "итальянском", pt: "португальском",
  pl: "польском", uk: "украинском", nl: "нидерландском", sv: "шведском", tr: "турецком", ga: "ирландском",
  zh: "китайском", ja: "японском", ko: "корейском", ar: "арабском", he: "иврите", hi: "хинди", el: "греческом",
  cs: "чешском", ro: "румынском", hu: "венгерском", fi: "финском", da: "датском", no: "норвежском", ru: "русском",
}
/** Scripts the G1 cannot draw: replies come in Latin letters (pinyin, romaji…). */
const NON_LATIN = new Set(["zh", "ja", "ko", "ar", "he", "hi", "el", "th", "fa"])

const primary = (tag: string) => String(tag ?? "").toLowerCase().split(/[-_]/)[0]

export function buildReplyPrompt(heard: Heard[], userLang: "ru" | "en"): {system: string; user: string} {
  const last = heard[heard.length - 1]
  const code = primary(last?.lang ?? "")
  const theirs = LANG_RU[code] ? `${LANG_RU[code]} языке` : "языке собеседника"
  const mine = userLang === "en" ? "английский" : "русский"
  const system = [
    "Ты помогаешь пользователю говорить с иностранцем через умные очки. Пользователь читает перевод речи собеседника и отвечает сам, вслух.",
    `Предложи 2 коротких варианта ответа от лица пользователя на ${theirs}: естественно, вежливо, до 8 слов. Варианты должны различаться по смыслу (например, согласиться и уточнить или вежливо отказаться).`,
    NON_LATIN.has(code) ? "Пиши ответ латиницей (транскрипцией: пиньинь, ромадзи и т. п.) — очки не показывают другие алфавиты." : "",
    `После каждого варианта — « | » и перевод на ${mine}.`,
    "Формат строго, без пояснений:\n1. <ответ> | <перевод>\n2. <ответ> | <перевод>",
    "Если реплика не требует ответа (рассказ, объявление по громкой связи, обрывок фразы) — ответь ровно SKIP.",
  ]
    .filter(Boolean)
    .join("\n")
  const lines = heard.slice(-3).map((h) => (h.orig ? `«${h.orig}» (перевод: «${h.text}»)` : `«${h.text}»`))
  return {system, user: `Собеседник сказал${lines.length > 1 ? " (последнее — внизу)" : ""}:\n${lines.join("\n")}`}
}

/** «1. Sure, seven works. | Да, в семь удобно» → replies; [] for SKIP. */
export function parseReplies(text: string): Reply[] {
  const t = String(text ?? "").trim()
  if (!t || /^skip\b/i.test(t)) return []
  const out: Reply[] = []
  for (const raw of t.split("\n")) {
    const body = raw.replace(/\*\*/g, "").trim().replace(/^(?:[-•*]\s*)?(?:\d[.)]\s*)?/, "")
    const cut = body.includes("|") ? body.indexOf("|") : body.lastIndexOf(" — ")
    const sayRaw = cut >= 0 ? body.slice(0, cut) : body
    const meansRaw = cut >= 0 ? body.slice(cut + (body[cut] === "|" ? 1 : 3)) : ""
    const say = sayRaw.trim().replace(/^[«"“]|[»"”]$/g, "").trim()
    const means = meansRaw.trim().replace(/^[(«"“]|[)»"”]$/g, "").trim()
    if (!say || /^skip\b/i.test(say)) continue
    out.push({say, means})
    if (out.length === 2) break
  }
  return out
}

/** The glasses: replies at the bottom («→ Sure, seven works. (да, в семь)»), the last translation above if room. */
export function replyScreen(lastTranslation: string, replies: Reply[]): string {
  const opt = replies.flatMap((r) => wrapLines(sanitizeForG1(`→ ${r.say}${r.means ? ` (${r.means})` : ""}`)))
  if (opt.length > G1_LINES) {
    // too long with meanings: keep what to say
    const short = replies.flatMap((r) => wrapLines(sanitizeForG1(`→ ${r.say}`)))
    return short.slice(0, G1_LINES).join("\n")
  }
  const room = G1_LINES - opt.length
  const above = room > 0 ? wrapLines(sanitizeForG1(lastTranslation)).slice(-room) : []
  return [...above, ...opt].join("\n")
}

/** «Что ответить?», «Как ответить?», «Подскажи ответ» — replies right now (translation mode). */
export function isReplyRequest(text: string): boolean {
  const n = String(text ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  return /^(?:а |и |ну )?(?:что|как) (?:мне )?ответить$|^подскажи(?:те)? (?:ответ|что ответить)$|^варианты ответа$|^what (?:do|should) i (?:say|answer|reply)$/.test(n)
}
