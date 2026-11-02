/**
 * Background layer: runs inside the Mentra app on the iPhone, owns the glasses session.
 * Glasses mic → Mentra speech-to-text (ru-RU) → Assistant → OpenAI → text pages on G1.
 */
import {registerMiniapp} from "@mentra/miniapp/background"
import {Assistant} from "./assistant"
import type {FetchLike} from "./openai"
import {Store, type KV, type Settings} from "./store"

const APP_VERSION = "__APP_VERSION__"

function getKV(): KV | null {
  try {
    const ls = (globalThis as any).localStorage as KV | undefined
    if (!ls) return null
    ls.getItem("g1gpt.probe")
    return ls
  } catch {
    return null
  }
}

registerMiniapp((session: any) => {
  const store = new Store(getKV())

  let uiTimer: unknown = null
  const pushState = () => {
    if (uiTimer != null) return
    uiTimer = setTimeout(() => {
      uiTimer = null
      try {
        if (session.ui.isOpen()) session.ui.send("state", assistant.snapshot())
      } catch {
        // UI closed
      }
    }, 250)
  }

  const fullBox = () => {
    const d = session.capabilities?.display
    return {x: 0, y: 0, w: d?.width ?? 576, h: d?.height ?? 200}
  }

  const assistant = new Assistant({
    store,
    fetch: ((url, init) => (globalThis as any).fetch(url, init)) as FetchLike,
    show: (text: string) =>
      session.display.render([{type: "text", id: "g1gpt", box: fullBox(), text, style: {breakMode: "word"}}]),
    clear: () => {
      session.display.render([])
    },
    startTranslation: (target, handler) => session.translation.to(target, handler),
    onChange: pushState,
  })

  assistant.addLog("info", `Запущено, версия ${APP_VERSION}`)
  if (!assistant.settings.apiKey) assistant.addLog("info", "Ключ OpenAI не задан — откройте настройки")

  // ── Speech-to-text ─────────────────────────────────────────────
  let unsubscribeStt: (() => void) | null = null
  let sttKey = ""

  const subscribeStt = (s: Settings) => {
    const key = `${s.listenMode}|${s.sttLanguage}|${s.wakeWords.join(",")}`
    if (key === sttKey) return
    sttKey = key
    if (unsubscribeStt) {
      try {
        unsubscribeStt()
      } catch {
        // ignore
      }
      unsubscribeStt = null
    }
    if (s.listenMode === "off") {
      assistant.addLog("info", "Микрофон выключен в настройках")
      return
    }
    if (!session.transcription.hasPermission) {
      assistant.addLog("error", "Нет разрешения MICROPHONE в манифесте")
    }
    try {
      session.transcription
        .configure({
          languageHints: s.sttLanguage === "auto" ? ["ru", "en"] : ["ru"],
          vocabulary: s.wakeWords.slice(0, 10),
        })
        ?.catch?.(() => {})
    } catch (e) {
      assistant.addLog("info", `configure STT пропущен: ${String((e as Error)?.message ?? e)}`)
    }
    const handler = (data: {text: string; isFinal: boolean}) => assistant.onTranscript(data?.text ?? "", Boolean(data?.isFinal))
    try {
      unsubscribeStt =
        s.sttLanguage === "auto" ? session.transcription.on(handler) : session.transcription.forLanguage("ru-RU", handler)
      assistant.addLog("info", `Слушаю (${s.sttLanguage === "auto" ? "русский + английский" : "только русский"})`)
    } catch (e) {
      assistant.addLog("error", `Не удалось включить распознавание: ${String((e as Error)?.message ?? e)}`)
    }
  }
  subscribeStt(assistant.settings)

  // ── Glasses input & status ─────────────────────────────────────
  try {
    session.input.onTouch((t: {kind: string}) => assistant.onTouch(String(t?.kind ?? "")))
  } catch {
    // glasses without a touchpad
  }
  try {
    session.input.onButtonPress((p: {pressType: string}) => assistant.onTouch(p?.pressType === "long" ? "long_press" : "single_tap"))
  } catch {
    // no button
  }
  try {
    session.glasses.onConnection((c: {connected: boolean; modelName?: string}) => {
      assistant.glassesConnected = Boolean(c?.connected)
      assistant.addLog("info", c?.connected ? `Очки подключены${c.modelName ? ": " + c.modelName : ""}` : "Очки отключены")
    })
  } catch {
    // older host
  }
  try {
    session.on?.("ready", () => {
      const d = session.capabilities?.display
      if (d) assistant.addLog("info", `Дисплей ${d.width ?? "?"}×${d.height ?? "?"}${d.canPosition === false ? ", текстовый режим" : ""}`)
    })
  } catch {
    // ignore
  }

  // ── Phone UI (settings screen) ─────────────────────────────────
  session.ui.handle("getState", () => assistant.snapshot())

  session.ui.handle("saveSettings", (patch: Partial<Settings>) => {
    const s = assistant.updateSettings(patch ?? {})
    subscribeStt(s)
    return assistant.snapshot()
  })

  session.ui.handle("ask", async (p: {text: string}) => {
    await assistant.ask(String(p?.text ?? ""), "ui")
    return assistant.snapshot()
  })

  session.ui.handle("command", (p: {cmd: string}) => {
    const cmd = String(p?.cmd ?? "") as any
    if (cmd === "translate") assistant.startTranslation("ui")
    else if (cmd === "translateStop") assistant.stopTranslation("ui")
    else if (["next", "prev", "first", "repeat", "hide", "cancel", "reset"].includes(cmd)) assistant.command(cmd, "ui")
    return assistant.snapshot()
  })

  session.ui.handle("simulateSpeech", (p: {text: string}) => {
    // Lets you test wake phrases and commands by typing, without the glasses mic.
    assistant.onTranscript(String(p?.text ?? ""), true)
    return assistant.snapshot()
  })

  session.ui.handle("testDisplay", async () => {
    const text = "Проверка дисплея G1\nЁжик, йогурт, щука\n«кавычки» — тире, 0123\nLatin text: Hello!\n5-я строка"
    let r: any = null
    try {
      r = await session.display.render([{type: "text", id: "g1gpt", box: fullBox(), text, style: {breakMode: "word"}}], {
        durationMs: 10000,
      })
    } catch (e) {
      assistant.addLog("error", `Тест дисплея: ${String((e as Error)?.message ?? e)}`)
    }
    assistant.addLog(
      "display",
      `Тест дисплея: ${r?.status ?? "нет ответа"}${r?.degraded ? ", текстовый режим" : ""}${r?.reason ? ", " + r.reason : ""}`,
    )
    return assistant.snapshot()
  })

  session.ui.onOpen(() => pushState())
})
