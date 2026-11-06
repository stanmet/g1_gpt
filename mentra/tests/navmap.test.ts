import {describe, expect, test} from "bun:test"
import {Canvas, drawText, encodeG1Bmp, fit, g1Canvas, G1_SAFE, measure, testPattern} from "../src/background/glassdraw"
import {
  bearing,
  distanceM,
  MAP_BOX,
  nearestOnRoute,
  overpassQuery,
  parseOverpass,
  renderHud,
  travelHeading,
  type HudState,
  type LatLng,
} from "../src/background/navmap"
import {Navigator, type NavUpdate, type Place} from "../src/background/navigator"

const bmp = (b64: string) => Buffer.from(b64, "base64")
/** Lit pixels of a G1 bitmap (bit 0 = drawn), top-down. */
function litPixels(b64: string): {x: number; y: number}[] {
  const b = bmp(b64)
  const out: {x: number; y: number}[] = []
  for (let y = 0; y < 135; y++) {
    const row = 62 + (134 - y) * 72
    for (let x = 0; x < 576; x++) if (((b[row + (x >> 3)] >> (7 - (x & 7))) & 1) === 0) out.push({x, y})
  }
  return out
}

// a small street grid around Trinity College
const O = {lat: 53.343, lng: -6.26}
const at = (dx: number, dy: number): LatLng => ({lat: O.lat + dy / 111320, lng: O.lng + dx / (111320 * Math.cos((O.lat * Math.PI) / 180))})

describe("G1 bitmap", () => {
  test("Mentra's format: 576×135, 1 bit, bottom-up, drawing = black (the phone inverts it)", () => {
    const c = g1Canvas()
    c.set(0, 0)
    c.set(575, 134)
    const b = bmp(encodeG1Bmp(c))
    expect(b.subarray(0, 2).toString()).toBe("BM")
    expect(b.length).toBe(9782)
    expect(b.readUInt32LE(2)).toBe(9782)
    expect(b.readUInt32LE(10)).toBe(62)
    expect(b.readInt32LE(18)).toBe(576)
    expect(b.readInt32LE(22)).toBe(135)
    expect(b.readUInt16LE(28)).toBe(1)
    expect([...b.subarray(54, 62)]).toEqual([0, 0, 0, 0, 255, 255, 255, 0]) // black, white
    // top-left pixel is the first bit of the LAST row in the file; background bytes are 0xFF
    expect(b[62 + 134 * 72] & 0x80).toBe(0)
    expect(b[62 + 71] & 0x01).toBe(0)
    expect(b[62 + 1]).toBe(0xff)
    expect(litPixels(encodeG1Bmp(c))).toEqual([{x: 0, y: 0}, {x: 575, y: 134}])
  })

  test("text in Inter, Russian and Latin; long text is cut with «…»", () => {
    const c = new Canvas(300, 30)
    const w = drawText(c, "Направо Grafton", 0, 0, "text")
    expect(w).toBe(measure("Направо Grafton", "text"))
    expect(c.px.reduce((a, v) => a + v, 0)).toBeGreaterThan(150)
    expect(fit("Trinity College Dublin, the University of Dublin", "text", 160)).toMatch(/…$/)
    expect(measure(fit("Trinity College Dublin, the University of Dublin", "text", 160), "text")).toBeLessThanOrEqual(160)
    expect(fit("Short", "text", 160)).toBe("Short")
    // й, ё and digits in the big font
    expect(measure("йё", "text")).toBeGreaterThan(10)
    expect(measure("1,2 км", "big")).toBeGreaterThan(60)
  })

  test("test picture outlines the visible area", () => {
    const lit = litPixels(testPattern())
    expect(lit.some((p) => p.x === G1_SAFE.x && p.y > G1_SAFE.y + 20)).toBe(true) // left edge of the frame
    expect(lit.some((p) => p.x < 12 && p.y < 12)).toBe(true) // corner mark of the full bitmap
  })
})

describe("map geometry and streets", () => {
  test("distances, bearings, the closest point of the route", () => {
    expect(distanceM(at(0, 0), at(300, 400))).toBeCloseTo(500, -1)
    expect(bearing(at(0, 0), at(0, 100))).toBeCloseTo(0, 0)
    expect(bearing(at(0, 0), at(100, 0))).toBeCloseTo(90, 0)
    const route = [at(0, 0), at(0, 100), at(100, 100)]
    const n = nearestOnRoute(route, at(5, 60))!
    expect(n.index).toBe(0)
    expect(n.dist).toBeCloseTo(5, 0)
    expect(n.along).toBeCloseTo(60, 0)
    // on the route: heading follows it (north, then east after the corner)
    expect(travelHeading(route, at(0, 10), null)).toBeCloseTo(0, -1)
    expect(travelHeading(route, at(0, 95), null)!).toBeGreaterThan(30)
    // far from the route: from the movement
    expect(travelHeading(route, at(500, 500), at(500, 480))).toBeCloseTo(0, -1)
    expect(travelHeading(route, at(500, 500), at(500, 498))).toBeNull()
  })

  test("Overpass: the query and its reply", () => {
    const q = overpassQuery(O, 500, "walking")
    expect(q).toContain("around:500,53.343000,-6.260000")
    expect(q).toContain("footway")
    expect(overpassQuery(O, 1400, "driving")).not.toContain("footway")
    const roads = parseOverpass({
      elements: [
        {type: "way", tags: {highway: "primary"}, geometry: [{lat: 1, lon: 2}, {lat: 3, lon: 4}]},
        {type: "way", tags: {highway: "footway"}, geometry: [{lat: 1, lon: 2}, {lat: 3, lon: 4}]},
        {type: "way", tags: {highway: "construction"}, geometry: [{lat: 1, lon: 2}, {lat: 3, lon: 4}]},
        {type: "way", tags: {highway: "residential"}, geometry: [{lat: 1, lon: 2}]},
      ],
    })
    expect(roads).toEqual([
      {c: 0, p: [{lat: 1, lng: 2}, {lat: 3, lng: 4}]},
      {c: 2, p: [{lat: 1, lng: 2}, {lat: 3, lng: 4}]},
    ])
    expect(parseOverpass(null)).toEqual([])
  })
})

describe("the navigation picture", () => {
  const state: HudState = {
    maneuver: "TURN_RIGHT",
    distance: "120 м",
    verb: "Направо",
    road: "Grafton Street",
    left: "850 м · 11 мин · Trinity College Dublin",
    me: at(0, 0),
    heading: 0,
    route: [at(0, -20), at(0, 80), at(140, 80), at(150, 260)],
    roads: [
      {c: 1, p: [at(-300, 80), at(300, 80)]},
      {c: 2, p: [at(-100, -100), at(100, 100)]},
    ],
    dest: at(150, 260),
    mode: "walking",
  }

  test("draws only inside the visible area, with text on the left and the map on the right", () => {
    const lit = litPixels(renderHud(state))
    expect(lit.length).toBeGreaterThan(1500)
    expect(lit.every((p) => p.x >= G1_SAFE.x && p.y >= G1_SAFE.y && p.x < G1_SAFE.x + G1_SAFE.w && p.y < G1_SAFE.y + G1_SAFE.h)).toBe(true)
    const inMap = lit.filter((p) => p.x >= MAP_BOX.x)
    const left = lit.filter((p) => p.x < MAP_BOX.x)
    expect(inMap.length).toBeGreaterThan(300)
    expect(left.length).toBeGreaterThan(800)
  })

  test("a different turn or a message makes a different picture; no streets is fine", () => {
    const a = renderHud(state)
    expect(renderHud({...state, maneuver: "TURN_LEFT", verb: "Налево"})).not.toBe(a)
    expect(renderHud({...state, message: "Перестраиваю маршрут…"})).not.toBe(a)
    expect(bmp(renderHud({...state, roads: [], me: null, heading: null})).length).toBe(9782)
    expect(renderHud(state)).toBe(a) // same state, same picture (nothing is resent)
  })
})

// ── the Navigator with the map on ──

class Clock {
  t = 1_700_000_000_000
  timers: {id: number; at: number; fn: () => void}[] = []
  seq = 0
  now = () => this.t
  set = (fn: () => void, ms: number) => {
    const id = ++this.seq
    this.timers.push({id, at: this.t + ms, fn})
    return id
  }
  clear = (id: unknown) => {
    this.timers = this.timers.filter((x) => x.id !== id)
  }
  async advance(ms: number) {
    const end = this.t + ms
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at)
      const next = this.timers[0]
      if (!next || next.at > end) break
      this.timers.shift()
      this.t = next.at
      next.fn()
      for (let i = 0; i < 10; i++) await Promise.resolve()
    }
    this.t = end
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }
}

const DEST: Place = {name: "Trinity College Dublin", address: "", ...at(150, 260)}

function setup(mapOn = true) {
  const clock = new Clock()
  const screens: {text: string; kind: string}[] = []
  const roadCalls: {center: LatLng; radius: number}[] = []
  let watching = 0
  let unwatched = 0
  let onPos: ((p: {lat: number; lng: number}) => void) | null = null
  let nav!: Navigator
  nav = new Navigator({
    search: async () => DEST,
    start: async () => {
      // Mentra sends the route line just before it confirms the start
      nav.onRoute([at(0, -20), at(0, 80), at(140, 80), at(150, 260)])
      return {ok: true}
    },
    stop: () => {},
    screen: (text, kind) => void screens.push({text, kind}),
    log: () => {},
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    onChange: () => {},
    save: () => {},
    ended: () => {},
    mapOn: () => mapOn,
    roads: async (center, radius) => {
      roadCalls.push({center, radius})
      return [{c: 1, p: [at(-300, 80), at(300, 80)]}]
    },
    watch: (cb) => {
      watching++
      onPos = cb
      return () => void unwatched++
    },
  })
  return {nav, clock, screens, roadCalls, pos: (p: LatLng) => onPos?.(p), watching: () => watching, unwatched: () => unwatched}
}

const maneuver = (over: Partial<Extract<NavUpdate, {kind: "maneuver"}>> = {}): NavUpdate => ({
  kind: "maneuver",
  maneuverType: "TURN_RIGHT",
  distanceMeters: 120,
  nextStepRoad: "Grafton Street",
  distanceToDestinationMeters: 850,
  timeToDestinationSeconds: 660,
  ...over,
})

describe("Navigator: the map picture", () => {
  test("route from the start, position, streets, throttled pictures; stop ends the position watch", async () => {
    const e = setup()
    await e.nav.go("Trinity", "walking")
    expect(e.nav.route).toHaveLength(4) // the route sent during the start is kept
    expect(e.watching()).toBe(1)
    expect(e.nav.frame).not.toBe("")
    expect(e.nav.frameId).toBe(1)
    expect(e.roadCalls).toHaveLength(1) // streets around the start of the route
    await e.clock.advance(10)
    const id1 = e.nav.frameId

    e.pos(at(0, 0))
    // walking: the next picture after ~4 s, not at once
    expect(e.nav.frameId).toBe(id1)
    expect(e.nav.me).toEqual(at(0, 0))
    expect(e.nav.heading).toBeCloseTo(0, -1)
    await e.clock.advance(4100)
    expect(e.nav.frameId).toBe(id1 + 1)

    // a new turn: the picture changes soon (1.5 s)
    e.nav.onUpdate(maneuver())
    await e.clock.advance(1600)
    const id2 = e.nav.frameId
    expect(id2).toBeGreaterThan(id1 + 1)
    expect(e.screens.at(-1)!.kind).not.toBe("message")

    // far away: the streets are loaded again
    e.pos(at(400, 0))
    expect(e.roadCalls).toHaveLength(1) // not before the retry interval
    await e.clock.advance(21_000)
    e.pos(at(400, 5))
    expect(e.roadCalls).toHaveLength(2)

    e.nav.stop("voice")
    expect(e.unwatched()).toBe(1)
    expect(e.nav.frame).toBe("")
    expect(e.nav.route).toHaveLength(0)
  })

  test("map off: no pictures, no streets", async () => {
    const e = setup(false)
    await e.nav.go("Trinity", "walking")
    e.pos(at(0, 0))
    await e.clock.advance(10_000)
    expect(e.nav.frame).toBe("")
    expect(e.roadCalls).toHaveLength(0)
  })
})
