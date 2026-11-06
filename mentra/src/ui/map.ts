/**
 * The map on the phone: OpenStreetMap vector tiles (OpenMapTiles schema) drawn on a canvas —
 * land, parks, water, buildings, roads by class, street and place names — with the route, where
 * you are and the destination on top. Drag to move, pinch or double-tap to zoom, «◎» follows you.
 * Tiles come from the background (stored on the phone, or downloaded on the way).
 */
import {decodeTile, fromWorld, toWorld, type TileFeature} from "../shared/mvt"

export interface MapOverlay {
  me: [number, number] | null
  heading: number | null
  route: [number, number][]
  dest: [number, number] | null
}

type Fetch = (z: number, x: number, y: number) => Promise<Uint8Array | null>

interface Style {
  bg: string
  park: string
  wood: string
  water: string
  building: string
  buildingEdge: string
  road: Record<string, [fill: string, casing: string, width: number]>
  path: string
  rail: string
  label: string
  halo: string
  route: string
  routeEdge: string
  me: string
  dest: string
}

const LIGHT: Style = {
  bg: "#f2efe9",
  park: "#d3ecbd",
  wood: "#bfdea7",
  water: "#a9d3e4",
  building: "#e2dad1",
  buildingEdge: "#d2c6ba",
  road: {
    motorway: ["#f4b29f", "#d0846f", 10],
    trunk: ["#f9c58f", "#d39b5e", 9],
    primary: ["#fcd9a3", "#d4ab6c", 9],
    secondary: ["#f6f3b6", "#c7c27a", 8],
    tertiary: ["#ffffff", "#c9c0b3", 7],
    minor: ["#ffffff", "#d2c9bd", 5.5],
    service: ["#ffffff", "#d7cfc4", 3.5],
    track: ["#f6f1e8", "#cfc4b2", 3],
  },
  path: "#d99a8b",
  rail: "#9b9b9b",
  label: "#3a3a3c",
  halo: "rgba(255,255,255,0.92)",
  route: "#1a73e8",
  routeEdge: "#ffffff",
  me: "#1a73e8",
  dest: "#e53935",
}

const DARK: Style = {
  bg: "#1c1d20",
  park: "#20322a",
  wood: "#1d3025",
  water: "#1d3a4f",
  building: "#2a2b30",
  buildingEdge: "#34363c",
  road: {
    motorway: ["#7a5a46", "#141416", 10],
    trunk: ["#6e5a3f", "#141416", 9],
    primary: ["#62553f", "#141416", 9],
    secondary: ["#55524a", "#141416", 8],
    tertiary: ["#4a4b51", "#141416", 7],
    minor: ["#414248", "#141416", 5.5],
    service: ["#3a3b41", "#141416", 3.5],
    track: ["#36373c", "#141416", 3],
  },
  path: "#5e4d49",
  rail: "#5d5d62",
  label: "#d9d9de",
  halo: "rgba(20,21,24,0.9)",
  route: "#4c9dff",
  routeEdge: "#0b0b0d",
  me: "#4c9dff",
  dest: "#ff5a52",
}

const LAYERS = new Set(["water", "waterway", "landcover", "park", "landuse", "building", "transportation", "transportation_name", "place"])
const ROAD_CLASSES = Object.keys(LIGHT.road)

/** Paths of one tile, in tile units, grouped for drawing. */
interface TilePaths {
  extent: number
  park: Path2D
  wood: Path2D
  water: Path2D
  waterway: Path2D
  building: Path2D
  roads: Record<string, Path2D>
  path: Path2D
  rail: Path2D
  names: {name: string; cls: string; line: number[]}[]
  places: {name: string; cls: string; x: number; y: number}[]
}

function addGeom(p: Path2D, f: TileFeature, close: boolean): void {
  for (const r of f.geom) {
    if (r.length < 4) continue
    p.moveTo(r[0], r[1])
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1])
    if (close) p.closePath()
  }
}

function buildPaths(bytes: Uint8Array): TilePaths {
  const tile = decodeTile(bytes, {layers: LAYERS, props: new Set(["class", "subclass", "brunnel", "name", "name:latin", "rank"])})
  const t: TilePaths = {
    extent: 4096,
    park: new Path2D(),
    wood: new Path2D(),
    water: new Path2D(),
    waterway: new Path2D(),
    building: new Path2D(),
    roads: Object.fromEntries(ROAD_CLASSES.map((c) => [c, new Path2D()])),
    path: new Path2D(),
    rail: new Path2D(),
    names: [],
    places: [],
  }
  for (const [name, layer] of Object.entries(tile)) {
    t.extent = layer.extent
    for (const f of layer.features) {
      const cls = String(f.props.class ?? "")
      switch (name) {
        case "water":
          if (f.type === 3) addGeom(t.water, f, true)
          break
        case "waterway":
          addGeom(t.waterway, f, false)
          break
        case "park":
          if (f.type === 3) addGeom(t.park, f, true)
          break
        case "landcover":
          if (f.type === 3 && (cls === "wood" || cls === "forest")) addGeom(t.wood, f, true)
          else if (f.type === 3 && cls === "grass") addGeom(t.park, f, true)
          break
        case "landuse":
          if (f.type === 3 && (cls === "cemetery" || cls === "pitch" || cls === "playground")) addGeom(t.park, f, true)
          break
        case "building":
          if (f.type === 3) addGeom(t.building, f, true)
          break
        case "transportation": {
          if (f.type !== 2 || f.props.brunnel === "tunnel") break
          const c = cls.replace(/_construction$/, "")
          if (c === "path") {
            if (f.props.subclass !== "platform") addGeom(t.path, f, false)
          }
          else if (c === "rail" || c === "transit") addGeom(t.rail, f, false)
          else if (c === "trunk" || c === "motorway" || c in t.roads) addGeom(t.roads[c] ?? t.roads.minor, f, false)
          else if (c === "busway" || c === "raceway") addGeom(t.roads.service, f, false)
          break
        }
        case "transportation_name": {
          const n = String(f.props.name ?? f.props["name:latin"] ?? "").trim()
          if (n && f.type === 2) for (const line of f.geom) if (line.length >= 4) t.names.push({name: n, cls, line})
          break
        }
        case "place": {
          const n = String(f.props.name ?? f.props["name:latin"] ?? "").trim()
          if (n && f.geom[0]) t.places.push({name: n, cls, x: f.geom[0][0], y: f.geom[0][1]})
          break
        }
      }
    }
  }
  return t
}

const ROAD_MIN_ZOOM: Record<string, number> = {motorway: 0, trunk: 0, primary: 0, secondary: 11, tertiary: 12, minor: 13.5, service: 15, track: 15}

export class PhoneMap {
  /** Centre in world coordinates (0…1). */
  cx = 0.4826
  cy = 0.3196
  zoom = 15.5
  follow = true
  overlay: MapOverlay = {me: null, heading: null, route: [], dest: null}
  onUserMove: () => void = () => {}
  /** Called when the whole view has no map (offline and not downloaded) or has it again. */
  onNoMap: (none: boolean) => void = () => {}
  private noMap = false

  private ctx: CanvasRenderingContext2D
  private tiles = new Map<string, {state: "loading" | "ready" | "missing"; at: number; paths?: TilePaths}>()
  private loading = 0
  private queue: [number, number, number][] = []
  private frame = 0
  private w = 0
  private h = 0
  private pointers = new Map<number, {x: number; y: number}>()
  private pinch: {d: number; zoom: number} | null = null
  private lastTap = 0

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly fetchTile: Fetch,
  ) {
    this.ctx = canvas.getContext("2d")!
    this.wire()
  }

  setCenter(lat: number, lng: number, zoom?: number): void {
    const w = toWorld(lat, lng)
    this.cx = w.x
    this.cy = w.y
    if (zoom != null) this.zoom = zoom
    this.draw()
  }

  center(): {lat: number; lng: number} {
    return fromWorld(this.cx, this.cy)
  }

  setOverlay(o: MapOverlay, followZoom?: number): void {
    this.overlay = o
    if (this.follow) {
      const c = o.me ?? o.route[0] ?? o.dest
      if (c) {
        const w = toWorld(c[0], c[1])
        this.cx = w.x
        this.cy = w.y
        if (followZoom != null && !this.userZoomed) this.zoom = followZoom
      }
    }
    this.draw()
  }

  private userZoomed = false

  zoomBy(d: number, ax?: number, ay?: number): void {
    const z = Math.max(11, Math.min(19, this.zoom + d))
    if (ax != null && ay != null && !this.follow) {
      // keep the point under the fingers in place
      const s0 = 256 * 2 ** this.zoom
      const s1 = 256 * 2 ** z
      const wx = this.cx + (ax - this.w / 2) / s0
      const wy = this.cy + (ay - this.h / 2) / s0
      this.cx = wx - (ax - this.w / 2) / s1
      this.cy = wy - (ay - this.h / 2) / s1
    }
    this.zoom = z
    this.userZoomed = true
    this.draw()
  }

  setFollow(on: boolean): void {
    this.follow = on
    if (on) {
      this.userZoomed = false
      this.setOverlay(this.overlay)
    }
    this.onUserMove()
  }

  /** Re-request tiles that were missing (after a download). */
  retryMissing(): void {
    for (const [k, t] of this.tiles) if (t.state === "missing") this.tiles.delete(k)
    this.draw()
  }

  draw(): void {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.render()
    })
  }

  // ── input ──

  private wire(): void {
    const c = this.canvas
    c.style.touchAction = "none"
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      return {x: e.clientX - r.left, y: e.clientY - r.top}
    }
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, pos(e))
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        this.pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom}
      }
      const now = performance.now()
      if (this.pointers.size === 1 && now - this.lastTap < 300) {
        const p = pos(e)
        this.follow = false
        this.zoomBy(1, p.x, p.y)
        this.onUserMove()
      }
      this.lastTap = now
    })
    c.addEventListener("pointermove", (e) => {
      const prev = this.pointers.get(e.pointerId)
      if (!prev) return
      const p = pos(e)
      this.pointers.set(e.pointerId, p)
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d > 10 && this.pinch.d > 10) {
          const target = this.pinch.zoom + Math.log2(d / this.pinch.d)
          this.zoomBy(target - this.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2)
        }
        return
      }
      const dx = p.x - prev.x
      const dy = p.y - prev.y
      if (Math.abs(dx) + Math.abs(dy) < 0.5) return
      if (this.follow) {
        this.follow = false
        this.onUserMove()
      }
      const s = 256 * 2 ** this.zoom
      this.cx -= dx / s
      this.cy -= dy / s
      this.draw()
    })
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.pinch = null
    }
    c.addEventListener("pointerup", up)
    c.addEventListener("pointercancel", up)
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault()
        const r = c.getBoundingClientRect()
        this.follow = false
        this.zoomBy(-e.deltaY / 300, e.clientX - r.left, e.clientY - r.top)
        this.onUserMove()
      },
      {passive: false},
    )
  }

  // ── tiles ──

  private dataZoom(): number {
    return this.zoom >= 13 ? 14 : 12
  }

  private request(z: number, x: number, y: number): void {
    const k = `${z}/${x}/${y}`
    const t = this.tiles.get(k)
    if (t && (t.state !== "missing" || performance.now() - t.at < 30_000)) return
    this.tiles.set(k, {state: "loading", at: performance.now()})
    this.queue.push([z, x, y])
    this.pump()
  }

  private pump(): void {
    while (this.loading < 3 && this.queue.length) {
      // nearest to the centre first
      const n = 2 ** this.dataZoom()
      this.queue.sort((a, b) => Math.hypot(a[1] + 0.5 - this.cx * n, a[2] + 0.5 - this.cy * n) - Math.hypot(b[1] + 0.5 - this.cx * n, b[2] + 0.5 - this.cy * n))
      const [z, x, y] = this.queue.shift()!
      const k = `${z}/${x}/${y}`
      this.loading++
      this.fetchTile(z, x, y)
        .then((bytes) => {
          if (!bytes) throw new Error("no tile")
          this.tiles.set(k, {state: "ready", at: performance.now(), paths: buildPaths(bytes)})
        })
        .catch(() => this.tiles.set(k, {state: "missing", at: performance.now()}))
        .finally(() => {
          this.loading--
          this.pump()
          this.draw()
          // keep the cache bounded
          if (this.tiles.size > 40) {
            const old = [...this.tiles.entries()].filter(([, v]) => v.state !== "loading").sort((a, b) => a[1].at - b[1].at)
            for (const [kk] of old.slice(0, this.tiles.size - 40)) this.tiles.delete(kk)
          }
        })
    }
  }

  // ── drawing ──

  private render(): void {
    const c = this.canvas
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = c.clientHeight
    if (!w || !h) return
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    this.w = w
    this.h = h
    const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light"
    const S = dark ? DARK : LIGHT
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = S.bg
    ctx.fillRect(0, 0, w, h)

    const dz = this.dataZoom()
    const n = 2 ** dz
    const scale = 256 * 2 ** this.zoom // px per world unit
    const tileSize = scale / n
    const left = this.cx - w / 2 / scale
    const top = this.cy - h / 2 / scale
    const tx0 = Math.floor(left * n)
    const ty0 = Math.floor(top * n)
    const tx1 = Math.floor((this.cx + w / 2 / scale) * n)
    const ty1 = Math.floor((this.cy + h / 2 / scale) * n)
    const visible: {paths: TilePaths; ox: number; oy: number}[] = []
    let wanted = 0
    let missing = 0
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (ty < 0 || ty >= n) continue
        const x = ((tx % n) + n) % n
        this.request(dz, x, ty)
        const t = this.tiles.get(`${dz}/${x}/${ty}`)
        wanted++
        if (t?.state === "missing") missing++
        if (t?.paths) visible.push({paths: t.paths, ox: (tx / n - left) * scale, oy: (ty / n - top) * scale})
      }
    const none = wanted > 0 && missing === wanted
    if (none !== this.noMap) {
      this.noMap = none
      this.onNoMap(none)
    }

    const z = this.zoom
    const roadScale = Math.min(2.2, Math.max(0.35, 2 ** (z - 16.5)))
    const layer = (fn: (t: TilePaths, k: number) => void) => {
      for (const v of visible) {
        const k = tileSize / v.paths.extent
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * v.ox, dpr * v.oy)
        fn(v.paths, k)
      }
    }
    layer((t) => {
      ctx.fillStyle = S.park
      ctx.fill(t.park)
      ctx.fillStyle = S.wood
      ctx.fill(t.wood)
      ctx.fillStyle = S.water
      ctx.fill(t.water, "evenodd")
    })
    layer((t, k) => {
      ctx.strokeStyle = S.water
      ctx.lineWidth = Math.max(1, 3 * roadScale) / k
      ctx.lineCap = "round"
      ctx.stroke(t.waterway)
    })
    if (z >= 15) {
      layer((t, k) => {
        ctx.fillStyle = S.building
        ctx.fill(t.building)
        if (z >= 16) {
          ctx.strokeStyle = S.buildingEdge
          ctx.lineWidth = 0.8 / k
          ctx.stroke(t.building)
        }
      })
    }
    // roads: casings, then fills, minor first
    const order = ["track", "service", "minor", "tertiary", "secondary", "primary", "trunk", "motorway"].filter((r) => z >= ROAD_MIN_ZOOM[r])
    layer((t, k) => {
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      if (z >= 15.5) {
        ctx.setLineDash([2 / k, 2.5 / k])
        ctx.strokeStyle = S.path
        ctx.lineWidth = 1.1 / k
        ctx.stroke(t.path)
        ctx.setLineDash([])
      }
      ctx.strokeStyle = S.rail
      ctx.lineWidth = 1.6 / k
      ctx.setLineDash([6 / k, 4 / k])
      ctx.stroke(t.rail)
      ctx.setLineDash([])
      for (const r of order) {
        const [, casing, width] = S.road[r]
        ctx.strokeStyle = casing
        ctx.lineWidth = (width * roadScale + 1.6) / k
        ctx.stroke(t.roads[r])
      }
      for (const r of order) {
        const [fill, , width] = S.road[r]
        ctx.strokeStyle = fill
        ctx.lineWidth = (width * roadScale) / k
        ctx.stroke(t.roads[r])
      }
    })

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const toScreen = (lat: number, lng: number) => {
      const p = toWorld(lat, lng)
      return {x: (p.x - left) * scale, y: (p.y - top) * scale}
    }
    // the route
    const o = this.overlay
    if (o.route.length > 1) {
      const pts = o.route.map(([la, ln]) => toScreen(la, ln))
      const trace = () => {
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      }
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      trace()
      ctx.strokeStyle = S.routeEdge
      ctx.lineWidth = 9
      ctx.stroke()
      trace()
      ctx.strokeStyle = S.route
      ctx.lineWidth = 6
      ctx.stroke()
    }

    this.labels(visible, tileSize, S)

    if (o.dest) {
      const d = toScreen(o.dest[0], o.dest[1])
      ctx.fillStyle = S.dest
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.bezierCurveTo(d.x - 3, d.y - 8, d.x - 10, d.y - 12, d.x - 10, d.y - 19)
      ctx.arc(d.x, d.y - 19, 10, Math.PI, 0)
      ctx.bezierCurveTo(d.x + 10, d.y - 12, d.x + 3, d.y - 8, d.x, d.y)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(d.x, d.y - 19, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    if (o.me) {
      const m = toScreen(o.me[0], o.me[1])
      if (o.heading != null) {
        const a = ((o.heading - 90) * Math.PI) / 180
        const g = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, 36)
        g.addColorStop(0, S.me + "66")
        g.addColorStop(1, S.me + "00")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.arc(m.x, m.y, 36, a - 0.5, a + 0.5)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(m.x, m.y, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = S.me
      ctx.beginPath()
      ctx.arc(m.x, m.y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** Street names along the streets, place names; no overlaps. */
  private labels(visible: {paths: TilePaths; ox: number; oy: number}[], tileSize: number, S: Style): void {
    const ctx = this.ctx
    const z = this.zoom
    const boxes: [number, number, number, number][] = []
    const free = (b: [number, number, number, number]) => !boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineJoin = "round"
    const font = '500 11.5px Inter, -apple-system, system-ui, sans-serif'
    const minCls: Record<string, number> = {motorway: 12, trunk: 12, primary: 13, secondary: 14, tertiary: 14.5, minor: 15.5, service: 16.5, path: 17, track: 17}
    const seen = new Set<string>()
    const cands: {name: string; x: number; y: number; ang: number; len: number; rank: number}[] = []
    for (const v of visible) {
      const k = tileSize / v.paths.extent
      for (const n of v.paths.names) {
        if (z < (minCls[n.cls] ?? 16)) continue
        let best = {len: 0, x: 0, y: 0, ang: 0}
        for (let i = 2; i < n.line.length; i += 2) {
          const x0 = v.ox + n.line[i - 2] * k
          const y0 = v.oy + n.line[i - 1] * k
          const x1 = v.ox + n.line[i] * k
          const y1 = v.oy + n.line[i + 1] * k
          const len = Math.hypot(x1 - x0, y1 - y0)
          if (len > best.len) {
            let ang = Math.atan2(y1 - y0, x1 - x0)
            if (ang > Math.PI / 2) ang -= Math.PI
            if (ang < -Math.PI / 2) ang += Math.PI
            best = {len, x: (x0 + x1) / 2, y: (y0 + y1) / 2, ang}
          }
        }
        if (best.len < 30 || best.x < 0 || best.y < 0 || best.x > this.w || best.y > this.h) continue
        cands.push({name: n.name, ...best, rank: minCls[n.cls] ?? 16})
      }
    }
    cands.sort((a, b) => a.rank - b.rank || b.len - a.len)
    ctx.font = font
    for (const c of cands) {
      if (seen.has(c.name) || boxes.length > 70) continue
      const tw = ctx.measureText(c.name).width
      if (tw > c.len * 1.15) continue
      const hw = (Math.abs(Math.cos(c.ang)) * tw + Math.abs(Math.sin(c.ang)) * 12) / 2 + 3
      const hh = (Math.abs(Math.sin(c.ang)) * tw + Math.abs(Math.cos(c.ang)) * 12) / 2 + 3
      const box: [number, number, number, number] = [c.x - hw, c.y - hh, c.x + hw, c.y + hh]
      if (!free(box)) continue
      boxes.push(box)
      seen.add(c.name)
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(c.ang)
      ctx.strokeStyle = S.halo
      ctx.lineWidth = 3
      ctx.strokeText(c.name, 0, 0)
      ctx.fillStyle = S.label
      ctx.fillText(c.name, 0, 0)
      ctx.restore()
    }
    // places (districts) when not too close
    if (z < 16.5) {
      ctx.font = '600 13px Inter, -apple-system, system-ui, sans-serif'
      const rank: Record<string, number> = {city: 0, town: 1, village: 2, suburb: 3, quarter: 4, neighbourhood: 5}
      const pl: {name: string; x: number; y: number; r: number}[] = []
      for (const v of visible) {
        const k = tileSize / v.paths.extent
        for (const p of v.paths.places) if (rank[p.cls] !== undefined) pl.push({name: p.name, x: v.ox + p.x * k, y: v.oy + p.y * k, r: rank[p.cls]})
      }
      pl.sort((a, b) => a.r - b.r)
      for (const p of pl) {
        if (seen.has(p.name) || p.x < 0 || p.y < 0 || p.x > this.w || p.y > this.h) continue
        const tw = ctx.measureText(p.name).width
        const box: [number, number, number, number] = [p.x - tw / 2 - 4, p.y - 10, p.x + tw / 2 + 4, p.y + 10]
        if (!free(box)) continue
        boxes.push(box)
        seen.add(p.name)
        ctx.strokeStyle = S.halo
        ctx.lineWidth = 3.5
        ctx.strokeText(p.name, p.x, p.y)
        ctx.fillStyle = S.label
        ctx.fillText(p.name, p.x, p.y)
      }
    }
  }
}
