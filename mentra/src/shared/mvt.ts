/**
 * Mapbox Vector Tile (MVT 2.1) decoder and Web Mercator helpers. Map data comes as OpenMapTiles
 * vector tiles (OpenFreeMap, built from OpenStreetMap): layers like transportation, water,
 * building, park, transportation_name. Used by the background (the glasses map) and by the phone
 * page (the full map), so it depends on nothing.
 */
import {maybeInflate} from "./inflate"

export type GeomType = 1 | 2 | 3 // point, line, polygon

export interface TileFeature {
  type: GeomType
  props: Record<string, string | number | boolean>
  /** Rings / lines / points: flat [x0, y0, x1, y1, …] in tile units (0…extent). */
  geom: number[][]
}

export interface TileLayer {
  name: string
  extent: number
  features: TileFeature[]
}

export type DecodedTile = Record<string, TileLayer>

// ───────────────────────── protobuf ─────────────────────────

class Pbf {
  pos: number
  constructor(
    readonly buf: Uint8Array,
    start = 0,
    readonly end = buf.length,
  ) {
    this.pos = start
  }

  varint(): number {
    let result = 0
    let shift = 0
    for (;;) {
      if (this.pos >= this.end) throw new Error("mvt: truncated varint")
      const b = this.buf[this.pos++]
      if (shift < 28) result |= (b & 0x7f) << shift
      else result += (b & 0x7f) * 2 ** shift
      if (b < 0x80) break
      shift += 7
    }
    return result
  }

  svarint(): number {
    const n = this.varint()
    return n % 2 === 1 ? (n + 1) / -2 : n / 2
  }

  bytesEnd(): number {
    const len = this.varint()
    return this.pos + len
  }

  skip(wire: number): void {
    if (wire === 0) this.varint()
    else if (wire === 1) this.pos += 8
    else if (wire === 2) this.pos = this.bytesEnd()
    else if (wire === 5) this.pos += 4
    else throw new Error(`mvt: unsupported wire type ${wire}`)
  }

  string(): string {
    const end = this.bytesEnd()
    const s = utf8(this.buf, this.pos, end)
    this.pos = end
    return s
  }

  float(): number {
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4).getFloat32(0, true)
    this.pos += 4
    return v
  }

  double(): number {
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).getFloat64(0, true)
    this.pos += 8
    return v
  }
}

function utf8(b: Uint8Array, start: number, end: number): string {
  let s = ""
  let i = start
  while (i < end) {
    const c = b[i++]
    if (c < 0x80) s += String.fromCharCode(c)
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f))
    else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f))
    else {
      const cp = (((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f)) - 0x10000
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
    }
  }
  return s
}

function readValue(p: Pbf, end: number): string | number | boolean {
  let v: string | number | boolean = ""
  while (p.pos < end) {
    const tag = p.varint()
    const field = tag >> 3
    const wire = tag & 7
    if (field === 1) v = p.string()
    else if (field === 2) v = p.float()
    else if (field === 3) v = p.double()
    else if (field === 4 || field === 5) v = p.varint() // int64 / uint64 (small in practice)
    else if (field === 6) v = p.svarint()
    else if (field === 7) v = p.varint() !== 0
    else p.skip(wire)
  }
  return v
}

/** Geometry commands → rings/lines/points. */
function decodeGeom(p: Pbf, end: number, type: GeomType): number[][] {
  const out: number[][] = []
  let x = 0
  let y = 0
  let cur: number[] | null = null
  while (p.pos < end) {
    const cmdInt = p.varint()
    const cmd = cmdInt & 7
    let count = cmdInt >> 3
    if (cmd === 1) {
      // MoveTo
      while (count-- > 0) {
        x += p.svarint()
        y += p.svarint()
        if (type === 1) {
          if (!cur) out.push((cur = []))
          cur.push(x, y)
        } else {
          cur = [x, y]
          out.push(cur)
        }
      }
    } else if (cmd === 2) {
      // LineTo
      while (count-- > 0) {
        x += p.svarint()
        y += p.svarint()
        cur?.push(x, y)
      }
    } else if (cmd === 7) {
      // ClosePath
      if (cur && cur.length >= 2) cur.push(cur[0], cur[1])
    } else throw new Error(`mvt: bad command ${cmd}`)
  }
  return out
}

export interface DecodeOptions {
  /** Only these layers (others are skipped without decoding). */
  layers?: ReadonlySet<string>
  /** Keep only these properties (default: all). */
  props?: ReadonlySet<string>
}

/** A vector tile (gzip-compressed or not) → its layers. */
export function decodeTile(bytes: Uint8Array, opts: DecodeOptions = {}): DecodedTile {
  const buf = maybeInflate(bytes)
  const p = new Pbf(buf)
  const out: DecodedTile = {}
  while (p.pos < p.end) {
    const tag = p.varint()
    if (tag >> 3 !== 3 || (tag & 7) !== 2) {
      p.skip(tag & 7)
      continue
    }
    const end = p.bytesEnd()
    const layer = decodeLayer(new Pbf(buf, p.pos, end), opts)
    if (layer) out[layer.name] = layer
    p.pos = end
  }
  return out
}

function decodeLayer(p: Pbf, opts: DecodeOptions): TileLayer | null {
  let name = ""
  let extent = 4096
  const keys: string[] = []
  const values: (string | number | boolean)[] = []
  const featureSpans: [number, number][] = []
  while (p.pos < p.end) {
    const tag = p.varint()
    const field = tag >> 3
    const wire = tag & 7
    if (field === 1) {
      name = p.string()
      if (opts.layers && !opts.layers.has(name)) return null
    } else if (field === 2) {
      const end = p.bytesEnd()
      featureSpans.push([p.pos, end])
      p.pos = end
    } else if (field === 3) keys.push(p.string())
    else if (field === 4) {
      const end = p.bytesEnd()
      values.push(readValue(p, end))
      p.pos = end
    } else if (field === 5) extent = p.varint()
    else p.skip(wire)
  }
  if (opts.layers && !opts.layers.has(name)) return null
  const features: TileFeature[] = []
  for (const [start, end] of featureSpans) {
    const f = new Pbf(p.buf, start, end)
    let type: GeomType = 1
    let tagsAt: [number, number] | null = null
    let geomAt: [number, number] | null = null
    while (f.pos < f.end) {
      const tag = f.varint()
      const field = tag >> 3
      if (field === 2 || field === 4) {
        const e = f.bytesEnd()
        if (field === 2) tagsAt = [f.pos, e]
        else geomAt = [f.pos, e]
        f.pos = e
      } else if (field === 3) type = f.varint() as GeomType
      else f.skip(tag & 7)
    }
    if (!geomAt) continue
    const props: Record<string, string | number | boolean> = {}
    if (tagsAt) {
      const t = new Pbf(p.buf, tagsAt[0], tagsAt[1])
      while (t.pos < t.end) {
        const k = keys[t.varint()]
        const v = values[t.varint()]
        if (k !== undefined && (!opts.props || opts.props.has(k))) props[k] = v
      }
    }
    const g = new Pbf(p.buf, geomAt[0], geomAt[1])
    features.push({type, props, geom: decodeGeom(g, geomAt[1], type)})
  }
  return {name, extent, features}
}

// ───────────────────────── Web Mercator ─────────────────────────

export const TILE_ZOOM = 14
const EARTH_CIRCUMFERENCE = 40_075_016.686

/** lat/lng → world coordinates in [0, 1) (x east, y south). */
export function toWorld(lat: number, lng: number): {x: number; y: number} {
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180)
  return {x: (lng + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)}
}

export function fromWorld(x: number, y: number): {lat: number; lng: number} {
  const n = Math.PI - 2 * Math.PI * y
  return {lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: x * 360 - 180}
}

/** Meters per world unit at a latitude (world = 1 across). */
export function metersPerWorld(lat: number): number {
  return EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)
}

/** Tile x/y containing a point at zoom z. */
export function tileOf(lat: number, lng: number, z = TILE_ZOOM): {x: number; y: number} {
  const w = toWorld(lat, lng)
  const n = 2 ** z
  return {x: Math.min(n - 1, Math.floor(w.x * n)), y: Math.min(n - 1, Math.floor(w.y * n))}
}

/** Tiles at zoom z covering a circle of `radiusM` meters around a point. */
export function tilesAround(lat: number, lng: number, radiusM: number, z = TILE_ZOOM): {x: number; y: number}[] {
  const w = toWorld(lat, lng)
  const r = radiusM / metersPerWorld(lat)
  const n = 2 ** z
  const x0 = Math.max(0, Math.floor((w.x - r) * n))
  const x1 = Math.min(n - 1, Math.floor((w.x + r) * n))
  const y0 = Math.max(0, Math.floor((w.y - r) * n))
  const y1 = Math.min(n - 1, Math.floor((w.y + r) * n))
  const out: {x: number; y: number}[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({x, y})
  return out
}
