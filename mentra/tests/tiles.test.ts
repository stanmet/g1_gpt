import {describe, expect, test} from "bun:test"
import {readFileSync} from "fs"
import {gunzipSync, gzipSync, deflateRawSync} from "zlib"
import {inflateRaw, maybeInflate} from "../src/shared/inflate"
import {decodeTile, fromWorld, tileOf, tilesAround, toWorld} from "../src/shared/mvt"
import {classify, placeName, tileFeatures, TileStore, type BlobApi, type OfflineArea} from "../src/background/tiles"

/** A real OpenMapTiles z14 tile (Zurich, by the lake), gzip-compressed as servers send it. */
const FIXTURE = new Uint8Array(readFileSync(new URL("./fixtures/zurich-14-8590-5737.pbf.gz", import.meta.url)))
const TX = 8590
const TY = 5737
const centre = fromWorld((TX + 0.5) / 2 ** 14, (TY + 0.5) / 2 ** 14)

describe("inflate", () => {
  test("gzip and raw deflate, as zlib makes them", () => {
    expect([...maybeInflate(FIXTURE)]).toEqual([...gunzipSync(FIXTURE)])
    const text = new TextEncoder().encode("Направо через 120 м. ".repeat(500))
    expect(new TextDecoder().decode(maybeInflate(gzipSync(text)))).toBe(new TextDecoder().decode(text))
    expect([...inflateRaw(deflateRawSync(text, {level: 0}))]).toEqual([...text]) // stored blocks
    expect([...inflateRaw(deflateRawSync(new Uint8Array([1, 2, 3])))]).toEqual([1, 2, 3]) // fixed Huffman
  })

  test("a plain tile passes through", () => {
    const plain = gunzipSync(FIXTURE)
    expect(maybeInflate(new Uint8Array(plain))).toEqual(new Uint8Array(plain))
  })
})

describe("vector tiles", () => {
  test("OpenMapTiles layers with names and geometry inside the tile", () => {
    const t = decodeTile(FIXTURE)
    for (const l of ["transportation", "water", "park", "place", "transportation_name"]) expect(t[l]?.features.length).toBeGreaterThan(0)
    expect(t.transportation.extent).toBe(4096)
    const names = t.transportation_name.features.map((f) => f.props.name).filter(Boolean)
    expect(names.length).toBeGreaterThan(3)
    for (const f of t.transportation.features.slice(0, 50)) {
      expect(f.type).toBe(2)
      for (const line of f.geom) {
        expect(line.length % 2).toBe(0)
        // coordinates stay near the tile (buffer allowed)
        for (const v of line) expect(Math.abs(v)).toBeLessThan(4096 * 2)
      }
    }
    // polygons are closed
    const w = t.water.features.find((f) => f.type === 3)!
    const r = w.geom[0]
    expect([r[0], r[1]]).toEqual([r[r.length - 2], r[r.length - 1]])
  })

  test("only the layers asked for", () => {
    const t = decodeTile(FIXTURE, {layers: new Set(["water"])})
    expect(Object.keys(t)).toEqual(["water"])
  })

  test("Web Mercator: round trip, tiles around a point", () => {
    const w = toWorld(53.3498, -6.2603)
    const back = fromWorld(w.x, w.y)
    expect(back.lat).toBeCloseTo(53.3498, 6)
    expect(back.lng).toBeCloseTo(-6.2603, 6)
    expect(tileOf(centre.lat, centre.lng)).toEqual({x: TX, y: TY})
    const around = tilesAround(centre.lat, centre.lng, 300)
    expect(around).toEqual([{x: TX, y: TY}])
    expect(tilesAround(centre.lat, centre.lng, 2000).length).toBeGreaterThanOrEqual(9)
  })
})

describe("map features for the glasses", () => {
  test("OpenMapTiles classes → what is drawn", () => {
    const f = (props: Record<string, string>) => ({type: 2 as const, props, geom: []})
    expect(classify("transportation", f({class: "primary"}))).toBe("major")
    expect(classify("transportation", f({class: "tertiary"}))).toBe("road")
    expect(classify("transportation", f({class: "minor"}))).toBe("minor")
    expect(classify("transportation", f({class: "path", subclass: "footway"}))).toBe("path")
    expect(classify("transportation", f({class: "path", subclass: "platform"}))).toBeNull()
    expect(classify("transportation", f({class: "minor", brunnel: "tunnel"}))).toBeNull()
    expect(classify("water", f({class: "swimming_pool"}))).toBeNull()
    expect(classify("water", f({class: "lake"}))).toBe("water")
  })

  test("a real tile → roads, water and parks in world coordinates, within the tile", () => {
    const feats = tileFeatures(FIXTURE, 14, TX, TY)
    const kinds = new Set(feats.map((f) => f.k))
    expect(kinds.has("water")).toBe(true)
    expect([...kinds].some((k) => k === "road" || k === "minor" || k === "major")).toBe(true)
    const n = 2 ** 14
    for (const f of feats) {
      // long lines and big areas may reach a bit into the next tiles
      expect(f.b[0]).toBeGreaterThan((TX - 1) / n)
      expect(f.b[2]).toBeLessThan((TX + 2) / n)
    }
    expect(placeName(FIXTURE, 14, TX, TY, centre.lat, centre.lng)).not.toBe("")
  })
})

// ── the store, with a fake Mentra blob storage ──

function fakeBlob(opts: {fail?: boolean} = {}) {
  const files = new Map<string, Uint8Array>()
  const calls = {setFromUrl: [] as string[], deleted: [] as string[]}
  const blob: BlobApi = {
    async setFromUrl(key, url) {
      calls.setFromUrl.push(url)
      if (opts.fail) throw new Error("offline")
      files.set(key, FIXTURE)
      return {bytes: FIXTURE.length}
    },
    async bytes(key) {
      return files.get(key) ?? null
    },
    async list() {
      return [...files.entries()].map(([key, b]) => ({key, bytes: b.length}))
    },
    async delete(key) {
      calls.deleted.push(key)
      files.delete(key)
    },
  }
  return {blob, files, calls}
}

function setup(opts: {fail?: boolean; tilejson?: boolean} = {}) {
  const b = fakeBlob(opts)
  let areas: OfflineArea[] = []
  let t = 1_700_000_000_000
  const logs: string[] = []
  const store = new TileStore({
    blob: b.blob,
    fetchJson: async () => {
      if (opts.tilejson === false) throw new Error("no network")
      return {tiles: ["https://tiles.openfreemap.org/planet/20251101_001001_pt/{z}/{x}/{y}.pbf"]}
    },
    log: (_k, m) => void logs.push(m),
    now: () => (t += 10),
    onChange: () => {},
    loadAreas: () => areas,
    saveAreas: (a) => void (areas = a),
  })
  return {store, ...b, areas: () => areas, logs}
}

describe("TileStore", () => {
  test("a missing tile is downloaded once (from the TileJSON address), then read from the phone", async () => {
    const e = setup()
    const [a, b] = await Promise.all([e.store.ensure(14, TX, TY), e.store.ensure(14, TX, TY)])
    expect(a && b).toBe(true)
    expect(e.calls.setFromUrl).toEqual([`https://tiles.openfreemap.org/planet/20251101_001001_pt/14/${TX}/${TY}.pbf`])
    expect(await e.store.raw(14, TX, TY)).toBe(FIXTURE)
    expect(e.store.stats()).toEqual({tiles: 1, bytes: FIXTURE.length})
  })

  test("without the TileJSON the «latest» address is used", async () => {
    const e = setup({tilejson: false})
    await e.store.ensure(14, 1, 2)
    expect(e.calls.setFromUrl[0]).toBe("https://tiles.openfreemap.org/planet/latest/14/1/2.pbf")
  })

  test("features around a point; offline with no saved map → a clear error", async () => {
    const e = setup()
    const feats = await e.store.features(centre, 300)
    expect(feats.length).toBeGreaterThan(10)
    const off = setup({fail: true})
    await expect(off.store.features(centre, 300)).rejects.toThrow(/нет карты этого места/)
  })

  test("offline area: progress, a name from the map, delete keeps tiles of other areas", async () => {
    const e = setup()
    const p = e.store.downloadArea(centre.lat, centre.lng, 2)
    expect(e.store.download).not.toBeNull()
    const area = (await p)!
    expect(e.store.download).toBeNull()
    expect(area.name).not.toMatch(/^\d/) // a place name, not coordinates
    expect(area.tiles).toBeGreaterThanOrEqual(9)
    expect(e.areas()).toHaveLength(1)
    const z12 = e.calls.setFromUrl.filter((u) => u.includes("/12/")).length
    expect(z12).toBeGreaterThan(0) // overview tiles for zooming out

    const second = (await e.store.downloadArea(centre.lat, centre.lng, 2))!
    expect(e.calls.setFromUrl.length).toBe(area.tiles) // nothing downloaded twice
    await e.store.deleteArea(area.id)
    expect(e.calls.deleted).toHaveLength(0) // the other area still covers them
    await e.store.deleteArea(second.id)
    expect(e.calls.deleted.length).toBe(area.tiles)
    expect(e.store.stats().tiles).toBe(0)
  })

  test("no connection: the download stops early and says why", async () => {
    const e = setup({fail: true})
    expect(await e.store.downloadArea(centre.lat, centre.lng, 5)).toBeNull()
    expect(e.calls.setFromUrl.length).toBeLessThan(20)
    expect(e.logs.at(-1)).toMatch(/нет связи/)
  })

  test("the map along a route is saved", async () => {
    const e = setup()
    const a = fromWorld((TX + 0.2) / 2 ** 14, (TY + 0.5) / 2 ** 14)
    const b = fromWorld((TX + 2.8) / 2 ** 14, (TY + 0.5) / 2 ** 14)
    const got = await e.store.prefetchRoute([a, b])
    expect(got).toBeGreaterThanOrEqual(3)
    expect(e.store.has(14, TX + 1, TY)).toBe(true)
  })

  test("delete all", async () => {
    const e = setup()
    await e.store.downloadArea(centre.lat, centre.lng, 2)
    await e.store.deleteAll()
    expect(e.store.stats().tiles).toBe(0)
    expect(e.areas()).toEqual([])
  })
})
