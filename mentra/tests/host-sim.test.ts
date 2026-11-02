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

function makeHost(openaiAnswers: string[], store = new Map<string, string>()) {
  const sent: Env[] = []
  const openaiCalls: any[] = []
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
          permissions: {MICROPHONE: true},
          configuration: {},
        },
      })
    } else if (env.requestId) {
      const data = type === "miniapp_render" ? {status: "displayed", degraded: true} : null
      deliver({payload: {type: "miniapp_request_result", ok: true, data}, requestId: env.requestId})
    }
    return null
  }

  const fetch = async (url: string, init: any) => {
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
  return {ctx, sent, openaiCalls, store, ev, renders, uiReplies}
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

  h.ev("transcription:ru-RU", {text: "Слушай, а кто такой Кант?", isFinal: true})
  await sleep(60)
  expect(h.openaiCalls.length).toBe(1)
  expect(h.openaiCalls[0].body.instructions).toContain("суфлёр")
  expect(h.renders().at(-1)).toMatch(/^\? Иммануил Кант\n→ Немецкий философ/)

  h.ev("_ui", {type: "UI_MESSAGE", channel: "getTalk", payload: {}, seq: 3, requestId: "T1"})
  await sleep(30)
  const rec = h.uiReplies().find((e) => e.payload.requestId === "T1")!.payload.payload.result
  expect(rec.notes).toEqual([expect.objectContaining({kind: "qa", q: "Иммануил Кант"})])

  h.ev("transcription:ru-RU", {text: "Стоп беседа.", isFinal: true})
  await sleep(30)
  expect(h.renders().at(-1)).toContain("Беседа выключена")
}, 15000)
