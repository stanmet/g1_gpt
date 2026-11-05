/**
 * Phone UI: three tabs (Очки, Разговор, Настройки) and pages pushed over them
 * (settings sections, Журнал, конспект, команды). Plain DOM, no framework. Talks to the
 * background layer through the `mentra` global injected by the Mentra app; settings save
 * automatically on change.
 */

type Bridge = {
  ready(): void
  request(channel: string, payload: unknown, options?: {timeout?: number}): Promise<any>
  on(channel: string, cb: (payload: any) => void): () => void
}

/** Layout hints the Mentra app injects into the page (safe area, capsule menu, theme). */
type HostChrome = {
  safeAreaInsets?: {top: number; bottom: number; left: number; right: number}
  capsuleMenu?: {top: number; left: number; width: number; height: number; bottom: number}
  colorScheme?: "light" | "dark"
}

declare global {
  interface Window {
    mentra?: Bridge
  }
}

import {PROVIDERS, type Provider} from "../background/llm"
import {remoteCommand} from "./remote"
import {notesAsText, type LectureRecord} from "../background/lecture"

const AI_FOOTER: Record<Provider, string> = {
  openai: "Terra — быстро и дёшево. Sol и Astra умнее, но дороже.",
  anthropic: "Haiku — быстро и дёшево. Sonnet и Opus умнее, но дольше и дороже.",
  gemini: "Flash — быстро, есть бесплатный лимит. Argon — самый умный.",
}
const asP = (v: unknown): Provider => (v === "anthropic" || v === "gemini" ? v : "openai")
let modelOptionsFor: Provider | null = null
let sheetProvider: Provider = "openai"
const TABS = ["glasses", "chat", "settings"] as const
type Tab = (typeof TABS)[number]
const PAGES = ["ai", "keys", "about", "voice", "display", "translate", "lecture", "talk", "log", "info", "notes", "commands", "nav"] as const
type Page = (typeof PAGES)[number]

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const form = () => $<HTMLFormElement>("settingsForm")
const field = <T extends Element = HTMLInputElement>(name: string) => form().elements.namedItem(name) as unknown as T

let current: any = null
let lastLens = ""

// ───────────────────────── bridge (real or preview) ─────────────────────────

function previewBridge(): Bridge {
  const now = Date.now()
  const state: any = {
    phase: "answering",
    page: 0,
    pages: 2,
    translating: false,
    currentScreen:
      "Из Дублина до Рима около 3 ч\nпрямым рейсом. Ryanair и Aer\nLingus летают каждый день,\nбилеты от 40 евро.\n1/2 · дальше",
    lastTranscript: "Вопрос, сколько лететь до Рима?",
    lastError: "",
    glassesConnected: true,
    version: "preview",
    settings: {
      model: "gpt-6.1-terra",
      effort: "auto",
      answerWords: 60,
      historyMessages: 20,
      webSearch: false,
      aboutMe: "",
      instructions: "",
      listenMode: "wake",
      wakeWords: ["вопрос", "ассистент", "question"],
      sttLanguage: "auto",
      followUpSec: 0,
      autoAdvanceSec: 0,
      clearAfterSec: 90,
      headNod: true,
      voiceLock: false,
      translateTo: "ru-RU",
      lectureEverySec: 15,
      talkEverySec: 10,
      talkGoal: "Договориться о скидке на ремонт",
      navMode: "walking",
      provider: "anthropic",
      anthropicModel: "claude-haiku-5-5",
      geminiModel: "gemini-3.8-flash",
      hasKey: true,
      keyHint: "sk-ant-…x9Qa",
      aiName: "Claude Haiku 5.5",
      keys: {
        openai: {has: true, hint: "sk-…bl8A"},
        anthropic: {has: true, hint: "sk-ant-…x9Qa"},
        gemini: {has: false, hint: ""},
      },
    },
    nav: {
      problem: "",
      active: false,
      busy: false,
      dest: null,
      mode: "walking",
      screen: "",
      message: "",
      left: "",
    },
    historyCount: 4,
    history: [
      {role: "user", content: "Сколько лететь до Рима?", at: now - 120000},
      {role: "assistant", content: "Из какого города вы вылетаете?", at: now - 118000, by: "openai"},
      {role: "user", content: "Из Дублина.", at: now - 90000},
      {
        role: "assistant",
        content: "Из Дублина до Рима около 3 ч прямым рейсом. Ryanair и Aer Lingus летают каждый день, билеты от 40 евро.",
        at: now - 88000,
        by: "anthropic",
      },
    ],
    log: [
      {t: now - 92000, kind: "stt", msg: "Вопрос, сколько лететь до Рима?"},
      {t: now - 91000, kind: "wake", msg: "Фраза-активатор, вопрос: «сколько лететь до Рима?»"},
      {t: now - 89000, kind: "openai", msg: "Ответ за 1.9 с (gpt-6.1-terra, токены 412→58)"},
      {t: now - 89000, kind: "display", msg: "Ответ: 2 экр."},
    ],
  }
  return {
    ready() {},
    async request(channel: string, payload: any) {
      if (channel === "saveSettings") Object.assign(state.settings, payload ?? {})
      if (channel === "command" && payload?.cmd === "provider") state.settings.provider = payload.provider
      if (channel === "command" && payload?.cmd === "translate") state.translating = true
      if (channel === "command" && payload?.cmd === "translateStop") state.translating = false
      if (channel === "command" && payload?.cmd === "lecture") {
        state.translating = false
        state.phase = "lecture"
        state.currentScreen = "• Энтропия — мера беспорядка\n• Растёт в замкнутой системе"
        state.lecture = {active: true, startedAt: Date.now() - 600000, endedAt: 0, total: 3, notes: [
          {t: Date.now() - 500000, kind: "point", text: "Энтропия — мера беспорядка системы"},
          {t: Date.now() - 400000, kind: "qa", q: "Что происходит с энтропией льда при таянии?", text: "Растёт: молекулы воды движутся свободнее."},
          {t: Date.now() - 300000, kind: "point", text: "В замкнутой системе энтропия не убывает"},
        ]}
      }
      if (channel === "command" && payload?.cmd === "lectureStop") {
        state.phase = "idle"
        state.lecture = {...state.lecture, active: false, endedAt: Date.now()}
      }
      if (channel === "getLecture") return state.lecture
      if (channel === "command" && payload?.cmd === "talk") {
        state.translating = false
        if (state.lecture) state.lecture = {...state.lecture, active: false, endedAt: Date.now()}
        state.phase = "talk"
        state.currentScreen = "? Кант\n→ Немецкий философ, 1724–1804.\nАвтор «Критики чистого\nразума», категорический\nимператив."
        state.talk = {active: true, startedAt: Date.now() - 300000, endedAt: 0, total: 3, notes: [
          {t: Date.now() - 200000, kind: "qa", q: "Кто такой Кант?", text: "Немецкий философ, 1724–1804. Автор «Критики чистого разума», категорический императив."},
          {t: Date.now() - 120000, kind: "hint", q: "Категорический императив", text: "Поступай так, чтобы правило твоего поступка могло стать всеобщим законом."},
          {t: Date.now() - 60000, kind: "tip", q: "Спроси", text: "А как вы сами понимаете долг — как правило или как чувство?"},
        ]}
      }
      if (channel === "command" && payload?.cmd === "talkStop") {
        state.phase = "idle"
        state.talk = {...state.talk, active: false, endedAt: Date.now()}
      }
      if (channel === "getTalk") return state.talk
      if (channel === "navSearch")
        return {
          ok: true,
          results: [
            {placeId: "a", mainText: "Trinity College Dublin", secondaryText: "College Green, Dublin 2"},
            {placeId: "b", mainText: "Trinity College Library", secondaryText: "College St, Dublin 2"},
            {placeId: "c", mainText: "Trinity Street", secondaryText: "Dublin 2"},
          ],
        }
      if (channel === "navGo") {
        state.phase = "idle"
        state.currentScreen = "→ Направо через 120 м\nна Grafton Street\nTrinity College Dublin: 850 м, 11 мин"
        state.nav = {
          ...state.nav,
          active: true,
          dest: {name: payload?.mainText || "Trinity College Dublin", address: payload?.secondaryText || "College Green, Dublin 2"},
          mode: payload?.mode ?? "walking",
          screen: state.currentScreen,
          left: "850 м, 11 мин",
        }
      }
      if (channel === "navStop") state.nav = {...state.nav, active: false, dest: null, screen: "", left: ""}
      return state
    },
    on() {
      return () => {}
    },
  }
}

const bridge: Bridge = window.mentra ?? previewBridge()

async function call(channel: string, payload: unknown = {}, timeout = 15000) {
  try {
    const s = await bridge.request(channel, payload, {timeout})
    if (s) render(s)
    return s
  } catch (e: any) {
    toast(`Не получилось: ${e?.message ?? e}`)
    return null
  }
}

// ───────────────────────── chrome: theme, safe area ─────────────────────────

function applyChrome() {
  const g: HostChrome = (window as unknown as {MentraOS?: HostChrome}).MentraOS ?? {}
  const root = document.documentElement
  if (g.colorScheme === "dark" || g.colorScheme === "light") root.dataset.theme = g.colorScheme
  const top = g.safeAreaInsets?.top ?? 0
  const bottom = g.safeAreaInsets?.bottom ?? 0
  root.style.setProperty("--safe-top", `${top}px`)
  root.style.setProperty("--safe-bottom", `${bottom}px`)
  // Titles sit below the host's floating capsule menu, like below an iOS nav bar.
  const capsuleBottom = g.capsuleMenu?.bottom ?? 0
  root.style.setProperty("--title-top", `${Math.max(top + 52, capsuleBottom + 14)}px`)
}

// ───────────────────────── navigation: tabs and pushed pages ─────────────────────────

let tab: Tab = "glasses"
const stack: {page: Page; scrollY: number}[] = []

function renderNav() {
  const top = stack.at(-1)?.page
  for (const t of TABS) $(`screen-${t}`).hidden = Boolean(top) || t !== tab
  for (const p of PAGES) $(`page-${p}`).hidden = p !== top
  document.querySelectorAll<HTMLButtonElement>(".tabbar [data-tab]").forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute("aria-current", "page")
    else b.removeAttribute("aria-current")
  })
}

function showTab(t: Tab, remember = true) {
  tab = t
  stack.length = 0
  renderNav()
  window.scrollTo(0, 0)
  if (t === "chat") requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight))
  if (remember) {
    try {
      localStorage.setItem("g1gpt.tab", t)
    } catch {
      // storage unavailable
    }
  }
}

function openPage(p: Page) {
  stack.push({page: p, scrollY: window.scrollY})
  renderNav()
  window.scrollTo(0, 0)
}

function back() {
  const left = stack.pop()
  if (Object.keys(pending).length) flushSave()
  renderNav()
  window.scrollTo(0, left?.scrollY ?? 0)
}

function toast(msg: string, ms = 2400) {
  const el = $("toast")
  el.textContent = msg
  el.hidden = false
  clearTimeout((toast as any)._t)
  ;(toast as any)._t = setTimeout(() => (el.hidden = true), ms)
}

// ───────────────────────── render ─────────────────────────

const PHASE: Record<string, string> = {
  idle: "Готов",
  capturing: "Слушаю вопрос…",
  thinking: "Думаю…",
  answering: "Ответ на очках",
  translating: "Перевод",
  lecture: "Лекция",
  talk: "Беседа",
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function render(s: any) {
  current = s
  if (!s) return
  const st = s.settings ?? {}
  renderGlasses(s, st)
  renderNavigator(s, st)
  renderChat(s)
  renderNotes(s)
  renderSettings(s, st)
  renderLog(s)
}

type Mode = "assistant" | "translate" | "lecture" | "talk"
const STOP_CMD: Record<Mode, string> = {assistant: "hide", translate: "translateStop", lecture: "lectureStop", talk: "talkStop"}

function modeOf(s: any): Mode {
  return s?.talk?.active ? "talk" : s?.lecture?.active ? "lecture" : s?.translating ? "translate" : "assistant"
}

function renderGlasses(s: any, st: any) {
  $("connDot").className = "dot" + (s.glassesConnected === true ? " on" : s.glassesConnected === false ? " off" : "")
  $("connText").textContent =
    s.glassesConnected === true ? "Подключены" : s.glassesConnected === false ? "Не подключены" : "Нет данных"

  const mode = modeOf(s)
  $("lens").dataset.mode = mode
  $("modeSeg")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)))

  // in translation, lecture and conversation modes the arrows page nothing and «Скрыть» turns the mode off;
  // with only the route on the glasses the button ends the route
  const listening = mode !== "assistant"
  const routeOnly = !listening && s.phase === "idle" && Boolean(s.nav?.active)
  document.querySelectorAll<HTMLElement>('.lens-controls [data-cmd="prev"], .lens-controls [data-cmd="next"]').forEach((b) => {
    b.style.visibility = listening || routeOnly ? "hidden" : ""
  })
  $("hideBtn").textContent = listening ? "Выключить" : routeOnly ? "Завершить маршрут" : "Скрыть"

  const wake = capitalize(String((st.wakeWords ?? [])[0] ?? "вопрос"))
  $("wakeHint").textContent = `«${wake}, …»`
  $("wakeList").textContent = (st.wakeWords ?? ["вопрос"]).map((w: string) => `«${capitalize(String(w))}»`).join(", ")

  const lensText = $("lensText")
  let text: string
  let dim = false
  if (s.translating) {
    text = s.currentScreen || "Слушаю речь вокруг…"
    dim = !s.currentScreen
  } else if (s.phase === "lecture") {
    text = s.currentScreen || "Слушаю лекцию…"
    dim = !s.currentScreen
  } else if (s.phase === "talk") {
    text = s.currentScreen || "Слушаю разговор…"
    dim = !s.currentScreen
  } else if (s.phase === "idle" && s.nav?.active) {
    text = s.currentScreen || "Маршрут построен"
    dim = !s.currentScreen
  } else if (s.phase === "idle") {
    text = s.lastError || `Скажите «${wake}, …»`
    dim = !s.lastError
  } else if (s.phase === "capturing" || s.phase === "thinking") {
    text = s.currentScreen || (s.phase === "thinking" ? "…думаю" : "Слушаю…")
  } else {
    text = s.currentScreen || "—"
  }
  if (text !== lastLens) {
    lensText.textContent = text
    lensText.classList.remove("fresh")
    void lensText.offsetWidth
    lensText.classList.add("fresh")
    lastLens = text
  }
  lensText.classList.toggle("dim", dim)

  const target = st.translateTo === "en-US" ? "английский" : "русский"
  $("lensState").textContent =
    st.listenMode === "off"
      ? "Микрофон выключен"
      : s.translating
        ? `Перевод на ${target}`
        : s.phase === "lecture"
          ? `Тезисы ${st.translateTo === "en-US" ? "по-английски" : "по-русски"}`
          : s.phase === "talk"
            ? "Подсказки по ходу разговора"
            : s.phase === "idle" && s.nav?.active
              ? "Навигатор"
              : (PHASE[s.phase] ?? s.phase)

  const dots = $("pageDots")
  dots.textContent = ""
  if (!s.translating && s.pages > 1 && s.phase === "answering") {
    for (let i = 0; i < Math.min(s.pages, 12); i++) {
      const d = document.createElement("i")
      if (i === s.page) d.className = "on"
      dots.appendChild(d)
    }
  }

  $("dashNote").hidden = !s.dashboardLikely

  const p = asP(st.provider)
  $("keyWarn").hidden = Boolean(st.hasKey)
  $("keyWarnTitle").textContent = `Добавьте ключ ${PROVIDERS[p].label}`
  $("aiName").textContent = st.aiName ?? PROVIDERS[p].label
  const quick = $<HTMLSelectElement>("quickProvider")
  if (document.activeElement !== quick) quick.value = p
}

// ───────────────────────── navigator ─────────────────────────

const NAV_MODE_LABEL: Record<string, string> = {walking: "пешком", driving: "на машине", cycling: "на велосипеде"}
let navMode = "walking"
let navResults: {placeId: string; mainText: string; secondaryText: string}[] = []

function renderNavigator(s: any, st: any) {
  const nav = s.nav ?? {}
  if (!pending.navMode) navMode = st.navMode ?? navMode
  $("navModes")
    .querySelectorAll<HTMLButtonElement>("[data-nav-mode]")
    .forEach((b) => b.setAttribute("aria-checked", String(b.dataset.navMode === navMode)))

  const dest = nav.dest?.name ?? ""
  $("navRowSub").textContent = nav.active
    ? [dest, nav.left].filter(Boolean).join(" · ")
    : nav.busy
      ? "Строю маршрут…"
      : "«Проведи до …»"

  $("navTrip").hidden = !nav.active
  if (nav.active) {
    const lines = String(nav.screen ?? "").split("\n")
    const isTurn = /^[←→↑↓•]/.test(lines[0] ?? "")
    // «120 м» stays on one line
    const nb = (t: string) => t.replace(/(\d) (?=(?:м|км|мин|ч)\b)/gu, "$1\u00a0")
    $("navTurn").textContent = isTurn ? nb(lines[0]) : ""
    $("navRoad").textContent = isTurn && /^на /.test(lines[1] ?? "") ? lines[1] : ""
    $("navDest").textContent = dest
    $("navLeft").textContent = nb([nav.left, NAV_MODE_LABEL[nav.mode] ?? ""].filter(Boolean).join(" · ") || nav.dest?.address || "")
  }
  $("navProblem").textContent = nav.problem ? `${capitalize(nav.problem)}.` : ""
  $("navProblem").hidden = !nav.problem
  // what the navigator said last (searching, not found…) — only while it is current
  if (nav.busy || (!nav.active && nav.message)) $("navMsg").textContent = String(nav.message ?? "").replace(/\n/g, " ")
  else if (!navSearching) $("navMsg").textContent = ""
}

let navSearching = false

function renderNavResults() {
  const box = $("navResults")
  box.textContent = ""
  box.hidden = navResults.length === 0
  for (const r of navResults) {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "item place"
    const label = document.createElement("span")
    label.className = "row-label"
    label.textContent = r.mainText
    if (r.secondaryText) {
      const sub = document.createElement("span")
      sub.className = "row-sub"
      sub.textContent = r.secondaryText
      label.appendChild(sub)
    }
    const go = document.createElement("span")
    go.className = "go"
    go.innerHTML = '<svg><use href="#i-arrow" /></svg>'
    b.append(label, go)
    b.addEventListener("click", () => startRoute(r))
    box.appendChild(b)
  }
}

async function searchPlaces(query: string) {
  navSearching = true
  $("navMsg").textContent = "Ищу…"
  navResults = []
  renderNavResults()
  let r: any = null
  try {
    r = await bridge.request("navSearch", {query}, {timeout: 40000})
  } catch (e: any) {
    r = {ok: false, error: e?.message ?? String(e)}
  }
  navSearching = false
  if (!r?.ok) {
    $("navMsg").textContent = `Поиск не удался: ${r?.error ?? "нет ответа"}`
    return
  }
  navResults = r.results ?? []
  $("navMsg").textContent = navResults.length ? "" : "Ничего не нашлось. Попробуйте название, адрес или улицу."
  renderNavResults()
}

async function startRoute(r: {placeId: string; mainText: string; secondaryText: string}) {
  const s = await call("navGo", {...r, mode: navMode}, 45000)
  if (!s) return
  if (s.navError) return toast(s.navError)
  navResults = []
  renderNavResults()
  $<HTMLInputElement>("navQuery").value = ""
  toast(`Строю маршрут до «${r.mainText}» — смотрите на очки`)
}

let chatKey = ""

function renderChat(s: any) {
  const history: any[] = s.history ?? []
  const key = `${s.historyCount}:${history.at(-1)?.at ?? 0}:${s.phase === "thinking" ? s.lastQuestion : ""}`
  if (key === chatKey) return // state pushes come often in lecture/conversation modes
  chatKey = key
  const chat = $("chat")
  const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 40
  chat.textContent = ""
  let lastDay = ""
  for (const m of history) {
    const day = m.at ? new Date(m.at).toLocaleDateString("ru-RU", {day: "numeric", month: "long"}) : ""
    if (day && day !== lastDay) {
      const d = document.createElement("div")
      d.className = "chat-day"
      d.textContent = day
      chat.appendChild(d)
      lastDay = day
    }
    const b = document.createElement("div")
    b.className = `bubble ${m.role === "user" ? "user" : "assistant"}`
    b.textContent = m.content
    chat.appendChild(b)
    if (m.role === "assistant" && m.by) {
      const by = document.createElement("div")
      by.className = "bubble-by"
      by.textContent = PROVIDERS[asP(m.by)].label
      chat.appendChild(by)
    }
  }
  if (s.phase === "thinking") {
    if (s.lastQuestion && !history.some((m) => m.role === "user" && m.content === s.lastQuestion && history.at(-1) === m)) {
      const q = document.createElement("div")
      q.className = "bubble user"
      q.textContent = s.lastQuestion
      chat.appendChild(q)
    }
    const t = document.createElement("div")
    t.className = "bubble assistant typing"
    t.setAttribute("aria-label", "Помощник отвечает")
    t.append(document.createElement("i"), document.createElement("i"), document.createElement("i"))
    chat.appendChild(t)
  }
  $("chatEmpty").hidden = history.length > 0 || s.phase === "thinking"
  $("newChat").hidden = history.length === 0
  if (!$("screen-chat").hidden && atBottom) window.scrollTo(0, document.body.scrollHeight)
}

let notesKey = ""
/** Which list the notes page shows: the active mode's, else the most recent one. */
let notesShown: "lecture" | "talk" = "lecture"

function renderNotes(s: any) {
  const has = (r: any) => Boolean(r && (r.active || r.total > 0))
  const lec = s.lecture
  const talk = s.talk
  const recent = (r: any) => (r ? r.endedAt || Date.now() : 0)
  notesShown = talk?.active ? "talk" : lec?.active ? "lecture" : has(talk) && (!has(lec) || recent(talk) >= recent(lec)) ? "talk" : "lecture"
  const r = notesShown === "talk" ? talk : lec
  const isTalk = notesShown === "talk"
  $("notesRow").hidden = !has(r)
  if (!has(r)) return
  const points = r.notes.filter((n: any) => n.kind === "point").length
  const answers = r.notes.length - points
  const counts = isTalk
    ? `${answers} ${plural(answers, "подсказка", "подсказки", "подсказок")}`
    : `${points} ${plural(points, "тезис", "тезиса", "тезисов")}, ${answers} ${plural(answers, "ответ", "ответа", "ответов")}`
  const title = isTalk ? "Подсказки в беседе" : "Конспект лекции"
  const when = r.active ? "идёт сейчас" : `${fmtHM(r.startedAt)}–${r.endedAt ? fmtHM(r.endedAt) : "…"}`
  $("notesRowTitle").textContent = title
  $("notesRowSub").textContent = `${counts}, ${when}`
  $("notesTitle").textContent = isTalk ? "Подсказки" : "Конспект"
  $("lectureMeta").textContent = r.active ? "Идёт сейчас." : `${capitalize(when)}.`
  $("lectureSub").textContent = isTalk && s.settings?.talkGoal ? `Цель: ${s.settings.talkGoal}` : ""
  const key = `${notesShown}:${r.startedAt}:${r.total}`
  if (key === notesKey) return
  notesKey = key
  const list = $("lectureNotes")
  list.dataset.empty = isTalk ? "Подсказки появятся, когда в разговоре прозвучит вопрос или цитата." : "Тезисы появятся, когда лектор скажет что-то по существу."
  list.textContent = ""
  const who: Record<string, string> = {you: "Вы: ", qa: isTalk ? "Вопрос: " : "Лектор: ", hint: "Подсказка: ", quote: "Цитата: "}
  for (const n of [...r.notes].reverse()) {
    const li = document.createElement("li")
    li.className = n.kind
    const t = document.createElement("span")
    t.className = "t"
    t.textContent = fmtHM(n.t)
    li.append(t)
    if (n.kind === "tip") {
      const b = document.createElement("b")
      b.textContent = `${n.q}: `
      li.append(b, n.text)
    } else if (n.kind !== "point") {
      const q = document.createElement("span")
      q.className = "q"
      q.textContent = (who[n.kind] ?? "") + (n.q ?? "")
      li.append(q, "→ " + n.text)
    } else li.append(n.text)
    list.append(li)
  }
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

function setSub(page: string, text: string) {
  const el = document.querySelector<HTMLElement>(`[data-sub="${page}"]`)
  if (el) el.textContent = text
}

function renderSettings(s: any, st: any) {
  const p = asP(st.provider)
  setSelect("provider", p)
  fillModelOptions(p)
  const model = String(st[PROVIDERS[p].modelField] ?? "")
  const known = PROVIDERS[p].models.some((m) => m.id === model)
  setSelect("modelChoice", known ? model : "custom")
  $("customModelCell").hidden = known
  if (!known) setText("customModel", model)
  $("aiFooter").textContent = AI_FOOTER[p]
  let keys = 0
  for (const id of ["openai", "anthropic", "gemini"] as Provider[]) {
    const k = st.keys?.[id]
    if (k?.has) keys++
    const el = document.querySelector<HTMLElement>(`[data-key-of="${id}"]`)!
    el.textContent = k?.has ? k.hint || "Сохранён" : id === p ? "Не задан — нужен для ответов" : "Не задан"
    el.style.color = k?.has || id !== p ? "" : "var(--danger)"
  }
  setSelect("effort", st.effort ?? "auto")
  const web = field<HTMLInputElement>("webSearch")
  if (document.activeElement !== web) web.checked = Boolean(st.webSearch)
  setStep("answerWords", st.answerWords ?? 60)
  setStep("historyMessages", st.historyMessages ?? 20)
  setText("aboutMe", st.aboutMe ?? "")
  setText("instructions", st.instructions ?? "")
  setSelect("listenMode", st.listenMode ?? "wake")
  setSelect("sttLanguage", st.sttLanguage ?? "auto")
  setText("wakeWords", (st.wakeWords ?? []).join(", "))
  setStep("followUpSec", st.followUpSec ?? 0)
  setSelect("translateTo", st.translateTo ?? "ru-RU")
  setStep("autoAdvanceSec", st.autoAdvanceSec ?? 0)
  setStep("clearAfterSec", st.clearAfterSec ?? 90)
  const nod = field<HTMLInputElement>("headNod")
  if (document.activeElement !== nod) nod.checked = st.headNod !== false
  const lock = field<HTMLInputElement>("voiceLock")
  if (document.activeElement !== lock) lock.checked = st.voiceLock === true
  $("voiceLockText").textContent = s.ownerVoice
    ? `«Только мой голос»: команды без активатора принимаются от голоса ${s.ownerVoice} — того, кто последним сказал активатор.`
    : "«Только мой голос»: ваш голос определится, когда вы скажете активатор."

  const every = st.lectureEverySec ?? 15
  setStep("lectureEverySec", every)
  $("lectureCost").textContent = `До ${Math.round(3600 / every)} запросов к нейросети в час.`
  const tipEvery = st.talkEverySec ?? 10
  setStep("talkEverySec", tipEvery)
  setText("talkGoal", st.talkGoal ?? "")
  $("talkCost").textContent = tipEvery
    ? `«Факт», «Спроси», «Скажи», «Цитата» — до ${Math.round(3600 / tipEvery)} запросов в час.`
    : "Только ответы на вопросы и цитаты."

  setSub("ai", st.aiName ?? PROVIDERS[p].label)
  setSub("keys", `${keys} из 3`)
  setSub("voice", field<HTMLSelectElement>("listenMode").selectedOptions[0]?.textContent ?? "")
  setSub("translate", st.translateTo === "en-US" ? "На английский" : "На русский")
  setSub("lecture", `Тезисы каждые ${every} с`)
  setSub("talk", tipEvery ? `Подсказки каждые ${tipEvery} с` : "Только вопросы и цитаты")

  if (!$("keySheet").hidden) fillKeySheet()
  $("versionText").textContent = s.version ? `Версия ${s.version}` : ""
  $("aboutVersion").textContent = s.version ? `Версия ${s.version}` : ""
}

function setSelect(name: string, value: string) {
  const sel = field<HTMLSelectElement>(name)
  if (document.activeElement !== sel) sel.value = value
  const out = document.querySelector(`[data-value-of="${name}"]`)
  if (out) out.textContent = sel.selectedOptions[0]?.textContent ?? ""
}

function setText(name: string, value: string) {
  const el = field<HTMLInputElement | HTMLTextAreaElement>(name)
  if (document.activeElement !== el && !dirty.has(name)) el.value = value
}

function setStep(name: string, value: number) {
  stepValues[name] = value
  const out = document.querySelector<HTMLOutputElement>(`[data-out="${name}"]`)!
  const stepper = document.querySelector<HTMLElement>(`[data-step="${name}"]`)!
  const unit = stepper.dataset.unit ?? ""
  out.textContent = value === 0 && out.dataset.zero ? out.dataset.zero : `${value}${unit ? " " + unit : ""}`
  const min = Number(stepper.dataset.min)
  const max = Number(stepper.dataset.max)
  const [minus, plus] = stepper.querySelectorAll("button")
  minus.disabled = value <= min
  plus.disabled = value >= max
}

function fillModelOptions(p: Provider) {
  if (modelOptionsFor === p) return
  const sel = field<HTMLSelectElement>("modelChoice")
  sel.textContent = ""
  for (const m of PROVIDERS[p].models) sel.add(new Option(m.label, m.id))
  sel.add(new Option("Другая…", "custom"))
  field<HTMLInputElement>("customModel").placeholder = PROVIDERS[p].models[0].id
  modelOptionsFor = p
}

function fmtHM(t: number) {
  const d = new Date(t)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
}

function fmtTime(t: number) {
  const d = new Date(t)
  const p = (n: number) => (n < 10 ? "0" + n : "" + n)
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const KIND_LABEL: Record<string, string> = {
  stt: "речь",
  wake: "активатор",
  cmd: "команда",
  ask: "вопрос",
  openai: "нейросеть",
  display: "дисплей",
  error: "ошибка",
  info: "инфо",
  touch: "касание",
  head: "голова",
  translate: "перевод",
  lecture: "лекция",
  talk: "беседа",
  nav: "навигатор",
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement("textarea")
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand("copy")
    ta.remove()
  }
}

let logKey = ""

function renderLog(s: any) {
  $("lastHeard").textContent = s.lastTranscript ? `«${s.lastTranscript}»` : "—"
  const last = (s.log ?? []).at(-1)
  const key = `${(s.log ?? []).length}:${last?.t ?? 0}:${last?.msg ?? ""}`
  if (key === logKey) return
  logKey = key
  const list = $("log")
  list.textContent = ""
  const entries: any[] = [...(s.log ?? [])].reverse()
  if (!entries.length) {
    const li = document.createElement("li")
    li.textContent = "Событий пока нет"
    list.appendChild(li)
  }
  for (const e of entries) {
    const li = document.createElement("li")
    const time = document.createElement("time")
    time.textContent = fmtTime(e.t)
    const kind = document.createElement("span")
    kind.className = `kind ${e.kind}`
    kind.textContent = KIND_LABEL[e.kind] ?? e.kind
    const msg = document.createElement("span")
    msg.className = "msg"
    msg.textContent = e.msg
    li.append(time, kind, msg)
    list.appendChild(li)
  }
}

// ───────────────────────── settings: autosave ─────────────────────────

const stepValues: Record<string, number> = {}
const dirty = new Set<string>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pending: Record<string, unknown> = {}

function queueSave(patch: Record<string, unknown>, delay = 350) {
  Object.assign(pending, patch)
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSave, delay)
}

async function flushSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const patch = pending
  pending = {}
  if (!Object.keys(patch).length) return
  const s = await call("saveSettings", patch)
  if (s) for (const k of Object.keys(patch)) dirty.delete(k)
}

function currentProvider(): Provider {
  return asP(field<HTMLSelectElement>("provider").value || current?.settings?.provider)
}

function modelFromForm(): string {
  const p = currentProvider()
  const choice = field<HTMLSelectElement>("modelChoice").value
  if (choice !== "custom") return choice
  return field<HTMLInputElement>("customModel").value.trim() || PROVIDERS[p].models[0].id
}

const SWITCHES = new Set(["webSearch", "headNod", "voiceLock"])

function wireSettings() {
  const f = form()
  f.addEventListener("submit", (e) => e.preventDefault())

  f.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement
    const name = el.name
    if (!name) return
    if (name === "provider") {
      const p = asP(el.value)
      setSelect("provider", p)
      queueSave({provider: p}, 0)
      return
    }
    if (name === "modelChoice") {
      const custom = el.value === "custom"
      $("customModelCell").hidden = !custom
      setSelect("modelChoice", el.value)
      if (custom) {
        field<HTMLInputElement>("customModel").focus()
        return
      }
      queueSave({[PROVIDERS[currentProvider()].modelField]: el.value}, 0)
      return
    }
    if (SWITCHES.has(name)) return queueSave({[name]: (el as HTMLInputElement).checked}, 0)
    if (el instanceof HTMLSelectElement) {
      setSelect(name, el.value)
      return queueSave({[name]: el.value}, 0)
    }
  })

  f.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement
    const name = el.name
    if (!name || el instanceof HTMLSelectElement || SWITCHES.has(name)) return
    dirty.add(name)
    if (name === "customModel") return queueSave({[PROVIDERS[currentProvider()].modelField]: modelFromForm()}, 800)
    if (name === "wakeWords") {
      const words = el.value
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean)
      if (words.length) queueSave({wakeWords: words}, 800)
      return
    }
    queueSave({[name]: el.value}, 800)
  })

  f.addEventListener("focusout", () => {
    if (Object.keys(pending).length) flushSave()
  })

  f.querySelectorAll<HTMLElement>(".stepper").forEach((stepper) => {
    const name = stepper.dataset.step!
    const min = Number(stepper.dataset.min)
    const max = Number(stepper.dataset.max)
    const by = Number(stepper.dataset.by)
    stepper.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
      b.addEventListener("click", () => {
        const cur = stepValues[name] ?? min
        let next = cur + Number(b.dataset.d) * by
        // snap to the step grid so 60 → 70, 15 → 20
        next = Math.round(next / by) * by
        next = Math.min(max, Math.max(min, next))
        setStep(name, next)
        queueSave({[name]: next}, 450)
      }),
    )
  })
}

// ───────────────────────── key sheet ─────────────────────────

const KEY_DOMAIN: Record<Provider, string> = {openai: "api.openai.com", anthropic: "api.anthropic.com", gemini: "generativelanguage.googleapis.com"}
const KEY_SHAPE: Record<Provider, RegExp> = {
  openai: /^sk-[A-Za-z0-9_\-]{16,}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_\-]{16,}$/,
  // classic keys start with AIza; keys made in AI Studio since May 2026 may look different
  gemini: /^(AIza[A-Za-z0-9_\-]{20,}|[A-Za-z0-9._\-]{30,})$/,
}

function fillKeySheet() {
  const p = sheetProvider
  const info = PROVIDERS[p]
  const k = current?.settings?.keys?.[p]
  $("keySheetTitle").textContent = `Ключ ${info.label}`
  $<HTMLInputElement>("apiKey").placeholder = info.keyPlaceholder
  $("keyState").textContent = k?.has ? `Сохранён ${k.hint}. Вставьте новый, чтобы заменить.` : "Вставьте ключ API."
  $("keyHelp").textContent = `Где взять: ${info.keyWhere}. Хранится только на телефоне и уходит только в ${KEY_DOMAIN[p]}.`
  $("removeKey").hidden = !k?.has
}

function openKeySheet(p?: Provider) {
  sheetProvider = p ?? asP(current?.settings?.provider)
  fillKeySheet()
  $("keySheet").hidden = false
  setTimeout(() => $<HTMLInputElement>("apiKey").focus(), 250)
}
function closeKeySheet() {
  $("keySheet").hidden = true
  $<HTMLInputElement>("apiKey").value = ""
}

async function saveKey() {
  const input = $<HTMLInputElement>("apiKey")
  const key = input.value.trim()
  if (!key) return closeKeySheet()
  const info = PROVIDERS[sheetProvider]
  if (!KEY_SHAPE[sheetProvider].test(key) && !confirm(`Это не похоже на ключ ${info.label} — обычно он начинается с ${info.keyPlaceholder.replace("…", "")}. Сохранить всё равно?`)) return
  const s = await call("saveSettings", {[info.keyField]: key})
  if (s) {
    closeKeySheet()
    toast("Ключ сохранён")
  }
}

// ───────────────────────── wiring ─────────────────────────

const DASHBOARD_HELP =
  "Mentra считает, что вы смотрите вверх, и показывает свою панель. Опустите голову. Не помогает — Mentra → Settings → Dashboard → выключите Contextual Dashboard."

function wire() {
  document.querySelectorAll<HTMLButtonElement>(".tabbar [data-tab]").forEach((b) =>
    b.addEventListener("click", () => showTab(b.dataset.tab as Tab)),
  )
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((b) => b.addEventListener("click", () => openPage(b.dataset.page as Page)))
  document.querySelectorAll<HTMLElement>(".back").forEach((b) => b.addEventListener("click", back))

  document.querySelectorAll<HTMLButtonElement>("[data-cmd]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.id === "hideBtn" && current?.phase === "idle" && current?.nav?.active) return call("navStop")
      call("command", {cmd: b.dataset.cmd})
    }),
  )

  // Bluetooth page turners and presenters act as a keyboard. iOS hands their key presses only
  // to the app on screen, so this works while this page is open in Mentra, not from a pocket.
  document.addEventListener("keydown", (e) => {
    const cmd = remoteCommand(e)
    if (!cmd || !$("keySheet").hidden) return
    e.preventDefault()
    call("command", {cmd, source: "key"})
  })

  $("testDisplay").addEventListener("click", () => {
    toast("Проверочный текст отправлен на очки")
    call("testDisplay")
  })
  $("dashNote").addEventListener("click", () => toast(DASHBOARD_HELP, 7000))

  $("modeSeg")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const want = b.dataset.mode as Mode
        const now = modeOf(current)
        if (want === now) return
        if (want === "assistant") call("command", {cmd: STOP_CMD[now]})
        else call("command", {cmd: want})
      }),
    )

  document
    .querySelectorAll<HTMLElement>('[data-open="key"]')
    .forEach((b) => b.addEventListener("click", () => openKeySheet(b.dataset.provider ? asP(b.dataset.provider) : undefined)))

  $<HTMLSelectElement>("quickProvider").addEventListener("change", (e) => {
    const p = asP((e.target as HTMLSelectElement).value)
    call("command", {cmd: "provider", provider: p})
  })
  $("keySheet").addEventListener("click", (e) => {
    if (e.target === $("keySheet")) closeKeySheet()
  })
  $("keySheet").querySelector("[data-close]")!.addEventListener("click", closeKeySheet)
  $("saveKey").addEventListener("click", saveKey)
  $("apiKey").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") saveKey()
  })
  $("removeKey").addEventListener("click", async () => {
    const info = PROVIDERS[sheetProvider]
    if (!confirm(`Удалить ключ ${info.label} с этого телефона?`)) return
    await call("saveSettings", {[info.keyField]: ""})
    closeKeySheet()
    toast("Ключ удалён")
  })

  $("newChat").addEventListener("click", () => {
    if (confirm("Начать новый разговор? Помощник забудет предыдущие вопросы.")) call("command", {cmd: "reset"})
  })

  const askInput = $<HTMLInputElement>("askText")
  const askBtn = $<HTMLButtonElement>("askBtn")
  const syncSend = () => (askBtn.disabled = !askInput.value.trim())
  askInput.addEventListener("input", syncSend)
  syncSend()
  $("composer").addEventListener("submit", async (e) => {
    e.preventDefault()
    const text = askInput.value.trim()
    if (!text) return
    askInput.value = ""
    syncSend()
    if (!current?.settings?.hasKey) {
      openKeySheet()
      return
    }
    const mode = modeOf(current)
    await call("ask", {text}, 90000)
    // in lecture and conversation modes the answer goes to the glasses and the list on «Очки», not to this chat
    if (mode === "lecture" || mode === "talk") toast("Ответ — на очках и в списке на вкладке «Очки»")
  })

  $("simForm").addEventListener("submit", async (e) => {
    e.preventDefault()
    const input = $<HTMLInputElement>("simText")
    const text = input.value.trim()
    if (!text) return
    input.value = ""
    await call("simulateSpeech", {text})
  })

  $("copyLog").addEventListener("click", async () => {
    const lines = (current?.log ?? []).map((e: any) => `${fmtTime(e.t)} [${e.kind}] ${e.msg}`).join("\n")
    await copyText(lines)
    toast("Журнал скопирован")
  })

  $("copyLecture").addEventListener("click", async () => {
    const which = notesShown
    let rec: LectureRecord | null = null
    try {
      rec = (await bridge.request(which === "talk" ? "getTalk" : "getLecture", {}, {timeout: 15000})) as LectureRecord | null
    } catch {
      rec = current?.[which] ?? null
    }
    const fmt = (t: number) => new Date(t).toLocaleString("ru-RU", {day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"})
    const text = which === "talk" ? notesAsText(rec, fmt, {title: "Подсказки в беседе", asked: "Вопрос"}) : notesAsText(rec, fmt)
    if (!text) return toast("Список пока пуст")
    await copyText(text)
    toast(which === "talk" ? "Подсказки скопированы" : "Конспект скопирован")
  })

  $("navForm").addEventListener("submit", (e) => {
    e.preventDefault()
    const input = $<HTMLInputElement>("navQuery")
    const q = input.value.trim()
    if (!q) return input.focus()
    input.blur()
    searchPlaces(q)
  })
  $("navModes")
    .querySelectorAll<HTMLButtonElement>("[data-nav-mode]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        navMode = b.dataset.navMode!
        $("navModes")
          .querySelectorAll<HTMLButtonElement>("[data-nav-mode]")
          .forEach((x) => x.setAttribute("aria-checked", String(x === b)))
        queueSave({navMode}, 0)
      }),
    )
  $("navStop").addEventListener("click", () => call("navStop"))

  wireSettings()
}

function boot() {
  applyChrome()
  wire()
  let start: Tab = "glasses"
  try {
    const saved = localStorage.getItem("g1gpt.tab") as Tab | null
    if (saved && (TABS as readonly string[]).includes(saved)) start = saved
  } catch {
    // storage unavailable
  }
  let page: Page | null = null
  try {
    // #chat opens a tab, #log or #page-log opens a page (handy for previews)
    const hash = location.hash.replace(/^#(page-)?/, "")
    if ((TABS as readonly string[]).includes(hash)) start = hash as Tab
    else if ((PAGES as readonly string[]).includes(hash)) page = hash as Page
  } catch {
    // no location
  }
  showTab(start, false)
  if (page) openPage(page)
  bridge.on("state", (s) => render(s))
  bridge.ready()
  call("getState")
}

boot()
