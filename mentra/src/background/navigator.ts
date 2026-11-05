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
}

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

  private trip = 0
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
        this.last = u
        const text = maneuverScreen(u, dest)
        const key = `${u.maneuverType}|${u.nextStepRoad ?? u.toRoad ?? ""}`
        const urgent = u.distanceMeters >= 0 && u.distanceMeters <= URGENT_METERS[this.mode] && u.maneuverType !== "STRAIGHT" && u.maneuverType !== "CONTINUE"
        if (urgent && key !== this.urgentKey) {
          this.urgentKey = key
          this.paint(text, true)
        } else this.paint(text, false)
        break
      }
      case "off_route":
        this.paint(`Вы сошли с маршрута\nПерестраиваю…\n${dest}`, true)
        break
      case "rerouting":
        this.paint(`Перестраиваю маршрут…\n${dest}`, false)
        break
      case "arrived":
        this.deps.log("nav", `Прибытие: ${dest}`)
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
    if (quiet) {
      this.screen = `Маршрут до ${shortPlace(place.name)}\n${modeLabel(mode)}`
      this.deps.onChange()
      return
    }
    this.deps.log("nav", `Маршрут до ${place.name} (${modeLabel(mode)})${place.address ? ", " + place.address : ""}`)
    this.paint(`Маршрут до ${shortPlace(place.name)}\n${modeLabel(mode)}\nСейчас покажу первый поворот`, true)
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
