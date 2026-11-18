/**
 * The guide: what is around you, read from the OpenStreetMap tiles the phone already keeps for the
 * map (OpenMapTiles layers poi, place, transportation_name, housenumber).
 *
 *   «Где я?»                   → street, house, district — from the map, no AI, works offline
 *   «Что интересного рядом?»   → up to five sights with distance and direction — no AI
 *   «Что это за здание?»       → the AI, told where you are and what is next to you (web search on)
 *   «Гид на прогулке»          → walking past a sight, a short note about it appears by itself
 *
 * The G1 has no camera: «this building» is worked out from the position, the direction of travel
 * and what the map has next to you.
 */
import {decodeTile, fromWorld, metersPerWorld, toWorld} from "../shared/mvt"
import {bearing, distanceM, type LatLng} from "./navmap"
import {formatDistance} from "./navigator"
import {normalize} from "./voice"

// ───────────────────────── map data ─────────────────────────

export interface Poi {
  /** Name as on the map (local language). */
  name: string
  /** Russian name from the map, when it has one (a good sign the place is well known). */
  ru: string
  cls: string
  sub: string
  /** World coordinates (Web Mercator, 0…1). */
  x: number
  y: number
  /** How interesting for a walk: 0 = not at all, 4 = a castle. */
  score: number
  /** «музей», «церковь», «памятник». */
  kind: string
}

export interface PoiHit extends Poi {
  lat: number
  lng: number
  /** Meters from you. */
  d: number
  /** Bearing from you, degrees from north. */
  b: number
}

export interface TileInfo {
  pois: Poi[]
  places: {cls: string; name: string; ru: string; x: number; y: number}[]
  streets: {name: string; p: number[][]}[]
  houses: {n: string; x: number; y: number}[]
}

export interface Address {
  street: string
  house: string
  area: string
  city: string
}

const INFO_LAYERS = new Set(["poi", "place", "transportation_name", "housenumber"])
const INFO_PROPS = new Set(["class", "subclass", "name", "name:ru", "name:en", "name_en", "name:latin", "rank", "housenumber"])

/** OpenMapTiles poi class/subclass → [interest, Russian word]; anything else is not a sight. */
export function poiInterest(cls: string, sub: string): {score: number; kind: string} | null {
  switch (cls) {
    case "castle":
      return sub === "ruins" ? {score: 3.5, kind: "руины"} : {score: 4, kind: "замок"}
    case "museum":
      return {score: 3, kind: "музей"}
    case "monument":
      return {score: 3, kind: "памятник"}
    case "memorial":
      return {score: 2.5, kind: "мемориал"}
    case "attraction":
      return sub === "viewpoint" ? {score: 2, kind: "смотровая площадка"} : {score: 3, kind: "достопримечательность"}
    case "place_of_worship":
      return {
        score: 2.5,
        kind: sub === "christian" ? "церковь" : sub === "jewish" ? "синагога" : sub === "muslim" ? "мечеть" : sub === "buddhist" ? "буддийский храм" : "храм",
      }
    case "zoo":
      return {score: 3, kind: "зоопарк"}
    case "theatre":
      return {score: 2, kind: "театр"}
    case "town_hall":
      return sub === "townhall" ? {score: 2.5, kind: "ратуша"} : sub === "courthouse" ? {score: 1.5, kind: "суд"} : null
    case "college":
      return sub === "university" ? {score: 2, kind: "университет"} : null
    case "art_gallery":
      return sub === "artwork" ? {score: 1.5, kind: "арт-объект"} : sub === "arts_centre" ? {score: 2, kind: "арт-центр"} : sub === "gallery" ? {score: 1, kind: "галерея"} : null
    case "library":
      return sub === "library" ? {score: 1.5, kind: "библиотека"} : null
    case "garden":
      return {score: 1.5, kind: "сад"}
    case "park":
      return sub === "park" ? {score: 1.5, kind: "парк"} : null
    case "cemetery":
      return {score: 1.5, kind: "кладбище"}
    case "stadium":
      return {score: 1.5, kind: "стадион"}
    case "fountain":
      return {score: 1.5, kind: "фонтан"}
    case "railway":
      return sub === "station" ? {score: 1, kind: "вокзал"} : null
  }
  return null
}

/** The guide's view of one tile (decoded once, kept by the tile store). */
export function tileInfo(bytes: Uint8Array, z: number, tx: number, ty: number): TileInfo {
  const tile = decodeTile(bytes, {layers: INFO_LAYERS, props: INFO_PROPS})
  const n = 2 ** z
  const info: TileInfo = {pois: [], places: [], streets: [], houses: []}
  const at = (extent: number, gx: number, gy: number) => ({x: (tx + gx / extent) / n, y: (ty + gy / extent) / n})
  const str = (v: unknown) => (v == null ? "" : String(v).trim())

  const poi = tile.poi
  if (poi) {
    for (const f of poi.features) {
      const name = str(f.props.name) || str(f.props["name:latin"])
      const g = f.geom[0]
      if (!name || !g || g.length < 2) continue
      const cls = str(f.props.class)
      const sub = str(f.props.subclass)
      const it = poiInterest(cls, sub)
      if (!it) continue
      const ru = str(f.props["name:ru"])
      const en = str(f.props["name:en"]) || str(f.props.name_en)
      let score = it.score
      if (ru && ru !== name) score += 1.5 // well known enough to have a Russian name
      else if (en && en !== name) score += 0.3
      const rank = Number(f.props.rank)
      if (Number.isFinite(rank) && rank <= 5) score += 0.3
      info.pois.push({name, ru, cls, sub, ...at(poi.extent, g[0], g[1]), score, kind: it.kind})
    }
  }
  const place = tile.place
  if (place) {
    for (const f of place.features) {
      const name = str(f.props.name) || str(f.props["name:latin"])
      const g = f.geom[0]
      if (!name || !g) continue
      info.places.push({cls: str(f.props.class), name, ru: str(f.props["name:ru"]), ...at(place.extent, g[0], g[1])})
    }
  }
  const tn = tile.transportation_name
  if (tn) {
    for (const f of tn.features) {
      const name = str(f.props.name) || str(f.props["name:latin"])
      if (!name || f.type !== 2) continue
      const s = 1 / (tn.extent * n)
      info.streets.push({
        name,
        p: f.geom.map((line) => {
          const w = new Array<number>(line.length)
          for (let i = 0; i < line.length; i += 2) {
            w[i] = tx / n + line[i] * s
            w[i + 1] = ty / n + line[i + 1] * s
          }
          return w
        }),
      })
    }
  }
  const hn = tile.housenumber
  if (hn) {
    for (const f of hn.features) {
      const num = str(f.props.housenumber)
      const g = f.geom[0]
      if (!num || !g) continue
      info.houses.push({n: num, ...at(hn.extent, g[0], g[1])})
    }
  }
  return info
}

/** Distance from point p to segment ab, all in world units. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Sights within `radius` meters, one per name, most interesting and closest first. */
export function poisNear(infos: TileInfo[], me: LatLng, radius: number): PoiHit[] {
  const w = toWorld(me.lat, me.lng)
  const mpw = metersPerWorld(me.lat)
  const byName = new Map<string, PoiHit>()
  for (const info of infos) {
    for (const p of info.pois) {
      const d = Math.hypot(p.x - w.x, p.y - w.y) * mpw
      if (d > radius) continue
      const key = normalize(p.name)
      const prev = byName.get(key)
      if (prev && prev.d <= d) continue
      const ll = fromWorld(p.x, p.y)
      byName.set(key, {...p, lat: ll.lat, lng: ll.lng, d, b: bearing(me, ll)})
    }
  }
  return [...byName.values()].sort((a, b) => b.score - b.d / 150 - (a.score - a.d / 150))
}

/** Street, house number, district and town at a point, from the map. */
export function addressAt(infos: TileInfo[], me: LatLng): Address {
  const w = toWorld(me.lat, me.lng)
  const mpw = metersPerWorld(me.lat)
  let house: {n: string; x: number; y: number; d: number} | null = null
  for (const info of infos) {
    for (const h of info.houses) {
      const d = Math.hypot(h.x - w.x, h.y - w.y) * mpw
      if (d <= 40 && (!house || d < house.d)) house = {...h, d}
    }
  }
  // the street the house belongs to is the one closest to the house
  const ref = house ?? {x: w.x, y: w.y}
  let street: {name: string; d: number} | null = null
  for (const info of infos) {
    for (const s of info.streets) {
      for (const line of s.p) {
        for (let i = 0; i + 3 < line.length; i += 2) {
          const d = segDist(ref.x, ref.y, line[i], line[i + 1], line[i + 2], line[i + 3]) * mpw
          if (d <= 80 && (!street || d < street.d)) street = {name: s.name, d}
        }
      }
    }
  }
  const nearest = (classes: string[], maxM: number) => {
    let best: {name: string; d: number} | null = null
    for (const info of infos) {
      for (const p of info.places) {
        if (!classes.includes(p.cls)) continue
        const d = Math.hypot(p.x - w.x, p.y - w.y) * mpw
        if (d <= maxM && (!best || d < best.d)) best = {name: p.ru || p.name, d}
      }
    }
    return best?.name ?? ""
  }
  return {
    street: street?.name ?? "",
    house: street && house ? house.n : "",
    area: nearest(["suburb", "quarter", "neighbourhood"], 2500),
    city: nearest(["city", "town", "village"], 15000),
  }
}

/** «Dame Street 12, Temple Bar, Дублин». */
export function addressLine(a: Address | null): string {
  if (!a) return ""
  const street = [a.street, a.house].filter(Boolean).join(" ")
  return [street, a.area, a.city].filter(Boolean).join(", ")
}

// ───────────────────────── directions ─────────────────────────

const COMPASS = ["на север", "на северо-восток", "на восток", "на юго-восток", "на юг", "на юго-запад", "на запад", "на северо-запад"]
const RELATIVE = ["впереди", "впереди справа", "справа", "сзади справа", "сзади", "сзади слева", "слева", "впереди слева"]

/** 90 → «на восток». */
export function compassWord(b: number): string {
  return COMPASS[Math.round((((b % 360) + 360) % 360) / 45) % 8]
}

/** Where a bearing is for someone walking along `heading`: «впереди», «справа», «сзади слева». */
export function relativeWord(b: number, heading: number): string {
  const diff = (((b - heading) % 360) + 360) % 360
  return RELATIVE[Math.round(diff / 45) % 8]
}

/** «120 м, впереди справа» (or «на север» when the direction of travel is unknown). */
export function whereIs(hit: PoiHit, heading: number | null): string {
  const dir = heading == null ? compassWord(hit.b) : relativeWord(hit.b, heading)
  return hit.d < 25 ? "прямо здесь" : `${formatDistance(hit.d)}, ${dir}`
}

/** Display name: the Russian one when the map has it, with the local one after it for signs. */
export function poiTitle(p: Poi): string {
  return p.ru && p.ru !== p.name ? p.ru : p.name
}

/** «Рядом интересное:» list for the glasses. */
export function aroundText(hits: PoiHit[], heading: number | null): string {
  if (!hits.length) return "Рядом на карте нет достопримечательностей.\nСпросите: «Что это за здание?»"
  return ["Рядом интересное:", ...hits.map((h) => `• ${poiTitle(h)} (${h.kind}) — ${whereIs(h, heading)}`)].join("\n")
}

// ───────────────────────── voice ─────────────────────────

export type GuideCommand = {kind: "where"} | {kind: "around"} | {kind: "what"} | {kind: "auto"; on: boolean}

const WHERE = [
  "где я", "где я сейчас", "где я нахожусь", "где я сейчас нахожусь", "где мы", "где мы сейчас", "где мы находимся",
  "какой здесь адрес", "какой тут адрес", "какой это адрес", "мой адрес", "на какой я улице", "на какой мы улице",
  "какая это улица", "что это за улица", "where am i", "where are we", "what street is this", "what is this street",
]
const AROUND = [
  "что рядом", "что есть рядом", "что интересного рядом", "что интересного вокруг", "что вокруг", "что тут интересного",
  "что здесь интересного", "что посмотреть рядом", "что тут посмотреть",
  "что здесь посмотреть", "достопримечательности", "достопримечательности рядом", "какие достопримечательности рядом",
  "what s around", "what is around", "what s nearby", "what is nearby", "anything interesting nearby", "sights nearby",
]
const AUTO_ON = [
  "гид", "включи гида", "включи гид", "режим гида", "гид на прогулке", "включи гид на прогулке", "экскурсия",
  "включи экскурсию", "start guide", "guide mode", "guide on",
]
const AUTO_OFF = [
  "выключи гида", "выключи гид", "стоп гид", "стоп гида", "гид стоп", "хватит гида", "выключи экскурсию",
  "стоп экскурсия", "stop guide", "guide off",
]
const SETS = {
  where: new Set(WHERE.map(normalize)),
  around: new Set(AROUND.map(normalize)),
  on: new Set(AUTO_ON.map(normalize)),
  off: new Set(AUTO_OFF.map(normalize)),
}
const THING =
  "(?:здание|место|дом|домик|памятник|церковь|собор|храм|башня|мост|площадь|статуя|скульптура|замок|дворец|музей|парк|строение|сооружение|монумент|колонна|арка|ворота|особняк|фонтан|театр|костел|костёл|мечеть|синагога)"
const WHAT_RU = new RegExp(
  `^(?:а |и |слушай |скажи )?(?:что|че|чё)(?: это)?(?: за)? ${THING}(?: такое| такая| такой)?(?: перед нами| передо мной| перед мной| рядом| справа| слева| впереди| напротив| тут| здесь)?$`,
)
const ABOUT_RU = new RegExp(`^(?:расскажи|расскажите)(?: мне)? (?:про|о|об) (?:это|этот|эту|этом|этой) ${THING.replace("здание", "здание|здании|месте|памятнике|доме|соборе|храме|мосте")}$`)
const WHAT_EN = /^(?:so |and )?(?:what s|what is|tell me about) (?:this|that) (?:building|place|monument|church|statue|bridge|tower|castle|house)$/

/** «Где я?», «Что интересного рядом?», «Что это за здание?», «Включи гида» (whole utterance). */
export function parseGuideCommand(text: string): GuideCommand | null {
  const n = normalize(String(text ?? "").replace(/[?？!.…]+$/u, ""))
  if (!n) return null
  let words = n.split(" ").filter(Boolean)
  const FILLERS = /^(пожалуйста|ну|так|давай|а|и|окей|ок|please|ok|okay)$/
  while (words.length > 1 && FILLERS.test(words[0])) words = words.slice(1)
  while (words.length > 1 && FILLERS.test(words[words.length - 1])) words = words.slice(0, -1)
  const s = words.join(" ")
  if (SETS.where.has(s)) return {kind: "where"}
  if (SETS.around.has(s)) return {kind: "around"}
  if (SETS.off.has(s)) return {kind: "auto", on: false}
  if (SETS.on.has(s)) return {kind: "auto", on: true}
  if (WHAT_RU.test(s) || ABOUT_RU.test(s) || WHAT_EN.test(s)) return {kind: "what"}
  return null
}

/** A question about the building or place in front of you (asked with the activator, any wording). */
export function isPlaceQuestion(text: string): boolean {
  if (parseGuideCommand(text)?.kind === "what") return true
  const n = normalize(text)
  return new RegExp(`(?:^| )(?:это|этот|эта|этом|этой|перед нами|передо мной|напротив) ${THING}(?: |$)`).test(n) || /\bthis (?:building|place|monument|church)\b/.test(n)
}

// ───────────────────────── prompts ─────────────────────────

/** What the AI is told about where you are and what is next to you. */
export function placeContext(
  me: LatLng & {accuracy?: number},
  address: Address | null,
  hits: PoiHit[],
  heading: number | null,
): string {
  const acc = Number.isFinite(me.accuracy) && me.accuracy! > 0 ? `, точность ±${Math.round(me.accuracy!)} м` : ""
  const where = addressLine(address)
  const lines = [
    `Где пользователь сейчас (GPS телефона${acc}): ${where ? where + " " : ""}(${me.lat.toFixed(5)}, ${me.lng.toFixed(5)}).`,
  ]
  if (heading != null) lines.push(`Он идёт ${compassWord(heading)}.`)
  if (hits.length) {
    lines.push("Рядом на карте (OpenStreetMap):")
    for (const h of hits.slice(0, 8)) {
      const names = h.ru && h.ru !== h.name ? `${h.name} / ${h.ru}` : h.name
      lines.push(`• ${names} — ${h.kind}, ${formatDistance(h.d)} ${compassWord(h.b)}${heading != null ? ` (${relativeWord(h.b, heading)})` : ""}`)
    }
  }
  return lines.join("\n")
}

/** Extra rules for «Что это за здание?». */
export const PLACE_RULES =
  "Пользователь спрашивает о здании или месте рядом с собой. Камеры нет: определи по адресу, координатам, направлению движения и списку объектов рядом, что это вероятнее всего (обычно ближайший заметный объект впереди или рядом). Если вариантов несколько — назови главный и коротко второй. Дай 1–2 интересных факта: когда и кем построено, чем известно. Ищи в интернете, если нужно. Не выдумывай даты и имена: если не уверен — так и скажи. До 50 слов."

/** A short note for the walking guide; SKIP when there is nothing reliable to say. */
export function buildNotePrompt(hit: PoiHit, address: Address | null, lang: "ru" | "en"): {system: string; user: string} {
  const system = [
    "Ты — гид в умных очках. Пользователь гуляет и проходит мимо места, отмеченного на карте. Текст показывается на крошечном дисплее.",
    "Напиши 1–2 самых интересных факта об этом месте: когда и кем построено, чем знаменито, связанная история. Найди сведения в интернете, если нужно.",
    `До 30 слов, на ${lang === "en" ? "английском (English)" : "русском"} языке, без вступлений и без повторения названия.`,
    "Не выдумывай даты, имена и события. Если не знаешь точно, что это за место, или о нём нечего интересно рассказать — ответь ровно SKIP.",
    "Без Markdown.",
  ].join("\n")
  const names = hit.ru && hit.ru !== hit.name ? `${hit.name} (${hit.ru})` : hit.name
  const where = addressLine(address)
  return {
    system,
    user: `${names} — ${hit.kind}.${where ? ` Адрес рядом: ${where}.` : ""} Координаты: ${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}.`,
  }
}

/** The note text, or null for SKIP / nothing. */
export function cleanNote(reply: string): string | null {
  const t = String(reply ?? "").trim()
  if (!t || /^skip\b/i.test(t) || /\bSKIP\s*$/.test(t)) return null
  return t
}

// ───────────────────────── «Гид на прогулке» ─────────────────────────

/** How close a sight must be for a note (meters); very interesting ones a bit farther. */
export const GUIDE_NEAR_M = 70
export const GUIDE_FAR_M = 130
/** Sights at least this interesting get a note. */
export const GUIDE_MIN_SCORE = 2.5
/** Between two notes at least this long. */
export const GUIDE_GAP_MS = 60_000
/** Look again after this much time or this much walking. */
export const GUIDE_CHECK_MS = 12_000
export const GUIDE_CHECK_M = 25
/** A place gets a note once in this long. */
export const GUIDE_REPEAT_MS = 6 * 3600_000

export interface GuideNote {
  t: number
  name: string
  kind: string
  text: string
}

export interface WalkGuideDeps {
  /** Sights around a point (from the map tiles). */
  around(center: LatLng, radius: number): Promise<{hits: PoiHit[]; address: Address | null}>
  /** The AI's short note about a place; null when it has nothing reliable. */
  note(hit: PoiHit, address: Address | null): Promise<string | null>
  /** Show the note on the glasses; false when the screen is busy (an answer, a mode). */
  show(title: string, text: string): boolean
  log(kind: "info" | "error" | "nav", msg: string): void
  now(): number
  watch(onPosition: (p: {lat: number; lng: number; accuracy?: number}) => void): () => void
  onChange(): void
}

export class WalkGuide {
  active = false
  /** Direction of walking from the last positions, degrees; null until you have moved a bit. */
  heading: number | null = null
  notes: GuideNote[] = []
  private stopWatch: (() => void) | null = null
  private prev: LatLng | null = null
  private lastCheck: {at: number; p: LatLng} | null = null
  private lastNoteAt = -Infinity
  private busy = false
  private seen = new Map<string, number>()

  constructor(private readonly deps: WalkGuideDeps) {}

  start(): void {
    if (this.active) return
    this.active = true
    this.prev = null
    this.lastCheck = null
    this.heading = null
    try {
      this.stopWatch = this.deps.watch((p) => void this.onPosition(p))
    } catch (e) {
      this.deps.log("error", `Гид: нет геопозиции (${String((e as Error)?.message ?? e)})`)
    }
    this.deps.log("info", "Гид на прогулке включён: расскажу о местах, мимо которых идёте")
    this.deps.onChange()
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    try {
      this.stopWatch?.()
    } catch {
      // ignore
    }
    this.stopWatch = null
    this.deps.log("info", "Гид на прогулке выключен")
    this.deps.onChange()
  }

  /** Remembers the direction of travel, then looks for a sight now and then. */
  async onPosition(p: {lat: number; lng: number; accuracy?: number}): Promise<void> {
    if (!this.active || !Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) return
    if (Number(p.accuracy) > 60) return // a poor fix would point at the wrong building
    const me = {lat: p.lat, lng: p.lng}
    if (!this.prev) this.prev = me
    else if (distanceM(this.prev, me) >= 12) {
      this.heading = bearing(this.prev, me)
      this.prev = me
    }
    const now = this.deps.now()
    if (this.busy || now - this.lastNoteAt < GUIDE_GAP_MS) return
    if (this.lastCheck && now - this.lastCheck.at < GUIDE_CHECK_MS && distanceM(this.lastCheck.p, me) < GUIDE_CHECK_M) return
    this.lastCheck = {at: now, p: me}
    this.busy = true
    try {
      const {hits, address} = await this.deps.around(me, GUIDE_FAR_M)
      const hit = this.pick(hits)
      if (!hit) return
      const key = `${normalize(hit.name)}@${hit.lat.toFixed(3)},${hit.lng.toFixed(3)}`
      const text = await this.deps.note(hit, address)
      if (!this.active) return
      if (!text) {
        this.seen.set(key, this.deps.now())
        this.deps.log("info", `Гид: о «${hit.name}» рассказать нечего`)
        return
      }
      const title = `${poiTitle(hit)} — ${whereIs(hit, this.heading)}`
      if (!this.deps.show(title, text)) return // the screen is busy: try again on the next fix
      this.seen.set(key, this.deps.now())
      this.lastNoteAt = this.deps.now()
      this.notes.push({t: this.deps.now(), name: poiTitle(hit), kind: hit.kind, text})
      if (this.notes.length > 30) this.notes.splice(0, this.notes.length - 30)
      this.deps.log("info", `Гид: ${poiTitle(hit)} — ${text}`)
      this.deps.onChange()
    } catch (e) {
      this.deps.log("info", `Гид: ${String((e as Error)?.message ?? e)}`)
    } finally {
      this.busy = false
    }
  }

  /** The sight worth a note now: interesting, close, not behind you, not told about recently. */
  pick(hits: PoiHit[]): PoiHit | null {
    const now = this.deps.now()
    let best: {hit: PoiHit; v: number} | null = null
    for (const h of hits) {
      if (h.score < GUIDE_MIN_SCORE) continue
      if (h.d > (h.score >= 4 ? GUIDE_FAR_M : GUIDE_NEAR_M)) continue
      const key = `${normalize(h.name)}@${h.lat.toFixed(3)},${h.lng.toFixed(3)}`
      const at = this.seen.get(key)
      if (at != null && now - at < GUIDE_REPEAT_MS) continue
      if (this.heading != null && h.d > 25) {
        const diff = Math.abs(((h.b - this.heading + 540) % 360) - 180)
        if (diff > 120) continue // already behind
      }
      const v = h.score * 25 - h.d
      if (!best || v > best.v) best = {hit: h, v}
    }
    return best?.hit ?? null
  }
}
