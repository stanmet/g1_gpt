import {describe, expect, test} from "bun:test"
import {Assistant, SILENCE_MS} from "../src/background/assistant"
import {
  alternatingHistory,
  buildAnthropicBody,
  buildGeminiBody,
  explainLLMError,
  extractAnthropicText,
  extractGeminiText,
} from "../src/background/llm"
import {DEFAULT_SETTINGS, Store, type KV} from "../src/background/store"
import {parseSwitchCommand} from "../src/background/voice"

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

const KEYS = {apiKey: "sk-openai-1234567890abcd", anthropicKey: "sk-ant-api03-abcdefghijklmnop", geminiKey: "AIzaSyTestKey1234567890"}

function reply(url: string, text: string) {
  if (url.includes("anthropic.com"))
    return {model: "claude-haiku-5-5", content: [{type: "text", text}], stop_reason: "end_turn", usage: {input_tokens: 50, output_tokens: 9}}
  if (url.includes("googleapis.com"))
    return {
      modelVersion: "gemini-3.8-flash",
      candidates: [{content: {role: "model", parts: [{text: "thinking…", thought: true}, {text}]}, finishReason: "STOP"}],
      usageMetadata: {promptTokenCount: 40, candidatesTokenCount: 8, thoughtsTokenCount: 3},
    }
  return {model: "gpt-6.1-terra", output: [{type: "message", content: [{type: "output_text", text}]}]}
}

function setup(settings: Record<string, unknown> = {}, answers: string[] = []) {
  const kv = new MemKV()
  const store = new Store(kv)
  store.saveSettings({...DEFAULT_SETTINGS, ...KEYS, ...settings} as any)
  let t = 1_700_000_000_000
  let timers: {at: number; fn: () => void; id: number}[] = []
  let seq = 0
  const calls: {url: string; headers: Record<string, string>; body: any}[] = []
  const shown: string[] = []
  const a = new Assistant({
    store,
    fetch: (async (url: string, init: any) => {
      calls.push({url, headers: init.headers, body: JSON.parse(init.body)})
      const raw = JSON.stringify(reply(url, answers.shift() ?? "Ответ."))
      return {ok: true, status: 200, text: async () => raw}
    }) as any,
    show: (x) => {
      shown.push(x)
    },
    clear: () => {
      shown.push("<clear>")
    },
    now: () => t,
    setTimer: (fn, ms) => {
      timers.push({at: t + ms, fn, id: ++seq})
      return seq
    },
    clearTimer: (id) => {
      timers = timers.filter((x) => x.id !== id)
    },
  })
  const advance = async (ms: number) => {
    const end = t + ms
    for (;;) {
      timers.sort((x, y) => x.at - y.at)
      const n = timers[0]
      if (!n || n.at > end) break
      timers.shift()
      t = n.at
      n.fn()
      for (let i = 0; i < 10; i++) await Promise.resolve()
    }
    t = end
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }
  return {a, calls, shown, advance, store, kv}
}

describe("Claude (Anthropic Messages API)", () => {
  test("request: URL, headers, system prompt, fast Haiku settings", async () => {
    const e = setup({provider: "anthropic"}, ["Около 3 часов."])
    e.a.onTranscript("Вопрос, сколько лететь до Рима?", true)
    await e.advance(SILENCE_MS + 10)
    const c = e.calls[0]
    expect(c.url).toBe("https://api.anthropic.com/v1/messages")
    expect(c.headers["x-api-key"]).toBe(KEYS.anthropicKey)
    expect(c.headers["anthropic-version"]).toBe("2023-06-01")
    expect(c.headers.Authorization).toBeUndefined()
    expect(c.body.model).toBe("claude-haiku-5-5")
    expect(c.body.system).toContain("Even Realities G1")
    expect(c.body.messages).toEqual([{role: "user", content: "сколько лететь до Рима?"}])
    expect(c.body.thinking).toEqual({type: "disabled"})
    expect(c.body.output_config).toEqual({effort: "low"})
    expect(c.body.max_tokens).toBeGreaterThanOrEqual(1024)
    expect(e.shown.at(-1)).toBe("Около 3 часов.")
    expect(e.a.history.at(-1)!.by).toBe("anthropic")
  })

  test("Sonnet uses between_tools thinking; Opus only effort; web search tool", () => {
    const s = {...DEFAULT_SETTINGS, anthropicModel: "claude-sonnet-5-5", webSearch: true}
    const b = buildAnthropicBody(s, [], "q")
    expect(b.thinking).toEqual({type: "between_tools"})
    expect(b.tools).toEqual([{type: "web_search_20250305", name: "web_search", max_uses: 3}])
    const o = buildAnthropicBody({...DEFAULT_SETTINGS, anthropicModel: "claude-opus-5-5"}, [], "q")
    expect(o.thinking).toBeUndefined()
    expect(o.output_config).toEqual({effort: "low"})
    const h = buildAnthropicBody({...DEFAULT_SETTINGS, anthropicModel: "claude-opus-5-5", effort: "high"}, [], "q")
    expect(h.output_config).toEqual({effort: "high"})
    expect(h.max_tokens).toBeGreaterThanOrEqual(16000)
  })

  test("answer after web search: only the final text, citations joined", () => {
    const data = {
      content: [
        {type: "text", text: "Сейчас поищу."},
        {type: "server_tool_use", id: "s1", name: "web_search", input: {query: "x"}},
        {type: "web_search_tool_result", tool_use_id: "s1", content: []},
        {type: "text", text: "Рейс длится "},
        {type: "text", text: "около 3 часов", citations: [{type: "web_search_result_location"}]},
        {type: "text", text: "."},
      ],
    }
    expect(extractAnthropicText(data)).toBe("Рейс длится около 3 часов.")
  })

  test("400 about thinking → retried without thinking/effort", async () => {
    const kv = new MemKV()
    const store = new Store(kv)
    store.saveSettings({...DEFAULT_SETTINGS, ...KEYS, provider: "anthropic", anthropicModel: "claude-3-old"} as any)
    const bodies: any[] = []
    const a = new Assistant({
      store,
      fetch: (async (_u: string, init: any) => {
        const b = JSON.parse(init.body)
        bodies.push(b)
        if (b.output_config)
          return {ok: false, status: 400, text: async () => '{"type":"error","error":{"type":"invalid_request_error","message":"output_config.effort: not supported"}}'}
        return {ok: true, status: 200, text: async () => JSON.stringify(reply("https://api.anthropic.com", "ok"))}
      }) as any,
      show: () => {},
      clear: () => {},
    })
    await a.ask("тест", "ui")
    expect(bodies.length).toBe(2)
    expect(bodies[1].output_config).toBeUndefined()
    expect(a.lastAnswer).toBe("ok")
  })
})

describe("Gemini (generateContent)", () => {
  test("request: URL with model, key header, systemInstruction, roles user/model", async () => {
    const e = setup({provider: "gemini"}, ["Канберра.", "Около 450 тысяч человек."])
    e.a.onTranscript("Вопрос, какая столица Австралии?", true)
    await e.advance(SILENCE_MS + 10)
    e.a.onTranscript("Вопрос, а сколько там жителей?", true)
    await e.advance(SILENCE_MS + 10)
    const c = e.calls[1]
    expect(c.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent")
    expect(c.headers["x-goog-api-key"]).toBe(KEYS.geminiKey)
    expect(c.body.systemInstruction.parts[0].text).toContain("Even Realities G1")
    expect(c.body.contents).toEqual([
      {role: "user", parts: [{text: "какая столица Австралии?"}]},
      {role: "model", parts: [{text: "Канберра."}]},
      {role: "user", parts: [{text: "а сколько там жителей?"}]},
    ])
    expect(c.body.generationConfig.thinkingConfig).toEqual({thinkingLevel: "low"})
    expect(e.shown.at(-1)).toBe("Около 450 тысяч человек.")
  })

  test("Flash-Lite uses minimal thinking; search tool; thought parts skipped", () => {
    const b = buildGeminiBody({...DEFAULT_SETTINGS, geminiModel: "gemini-3.5-flash-lite", webSearch: true}, [], "q")
    expect((b.generationConfig as any).thinkingConfig).toEqual({thinkingLevel: "minimal"})
    expect(b.tools).toEqual([{google_search: {}}])
    expect(extractGeminiText({candidates: [{content: {parts: [{text: "x", thought: true}, {text: "Да"}, {text: "."}]}}]})).toBe("Да.")
  })

  test("invalid key message", () => {
    expect(explainLLMError("gemini", 400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.")).toContain("Ключ Gemini не принят")
    expect(explainLLMError("gemini", 429, "RESOURCE_EXHAUSTED", "Quota exceeded")).toContain("Лимит Gemini")
    expect(explainLLMError("anthropic", 400, "invalid_request_error", "Your credit balance is too low")).toContain("нет средств")
    expect(explainLLMError("anthropic", 529, "overloaded_error", "Overloaded")).toContain("перегружен")
    expect(explainLLMError("anthropic", 401, "authentication_error", "invalid x-api-key")).toContain("Ключ Claude не принят")
  })
})

describe("switching AI by voice", () => {
  test("«Клод, …» asks Claude once; «Вопрос, …» uses the default (ChatGPT)", async () => {
    const e = setup({provider: "openai"})
    e.a.onTranscript("Клод, сколько лететь до Рима?", true)
    await e.advance(SILENCE_MS + 10)
    expect(e.calls[0].url).toContain("anthropic.com")
    expect(e.calls[0].body.messages.at(-1).content).toBe("сколько лететь до Рима?")
    e.a.onTranscript("Вопрос, а поездом?", true)
    await e.advance(SILENCE_MS + 10)
    expect(e.calls[1].url).toContain("openai.com")
    // shared context: ChatGPT sees Claude's previous answer
    expect(e.calls[1].body.input.map((m: any) => m.role)).toEqual(["user", "assistant", "user"])
  })

  test("«Джемини» via interim capture routes to Gemini", async () => {
    const e = setup({provider: "openai"})
    e.a.onTranscript("Джемини", false)
    e.a.onTranscript("Джемини, переведи слово apple", true)
    await e.advance(SILENCE_MS + 10)
    expect(e.calls[0].url).toContain("googleapis.com")
    expect(e.calls[0].body.contents.at(-1).parts[0].text).toBe("переведи слово apple")
  })

  test("reply to a counter-question goes back to the AI that asked", async () => {
    const e = setup({provider: "openai"}, ["Из какого города вы вылетаете?", "Около 3 часов."])
    e.a.onTranscript("Клод, сколько лететь до Рима?", true)
    await e.advance(SILENCE_MS + 10)
    e.a.onTranscript("Из Дублина.", true)
    await e.advance(SILENCE_MS + 10)
    expect(e.calls.length).toBe(2)
    expect(e.calls[1].url).toContain("anthropic.com")
  })

  test("«Переключись на Клода» makes Claude the default and is saved", async () => {
    const e = setup({provider: "openai"})
    e.a.onTranscript("Переключись на Клода.", true)
    expect(e.a.settings.provider).toBe("anthropic")
    expect(e.shown.at(-1)).toContain("Теперь отвечает Claude Haiku 5.5")
    expect(new Store(e.kv).loadSettings().provider).toBe("anthropic")
    e.a.onTranscript("Вопрос, привет", true)
    await e.advance(SILENCE_MS + 10)
    expect(e.calls[0].url).toContain("anthropic.com")
  })

  test("switching to an AI without a key warns on the glasses", async () => {
    const e = setup({provider: "openai", geminiKey: ""})
    e.a.onTranscript("Вопрос, переключись на джемини", true)
    expect(e.a.settings.provider).toBe("gemini")
    expect(e.shown.at(-1)).toContain("Нет ключа Gemini")
    e.a.onTranscript("Вопрос, привет", true)
    await e.advance(SILENCE_MS + 10)
    expect(e.calls.length).toBe(0)
    expect(e.shown.at(-1)).toContain("Нет ключа Gemini")
  })

  test.each([
    ["Переключись на Клода", "anthropic"],
    ["используй джемини", "gemini"],
    ["Switch to ChatGPT", "openai"],
    ["Переключи на чат GPT", "openai"],
    ["Переключись на английский", null],
  ])("%s → %s", (text, p) => {
    expect(parseSwitchCommand(text)).toBe(p as any)
  })
})

describe("keys stay on the phone", () => {
  test("snapshot never contains any key", () => {
    const e = setup({provider: "anthropic"})
    const snap = JSON.stringify(e.a.snapshot())
    for (const k of Object.values(KEYS)) expect(snap).not.toContain(k)
    const s: any = e.a.snapshot().settings
    expect(s.keys.anthropic.has).toBe(true)
    expect(s.keys.anthropic.hint).toBe("sk-ant-…mnop")
    expect(s.aiName).toBe("Claude Haiku 5.5")
  })

  test("saving one key keeps the others", () => {
    const e = setup()
    e.a.updateSettings({geminiKey: "AIzaNEWKEY000000000"} as any)
    expect(e.a.settings.apiKey).toBe(KEYS.apiKey)
    expect(e.a.settings.anthropicKey).toBe(KEYS.anthropicKey)
    expect(e.a.settings.geminiKey).toBe("AIzaNEWKEY000000000")
  })

  test("history for Claude/Gemini always alternates and starts with the user", () => {
    const h = [
      {role: "assistant" as const, content: "a0", at: 0},
      {role: "user" as const, content: "u1", at: 1},
      {role: "assistant" as const, content: "a1", at: 1},
      {role: "user" as const, content: "u2", at: 2},
    ]
    expect(alternatingHistory(h, 10).map((m) => m.content)).toEqual(["u1", "a1"])
  })
})

test("Claude key without a workspace: tells how to fix it", async () => {
  const {explainLLMError} = await import("../src/background/llm")
  const msg = explainLLMError(
    "anthropic",
    400,
    "invalid_request_error",
    "This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use.",
  )
  expect(msg).toContain("Workspace")
  expect(msg).toContain("platform.claude.com")
})
