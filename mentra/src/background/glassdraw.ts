/**
 * Drawing on the G1 as a picture: a 1-bit canvas, text in the generated Inter font, lines and
 * shapes, and the bitmap format Mentra sends to the G1 (a 576×135 one-bit BMP).
 *
 * Mentra's conventions (cloud SDK bitmap utils, G1 driver): white background, black drawing; the
 * phone inverts the bits before sending, so what is black here lights up on the glasses. Only the
 * area 526×100 at (50, 35) is reliably visible — the rest is padding.
 */
import {GLASS_FONTS} from "./glassfont.data"

export const G1_BMP_W = 576
export const G1_BMP_H = 135
/** The visible part of the bitmap on the G1 (Mentra: «526×100, padded to 576×135»). */
export const G1_SAFE = {x: 50, y: 35, w: 526, h: 100}

export class Canvas {
  /** 1 = lit on the glasses. Row-major, top-down. */
  readonly px: Uint8Array

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Uint8Array(w * h)
  }

  set(x: number, y: number, v = 1): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px[y * this.w + x] = v
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.px[y * this.w + x]
  }

  /** Filled disc. */
  disc(cx: number, cy: number, r: number, v = 1): void {
    const ri = Math.ceil(r)
    const r2 = r * r
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) if (dx * dx + dy * dy <= r2) this.set(cx + dx, cy + dy, v)
  }

  /** Circle outline `t` px thick. */
  ring(cx: number, cy: number, r: number, t = 2, v = 1): void {
    const ro = r * r
    const ri = Math.max(0, r - t) ** 2
    const n = Math.ceil(r)
    for (let dy = -n; dy <= n; dy++)
      for (let dx = -n; dx <= n; dx++) {
        const d = dx * dx + dy * dy
        if (d <= ro && d >= ri) this.set(cx + dx, cy + dy, v)
      }
  }

  /** Line `t` px thick; `dash` = [on, off] px for minor paths. */
  line(x0: number, y0: number, x1: number, y1: number, t = 1, v = 1, dash?: [number, number]): void {
    const len = Math.hypot(x1 - x0, y1 - y0)
    const steps = Math.max(1, Math.ceil(len * 2))
    const r = (t - 1) / 2
    const period = dash ? dash[0] + dash[1] : 0
    for (let i = 0; i <= steps; i++) {
      const s = i / steps
      if (dash && (s * len) % period >= dash[0]) continue
      const x = x0 + (x1 - x0) * s
      const y = y0 + (y1 - y0) * s
      if (r <= 0) this.set(x, y, v)
      else this.disc(x, y, r + 0.35, v)
    }
  }

  polyline(pts: {x: number; y: number}[], t = 1, v = 1, dash?: [number, number]): void {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, t, v, dash)
  }

  /** Filled triangle. */
  triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, v = 1): void {
    const minX = Math.floor(Math.min(ax, bx, cx))
    const maxX = Math.ceil(Math.max(ax, bx, cx))
    const minY = Math.floor(Math.min(ay, by, cy))
    const maxY = Math.ceil(Math.max(ay, by, cy))
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
    if (area === 0) return
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area
        const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area
        if (w0 >= -0.01 && w1 >= -0.01 && 1 - w0 - w1 >= -0.01) this.set(x, y, v)
      }
  }

  /** Rectangle outline with rounded corners. */
  frame(x: number, y: number, w: number, h: number, radius = 6, t = 2): void {
    const r = Math.min(radius, w / 2, h / 2)
    for (let k = 0; k < t; k++) {
      this.line(x + r, y + k, x + w - 1 - r, y + k)
      this.line(x + r, y + h - 1 - k, x + w - 1 - r, y + h - 1 - k)
      this.line(x + k, y + r, x + k, y + h - 1 - r)
      this.line(x + w - 1 - k, y + r, x + w - 1 - k, y + h - 1 - r)
    }
    const corners: [number, number, number, number][] = [
      [x + r, y + r, -1, -1],
      [x + w - 1 - r, y + r, 1, -1],
      [x + r, y + h - 1 - r, -1, 1],
      [x + w - 1 - r, y + h - 1 - r, 1, 1],
    ]
    for (const [cx, cy, sx, sy] of corners)
      for (let dy = 0; dy <= r; dy++)
        for (let dx = 0; dx <= r; dx++) {
          const d = Math.hypot(dx, dy)
          if (d <= r + 0.5 && d >= r - t + 0.5) this.set(cx + sx * dx, cy + sy * dy)
        }
  }

  fill(x: number, y: number, w: number, h: number, v = 1): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.px[yy * this.w + xx] = v
  }

  /** Copy `src` into this canvas at (x, y), only inside the clip box. */
  blit(src: Canvas, x: number, y: number): void {
    for (let yy = 0; yy < src.h; yy++) for (let xx = 0; xx < src.w; xx++) if (src.px[yy * src.w + xx]) this.set(x + xx, y + yy, 1)
  }
}

// ───────────────────────── text ─────────────────────────

export type FontName = keyof typeof GLASS_FONTS

type Glyph = readonly [advance: number, xoff: number, yoff: number, w: number, h: number, start: number]

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function fromBase64(s: string): Uint8Array {
  const lookup = new Int16Array(128).fill(-1)
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i
  const clean = s.replace(/=+$/, "")
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)]
    const b = lookup[clean.charCodeAt(i + 1)]
    const c = i + 2 < clean.length ? lookup[clean.charCodeAt(i + 2)] : 0
    const d = i + 3 < clean.length ? lookup[clean.charCodeAt(i + 3)] : 0
    const n = (a << 18) | (b << 12) | (c << 6) | d
    if (o < out.length) out[o++] = (n >> 16) & 0xff
    if (o < out.length) out[o++] = (n >> 8) & 0xff
    if (o < out.length) out[o++] = n & 0xff
  }
  return out
}

export function toBase64(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "="
    out += i + 2 < bytes.length ? B64[n & 63] : "="
  }
  return out
}

const bitsCache: Partial<Record<FontName, Uint8Array>> = {}
function fontBits(f: FontName): Uint8Array {
  return (bitsCache[f] ??= fromBase64(GLASS_FONTS[f].bits))
}

function glyphOf(f: FontName, ch: string): Glyph | null {
  const g = (GLASS_FONTS[f].glyphs as Record<string, Glyph>)[ch]
  if (g) return g
  // what the font has no glyph for: й → и, ё → е like Mentra does for the G1 text font
  const fallback: Record<string, string> = {"→": ">", "←": "<", "↑": "^"}
  const base = ch.normalize("NFD")[0]
  const alt = fallback[ch] ?? (base !== ch ? base : "?")
  return (GLASS_FONTS[f].glyphs as Record<string, Glyph>)[alt] ?? null
}

export function lineHeight(f: FontName): number {
  return GLASS_FONTS[f].lineHeight
}

export function measure(text: string, f: FontName): number {
  let w = 0
  for (const ch of text) w += glyphOf(f, ch)?.[0] ?? 0
  return w
}

/** Cut to `maxW` px with «…». */
export function fit(text: string, f: FontName, maxW: number): string {
  if (measure(text, f) <= maxW) return text
  const ell = "…"
  const chars = [...text]
  while (chars.length && measure(chars.join("").trimEnd() + ell, f) > maxW) chars.pop()
  return chars.length ? chars.join("").trimEnd() + ell : ""
}

/** Draws text with its line box top-left at (x, y); returns the width drawn. */
export function drawText(c: Canvas, text: string, x: number, y: number, f: FontName, v = 1): number {
  const bits = fontBits(f)
  let pen = x
  for (const ch of text) {
    const g = glyphOf(f, ch)
    if (!g) continue
    const [advance, xoff, yoff, w, h, start] = g
    const rowBytes = (w + 7) >> 3
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) if (bits[start + yy * rowBytes + (xx >> 3)] & (0x80 >> (xx & 7))) c.set(pen + xoff + xx, y + yoff + yy, v)
    pen += advance
  }
  return pen - x
}

/** Top of the ink of a font's capital letters, from the line box top (to align text tightly). */
export function capTop(f: FontName): number {
  return (glyphOf(f, "H") ?? glyphOf(f, "0"))?.[2] ?? 0
}

// ───────────────────────── the G1 bitmap ─────────────────────────

/**
 * The 576×135 one-bit BMP Mentra sends to the G1: bottom-up rows, palette black/white, background
 * white (bit 1) and the drawing black (bit 0) — the phone inverts the bits for the glasses.
 */
export function encodeG1Bmp(c: Canvas): string {
  const W = G1_BMP_W
  const H = G1_BMP_H
  const rowSize = Math.ceil(W / 32) * 4 // 72
  const pixelBytes = rowSize * H
  const header = 62
  const buf = new Uint8Array(header + pixelBytes)
  const u16 = (o: number, v: number) => {
    buf[o] = v & 0xff
    buf[o + 1] = (v >> 8) & 0xff
  }
  const u32 = (o: number, v: number) => {
    u16(o, v & 0xffff)
    u16(o + 2, (v >>> 16) & 0xffff)
  }
  buf[0] = 0x42
  buf[1] = 0x4d
  u32(2, buf.length)
  u32(10, header)
  u32(14, 40)
  u32(18, W)
  u32(22, H) // positive: bottom-up
  u16(26, 1)
  u16(28, 1)
  u32(30, 0)
  u32(34, pixelBytes)
  u32(38, 2835)
  u32(42, 2835)
  u32(46, 2)
  u32(50, 2)
  // palette: index 0 black, index 1 white
  buf[58] = 0xff
  buf[59] = 0xff
  buf[60] = 0xff
  for (let y = 0; y < H; y++) {
    const row = header + (H - 1 - y) * rowSize
    for (let x = 0; x < W; x++) {
      const lit = x < c.w && y < c.h && c.px[y * c.w + x] === 1
      if (!lit) buf[row + (x >> 3)] |= 0x80 >> (x & 7)
    }
    // padding bytes (none for 576) stay as background
  }
  return toBase64(buf)
}

/** A full-size canvas for the G1 bitmap. */
export function g1Canvas(): Canvas {
  return new Canvas(G1_BMP_W, G1_BMP_H)
}

/**
 * Test picture for «Проверить карту»: a frame around the area Mentra says is visible, corner
 * marks of the full bitmap, and a label — to see on the glasses what is shown and what is cut.
 */
export function testPattern(label = "EVA-IA · карта"): string {
  const c = g1Canvas()
  const s = G1_SAFE
  c.frame(s.x, s.y, s.w, s.h, 8, 2)
  for (const [x, y] of [
    [0, 0],
    [G1_BMP_W - 12, 0],
    [0, G1_BMP_H - 12],
    [G1_BMP_W - 12, G1_BMP_H - 12],
  ])
    c.fill(x, y, 12, 12)
  const w = measure(label, "text")
  drawText(c, label, s.x + (s.w - w) / 2, s.y + (s.h - lineHeight("text")) / 2, "text")
  return encodeG1Bmp(c)
}
