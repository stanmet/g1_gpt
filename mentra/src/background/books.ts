/**
 * Mode «Книги»: answers only from books you added on the phone.
 *
 *   book → pieces of ~160 words, each knowing its chapter (and page, for PDF)
 *   question → the AI lists search words in the books' languages (synonyms, names, a translation
 *              when the book is English and the question Russian) → BM25 search over the pieces,
 *              with a light Russian and English stemmer → the best pieces
 *   the AI answers from those pieces only, with the book and chapter; «В книгах этого нет» otherwise
 *
 * Search runs on the phone, so it costs nothing and works offline; the AI is asked twice per
 * question (search words, then the answer). Book texts live in Mentra's file storage.
 */
import type {BookFormat, ParsedBook} from "./bookparse"

// ───────────────────────── words ─────────────────────────

const STOP = new Set(
  (
    "и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о об из ему " +
    "теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где " +
    "есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем " +
    "ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше " +
    "тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им " +
    "более всегда конечно всю между это эта эти почему сколько какие какое каким который которая которое которые книге книги книга " +
    "the a an and or of to in on at by for with from as is are was were be been being it its this that these those he she they we you i " +
    "his her their our your my me him them what which who whom whose when where why how do does did not no but if then so than too very " +
    "can could would should will shall may might must there here about into over after before up down out just also only book"
  ).split(" "),
)

const VOWEL = /[аеиоуыэюя]/

/** Russian Snowball stemmer (Porter's algorithm for Russian), compact. */
export function stemRu(word: string): string {
  const w = word.replace(/ё/g, "е")
  const m = /^(.*?[аеиоуыэюя])(.*)$/.exec(w)
  if (!m) return w
  const pre = m[1]
  let rv = m[2]
  const cut = (re: RegExp): boolean => {
    const r = re.exec(rv)
    if (!r) return false
    rv = rv.slice(0, r.index) + (r[1] && /^[ая]$/.test(r[1]) && r.length > 2 ? r[1] : "")
    return true
  }
  // step 1
  if (!cut(/(ившись|ывшись|ивши|ывши|ив|ыв)$/) && !cut(/([ая])(вшись|вши|в)$/)) {
    rv = rv.replace(/(ся|сь)$/, "")
    if (cut(/(ими|ыми|его|ого|ему|ому|ее|ие|ые|ое|ей|ий|ый|ой|ем|им|ым|ом|их|ых|ую|юю|ая|яя|ою|ею)$/)) {
      if (!cut(/(ивш|ывш|ующ)$/)) cut(/([ая])(ем|нн|вш|ющ|щ)$/)
    } else if (
      !cut(/(уйте|ейте|ила|ыла|ена|ите|или|ыли|ило|ыло|ено|ует|уют|ены|ить|ыть|ишь|ей|уй|ил|ыл|им|ым|ен|ят|ит|ыт|ую|ю)$/) &&
      !cut(/([ая])(ете|йте|ешь|нно|ла|на|ли|ем|ло|но|ет|ют|ны|ть|й|л|н)$/)
    ) {
      cut(/(иями|ями|ами|ией|иям|ием|иях|ев|ов|ие|ье|еи|ии|ей|ой|ий|ям|ем|ам|ом|ах|ях|ию|ью|ия|ья|а|е|и|й|о|у|ы|ь|ю|я)$/)
    }
  }
  // step 2
  rv = rv.replace(/и$/, "")
  // step 3: derivational suffix in R2
  const word2 = pre + rv
  const r1 = regionStart(word2, 0)
  const r2 = regionStart(word2, r1)
  const d = /(ость|ост)$/.exec(rv)
  if (d && pre.length + d.index >= r2) rv = rv.slice(0, d.index)
  // step 4
  if (/нн$/.test(rv)) rv = rv.slice(0, -1)
  else if (/(ейше|ейш)$/.test(rv)) {
    rv = rv.replace(/(ейше|ейш)$/, "")
    if (/нн$/.test(rv)) rv = rv.slice(0, -1)
  } else rv = rv.replace(/ь$/, "")
  return pre + rv
}

/** Start of R1 (from 0) or R2 (from R1): after the first consonant that follows a vowel. */
function regionStart(w: string, from: number): number {
  for (let i = from + 1; i < w.length; i++) if (!VOWEL.test(w[i]) && VOWEL.test(w[i - 1])) return i + 1
  return w.length
}

const EN_SUFFIXES = ["ational", "ization", "fulness", "ousness", "iveness", "tional", "ements", "ement", "ments", "ment", "ness", "ings", "ing", "ions", "ion", "ies", "ied", "ed", "ly", "es", "s"]

/** A light English stemmer: the same word in a question and in a book comes out the same. */
export function stemEn(word: string): string {
  let w = word.replace(/'s$/, "")
  if (w.length <= 3) return w
  for (const s of EN_SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      if (s === "s" && /(ss|us|is)$/.test(w)) break
      w = w.slice(0, -s.length)
      if (s === "ies" || s === "ied") w += "i"
      if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/.test(w)) w = w.slice(0, -1)
      break
    }
  }
  return w
}

/** Words of a text as search terms: lower case, no stop words, stemmed. */
export function terms(text: string): string[] {
  const out: string[] = []
  for (const raw of String(text ?? "").toLowerCase().replace(/ё/g, "е").split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 2 || STOP.has(raw)) continue
    if (/^\d+$/.test(raw)) {
      out.push(raw)
      continue
    }
    out.push(/[а-я]/.test(raw) ? stemRu(raw) : /[a-z]/.test(raw) ? stemEn(raw) : raw)
  }
  return out
}

export function wordCount(s: string): number {
  return String(s ?? "").split(/\s+/).filter(Boolean).length
}

// ───────────────────────── pieces ─────────────────────────

export interface Chunk {
  /** Section (chapter) index. */
  s: number
  /** Page (PDF). */
  pg?: number
  /** Where in the book, 0…1. */
  at: number
  t: string
}

export interface BookMeta {
  id: string
  title: string
  author: string
  format: BookFormat
  lang: string
  /** File name as picked. */
  file: string
  /** File size, bytes. */
  size: number
  words: number
  chunks: number
  /** Chapters (distinct names). */
  sections: number
  /** Pages (PDF). */
  pages?: number
  addedAt: number
  /** Used in answers. */
  on: boolean
}

export interface BookData {
  v: 1
  meta: BookMeta
  sections: string[]
  chunks: Chunk[]
}

const TARGET = 160
const MAX = 260

/** A book → pieces of about 160 words that keep paragraphs together and know their chapter. */
export function makeChunks(book: ParsedBook): {sections: string[]; chunks: Chunk[]; words: number} {
  const total = book.sections.reduce((a, s) => a + wordCount(s.text), 0) || 1
  const chunks: Chunk[] = []
  let seen = 0
  book.sections.forEach((sec, si) => {
    let buf: string[] = []
    let n = 0
    let startAt = seen
    const push = () => {
      if (!buf.length) return
      chunks.push({s: si, ...(sec.page ? {pg: sec.page} : {}), at: Math.min(1, startAt / total), t: buf.join("\n")})
      buf = []
      n = 0
      startAt = seen
    }
    for (const para of sec.text.split("\n")) {
      const words = wordCount(para)
      if (!words) continue
      if (words > MAX) {
        // a very long paragraph: split by sentences
        push()
        let part: string[] = []
        let pn = 0
        for (const sent of para.split(/(?<=[.!?…])\s+/)) {
          const sw = wordCount(sent)
          if (pn + sw > TARGET && part.length) {
            buf = [part.join(" ")]
            seen += pn
            push()
            part = []
            pn = 0
          }
          part.push(sent)
          pn += sw
        }
        if (part.length) {
          buf = [part.join(" ")]
          n = pn
          seen += pn
          if (n >= TARGET) push()
        }
        continue
      }
      if (n + words > MAX && n > 0) push()
      buf.push(para)
      n += words
      seen += words
      if (n >= TARGET) push()
    }
    push()
  })
  return {sections: book.sections.map((s) => s.title), chunks, words: total}
}

// ───────────────────────── search ─────────────────────────

export interface Hit {
  book: BookData
  i: number
  score: number
}

/** BM25 over the pieces of the books in use. */
export class BookIndex {
  private postings = new Map<string, number[]>() // term → [doc, tf, doc, tf…]
  private lengths: number[] = []
  private docs: {book: BookData; i: number}[] = []
  private avg = 1

  constructor(books: BookData[]) {
    for (const book of books) {
      book.chunks.forEach((c, i) => {
        const id = this.docs.length
        this.docs.push({book, i})
        const tf = new Map<string, number>()
        const ts = terms(c.t)
        for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1)
        this.lengths.push(ts.length)
        for (const [t, n] of tf) {
          let p = this.postings.get(t)
          if (!p) this.postings.set(t, (p = []))
          p.push(id, n)
        }
      })
    }
    this.avg = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length) || 1
  }

  get size(): number {
    return this.docs.length
  }

  /** Pieces for weighted search terms; phrases of two or more words found verbatim score extra. */
  search(query: {term: string; w: number}[], phrases: string[] = [], k = 12): Hit[] {
    const N = this.docs.length
    const scores = new Map<number, number>()
    const k1 = 1.2
    const b = 0.75
    const seen = new Set<string>()
    for (const {term, w} of query) {
      if (seen.has(term)) continue
      seen.add(term)
      const p = this.postings.get(term)
      if (!p) continue
      const df = p.length / 2
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
      for (let j = 0; j < p.length; j += 2) {
        const d = p[j]
        const tf = p[j + 1]
        const s = (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * this.lengths[d]) / this.avg))
        scores.set(d, (scores.get(d) ?? 0) + w * s)
      }
    }
    const lowPhrases = phrases.map((p) => p.toLowerCase().replace(/ё/g, "е")).filter((p) => p.split(/\s+/).length >= 2)
    if (lowPhrases.length) {
      for (const [d, s] of scores) {
        const text = this.docs[d].book.chunks[this.docs[d].i].t.toLowerCase().replace(/ё/g, "е")
        let bonus = 0
        for (const p of lowPhrases) if (text.includes(p)) bonus += 2
        if (bonus) scores.set(d, s + bonus)
      }
    }
    return [...scores.entries()]
      .sort((a, b2) => b2[1] - a[1])
      .slice(0, k)
      .map(([d, score]) => ({book: this.docs[d].book, i: this.docs[d].i, score}))
  }
}

/** «Мастер и Маргарита», гл. «Глава 3. Седьмое доказательство», стр. 45 — where a piece is from. */
export function sourceLabel(book: BookData, c: Chunk): string {
  const t = book.meta.title.length > 60 ? book.meta.title.slice(0, 58) + "…" : book.meta.title
  const sec = book.sections[c.s] ?? ""
  const parts = [`«${t}»`]
  // no \b: JavaScript does not count Cyrillic letters as word characters
  if (sec) parts.push(/^(глава|chapter|часть|part|книга|book)(?=[\s.:\d]|$)/i.test(sec) ? sec : `гл. «${sec.length > 70 ? sec.slice(0, 68) + "…" : sec}»`)
  if (c.pg) parts.push(`стр. ${c.pg}`)
  else if (!sec) parts.push(`≈ ${Math.round(c.at * 100)}% книги`)
  return parts.join(", ")
}

/**
 * The best pieces within a word budget: at most three from one chapter, the piece after each of
 * the two best ones added when there is room (an answer often continues there).
 */
export function pickExcerpts(hits: Hit[], budget = 1800): {label: string; text: string; book: BookData; i: number}[] {
  if (!hits.length) return []
  const top = hits[0].score
  const out: {label: string; text: string; book: BookData; i: number}[] = []
  const used = new Set<string>()
  const perSection = new Map<string, number>()
  let words = 0
  const add = (book: BookData, i: number) => {
    const key = `${book.meta.id}:${i}`
    const c = book.chunks[i]
    if (!c || used.has(key)) return false
    const sk = `${book.meta.id}:${c.s}`
    if ((perSection.get(sk) ?? 0) >= 3) return false
    const n = wordCount(c.t)
    if (words + n > budget && out.length) return false
    used.add(key)
    perSection.set(sk, (perSection.get(sk) ?? 0) + 1)
    words += n
    out.push({label: sourceLabel(book, c), text: c.t, book, i})
    return true
  }
  hits.forEach((h, rank) => {
    if (h.score < top * 0.25) return
    if (add(h.book, h.i) && rank < 2) {
      const next = h.book.chunks[h.i + 1]
      if (next && next.s === h.book.chunks[h.i].s) add(h.book, h.i + 1)
    }
  })
  return out
}

// ───────────────────────── prompts ─────────────────────────

const LANG_NAME: Record<string, string> = {ru: "русский", en: "английский", de: "немецкий", fr: "французский", es: "испанский", it: "итальянский", uk: "украинский"}

/** Ask the AI for search words in the books' languages. */
export function buildQueryPrompt(question: string, books: BookMeta[], prev: string): {system: string; user: string} {
  const langs = [...new Set(books.map((b) => b.lang || "ru"))]
  const system = [
    "Ты готовишь поиск по тексту книг пользователя (поиск по словам, не по смыслу).",
    `Языки книг: ${langs.map((l) => LANG_NAME[l] ?? l).join(", ")}. Выпиши 6–14 слов и коротких фраз, которые вероятно встречаются в нужном месте книги: имена, термины, ключевые слова вопроса и их синонимы, слова, которыми автор мог это описать.`,
    langs.some((l) => l !== "ru") ? "Пиши на языках книг: если вопрос по-русски, а книга на английском — переведи слова на английский (можно дать оба варианта)." : "",
    "Если вопрос продолжает предыдущий («а он», «что дальше»), подставь, о ком или о чём речь.",
    "Одна строка, через запятую, без пояснений.",
  ]
    .filter(Boolean)
    .join("\n")
  const list = books.map((b) => `«${b.title}»${b.author ? ` (${b.author})` : ""}`).join("; ")
  return {system, user: `Книги: ${list}\n${prev ? `Предыдущий вопрос: «${prev}»\n` : ""}Вопрос: «${question}»`}
}

/** «Воланд, Woland, профессор, чёрная магия» → terms and phrases. */
export function parseQueryWords(reply: string): {words: string[]; phrases: string[]} {
  const items = String(reply ?? "")
    .replace(/^[^:\n]{0,30}:\s*/, "")
    .split(/[,;\n]/)
    .map((s) => s.replace(/^[\s«"“'*•-]+|[\s»"”'*.]+$/g, "").trim())
    .filter((s) => s && s.length <= 60)
    .slice(0, 24)
  return {words: items, phrases: items.filter((s) => s.split(/\s+/).length >= 2)}
}

/** The strict rules: only the excerpts, the source at the end, «В книгах этого нет» otherwise. */
export function bookSystem(words: number, en: boolean): string {
  return [
    "Ты отвечаешь по личной библиотеке пользователя. Тебе дают отрывки из его книг, найденные по вопросу. Ответ показывается на крошечном дисплее умных очков.",
    "Используй ТОЛЬКО эти отрывки. Не добавляй ничего из своих знаний, интернета или здравого смысла, даже если уверен.",
    en
      ? "If the excerpts do not answer the question, reply exactly: «Not in the books.» and, in one sentence, what the books do say on the topic if anything."
      : "Если в отрывках нет ответа — ответь «В книгах этого нет.» и одним предложением, что в книгах есть по теме, если есть.",
    "Цитаты — только дословно из отрывков, в кавычках. Если отрывки противоречат друг другу — скажи об этом.",
    "В конце в скобках — источник: книга и глава или страница, как в метке отрывка.",
    `Отвечай на языке вопроса, коротко: до ${words} слов, без Markdown, без вступлений.`,
  ].join("\n")
}

export function bookUser(question: string, excerpts: {label: string; text: string}[]): string {
  const ex = excerpts.map((e, i) => `[${i + 1}] ${e.label}:\n${e.text}`).join("\n\n")
  return `Отрывки из книг:\n\n${ex}\n\nВопрос: ${question}`
}

// ───────────────────────── voice ─────────────────────────

export type BooksCommand = "on" | "off"

const BOOKS_ON = [
  "книги", "режим книг", "режим книги", "режим книга", "включи книги", "по книгам", "отвечай по книгам", "библиотека",
  "режим библиотеки", "включи библиотеку", "мои книги", "books", "books mode", "library mode",
]
const BOOKS_OFF = [
  "стоп книги", "выключи книги", "выйди из книг", "хватит книг", "обычный режим", "отвечай как обычно", "стоп библиотека",
  "выключи библиотеку", "книги стоп", "books off", "stop books",
]
const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
const ON = new Set(BOOKS_ON.map(norm))
const OFF = new Set(BOOKS_OFF.map(norm))

/** «Книги» / «Режим книг» → on; «Стоп книги» / «Обычный режим» → off (whole utterance). */
export function parseBooksCommand(text: string): BooksCommand | null {
  let words = norm(text).split(" ").filter(Boolean)
  const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|please|ok|okay)$/
  while (words.length > 1 && FILLERS.test(words[0])) words = words.slice(1)
  while (words.length > 1 && FILLERS.test(words[words.length - 1])) words = words.slice(0, -1)
  const s = words.join(" ")
  if (OFF.has(s)) return "off"
  if (ON.has(s)) return "on"
  return null
}

/** «По книгам, кто такой Воланд?» → «кто такой Воланд?» (one question from the books); null otherwise. */
export function booksPrefix(q: string): string | null {
  const m = /^\s*(?:по (?:моим )?книгам|по (?:моей )?книге|в (?:моих )?книгах|из (?:моих )?книг|in my books|from my books)\s*[,:—–-]?\s+(.{3,})$/iu.exec(String(q ?? ""))
  return m ? m[1].trim() : null
}

// ───────────────────────── the library on the phone ─────────────────────────

/** What the host offers (`session.blob`). */
export interface BookBlob {
  set(key: string, data: Uint8Array, opts?: {mimeType?: string; name?: string}): Promise<unknown>
  bytes(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
}

export interface LibraryDeps {
  blob: BookBlob | null
  loadList(): BookMeta[]
  saveList(list: BookMeta[]): void
  log(kind: "info" | "error", msg: string): void
  now(): number
  onChange(): void
}

const dataKey = (id: string) => `books/${id}.json`

export class Library {
  list: BookMeta[]
  private data = new Map<string, BookData>()
  private index: BookIndex | null = null
  private indexKey = ""
  private loading: Promise<BookIndex | null> | null = null

  constructor(private readonly deps: LibraryDeps) {
    this.list = deps.loadList()
  }

  get available(): boolean {
    return Boolean(this.deps.blob)
  }

  /** Books used in answers. */
  get active(): BookMeta[] {
    return this.list.filter((b) => b.on)
  }

  /** Splits a parsed book into pieces and keeps it on the phone. */
  async add(book: ParsedBook, file: {id: string; name: string; size: number}): Promise<BookMeta> {
    if (!this.deps.blob) throw new Error("хранилище файлов Mentra недоступно")
    const {sections, chunks, words} = makeChunks(book)
    if (!chunks.length) throw new Error("в книге не нашлось текста")
    const meta: BookMeta = {
      id: file.id,
      title: book.title.trim() || "Без названия",
      author: book.author.trim(),
      format: book.format,
      lang: book.lang || "ru",
      file: file.name,
      size: file.size,
      words,
      chunks: chunks.length,
      sections: new Set(sections.filter(Boolean)).size,
      ...(book.format === "pdf" ? {pages: book.sections.reduce((m, s) => Math.max(m, s.page ?? 0), 0)} : {}),
      addedAt: this.deps.now(),
      on: true,
    }
    const data: BookData = {v: 1, meta, sections, chunks}
    await this.deps.blob.set(dataKey(meta.id), new TextEncoder().encode(JSON.stringify(data)), {mimeType: "application/json", name: `${meta.title}.json`})
    this.data.set(meta.id, data)
    this.list = [meta, ...this.list.filter((b) => b.id !== meta.id)]
    this.deps.saveList(this.list)
    this.index = null
    this.deps.log("info", `Книга добавлена: «${meta.title}»${meta.author ? `, ${meta.author}` : ""} — ${words} слов, глав ${meta.sections}`)
    this.deps.onChange()
    return meta
  }

  async remove(id: string): Promise<void> {
    const b = this.list.find((x) => x.id === id)
    if (!b) return
    try {
      await this.deps.blob?.delete(dataKey(id))
    } catch {
      // already gone
    }
    this.data.delete(id)
    this.list = this.list.filter((x) => x.id !== id)
    this.deps.saveList(this.list)
    this.index = null
    this.deps.log("info", `Книга удалена: «${b.title}»`)
    this.deps.onChange()
  }

  setOn(id: string, on: boolean): void {
    const b = this.list.find((x) => x.id === id)
    if (!b || b.on === on) return
    b.on = on
    this.deps.saveList(this.list)
    this.index = null
    this.deps.onChange()
  }

  private async load(id: string): Promise<BookData | null> {
    const have = this.data.get(id)
    if (have) return have
    const bytes = await this.deps.blob?.bytes(dataKey(id))
    if (!bytes) return null
    const d = JSON.parse(new TextDecoder("utf-8").decode(bytes)) as BookData
    if (!Array.isArray(d?.chunks)) return null
    // the list on the phone is the truth for name and use
    const meta = this.list.find((b) => b.id === id)
    if (meta) d.meta = meta
    this.data.set(id, d)
    return d
  }

  /** The search index over the books in use (built once, rebuilt after a change). */
  async ready(): Promise<BookIndex | null> {
    const key = this.active.map((b) => b.id).join(",")
    if (this.index && this.indexKey === key) return this.index
    if (this.loading) return this.loading
    this.loading = (async () => {
      const books: BookData[] = []
      for (const b of this.active) {
        try {
          const d = await this.load(b.id)
          if (d) books.push(d)
          else this.deps.log("error", `Книга «${b.title}» не найдена на телефоне — добавьте её заново`)
        } catch (e) {
          this.deps.log("error", `Книга «${b.title}» не читается: ${String((e as Error)?.message ?? e)}`)
        }
      }
      this.index = books.length ? new BookIndex(books) : null
      this.indexKey = key
      return this.index
    })()
    try {
      return await this.loading
    } finally {
      this.loading = null
    }
  }
}
