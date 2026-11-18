import {describe, expect, test} from "bun:test"
import {readFileSync} from "fs"
import {Assistant, SILENCE_MS} from "../src/background/assistant"
import {decodeCp1251, decodeText, detectFormat, markupToText, parseBook, parseTxt, pdfPageText, pdfToBook, unzip} from "../src/background/bookparse"
import {
  BookIndex,
  booksPrefix,
  bookSystem,
  buildQueryPrompt,
  Library,
  makeChunks,
  parseBooksCommand,
  parseQueryWords,
  pickExcerpts,
  sourceLabel,
  stemEn,
  stemRu,
  terms,
  type BookData,
  type BookMeta,
} from "../src/background/books"
import {DEFAULT_SETTINGS, Store, type KV} from "../src/background/store"

const BOOKS = new URL("./fixtures/books/", import.meta.url)
const file = (name: string) => new Uint8Array(readFileSync(new URL(name, BOOKS)))
const CHAPTERS = ["Глава 1. Камни и чертежи", "Глава 2. Огонь", "Глава 3. Шторм девяносто шестого года"]

describe("books: formats", () => {
  for (const name of ["mayak.epub", "mayak.fb2", "mayak.fb2.zip", "mayak.docx", "mayak-ru-styles.docx", "mayak.txt"]) {
    test(`${name}: title, chapters and text`, async () => {
      const b = await parseBook(file(name), name)
      expect(b.title).toBe("Маяк на Северном мысе")
      if (!name.endsWith(".txt")) expect(b.author).toBe("Анна Тестова")
      expect(b.lang).toBe("ru")
      expect(b.sections.map((s) => s.title)).toEqual(CHAPTERS)
      const all = b.sections.map((s) => s.text).join("\n")
      expect(all).toContain("Маяк на Северном мысе построили в 1874 году по чертежам инженера Карла Штольца.")
      expect(all).toContain("Фонарь маяка собрали из двенадцати линз Френеля, отлитых во Франции.")
      expect(all).not.toContain("Примечание переводчика") // FB2 notes are not the story
      expect(all).not.toContain("AAAA") // nor pictures
    })
  }

  test("an English EPUB 2 with an NCX table of contents and spaces in file names", async () => {
    const b = await parseBook(file("clockmaker.epub"), "clockmaker.epub")
    expect(b).toMatchObject({title: "The Clockmaker of Ennis", author: "J. Example", lang: "en", format: "epub"})
    expect(b.sections.map((s) => s.title)).toEqual(["Chapter 1. The Town Clock", "Chapter 2. Brass and Patience"])
  })

  test("formats are told by their bytes, not only the name", () => {
    expect(detectFormat(file("mayak.epub"), "book.bin")).toBe("epub")
    expect(detectFormat(file("mayak.docx"), "x")).toBe("docx")
    expect(detectFormat(file("mayak.fb2.zip"), "x.zip")).toBe("fb2zip")
    expect(detectFormat(file("mayak.fb2"), "x")).toBe("fb2")
    expect(detectFormat(file("mayak.pdf"), "x")).toBe("pdf")
    expect(detectFormat(file("mayak.txt"), "x.txt")).toBe("txt")
    expect(detectFormat(new Uint8Array([0, 1, 2, 3, 0, 0, 7, 8, 0, 0]), "x.mobi")).toBeNull()
  })

  test("PDF is left to the phone screen; unknown files get a clear message", async () => {
    await expect(parseBook(file("mayak.pdf"), "mayak.pdf")).rejects.toThrow(/на экране телефона/)
    await expect(parseBook(new Uint8Array([0, 1, 2, 0, 0, 0, 0, 0]), "x.mobi")).rejects.toThrow(/EPUB, FB2, PDF, DOCX или TXT/)
  })

  test("encodings: windows-1251, UTF-8, UTF-16 with a BOM", () => {
    const cp = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x2c, 0x20, 0xb8, 0xe6, 0x21]) // «Привет, ёж!»
    expect(decodeCp1251(cp)).toBe("Привет, ёж!")
    expect(decodeText(cp)).toBe("Привет, ёж!")
    expect(decodeText(new TextEncoder().encode("Привет, ёж!"))).toBe("Привет, ёж!")
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x1f, 0x04, 0x40, 0x04]))).toBe("Пр")
  })

  test("markup to paragraphs: entities, line breaks, scripts dropped", () => {
    expect(markupToText("<p>Он сказал:&nbsp;&laquo;Да&raquo;&#8230;</p><script>x()</script><p>Второй<br/>абзац &amp; всё</p>")).toBe(
      "Он сказал: «Да»…\nВторой\nабзац & всё",
    )
  })

  test("a plain text book without chapters, and «Глава» lines in Cyrillic", () => {
    expect(parseTxt("Просто текст без глав.\nВторая строка.").sections).toHaveLength(1)
    const b = parseTxt("Название\n\nГЛАВА ПЕРВАЯ\n\nТекст первой главы.\n\nChapter 2\n\nText of the second.")
    expect(b.title).toBe("Название")
    expect(b.sections.map((s) => s.title)).toEqual(["ГЛАВА ПЕРВАЯ", "Chapter 2"])
  })

  test("a zip archive: stored and deflated entries", () => {
    const z = unzip(file("mayak.epub"))
    expect(new TextDecoder().decode(z.get("mimetype")!.read())).toBe("application/epub+zip")
    expect(new TextDecoder().decode(z.get("OEBPS/content.opf")!.read())).toContain("<dc:title>Маяк на Северном мысе</dc:title>")
  })

  test("PDF pages from pdf.js: paragraphs, hyphenation, page numbers, chapters from the outline", () => {
    expect(pdfPageText("Он поднялся по лест-\nнице и открыл дверь.\nВнизу шумело море,\nи ветер усиливался.\n12")).toBe(
      "Он поднялся по лестнице и открыл дверь.\nВнизу шумело море, и ветер усиливался.",
    )
    const text = "Слово ".repeat(40)
    const b = pdfToBook([text, text, text], {name: "Книга_о_море.pdf"}, [{title: "Часть 1", page: 1}, {title: "Часть 2", page: 3}])
    expect(b.title).toBe("Книга о море")
    expect(b.sections.map((s) => `${s.title}:${s.page}`)).toEqual(["Часть 1:1", "Часть 1:2", "Часть 2:3"])
    expect(() => pdfToBook(["", "  ", "3"], {name: "scan.pdf"})).toThrow(/скан/)
  })
})

// ───────────────────────── search ─────────────────────────

async function data(name: string): Promise<BookData> {
  const pb = await parseBook(file(name), name)
  const {sections, chunks, words} = makeChunks(pb)
  const meta: BookMeta = {id: name, title: pb.title, author: pb.author, format: pb.format, lang: pb.lang, file: name, size: 0, words, chunks: chunks.length, sections: sections.length, addedAt: 0, on: true}
  return {v: 1, meta, sections, chunks}
}

describe("books: search", () => {
  test("the Russian stemmer: forms of a word meet", () => {
    expect(stemRu("маяки")).toBe(stemRu("маяк"))
    expect(stemRu("построили")).toBe(stemRu("построил"))
    expect(stemRu("линзами")).toBe(stemRu("линз"))
    expect(stemRu("смотрителя")).toBe(stemRu("смотритель"))
    expect(stemRu("часами")).toBe(stemRu("часы"))
    expect(stemEn("clocks")).toBe(stemEn("clock"))
    expect(stemEn("repaired")).toBe(stemEn("repair"))
    expect(terms("Кто построил этот маяк в 1874 году?")).toEqual([stemRu("построил"), "маяк", "1874", stemRu("году")])
  })

  test("pieces of a book keep their chapter and position", async () => {
    const d = await data("mayak.epub")
    expect(d.chunks.length).toBeGreaterThanOrEqual(3)
    expect(d.chunks.every((c) => c.s >= 0 && c.at >= 0 && c.at <= 1)).toBe(true)
    expect(sourceLabel(d, d.chunks[0])).toBe("«Маяк на Северном мысе», Глава 1. Камни и чертежи")
    // a long book is cut into ~160-word pieces
    const long = makeChunks({title: "", author: "", lang: "ru", format: "txt", sections: [{title: "", text: Array.from({length: 60}, (_, i) => `Абзац номер ${i} о море и ветре, о скалах и чайках.`).join("\n")}]})
    expect(long.chunks.length).toBeGreaterThan(2)
    expect(long.chunks.every((c) => c.t.split(/\s+/).length <= 270)).toBe(true)
    expect(sourceLabel({...d, sections: [""]}, {...long.chunks[1], s: 0})).toMatch(/≈ \d+% книги/)
  })

  test("the right chapter for a question; an English book found by translated search words", async () => {
    const idx = new BookIndex([await data("mayak.fb2"), await data("clockmaker.epub")])
    const ask = (q: string, extra: string[] = []) => {
      const query = [...terms(q).map((term) => ({term, w: 1})), ...extra.flatMap((e) => terms(e)).map((term) => ({term, w: 0.8}))]
      return pickExcerpts(idx.search(query, extra))
    }
    expect(ask("Кто построил маяк?")[0].label).toContain("Глава 1")
    expect(ask("Чем наградили смотрителя Громова?")[0].text).toContain("серебряными часами")
    const en = ask("Кто починил часы в Эннисе?", ["Brigid Doyle", "clock", "repair", "clockmaker", "Ennis"])
    expect(en[0].label).toBe("«The Clockmaker of Ennis», Chapter 1. The Town Clock")
    expect(en.every((e) => e.book.meta.lang === "en")).toBe(true) // weak matches from the other book are left out
    expect(ask("Какой курс биткоина?")).toEqual([])
  })

  test("prompts: search words in the books' languages; the answer only from the excerpts", () => {
    const meta = {title: "The Clockmaker of Ennis", author: "J. Example", lang: "en"} as BookMeta
    const {system, user} = buildQueryPrompt("Кто починил часы?", [meta], "Где это было?")
    expect(system).toContain("Языки книг: английский")
    expect(system).toContain("переведи слова на английский")
    expect(user).toBe("Книги: «The Clockmaker of Ennis» (J. Example)\nПредыдущий вопрос: «Где это было?»\nВопрос: «Кто починил часы?»")
    expect(parseQueryWords("Ключевые слова: Brigid Doyle, clock, «town clock», починил")).toEqual({
      words: ["Brigid Doyle", "clock", "town clock", "починил"],
      phrases: ["Brigid Doyle", "town clock"],
    })
    const sys = bookSystem(60, false)
    expect(sys).toContain("ТОЛЬКО эти отрывки")
    expect(sys).toContain("«В книгах этого нет.»")
    expect(sys).toContain("до 60 слов")
  })

  test("voice: the mode on and off; one question «по книгам, …»", () => {
    expect(parseBooksCommand("Режим книг")).toBe("on")
    expect(parseBooksCommand("ну включи книги")).toBe("on")
    expect(parseBooksCommand("Стоп книги")).toBe("off")
    expect(parseBooksCommand("обычный режим")).toBe("off")
    expect(parseBooksCommand("книги лежат на полке")).toBeNull()
    expect(booksPrefix("По книгам, кто такой Громов?")).toBe("кто такой Громов?")
    expect(booksPrefix("в моих книгах: что такое линза Френеля")).toBe("что такое линза Френеля")
    expect(booksPrefix("Кто написал книгу?")).toBeNull()
  })
})

// ───────────────────────── the library and the mode ─────────────────────────

class MemKV implements KV {
  m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

function fakeBlob() {
  const files = new Map<string, Uint8Array>()
  return {
    files,
    blob: {
      set: async (k: string, d: Uint8Array) => void files.set(k, d),
      bytes: async (k: string) => files.get(k) ?? null,
      delete: async (k: string) => void files.delete(k),
    },
  }
}

describe("books: the library on the phone", () => {
  test("added, kept as text in Mentra's storage, read back after a restart, switched off, deleted", async () => {
    const kv = new MemKV()
    const store = new Store(kv)
    const {files, blob} = fakeBlob()
    const mk = () => new Library({blob, loadList: () => store.loadBooks(), saveList: (l) => store.saveBooks(l), log: () => {}, now: () => 1, onChange: () => {}})
    const lib = mk()
    const meta = await lib.add(await parseBook(file("mayak.docx"), "mayak.docx"), {id: "b1", name: "mayak.docx", size: 2024})
    expect(meta).toMatchObject({id: "b1", title: "Маяк на Северном мысе", format: "docx", sections: 3, on: true})
    expect(files.has("books/b1.json")).toBe(true)

    const again = mk() // Mentra restarted
    expect(again.list.map((b) => b.title)).toEqual(["Маяк на Северном мысе"])
    expect((await again.ready())!.size).toBe(meta.chunks)
    again.setOn("b1", false)
    expect(await again.ready()).toBeNull()
    await again.remove("b1")
    expect(files.size).toBe(0)
    expect(store.loadBooks()).toEqual([])
  })
})

describe("mode «Книги» through the assistant", () => {
  async function setup(answers: string[], settings: Partial<typeof DEFAULT_SETTINGS> = {}) {
    const store = new Store(new MemKV())
    store.saveSettings({...DEFAULT_SETTINGS, apiKey: "sk-test-1234567890abcdef", ...settings})
    const {blob} = fakeBlob()
    const library = new Library({blob, loadList: () => store.loadBooks(), saveList: (l) => store.saveBooks(l), log: () => {}, now: () => 1, onChange: () => {}})
    await library.add(await parseBook(file("mayak.fb2"), "mayak.fb2"), {id: "m", name: "mayak.fb2", size: 1})
    await library.add(await parseBook(file("clockmaker.epub"), "clockmaker.epub"), {id: "c", name: "clockmaker.epub", size: 1})
    let t = 1_700_000_000_000
    const timers: {at: number; fn: () => void; id: number}[] = []
    let seq = 0
    const shown: string[] = []
    const requests: any[] = []
    const a = new Assistant({
      store,
      library,
      fetch: (async (_url: string, init: any) => {
        requests.push(JSON.parse(init.body))
        const text = answers.shift() ?? "Готово."
        return {ok: true, status: 200, text: async () => JSON.stringify({model: "gpt-6.1-terra", output: [{type: "message", content: [{type: "output_text", text}]}]})}
      }) as any,
      show: (s) => void shown.push(s),
      clear: () => void shown.push("<clear>"),
      now: () => t,
      setTimer: (fn, ms) => {
        timers.push({at: t + ms, fn, id: ++seq})
        return seq
      },
      clearTimer: (id) => {
        const i = timers.findIndex((x) => x.id === id)
        if (i >= 0) timers.splice(i, 1)
      },
    })
    const settle = async () => {
      for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0))
    }
    const advance = async (ms: number) => {
      const end = t + ms
      for (;;) {
        timers.sort((x, y) => x.at - y.at)
        const next = timers[0]
        if (!next || next.at > end) break
        timers.shift()
        t = next.at
        next.fn()
        await settle()
      }
      t = end
      await settle()
    }
    const say = async (text: string) => {
      a.onTranscript(text, true)
      await settle()
      await advance(SILENCE_MS + 10)
    }
    return {a, shown, requests, say, advance, library}
  }

  test("«Вопрос, режим книг»: answers come only from the excerpts, with the source", async () => {
    const e = await setup(["Штольц, Карл Штольц, инженер, построили, 1874, чертежи", "Маяк построили в 1874 году по чертежам инженера Карла Штольца (Маяк на Северном мысе, гл. 1)."])
    await e.say("Вопрос, режим книг")
    expect(e.a.settings.booksMode).toBe(true)
    expect(e.shown.at(-1)).toContain("Режим «Книги»: 2 книги.")
    await e.advance(6000)
    await e.say("Вопрос, кто построил маяк?")
    expect(e.requests).toHaveLength(2)
    // 1: search words, in the books' languages
    expect(e.requests[0].instructions).toMatch(/Языки книг: (русский, английский|английский, русский)\./)
    expect(e.requests[0].tools).toBeUndefined()
    // 2: the answer: strict rules, the excerpts, no web search, no general history
    expect(e.requests[1].instructions).toContain("ТОЛЬКО эти отрывки")
    const user = e.requests[1].input.at(-1).content as string
    expect(user).toContain("[1] «Маяк на Северном мысе», Глава 1. Камни и чертежи:")
    expect(user).toContain("Карла Штольца")
    expect(user.endsWith("Вопрос: кто построил маяк?")).toBe(true)
    expect(e.requests[1].tools).toBeUndefined()
    expect(e.shown.at(-1)).toContain("Карла Штольца")
    expect(e.a.history.at(-1)).toMatchObject({role: "assistant", src: "books"})
    expect(e.a.history.at(-2)).toMatchObject({role: "user", content: "кто построил маяк?", src: "books"})
  })

  test("nothing found: «В книгах этого нет» without asking the AI to answer", async () => {
    const e = await setup(["биткоин, курс, bitcoin, price"], {booksMode: true})
    await e.say("Вопрос, какой сейчас курс биткоина?")
    expect(e.requests).toHaveLength(1)
    expect(e.shown.at(-1)).toBe("В книгах этого нет.")
  })

  test("one question «по книгам, …» outside the mode; ordinary questions stay ordinary", async () => {
    const e = await setup(["Brigid Doyle, clock, Ennis", "Часы починила Бриджид Дойл в 1912 году (The Clockmaker of Ennis, Chapter 2).", "Обычный ответ."])
    await e.say("Вопрос, по книгам, кто починил часы в Эннисе?")
    expect(e.requests).toHaveLength(2)
    expect(e.requests[1].input.at(-1).content).toContain("«The Clockmaker of Ennis»")
    expect(e.a.settings.booksMode).toBe(false)
    await e.advance(100_000)
    await e.say("Вопрос, сколько будет два плюс два?")
    expect(e.requests).toHaveLength(3)
    expect(e.requests[2].instructions).not.toContain("отрывки")
  })

  test("a follow-up in the mode sees the earlier book question; «стоп книги» turns it off", async () => {
    const e = await setup(["Громов, смотритель", "Ефим Громов (гл. 2).", "Громов, награда, часы", "Серебряными часами (гл. 3)."], {booksMode: true})
    await e.say("Вопрос, кто был смотрителем?")
    await e.advance(100_000)
    await e.say("Вопрос, а чем его наградили?")
    expect(e.requests[2].input.at(-1).content).toContain("Предыдущий вопрос: «кто был смотрителем?»")
    const answer = e.requests[3]
    expect(answer.input.map((m: any) => m.role)).toEqual(["user", "assistant", "user"])
    expect(answer.input.at(-1).content).toContain("серебряными часами")
    await e.advance(100_000)
    await e.say("Стоп книги")
    expect(e.a.settings.booksMode).toBe(false)
  })

  test("a bare «Книги» said in passing does not switch the mode", async () => {
    const e = await setup([])
    await e.say("Книги")
    expect(e.a.settings.booksMode).toBe(false)
    await e.say("Вопрос, книги")
    expect(e.a.settings.booksMode).toBe(true)
  })

  test("no books on: says how to add them", async () => {
    const e = await setup([], {booksMode: true})
    e.library.setOn("m", false)
    e.library.setOn("c", false)
    await e.say("Вопрос, кто построил маяк?")
    expect(e.requests).toHaveLength(0)
    expect(e.shown.at(-1)).toContain("Все книги выключены")
  })
})
