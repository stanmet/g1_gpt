/**
 * Background layer: runs inside the Mentra app on the iPhone, owns the glasses session.
 * Glasses mic → Mentra speech-to-text (Russian + English) → Assistant (questions, translation,
 * lecture, conversation) → ChatGPT / Claude / Gemini → text on the G1 display.
 */
import {registerMiniapp} from "@mentra/miniapp/background"
import {Assistant} from "./assistant"
import {asProvider, keyFor, PROVIDERS} from "./llm"
import type {NavHost, Place, TravelMode} from "./navigator"
import type {FetchLike} from "./openai"
import {Store, type KV, type Settings} from "./store"

const APP_VERSION = "__APP_VERSION__"

/** Mapbox-style session token: groups a search and the pick that follows it. */
function newToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const asMode = (m: unknown): TravelMode => (m === "driving" || m === "cycling" ? m : "walking")

/**
 * Mentra's location, place search (its cloud maps service) and native navigator. Needs LOCATION
 * in miniapp.json — Mentra takes the permission list from the manifest it installed, so an app
 * updated without reinstalling may not have it yet.
 */
function makeNavHost(session: any, log: (msg: string) => void): NavHost | undefined {
  const nav = session.navigation
  if (!nav || typeof nav.start !== "function") return undefined
  let token = newToken()
  let termsAsked = false
  let lastFix: {lat: number; lng: number; at: number} | null = null
  return {
    problem: () =>
      nav.hasPermission === false
        ? "нет разрешения на геопозицию — загрузите EVA-IA заново: Mentra → Settings → Miniapp Developer Settings → Load Miniapp from URL"
        : "",
    async locate() {
      if (lastFix && Date.now() - lastFix.at < 60_000) return {lat: lastFix.lat, lng: lastFix.lng}
      const fix = await session.location.getOnce()
      const lat = Number(fix?.lat)
      const lng = Number(fix?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      lastFix = {lat, lng, at: Date.now()}
      return {lat, lng}
    },
    async suggest(query, near) {
      token = newToken()
      const r = await nav.placeAutocomplete({query, near: near ?? undefined, sessionToken: token})
      if (!r?.ok) throw new Error(r?.error || "place search failed")
      return (r.suggestions ?? []).filter((x: any) => x?.placeId)
    },
    async details(placeId) {
      const r = await nav.placeDetails({placeId, sessionToken: token})
      if (!r?.ok || !r.place) return null
      const p = r.place
      return {name: String(p.name ?? ""), address: String(p.address ?? ""), lat: Number(p.lat), lng: Number(p.lng)}
    },
    async start(place, mode) {
      if (!termsAsked) {
        termsAsked = true
        try {
          // Mentra may first show the navigation terms (Google Navigation SDK) on the phone
          const pr = await nav.requestPermission()
          if (pr && pr.ok && pr.accepted === false) {
            termsAsked = false
            return {ok: false, error: "terms not accepted"}
          }
          if (pr && !pr.ok && pr.error) log(`Навигация: ${pr.error}`)
        } catch (e) {
          log(`Навигация: условия не запрошены (${String((e as Error)?.message ?? e)})`)
        }
      }
      return nav.start({lat: place.lat, lng: place.lng, mode})
    },
    stop() {
      nav.stop()
    },
  }
}

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
        if (session.ui.isOpen()) session.ui.send("state", snap())
      } catch {
        // UI closed
      }
    }, 250)
  }

  const fullBox = () => {
    const d = session.capabilities?.display
    return {x: 0, y: 0, w: d?.width ?? 576, h: d?.height ?? 200}
  }

  const snap = () => ({...assistant.snapshot(), version: APP_VERSION})

  const assistant = new Assistant({
    store,
    fetch: ((url, init) => (globalThis as any).fetch(url, init)) as FetchLike,
    show: (text: string) =>
      session.display.render([{type: "text", id: "g1gpt", box: fullBox(), text, style: {breakMode: "word"}}]),
    clear: () => {
      session.display.render([])?.catch?.(() => {})
    },
    startTranslation: (target, handler) => session.translation.to(target, handler),
    onChange: pushState,
    nav: makeNavHost(session, (msg) => assistant.addLog("info", msg)),
  })

  assistant.addLog("info", `Запущено, версия ${APP_VERSION}`)
  const storageOk = store.selfTest()
  assistant.addLog(
    storageOk ? "info" : "error",
    storageOk
      ? "Хранилище на телефоне работает: ключи и настройки сохраняются"
      : "Хранилище недоступно: настройки сохранятся только до перезапуска Mentra",
  )
  const provider = asProvider(assistant.settings.provider)
  if (!keyFor(assistant.settings, provider)) assistant.addLog("info", `Ключ ${PROVIDERS[provider].label} не задан — откройте настройки`)

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
    // speakerId: Mentra's speaker label for the utterance («1», «2»…), when its recognizer reports one
    const handler = (data: {text: string; isFinal: boolean; speakerId?: string | number}) =>
      assistant.onTranscript(data?.text ?? "", Boolean(data?.isFinal), data?.speakerId)
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
    // G1 head-up sensor: Mentra forwards it on iOS (unlike the G1 touchpads).
    session.imu.onHeadPosition((h: {position: string}) => assistant.onHeadPosition(String(h?.position ?? "")))
  } catch {
    // older host
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
      // permissions are known only now (Mentra sends them when the app connects)
      if (session.transcription?.hasPermission === false) assistant.addLog("error", "Нет разрешения MICROPHONE в манифесте")
      const navProblem = assistant.navProblem()
      if (navProblem) assistant.addLog("info", `Навигатор: ${navProblem}`)
    })
  } catch {
    // ignore
  }

  // ── Navigator ──────────────────────────────────────────────────
  try {
    if (session.navigation) {
      session.navigation.onUpdate((u: any) => assistant.nav.onUpdate(u))
      const saved = store.loadNav()
      if (saved) {
        session.navigation
          .getState()
          .then((st: any) => assistant.resumeNav(saved, Boolean(st?.active)))
          .catch(() => assistant.resumeNav(saved, false))
      }
    }
  } catch (e) {
    assistant.addLog("info", `Навигатор не подключён: ${String((e as Error)?.message ?? e)}`)
  }

  // ── Phone UI (settings screen) ─────────────────────────────────
  session.ui.handle("getState", () => snap())

  session.ui.handle("saveSettings", (patch: Partial<Settings>) => {
    const s = assistant.updateSettings(patch ?? {})
    subscribeStt(s)
    return snap()
  })

  session.ui.handle("ask", async (p: {text: string}) => {
    await assistant.ask(String(p?.text ?? ""), "ui")
    return snap()
  })

  session.ui.handle("command", (p: {cmd: string; provider?: string; source?: string}) => {
    const cmd = String(p?.cmd ?? "") as any
    if (cmd === "provider") assistant.switchProvider(asProvider(p?.provider), "ui")
    else if (cmd === "translate") assistant.startTranslation("ui")
    else if (cmd === "translateStop") assistant.stopTranslation("ui")
    else if (cmd === "lecture") assistant.startLecture("ui")
    else if (cmd === "lectureStop") assistant.stopLecture("ui")
    else if (cmd === "talk") assistant.startTalk("ui")
    else if (cmd === "talkStop") assistant.stopTalk("ui")
    else if (["next", "prev", "first", "repeat", "hide", "cancel", "reset"].includes(cmd)) assistant.command(cmd, p?.source === "key" ? "key" : "ui")
    return snap()
  })

  session.ui.handle("navSearch", async (p: {query: string}) => {
    try {
      return {ok: true, results: await assistant.searchPlaces(String(p?.query ?? ""))}
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      assistant.addLog("error", `Поиск места: ${msg}`)
      return {ok: false, error: msg}
    }
  })

  // Start a route: to a picked search result ({placeId, mainText, secondaryText}) or a typed query.
  session.ui.handle("navGo", async (p: {placeId?: string; mainText?: string; secondaryText?: string; query?: string; mode?: string}) => {
    const mode = asMode(p?.mode)
    if (p?.placeId) {
      const place: Place | null = await assistant.placeFor({
        placeId: String(p.placeId),
        mainText: String(p.mainText ?? ""),
        secondaryText: String(p.secondaryText ?? ""),
      })
      if (!place) {
        assistant.addLog("error", "Навигатор: Mentra не нашла координаты этого места")
        return {...snap(), navError: "Не удалось получить координаты этого места"}
      }
      void assistant.navigateTo(place, mode)
    } else void assistant.navigate(String(p?.query ?? ""), mode, "ui")
    return snap()
  })

  session.ui.handle("navStop", () => {
    assistant.stopNav("ui")
    return snap()
  })

  // Full notes of the current or last lecture (the state snapshot carries only the latest ones).
  session.ui.handle("getLecture", () => assistant.lecture.record)
  session.ui.handle("getTalk", () => assistant.talk.record)

  session.ui.handle("simulateSpeech", (p: {text: string}) => {
    // Lets you test wake phrases and commands by typing, without the glasses mic.
    assistant.onTranscript(String(p?.text ?? ""), true)
    return snap()
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
    return snap()
  })

  session.ui.onOpen(() => pushState())
})
