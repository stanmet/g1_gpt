/**
 * Text preparation for the Even Realities G1 display (640×200 panel, 5 text lines).
 *
 * The Mentra host wraps text itself before sending it to G1. If a line we send is
 * wider than the host thinks fits, the host re-wraps it and the page overflows 5
 * lines (the tail gets cut). So we wrap with widths that are never smaller than
 * either the host's estimate or the real firmware glyph width.
 */
import {G1_GLYPH_PX} from "./glyphs"

/** Host wrap width for G1 is 576 px; keep a safety margin. */
export const G1_LINE_PX = 556
export const G1_LINES = 5

const UNKNOWN_PX = 18

export function charPx(ch: string): number {
  return G1_GLYPH_PX[ch] ?? UNKNOWN_PX
}

export function textPx(s: string): number {
  let w = 0
  for (const ch of s) w += charPx(ch)
  return w
}

/** Replacements for common characters the G1 font does not contain. */
const REPLACE: Record<string, string> = {
  "№": "No",
  " ": " ",
  " ": " ",
  " ": " ",
  "\t": " ",
  "‑": "-",
  "‐": "-",
  "−": "-",
  "×": "x",
  "✓": "+",
  "✔": "+",
  "✗": "x",
  "★": "*",
  "➜": "→",
  "⇒": "→",
  "⟶": "→",
  "´": "'",
  "`": "'",
}

/**
 * Turn model output (which may contain Markdown, emoji, links) into plain text
 * that only uses glyphs the G1 can draw. Paragraphs are kept as single newlines;
 * blank lines are dropped because every line on a 5-line display is precious.
 */
export function sanitizeForG1(input: string): string {
  let t = String(input ?? "").replace(/\r\n?/g, "\n")

  // Code fences: keep the code, drop the fences.
  t = t.replace(/```[^\n]*\n?/g, "")
  // Images and links: keep the visible text.
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  t = t.replace(/\[([^\]]+)\]\((?:[^()]|\([^)]*\))*\)/g, "$1")
  // Bare URLs are unreadable on glasses — keep only the domain.
  t = t.replace(/https?:\/\/(?:www\.)?([^\s/)]+)[^\s)]*/g, "$1")
  // Headings, blockquotes, horizontal rules.
  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
  t = t.replace(/^[ \t]{0,3}>[ \t]?/gm, "")
  t = t.replace(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, "")
  // Table rows → cells separated by " · "; separator rows removed.
  t = t.replace(/^[ \t]*\|?([ \t]*:?-{2,}:?[ \t]*\|)+[ \t]*:?-*:?[ \t]*$/gm, "")
  t = t.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_m, inner: string) =>
    inner
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
      .join(" · "),
  )
  // Bullets.
  t = t.replace(/^[ \t]*[-*+•▪●◦][ \t]+/gm, "• ")
  // Emphasis and inline code markers.
  t = t.replace(/(\*\*|__)(.+?)\1/g, "$2")
  t = t.replace(/(^|[\s(«"])[*_]([^*_\n]+)[*_](?=[\s).,!?:;»"]|$)/g, "$1$2")
  t = t.replace(/`([^`]*)`/g, "$1")
  // Citations like 【1†source】 or [1] left by web search.
  t = t.replace(/【[^】]*】/g, "")
  t = t.replace(/\s?\[\d+(?:,\s*\d+)*\]/g, "")

  let out = ""
  for (const ch of t) {
    const r = REPLACE[ch]
    if (r !== undefined) {
      out += r
    } else if (ch === "\n" || G1_GLYPH_PX[ch] !== undefined) {
      out += ch
    }
    // anything else (emoji, CJK, rare symbols) is dropped: G1 would show nothing or a box
  }

  return out
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
}

/** Split a word that alone is wider than the line into pieces that fit. */
function splitLongWord(word: string, maxPx: number): string[] {
  const parts: string[] = []
  let cur = ""
  let w = 0
  const hyphen = charPx("-")
  for (const ch of word) {
    const cw = charPx(ch)
    if (cur && w + cw + hyphen > maxPx) {
      parts.push(cur + "-")
      cur = ""
      w = 0
    }
    cur += ch
    w += cw
  }
  if (cur) parts.push(cur)
  return parts
}

/** Greedy word wrap of already-sanitized text into display lines. */
export function wrapLines(text: string, maxPx: number = G1_LINE_PX): string[] {
  const lines: string[] = []
  const space = charPx(" ")
  for (const para of text.split("\n")) {
    const words = para.split(" ").filter(Boolean)
    let cur = ""
    let w = 0
    for (const word of words) {
      const pieces = textPx(word) > maxPx ? splitLongWord(word, maxPx) : [word]
      for (const piece of pieces) {
        const pw = textPx(piece)
        if (!cur) {
          cur = piece
          w = pw
        } else if (w + space + pw <= maxPx) {
          cur += " " + piece
          w += space + pw
        } else {
          lines.push(cur)
          cur = piece
          w = pw
        }
      }
    }
    if (cur) lines.push(cur)
  }
  return lines
}

export interface PaginateOptions {
  linesPerScreen?: number
  maxPx?: number
}

/**
 * Split text into screens. A single screen uses all 5 lines. With several
 * screens each one has 4 lines of text plus a footer like "2/3 · дальше/назад".
 */
export function paginate(text: string, opts: PaginateOptions = {}): string[] {
  const linesPerScreen = opts.linesPerScreen ?? G1_LINES
  const maxPx = opts.maxPx ?? G1_LINE_PX
  const lines = wrapLines(text, maxPx)
  if (lines.length === 0) return []
  if (lines.length <= linesPerScreen) return [lines.join("\n")]

  const perPage = linesPerScreen - 1
  const total = Math.ceil(lines.length / perPage)
  const pages: string[] = []
  for (let i = 0; i < total; i++) {
    const chunk = lines.slice(i * perPage, (i + 1) * perPage)
    const hint = i === total - 1 ? (total > 1 ? "назад · сначала" : "") : "дальше"
    const footer = `${i + 1}/${total} · ${hint}`
    pages.push([...chunk, footer].join("\n"))
  }
  return pages
}

/** Fit a short status message on one screen (truncating if needed). */
export function fitScreen(text: string, maxLines: number = G1_LINES): string {
  const lines = wrapLines(sanitizeForG1(text))
  if (lines.length <= maxLines) return lines.join("\n")
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…"
  return kept.join("\n")
}
