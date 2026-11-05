import {describe, expect, test} from "bun:test"
import {Assistant, NAV_TURN_MS} from "../src/background/assistant"
import {
  buildMapQueryPrompt,
  cleanMapQuery,
  explainNavError,
  formatDistance,
  formatDuration,
  maneuverScreen,
  Navigator,
  shortPlace,
  type NavHost,
  type NavUpdate,
  type Place,
} from "../src/background/navigator"
import {DEFAULT_SETTINGS, Store, type KV} from "../src/background/store"
import {parseNavCommand} from "../src/background/voice"

// ── fakes ────────────────────────────────────────────────────────────────
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

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
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
      await flush()
    }
    this.t = end
    await flush()
  }
}

const TRINITY: Place = {name: "Trinity College Dublin", address: "College Green, Dublin 2", lat: 53.3438, lng: -6.2546}

function maneuver(over: Partial<Extract<NavUpdate, {kind: "maneuver"}>> = {}): NavUpdate {
  return {
    kind: "maneuver",
    maneuverType: "TURN_RIGHT",
    distanceMeters: 120,
    nextStepRoad: "Grafton Street",
    distanceToDestinationMeters: 850,
    timeToDestinationSeconds: 660,
    ...over,
  }
}

/** Fake Mentra: location, place search and navigator. */
function fakeHost(opts: {places?: Record<string, Place>; startResult?: {ok: boolean; error?: string}} = {}) {
  const places = opts.places ?? {"Trinity College Dublin": TRINITY}
  const calls = {suggest: [] as {query: string; near: any}[], start: [] as {place: Place; mode: string}[], stop: 0, locate: 0}
  const host: NavHost = {
    problem: () => "",
    async locate() {
      calls.locate++
      return {lat: 53.3498, lng: -6.2603}
    },
    async suggest(query, near) {
      calls.suggest.push({query, near})
      return Object.keys(places)
        .filter((k) => k.toLowerCase().includes(query.toLowerCase()))
        .map((k) => ({placeId: k, mainText: places[k].name, secondaryText: places[k].address}))
    },
    async details(placeId) {
      return places[placeId] ?? null
    },
    async start(place, mode) {
      calls.start.push({place, mode})
      return opts.startResult ?? {ok: true}
    },
    stop() {
      calls.stop++
    },
  }
  return {host, calls}
}

/** LLM answers: a list in order, or a function of the request (system prompt, user text). */
type Answers = string[] | ((system: string, user: string) => string)

function setupAssistant(llmAnswers: Answers = [], hostOpts: Parameters<typeof fakeHost>[0] = {}, settings: Partial<typeof DEFAULT_SETTINGS> = {}) {
  const kv = new MemKV()
  const store = new Store(kv)
  store.saveSettings({...DEFAULT_SETTINGS, apiKey: "sk-test-1234567890abcdef", ...settings})
  const clock = new Clock()
  const shown: string[] = []
  const requests: any[] = []
  const fetch = async (_url: string, init: any) => {
    const body = JSON.parse(init.body)
    requests.push(body)
    const text =
      typeof llmAnswers === "function"
        ? llmAnswers(String(body.instructions ?? ""), String(body.input?.at(-1)?.content ?? ""))
        : (llmAnswers.shift() ?? "Готово.")
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({model: "gpt-6.1-terra", output: [{type: "message", content: [{type: "output_text", text}]}]}),
    }
  }
  const {host, calls} = fakeHost(hostOpts)
  const a = new Assistant({
    store,
    fetch: fetch as any,
    show: (t) => void shown.push(t),
    clear: () => void shown.push("<clear>"),
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    nav: host,
  })
  return {a, clock, shown, requests, calls, store, kv}
}

// ── voice commands ───────────────────────────────────────────────────────
describe("parseNavCommand", () => {
  test("destinations and travel modes", () => {
    expect(parseNavCommand("Проведи до Тринити-колледжа пешком")).toEqual({kind: "go", query: "Тринити-колледжа", mode: "walking"})
    expect(parseNavCommand("Как дойти до Темпл-бара?")).toEqual({kind: "go", query: "Темпл-бара", mode: "walking"})
    expect(parseNavCommand("Как доехать до аэропорта")).toEqual({kind: "go", query: "аэропорта", mode: "driving"})
    expect(parseNavCommand("Отвези меня в аэропорт")).toEqual({kind: "go", query: "аэропорт", mode: "driving"})
    expect(parseNavCommand("Навигатор до Grafton Street")).toEqual({kind: "go", query: "Grafton Street", mode: null})
    expect(parseNavCommand("Проложи маршрут до O'Connell Street на велосипеде")).toEqual({kind: "go", query: "O'Connell Street", mode: "cycling"})
    expect(parseNavCommand("Navigate to Trinity College")).toEqual({kind: "go", query: "Trinity College", mode: null})
  })

  test("stop, status and a bare «Навигатор»", () => {
    expect(parseNavCommand("Стоп навигация.")).toEqual({kind: "stop"})
    expect(parseNavCommand("Навигатор стоп")).toEqual({kind: "stop"})
    expect(parseNavCommand("Сколько ещё идти?")).toEqual({kind: "status"})
    expect(parseNavCommand("Навигатор")).toEqual({kind: "ask", mode: null})
    expect(parseNavCommand("Проложи маршрут пешком")).toEqual({kind: "ask", mode: "walking"})
  })

  test("ordinary speech is not a command", () => {
    expect(parseNavCommand("Как дела?")).toBeNull()
    expect(parseNavCommand("Пошли в кино")).toBeNull()
    expect(parseNavCommand("Маршрут.")).toBeNull()
    expect(parseNavCommand("Как дойти до истины, если все врут и никто не знает ответа на этот вопрос вообще")).toBeNull()
  })
})

// ── screens ──────────────────────────────────────────────────────────────
describe("navigator screens", () => {
  test("distances and times are rounded for a glance", () => {
    expect(formatDistance(7)).toBe("10 м")
    expect(formatDistance(37)).toBe("40 м")
    expect(formatDistance(640)).toBe("650 м")
    expect(formatDistance(1234)).toBe("1,2 км")
    expect(formatDistance(-1)).toBe("")
    expect(formatDuration(660)).toBe("11 мин")
    expect(formatDuration(3900)).toBe("1 ч 5 мин")
    expect(formatDuration(-1)).toBe("")
  })

  test("a turn: arrow, distance, street, what is left", () => {
    expect(maneuverScreen(maneuver() as any, "Trinity College Dublin")).toBe("→ Направо через 120 м\nна Grafton Street\nTrinity College Dublin: 850 м, 11 мин")
    expect(maneuverScreen(maneuver({maneuverType: "TURN_LEFT", distanceMeters: 8}) as any, "X")).toMatch(/^← Налево сейчас\n/)
    expect(maneuverScreen(maneuver({maneuverType: "STRAIGHT", distanceMeters: 300, nextStepRoad: null}) as any, "X")).toBe("↑ Прямо 300 м\nX: 850 м, 11 мин")
  })

  test("only G1 font characters", () => {
    const all = ["TURN_LEFT", "TURN_RIGHT", "SLIGHT_LEFT", "SHARP_RIGHT", "U_TURN", "CROSS_STREET", "ARRIVE", "STRAIGHT"]
      .map((t) => maneuverScreen(maneuver({maneuverType: t as any}) as any, "X"))
      .join("\n")
    expect(all).not.toMatch(/[№↰↱⟲➜]/)
  })

  test("long names are shortened, map queries cleaned", () => {
    expect(shortPlace("Trinity College Dublin")).toBe("Trinity College Dublin")
    expect(shortPlace("National Museum of Ireland - Archaeology, Kildare Street")).toBe("National Museum of Ireland")
    expect(shortPlace("Dublin Airport Terminal Two Departures Hall")).toBe("Dublin Airport Terminal…")
    expect(cleanMapQuery("«Trinity College Dublin».\nПояснение")).toBe("Trinity College Dublin")
    expect(cleanMapQuery("Строка поиска: pharmacy")).toBe("pharmacy")
    expect(buildMapQueryPrompt("Тринити-колледжа", {lat: 53.35, lng: -6.26}).user).toContain("53.350, -6.260")
  })

  test("Mentra errors in plain words", () => {
    expect(explainNavError("LOCATION permission not declared in miniapp.json (required for navigation.start).")).toContain("переустановите")
    expect(explainNavError("Location permission not granted")).toContain("настройках iPhone")
    expect(explainNavError("navigation.start: no GPS fix (timeout)")).toContain("GPS")
  })
})

// ── the Navigator on its own ─────────────────────────────────────────────
function setupNav(start: {ok: boolean; error?: string} = {ok: true}) {
  const clock = new Clock()
  const screens: {text: string; kind: string}[] = []
  const saved: any[] = []
  let ended = 0
  let stopped = 0
  const nav = new Navigator({
    search: async (q) => (q.includes("Trinity") ? TRINITY : null),
    start: async () => start,
    stop: () => void stopped++,
    screen: (text, kind) => void screens.push({text, kind}),
    log: () => {},
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    onChange: () => {},
    save: (t) => void saved.push(t),
    ended: () => void ended++,
  })
  return {nav, clock, screens, saved, ended: () => ended, stopped: () => stopped}
}

describe("Navigator", () => {
  test("search → start → turns → arrival ends the trip by itself", async () => {
    const {nav, clock, screens, saved, ended, stopped} = setupNav()
    await nav.go("Trinity", "walking")
    expect(nav.active).toBe(true)
    expect(screens.map((s) => s.kind)).toEqual(["message", "message", "turn"])
    expect(screens[0].text).toBe("Ищу: Trinity…")
    expect(saved.at(-1)).toMatchObject({dest: TRINITY, mode: "walking"})

    await clock.advance(2000)
    nav.onUpdate(maneuver({distanceMeters: 300}))
    expect(screens.at(-1)).toEqual({text: "→ Направо через 300 м\nна Grafton Street\nTrinity College Dublin: 850 м, 11 мин", kind: "route"})
    // a close turn is urgent once, then regular again
    await clock.advance(2000)
    nav.onUpdate(maneuver({distanceMeters: 25}))
    expect(screens.at(-1)!.kind).toBe("turn")
    await clock.advance(2000)
    nav.onUpdate(maneuver({distanceMeters: 12}))
    expect(screens.at(-1)).toMatchObject({kind: "route", text: expect.stringMatching(/^→ Направо сейчас/)})
    expect(nav.status()).toBe("Trinity College Dublin\nОсталось 850 м, 11 мин")

    nav.onUpdate({kind: "arrived"})
    expect(screens.at(-1)).toEqual({text: "Вы на месте\nTrinity College Dublin", kind: "turn"})
    await clock.advance(15_000)
    expect(nav.active).toBe(false)
    expect(stopped()).toBe(1)
    expect(ended()).toBe(1)
    expect(saved.at(-1)).toBeNull()
  })

  test("regular updates are throttled; the latest is shown", async () => {
    const {nav, clock, screens} = setupNav()
    await nav.go("Trinity", "walking")
    await clock.advance(2000)
    nav.onUpdate(maneuver({distanceMeters: 300}))
    const n = screens.length
    nav.onUpdate(maneuver({distanceMeters: 290}))
    nav.onUpdate(maneuver({distanceMeters: 250}))
    expect(screens.length).toBe(n)
    await clock.advance(1500)
    expect(screens.length).toBe(n + 1)
    expect(screens.at(-1)!.text).toMatch(/^→ Направо через 250 м/)
  })

  test("not found and failed start are messages, no trip", async () => {
    const a = setupNav()
    await a.nav.go("Атлантида", "walking")
    expect(a.nav.active).toBe(false)
    expect(a.screens.at(-1)).toEqual({text: "Не нашёл «Атлантида». Скажите название точнее.", kind: "message"})

    const b = setupNav({ok: false, error: "Location permission not granted"})
    await b.nav.go("Trinity", "walking")
    expect(b.nav.active).toBe(false)
    expect(b.screens.at(-1)!.text).toMatch(/^Маршрут не построен: нет доступа к геопозиции/)
    expect(b.saved.at(-1)).toBeNull()
  })

  test("a Mentra error ends the trip", async () => {
    const {nav, screens, ended} = setupNav()
    await nav.go("Trinity", "walking")
    nav.onUpdate({kind: "error", message: "route lost"})
    expect(nav.active).toBe(false)
    expect(ended()).toBe(1)
    expect(screens.at(-1)).toEqual({text: "Навигация остановлена: route lost", kind: "message"})
  })

  test("a new destination stops the running trip first (Mentra would re-attach to it)", async () => {
    const {nav, stopped} = setupNav()
    await nav.go("Trinity", "walking")
    await nav.go("Trinity", "driving")
    expect(stopped()).toBe(1)
    expect(nav.active).toBe(true)
    expect(nav.mode).toBe("driving")
  })
})

// ── inside the assistant ─────────────────────────────────────────────────
describe("navigator in the assistant", () => {
  test("«Проведи до Тринити-колледжа пешком»: AI turns the name into a map query, route on the glasses", async () => {
    const {a, clock, shown, requests, calls} = setupAssistant(["Trinity College Dublin"])
    a.onTranscript("Проведи до Тринити-колледжа пешком", true)
    await flush()
    expect(requests).toHaveLength(1)
    expect(requests[0].instructions).toContain("навигатору")
    expect(requests[0].input[0].content).toContain("Тринити-колледжа")
    expect(calls.suggest[0]).toEqual({query: "Trinity College Dublin", near: {lat: 53.3498, lng: -6.2603}})
    expect(calls.start).toEqual([{place: TRINITY, mode: "walking"}])
    expect(a.nav.active).toBe(true)
    expect(shown).toContain("Ищу: Тринити-колледжа…")

    await clock.advance(NAV_TURN_MS + 100)
    a.nav.onUpdate(maneuver({distanceMeters: 300}))
    expect(shown.at(-1)).toBe("→ Направо через 300 м\nна Grafton Street\nTrinity College Dublin: 850 м, 11 мин")
    expect(a.snapshot().currentScreen).toBe(shown.at(-1))
    expect(a.snapshot().nav).toMatchObject({active: true, left: "850 м, 11 мин", problem: ""})
  })

  test("an answer covers the route; a close turn shows over it and the answer comes back", async () => {
    const {a, clock, shown} = setupAssistant(["Trinity College Dublin", "Колизей открыт с 9 утра."])
    a.onTranscript("Проведи до Тринити-колледжа", true)
    await flush()
    await clock.advance(NAV_TURN_MS + 100)
    a.onTranscript("Вопрос, когда открывается Колизей?", true)
    await clock.advance(2000)
    expect(a.phase).toBe("answering")
    expect(shown.at(-1)).toBe("Колизей открыт с 9 утра.")

    a.nav.onUpdate(maneuver({distanceMeters: 300}))
    expect(shown.at(-1)).toBe("Колизей открыт с 9 утра.") // a far turn waits
    await clock.advance(2000)
    a.nav.onUpdate(maneuver({distanceMeters: 20}))
    expect(shown.at(-1)).toMatch(/^→ Направо через 20 м/)
    await clock.advance(NAV_TURN_MS)
    expect(shown.at(-1)).toBe("Колизей открыт с 9 утра.")

    // «скрой» hides the answer — the route is what stays on the glasses
    a.onTranscript("Скрой", true)
    expect(shown.at(-1)).toMatch(/^→ Направо через 20 м/)
  })

  test("«Сколько осталось?», «Стоп навигация»", async () => {
    const {a, clock, shown, calls} = setupAssistant(["Trinity College Dublin"])
    a.onTranscript("Как дойти до Тринити-колледжа?", true)
    await flush()
    await clock.advance(NAV_TURN_MS + 100)
    a.nav.onUpdate(maneuver())
    a.onTranscript("Сколько осталось?", true)
    expect(shown.at(-1)).toBe("Trinity College Dublin\nОсталось 850 м, 11 мин")
    a.onTranscript("Стоп навигация", true)
    expect(a.nav.active).toBe(false)
    expect(calls.stop).toBe(1)
    expect(shown.at(-1)).toBe("Маршрут завершён.")
    await clock.advance(2500)
    expect(shown.at(-1)).toBe("<clear>")
  })

  test("«Навигатор» → «Куда?» → the next phrase is the place", async () => {
    const {a, shown, calls} = setupAssistant([], {places: {"Grafton Street": {name: "Grafton Street", address: "Dublin 2", lat: 53.34, lng: -6.26}}})
    a.onTranscript("Навигатор на машине", true)
    expect(shown.at(-1)).toBe("Навигатор, на машине: куда?\nСкажите место или адрес")
    a.onTranscript("Grafton Street", true)
    await flush()
    expect(calls.start).toEqual([{place: expect.objectContaining({name: "Grafton Street"}), mode: "driving"}])
  })

  test("the activator works too: «Вопрос, проведи до …»", async () => {
    const {a, calls} = setupAssistant(["Trinity College Dublin"])
    a.onTranscript("Вопрос", false)
    a.onTranscript("Вопрос, проведи до Тринити-колледжа", true)
    await flush()
    expect(calls.start).toHaveLength(1)
    expect(a.phase).toBe("idle")
  })

  test("in conversation mode someone else's «как дойти до …» is conversation, not a route", async () => {
    const {a, calls} = setupAssistant((system) => (system.includes("навигатору") ? "Trinity College Dublin" : "Q: x\nA: y"), {}, {talkEverySec: 0})
    a.startTalk("ui")
    a.onTranscript("Как дойти до Тринити-колледжа?", true)
    await flush()
    expect(calls.start).toHaveLength(0)
    a.onTranscript("Вопрос, проведи до Тринити-колледжа", true)
    await flush()
    expect(calls.start).toHaveLength(1)
    expect(a.phase).toBe("talk")
  })

  test("no key: the place goes to the map as said", async () => {
    const {a, calls, requests} = setupAssistant([], {places: {"Grafton Street": {name: "Grafton Street", address: "", lat: 1, lng: 2}}}, {apiKey: ""})
    a.onTranscript("Навигатор до Grafton Street", true)
    await flush()
    expect(requests).toHaveLength(0)
    expect(calls.suggest[0].query).toBe("Grafton Street")
    expect(calls.start).toHaveLength(1)
  })

  test("the trip is saved and picked up after a restart", async () => {
    const {a, kv, clock} = setupAssistant(["Trinity College Dublin"])
    a.onTranscript("Проведи до Тринити-колледжа", true)
    await flush()
    const store = new Store(kv)
    const trip = store.loadNav()
    expect(trip?.dest.name).toBe("Trinity College Dublin")

    const {host, calls} = fakeHost()
    const b = new Assistant({store, fetch: (async () => ({})) as any, show: () => {}, clear: () => {}, nav: host, now: clock.now})
    await b.resumeNav(trip, true)
    expect(b.nav.active).toBe(true)
    expect(calls.start).toHaveLength(1)

    // Mentra has no trip running any more: forget it
    const {host: host2, calls: calls2} = fakeHost()
    const c = new Assistant({store, fetch: (async () => ({})) as any, show: () => {}, clear: () => {}, nav: host2, now: clock.now})
    await c.resumeNav(store.loadNav(), false)
    expect(c.nav.active).toBe(false)
    expect(calls2.start).toHaveLength(0)
    expect(store.loadNav()).toBeNull()
  })

  test("without Mentra navigation the command explains itself", () => {
    const store = new Store(new MemKV())
    const shown: string[] = []
    const a = new Assistant({store, fetch: (async () => ({})) as any, show: (t) => void shown.push(t), clear: () => {}})
    a.onTranscript("Проведи до Тринити-колледжа", true)
    expect(shown.at(-1)!.replace(/\n/g, " ")).toBe("Навигация недоступна в этой версии Mentra.")
  })
})
