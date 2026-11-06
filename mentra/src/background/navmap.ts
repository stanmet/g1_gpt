/**
 * The navigation screen on the G1 as a picture, like the Even app's navigation: turn arrow,
 * distance and street on the left, a small map on the right — the streets around (OpenStreetMap),
 * the route, where you are and which way you are going (the map turns with you).
 *
 *   ┌──────────────────────────────────────────────┐┌──────────────┐
 *   │  ┏━━┓   120 м                                ││   ╲  route   │
 *   │  ┃ →┃   Направо                              ││    ╲━━━━     │
 *   │  ┗━━┛   Grafton Street                       ││      ▲ you   │
 *   │  850 м · 11 мин · Trinity College             ││              │
 *   └──────────────────────────────────────────────┘└──────────────┘
 *
 * Pure: state in, base64 BMP out. Map data (route, position, streets) is gathered elsewhere.
 */
import {Canvas, capTop, drawText, encodeG1Bmp, fit, g1Canvas, G1_SAFE, lineHeight, measure} from "./glassdraw"

export interface LatLng {
  lat: number
  lng: number
}

/** 0 = main road, 1 = street, 2 = footpath / cycle path. */
export type RoadClass = 0 | 1 | 2

export interface Road {
  c: RoadClass
  p: LatLng[]
}

export type MapMode = "walking" | "driving" | "cycling"

export interface HudState {
  /** Maneuver type (Mentra's: TURN_LEFT, STRAIGHT…), or null before the first update. */
  maneuver: string | null
  /** «120 м» — distance to the maneuver. */
  distance: string
  /** «Направо» */
  verb: string
  /** «Grafton Street» */
  road: string
  /** «850 м · 11 мин» */
  left: string
  /** Replaces the turn block: «Перестраиваю маршрут…», «Вы на месте». */
  message?: string
  me: LatLng | null
  /** Direction of travel, degrees from north; null = north up. */
  heading: number | null
  route: LatLng[]
  roads: Road[]
  dest: LatLng | null
  mode: MapMode
}

// ───────────────────────── geometry ─────────────────────────

const R_EARTH = 6_371_000
const rad = (d: number) => (d * Math.PI) / 180

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Bearing a → b in degrees from north, clockwise. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Local meters east/north of `o`. */
function toLocal(p: LatLng, o: LatLng): {x: number; y: number} {
  return {x: rad(p.lng - o.lng) * R_EARTH * Math.cos(rad(o.lat)), y: rad(p.lat - o.lat) * R_EARTH}
}

/** Closest point of the route to `me`: segment index, distance in meters, meters along the route. */
export function nearestOnRoute(route: LatLng[], me: LatLng): {index: number; dist: number; along: number} | null {
  if (route.length < 2) return null
  let best = {index: 0, dist: Infinity, along: 0}
  let along = 0
  for (let i = 0; i < route.length - 1; i++) {
    const a = toLocal(route[i], me)
    const b = toLocal(route[i + 1], me)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0
    const d = Math.hypot(a.x + dx * t, a.y + dy * t)
    const segLen = Math.sqrt(len2)
    if (d < best.dist) best = {index: i, dist: d, along: along + segLen * t}
    along += segLen
  }
  return best
}

/** The point `ahead` meters further along the route from the closest point to `me`. */
export function pointAhead(route: LatLng[], me: LatLng, ahead: number): LatLng | null {
  const n = nearestOnRoute(route, me)
  if (!n) return null
  const target = n.along + ahead
  let along = 0
  for (let i = 0; i < route.length - 1; i++) {
    const seg = distanceM(route[i], route[i + 1])
    if (along + seg >= target && seg > 0) {
      const t = (target - along) / seg
      return {lat: route[i].lat + (route[i + 1].lat - route[i].lat) * t, lng: route[i].lng + (route[i + 1].lng - route[i].lng) * t}
    }
    along += seg
  }
  return route[route.length - 1]
}

/** Which way you are going: along the route if you are on it, else from your movement. */
export function travelHeading(route: LatLng[], me: LatLng, prev: LatLng | null): number | null {
  const n = nearestOnRoute(route, me)
  if (n && n.dist < 40) {
    const ahead = pointAhead(route, me, 35)
    if (ahead && distanceM(me, ahead) > 3) return bearing(me, ahead)
  }
  if (prev && distanceM(prev, me) > 8) return bearing(prev, me)
  return null
}

// ───────────────────────── streets (OpenStreetMap via Overpass) ─────────────────────────

const ROAD_CLASS: Record<string, RoadClass> = {
  motorway: 0, trunk: 0, primary: 0, secondary: 0, motorway_link: 0, trunk_link: 0, primary_link: 0, secondary_link: 0,
  tertiary: 1, tertiary_link: 1, unclassified: 1, residential: 1, living_street: 1, pedestrian: 1, service: 1, road: 1,
  footway: 2, path: 2, cycleway: 2, steps: 2, track: 2, bridleway: 2,
}

/** Map radius in meters by travel mode (what is fetched around you). */
export const ROADS_RADIUS: Record<MapMode, number> = {walking: 500, cycling: 800, driving: 1400}

/** Overpass query for the streets around a point. Driving skips footpaths and service roads. */
export function overpassQuery(c: LatLng, radius: number, mode: MapMode): string {
  const kinds = Object.keys(ROAD_CLASS).filter((k) => mode !== "driving" || (ROAD_CLASS[k] < 2 && k !== "service"))
  return `[out:json][timeout:20];way["highway"~"^(${kinds.join("|")})$"](around:${Math.round(radius)},${c.lat.toFixed(6)},${c.lng.toFixed(6)});out geom qt;`
}

export function parseOverpass(json: unknown): Road[] {
  const els = (json as {elements?: unknown[]})?.elements
  if (!Array.isArray(els)) return []
  const roads: Road[] = []
  for (const e of els as {type?: string; tags?: Record<string, string>; geometry?: {lat: number; lon: number}[]}[]) {
    if (e?.type !== "way" || !Array.isArray(e.geometry) || e.geometry.length < 2) continue
    const c = ROAD_CLASS[e.tags?.highway ?? ""]
    if (c === undefined) continue
    roads.push({c, p: e.geometry.filter((g) => Number.isFinite(g?.lat) && Number.isFinite(g?.lon)).map((g) => ({lat: g.lat, lng: g.lon}))})
  }
  return roads
}

// ───────────────────────── drawing ─────────────────────────

/** Meters per pixel on the glasses map, by travel mode. */
const MAP_SCALE: Record<MapMode, number> = {walking: 2, cycling: 3.5, driving: 7}
/** Map box on the bitmap (inside the visible area, on the right). */
export const MAP_BOX = {x: G1_SAFE.x + G1_SAFE.w - 184, y: G1_SAFE.y, w: 182, h: G1_SAFE.h}

/** Liang–Barsky: the part of a segment inside [0,w]×[0,h], or null. */
function clip(x0: number, y0: number, x1: number, y1: number, w: number, h: number): [number, number, number, number] | null {
  let t0 = 0
  let t1 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const edges: [number, number][] = [
    [-dx, x0 + 2],
    [dx, w + 2 - x0],
    [-dy, y0 + 2],
    [dy, h + 2 - y0],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null
    } else {
      const r = q / p
      if (p < 0) {
        if (r > t1) return null
        if (r > t0) t0 = r
      } else {
        if (r < t0) return null
        if (r < t1) t1 = r
      }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy]
}

/** The map: course-up around you, you a bit below the centre so more of the way ahead shows. */
export function drawMap(s: HudState, w = MAP_BOX.w, h = MAP_BOX.h): Canvas {
  const c = new Canvas(w, h)
  const center = s.me ?? s.route[0] ?? s.dest
  if (!center) return c
  const scale = MAP_SCALE[s.mode] ?? 2
  const hd = rad(s.heading ?? 0)
  const cos = Math.cos(hd)
  const sin = Math.sin(hd)
  const cx = w / 2
  const cy = s.heading == null ? h / 2 : h * 0.68
  const project = (p: LatLng) => {
    const l = toLocal(p, center)
    const x = l.x * cos - l.y * sin
    const y = l.x * sin + l.y * cos
    return {x: cx + x / scale, y: cy - y / scale}
  }
  const seg = (pts: LatLng[], t: number, dash?: [number, number], v = 1) => {
    let prev: {x: number; y: number} | null = null
    for (const p of pts) {
      const q = project(p)
      if (prev) {
        const cl = clip(prev.x, prev.y, q.x, q.y, w, h)
        if (cl) c.line(cl[0], cl[1], cl[2], cl[3], t, v, dash)
      }
      prev = q
    }
  }
  for (const r of s.roads) seg(r.p, r.c === 0 ? 2 : 1, r.c === 2 ? [2, 3] : undefined)
  // the route from where you are on
  let route = s.route
  if (s.me && route.length > 1) {
    const n = nearestOnRoute(route, s.me)
    if (n) route = [s.me, ...route.slice(n.index + 1)]
  }
  // a clear border around the route so it reads over the streets, then the route itself
  seg(route, 9, undefined, 0)
  seg(route, 4)
  if (s.dest) {
    const d = project(s.dest)
    if (d.x >= -8 && d.x <= w + 8 && d.y >= -8 && d.y <= h + 8) {
      c.disc(d.x, d.y, 7, 0)
      c.ring(d.x, d.y, 6, 2)
      c.disc(d.x, d.y, 2)
    }
  }
  if (s.me) {
    // you: an arrowhead pointing the way you go (up), with a clear outline
    const tip = {x: cx, y: cy - 9}
    if (s.heading != null) {
      c.triangle(tip.x, tip.y - 3, cx - 9, cy + 9, cx + 9, cy + 9, 0)
      c.triangle(tip.x, tip.y, cx - 7, cy + 7, cx, cy + 3)
      c.triangle(tip.x, tip.y, cx, cy + 3, cx + 7, cy + 7)
    } else {
      c.disc(cx, cy, 7, 0)
      c.disc(cx, cy, 5)
    }
  }
  return c
}

/** Turn arrows in a 56×56 box. */
const ARROWS: Record<string, [number, number][]> = {
  STRAIGHT: [[28, 54], [28, 14]],
  TURN_RIGHT: [[16, 54], [16, 28], [38, 28]],
  SLIGHT_RIGHT: [[18, 54], [18, 36], [36, 18]],
  SHARP_RIGHT: [[16, 54], [16, 16], [36, 36]],
  U_TURN: [[38, 54], [38, 24], [36, 16], [30, 11], [24, 11], [18, 16], [16, 24], [16, 34]],
}
const mirror = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [56 - x, y])

function arrowPath(maneuver: string | null): [number, number][] | null {
  switch (maneuver) {
    case "TURN_RIGHT":
    case "SLIGHT_RIGHT":
    case "SHARP_RIGHT":
    case "U_TURN":
      return ARROWS[maneuver]
    case "TURN_LEFT":
      return mirror(ARROWS.TURN_RIGHT)
    case "SLIGHT_LEFT":
      return mirror(ARROWS.SLIGHT_RIGHT)
    case "SHARP_LEFT":
      return mirror(ARROWS.SHARP_RIGHT)
    case "ARRIVE":
      return null
    default:
      return ARROWS.STRAIGHT
  }
}

export function drawArrow(c: Canvas, maneuver: string | null, x: number, y: number): void {
  if (maneuver === "ARRIVE") {
    c.ring(x + 28, y + 28, 22, 4)
    c.disc(x + 28, y + 28, 8)
    return
  }
  const pts = arrowPath(maneuver)!.map(([px, py]) => ({x: x + px, y: y + py}))
  c.polyline(pts, 8)
  // head on the last segment
  const a = pts[pts.length - 2]
  const b = pts[pts.length - 1]
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const tip = {x: b.x + ux * 14, y: b.y + uy * 14}
  const base = {x: b.x - ux * 2, y: b.y - uy * 2}
  c.triangle(tip.x, tip.y, base.x - uy * 13, base.y + ux * 13, base.x + uy * 13, base.y - ux * 13)
}

/** Text lines for the left block, wrapped to `maxW`. */
function wrap(text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (measure(next, "text") <= maxW) cur = next
    else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = fit(`${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, "text", maxW)
    return kept
  }
  return lines.map((l) => fit(l, "text", maxW))
}

/** The whole navigation screen as a G1 bitmap (base64 BMP). */
export function renderHud(s: HudState): string {
  const c = g1Canvas()
  const S = G1_SAFE
  const leftW = MAP_BOX.x - S.x - 10
  const textH = lineHeight("text")
  const textCap = capTop("text")

  if (s.message) {
    const lines = wrap(s.message, leftW, 4)
    let y = S.y + Math.max(0, (S.h - lines.length * 22) / 2) - textCap
    for (const l of lines) {
      drawText(c, l, S.x + 2, y, "text")
      y += 22
    }
  } else {
    drawArrow(c, s.maneuver, S.x + 2, S.y + 2)
    const tx = S.x + 70
    const tw = leftW - 70
    // distance, big; then the instruction and the street
    drawText(c, fit(s.distance, "big", tw), tx, S.y + 2 - capTop("big"), "big")
    let y = S.y + 34 - textCap
    if (s.verb) {
      drawText(c, fit(s.verb, "text", tw), tx, y, "text")
      y += 21
    }
    if (s.road) drawText(c, fit(s.road, "text", tw), tx, y, "text")
    // what is left, along the bottom
    if (s.left) drawText(c, fit(s.left, "text", leftW), S.x + 2, S.y + S.h - textH - 1, "text")
  }

  // the map, framed
  const map = drawMap(s, MAP_BOX.w - 6, MAP_BOX.h - 6)
  c.blit(map, MAP_BOX.x + 3, MAP_BOX.y + 3)
  c.frame(MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h, 10, 2)
  return encodeG1Bmp(c)
}
