/**
 * Map tiles on the phone: OpenStreetMap vector tiles (OpenFreeMap, OpenMapTiles schema), kept in
 * Mentra's per-app file storage (`session.blob`, up to 1 GB). Three ways in:
 *   - an offline area the user downloads ahead («Вокруг меня, 5 км»);
 *   - tiles along a route, saved when the route starts;
 *   - any tile the map needs that is not there yet (when online).
 * The glasses map takes simplified features (roads, water, parks, buildings) from here; the phone
 * map takes raw tiles and draws them itself.
 */
import {decodeTile, metersPerWorld, tileOf, tilesAround, toWorld, TILE_ZOOM, type TileFeature} from "../shared/mvt"
import type {LatLng} from "./navmap"

/** What the host offers (`session.blob`). */
export interface BlobApi {
  setFromUrl(key: string, url: string, opts?: {mimeType?: string; meta?: Record<string, string | number | boolean>}): Promise<{bytes: number}>
  bytes(key: string): Promise<Uint8Array | null>
  list(): Promise<{key: string; bytes: number}[]>
  delete(key: string): Promise<void>
}

export interface TileStoreDeps {
  blob: BlobApi | null
  fetchJson(url: string): Promise<any>
  log(kind: "nav" | "info" | "error", msg: string): void
  now(): number
  onChange(): void
  loadAreas(): OfflineArea[]
  saveAreas(a: OfflineArea[]): void
}

export interface OfflineArea {
  id: string
  name: string
  lat: number
  lng: number
  radiusKm: number
  tiles: number
  bytes: number
  at: number
}

export interface DownloadState {
  areaId: string
  name: string
  radiusKm: number
  done: number
  total: number
  failed: number
  bytes: number
}

/** What the glasses map draws. */
export type FeatureKind = "major" | "road" | "minor" | "path" | "rail" | "water" | "waterway" | "park" | "building"

export interface MapFeature {
  k: FeatureKind
  poly: boolean
  /** Lines or rings, flat [x0, y0, …] in world coordinates (Web Mercator, 0…1). */
  p: number[][]
  /** Bounding box in world coordinates. */
  b: [number, number, number, number]
}

export const TILEJSON_URL = "https://tiles.openfreemap.org/planet"
/** Used when the TileJSON is not reachable; OpenFreeMap serves «latest» as the newest version. */
export const FALLBACK_TEMPLATE = "https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf"
/** Overview tiles for the phone map when zoomed out. */
export const OVERVIEW_ZOOM = 12
/** Average size of a z14 tile, for the estimate shown before downloading. */
export const AVG_TILE_KB = 160

const GLASSES_LAYERS = new Set(["transportation", "water", "waterway", "park", "landcover"])
const DECODED_MAX = 16
const PARALLEL = 3

const key = (z: number, x: number, y: number) => `map/${z}/${x}/${y}`

/** OpenMapTiles feature → what the glasses draw (null = not drawn). */
export function classify(layer: string, f: TileFeature): FeatureKind | null {
  const cls = String(f.props.class ?? "")
  switch (layer) {
    case "transportation": {
      if (f.props.brunnel === "tunnel" || cls.endsWith("_construction")) return null
      if (cls === "motorway" || cls === "trunk" || cls === "primary") return "major"
      if (cls === "secondary" || cls === "tertiary") return "road"
      if (cls === "minor" || cls === "service" || cls === "track" || cls === "busway" || cls === "raceway") return "minor"
      if (cls === "path") return f.props.subclass === "platform" ? null : "path"
      if (cls === "rail" || cls === "transit") return "rail"
      return null
    }
    case "water":
      return cls === "swimming_pool" ? null : "water"
    case "waterway":
      return cls === "river" || cls === "canal" || cls === "stream" ? "waterway" : null
    case "park":
      return "park"
    case "landcover":
      return cls === "wood" || cls === "grass" ? "park" : null
    case "building":
      return "building"
  }
  return null
}

/** Ring area in tile units² (sign ignored). */
function ringArea(r: number[]): number {
  let a = 0
  for (let i = 0; i + 3 < r.length; i += 2) a += r[i] * r[i + 3] - r[i + 2] * r[i + 1]
  return Math.abs(a / 2)
}

/** Decoded tile → features in world coordinates. */
export function tileFeatures(bytes: Uint8Array, z: number, x: number, y: number): MapFeature[] {
  const tile = decodeTile(bytes, {layers: GLASSES_LAYERS, props: new Set(["class", "subclass", "brunnel"])})
  const n = 2 ** z
  const out: MapFeature[] = []
  for (const [name, layer] of Object.entries(tile)) {
    const s = 1 / (layer.extent * n)
    const ox = x / n
    const oy = y / n
    for (const f of layer.features) {
      const k = classify(name, f)
      if (!k) continue
      const poly = f.type === 3
      // small green patches only add noise on the glasses
      if (k === "park" && poly && f.geom.reduce((a, r) => a + ringArea(r), 0) < 6000) continue
      let bx0 = Infinity
      let by0 = Infinity
      let bx1 = -Infinity
      let by1 = -Infinity
      const p = f.geom.map((r) => {
        const w = new Array<number>(r.length)
        for (let i = 0; i < r.length; i += 2) {
          const wx = ox + r[i] * s
          const wy = oy + r[i + 1] * s
          w[i] = wx
          w[i + 1] = wy
          if (wx < bx0) bx0 = wx
          if (wx > bx1) bx1 = wx
          if (wy < by0) by0 = wy
          if (wy > by1) by1 = wy
        }
        return w
      })
      if (p.length && Number.isFinite(bx0)) out.push({k, poly, p, b: [bx0, by0, bx1, by1]})
    }
  }
  return out
}

/** Short name for an area from the place names in its centre tile («Dublin», «Temple Bar»). */
export function placeName(bytes: Uint8Array, z: number, x: number, y: number, lat: number, lng: number): string {
  const tile = decodeTile(bytes, {layers: new Set(["place"]), props: new Set(["class", "name", "name:latin"])})
  const layer = tile.place
  if (!layer) return ""
  const rank: Record<string, number> = {city: 0, town: 1, village: 2, suburb: 3, quarter: 4, neighbourhood: 5, hamlet: 6}
  const w = toWorld(lat, lng)
  const n = 2 ** z
  let best: {name: string; score: number} | null = null
  for (const f of layer.features) {
    const name = String(f.props.name ?? f.props["name:latin"] ?? "").trim()
    const r = rank[String(f.props.class ?? "")]
    if (!name || r === undefined || !f.geom[0]) continue
    const fx = (x + f.geom[0][0] / layer.extent) / n
    const fy = (y + f.geom[0][1] / layer.extent) / n
    const d = Math.hypot(fx - w.x, fy - w.y) * metersPerWorld(lat)
    const score = r * 1500 + d
    if (!best || score < best.score) best = {name, score}
  }
  return best?.name ?? ""
}

export class TileStore {
  /** Stored tiles: key → bytes. */
  private index = new Map<string, number>()
  private indexReady: Promise<void> | null = null
  private template: string | null = null
  private templateAt = 0
  private inflight = new Map<string, Promise<boolean>>()
  private decoded = new Map<string, MapFeature[]>()
  private failedAt = new Map<string, number>()
  download: DownloadState | null = null
  private cancelled = false
  areas: OfflineArea[]

  constructor(private readonly deps: TileStoreDeps) {
    this.areas = deps.loadAreas()
  }

  get available(): boolean {
    return Boolean(this.deps.blob)
  }

  stats(): {tiles: number; bytes: number} {
    let bytes = 0
    for (const b of this.index.values()) bytes += b
    return {tiles: this.index.size, bytes}
  }

  /** Reads which tiles are already on the phone (once). */
  ready(): Promise<void> {
    if (!this.indexReady) {
      this.indexReady = (async () => {
        if (!this.deps.blob) return
        try {
          for (const b of await this.deps.blob.list()) if (b.key.startsWith("map/")) this.index.set(b.key, b.bytes)
        } catch (e) {
          this.deps.log("info", `Офлайн-карты: список не прочитан (${String((e as Error)?.message ?? e)})`)
        }
        this.deps.onChange()
      })()
    }
    return this.indexReady
  }

  has(z: number, x: number, y: number): boolean {
    return this.index.has(key(z, x, y))
  }

  private async tileUrl(z: number, x: number, y: number): Promise<string> {
    if (!this.template || this.deps.now() - this.templateAt > 6 * 3600_000) {
      try {
        const tj = await this.deps.fetchJson(TILEJSON_URL)
        const t = Array.isArray(tj?.tiles) ? String(tj.tiles[0] ?? "") : ""
        if (/\{z\}.*\{x\}.*\{y\}/.test(t)) {
          this.template = t
          this.templateAt = this.deps.now()
        }
      } catch {
        // offline or blocked: try the «latest» address
      }
    }
    return (this.template ?? FALLBACK_TEMPLATE).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y))
  }

  /** Makes sure a tile is on the phone; false if it could not be downloaded. */
  ensure(z: number, x: number, y: number): Promise<boolean> {
    const k = key(z, x, y)
    if (this.index.has(k)) return Promise.resolve(true)
    const blob = this.deps.blob
    if (!blob) return Promise.resolve(false)
    // a recent failure (offline): do not hammer
    const failed = this.failedAt.get(k)
    if (failed && this.deps.now() - failed < 60_000) return Promise.resolve(false)
    let p = this.inflight.get(k)
    if (!p) {
      p = (async () => {
        try {
          await this.ready()
          if (this.index.has(k)) return true
          const meta = await blob.setFromUrl(k, await this.tileUrl(z, x, y), {mimeType: "application/x-protobuf"})
          this.index.set(k, Number(meta?.bytes) || 0)
          this.failedAt.delete(k)
          return true
        } catch {
          this.failedAt.set(k, this.deps.now())
          return false
        } finally {
          this.inflight.delete(k)
        }
      })()
      this.inflight.set(k, p)
    }
    return p
  }

  /** The tile's bytes (downloaded first when missing and `fetch`); null when not available. */
  async raw(z: number, x: number, y: number, fetch = true): Promise<Uint8Array | null> {
    await this.ready()
    if (!this.has(z, x, y) && !(fetch && (await this.ensure(z, x, y)))) return null
    try {
      return (await this.deps.blob?.bytes(key(z, x, y))) ?? null
    } catch {
      return null
    }
  }

  /** Features for the glasses map around a point. */
  async features(center: LatLng, radiusM: number): Promise<MapFeature[]> {
    await this.ready()
    const tiles = tilesAround(center.lat, center.lng, radiusM)
    const w = toWorld(center.lat, center.lng)
    const r = radiusM / metersPerWorld(center.lat)
    const box: [number, number, number, number] = [w.x - r, w.y - r, w.x + r, w.y + r]
    const out: MapFeature[] = []
    let missing = 0
    for (const t of tiles) {
      const k = key(TILE_ZOOM, t.x, t.y)
      let feats = this.decoded.get(k)
      if (!feats) {
        const bytes = await this.raw(TILE_ZOOM, t.x, t.y)
        if (!bytes) {
          missing++
          continue
        }
        try {
          feats = tileFeatures(bytes, TILE_ZOOM, t.x, t.y)
        } catch (e) {
          this.deps.log("error", `Карта: участок ${t.x}/${t.y} не прочитан (${String((e as Error)?.message ?? e)})`)
          missing++
          continue
        }
        this.decoded.set(k, feats)
        if (this.decoded.size > DECODED_MAX) this.decoded.delete(this.decoded.keys().next().value as string)
      }
      for (const f of feats) if (f.b[2] >= box[0] && f.b[0] <= box[2] && f.b[3] >= box[1] && f.b[1] <= box[3]) out.push(f)
    }
    if (missing === tiles.length) throw new Error("нет карты этого места (нет интернета и не скачана заранее)")
    return out
  }

  /** Saves the tiles along a route (a corridor of ~300 m), quietly, a few at a time. */
  async prefetchRoute(points: LatLng[]): Promise<number> {
    if (!this.deps.blob || points.length < 2) return 0
    await this.ready()
    const want = new Set<string>()
    const add = (p: LatLng) => {
      for (const t of tilesAround(p.lat, p.lng, 300)) want.add(`${t.x}/${t.y}`)
    }
    add(points[0])
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const steps = Math.ceil((Math.hypot(b.lat - a.lat, b.lng - a.lng) * 111_000) / 400)
      for (let s = 1; s <= steps; s++) add({lat: a.lat + ((b.lat - a.lat) * s) / steps, lng: a.lng + ((b.lng - a.lng) * s) / steps})
    }
    const list = [...want].map((s) => s.split("/").map(Number)).filter(([x, y]) => !this.has(TILE_ZOOM, x, y))
    let got = 0
    for (let i = 0; i < list.length; i += PARALLEL) {
      const r = await Promise.all(list.slice(i, i + PARALLEL).map(([x, y]) => this.ensure(TILE_ZOOM, x, y)))
      got += r.filter(Boolean).length
    }
    if (got) {
      this.deps.log("nav", `Карта маршрута сохранена на телефоне: ${got} участк.`)
      this.deps.onChange()
    }
    return got
  }

  /** Tiles for an offline area: detailed (z14) and overview (z12). */
  areaTiles(lat: number, lng: number, radiusKm: number): {z: number; x: number; y: number}[] {
    const m = radiusKm * 1000
    return [
      ...tilesAround(lat, lng, m, OVERVIEW_ZOOM).map((t) => ({z: OVERVIEW_ZOOM, ...t})),
      ...tilesAround(lat, lng, m).map((t) => ({z: TILE_ZOOM, ...t})),
    ]
  }

  /** Estimated download, MB. */
  estimateMb(lat: number, lng: number, radiusKm: number): number {
    const n = this.areaTiles(lat, lng, radiusKm).filter((t) => !this.has(t.z, t.x, t.y)).length
    return Math.max(1, Math.round((n * AVG_TILE_KB) / 1024))
  }

  /** Downloads an area around a point; progress in `download`. */
  async downloadArea(lat: number, lng: number, radiusKm: number): Promise<OfflineArea | null> {
    if (!this.deps.blob || this.download) return null
    const tiles = this.areaTiles(lat, lng, radiusKm)
    const id = `a${this.deps.now().toString(36)}`
    this.cancelled = false
    // shown at once, before the list of stored tiles is read
    this.download = {areaId: id, name: "", radiusKm, done: 0, total: tiles.length, failed: 0, bytes: 0}
    await this.ready()
    this.deps.log("nav", `Офлайн-карта: скачиваю ${tiles.length} участков вокруг (${radiusKm} км)`)
    this.deps.onChange()
    // the centre first: it names the area
    const c = tileOf(lat, lng)
    tiles.sort((a, b) => (a.z === TILE_ZOOM && a.x === c.x && a.y === c.y ? -1 : b.z === TILE_ZOOM && b.x === c.x && b.y === c.y ? 1 : 0))
    let lastPush = 0
    for (let i = 0; i < tiles.length && !this.cancelled; i += PARALLEL) {
      const batch = tiles.slice(i, i + PARALLEL)
      const ok = await Promise.all(batch.map((t) => this.ensure(t.z, t.x, t.y)))
      const d = this.download
      if (!d) break
      d.done += batch.length
      d.failed += ok.filter((v) => !v).length
      d.bytes = batch.reduce((a, t) => a + (this.index.get(key(t.z, t.x, t.y)) ?? 0), d.bytes)
      // stop early when nothing downloads (offline)
      if (d.failed >= 9 && d.failed === d.done) break
      if (this.deps.now() - lastPush > 700) {
        lastPush = this.deps.now()
        this.deps.onChange()
      }
    }
    const d = this.download!
    this.download = null
    if (this.cancelled || d.failed === d.done) {
      this.deps.log(d.failed === d.done ? "error" : "nav", d.failed === d.done ? "Офлайн-карта не скачалась: нет связи с сервером карт" : "Скачивание карты остановлено")
      this.deps.onChange()
      return null
    }
    let name = ""
    try {
      const bytes = await this.raw(TILE_ZOOM, c.x, c.y, false)
      if (bytes) name = placeName(bytes, TILE_ZOOM, c.x, c.y, lat, lng)
    } catch {
      // unnamed
    }
    const area: OfflineArea = {
      id,
      name: name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      lat,
      lng,
      radiusKm,
      tiles: d.done - d.failed,
      bytes: tiles.reduce((a, t) => a + (this.index.get(key(t.z, t.x, t.y)) ?? 0), 0),
      at: this.deps.now(),
    }
    this.areas = [area, ...this.areas]
    this.deps.saveAreas(this.areas)
    this.deps.log("nav", `Офлайн-карта «${area.name}» скачана: ${area.tiles} участков, ${(area.bytes / 1048576).toFixed(1)} МБ${d.failed ? `, не скачалось ${d.failed}` : ""}`)
    this.deps.onChange()
    return area
  }

  cancelDownload(): void {
    this.cancelled = true
  }

  /** Deletes an area's tiles (those not inside another saved area). */
  async deleteArea(id: string): Promise<void> {
    const area = this.areas.find((a) => a.id === id)
    if (!area || !this.deps.blob) return
    const keep = new Set<string>()
    for (const o of this.areas) if (o.id !== id) for (const t of this.areaTiles(o.lat, o.lng, o.radiusKm)) keep.add(key(t.z, t.x, t.y))
    for (const t of this.areaTiles(area.lat, area.lng, area.radiusKm)) {
      const k = key(t.z, t.x, t.y)
      if (keep.has(k) || !this.index.has(k)) continue
      try {
        await this.deps.blob.delete(k)
        this.index.delete(k)
        this.decoded.delete(k)
      } catch {
        // stays
      }
    }
    this.areas = this.areas.filter((a) => a.id !== id)
    this.deps.saveAreas(this.areas)
    this.deps.log("nav", `Офлайн-карта «${area.name}» удалена`)
    this.deps.onChange()
  }

  /** Deletes every saved map tile (offline areas and the cache along routes). */
  async deleteAll(): Promise<void> {
    if (!this.deps.blob) return
    await this.ready()
    for (const k of [...this.index.keys()]) {
      try {
        await this.deps.blob.delete(k)
        this.index.delete(k)
      } catch {
        // stays
      }
    }
    this.decoded.clear()
    this.areas = []
    this.deps.saveAreas(this.areas)
    this.deps.log("nav", "Все карты удалены с телефона")
    this.deps.onChange()
  }
}
