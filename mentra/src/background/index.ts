/**
 * Background layer: runs inside the Mentra app on the iPhone, owns the glasses session.
 * Glasses mic → Mentra speech-to-text (Russian + English) → Assistant (questions, translation,
 * lecture, conversation) → ChatGPT / Claude / Gemini → text on the G1 display.
 */
import {registerMiniapp} from "@mentra/miniapp/background"
import {Assistant} from "./assistant"
import {asProvider, keyFor, PROVIDERS} from "./llm"
import type {NavHost, Place, TravelMode} from "./navigator"
import {testPattern} from "./glassdraw"
import {TileStore, type BlobApi} from "./tiles"
import {toBase64} from "./glassdraw"
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
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what}: timeout`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function makeNavHost(session: any, log: (msg: string) => void, tiles: TileStore): NavHost | undefined {
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
    roads: (center, radius) => tiles.features(center, radius),
    prefetch: (route) => void tiles.prefetchRoute(route),
    watch(onPosition) {
      const off = session.location?.onUpdate?.((p: any) => onPosition({lat: Number(p?.lat), lng: Number(p?.lng), accuracy: p?.accuracy}))
      return () => {
        try {
          off?.()
        } catch {
          // ignore
        }
      }
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

  const snap = () => ({...assistant.snapshot(), version: APP_VERSION, maps: mapsState()})

  // ── Map tiles on the phone (offline maps) ───────────────────────
  const blob = session.blob
  const tiles = new TileStore({
    blob:
      blob && typeof blob.setFromUrl === "function"
        ? ({
            setFromUrl: (k, url, o) => withTimeout(blob.setFromUrl(k, url, o), 60_000, "map download"),
            bytes: (k) => blob.bytes(k),
            list: () => blob.list(),
            delete: (k) => blob.delete(k),
          } as BlobApi)
        : null,
    fetchJson: async (url) => {
      const res: any = await withTimeout((globalThis as any).fetch(url), 15_000, "TileJSON")
      if (!res?.ok) throw new Error(`HTTP ${res?.status}`)
      return JSON.parse(await res.text())
    },
    log: (kind, msg) => assistant.addLog(kind, msg),
    now: () => Date.now(),
    onChange: () => pushState(),
    loadAreas: () => store.loadMapAreas(),
    saveAreas: (a) => store.saveMapAreas(a),
  })
  const mapsState = () => ({
    available: tiles.available,
    ...tiles.stats(),
    download: tiles.download,
    areas: tiles.areas,
  })

  const assistant = new Assistant({
    store,
    fetch: ((url, init) => (globalThis as any).fetch(url, init)) as FetchLike,
    show: (text: string) =>
      session.display.render([{type: "text", id: "g1gpt", box: fullBox(), text, style: {breakMode: "word"}}]),
    clear: () => {
      session.display.render([])?.catch?.(() => {})
    },
    startTranslation: (target, handler) => session.translation.to(target, handler),
    // A full-screen picture: the G1 cannot show pictures through render() (Mentra drops images on
    // text-only glasses), but takes Mentra's older «bitmap_view» layout straight to its BMP command.
    showBitmap: (data: string) => {
      session
        .sendRequest({type: "miniapp_display", view: "main", layout: {layoutType: "bitmap_view", data}})
        ?.catch?.((e: unknown) => assistant.addLog("error", `Картинка на очках: ${String((e as Error)?.message ?? e)}`))
    },
    onChange: pushState,
    nav: makeNavHost(session, (msg) => assistant.addLog("info", msg), tiles),
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
      // the route line for the map (Mentra sends it when a trip starts and after a reroute)
      session.navigation.onRoute?.((r: any) => assistant.nav.onRoute(r?.points ?? []))
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

  // The map picture as it is on the glasses (the phone shows it as a mirror).
  session.ui.handle("navFrame", () => ({frame: assistant.nav.frame, frameId: assistant.nav.frameId}))

  // Map data for the phone: route, position, streets (streets only when changed since `have`).
  session.ui.handle("navMap", (p: {have?: number}) => {
    const n = assistant.nav
    const round = (q: {lat: number; lng: number}) => [Math.round(q.lat * 1e6) / 1e6, Math.round(q.lng * 1e6) / 1e6]
    return {
      active: n.active,
      mode: n.mode,
      me: n.me ? round(n.me) : null,
      heading: n.heading,
      dest: n.dest ? round(n.dest) : null,
      route: n.route.map(round),
    }
  })

  // ── the phone map and offline maps ──
  // A map tile for the phone map (base64 of the stored file; downloaded first when online).
  session.ui.handle("mapTile", async (p: {z: number; x: number; y: number; fetch?: boolean}) => {
    const z = Math.round(Number(p?.z))
    const x = Math.round(Number(p?.x))
    const y = Math.round(Number(p?.y))
    if (![z, x, y].every(Number.isFinite)) return {ok: false}
    const bytes = await tiles.raw(z, x, y, p?.fetch !== false)
    return bytes ? {ok: true, b64: toBase64(bytes)} : {ok: false}
  })

  // Where you are, for the phone map without a trip.
  session.ui.handle("mapLocate", async () => {
    try {
      const fix: any = await withTimeout(session.location.getOnce(), 15_000, "location")
      return Number.isFinite(fix?.lat) ? {ok: true, lat: fix.lat, lng: fix.lng} : {ok: false}
    } catch (e) {
      return {ok: false, error: String((e as Error)?.message ?? e)}
    }
  })

  session.ui.handle("mapEstimate", (p: {lat: number; lng: number}) => {
    const lat = Number(p?.lat)
    const lng = Number(p?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {}
    return {2: tiles.estimateMb(lat, lng, 2), 5: tiles.estimateMb(lat, lng, 5), 15: tiles.estimateMb(lat, lng, 15)}
  })

  // Download the map around a point (the phone map's centre or where you are).
  session.ui.handle("mapDownload", (p: {lat: number; lng: number; radiusKm: number}) => {
    const lat = Number(p?.lat)
    const lng = Number(p?.lng)
    const r = [2, 5, 15].includes(Number(p?.radiusKm)) ? Number(p.radiusKm) : 5
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {ok: false}
    void tiles.downloadArea(lat, lng, r)
    return {ok: true}
  })
  session.ui.handle("mapCancel", () => {
    tiles.cancelDownload()
    return {ok: true}
  })
  session.ui.handle("mapDelete", async (p: {id?: string; all?: boolean}) => {
    if (p?.all) await tiles.deleteAll()
    else if (p?.id) await tiles.deleteArea(String(p.id))
    return snap()
  })

  // «Проверить картинку на очках»: a test frame with the visible area outlined.
  session.ui.handle("navTestBitmap", () => ({ok: assistant.testBitmap(testPattern())}))

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
