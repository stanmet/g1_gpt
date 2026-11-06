/**
 * DEFLATE decoder (RFC 1951) with gzip (RFC 1952) and zlib (RFC 1950) wrappers — map tiles often
 * arrive gzip-compressed, and neither the Mentra background engine nor the app has a library.
 * Written for clarity over speed; a 300 KB tile inflates in a few milliseconds.
 */

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

/** Canonical Huffman code as (count per length, symbols sorted by code). */
interface Huff {
  counts: Uint16Array
  symbols: Uint16Array
}

function buildHuff(lengths: ArrayLike<number>, n: number): Huff {
  const counts = new Uint16Array(16)
  for (let i = 0; i < n; i++) counts[lengths[i]]++
  counts[0] = 0
  const offs = new Uint16Array(16)
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1]
  const symbols = new Uint16Array(n)
  for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i
  return {counts, symbols}
}

let FIXED_LIT: Huff | null = null
let FIXED_DIST: Huff | null = null
function fixed(): [Huff, Huff] {
  if (!FIXED_LIT || !FIXED_DIST) {
    const l = new Uint8Array(288)
    for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8
    FIXED_LIT = buildHuff(l, 288)
    FIXED_DIST = buildHuff(new Uint8Array(30).fill(5), 30)
  }
  return [FIXED_LIT, FIXED_DIST]
}

class Bits {
  pos = 0
  bitBuf = 0
  bitCnt = 0
  constructor(readonly src: Uint8Array) {}

  bit(): number {
    if (this.bitCnt === 0) {
      if (this.pos >= this.src.length) throw new Error("inflate: unexpected end of data")
      this.bitBuf = this.src[this.pos++]
      this.bitCnt = 8
    }
    const b = this.bitBuf & 1
    this.bitBuf >>= 1
    this.bitCnt--
    return b
  }

  bits(n: number): number {
    let v = 0
    for (let i = 0; i < n; i++) v |= this.bit() << i
    return v
  }

  decode(h: Huff): number {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len < 16; len++) {
      code |= this.bit()
      const count = h.counts[len]
      if (code - first < count) return h.symbols[index + (code - first)]
      index += count
      first = (first + count) << 1
      code <<= 1
    }
    throw new Error("inflate: bad Huffman code")
  }

  alignByte(): void {
    this.bitCnt = 0
  }
}

class Out {
  buf: Uint8Array
  len = 0
  constructor(size: number) {
    this.buf = new Uint8Array(Math.max(1024, size))
  }
  ensure(n: number): void {
    if (this.len + n <= this.buf.length) return
    let cap = this.buf.length * 2
    while (cap < this.len + n) cap *= 2
    const b = new Uint8Array(cap)
    b.set(this.buf.subarray(0, this.len))
    this.buf = b
  }
  push(v: number): void {
    this.ensure(1)
    this.buf[this.len++] = v
  }
  copy(dist: number, n: number): void {
    if (dist > this.len) throw new Error("inflate: bad distance")
    this.ensure(n)
    for (let i = 0; i < n; i++) this.buf[this.len] = this.buf[this.len++ - dist]
  }
}

/** Raw DEFLATE stream → bytes. */
export function inflateRaw(src: Uint8Array, sizeHint = src.length * 3): Uint8Array {
  const r = new Bits(src)
  const out = new Out(sizeHint)
  for (;;) {
    const last = r.bit()
    const type = r.bits(2)
    if (type === 0) {
      r.alignByte()
      if (r.pos + 4 > src.length) throw new Error("inflate: truncated stored block")
      const len = src[r.pos] | (src[r.pos + 1] << 8)
      r.pos += 4
      if (r.pos + len > src.length) throw new Error("inflate: truncated stored block")
      out.ensure(len)
      out.buf.set(src.subarray(r.pos, r.pos + len), out.len)
      out.len += len
      r.pos += len
    } else if (type === 1 || type === 2) {
      let lit: Huff
      let dist: Huff
      if (type === 1) [lit, dist] = fixed()
      else {
        const hlit = r.bits(5) + 257
        const hdist = r.bits(5) + 1
        const hclen = r.bits(4) + 4
        const cl = new Uint8Array(19)
        for (let i = 0; i < hclen; i++) cl[CL_ORDER[i]] = r.bits(3)
        const clh = buildHuff(cl, 19)
        const lens = new Uint8Array(hlit + hdist)
        for (let i = 0; i < hlit + hdist; ) {
          const sym = r.decode(clh)
          if (sym < 16) lens[i++] = sym
          else {
            let rep = 0
            let val = 0
            if (sym === 16) {
              if (i === 0) throw new Error("inflate: repeat with no previous length")
              val = lens[i - 1]
              rep = 3 + r.bits(2)
            } else if (sym === 17) rep = 3 + r.bits(3)
            else rep = 11 + r.bits(7)
            while (rep-- > 0) lens[i++] = val
          }
        }
        lit = buildHuff(lens.subarray(0, hlit), hlit)
        dist = buildHuff(lens.subarray(hlit), hdist)
      }
      for (;;) {
        const sym = r.decode(lit)
        if (sym < 256) out.push(sym)
        else if (sym === 256) break
        else {
          const li = sym - 257
          if (li >= 29) throw new Error("inflate: bad length symbol")
          const len = LEN_BASE[li] + r.bits(LEN_EXTRA[li])
          const di = r.decode(dist)
          if (di >= 30) throw new Error("inflate: bad distance symbol")
          out.copy(DIST_BASE[di] + r.bits(DIST_EXTRA[di]), len)
        }
      }
    } else throw new Error("inflate: bad block type")
    if (last) break
  }
  return out.buf.subarray(0, out.len)
}

/** gzip, zlib or raw-deflate bytes → bytes; anything else is returned as is. */
export function maybeInflate(src: Uint8Array): Uint8Array {
  if (src.length > 18 && src[0] === 0x1f && src[1] === 0x8b && src[2] === 8) {
    const flg = src[3]
    let p = 10
    if (flg & 4) p += 2 + (src[p] | (src[p + 1] << 8))
    if (flg & 8) while (p < src.length && src[p++] !== 0);
    if (flg & 16) while (p < src.length && src[p++] !== 0);
    if (flg & 2) p += 2
    const isize = src[src.length - 4] | (src[src.length - 3] << 8) | (src[src.length - 2] << 16) | (src[src.length - 1] << 24)
    return inflateRaw(src.subarray(p, src.length - 8), isize >>> 0)
  }
  if (src.length > 2 && (src[0] & 0x0f) === 8 && ((src[0] << 8) | src[1]) % 31 === 0) return inflateRaw(src.subarray(2, src.length - 4))
  return src
}
