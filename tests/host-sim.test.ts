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

function makeHost(openaiAnswers: string[]) {
  const sent: Env[] = []
  const openaiCalls: any[] = []
  const store = new Map<string, string>()
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
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
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
  expect(subs).toContain("transcription:ru-RU")

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

  h.ev("transcription:ru-RU", {text: "Вопрос, а в понедельник?", isFinal: true})
  await sleep(1900)
  expect(h.openaiCalls.length).toBe(2)
  expect(h.openaiCalls[1].body.input.map((m: any) => m.role)).toEqual(["user", "assistant", "user"])
  expect(h.renders().at(-1)).toBe("Да, в понедельник он открыт.")

  // render requests target the main view with one full-screen text element
  const lastRender = h.sent.filter((e) => e.payload.type === "miniapp_render").at(-1)!.payload
  expect(lastRender.view).toBe("main")
  expect(lastRender.elements[0].box).toEqual({x: 0, y: 0, w: 640, h: 200})
}, 15000)
