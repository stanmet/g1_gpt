/**
 * What a question to the AI is told besides the question itself: the weather (Open-Meteo, no key)
 * when it is about the weather, and the phone calendar when it is about plans. Each is added only
 * when the question needs it, so ordinary questions stay as fast as before.
 * Pure functions; the fetching is done by the host (index.ts).
 */
import {normalize, type Lang} from "./voice"

// ───────────────────────── weather ─────────────────────────

const WEATHER_WORDS =
  /(?:^| )(?:погод|дожд|зонт|снег|снеж|градус|температур|прогноз|осадк|гроз|ливн|ливен|туман|мороз|ветр|ветер|холодн|жарк|жара|солнечн|пасмурн|облачн|гололед|куртк|что надеть|во что одеться|weather|rain|umbrella|snow|forecast|temperature|degrees|windy|sunny|cloudy|jacket)/

/** True when the question is about the weather (or what to wear). */
export function needsWeather(q: string): boolean {
  return WEATHER_WORDS.test(normalize(q))
}

/** Words after «в …» that are times or ordinary places, not towns. */
const NOT_A_PLACE = new Set([
  "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье", "выходные", "обед", "полдень",
  "полночь", "течение", "ближайшие", "ближайший", "час", "часов", "часа", "минуту", "городе", "центре", "офисе", "парке",
  "районе", "горах", "лесу", "поле", "доме", "квартире", "машине", "дороге", "пути", "мае", "июне", "июле", "августе",
  "сентябре", "октябре", "ноябре", "декабре", "январе", "феврале", "марте", "апреле", "этом", "этот", "эту", "следующем",
  "следующие", "следующую", "среднем", "целом", "общем", "итоге", "принципе", "любом", "той", "том", "this", "the",
  "next", "general", "morning", "evening", "afternoon",
])

const TIME_TAIL =
  /\s+(?:сегодня|завтра|послезавтра|сейчас|утром|днем|днём|вечером|ночью|на выходных|на неделе|на этой неделе|на следующей неделе|today|tomorrow|tonight|now|this week|next week|this weekend)\b.*$/iu

/**
 * The town named in a weather question, as said: «погода в Москве» → «Москве», «weather in London
 * tomorrow» → «London»; null when no town is named (then it is the weather where you are).
 */
export function weatherPlace(q: string): string | null {
  const t = String(q ?? "")
    .replace(/[?？!.…,]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  const m = /(?:^|\s)(?:в|во|на|in|at|for)\s+((?:[A-ZА-ЯЁ][\p{L}'’-]*)(?:[\s-]+[A-ZА-ЯЁ][\p{L}'’-]*){0,2})/u.exec(t)
  if (!m) return null
  const place = m[1].replace(TIME_TAIL, "").trim()
  const first = normalize(place.split(/\s+/)[0] ?? "")
  if (!place || NOT_A_PLACE.has(first) || /^\d/.test(place)) return null
  return place
}

/**
 * Spellings to look a town up by: the Russian locative turned back into the name
 * («Москве» → «Москва», «Лондоне» → «Лондон», «Казани» → «Казань»), then the word as said.
 */
export function placeVariants(place: string): string[] {
  const words = place.trim().split(/\s+/)
  const last = words.pop() ?? ""
  const head = words.length ? words.join(" ") + " " : ""
  const out: string[] = []
  const add = (w: string) => {
    const v = (head + w).trim()
    if (v.length >= 2 && !out.includes(v)) out.push(v)
  }
  if (/[а-яё]$/i.test(last)) {
    if (/ии$/i.test(last)) add(last.replace(/ии$/i, "ия"))
    if (/е$/i.test(last)) {
      add(last.replace(/е$/i, "")) // Лондоне → Лондон, Париже → Париж
      add(last.replace(/е$/i, "а")) // Москве → Москва, Праге → Прага, Ялте → Ялта
    }
    if (/и$/i.test(last) && !/ии$/i.test(last)) add(last.replace(/и$/i, "ь")) // Казани → Казань
    if (/ах$/i.test(last)) add(last.replace(/ах$/i, "ы")) // Чебоксарах → Чебоксары
    if (/ях$/i.test(last)) add(last.replace(/ях$/i, "и")) // Мытищах… → Мытищи
  }
  add(last)
  return out
}

export function openMeteoUrl(lat: number, lng: number): string {
  const r = (v: number) => Math.round(v * 100) / 100
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${r(lat)}&longitude=${r(lng)}` +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m" +
    "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset" +
    "&timezone=auto&forecast_days=3&wind_speed_unit=ms"
  )
}

export function geocodeUrl(name: string, lang: Lang): string {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=${lang}&format=json`
}

export interface GeoPlace {
  name: string
  country: string
  lat: number
  lng: number
}

/** The best town from an Open-Meteo geocoding answer: the exact name, else the most populous. */
export function pickGeocode(data: any, wanted: string): GeoPlace | null {
  const list: any[] = Array.isArray(data?.results) ? data.results : []
  if (!list.length) return null
  const w = normalize(wanted)
  const exact = list.filter((r) => normalize(String(r?.name ?? "")) === w)
  const pool = exact.length ? exact : list
  const best = [...pool].sort((a, b) => (Number(b?.population) || 0) - (Number(a?.population) || 0))[0]
  const lat = Number(best?.latitude)
  const lng = Number(best?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {name: String(best.name ?? wanted), country: String(best.country ?? ""), lat, lng}
}

/** WMO weather codes in words. */
export function weatherWord(code: number, lang: Lang = "ru"): string {
  const ru: [number[], string][] = [
    [[0], "ясно"], [[1], "в основном ясно"], [[2], "переменная облачность"], [[3], "пасмурно"], [[45, 48], "туман"],
    [[51, 53, 55], "морось"], [[56, 57], "ледяная морось"], [[61], "слабый дождь"], [[63], "дождь"], [[65], "сильный дождь"],
    [[66, 67], "ледяной дождь"], [[71], "слабый снег"], [[73], "снег"], [[75], "сильный снег"], [[77], "снежная крупа"],
    [[80], "ливень"], [[81], "ливни"], [[82], "сильные ливни"], [[85, 86], "снегопад"], [[95], "гроза"], [[96, 99], "гроза с градом"],
  ]
  const en: [number[], string][] = [
    [[0], "clear"], [[1], "mainly clear"], [[2], "partly cloudy"], [[3], "overcast"], [[45, 48], "fog"],
    [[51, 53, 55], "drizzle"], [[56, 57], "freezing drizzle"], [[61], "light rain"], [[63], "rain"], [[65], "heavy rain"],
    [[66, 67], "freezing rain"], [[71], "light snow"], [[73], "snow"], [[75], "heavy snow"], [[77], "snow grains"],
    [[80], "showers"], [[81], "showers"], [[82], "heavy showers"], [[85, 86], "snow showers"], [[95], "thunderstorm"], [[96, 99], "thunderstorm with hail"],
  ]
  for (const [codes, word] of lang === "en" ? en : ru) if (codes.includes(code)) return word
  return lang === "en" ? `code ${code}` : `код ${code}`
}

const hm = (iso: string) => String(iso ?? "").slice(11, 16)
const round = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null)
const one = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null)

/**
 * Open-Meteo forecast → a few lines for the AI: now, the next hours, today and the next two days.
 * Times are local to the place (timezone=auto).
 */
export function formatWeather(data: any, place: string): string {
  const c = data?.current ?? {}
  const lines: string[] = []
  const now = String(c.time ?? "")
  const parts = [
    round(c.temperature_2m) != null ? `${round(c.temperature_2m)} °C` : "",
    round(c.apparent_temperature) != null ? `ощущается как ${round(c.apparent_temperature)} °C` : "",
    Number.isFinite(Number(c.weather_code)) ? weatherWord(Number(c.weather_code)) : "",
    one(c.wind_speed_10m) != null ? `ветер ${one(c.wind_speed_10m)} м/с${one(c.wind_gusts_10m) != null ? ` (порывы ${one(c.wind_gusts_10m)})` : ""}` : "",
    one(c.precipitation) ? `осадки ${one(c.precipitation)} мм` : "",
  ].filter(Boolean)
  lines.push(`Погода${place ? ` — ${place}` : ""} (Open-Meteo), сейчас${now ? ` ${hm(now)}` : ""}: ${parts.join(", ")}.`)

  const h = data?.hourly ?? {}
  const times: string[] = Array.isArray(h.time) ? h.time : []
  const start = now ? times.findIndex((t) => t > now) : -1
  if (start >= 0) {
    const next: string[] = []
    for (let i = start; i < Math.min(times.length, start + 12); i += 2) {
      const p = round(h.precipitation_probability?.[i])
      const code = Number(h.weather_code?.[i])
      next.push(`${hm(times[i])} ${round(h.temperature_2m?.[i]) ?? "?"}°${p != null ? ` ${p}%` : ""}${Number.isFinite(code) && code >= 51 ? ` ${weatherWord(code)}` : ""}`)
    }
    if (next.length) lines.push(`Ближайшие часы (температура, вероятность осадков): ${next.join(" · ")}.`)
  }

  const d = data?.daily ?? {}
  const days: string[] = Array.isArray(d.time) ? d.time : []
  const names = ["Сегодня", "Завтра", "Послезавтра"]
  days.slice(0, 3).forEach((day, i) => {
    const p = round(d.precipitation_probability_max?.[i])
    const sum = one(d.precipitation_sum?.[i])
    const bits = [
      `${round(d.temperature_2m_min?.[i]) ?? "?"}…${round(d.temperature_2m_max?.[i]) ?? "?"} °C`,
      Number.isFinite(Number(d.weather_code?.[i])) ? weatherWord(Number(d.weather_code[i])) : "",
      p != null ? `осадки ${p}%${sum ? `, ${sum} мм` : ""}` : "",
      one(d.wind_speed_10m_max?.[i]) != null ? `ветер до ${one(d.wind_speed_10m_max[i])} м/с` : "",
      i === 0 && d.sunrise?.[0] ? `восход ${hm(d.sunrise[0])}, закат ${hm(d.sunset?.[0])}` : "",
    ].filter(Boolean)
    lines.push(`${names[i]} (${day}): ${bits.join(", ")}.`)
  })
  return lines.join("\n")
}

// ───────────────────────── calendar ─────────────────────────

const CALENDAR_WORDS =
  /(?:^| )(?:календар|расписани|встреч|совещани|созвон|планы|план на|что у меня|что запланирован|запланирован|мероприяти|событи|занят ли|занята ли|свободен ли|свободна ли|когда у меня|во сколько у меня|calendar|schedule|meeting|appointment|agenda|what do i have|am i free|am i busy|my day)/

/** True when the question is about plans, meetings or the calendar. */
export function needsCalendar(q: string): boolean {
  return CALENDAR_WORDS.test(normalize(q))
}

const WEEKDAYS: [RegExp, number][] = [
  [/(?:^| )(?:в )?(?:понедельник|monday)/, 1], [/(?:^| )(?:во )?(?:вторник|tuesday)/, 2], [/(?:^| )(?:в )?(?:среду|среда|wednesday)/, 3],
  [/(?:^| )(?:в )?(?:четверг|thursday)/, 4], [/(?:^| )(?:в )?(?:пятницу|пятница|friday)/, 5], [/(?:^| )(?:в )?(?:субботу|суббота|saturday)/, 6],
  [/(?:^| )(?:в )?(?:воскресенье|sunday)/, 0],
]

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** The days a calendar question is about: «завтра», «в пятницу», «на неделе»; today and tomorrow by default. */
export function calendarWindow(q: string, now: Date): {from: Date; to: Date; label: string} {
  const n = normalize(q)
  const today = startOfDay(now)
  if (/послезавтра|day after tomorrow/.test(n)) return {from: addDays(today, 2), to: addDays(today, 3), label: "послезавтра"}
  if (/завтра|tomorrow/.test(n)) return {from: addDays(today, 1), to: addDays(today, 2), label: "завтра"}
  if (/выходн|weekend/.test(n)) {
    const dow = today.getDay()
    const sat = dow === 6 ? today : dow === 0 ? addDays(today, -1) : addDays(today, 6 - dow)
    return {from: dow === 0 ? today : sat, to: addDays(sat, 2), label: "выходные"}
  }
  if (/недел|week/.test(n)) return {from: today, to: addDays(today, 7), label: "7 дней"}
  if (/месяц|month/.test(n)) return {from: today, to: addDays(today, 31), label: "месяц"}
  for (const [re, dow] of WEEKDAYS) {
    if (re.test(n)) {
      const ahead = (dow - today.getDay() + 7) % 7
      const day = addDays(today, ahead)
      return {from: day, to: addDays(day, 1), label: n.match(re)![0].trim()}
    }
  }
  if (/сегодня|today|tonight|вечером|утром|днем/.test(n)) return {from: today, to: addDays(today, 1), label: "сегодня"}
  return {from: today, to: addDays(today, 2), label: "сегодня и завтра"}
}

export interface CalEvent {
  title: string
  startsAt: string
  endsAt: string
  allDay: boolean
  location?: string
}

const DOW = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const pad = (n: number) => (n < 10 ? "0" + n : String(n))

/** Calendar events → lines for the AI, in the phone's local time. */
export function formatEvents(events: CalEvent[], label: string, truncated = false): string {
  if (!events.length) return `Календарь телефона (${label}): событий нет.`
  const lines = [`Календарь телефона (${label}):`]
  const sorted = [...events].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)))
  for (const e of sorted.slice(0, 30)) {
    const s = new Date(e.startsAt)
    const en = new Date(e.endsAt)
    if (Number.isNaN(s.getTime())) continue
    const day = `${DOW[s.getDay()]} ${pad(s.getDate())}.${pad(s.getMonth() + 1)}`
    const time = e.allDay
      ? "весь день"
      : `${pad(s.getHours())}:${pad(s.getMinutes())}${Number.isNaN(en.getTime()) ? "" : `–${pad(en.getHours())}:${pad(en.getMinutes())}`}`
    const title = String(e.title ?? "").trim() || "(без названия)"
    const loc = String(e.location ?? "").replace(/\s+/g, " ").trim()
    lines.push(`• ${day} ${time} ${title}${loc ? ` (${loc.slice(0, 80)})` : ""}`)
  }
  if (truncated || sorted.length > 30) lines.push("… (есть ещё события)")
  return lines.join("\n")
}

/** Wraps the gathered context so the AI knows it is data, not the question. */
export function contextBlock(parts: string[]): string {
  const p = parts.map((s) => s.trim()).filter(Boolean)
  if (!p.length) return ""
  return [
    "Сведения с телефона пользователя (используй, только если они относятся к вопросу; не пересказывай их без нужды):",
    ...p,
  ].join("\n")
}
