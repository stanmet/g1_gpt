import {describe, expect, test} from "bun:test"
import {readFileSync} from "fs"
import {
  addressAt,
  addressLine,
  aroundText,
  buildNotePrompt,
  cleanNote,
  compassWord,
  GUIDE_GAP_MS,
  isPlaceQuestion,
  parseGuideCommand,
  placeContext,
  poiInterest,
  poisNear,
  relativeWord,
  tileInfo,
  WalkGuide,
  type PoiHit,
} from "../src/background/guide"
import {fromWorld} from "../src/shared/mvt"

/** A real OpenMapTiles z14 tile (Fehraltorf near Zurich): a church, a museum, streets, house numbers. */
const FIXTURE = new Uint8Array(readFileSync(new URL("./fixtures/zurich-14-8590-5737.pbf.gz", import.meta.url)))
const info = tileInfo(FIXTURE, 14, 8590, 5737)
const church = info.pois.find((p) => p.name === "Kirche Fehraltorf")!
const churchAt = fromWorld(church.x, church.y)

describe("guide: map data", () => {
  test("sights, place names, streets and house numbers come out of a real tile", () => {
    expect(church.kind).toBe("церковь")
    expect(info.pois.some((p) => p.kind === "музей")).toBe(true)
    // shops, bus stops, parking are not sights
    expect(info.pois.every((p) => p.score > 0)).toBe(true)
    expect(info.places.some((p) => p.name === "Fehraltorf" && p.ru === "Феральторф")).toBe(true)
    expect(info.streets.length).toBeGreaterThan(10)
    expect(info.houses.length).toBeGreaterThan(10)
  })

  test("what counts as a sight", () => {
    expect(poiInterest("castle", "castle")!.score).toBeGreaterThan(poiInterest("museum", "museum")!.score)
    expect(poiInterest("place_of_worship", "muslim")!.kind).toBe("мечеть")
    expect(poiInterest("college", "college")).toBeNull()
    expect(poiInterest("shop", "bakery")).toBeNull()
    expect(poiInterest("art_gallery", "art")).toBeNull()
  })

  test("sights near you, with distance and bearing", () => {
    const me = {lat: churchAt.lat + 0.0003, lng: churchAt.lng} // ~33 m north of the church
    const hits = poisNear([info], me, 300)
    expect(hits[0].name).toBe("Kirche Fehraltorf")
    expect(hits[0].d).toBeGreaterThan(25)
    expect(hits[0].d).toBeLessThan(45)
    expect(Math.round(hits[0].b)).toBe(180)
    expect(poisNear([info], me, 10)).toEqual([])
  })

  test("the address from the map: street, house, district, town (Russian name when the map has one)", () => {
    const h = info.houses.find((x) => x.n === "3")!
    const at = fromWorld(h.x, h.y)
    const a = addressAt([info], {lat: at.lat + 0.00005, lng: at.lng})
    expect(a.house).toBe("3")
    expect(a.street).not.toBe("")
    expect(a.city).toBe("Феральторф")
    expect(addressLine(a)).toBe(`${a.street} 3, ${a.area}, Феральторф`)
    expect(addressLine(null)).toBe("")
  })
})

describe("guide: words", () => {
  test("compass and relative directions", () => {
    expect(compassWord(0)).toBe("на север")
    expect(compassWord(95)).toBe("на восток")
    expect(compassWord(-90)).toBe("на запад")
    expect(relativeWord(90, 0)).toBe("справа")
    expect(relativeWord(0, 0)).toBe("впереди")
    expect(relativeWord(170, 350)).toBe("сзади")
    expect(relativeWord(270, 0)).toBe("слева")
    expect(relativeWord(300, 0)).toBe("впереди слева")
  })

  test("the list for «Что интересного рядом?»", () => {
    const hit = (name: string, d: number, b: number, ru = ""): PoiHit => ({name, ru, cls: "museum", sub: "museum", x: 0, y: 0, score: 3, kind: "музей", lat: 0, lng: 0, d, b})
    const t = aroundText([hit("Kunsthaus", 120, 90, "Кунстхаус Цюрих"), hit("Focus Terra", 15, 0)], 0)
    expect(t).toBe("Рядом интересное:\n• Кунстхаус Цюрих (музей) — 120 м, справа\n• Focus Terra (музей) — прямо здесь")
    expect(aroundText([], null)).toMatch(/нет достопримечательностей/)
  })

  test("voice commands", () => {
    expect(parseGuideCommand("Где я?")).toEqual({kind: "where"})
    expect(parseGuideCommand("ну где я сейчас нахожусь")).toEqual({kind: "where"})
    expect(parseGuideCommand("Какая это улица?")).toEqual({kind: "where"})
    expect(parseGuideCommand("Что интересного рядом?")).toEqual({kind: "around"})
    expect(parseGuideCommand("What's nearby?")).toEqual({kind: "around"})
    expect(parseGuideCommand("Что это за здание?")).toEqual({kind: "what"})
    expect(parseGuideCommand("А что это за церковь справа?")).toEqual({kind: "what"})
    expect(parseGuideCommand("Расскажи про это здание")).toEqual({kind: "what"})
    expect(parseGuideCommand("What is this building?")).toEqual({kind: "what"})
    expect(parseGuideCommand("Включи гида")).toEqual({kind: "auto", on: true})
    expect(parseGuideCommand("Стоп гид")).toEqual({kind: "auto", on: false})
    // ordinary speech is not a command
    expect(parseGuideCommand("где я оставил ключи")).toBeNull()
    expect(parseGuideCommand("что это такое")).toBeNull()
    expect(parseGuideCommand("Ну что интересного?")).toBeNull()
    expect(parseGuideCommand("гид по Риму стоит дорого")).toBeNull()
  })

  test("a question about the place in front of you, in any wording", () => {
    expect(isPlaceQuestion("Когда построили этот собор?")).toBe(true)
    expect(isPlaceQuestion("Что это за памятник?")).toBe(true)
    expect(isPlaceQuestion("Кто архитектор здания напротив?")).toBe(false)
    expect(isPlaceQuestion("Кто построил Эйфелеву башню?")).toBe(false)
    expect(isPlaceQuestion("Этот домашний рецепт хорош?")).toBe(false)
  })
})

describe("guide: what the AI is told", () => {
  test("where you are, which way you walk, what is next to you", () => {
    const hits = poisNear([info], {lat: churchAt.lat + 0.0003, lng: churchAt.lng}, 300)
    const t = placeContext({lat: 47.3873, lng: 8.7523, accuracy: 12}, {street: "Kirchgasse", house: "4", area: "", city: "Феральторф"}, hits, 180)
    expect(t).toContain("точность ±12 м")
    expect(t).toContain("Kirchgasse 4, Феральторф (47.38730, 8.75230)")
    expect(t).toContain("Он идёт на юг.")
    expect(t).toContain("• Kirche Fehraltorf — церковь, 30 м на юг (впереди)")
  })

  test("a note for the walking guide; SKIP means nothing", () => {
    const [hit] = poisNear([info], {lat: churchAt.lat + 0.0003, lng: churchAt.lng}, 300)
    const {system, user} = buildNotePrompt(hit, null, "ru")
    expect(system).toMatch(/SKIP/)
    expect(system).toMatch(/Не выдумывай/)
    expect(user).toContain("Kirche Fehraltorf — церковь.")
    expect(cleanNote("SKIP")).toBeNull()
    expect(cleanNote("  ")).toBeNull()
    expect(cleanNote("Построена в 1500-х; колокольня — XVIII век.")).toBe("Построена в 1500-х; колокольня — XVIII век.")
  })
})

describe("«Гид на прогулке»", () => {
  function env(opts: {busy?: boolean; skip?: boolean} = {}) {
    let t = 1_700_000_000_000
    let onPos: ((p: {lat: number; lng: number; accuracy?: number}) => void) | null = null
    const shown: string[] = []
    const asked: string[] = []
    let busy = opts.busy ?? false
    const g = new WalkGuide({
      around: async (c, r) => ({hits: poisNear([info], c, r), address: null}),
      note: async (hit) => {
        asked.push(hit.name)
        return opts.skip ? null : "Церковь XV века, перестроена в 1800 году."
      },
      show: (title, text) => {
        if (busy) return false
        shown.push(`${title}\n${text}`)
        return true
      },
      log: () => {},
      now: () => t,
      watch: (cb) => {
        onPos = cb
        return () => {
          onPos = null
        }
      },
      onChange: () => {},
    })
    return {
      g,
      shown,
      asked,
      setBusy: (b: boolean) => (busy = b),
      at: async (dLat: number, ms = 15_000, accuracy = 10) => {
        t += ms
        await g.onPosition({lat: churchAt.lat + dLat, lng: churchAt.lng, accuracy})
      },
      watching: () => onPos !== null,
    }
  }

  test("walking toward a church: one note, then nothing more about it", async () => {
    const e = env()
    e.g.start()
    expect(e.watching()).toBe(true)
    await e.at(0.0012) // ~130 m north: too far
    expect(e.shown).toEqual([])
    await e.at(0.0005) // ~55 m north, walking south toward it
    expect(e.g.heading).toBe(180)
    expect(e.shown).toEqual(["Kirche Fehraltorf — 60 м, впереди\nЦерковь XV века, перестроена в 1800 году."])
    await e.at(0.0002, GUIDE_GAP_MS)
    await e.at(-0.0001, GUIDE_GAP_MS)
    expect(e.shown).toHaveLength(1)
    expect(e.g.notes[0].name).toBe("Kirche Fehraltorf")
    e.g.stop()
    expect(e.watching()).toBe(false)
  })

  test("a busy screen: the note waits for the next position", async () => {
    const e = env({busy: true})
    e.g.start()
    await e.at(0.0004)
    expect(e.shown).toEqual([])
    e.setBusy(false)
    await e.at(0.0003)
    expect(e.shown).toHaveLength(1)
  })

  test("nothing reliable to say (SKIP): not asked again; a poor fix is ignored", async () => {
    const e = env({skip: true})
    e.g.start()
    await e.at(0.0004, 15_000, 150)
    expect(e.asked).toEqual([])
    await e.at(0.0004)
    await e.at(0.0001)
    expect(e.asked).toEqual(["Kirche Fehraltorf"])
    expect(e.shown).toEqual([])
  })

  test("a sight already behind you is skipped", async () => {
    const e = env()
    e.g.start()
    await e.at(0.0009) // 100 m north: not close enough yet
    await e.at(-0.0004) // walked past it going south: it is 45 m behind
    expect(e.g.heading).toBe(180)
    expect(e.shown).toEqual([])
  })
})
