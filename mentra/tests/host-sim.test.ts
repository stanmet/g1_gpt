/**
 * Runs the BUILT background bundle (dist/background/index.js) in a bare JS context
 * that only has the globals MentraOS documents for the background runtime, behind a
 * fake host that speaks the same bridge protocol as the Mentra app (__dispatch /
 * __mentraDeliverBridgeRaw). This checks the real artifact, not the TypeScript source.
 */
import {expect, test} from "bun:test"
import {readFileSync} from "fs"
import vm from "node:vm"
import {join} from "path"

const BUNDLE = join(import.meta.dir, "../dist/background/index.js")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Env = {payload: any; requestId?: string}

/**
 * Exactly what Mentra 3.2.1's iOS polyfill does: native returns the stored string as a JS
 * string, the polyfill JSON.parses it and returns null unless the result is a string.
 */
function iosLocalStorage(store: Map<string, string>) {
  return {
    getItem(key: string) {
      const raw = store.get(String(key))
      if (raw == null) return null
      let v: unknown
      try {
        v = JSON.parse(raw)
      } catch {
        v = raw
      }
      return typeof v === "string" ? v : null
    },
    setItem: (k: string, v: string) => void store.set(String(k), String(v)),
    removeItem: (k: string) => void store.delete(String(k)),
  }
}

/** What the fake Mentra answers to location and navigation requests (the real app's reply shapes). */
const NAV_REPLIES: Record<string, (p: any) => unknown> = {
  miniapp_location_poll: () => ({lat: 53.3498, lng: -6.2603, accuracy: 12, timestamp: Date.now()}),
  miniapp_navigation_place_autocomplete: (p) => ({
    ok: true,
    suggestions: /trinity/i.test(p.query) ? [{placeId: "poi.trinity", mainText: "Trinity College Dublin", secondaryText: "College Green, Dublin 2"}] : [],
  }),
  miniapp_navigation_place_details: (p) => ({
    ok: true,
    place: {placeId: p.placeId, name: "Trinity College Dublin", address: "College Green, Dublin 2", lat: 53.3438, lng: -6.2546},
  }),
  miniapp_navigation_request_permission: () => ({ok: true, accepted: true}),
  miniapp_navigation_compute_route: () => ({
    ok: true,
    routes: [{points: [{lat: 53.3498, lng: -6.2603}, {lat: 53.3438, lng: -6.2546}], totalDistanceMeters: 850, totalDurationSeconds: 660, steps: []}],
  }),
  miniapp_navigation_start: () => ({ok: true}),
  miniapp_navigation_get_state: () => ({ok: true, state: null}),
}

/** A real map tile (Zurich); the fake Mentra serves it for any tile a test asks for. */
const TILE = readFileSync(new URL("./fixtures/zurich-14-8590-5737.pbf.gz", import.meta.url))

/** Mentra's per-app file storage (`session.blob`), in memory. */
function fakeBlobHost() {
  const files = new Map<string, Buffer>()
  const urls: string[] = []
  const handles = new Map<string, {key: string; done: boolean}>()
  const writing = new Map<string, Buffer[]>()
  /** The file the next «pick a file» returns (iOS Files picker), or null = cancelled. */
  const picker: {next: {name: string; bytes: Buffer} | null} = {next: null}
  const meta = (key: string, b: Buffer, name = "") => ({key, name, bytes: b.length, mimeType: "application/octet-stream", uri: "file:///x", createdAt: 0, updatedAt: 0})
  const replies: Record<string, (p: any) => unknown> = {
    miniapp_blob_import: (p) => {
      const f = picker.next
      picker.next = null
      if (!f) return null
      files.set(p.key, f.bytes)
      return meta(p.key, f.bytes, f.name)
    },
    miniapp_blob_create: (p) => {
      writing.set(p.key, [])
      return {key: p.key}
    },
    miniapp_blob_write: (p) => {
      writing.get(p.key)!.push(Buffer.from(p.base64, "base64"))
      return {bytesWritten: 0}
    },
    miniapp_blob_commit: (p) => {
      const b = Buffer.concat(writing.get(p.key) ?? [])
      writing.delete(p.key)
      files.set(p.key, b)
      return meta(p.key, b)
    },
    miniapp_blob_set_from_url: (p) => {
      urls.push(p.url)
      files.set(p.key, TILE)
      return {key: p.key, bytes: TILE.length, mimeType: "application/x-protobuf", uri: "file:///x", createdAt: 0, updatedAt: 0}
    },
    miniapp_blob_list: () => ({blobs: [...files.entries()].map(([key, b]) => ({key, bytes: b.length}))}),
    miniapp_blob_open_read: (p) => {
      const handle = `h${handles.size}`
      handles.set(handle, {key: p.key, done: false})
      return {handle, meta: {key: p.key, bytes: files.get(p.key)?.length ?? 0}}
    },
    miniapp_blob_read: (p) => {
      const h = handles.get(p.handle)!
      const b = files.get(h.key)!
      return {base64: b.toString("base64"), done: true}
    },
    miniapp_blob_close_read: () => null,
    miniapp_blob_delete: (p) => void files.delete(p.key),
  }
  return {files, urls, replies, picker}
}

/** Open-Meteo's answer shape (forecast), trimmed. */
const FORECAST = {
  current: {time: "2026-11-18T14:00", temperature_2m: 9.2, apparent_temperature: 6.1, precipitation: 0.2, weather_code: 61, wind_speed_10m: 5.5},
  daily: {time: ["2026-11-18"], weather_code: [61], temperature_2m_max: [10], temperature_2m_min: [5], precipitation_probability_max: [80], precipitation_sum: [3.2]},
}

function makeHost(openaiAnswers: string[], store = new Map<string, string>(), opts: {calendar?: boolean} = {}) {
  const sent: Env[] = []
  const openaiCalls: any[] = []
  const webCalls: string[] = []
  const blobHost = fakeBlobHost()
  let ctx: any

  const deliver = (env: Env) => setTimeout(() => ctx.__mentraDeliverBridgeRaw?.(JSON.stringify(env)), 0)

  const __dispatch = (iface: string, method: string, argsJson: string) => {
    if (iface !== "__bridge" || method !== "send") return null
    const [raw] = JSON.parse(argsJson)
    const env: Env = JSON.parse(raw)
    sent.push(env)
    const type = env.payload?.type
    if (type === "miniapp_connect") {
      deliver({
        payload: {
          type: "miniapp_connect_ack",
          userId: "u1",
          packageName: "com.g1gpt.assistant",
          capabilities: {modelName: "Even Realities G1", display: {width: 640, height: 200, canPosition: false}},
          visibility: "foreground",
          // canonical names, as Mentra sends them (computed from the installed miniapp.json)
          permissions: {microphone: true, location: true, camera: false, notifications: false, calendar: opts.calendar === true},
          configuration: {},
        },
      })
    } else if (env.requestId) {
      const calendar = (p: any) => ({
        events: [{id: "e1", calendarId: "c", title: "Стоматолог", startsAt: new Date(new Date(p.startsAt).getTime() + 10 * 3600_000).toISOString(), endsAt: new Date(new Date(p.startsAt).getTime() + 11 * 3600_000).toISOString(), allDay: false, links: []}],
        truncated: false,
      })
      const data =
        type === "miniapp_render"
          ? {status: "displayed", degraded: true}
          : type === "miniapp_calendar_list_events"
            ? calendar(env.payload)
            : ((NAV_REPLIES[type] ?? blobHost.replies[type])?.(env.payload) ?? null)
      deliver({payload: {type: "miniapp_request_result", ok: true, data}, requestId: env.requestId})
    }
    return null
  }

  const fetch = async (url: string, init: any) => {
    if (/open-meteo\.com/.test(url)) {
      webCalls.push(url)
      const raw = JSON.stringify(FORECAST)
      return {ok: true, status: 200, text: async () => raw, json: async () => JSON.parse(raw)}
    }
    if (/openfreemap/.test(url)) {
      const raw = JSON.stringify({tiles: ["https://tiles.openfreemap.org/planet/20251101_001001_pt/{z}/{x}/{y}.pbf"]})
      return {ok: true, status: 200, text: async () => raw, json: async () => JSON.parse(raw)}
    }
    openaiCalls.push({url, init, body: JSON.parse(init.body)})
    const text = openaiAnswers.shift() ?? "Готово."
    const raw = JSON.stringify({model: "gpt-6.1-terra", output: [{type: "message", content: [{type: "output_text", text}]}]})
    return {ok: true, status: 200, text: async () => raw, json: async () => JSON.parse(raw)}
  }

  // Only what https://docs.mentraglass.com/app-devs/core-concepts/two-layer-architecture lists.
  ctx = vm.createContext({
    console: {log() {}, info() {}, warn() {}, error: (...a: any[]) => console.error("[bg]", ...a), debug() {}, trace() {}},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    fetch,
    WebSocket: undefined,
    localStorage: iosLocalStorage(store),
    crypto: {getRandomValues: (a: any) => crypto.getRandomValues(a), randomUUID: () => crypto.randomUUID()},
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    AbortController,
    AbortSignal,
    __dispatch,
  })
  ctx.globalThis = ctx

  const ev = (streamType: string, data: unknown) => deliver({payload: {type: "miniapp_event", streamType, data}})
  const renders = () => sent.filter((e) => e.payload?.type === "miniapp_render").map((e) => e.payload.elements?.[0]?.text ?? "<clear>")
  const uiReplies = () => sent.filter((e) => e.payload?.type === "UI_SEND")
  const bitmaps = () => sent.filter((e) => e.payload?.type === "miniapp_display" && e.payload.layout?.layoutType === "bitmap_view").map((e) => e.payload.layout.data as string)
  return {ctx, sent, openaiCalls, webCalls, blobHost, store, ev, renders, uiReplies, bitmaps}
}

test("built bundle: G1 transcript → OpenAI → render, follow-up keeps context", async () => {
  const h = makeHost([
    "Колизей открывается в 9:00 и закрывается за час до заката. Билет около 18 евро, его лучше купить онлайн заранее, чтобы не стоять в длинной очереди у входа. Утром народу меньше всего, а в жару обязательно возьмите с собой воду.",
    "Да, в понедельник он открыт.",
  ])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  expect(typeof h.ctx.__mentraInitCallback).toBe("function")
  h.ctx.__mentraInitCallback("session-1")
  await sleep(50)

  // handshake + subscriptions
  expect(h.sent[0].payload.type).toBe("miniapp_connect")
  const subs = h.sent.filter((e) => e.payload.type === "miniapp_subscribe").at(-1)!.payload.subscriptions
  // bilingual recognition: auto-detect with Russian + English hints
  expect(subs).toContain("transcription:auto")
  expect(subs).toContain("head_position") // G1 head-up sensor for hands-free paging
  const cfg = h.sent.find((e) => e.payload.type === "miniapp_transcription_config")
  expect(cfg?.payload.config.languageHints).toEqual(["ru", "en"])

  // phone UI: save the API key (RPC over the _ui stream)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", payload: {apiKey: "sk-test-abcdefghijklmnop"}, seq: 1, requestId: "r1"})
  await sleep(50)
  const reply = h.uiReplies().find((e) => e.payload.requestId === "r1")
  expect(reply).toBeDefined()
  expect(JSON.stringify(reply)).not.toContain("sk-test-abcdefghijklmnop") // key never echoed to the UI
  expect([...h.store.values()].join()).toContain("sk-test-abcdefghijklmnop") // stored on the phone

  // speech from the glasses mic
  h.ev("transcription:ru-RU", {text: "Вопрос, во сколько", isFinal: false})
  h.ev("transcription:ru-RU", {text: "Вопрос, во сколько открывается Колизей?", isFinal: true})
  await sleep(1900)

  expect(h.openaiCalls.length).toBe(1)
  expect(h.openaiCalls[0].url).toBe("https://api.openai.com/v1/responses")
  expect(h.openaiCalls[0].init.headers.Authorization).toBe("Bearer sk-test-abcdefghijklmnop")
  expect(typeof h.openaiCalls[0].init.body).toBe("string") // the bridge only supports string bodies
  expect(h.openaiCalls[0].body.input).toEqual([{role: "user", content: "во сколько открывается Колизей?"}])

  const r = h.renders()
  expect(r).toContain("Слушаю…")
  const answer = r.at(-1)!
  expect(answer.split("\n").length).toBeLessThanOrEqual(5)
  expect(answer).toMatch(/^Колизей открывается/)
  expect(answer).toMatch(/1\/\d · дальше$/)

  h.ev("transcription:ru-RU", {text: "Дальше", isFinal: true})
  await sleep(30)
  expect(h.renders().at(-1)).toMatch(/2\/\d · /)

  // Bluetooth remote while the app is open: the UI sends the command with source "key"
  h.ev("_ui", {type: "UI_MESSAGE", channel: "command", payload: {cmd: "prev", source: "key"}, seq: 2, requestId: "c1"})
  await sleep(30)
  expect(h.renders().at(-1)).toMatch(/1\/\d · /)
  // looking up: Mentra forwards the G1 head-up event as head_position
  h.ev("head_position", {position: "up", timestamp: Date.now()})
  await sleep(30)
  expect(h.renders().at(-1)).toMatch(/2\/\d · /)
  h.ev("head_position", {position: "down", timestamp: Date.now()})

  h.ev("transcription:ru-RU", {text: "Вопрос, а в понедельник?", isFinal: true})
  await sleep(1900)
  expect(h.openaiCalls.length).toBe(2)
  expect(h.openaiCalls[1].body.input.map((m: any) => m.role)).toEqual(["user", "assistant", "user"])
  expect(h.renders().at(-1)).toBe("Да, в понедельник он открыт.")

  // live translation over the real SDK bridge: «Транслейт» → translation:*:ru-RU subscription
  h.ev("transcription:ru-RU", {text: "Транслейт.", isFinal: true})
  await sleep(50)
  const subs2 = h.sent.filter((e) => e.payload.type === "miniapp_subscribe").at(-1)!.payload.subscriptions
  expect(subs2).toContain("translation:*:ru-RU")
  expect(h.renders().at(-1)).toContain("Перевод включён")
  h.ev("translation:en-US:ru-RU", {text: "Добрый день, чем могу помочь?", isFinal: true, sourceLanguage: "en", targetLanguage: "ru-RU", originalText: "Good afternoon, how can I help?", utteranceId: "a1"})
  await sleep(50)
  expect(h.renders().at(-1)).toBe("Добрый день, чем могу помочь?")
  h.ev("transcription:ru-RU", {text: "Стоп перевод", isFinal: true})
  await sleep(50)
  const subs3 = h.sent.filter((e) => e.payload.type === "miniapp_subscribe").at(-1)!.payload.subscriptions
  expect(subs3).not.toContain("translation:*:ru-RU")
  expect(h.renders().at(-1)).toContain("Перевод выключен")

  // render requests target the main view with one full-screen text element
  const lastRender = h.sent.filter((e) => e.payload.type === "miniapp_render").at(-1)!.payload
  expect(lastRender.view).toBe("main")
  expect(lastRender.elements[0].box).toEqual({x: 0, y: 0, w: 640, h: 200})
}, 15000)

test("API keys and settings survive a Mentra restart (iOS localStorage polyfill)", async () => {
  const disk = new Map<string, string>()
  const boot = async () => {
    const h = makeHost(["Ответ."], disk)
    vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
    h.ctx.__mentraInitCallback("s")
    await sleep(50)
    h.ev("_ui", {type: "UI_OPEN"})
    return h
  }
  const first = await boot()
  first.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", seq: 1, requestId: "k1",
    payload: {apiKey: "sk-test-abcdefghijklmnop", anthropicKey: "sk-ant-api03-abcdefghijklmnop", aboutMe: "Живу в Дублине"}})
  await sleep(50)

  // Mentra is closed and opened again: a fresh JS context, same phone storage
  const second = await boot()
  second.ev("_ui", {type: "UI_MESSAGE", channel: "getState", seq: 1, requestId: "g1", payload: {}})
  await sleep(50)
  const reply = second.uiReplies().find((e) => e.payload.requestId === "g1")!
  const st = JSON.stringify(reply.payload)
  expect(st).toContain('"hasKey":true')
  expect(st).toContain("sk-…mnop")
  expect(st).toContain("sk-ant-…mnop")
  expect(st).toContain("Живу в Дублине")
  expect(st).not.toContain("sk-test-abcdefghijklmnop") // the key itself is never sent to the UI
  const log = second.sent.filter((e) => e.payload.type === "UI_SEND").map((e) => JSON.stringify(e.payload)).join()
  expect(log + st).toContain("Хранилище на телефоне работает")
}, 15000)

test("built bundle: lecture mode — lecturer's question answered, notes kept, stop", async () => {
  const h = makeHost(["Q: Энтропия льда при таянии?\nA: Растёт: молекулы движутся свободнее."])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", payload: {apiKey: "sk-test-abcdefghijklmnop"}, seq: 1, requestId: "r1"})
  await sleep(30)

  h.ev("transcription:ru-RU", {text: "Лекция.", isFinal: true})
  await sleep(30)
  expect(h.renders().at(-1)).toContain("Режим лекции")

  h.ev("transcription:en-US", {text: "So what happens to the entropy of ice when it melts?", isFinal: true})
  await sleep(60)
  expect(h.openaiCalls.length).toBe(1)
  expect(h.openaiCalls[0].body.instructions).toContain("обратился к аудитории")
  expect(h.renders().at(-1)).toMatch(/^\? Энтропия льда.*\n→ Растёт/s)

  h.ev("_ui", {type: "UI_MESSAGE", channel: "getLecture", payload: {}, seq: 2, requestId: "L1"})
  await sleep(30)
  const rec = h.uiReplies().find((e) => e.payload.requestId === "L1")!.payload.payload.result
  expect(rec.notes).toEqual([expect.objectContaining({kind: "qa", text: "Растёт: молекулы движутся свободнее."})])

  h.ev("_ui", {type: "UI_MESSAGE", channel: "command", payload: {cmd: "lectureStop"}, seq: 3, requestId: "c1"})
  await sleep(30)
  expect(h.renders().at(-1)).toContain("Лекция выключена")
}, 15000)

test("built bundle: conversation mode — a question in the conversation gets facts on the glasses", async () => {
  const h = makeHost(["Q: Иммануил Кант\nA: Немецкий философ, 1724–1804, автор «Критики чистого разума»."])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", payload: {apiKey: "sk-test-abcdefghijklmnop"}, seq: 1, requestId: "r1"})
  await sleep(30)

  h.ev("_ui", {type: "UI_MESSAGE", channel: "command", payload: {cmd: "talk"}, seq: 2, requestId: "c1"})
  await sleep(30)
  expect(h.renders().at(-1)).toContain("Режим беседы")

  // answered from the live (interim) text, before the recognizer closes the utterance
  h.ev("transcription:ru-RU", {text: "Слушай, а кто такой Кант?", isFinal: false})
  await sleep(60)
  expect(h.openaiCalls.length).toBe(1)
  h.ev("transcription:ru-RU", {text: "Слушай, а кто такой Кант?", isFinal: true})
  await sleep(60)
  expect(h.openaiCalls.length).toBe(1)
  expect(h.openaiCalls[0].body.instructions).toContain("суфлёр")
  expect(h.renders().at(-1)).toMatch(/^• Иммануил Кант: Немецкий философ/)

  h.ev("_ui", {type: "UI_MESSAGE", channel: "getTalk", payload: {}, seq: 3, requestId: "T1"})
  await sleep(30)
  const rec = h.uiReplies().find((e) => e.payload.requestId === "T1")!.payload.payload.result
  expect(rec.notes).toEqual([expect.objectContaining({kind: "qa", q: "Иммануил Кант"})])

  h.ev("transcription:ru-RU", {text: "Стоп беседа.", isFinal: true})
  await sleep(30)
  expect(h.renders().at(-1)).toContain("Беседа выключена")
}, 15000)

test("built bundle: «как будет на английском …» without the activator", async () => {
  const h = makeHost(["table"])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", payload: {apiKey: "sk-test-abcdefghijklmnop"}, seq: 1, requestId: "r1"})
  await sleep(30)
  h.ev("transcription:ru-RU", {text: "Как будет на английском стол?", isFinal: true})
  await sleep(60)
  expect(h.openaiCalls.length).toBe(1)
  expect(h.openaiCalls[0].body.input).toEqual([{role: "user", content: "стол"}])
  expect(h.renders().at(-1)).toBe("стол → table")
}, 15000)

test("built bundle: Mentra's speaker label reaches the app («голос 1»)", async () => {
  const h = makeHost([])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("transcription:ru-RU", {type: "transcription", text: "Вопрос, привет", isFinal: true, speakerId: "1"})
  await sleep(30)
  h.ev("_ui", {type: "UI_MESSAGE", channel: "getState", payload: {}, seq: 1, requestId: "g1"})
  await sleep(30)
  const st = h.uiReplies().find((e) => e.payload.requestId === "g1")!.payload.payload.result
  expect(st.ownerVoice).toBe("1")
  expect(st.log.some((l: any) => l.msg === "[голос 1] Вопрос, привет")).toBe(true)
}, 15000)

test("built bundle: navigator — «Проведи до Тринити-колледжа» → Mentra search and route → turns on the glasses", async () => {
  const h = makeHost(["Trinity College Dublin"])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  // text screens here; the map picture has its own test below
  h.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", payload: {apiKey: "sk-test-abcdefghijklmnop", navMap: false}, seq: 1, requestId: "r1"})
  await sleep(30)

  h.ev("transcription:ru-RU", {text: "Проведи до Тринити-колледжа пешком.", isFinal: true})
  await sleep(120)
  const types = h.sent.map((e) => e.payload?.type)
  // the name goes through the AI, then Mentra's map search near the user, then its navigator
  expect(h.openaiCalls).toHaveLength(1)
  const auto = h.sent.find((e) => e.payload?.type === "miniapp_navigation_place_autocomplete")!.payload
  expect(auto.query).toBe("Trinity College Dublin")
  expect(auto.near).toEqual({lat: 53.3498, lng: -6.2603})
  const details = h.sent.find((e) => e.payload?.type === "miniapp_navigation_place_details")!.payload
  expect(details.sessionToken).toBe(auto.sessionToken)
  expect(types).toContain("miniapp_navigation_request_permission")
  const start = h.sent.find((e) => e.payload?.type === "miniapp_navigation_start")!.payload
  expect(start).toMatchObject({lat: 53.3438, lng: -6.2546, mode: "walking"})
  expect(h.renders()).toContain("Ищу: Тринити-колледжа…")
  expect(h.renders().at(-1)).toMatch(/^Маршрут до Trinity College Dublin\nпешком/)

  // Mentra's live updates
  await sleep(4800)
  h.ev("navigation_update", {kind: "maneuver", maneuverType: "TURN_RIGHT", distanceMeters: 140, nextStepRoad: "Grafton Street", distanceToDestinationMeters: 850, timeToDestinationSeconds: 660})
  await sleep(30)
  expect(h.renders().at(-1)).toBe("→ Направо через 140 м\nна Grafton Street\nTrinity College Dublin: 850 м, 11 мин")

  h.ev("_ui", {type: "UI_MESSAGE", channel: "getState", payload: {}, seq: 2, requestId: "g1"})
  await sleep(30)
  const st = h.uiReplies().find((e) => e.payload.requestId === "g1")!.payload.payload.result
  expect(st.nav).toMatchObject({active: true, problem: "", left: "850 м, 11 мин", dest: {name: "Trinity College Dublin"}})

  // stop from the phone
  h.ev("_ui", {type: "UI_MESSAGE", channel: "navStop", payload: {}, seq: 3, requestId: "n1"})
  await sleep(30)
  expect(h.sent.some((e) => e.payload?.type === "miniapp_navigation_stop")).toBe(true)
  expect(h.renders().at(-1)).toBe("<clear>")
}, 15000)

test("built bundle: navigator search from the phone", async () => {
  const h = makeHost([])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "navSearch", payload: {query: "Trinity College"}, seq: 1, requestId: "s1"})
  await sleep(60)
  const res = h.uiReplies().find((e) => e.payload.requestId === "s1")!.payload.payload.result
  expect(res).toEqual({ok: true, results: [{placeId: "poi.trinity", mainText: "Trinity College Dublin", secondaryText: "College Green, Dublin 2"}]})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "navGo", payload: {...res.results[0], mode: "cycling"}, seq: 2, requestId: "s2"})
  await sleep(80)
  expect(h.sent.find((e) => e.payload?.type === "miniapp_navigation_start")!.payload).toMatchObject({mode: "cycling", lat: 53.3438})
}, 15000)

test("built bundle: navigator map — the route as a G1 picture, map tiles kept on the phone", async () => {
  const h = makeHost([])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "navGo", payload: {placeId: "poi.trinity", mainText: "Trinity College Dublin", secondaryText: "", mode: "walking"}, seq: 1, requestId: "g"})
  await sleep(120)
  // Mentra sends the route line and positions during the trip (here: by the lake in Zurich, where the test tile is)
  h.ev("navigation_route", {points: [{lat: 47.3462, lng: 8.7550}, {lat: 47.3470, lng: 8.7560}, {lat: 47.3480, lng: 8.7575}]})
  h.ev("location_update", {lat: 47.3462, lng: 8.7550, accuracy: 8})
  await sleep(200)
  // tiles are downloaded straight into Mentra's file storage, from the address in OpenFreeMap's TileJSON
  expect(h.blobHost.urls.length).toBeGreaterThan(0)
  expect(h.blobHost.urls[0]).toMatch(/^https:\/\/tiles\.openfreemap\.org\/planet\/20251101_001001_pt\/14\/\d+\/\d+\.pbf$/)
  await sleep(4800)
  h.ev("navigation_update", {kind: "maneuver", maneuverType: "TURN_RIGHT", distanceMeters: 140, nextStepRoad: "Seestrasse", distanceToDestinationMeters: 850, timeToDestinationSeconds: 660})
  await sleep(1700)
  const pics = h.bitmaps()
  expect(pics.length).toBeGreaterThan(0)
  const bmp = Buffer.from(pics.at(-1)!, "base64")
  expect(bmp.subarray(0, 2).toString()).toBe("BM")
  expect(bmp.length).toBe(9782)
  expect(bmp.readUInt32LE(18)).toBe(576)
  expect(bmp.readUInt32LE(22)).toBe(135)
  expect(bmp.readUInt16LE(28)).toBe(1)

  h.ev("_ui", {type: "UI_MESSAGE", channel: "getState", payload: {}, seq: 2, requestId: "st"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "navMap", payload: {}, seq: 3, requestId: "map"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "navFrame", payload: {}, seq: 4, requestId: "fr"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "mapTile", payload: {z: 14, x: 8590, y: 5737}, seq: 5, requestId: "tile"})
  await sleep(60)
  const result = (id: string) => h.uiReplies().find((e) => e.payload.requestId === id)!.payload.payload.result
  const st = result("st")
  expect(st).toMatchObject({glassesBitmap: true, nav: {map: true, canMap: true}, maps: {available: true}})
  expect(st.nav.streets).toBeGreaterThan(10) // roads, water, parks from the tile
  expect(st.maps.tiles).toBeGreaterThan(0)
  expect(result("map")).toMatchObject({active: true, me: [47.3462, 8.755]})
  expect(result("map").route).toHaveLength(3)
  expect(result("fr").frame).toBe(pics.at(-1))
  // the phone map gets the tile file as base64
  expect(Buffer.from(result("tile").b64, "base64").equals(TILE)).toBe(true)

  // the test picture from the phone
  h.ev("_ui", {type: "UI_MESSAGE", channel: "navTestBitmap", payload: {}, seq: 6, requestId: "t"})
  await sleep(30)
  expect(result("t")).toEqual({ok: true})
  expect(h.bitmaps().length).toBe(pics.length + 1)
}, 20000)

test("built bundle: offline map — download an area, see progress, delete it", async () => {
  const h = makeHost([])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "mapEstimate", payload: {lat: 47.3462, lng: 8.755}, seq: 1, requestId: "e"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "mapDownload", payload: {lat: 47.3462, lng: 8.755, radiusKm: 2}, seq: 2, requestId: "d"})
  await sleep(400)
  const result = (id: string) => h.uiReplies().find((e) => e.payload.requestId === id)!.payload.payload.result
  expect(result("e")["2"]).toBeGreaterThan(0)
  expect(result("d")).toEqual({ok: true})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "getState", payload: {}, seq: 3, requestId: "s"})
  await sleep(40)
  const maps = result("s").maps
  expect(maps.download).toBeNull()
  expect(maps.areas).toHaveLength(1)
  expect(maps.areas[0].name).not.toMatch(/^\d/)
  expect(maps.tiles).toBe(h.blobHost.files.size)
  h.ev("_ui", {type: "UI_MESSAGE", channel: "mapDelete", payload: {id: maps.areas[0].id}, seq: 4, requestId: "x"})
  await sleep(100)
  expect(result("x").maps.areas).toHaveLength(0)
  expect(h.blobHost.files.size).toBe(0)
}, 20000)

test("built bundle: weather, calendar and «Где я?» through the real SDK bridge", async () => {
  const h = makeHost(["Возьмите зонт.", "Завтра в 10 — стоматолог."], new Map(), {calendar: true})
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", payload: {apiKey: "sk-test-abcdefghijklmnop"}, seq: 1, requestId: "k"})
  await sleep(30)

  // the weather where you are: Mentra's location, then Open-Meteo, then the AI
  h.ev("transcription:ru-RU", {text: "Вопрос, нужен ли сегодня зонт?", isFinal: true})
  await sleep(2200)
  expect(h.sent.some((e) => e.payload?.type === "miniapp_location_poll")).toBe(true)
  expect(h.webCalls[0]).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=53\.35&longitude=-6\.26&/)
  expect(h.openaiCalls).toHaveLength(1)
  const sys = h.openaiCalls[0].body.instructions as string
  expect(sys).toContain("Погода — там, где пользователь (Open-Meteo), сейчас 14:00: 9 °C")
  expect(sys).toContain("Где пользователь сейчас (GPS телефона, точность ±12 м)")
  expect(h.renders().at(-1)).toBe("Возьмите зонт.")

  // plans: Mentra's calendar request for tomorrow
  h.ev("transcription:ru-RU", {text: "Вопрос, что у меня завтра?", isFinal: true})
  await sleep(2200)
  const req = h.sent.find((e) => e.payload?.type === "miniapp_calendar_list_events")!.payload
  expect(new Date(req.endsAt).getTime() - new Date(req.startsAt).getTime()).toBe(24 * 3600_000)
  expect(h.openaiCalls[1].body.instructions).toContain("Календарь телефона (завтра):")
  expect(h.openaiCalls[1].body.instructions).toContain("Стоматолог")

  // «Где я?» without the activator: no AI, the coordinates on the glasses
  h.ev("transcription:ru-RU", {text: "Где я?", isFinal: true})
  await sleep(300)
  expect(h.openaiCalls).toHaveLength(2)
  expect(h.renders().at(-1)).toContain("53.34980, -6.26030 ±12 м")

  h.ev("_ui", {type: "UI_MESSAGE", channel: "getState", payload: {}, seq: 2, requestId: "st"})
  await sleep(30)
  const st = h.uiReplies().find((e) => e.payload.requestId === "st")!.payload.payload.result
  expect(st.context).toEqual({location: true, calendar: true})
  expect(st.guide).toMatchObject({active: false, available: true})
  expect(st.version).toBe("1.17.0")
}, 15000)

test("built bundle: books — EPUB and PDF added through Mentra's file picker, answers only from them", async () => {
  const BOOKS = new URL("./fixtures/books/", import.meta.url)
  const h = makeHost(["Штольц, построили, 1874, инженер, чертежи", "Маяк построили в 1874 году по чертежам инженера Карла Штольца (гл. 1)."])
  vm.runInContext(readFileSync(BUNDLE, "utf8"), h.ctx, {filename: "background/index.js"})
  h.ctx.__mentraInitCallback("s")
  await sleep(50)
  h.ev("_ui", {type: "UI_OPEN"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "saveSettings", payload: {apiKey: "sk-test-abcdefghijklmnop", useLocation: false}, seq: 1, requestId: "k"})
  await sleep(30)
  const result = (id: string) => h.uiReplies().find((e) => e.payload.requestId === id)?.payload.payload.result

  // EPUB: picked, read, split into pieces, kept as text; the picked file itself is removed
  h.blobHost.picker.next = {name: "mayak.epub", bytes: readFileSync(new URL("mayak.epub", BOOKS))}
  h.ev("_ui", {type: "UI_MESSAGE", channel: "bookImport", payload: {}, seq: 2, requestId: "imp"})
  await sleep(300)
  expect(result("imp")).toMatchObject({ok: true, title: "Маяк на Северном мысе"})
  const keys = [...h.blobHost.files.keys()]
  expect(keys.filter((k) => k.startsWith("books/src/"))).toEqual([])
  expect(keys.filter((k) => /^books\/b\w+\.json$/.test(k))).toHaveLength(1)

  // PDF: the bytes go to the phone screen, its pages come back
  const pdf = readFileSync(new URL("mayak.pdf", BOOKS))
  h.blobHost.picker.next = {name: "mayak.pdf", bytes: pdf}
  h.ev("_ui", {type: "UI_MESSAGE", channel: "bookImport", payload: {}, seq: 3, requestId: "pdf"})
  await sleep(100)
  const r = result("pdf")
  expect(r).toMatchObject({ok: true, pdf: true, name: "mayak.pdf", size: pdf.length})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "bookPdfBytes", payload: {id: r.id, offset: 0, length: 524288}, seq: 4, requestId: "bytes"})
  await sleep(50)
  expect(Buffer.from(result("bytes").b64, "base64").equals(pdf)).toBe(true)
  const page = (t: string) => `${t}\n\nСмотритель Ефим Громов служил на маяке сорок лет и каждую ночь записывал в журнал погоду и проходящие суда.`
  h.ev("_ui", {type: "UI_MESSAGE", channel: "bookPdfPages", payload: {id: r.id, start: 0, pages: ["Маяк на Северном мысе", page("Глава 1"), page("Глава 2"), page("Глава 3")], total: 4}, seq: 5, requestId: "pg"})
  h.ev("_ui", {type: "UI_MESSAGE", channel: "bookPdfDone", payload: {id: r.id, title: "Microsoft Word - mayak.docx", outline: [{title: "Глава 1", page: 2}, {title: "Глава 2", page: 3}]}, seq: 6, requestId: "done"})
  await sleep(200)
  expect(result("done")).toMatchObject({ok: true, title: "mayak"})

  // the mode, then a question answered only from the books
  h.ev("_ui", {type: "UI_MESSAGE", channel: "booksMode", payload: {on: true}, seq: 7, requestId: "mode"})
  await sleep(30)
  const st = result("mode")
  expect(st.books.mode).toBe(true)
  expect(st.books.list.map((b: any) => [b.title, b.format, b.pages ?? 0])).toEqual([["mayak", "pdf", 4], ["Маяк на Северном мысе", "epub", 0]])
  h.ev("transcription:ru-RU", {text: "Вопрос, кто построил маяк?", isFinal: true})
  await sleep(2300)
  expect(h.openaiCalls).toHaveLength(2)
  expect(h.openaiCalls[0].body.instructions).toContain("поиск по тексту книг")
  expect(h.openaiCalls[1].body.instructions).toContain("ТОЛЬКО эти отрывки")
  expect(h.openaiCalls[1].body.input.at(-1).content).toContain("«Маяк на Северном мысе», Глава 1. Камни и чертежи:")
  expect(h.renders().at(-1)).toContain("Карла Штольца")

  // delete
  h.ev("_ui", {type: "UI_MESSAGE", channel: "bookDelete", payload: {id: r.id}, seq: 8, requestId: "del"})
  await sleep(50)
  expect(result("del").books.list).toHaveLength(1)
}, 15000)
