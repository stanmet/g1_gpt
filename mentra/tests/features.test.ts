/**
 * 1.16: the guide, place / weather / calendar in questions, replies in translation mode, web search
 * in conversation fact checks — through the whole assistant, with a fake phone.
 */
import {describe, expect, test} from "bun:test"
import {readFileSync} from "fs"
import {Assistant, GUIDE_SHOW_MS, SILENCE_MS, type ContextHost} from "../src/background/assistant"
import {tileInfo} from "../src/background/guide"
import {REPLY_PAUSE_MS} from "../src/background/replies"
import {DEFAULT_SETTINGS, Store, type KV} from "../src/background/store"
import {fromWorld} from "../src/shared/mvt"

const FIXTURE = new Uint8Array(readFileSync(new URL("./fixtures/zurich-14-8590-5737.pbf.gz", import.meta.url)))
const INFO = tileInfo(FIXTURE, 14, 8590, 5737)
const church = INFO.pois.find((p) => p.name === "Kirche Fehraltorf")!
const CHURCH = fromWorld(church.x, church.y)
/** ~55 m north of the church. */
const HERE = {lat: CHURCH.lat + 0.0005, lng: CHURCH.lng, accuracy: 8}

class MemKV implements KV {
  m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

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
      await settle()
    }
    this.t = end
    await settle()
  }
}

/** Lets promise chains (context gathering, the fake fetch) run to the end. */
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0))
}

const WEATHER = {
  current: {time: "2026-11-18T14:00", temperature_2m: 9, apparent_temperature: 6, precipitation: 0, weather_code: 61, wind_speed_10m: 5},
  daily: {time: ["2026-11-18"], weather_code: [61], temperature_2m_max: [10], temperature_2m_min: [5], precipitation_probability_max: [80], precipitation_sum: [3]},
}

function setup(answers: string[], settings: Partial<typeof DEFAULT_SETTINGS> = {}, opts: {calendar?: boolean} = {}) {
  const store = new Store(new MemKV())
  store.saveSettings({...DEFAULT_SETTINGS, apiKey: "sk-test-1234567890abcdef", ...settings})
  const clock = new Clock()
  const shown: string[] = []
  const requests: any[] = []
  const calls = {here: 0, weather: [] as number[][], geocode: [] as string[], calendar: [] as Date[][]}
  let onPos: ((p: {lat: number; lng: number; accuracy?: number}) => void) | null = null
  const context: ContextHost = {
    status: () => ({location: true, calendar: opts.calendar !== false}),
    here: async () => {
      calls.here++
      return {...HERE}
    },
    around: async () => [INFO],
    weather: async (lat, lng) => {
      calls.weather.push([lat, lng])
      return WEATHER
    },
    geocode: async (name) => {
      calls.geocode.push(name)
      return name === "Москва" ? {results: [{name: "Москва", country: "Россия", latitude: 55.75, longitude: 37.62, population: 12_000_000}]} : {results: []}
    },
    calendar: async (from, to) => {
      calls.calendar.push([from, to])
      return {events: [{title: "Стоматолог", startsAt: new Date(from.getTime() + 10 * 3600_000).toISOString(), endsAt: new Date(from.getTime() + 11 * 3600_000).toISOString(), allDay: false}], truncated: false}
    },
    watch: (cb) => {
      onPos = cb
      return () => {
        onPos = null
      }
    },
  }
  const translation: {handler: ((ev: any) => void) | null} = {handler: null}
  const a = new Assistant({
    store,
    fetch: (async (url: string, init: any) => {
      requests.push({url, body: JSON.parse(init.body)})
      const text = answers.shift() ?? "Готово."
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({model: "gpt-6.1-terra", output: [{type: "message", content: [{type: "output_text", text}]}]}),
      }
    }) as any,
    show: (t) => void shown.push(t),
    clear: () => void shown.push("<clear>"),
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    context,
    startTranslation: (_target, handler) => {
      translation.handler = handler
      return () => {
        translation.handler = null
      }
    },
  })
  const say = async (text: string) => {
    a.onTranscript(text, true)
    await settle()
    await clock.advance(SILENCE_MS + 10)
    await settle()
  }
  const move = async (p: {lat: number; lng: number; accuracy?: number}, ms = 15_000) => {
    await clock.advance(ms)
    onPos?.(p)
    await settle()
  }
  return {a, clock, shown, requests, calls, say, move, translation, watching: () => onPos !== null}
}

const instructions = (r: any) => String(r.body.instructions ?? "")
const tools = (r: any) => (r.body.tools ?? []).map((t: any) => t.type)

describe("questions know where you are, the weather and your plans", () => {
  test("an ordinary question: the street and coordinates go along (setting on by default)", async () => {
    const e = setup(["Ответ."])
    await e.say("Вопрос, где тут поблизости поесть?")
    expect(e.requests).toHaveLength(1)
    const sys = instructions(e.requests[0])
    expect(sys).toContain("Сведения с телефона пользователя")
    expect(sys).toMatch(/Где пользователь сейчас \(GPS телефона, точность ±8 м\): .*Феральторф/)
    expect(sys).not.toContain("Погода")
    expect(tools(e.requests[0])).toEqual([]) // no web search unless set
    expect(e.a.log.some((l) => l.msg === "К вопросу добавлено: место")).toBe(true)
  })

  test("«Учитывать, где я» off: nothing about the place, the GPS is not even asked", async () => {
    const e = setup(["Ответ."], {useLocation: false})
    await e.say("Вопрос, кто такой Кант?")
    expect(instructions(e.requests[0])).not.toContain("Где пользователь")
    expect(e.calls.here).toBe(0)
  })

  test("the weather where you are — from Open-Meteo, even with the location setting off", async () => {
    const e = setup(["Возьмите зонт: дождь до вечера."], {useLocation: false})
    await e.say("Вопрос, нужен ли сегодня зонт?")
    expect(e.calls.weather).toEqual([[HERE.lat, HERE.lng]])
    const sys = instructions(e.requests[0])
    expect(sys).toContain("Погода — там, где пользователь (Open-Meteo), сейчас 14:00: 9 °C, ощущается как 6 °C, слабый дождь")
    expect(sys).not.toContain("Где пользователь сейчас")
    expect(e.shown.at(-1)).toContain("Возьмите зонт")
  })

  test("the weather in a named town: found by its name, not by where you are", async () => {
    const e = setup(["В Москве −3 °C."])
    await e.say("Вопрос, какая погода в Москве?")
    expect(e.calls.geocode).toEqual(["Москв", "Москва"])
    expect(e.calls.weather).toEqual([[55.75, 37.62]])
    expect(instructions(e.requests[0])).toContain("Погода — Москва, Россия (Open-Meteo)")
  })

  test("plans: the calendar for the day asked about", async () => {
    const e = setup(["Завтра в 10 — стоматолог."])
    await e.say("Вопрос, что у меня завтра?")
    expect(e.calls.calendar).toHaveLength(1)
    const [from, to] = e.calls.calendar[0]
    expect(to.getTime() - from.getTime()).toBe(24 * 3600_000)
    expect(instructions(e.requests[0])).toContain("Календарь телефона (завтра):\n• ")
    expect(instructions(e.requests[0])).toContain("10:00–11:00 Стоматолог")
  })

  test("no CALENDAR permission: the AI is told, the log says how to fix it", async () => {
    const e = setup(["Нет доступа к календарю."], {}, {calendar: false})
    await e.say("Вопрос, какие у меня встречи сегодня?")
    expect(e.calls.calendar).toHaveLength(0)
    expect(instructions(e.requests[0])).toContain("Календарь телефона недоступен")
    expect(e.a.log.some((l) => /нет разрешения CALENDAR/.test(l.msg))).toBe(true)
  })

  test("«Календарь телефона» off: not read", async () => {
    const e = setup(["Ок."], {useCalendar: false})
    await e.say("Вопрос, что у меня завтра?")
    expect(e.calls.calendar).toHaveLength(0)
    expect(instructions(e.requests[0])).not.toContain("Календарь")
  })
})

describe("the guide", () => {
  test("«Что это за здание?» without the activator: the AI gets what is next to you and searches the web", async () => {
    const e = setup(["Это Kirche Fehraltorf, построена в XV веке."])
    e.a.onTranscript("Что это за здание?", true)
    await settle()
    expect(e.requests).toHaveLength(1)
    const sys = instructions(e.requests[0])
    expect(sys).toContain("Рядом на карте (OpenStreetMap):\n• Kirche Fehraltorf — церковь, 60 м на юг")
    expect(sys).toContain("Камеры нет")
    expect(tools(e.requests[0])).toEqual(["web_search"])
    expect(e.shown.at(-1)).toContain("Kirche Fehraltorf")
    expect(e.a.log.some((l) => l.msg === "К вопросу добавлено: место и что рядом")).toBe(true)
  })

  test("«Где я?»: the address from the map, no AI; kept in the chat", async () => {
    const e = setup([])
    e.a.onTranscript("Где я?", true)
    await settle()
    expect(e.requests).toHaveLength(0)
    expect(e.shown).toContain("Определяю, где вы…")
    const screen = e.shown.at(-1)!
    expect(screen).toContain("Феральторф")
    expect(screen).toContain(`${HERE.lat.toFixed(5)}, ${HERE.lng.toFixed(5)} ±8 м`)
    expect(e.a.phase).toBe("answering")
    expect(e.a.history.at(-2)?.content).toBe("Где я?")
  })

  test("«Что интересного рядом?»: a list with distances, no AI", async () => {
    const e = setup([])
    await e.say("Вопрос, что интересного рядом?")
    expect(e.requests).toHaveLength(0)
    expect(e.shown.at(-1)).toBe("Рядом интересное:\n• Kirche Fehraltorf (церковь) — 60 м, на юг\n• Fehraltorf (вокзал) — 300 м, на юго-запад")
  })

  test("in conversation mode only with the activator, and the mode stays on", async () => {
    const e = setup([])
    e.a.startTalk("ui")
    e.a.onTranscript("Где я?", true)
    await settle()
    expect(e.shown.some((s) => s.includes("Феральторф"))).toBe(false)
    e.a.onTranscript("Вопрос, где я?", true)
    await settle()
    expect(e.shown.at(-1)).toContain("Феральторф")
    expect(e.a.phase).toBe("talk")
  })

  test("«Включи гида»: walking toward the church, a note appears and clears by itself", async () => {
    const e = setup(["Церковь XV века; фрески 1450 года."])
    await e.say("Вопрос, включи гида")
    expect(e.a.settings.guideAuto).toBe(true)
    expect(e.a.guide.active).toBe(true)
    expect(e.watching()).toBe(true)
    await e.clock.advance(5000) // the «Гид включён» message goes away
    await e.move({lat: CHURCH.lat + 0.0009, lng: CHURCH.lng, accuracy: 6})
    await e.move({lat: CHURCH.lat + 0.0005, lng: CHURCH.lng, accuracy: 6})
    expect(e.requests).toHaveLength(1)
    expect(tools(e.requests[0])).toEqual(["web_search"])
    expect(e.shown.at(-1)).toBe("Kirche Fehraltorf — 60 м, впереди\nЦерковь XV века; фрески 1450 года.")
    expect(e.a.snapshot().guide.notes).toHaveLength(1)
    await e.clock.advance(GUIDE_SHOW_MS + 100)
    expect(e.shown.at(-1)).toBe("<clear>")
    await e.say("Вопрос, стоп гид")
    expect(e.a.guide.active).toBe(false)
    expect(e.watching()).toBe(false)
  })

  test("the guide setting survives a restart", () => {
    const e = setup([], {guideAuto: true})
    expect(e.a.guide.active).toBe(true)
    expect(e.watching()).toBe(true)
  })
})

describe("translation: what to answer", () => {
  const foreign = (e: ReturnType<typeof setup>, text: string, orig: string, isFinal = true) =>
    e.translation.handler?.({text, isFinal, sourceLanguage: "en", targetLanguage: "ru-RU", originalText: orig, utteranceId: "u" + orig.length})

  test("after their phrase and a pause: two replies in their language, with the meaning", async () => {
    const e = setup(["1. Sure, seven works. | Да, в семь удобно\n2. Could we make it eight? | А можно в восемь?"])
    e.a.startTranslation("ui")
    foreign(e, "Можем встретиться в семь?", "Can we meet at seven?")
    await e.clock.advance(REPLY_PAUSE_MS + 10)
    expect(e.requests).toHaveLength(1)
    expect(String(e.requests[0].body.input.at(-1).content)).toContain("«Can we meet at seven?» (перевод: «Можем встретиться в семь?»)")
    expect(e.shown.at(-1)).toBe("Можем встретиться в семь?\n→ Sure, seven works. (Да, в семь удобно)\n→ Could we make it eight? (А можно в восемь?)")
    expect(e.a.snapshot().replies).toHaveLength(2)
  })

  test("they keep talking, or you start answering: no replies", async () => {
    const e = setup([])
    e.a.startTranslation("ui")
    foreign(e, "Можем встретиться", "Can we meet")
    await e.clock.advance(500)
    foreign(e, "в семь или", "at seven or", false)
    await e.clock.advance(REPLY_PAUSE_MS + 10)
    expect(e.requests).toHaveLength(0)
    foreign(e, "в семь или в восемь?", "at seven or eight?")
    await e.clock.advance(500)
    e.translation.handler?.({text: "Давай в семь", isFinal: false, sourceLanguage: "ru", targetLanguage: "ru-RU"})
    await e.clock.advance(REPLY_PAUSE_MS + 10)
    expect(e.requests).toHaveLength(0)
  })

  test("«Что ответить?» asks right away; the setting off stops the automatic ones", async () => {
    const e = setup(["1. No, thank you. | Нет, спасибо\n2. Yes, please. | Да, пожалуйста"], {translateReplies: false})
    e.a.startTranslation("ui")
    foreign(e, "Хотите кофе?", "Would you like some coffee?")
    await e.clock.advance(REPLY_PAUSE_MS + 10)
    expect(e.requests).toHaveLength(0)
    e.a.onTranscript("Что ответить?", true)
    await settle()
    expect(e.requests).toHaveLength(1)
    expect(e.shown.at(-1)).toContain("→ No, thank you. (Нет, спасибо)")
    expect(e.a.phase).toBe("translating")
  })

  test("SKIP: the subtitles stay", async () => {
    const e = setup(["SKIP"])
    e.a.startTranslation("ui")
    foreign(e, "Следующая остановка — Тринити-колледж.", "Next stop is Trinity College.")
    await e.clock.advance(REPLY_PAUSE_MS + 10)
    expect(e.requests).toHaveLength(1)
    expect(e.shown.at(-1)).toBe("Следующая остановка —\nТринити-колледж.")
  })
})

describe("conversation: claims checked on the web", () => {
  test("a claim with numbers → the next fact check searches the web; small talk does not", async () => {
    const e = setup(["SKIP", "Неверно: около 1,41 млрд (ООН, 2024)."], {talkEverySec: 5})
    e.a.startTalk("ui")
    await e.clock.advance(6000)
    e.a.onTranscript("Ну вот мы и пришли наконец сюда с тобой сегодня", true)
    await settle()
    expect(e.requests).toHaveLength(1)
    expect(tools(e.requests[0])).toEqual([])
    await e.clock.advance(6000)
    e.a.onTranscript("В Китае живёт два миллиарда человек, это точно", true)
    await settle()
    expect(e.requests).toHaveLength(2)
    expect(tools(e.requests[1])).toEqual(["web_search"])
    expect(e.requests[1].body.instructions).toContain("поиском в интернете")
    expect(e.a.talk.screen).toContain("Неверно: около 1,41 млрд")
  })

  test("«Проверять в интернете» off: no search", async () => {
    const e = setup(["Неверно: около 1,41 млрд."], {talkEverySec: 5, talkSearch: false})
    e.a.startTalk("ui")
    await e.clock.advance(6000)
    e.a.onTranscript("В Китае живёт два миллиарда человек, это точно", true)
    await settle()
    expect(tools(e.requests[0])).toEqual([])
  })
})
