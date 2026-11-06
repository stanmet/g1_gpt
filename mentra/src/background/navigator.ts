/**
 * Navigator: turn-by-turn directions on the G1 display, by voice («Проведи до Тринити-колледжа»)
 * or from the phone. Mentra does the heavy lifting — place search (its cloud maps service),
 * routing and live maneuvers (its native navigator); this module turns them into short screens:
 *
 *   → Направо через 120 м
 *   на Grafton Street
 *   Trinity College: 850 м, 11 мин
 *
 * Independent of Mentra and of the assistant, so it can be tested with fakes.
 */
import {distanceM, MAP_RADIUS, renderHud, travelHeading, type HudState, type LatLng} from "./navmap"
import type {MapFeature} from "./tiles"
import type {TravelMode} from "./voice"

export type {TravelMode}

export interface Place {
  name: string
  address: string
  lat: number
  lng: number
}

export interface PlaceSuggestion {
  placeId: string
  mainText: string
  secondaryText: string
}

/** Mentra's live trip events (subset of the SDK's NavUpdate). */
export type NavUpdate =
  | {
      kind: "maneuver"
      maneuverType: string
      distanceMeters: number
      nextStepRoad?: string | null
      toRoad?: string | null
      distanceToDestinationMeters?: number
      timeToDestinationSeconds?: number
      instruction?: string | null
    }
  | {kind: "off_route"; offRouteDistanceMeters?: number}
  | {kind: "rerouting"}
  | {kind: "arrived"}
  | {kind: "error"; message: string}

export type NavScreenKind = "message" | "turn" | "route"

/** What Mentra provides: location, place search (its cloud maps service) and the native navigator. */
export interface NavHost {
  /** Why navigation cannot work right now («нет разрешения…»), or "" when it can. */
  problem?(): string
  /** What is around a point for the map (OpenStreetMap vector tiles). */
  roads?(center: LatLng, radius: number, mode: TravelMode): Promise<MapFeature[]>
  /** Save the map along a route on the phone. */
  prefetch?(route: LatLng[]): void
  /** Live position during a trip; returns a function that stops it. */
  watch?(onPosition: (p: {lat: number; lng: number; accuracy?: number}) => void): () => void
  locate(): Promise<{lat: number; lng: number} | null>
  suggest(query: string, near: {lat: number; lng: number} | null): Promise<PlaceSuggestion[]>
  details(placeId: string): Promise<Place | null>
  start(place: Place, mode: TravelMode): Promise<{ok: boolean; error?: string}>
  stop(): void
}

/** The trip as saved on the phone, so a restarted app picks it up again. */
export interface NavTrip {
  dest: Place
  mode: TravelMode
  startedAt: number
}

export interface NavigatorDeps {
  /** Place search for a spoken or typed destination; null when nothing was found. */
  search(query: string): Promise<Place | null>
  start(place: Place, mode: TravelMode): Promise<{ok: boolean; error?: string}>
  stop(): void
  /**
   * Shows a navigator screen. message: reply to a command (searching, errors) — shown for a while;
   * turn: a turn is close — over whatever is on screen; route: the regular route screen.
   */
  screen(text: string, kind: NavScreenKind): void
  log(kind: "nav" | "error" | "info", msg: string): void
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(id: unknown): void
  onChange(): void
  /** Saves the running trip (null when it ends). */
  save(trip: NavTrip | null): void
  /** The trip is over: the route screen should go away. */
  ended(): void
  /** Setting «Карта на очках»: the route screen is a picture with a map (like the Even app). */
  mapOn?(): boolean
  /** What is around a point for the map: roads, water, parks, buildings (map tiles). */
  roads?(center: LatLng, radius: number, mode: TravelMode): Promise<MapFeature[]>
  /** The route is known: save the map along it on the phone. */
  prefetch?(route: LatLng[]): void
  /** Live position during a trip; returns a function that stops it. */
  watch?(onPosition: (p: {lat: number; lng: number; accuracy?: number}) => void): () => void
}

/** The map picture is redrawn at most this often (a G1 picture is ~10 KB over Bluetooth, ~1 s). */
const MAP_FRAME_MS: Record<TravelMode, number> = {walking: 4000, cycling: 3000, driving: 3000}
/** …or this soon when the next turn changes. */
const MAP_FRAME_SOON_MS = 1500
/** Streets are reloaded when you are this far (share of the loaded radius) from where they were loaded. */
const ROADS_RELOAD_SHARE = 0.45
const ROADS_RETRY_MS = 20_000
const ROADS_FAIL_RETRY_MS = 90_000

/** How close a turn must be to be shown over other content, by travel mode. */
const URGENT_METERS: Record<TravelMode, number> = {walking: 30, cycling: 60, driving: 200}
/** Screens with the same text are not resent; changed screens at most this often (BLE is slow). */
const MIN_REPAINT_MS = 1500
/** After arrival the trip ends by itself. */
const ARRIVED_STOP_MS = 15_000

const MODE_RU: Record<TravelMode, string> = {walking: "пешком", driving: "на машине", cycling: "на велосипеде"}

export function modeLabel(m: TravelMode): string {
  return MODE_RU[m]
}

/** 37 → «40 м», 123 → «120 м», 640 → «650 м», 1234 → «1,2 км». */
export function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return ""
  if (m < 200) return `${Math.max(10, Math.round(m / 10) * 10)} м`
  if (m < 1000) return `${Math.round(m / 50) * 50} м`
  return `${(Math.round(m / 100) / 10).toString().replace(".", ",")} км`
}

/** 660 → «11 мин», 3900 → «1 ч 5 мин». */
export function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s < 0) return ""
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest ? `${h} ч ${rest} мин` : `${h} ч`
}

/** Arrow and Russian wording for Mentra's maneuver types. */
export function turnPhrase(type: string): {arrow: string; text: string} {
  switch (type) {
    case "TURN_LEFT":
      return {arrow: "←", text: "Налево"}
    case "TURN_RIGHT":
      return {arrow: "→", text: "Направо"}
    case "SLIGHT_LEFT":
      return {arrow: "←", text: "Левее"}
    case "SLIGHT_RIGHT":
      return {arrow: "→", text: "Правее"}
    case "SHARP_LEFT":
      return {arrow: "←", text: "Резко налево"}
    case "SHARP_RIGHT":
      return {arrow: "→", text: "Резко направо"}
    case "U_TURN":
      return {arrow: "↓", text: "Развернитесь"}
    case "CROSS_STREET":
      return {arrow: "↑", text: "Перейдите улицу"}
    case "ARRIVE":
      return {arrow: "•", text: "Прибытие"}
    case "DEPART":
      return {arrow: "↑", text: "Начните движение"}
    default:
      return {arrow: "↑", text: "Прямо"}
  }
}

/** The three-line screen for a maneuver. */
export function maneuverScreen(u: Extract<NavUpdate, {kind: "maneuver"}>, dest: string): string {
  const {arrow, text} = turnPhrase(u.maneuverType)
  const d = formatDistance(u.distanceMeters)
  const straight = text === "Прямо"
  const first =
    u.distanceMeters >= 0 && u.distanceMeters <= 15 && !straight
      ? `${arrow} ${text} сейчас`
      : d
        ? straight
          ? `${arrow} Прямо ${d}`
          : `${arrow} ${text} через ${d}`
        : `${arrow} ${text}`
  const road = (u.nextStepRoad || u.toRoad || "").trim()
  const lines = [first]
  if (road) lines.push(`на ${road}`)
  const left = [formatDistance(u.distanceToDestinationMeters ?? -1), formatDuration(u.timeToDestinationSeconds ?? -1)].filter(Boolean)
  lines.push(left.length ? `${dest}: ${left.join(", ")}` : dest)
  return lines.join("\n")
}

/** Long place names are cut on the glasses: «Trinity College Dublin, the University…» → «Trinity College Dublin». */
export function shortPlace(name: string, max = 26): string {
  const n = String(name ?? "").replace(/\s+/g, " ").trim()
  if (n.length <= max) return n
  const cut = n.split(/,|\s[-–—]\s/)[0].trim()
  if (cut.length <= max) return cut
  const words = cut.split(" ")
  let out = ""
  for (const w of words) {
    if ((out ? out.length + 1 : 0) + w.length > max - 1) break
    out = out ? `${out} ${w}` : w
  }
  return `${out || cut.slice(0, max - 1)}…`
}

/**
 * A place said in Russian («Тринити-колледжа», «ближайшей аптеки») → what to type into the map
 * search near the user («Trinity College Dublin», «pharmacy»). Speech recognition mangles names,
 * and the map service only knows them in the local language, in the nominative case.
 */
export function buildMapQueryPrompt(query: string, near: {lat: number; lng: number} | null): {system: string; user: string} {
  const system = [
    "Ты помогаешь навигатору. Пользователь голосом назвал место, куда хочет попасть; распознавание речи могло исказить название.",
    "Верни одну строку для поиска на карте рядом с пользователем:",
    "— название места так, как оно написано на картах в этой стране (в Ирландии, Англии, США — по-английски), в именительном падеже;",
    "— для адреса — адрес на местном языке;",
    "— для типа места («аптека», «ближайшее кафе») — тип места на местном языке (pharmacy, cafe).",
    "Только строка поиска, без кавычек и пояснений.",
  ].join("\n")
  const where = near ? `\nПользователь сейчас у точки ${near.lat.toFixed(3)}, ${near.lng.toFixed(3)}.` : ""
  return {system, user: `Место: ${query}${where}`}
}

export function cleanMapQuery(reply: string): string {
  const line = String(reply ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean)
  if (!line) return ""
  return line
    .replace(/^(?:строка поиска|поиск|запрос|query)\s*:\s*/iu, "")
    .replace(/[.。]+$/u, "")
    .replace(/^[«"“„'`]+|[»"”'`]+$/gu, "")
    .replace(/[.。]+$/u, "")
    .trim()
    .slice(0, 80)
}

/** Mentra's errors, in words a user can act on. */
export function explainNavError(raw: unknown): string {
  const e = String(raw ?? "").trim()
  if (!e) return "ошибка навигации"
  if (/LOCATION permission not declared/i.test(e)) return "нет разрешения на геопозицию — переустановите мини‑приложение"
  if (/not granted|denied/i.test(e)) return "нет доступа к геопозиции — разрешите Mentra доступ к местоположению в настройках iPhone"
  if (/no GPS fix|location/i.test(e)) return "не удалось определить, где вы (GPS)"
  if (/disabled by this deployment|not configured|NOT_IMPLEMENTED/i.test(e)) return "навигация недоступна в этой версии Mentra"
  if (/terms|T&C|accept/i.test(e)) return "примите условия навигации в Mentra"
  if (/timeout|timed out/i.test(e)) return "Mentra не ответила вовремя"
  return e.slice(0, 120)
}

export class Navigator {
  active = false
  dest: Place | null = null
  mode: TravelMode = "walking"
  /** The route screen (kept on the glasses during a trip). */
  screen = ""
  /** The last message (searching, not found, errors), for the phone. */
  message = ""
  last: Extract<NavUpdate, {kind: "maneuver"}> | null = null
  /** A search or start is in progress. */
  busy = false
  // the map
  route: LatLng[] = []
  me: LatLng | null = null
  /** Direction of travel, degrees from north. */
  heading: number | null = null
  roads: MapFeature[] = []
  roadsVersion = 0
  /** The navigation screen as a G1 picture (base64 BMP), "" until drawn. */
  frame = ""
  frameId = 0

  private trip = 0
  private anchor: LatLng | null = null
  private pendingRoute: LatLng[] | null = null
  private hudMessage = ""
  private roadsCenter: LatLng | null = null
  private roadsMode: TravelMode | null = null
  private roadsBusy = false
  private roadsNextTry = 0
  private roadsFailed = false
  private frameAt = 0
  private frameTimer: unknown = null
  private unwatch: (() => void) | null = null
  private lastPaint = 0
  private paintTimer: unknown = null
  private pendingText = ""
  private urgentKey = ""
  private arrivedTimer: unknown = null

  constructor(private readonly deps: NavigatorDeps) {}

  /** Search a spoken destination and start the trip. */
  async go(query: string, mode: TravelMode): Promise<void> {
    const trip = ++this.trip
    this.busy = true
    this.say(`Ищу: ${query}…`)
    let place: Place | null = null
    try {
      place = await this.deps.search(query)
    } catch (e) {
      if (trip !== this.trip) return
      this.busy = false
      return this.fail(`Поиск не удался: ${explainNavError((e as Error)?.message ?? e)}`)
    }
    if (trip !== this.trip) return
    if (!place) {
      this.busy = false
      return this.fail(`Не нашёл «${query}». Скажите название точнее.`)
    }
    await this.startTrip(place, mode, trip)
  }

  /** Start to a place picked in the app. */
  async goTo(place: Place, mode: TravelMode): Promise<void> {
    const trip = ++this.trip
    this.busy = true
    this.deps.onChange()
    await this.startTrip(place, mode, trip)
  }

  /**
   * The app was restarted during a trip that Mentra's navigator still runs: starting again to the
   * same place re-attaches to it (Mentra answers «resumed»), and the turns come back.
   */
  async resume(t: NavTrip): Promise<void> {
    const trip = ++this.trip
    this.busy = true
    this.deps.log("nav", `Продолжаю маршрут до ${t.dest.name}`)
    await this.startTrip(t.dest, t.mode, trip, true)
  }

  stop(reason: "voice" | "ui" | "arrived" | "error" = "voice"): void {
    this.trip++
    const wasBusy = this.busy
    this.busy = false
    if (this.arrivedTimer != null) this.deps.clearTimer(this.arrivedTimer)
    this.arrivedTimer = null
    if (this.paintTimer != null) this.deps.clearTimer(this.paintTimer)
    this.paintTimer = null
    this.pendingRoute = null
    this.endMap()
    if (!this.active) {
      if (wasBusy) {
        this.message = ""
        this.deps.log("nav", "Поиск маршрута отменён")
        this.deps.onChange()
      }
      return
    }
    this.active = false
    try {
      this.deps.stop()
    } catch {
      // host gone
    }
    this.deps.log("nav", `Маршрут завершён${reason === "arrived" ? " — вы на месте" : reason === "ui" ? " с телефона" : ""}`)
    this.deps.save(null)
    this.screen = ""
    this.last = null
    this.deps.ended()
    this.deps.onChange()
  }

  /** «850 м, 11 мин» — what is left of the trip, "" before the first update. */
  left(): string {
    const u = this.last
    if (!this.active || !u) return ""
    return [formatDistance(u.distanceToDestinationMeters ?? -1), formatDuration(u.timeToDestinationSeconds ?? -1)].filter(Boolean).join(", ")
  }

  /** «Сколько осталось?» */
  status(): string {
    if (!this.active || !this.dest) return "Маршрута нет."
    const left = this.left()
    const name = shortPlace(this.dest.name)
    return left ? `${name}\nОсталось ${left}` : `${name}\nСчитаю маршрут…`
  }

  /** A live event from Mentra's navigator. */
  onUpdate(u: NavUpdate): void {
    // busy with a new destination: the old trip's last events are not shown
    if (!this.active || !this.dest || this.busy) return
    const dest = shortPlace(this.dest.name)
    switch (u?.kind) {
      case "maneuver": {
        const prevKey = this.last ? `${this.last.maneuverType}|${this.last.nextStepRoad ?? this.last.toRoad ?? ""}` : ""
        this.last = u
        this.hudMessage = ""
        const text = maneuverScreen(u, dest)
        const key = `${u.maneuverType}|${u.nextStepRoad ?? u.toRoad ?? ""}`
        this.hud(key !== prevKey)
        const urgent = u.distanceMeters >= 0 && u.distanceMeters <= URGENT_METERS[this.mode] && u.maneuverType !== "STRAIGHT" && u.maneuverType !== "CONTINUE"
        if (urgent && key !== this.urgentKey) {
          this.urgentKey = key
          this.paint(text, true)
        } else this.paint(text, false)
        break
      }
      case "off_route":
        this.hudMessage = "Вы сошли с маршрута. Перестраиваю…"
        this.hud(true)
        this.paint(`Вы сошли с маршрута\nПерестраиваю…\n${dest}`, true)
        break
      case "rerouting":
        this.hudMessage = "Перестраиваю маршрут…"
        this.hud(true)
        this.paint(`Перестраиваю маршрут…\n${dest}`, false)
        break
      case "arrived":
        this.deps.log("nav", `Прибытие: ${dest}`)
        this.hudMessage = `Вы на месте: ${dest}`
        this.hud(true)
        this.paint(`Вы на месте\n${dest}`, true)
        if (this.arrivedTimer == null) {
          this.arrivedTimer = this.deps.setTimer(() => {
            this.arrivedTimer = null
            this.stop("arrived")
          }, ARRIVED_STOP_MS)
        }
        break
      case "error":
        // Mentra ends the trip on an error
        this.stop("error")
        this.fail(`Навигация остановлена: ${explainNavError(u.message)}`)
        break
    }
  }

  // ── internals ──

  private async startTrip(place: Place, mode: TravelMode, trip: number, quiet = false): Promise<void> {
    if (!quiet) this.say(`Маршрут до ${shortPlace(place.name)}\n${modeLabel(mode)}…`)
    if (this.active) {
      // Mentra would re-attach to a running trip instead of starting a new one
      this.active = false
      this.last = null
      try {
        this.deps.stop()
      } catch {
        // host gone
      }
      this.deps.log("nav", "Прежний маршрут завершён")
    }
    let res: {ok: boolean; error?: string}
    try {
      res = await this.deps.start(place, mode)
    } catch (e) {
      res = {ok: false, error: String((e as Error)?.message ?? e)}
    }
    if (trip !== this.trip) return
    this.busy = false
    if (!res.ok) {
      this.endMap()
      this.deps.save(null)
      if (!quiet) return this.fail(`Маршрут не построен: ${explainNavError(res.error)}`)
      this.deps.log("info", `Прежний маршрут не продолжен: ${explainNavError(res.error)}`)
      this.deps.onChange()
      return
    }
    this.active = true
    this.dest = place
    this.mode = mode
    this.last = null
    this.urgentKey = ""
    this.message = ""
    this.deps.save({dest: place, mode, startedAt: this.deps.now()})
    this.startMap()
    if (quiet) {
      this.screen = `Маршрут до ${shortPlace(place.name)}\n${modeLabel(mode)}`
      this.deps.onChange()
      return
    }
    this.deps.log("nav", `Маршрут до ${place.name} (${modeLabel(mode)})${place.address ? ", " + place.address : ""}`)
    this.paint(`Маршрут до ${shortPlace(place.name)}\n${modeLabel(mode)}\nСейчас покажу первый поворот`, true)
    this.deps.onChange()
  }

  // ── the map ──

  /** Mentra's route polyline (on start and after every reroute). */
  onRoute(points: LatLng[]): void {
    const pts = (Array.isArray(points) ? points : []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    if (pts.length < 2) return
    if (this.busy) {
      this.pendingRoute = pts // the trip is starting: Mentra sends the route just before it confirms
      return
    }
    if (!this.active) return
    this.route = pts.map((p) => ({lat: p.lat, lng: p.lng}))
    this.prefetch()
    this.maybeLoadRoads()
    this.hud(true)
    this.deps.onChange()
  }

  /** A position fix during the trip. */
  onPosition(p: {lat: number; lng: number; accuracy?: number}): void {
    if (!this.active || !Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) return
    const me = {lat: p.lat, lng: p.lng}
    const h = travelHeading(this.route, me, this.anchor)
    if (h != null) this.heading = h
    if (!this.anchor || distanceM(this.anchor, me) > 8) this.anchor = me
    this.me = me
    this.maybeLoadRoads()
    this.hud(false)
  }

  /** The setting «Карта на очках» changed. */
  mapChanged(): void {
    if (!this.active) return
    if (this.mapOn()) {
      this.maybeLoadRoads()
      this.hud(true)
    } else {
      this.cancelFrameTimer()
      this.frame = ""
      this.deps.onChange()
    }
  }

  private mapOn(): boolean {
    try {
      return Boolean(this.deps.mapOn?.())
    } catch {
      return false
    }
  }

  private startMap(): void {
    this.route = this.pendingRoute ?? []
    this.pendingRoute = null
    this.me = null
    this.anchor = null
    this.heading = null
    this.hudMessage = ""
    this.frame = ""
    this.frameAt = 0
    try {
      this.unwatch?.()
    } catch {
      // ignore
    }
    try {
      this.unwatch = this.deps.watch?.((p) => this.onPosition(p)) ?? null
    } catch (e) {
      this.unwatch = null
      this.deps.log("info", `Геопозиция для карты: ${explainNavError((e as Error)?.message ?? e)}`)
    }
    this.prefetch()
    this.maybeLoadRoads()
    this.hud(true)
  }

  /** Saves the map along the route on the phone, so it works if the connection drops later. */
  private prefetch(): void {
    if (!this.mapOn() || this.route.length < 2) return
    try {
      this.deps.prefetch?.(this.route)
    } catch {
      // the map just loads as you go
    }
  }

  private endMap(): void {
    this.cancelFrameTimer()
    try {
      this.unwatch?.()
    } catch {
      // ignore
    }
    this.unwatch = null
    this.route = []
    this.me = null
    this.anchor = null
    this.heading = null
    this.hudMessage = ""
    this.frame = ""
  }

  /** Streets around where you are, loaded again when you move away from them. */
  private maybeLoadRoads(): void {
    if (!this.deps.roads || !this.mapOn() || this.roadsBusy || !this.active) return
    const center = this.me ?? this.route[0] ?? (this.dest ? {lat: this.dest.lat, lng: this.dest.lng} : null)
    if (!center) return
    const radius = MAP_RADIUS[this.mode]
    const near = this.roadsCenter && this.roadsMode === this.mode && distanceM(this.roadsCenter, center) < radius * ROADS_RELOAD_SHARE
    if (near) return
    const now = this.deps.now()
    if (now < this.roadsNextTry) return
    this.roadsBusy = true
    this.roadsNextTry = now + ROADS_RETRY_MS
    const mode = this.mode
    this.deps
      .roads(center, radius, mode)
      .then((roads) => {
        this.roads = roads
        this.roadsCenter = center
        this.roadsMode = mode
        this.roadsVersion++
        if (this.roadsFailed || this.roadsVersion === 1) this.deps.log("nav", `Карта вокруг загружена: ${roads.length} объектов`)
        this.roadsFailed = false
        this.hud(false)
        this.deps.onChange()
      })
      .catch((e) => {
        this.roadsNextTry = this.deps.now() + ROADS_FAIL_RETRY_MS
        if (!this.roadsFailed) this.deps.log("info", `Карта: ${String((e as Error)?.message ?? e).slice(0, 90)} — показываю только маршрут`)
        this.roadsFailed = true
      })
      .finally(() => {
        this.roadsBusy = false
      })
  }

  /** Redraw the map picture soon; `soon` = the next turn changed. */
  private hud(soon: boolean): void {
    if (!this.active || !this.mapOn()) return
    const wait = this.frameAt + (soon ? MAP_FRAME_SOON_MS : MAP_FRAME_MS[this.mode]) - this.deps.now()
    if (wait <= 0) {
      this.cancelFrameTimer()
      this.renderFrame()
      return
    }
    if (soon) this.cancelFrameTimer()
    if (this.frameTimer == null) {
      this.frameTimer = this.deps.setTimer(() => {
        this.frameTimer = null
        this.renderFrame()
      }, wait)
    }
  }

  private cancelFrameTimer(): void {
    if (this.frameTimer != null) this.deps.clearTimer(this.frameTimer)
    this.frameTimer = null
  }

  /** What the picture shows now. */
  hudState(): HudState | null {
    if (!this.dest) return null
    const u = this.last
    const name = shortPlace(this.dest.name)
    return {
      maneuver: u?.maneuverType ?? null,
      distance: u ? formatDistance(u.distanceMeters) : "",
      verb: u ? turnPhrase(u.maneuverType).text : "",
      road: (u?.nextStepRoad || u?.toRoad || "").trim(),
      left: [this.left().replace(", ", " · "), name].filter(Boolean).join(" · "),
      message: this.hudMessage || (u ? undefined : `Маршрут до ${name}, ${modeLabel(this.mode)}`),
      me: this.me,
      heading: this.heading,
      route: this.route,
      features: this.roads,
      dest: {lat: this.dest.lat, lng: this.dest.lng},
      mode: this.mode,
    }
  }

  private renderFrame(): void {
    if (!this.active || !this.mapOn()) return
    const state = this.hudState()
    if (!state) return
    let frame: string
    try {
      frame = renderHud(state)
    } catch (e) {
      this.deps.log("error", `Карта: не нарисовалась (${String((e as Error)?.message ?? e)})`)
      return
    }
    this.frameAt = this.deps.now()
    if (frame === this.frame) return
    this.frame = frame
    this.frameId++
    // the assistant puts the picture on the glasses when nothing else is shown there
    this.deps.screen(this.screen, "route")
    this.deps.onChange()
  }

  private fail(msg: string): void {
    this.deps.log("error", msg)
    this.say(msg)
  }

  /** Searching, starting, errors: shown at once, they answer what was just said. */
  private say(text: string): void {
    this.message = text
    this.deps.screen(text, "message")
    this.deps.onChange()
  }

  private show(text: string, urgent: boolean): void {
    this.screen = text
    this.lastPaint = this.deps.now()
    this.deps.screen(text, urgent ? "turn" : "route")
  }

  /** Live screens: urgent ones at once, the rest no more often than MIN_REPAINT_MS. */
  private paint(text: string, urgent: boolean): void {
    if (text === this.screen && !urgent) return
    const now = this.deps.now()
    if (urgent || now - this.lastPaint >= MIN_REPAINT_MS) {
      if (this.paintTimer != null) this.deps.clearTimer(this.paintTimer)
      this.paintTimer = null
      this.show(text, urgent)
      this.deps.onChange()
      return
    }
    this.pendingText = text
    if (this.paintTimer == null) {
      this.paintTimer = this.deps.setTimer(() => {
        this.paintTimer = null
        if (this.active && this.pendingText && this.pendingText !== this.screen) {
          this.show(this.pendingText, false)
          this.deps.onChange()
        }
      }, MIN_REPAINT_MS - (now - this.lastPaint))
    }
  }
}
