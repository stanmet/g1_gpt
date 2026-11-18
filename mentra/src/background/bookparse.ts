/**
 * Books → plain text with chapters, inside the Mentra background engine (no DOM, no libraries):
 *   EPUB  — zip: container.xml → OPF (title, author, language, reading order) → XHTML chapters,
 *           chapter names from the table of contents (EPUB 3 nav or EPUB 2 NCX) or the first heading
 *   FB2   — XML (often windows-1251), also .fb2.zip; chapters from <title>
 *   DOCX  — zip: word/document.xml; chapters from heading styles
 *   TXT   — UTF-8, UTF-16 or windows-1251; chapters from «Глава 3», «Часть II», «Chapter 5»
 * PDF is read on the phone screen with pdf.js (books.ts takes the pages from there).
 */
import {inflateRaw} from "../shared/inflate"

export type BookFormat = "epub" | "fb2" | "docx" | "txt" | "pdf"

export interface BookSection {
  /** Chapter name («Глава 3. Седьмое доказательство»), "" when the book has none. */
  title: string
  /** Paragraphs separated by "\n". */
  text: string
  /** First page (PDF). */
  page?: number
}

export interface ParsedBook {
  title: string
  author: string
  /** "ru", "en", … from the book or guessed from its letters. */
  lang: string
  format: BookFormat
  sections: BookSection[]
}

/** A problem the user should see, in Russian. */
export class BookError extends Error {}

// ───────────────────────── zip ─────────────────────────

export interface ZipEntry {
  name: string
  read(): Uint8Array
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

/** The files in a zip archive (stored or deflated), read on demand. */
export function unzip(bytes: Uint8Array): Map<string, ZipEntry> {
  // end of central directory: the last 22+ bytes
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new BookError("Файл повреждён: это не zip-архив")
  const count = u16(bytes, eocd + 10)
  let p = u32(bytes, eocd + 16)
  const out = new Map<string, ZipEntry>()
  const utf8 = new TextDecoder("utf-8")
  for (let i = 0; i < count && p + 46 <= bytes.length; i++) {
    if (u32(bytes, p) !== 0x02014b50) break
    const method = u16(bytes, p + 10)
    const csize = u32(bytes, p + 20)
    const usize = u32(bytes, p + 24)
    const nlen = u16(bytes, p + 28)
    const xlen = u16(bytes, p + 30)
    const clen = u16(bytes, p + 32)
    const local = u32(bytes, p + 42)
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nlen))
    p += 46 + nlen + xlen + clen
    if (name.endsWith("/")) continue
    out.set(name, {
      name,
      read() {
        if (u32(bytes, local) !== 0x04034b50) throw new BookError("Файл повреждён: zip-архив не читается")
        const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28)
        const data = bytes.subarray(start, start + csize)
        if (method === 0) return data
        if (method === 8) return inflateRaw(data, usize || data.length * 4)
        throw new BookError(`Сжатие ${method} в архиве не поддерживается`)
      },
    })
  }
  return out
}

// ───────────────────────── text encodings ─────────────────────────

/** windows-1251 bytes 0x80–0xFF. */
const CP1251 =
  "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—\u0098™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕї" +
  "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"

export function decodeCp1251(b: Uint8Array): string {
  let s = ""
  const CH = 8192
  for (let i = 0; i < b.length; i += CH) {
    const part: string[] = []
    for (let j = i; j < Math.min(b.length, i + CH); j++) {
      const c = b[j]
      part.push(c < 0x80 ? String.fromCharCode(c) : CP1251[c - 0x80])
    }
    s += part.join("")
  }
  return s
}

function decodeUtf16(b: Uint8Array, le: boolean): string {
  const parts: string[] = []
  let chunk: number[] = []
  for (let i = 0; i + 1 < b.length; i += 2) {
    chunk.push(le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1])
    if (chunk.length >= 8192) {
      parts.push(String.fromCharCode(...chunk))
      chunk = []
    }
  }
  if (chunk.length) parts.push(String.fromCharCode(...chunk))
  return parts.join("")
}

/** True when the bytes are valid UTF-8 (a sample is enough to tell it from windows-1251). */
function looksUtf8(b: Uint8Array): boolean {
  const n = Math.min(b.length, 200_000)
  let multi = 0
  for (let i = 0; i < n; ) {
    const c = b[i]
    const len = c < 0x80 ? 1 : c >= 0xc2 && c < 0xe0 ? 2 : c >= 0xe0 && c < 0xf0 ? 3 : c >= 0xf0 && c < 0xf5 ? 4 : 0
    if (!len) return false
    for (let k = 1; k < len; k++) {
      if (i + k >= n) return true // cut in the middle of the sample
      if ((b[i + k] & 0xc0) !== 0x80) return false
    }
    if (len > 1) multi++
    i += len
  }
  return true
}

/** Text from bytes: a BOM, a declared encoding («windows-1251»), else UTF-8 when valid, else windows-1251. */
export function decodeText(b: Uint8Array, declared = ""): string {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder("utf-8").decode(b.subarray(3))
  if (b[0] === 0xff && b[1] === 0xfe) return decodeUtf16(b.subarray(2), true)
  if (b[0] === 0xfe && b[1] === 0xff) return decodeUtf16(b.subarray(2), false)
  const enc = declared.toLowerCase()
  if (/1251|cp-?1251/.test(enc)) return decodeCp1251(b)
  if (/utf-?16/.test(enc)) return decodeUtf16(b, true)
  if (!enc || /utf-?8/.test(enc)) {
    if (looksUtf8(b)) return new TextDecoder("utf-8").decode(b)
    return decodeCp1251(b)
  }
  return looksUtf8(b) ? new TextDecoder("utf-8").decode(b) : decodeCp1251(b)
}

// ───────────────────────── XML / XHTML ─────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", laquo: "«", raquo: "»",
  hellip: "…", copy: "©", reg: "®", trade: "™", bull: "•", middot: "·", lsquo: "‘", rsquo: "’", ldquo: "“",
  rdquo: "”", bdquo: "„", shy: "", thinsp: " ", ensp: " ", emsp: " ", deg: "°", times: "×", minus: "−", sect: "§",
  para: "¶", euro: "€", pound: "£", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä",
  szlig: "ß", iexcl: "¡", iquest: "¿", prime: "′", Prime: "″",
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ""
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m
  })
}

const BLOCK_END = /<\/(?:p|div|h[1-6]|li|tr|blockquote|section|title|subtitle|v|stanza|poem|epigraph|cite|text-author|dd|dt|pre|table|ul|ol|figure|figcaption|article|aside|header|footer|td|th)\s*>|<br\s*\/?>|<(?:p|div|h[1-6]|li|tr|v|subtitle|empty-line)\b[^>]*\/>/gi

/** XHTML or FB2 markup → paragraphs separated by "\n". */
export function markupToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<(script|style|head|binary)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(BLOCK_END, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/[\s ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
}

/** The first `<tag …>…</tag>` content (any namespace prefix), or "". */
function tagText(xml: string, tag: string): string {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}\\s*>`, "i").exec(xml)
  return m ? markupToText(m[1]).replace(/\n/g, " ").trim() : ""
}

function attr(tag: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag)
  return m ? decodeEntities(m[2] ?? m[3] ?? "") : ""
}

// ───────────────────────── language ─────────────────────────

/** "ru" when Cyrillic letters dominate a sample, "en" when Latin do. */
export function guessLang(text: string): string {
  const sample = text.slice(0, 20_000)
  const cyr = (sample.match(/[а-яё]/gi) ?? []).length
  const lat = (sample.match(/[a-z]/gi) ?? []).length
  return cyr >= lat ? "ru" : "en"
}

const normLang = (l: string) => String(l ?? "").toLowerCase().split(/[-_]/)[0].trim()

// ───────────────────────── formats ─────────────────────────

/** The format from the first bytes, the file name and (for zips) what is inside. */
export function detectFormat(bytes: Uint8Array, name = ""): BookFormat | "fb2zip" | null {
  const n = name.toLowerCase()
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf" // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    if (n.endsWith(".epub")) return "epub"
    if (n.endsWith(".docx")) return "docx"
    if (n.endsWith(".fb2.zip") || n.endsWith(".fbz")) return "fb2zip"
    try {
      const z = unzip(bytes)
      if (z.has("META-INF/container.xml") || z.has("mimetype")) return "epub"
      if (z.has("word/document.xml")) return "docx"
      if ([...z.keys()].some((k) => k.toLowerCase().endsWith(".fb2"))) return "fb2zip"
    } catch {
      return null
    }
    return null
  }
  if (n.endsWith(".pdf")) return "pdf"
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 600))
  if (n.endsWith(".fb2") || /<FictionBook\b/i.test(head)) return "fb2"
  if (n.endsWith(".epub") || n.endsWith(".docx")) return null
  // anything else that is mostly text
  const sample = bytes.subarray(0, 4000)
  let ctrl = 0
  for (const c of sample) if (c < 9 || (c > 13 && c < 32)) ctrl++
  return ctrl < sample.length * 0.02 ? "txt" : null
}

const base = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "")

/** «OEBPS/Text/../Images/x.jpg» → «OEBPS/Images/x.jpg». */
function joinPath(dir: string, rel: string): string {
  let r = rel.split("#")[0]
  try {
    r = decodeURIComponent(r)
  } catch {
    // keep as is
  }
  const parts = (r.startsWith("/") ? r.slice(1) : dir + r).split("/")
  const out: string[] = []
  for (const p of parts) {
    if (p === "..") out.pop()
    else if (p && p !== ".") out.push(p)
  }
  return out.join("/")
}

function readString(zip: Map<string, ZipEntry>, path: string): string {
  const e = zip.get(path) ?? [...zip.values()].find((x) => x.name.toLowerCase() === path.toLowerCase())
  if (!e) return ""
  const b = e.read()
  const decl = /encoding\s*=\s*["']([\w-]+)/i.exec(new TextDecoder("utf-8").decode(b.subarray(0, 200)))?.[1] ?? ""
  return decodeText(b, decl)
}

const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0))

export async function parseEpub(bytes: Uint8Array): Promise<ParsedBook> {
  const zip = unzip(bytes)
  const container = readString(zip, "META-INF/container.xml")
  const opfPath = /full-path\s*=\s*"([^"]+)"/i.exec(container)?.[1] ?? [...zip.keys()].find((k) => k.endsWith(".opf"))
  if (!opfPath) throw new BookError("В EPUB нет описания книги (OPF)")
  const opf = readString(zip, opfPath)
  const dir = base(opfPath)
  const manifest = new Map<string, {href: string; type: string; props: string}>()
  for (const m of opf.matchAll(/<(?:[\w-]+:)?item\b[^>]*>/gi)) {
    const id = attr(m[0], "id")
    if (id) manifest.set(id, {href: joinPath(dir, attr(m[0], "href")), type: attr(m[0], "media-type"), props: attr(m[0], "properties")})
  }
  const spine = [...opf.matchAll(/<(?:[\w-]+:)?itemref\b[^>]*>/gi)].map((m) => manifest.get(attr(m[0], "idref"))).filter((x) => x && /html|xml/i.test(x.type))

  // chapter names from the table of contents: file → first title pointing into it
  const toc = new Map<string, string>()
  const nav = [...manifest.values()].find((x) => /\bnav\b/.test(x.props))
  if (nav) {
    const html = readString(zip, nav.href)
    for (const a of html.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)) {
      const file = joinPath(base(nav.href), a[2] ?? a[3] ?? "")
      const title = markupToText(a[4]).replace(/\n/g, " ")
      if (title && !toc.has(file)) toc.set(file, title)
    }
  }
  const ncx = [...manifest.values()].find((x) => /ncx/i.test(x.type))
  if (!toc.size && ncx) {
    const xml = readString(zip, ncx.href)
    for (const np of xml.matchAll(/<navLabel>\s*<text>([\s\S]*?)<\/text>\s*<\/navLabel>\s*<content\b[^>]*src\s*=\s*"([^"]*)"/gi)) {
      const file = joinPath(base(ncx.href), np[2])
      const title = markupToText(np[1]).replace(/\n/g, " ")
      if (title && !toc.has(file)) toc.set(file, title)
    }
  }

  const sections: BookSection[] = []
  for (const item of spine) {
    const html = readString(zip, item!.href)
    const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
    const text = markupToText(body)
    if (!text) continue
    const heading = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(body)
    const title = toc.get(item!.href) ?? (heading ? markupToText(heading[1]).replace(/\n/g, " ") : "")
    sections.push({title: title.slice(0, 160), text})
    await yieldNow()
  }
  if (!sections.length) throw new BookError("В EPUB не нашлось текста")
  const lang = normLang(tagText(opf, "language")) || guessLang(sections.map((s) => s.text).join(" "))
  return {title: tagText(opf, "title"), author: tagText(opf, "creator"), lang, format: "epub", sections}
}

export function parseFb2(xml: string): ParsedBook {
  const info = /<title-info\b[^>]*>([\s\S]*?)<\/title-info>/i.exec(xml)?.[1] ?? ""
  const authorXml = /<author\b[^>]*>([\s\S]*?)<\/author>/i.exec(info)?.[1] ?? ""
  const author = ["first-name", "middle-name", "last-name"].map((t) => tagText(authorXml, t)).filter(Boolean).join(" ") || tagText(authorXml, "nickname")
  const title = tagText(info, "book-title")
  // the main text: bodies except notes and comments
  const bodies = [...xml.matchAll(/<body\b([^>]*)>([\s\S]*?)<\/body>/gi)]
  const main = bodies.filter((b) => !/name\s*=\s*["'](?:notes|comments|footnotes)["']/i.test(b[1]))
  const content = (main.length ? main : bodies).map((b) => b[2]).join("\n")
  const sections: BookSection[] = []
  let current: BookSection = {title: "", text: ""}
  // every <title> starts a chapter; a part title right before a chapter title is joined to it
  const re = /<title\b[^>]*>([\s\S]*?)<\/title>/gi
  let last = 0
  for (const m of content.matchAll(re)) {
    const before = markupToText(content.slice(last, m.index))
    const t = markupToText(m[1]).replace(/\n/g, ". ")
    if (before) {
      current.text = [current.text, before].filter(Boolean).join("\n")
      sections.push(current)
      current = {title: t, text: ""}
    } else current.title = current.title ? `${current.title}. ${t}` : t
    last = (m.index ?? 0) + m[0].length
  }
  const tail = markupToText(content.slice(last))
  if (tail) current.text = [current.text, tail].filter(Boolean).join("\n")
  if (current.text) sections.push(current)
  const kept = sections.filter((s) => s.text.trim())
  if (!kept.length) throw new BookError("В FB2 не нашлось текста")
  for (const s of kept) s.title = dropBookTitle(s.title, title)
  const lang = normLang(tagText(info, "lang")) || guessLang(kept[0].text)
  return {title, author, lang, format: "fb2", sections: kept.map((s) => ({...s, title: s.title.slice(0, 160)}))}
}

export function parseDocx(bytes: Uint8Array): ParsedBook {
  const zip = unzip(bytes)
  const doc = readString(zip, "word/document.xml")
  if (!doc) throw new BookError("В DOCX нет текста документа")
  // heading styles: by name («heading 1», «Title», «Заголовок 1») or a built-in id
  const headingIds = new Set<string>()
  for (const s of readString(zip, "word/styles.xml").matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const name = /<w:name w:val="([^"]+)"/.exec(s[2])?.[1] ?? ""
    if (/^(heading|title|заголовок)(?=[\s\d]|$)/i.test(name)) headingIds.add(s[1])
  }
  const isHeading = (id: string) => headingIds.has(id) || /^(heading|title|заголовок)\s*\d*$/i.test(id)
  const sections: BookSection[] = []
  let current: BookSection = {title: "", text: ""}
  for (const p of doc.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const xml = p[1]
    let raw = ""
    for (const m of xml.matchAll(/<w:t(?:\s[^>\/]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>/g)) raw += m[1] ?? " "
    const text = decodeEntities(raw).replace(/[ \t ]+/g, " ").trim()
    if (!text) continue
    const style = /<w:pStyle w:val="([^"]+)"/.exec(xml)?.[1] ?? ""
    if (isHeading(style) && text.length < 200) {
      if (current.text) sections.push(current)
      current = {title: current.text ? text : [current.title, text].filter(Boolean).join(". "), text: ""}
    } else current.text = current.text ? `${current.text}\n${text}` : text
  }
  if (current.text) sections.push(current)
  if (!sections.length) throw new BookError("В DOCX не нашлось текста")
  const core = readString(zip, "docProps/core.xml")
  for (const s of sections) s.title = dropBookTitle(s.title, tagText(core, "title"))
  return {
    title: tagText(core, "title"),
    author: tagText(core, "creator"),
    lang: guessLang(sections.map((s) => s.text).join(" ")),
    format: "docx",
    sections,
  }
}

/** «Маяк. Глава 1» → «Глава 1» when «Маяк» is the book's own title. */
function dropBookTitle(sectionTitle: string, bookTitle: string): string {
  const b = bookTitle.trim().toLowerCase()
  if (!b) return sectionTitle
  const parts = sectionTitle.split(". ").filter((p) => p.trim().toLowerCase() !== b)
  return parts.join(". ")
}

// no \b: in JavaScript it does not see Cyrillic letters as word characters
const CHAPTER_LINE =
  /^(?:глава|часть|книга|раздел|пролог|эпилог|предисловие|послесловие|введение|заключение|chapter|part|book|prologue|epilogue|preface|introduction)(?=[\s.:\-–—\d]|$)[^\n]{0,80}$/i

export function parseTxt(text: string): ParsedBook {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  // a short first line followed by an empty one is the title
  let title = ""
  const first = lines.findIndex((l) => l.trim())
  if (first >= 0 && lines[first].trim().length <= 80 && !lines[first + 1]?.trim() && !CHAPTER_LINE.test(lines[first].trim())) {
    title = lines[first].trim()
    lines.splice(0, first + 1)
  }
  const sections: BookSection[] = []
  let current: BookSection = {title: "", text: ""}
  let paras: string[] = []
  let para: string[] = []
  const endPara = () => {
    if (para.length) paras.push(para.join(" ").replace(/\s+/g, " ").trim())
    para = []
  }
  const flush = () => {
    endPara()
    current.text = paras.filter(Boolean).join("\n")
    if (current.text) sections.push(current)
    paras = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      endPara()
      continue
    }
    if (CHAPTER_LINE.test(line) && line.length <= 90) {
      flush()
      current = {title: line, text: ""}
      continue
    }
    // indented lines start paragraphs in many TXT books
    if (/^\s{2,}|^\t/.test(raw)) endPara()
    para.push(line)
  }
  flush()
  if (!sections.length) throw new BookError("В файле нет текста")
  return {title, author: "", lang: guessLang(text), format: "txt", sections}
}

/** Any supported book except PDF (that one is read on the phone screen). */
export async function parseBook(bytes: Uint8Array, name = ""): Promise<ParsedBook> {
  const fmt = detectFormat(bytes, name)
  let book: ParsedBook
  switch (fmt) {
    case "epub":
      book = await parseEpub(bytes)
      break
    case "docx":
      book = parseDocx(bytes)
      break
    case "fb2zip": {
      const z = unzip(bytes)
      const e = [...z.values()].find((x) => x.name.toLowerCase().endsWith(".fb2"))
      if (!e) throw new BookError("В архиве нет FB2")
      const b = e.read()
      book = parseFb2(decodeText(b, /encoding\s*=\s*["']([\w-]+)/i.exec(new TextDecoder("utf-8").decode(b.subarray(0, 200)))?.[1] ?? ""))
      break
    }
    case "fb2":
      book = parseFb2(decodeText(bytes, /encoding\s*=\s*["']([\w-]+)/i.exec(new TextDecoder("utf-8").decode(bytes.subarray(0, 200)))?.[1] ?? ""))
      break
    case "txt":
      book = parseTxt(decodeText(bytes))
      break
    case "pdf":
      throw new BookError("PDF читается на экране телефона")
    default:
      throw new BookError("Этот формат не поддерживается: нужны EPUB, FB2, PDF, DOCX или TXT")
  }
  if (!book.title) book.title = fileTitle(name)
  return book
}

/** «Bulgakov_Master_i_Margarita.fb2.zip» → «Bulgakov Master i Margarita». */
export function fileTitle(name: string): string {
  return (
    String(name ?? "")
      .replace(/^.*[\\/]/, "")
      .replace(/(\.fb2)?\.(zip|epub|fb2|fbz|docx|txt|pdf)$/i, "")
      .replace(/[_]+/g, " ")
      .trim() || "Без названия"
  )
}

// ───────────────────────── PDF (pages read by pdf.js on the phone screen) ─────────────────────────

/**
 * Lines of one PDF page → paragraphs: a line that ends a sentence and a next line that starts with
 * a capital letter begin a new paragraph; words broken with a hyphen at the line end are joined.
 */
export function pdfPageText(page: string): string {
  const lines = String(page ?? "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => !/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(l) || !l) // page numbers
  const paras: string[] = []
  let cur = ""
  for (const line of lines) {
    if (!line) {
      // an empty line between paragraphs
      if (cur) paras.push(cur)
      cur = ""
      continue
    }
    if (!cur) {
      cur = line
      continue
    }
    if (/[а-яёa-z]-$/i.test(cur) && /^[а-яёa-z]/.test(line)) cur = cur.slice(0, -1) + line
    else if (/[.!?…:»"”)]$/.test(cur) && /^[«"„“(—–\-A-ZА-ЯЁ0-9]/.test(line)) {
      paras.push(cur)
      cur = line
    } else cur += " " + line
  }
  if (cur) paras.push(cur)
  return paras.join("\n")
}

/** Pages and outline from pdf.js → a book: one section per page, named after its chapter. */
export function pdfToBook(
  pages: string[],
  info: {title?: string; author?: string; name?: string},
  outline: {title: string; page: number}[] = [],
): ParsedBook {
  const marks = outline.filter((o) => o.title && Number.isFinite(o.page) && o.page >= 1).sort((a, b) => a.page - b.page)
  const sections: BookSection[] = []
  pages.forEach((raw, i) => {
    const page = i + 1
    const text = pdfPageText(raw)
    if (!text) return
    let title = ""
    for (const m of marks) if (m.page <= page) title = m.title.replace(/\s+/g, " ").trim().slice(0, 160)
    sections.push({title, text, page})
  })
  const words = sections.reduce((a, s) => a + s.text.split(/\s+/).length, 0)
  if (words < 30) throw new BookError("В этом PDF нет текста — похоже, это скан страниц. Нужен PDF с текстовым слоем.")
  // a PDF's own title is often the name of the file it was made from
  const own = String(info.title ?? "").trim()
  const junk = !own || /\.(docx?|pdf|txt|rtf|indd|tex|odt)$|^microsoft word|^untitled|^без имени/i.test(own)
  return {
    title: junk ? fileTitle(info.name ?? "") : own,
    author: String(info.author ?? "").trim(),
    lang: guessLang(sections.map((s) => s.text).join(" ")),
    format: "pdf",
    sections,
  }
}
