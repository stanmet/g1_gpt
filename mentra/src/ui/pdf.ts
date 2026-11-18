/**
 * The text of a PDF book, read on the phone screen with pdf.js (the background engine has no DOM).
 * Loaded on demand as its own chunk; the pdf.js worker runs on this thread.
 */
// @ts-ignore — vendored ES module without types
import * as pdfjs from "../../vendor/pdfjs/pdf.mjs"
// @ts-ignore
import * as worker from "../../vendor/pdfjs/pdf.worker.mjs"

export interface PdfText {
  title: string
  author: string
  pages: number
  /** Top-level chapters of the PDF's own table of contents, with their first page (1-based). */
  outline: {title: string; page: number}[]
}

interface Item {
  str: string
  hasEOL?: boolean
  width?: number
  height?: number
  transform?: number[]
}

/** One page's text items → lines: a space where words stand apart, a line break where the line changes. */
export function itemsToText(items: Item[]): string {
  let out = ""
  let lastX = NaN
  let lastY = NaN
  for (const it of items) {
    if (typeof it?.str !== "string") continue
    const x = it.transform?.[4] ?? NaN
    const y = it.transform?.[5] ?? NaN
    const h = Math.abs(it.height || it.transform?.[3] || 10)
    if (out && !out.endsWith("\n") && Number.isFinite(y) && Number.isFinite(lastY) && Math.abs(y - lastY) > h * 0.6) out += "\n"
    else if (out && !/\s$/.test(out) && it.str && !/^\s/.test(it.str) && Number.isFinite(x) && Number.isFinite(lastX) && x - lastX > h * 0.15) out += " "
    out += it.str
    if (it.hasEOL) out += "\n"
    lastX = Number.isFinite(x) ? x + (it.width ?? 0) : NaN
    if (Number.isFinite(y)) lastY = y
  }
  return out
}

/** Reads every page, handing each one's text over as it goes (for progress and batches). */
export async function readPdf(data: Uint8Array, onPage: (index: number, total: number, text: string) => Promise<void> | void): Promise<PdfText> {
  const g = globalThis as any
  if (!g.pdfjsWorker) g.pdfjsWorker = worker
  const doc = await pdfjs.getDocument({data, isEvalSupported: false, disableFontFace: true, stopAtErrors: false}).promise
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      await onPage(i - 1, doc.numPages, itemsToText(tc.items as Item[]))
      page.cleanup()
    }
    let title = ""
    let author = ""
    try {
      const meta = await doc.getMetadata()
      title = String(meta?.info?.Title ?? "").trim()
      author = String(meta?.info?.Author ?? "").trim()
    } catch {
      // no metadata
    }
    const outline: {title: string; page: number}[] = []
    try {
      const items = (await doc.getOutline()) ?? []
      // top level, and the level below when the top is a single «book» entry
      const list = items.length === 1 && items[0].items?.length ? items[0].items : items
      for (const it of list.slice(0, 400)) {
        try {
          const dest = typeof it.dest === "string" ? await doc.getDestination(it.dest) : it.dest
          if (!Array.isArray(dest) || !dest[0]) continue
          const index = typeof dest[0] === "number" ? dest[0] : await doc.getPageIndex(dest[0])
          if (String(it.title ?? "").trim()) outline.push({title: String(it.title).trim(), page: index + 1})
        } catch {
          // a broken link in the table of contents
        }
      }
    } catch {
      // no outline
    }
    return {title, author, pages: doc.numPages, outline}
  } finally {
    await doc.destroy()
  }
}
