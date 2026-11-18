import {describe, expect, test} from "bun:test"
import {
  calendarWindow,
  contextBlock,
  formatEvents,
  formatWeather,
  geocodeUrl,
  needsCalendar,
  needsWeather,
  openMeteoUrl,
  pickGeocode,
  placeVariants,
  weatherPlace,
  weatherWord,
} from "../src/background/context"
import {buildReplyPrompt, isReplyRequest, parseReplies, replyScreen} from "../src/background/replies"
import {G1_LINES, wrapLines} from "../src/background/g1text"

describe("weather questions", () => {
  test("which questions are about the weather", () => {
    for (const q of ["Какая погода?", "Нужен ли зонт?", "Будет ли дождь вечером?", "Сколько градусов на улице", "Что надеть сегодня?", "What's the weather like?"])
      expect(needsWeather(q)).toBe(true)
    for (const q of ["Кто такой Кант?", "Сколько стоит билет в Рим?", "Как дойти до вокзала?"]) expect(needsWeather(q)).toBe(false)
  })

  test("the town named in the question, as said", () => {
    expect(weatherPlace("Какая погода в Москве?")).toBe("Москве")
    expect(weatherPlace("Будет ли дождь в Дублине завтра?")).toBe("Дублине")
    expect(weatherPlace("Погода в Нью-Йорке")).toBe("Нью-Йорке")
    expect(weatherPlace("What's the weather in London tomorrow?")).toBe("London")
    expect(weatherPlace("Какая погода в Санкт-Петербурге на выходных")).toBe("Санкт-Петербурге")
    // no town: the weather where you are
    expect(weatherPlace("Какая погода сегодня?")).toBeNull()
    expect(weatherPlace("Будет ли дождь в обед?")).toBeNull()
    expect(weatherPlace("Погода в субботу")).toBeNull()
    expect(weatherPlace("Нужен ли зонт на завтра")).toBeNull()
  })

  test("Russian place names back to the form a map knows", () => {
    expect(placeVariants("Лондоне")[0]).toBe("Лондон")
    expect(placeVariants("Москве")).toContain("Москва")
    expect(placeVariants("Казани")[0]).toBe("Казань")
    expect(placeVariants("Германии")[0]).toBe("Германия")
    expect(placeVariants("Санкт-Петербурге")[0]).toBe("Санкт-Петербург")
    expect(placeVariants("London")).toEqual(["London"])
  })

  test("Open-Meteo addresses and the best town from a search", () => {
    expect(openMeteoUrl(53.34987, -6.26031)).toContain("latitude=53.35&longitude=-6.26")
    expect(openMeteoUrl(1, 2)).toContain("timezone=auto")
    expect(geocodeUrl("Москва", "ru")).toBe("https://geocoding-api.open-meteo.com/v1/search?name=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&count=5&language=ru&format=json")
    const data = {
      results: [
        {name: "Лондон", country: "Канада", latitude: 42.98, longitude: -81.23, population: 383_000},
        {name: "Лондон", country: "Великобритания", latitude: 51.51, longitude: -0.13, population: 8_961_989},
        {name: "Лондондерри", country: "Великобритания", latitude: 55, longitude: -7.3, population: 83_000},
      ],
    }
    expect(pickGeocode(data, "Лондон")).toEqual({name: "Лондон", country: "Великобритания", lat: 51.51, lng: -0.13})
    expect(pickGeocode({results: []}, "x")).toBeNull()
    expect(pickGeocode({}, "x")).toBeNull()
  })

  test("a forecast in a few lines: now, the next hours, three days", () => {
    const hours = Array.from({length: 48}, (_, i) => `2026-11-18T${String(i % 24).padStart(2, "0")}:00`)
    const data = {
      current: {time: "2026-11-18T14:00", temperature_2m: 9.4, apparent_temperature: 6.2, precipitation: 0, weather_code: 3, wind_speed_10m: 6.1, wind_gusts_10m: 11.3},
      hourly: {
        time: hours,
        temperature_2m: hours.map((_, i) => 10 - (i % 24) / 6),
        precipitation_probability: hours.map((_, i) => (i % 24 >= 16 ? 70 : 10)),
        precipitation: hours.map(() => 0),
        weather_code: hours.map((_, i) => (i % 24 >= 16 ? 61 : 3)),
      },
      daily: {
        time: ["2026-11-18", "2026-11-19", "2026-11-20"],
        weather_code: [61, 3, 0],
        temperature_2m_max: [10.2, 8.8, 7],
        temperature_2m_min: [5.1, 3.9, 1],
        precipitation_probability_max: [70, 20, 0],
        precipitation_sum: [2.1, 0, 0],
        wind_speed_10m_max: [8, 5, 3],
        sunrise: ["2026-11-18T08:02", "", ""],
        sunset: ["2026-11-18T16:28", "", ""],
      },
    }
    const t = formatWeather(data, "Dublin, Ireland")
    expect(t).toContain("Погода — Dublin, Ireland (Open-Meteo), сейчас 14:00: 9 °C, ощущается как 6 °C, пасмурно, ветер 6.1 м/с (порывы 11.3).")
    expect(t).toContain("15:00 8° 10% · 17:00 7° 70% слабый дождь")
    expect(t).toContain("Сегодня (2026-11-18): 5…10 °C, слабый дождь, осадки 70%, 2.1 мм, ветер до 8 м/с, восход 08:02, закат 16:28.")
    expect(t).toContain("Послезавтра (2026-11-20): 1…7 °C, ясно, осадки 0%")
    expect(weatherWord(95)).toBe("гроза")
    expect(weatherWord(45, "en")).toBe("fog")
  })
})

describe("calendar questions", () => {
  test("which questions are about plans", () => {
    for (const q of ["Что у меня завтра?", "Какие у меня встречи сегодня?", "Когда у меня созвон?", "Свободен ли я в пятницу?", "What's on my calendar?"])
      expect(needsCalendar(q)).toBe(true)
    for (const q of ["Какая погода?", "Кто написал «Войну и мир»?"]) expect(needsCalendar(q)).toBe(false)
  })

  test("the days asked about", () => {
    const wed = new Date(2026, 10, 18, 14, 30) // Wednesday 18 Nov 2026
    const day = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}`
    const w = (q: string) => {
      const r = calendarWindow(q, wed)
      return `${day(r.from)}–${day(r.to)} ${r.label}`
    }
    expect(w("Что у меня?")).toBe("18.11–20.11 сегодня и завтра")
    expect(w("Что у меня сегодня вечером?")).toBe("18.11–19.11 сегодня")
    expect(w("Какие встречи завтра?")).toBe("19.11–20.11 завтра")
    expect(w("А послезавтра?")).toBe("20.11–21.11 послезавтра")
    expect(w("Что у меня в пятницу?")).toBe("20.11–21.11 в пятницу")
    expect(w("Что у меня в среду?")).toBe("18.11–19.11 в среду")
    expect(w("Планы на выходные")).toBe("21.11–23.11 выходные")
    expect(w("Что на этой неделе?")).toBe("18.11–25.11 7 дней")
  })

  test("events in the phone's local time", () => {
    const at = (h: number, m = 0, d = 18) => new Date(2026, 10, d, h, m).toISOString()
    const t = formatEvents(
      [
        {title: "Стоматолог", startsAt: at(16, 30), endsAt: at(17, 15), allDay: false, location: "Grafton St 10"},
        {title: "Стендап", startsAt: at(9, 0), endsAt: at(9, 15), allDay: false},
        {title: "Отпуск Анны", startsAt: at(0, 0, 19), endsAt: at(0, 0, 20), allDay: true},
      ],
      "сегодня и завтра",
    )
    expect(t).toBe(
      "Календарь телефона (сегодня и завтра):\n• ср 18.11 09:00–09:15 Стендап\n• ср 18.11 16:30–17:15 Стоматолог (Grafton St 10)\n• чт 19.11 весь день Отпуск Анны",
    )
    expect(formatEvents([], "завтра")).toBe("Календарь телефона (завтра): событий нет.")
  })

  test("the block the AI gets says it is data, and is empty when there is nothing", () => {
    expect(contextBlock(["", "  "])).toBe("")
    expect(contextBlock(["Погода: ясно."])).toMatch(/^Сведения с телефона пользователя.*\nПогода: ясно\.$/s)
  })
})

describe("translation: what to answer", () => {
  test("the prompt names their language; non-Latin scripts come transliterated", () => {
    const {system, user} = buildReplyPrompt([{orig: "Can we meet at seven?", text: "Можем встретиться в семь?", lang: "en-US"}], "ru")
    expect(system).toContain("на английском языке")
    expect(system).toContain("перевод на русский")
    expect(system).not.toMatch(/латиницей/)
    expect(user).toBe("Собеседник сказал:\n«Can we meet at seven?» (перевод: «Можем встретиться в семь?»)")
    expect(buildReplyPrompt([{orig: "", text: "Сколько стоит?", lang: "zh"}], "ru").system).toMatch(/латиницей/)
  })

  test("replies parsed from the AI; SKIP means none", () => {
    expect(parseReplies("1. Sure, seven works. | Да, в семь удобно\n2. Could we make it eight? | А можно в восемь?")).toEqual([
      {say: "Sure, seven works.", means: "Да, в семь удобно"},
      {say: "Could we make it eight?", means: "А можно в восемь?"},
    ])
    expect(parseReplies("1) «7 pm is fine» — «В 7 вечера нормально»")).toEqual([{say: "7 pm is fine", means: "В 7 вечера нормально"}])
    expect(parseReplies("SKIP")).toEqual([])
    expect(parseReplies("")).toEqual([])
  })

  test("the glasses: replies at the bottom, the translation above when there is room", () => {
    const s = replyScreen("Можем встретиться в семь?", [
      {say: "Sure, seven works.", means: "да, в семь удобно"},
      {say: "Could we make it eight?", means: "можно в восемь?"},
    ])
    expect(s.split("\n").length).toBeLessThanOrEqual(G1_LINES)
    expect(s.split("\n")[0]).toBe("Можем встретиться в семь?")
    expect(s).toContain("→ Sure, seven works. (да, в семь удобно)")
    const long = "Very long reply that keeps going and going and going for a while"
    const tight = replyScreen("x", [
      {say: long, means: "очень длинный ответ, который всё не кончается и не кончается"},
      {say: long, means: "очень длинный ответ, который всё не кончается и не кончается"},
    ])
    expect(tight.split("\n").length).toBeLessThanOrEqual(G1_LINES)
    expect(tight.startsWith("→ Very long")).toBe(true)
    expect(wrapLines(tight).length).toBeLessThanOrEqual(G1_LINES)
  })

  test("«что ответить?» asks for replies now", () => {
    for (const q of ["Что ответить?", "как мне ответить", "Подскажи ответ", "варианты ответа", "What should I say?"]) expect(isReplyRequest(q)).toBe(true)
    for (const q of ["что ответить начальнику на письмо о повышении", "ответить"]) expect(isReplyRequest(q)).toBe(false)
  })
})
