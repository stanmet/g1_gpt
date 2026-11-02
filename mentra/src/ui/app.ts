/**
 * Phone UI: an iOS-style app with four tabs (Очки, Разговор, Настройки, Журнал).
 * Plain DOM, no framework. Talks to the background layer through the `mentra`
 * global injected by the Mentra app; settings save automatically on change.
 */

type Bridge = {
  ready(): void
  request(channel: string, payload: unknown, options?: {timeout?: number}): Promise<any>
  on(channel: string, cb: (payload: any) => void): () => void
}

declare global {
  interface Window {
    mentra?: Bridge
    MentraOS?: {
      safeAreaInsets?: {top: number; bottom: number; left: number; right: number}
      capsuleMenu?: {top: number; left: number; width: number; height: number; bottom: number}
      colorScheme?: "light" | "dark"
    }
  }
}

const KNOWN_MODELS = ["gpt-6.1-terra", "gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"]
const TABS = ["glasses", "chat", "settings", "log"] as const
type Tab = (typeof TABS)[number]

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
      translateTo: "ru-RU",
      hasKey: true,
      keyHint: "sk-…bl8A",
    },
    historyCount: 4,
    history: [
      {role: "user", content: "Сколько лететь до Рима?", at: now - 120000},
      {role: "assistant", content: "Из какого города вы вылетаете?", at: now - 118000},
      {role: "user", content: "Из Дублина.", at: now - 90000},
      {
        role: "assistant",
        content: "Из Дублина до Рима около 3 ч прямым рейсом. Ryanair и Aer Lingus летают каждый день, билеты от 40 евро.",
        at: now - 88000,
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
      if (channel === "command" && payload?.cmd === "translate") state.translating = true
      if (channel === "command" && payload?.cmd === "translateStop") state.translating = false
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

// ───────────────────────── chrome: theme, safe area, tabs ─────────────────────────

function applyChrome() {
  const g = window.MentraOS ?? {}
  const root = document.documentElement
  if (g.colorScheme === "dark" || g.colorScheme === "light") root.dataset.theme = g.colorScheme
  const top = g.safeAreaInsets?.top ?? 0
  const bottom = g.safeAreaInsets?.bottom ?? 0
  root.style.setProperty("--safe-top", `${top}px`)
  root.style.setProperty("--safe-bottom", `${bottom}px`)
  // Large titles sit below the host's floating capsule menu, like below an iOS nav bar.
  const capsuleBottom = g.capsuleMenu?.bottom ?? 0
  root.style.setProperty("--title-top", `${Math.max(top + 52, capsuleBottom + 14)}px`)
}

function showTab(tab: Tab, remember = true) {
  for (const t of TABS) {
    $(`screen-${t}`).hidden = t !== tab
    const btn = document.querySelector<HTMLButtonElement>(`.tabbar [data-tab="${t}"]`)!
    if (t === tab) btn.setAttribute("aria-current", "page")
    else btn.removeAttribute("aria-current")
  }
  window.scrollTo(0, 0)
  if (tab === "chat") requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight))
  if (remember) {
    try {
      localStorage.setItem("g1gpt.tab", tab)
    } catch {
      // storage unavailable
    }
  }
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
  idle: "Готов — слушаю",
  capturing: "Слушаю вопрос…",
  thinking: "Думаю…",
  answering: "Ответ на очках",
  translating: "Перевод",
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function render(s: any) {
  current = s
  if (!s) return
  const st = s.settings ?? {}
  renderGlasses(s, st)
  renderChat(s)
  renderSettings(s, st)
  renderLog(s)
}

function renderGlasses(s: any, st: any) {
  const dot = $("connDot")
  dot.className = "status-dot" + (s.glassesConnected === true ? " on" : s.glassesConnected === false ? " off" : "")
  $("connText").textContent =
    s.glassesConnected === true ? "Очки подключены" : s.glassesConnected === false ? "Очки не подключены" : "Очки: нет данных"

  const mode = s.translating ? "translate" : "assistant"
  $("lens").dataset.mode = mode
  const seg = $("modeSeg")
  seg.dataset.mode = mode
  seg.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)))

  const wake = capitalize(String((st.wakeWords ?? [])[0] ?? "вопрос"))
  $("wakeHint").textContent = `«${wake}, …»`

  // The lens mirrors the glasses display.
  const lensText = $("lensText")
  let text: string
  let dim = false
  if (s.translating) {
    text = s.currentScreen || "Слушаю речь вокруг…"
    dim = !s.currentScreen
  } else if (s.phase === "idle") {
    text = s.lastError || `Экран пуст.\nСкажите «${wake}, …»`
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
    st.listenMode === "off" ? "Микрофон выключен" : s.translating ? `Перевод на ${target}` : (PHASE[s.phase] ?? s.phase)

  const dots = $("pageDots")
  dots.textContent = ""
  if (!s.translating && s.pages > 1 && s.phase === "answering") {
    for (let i = 0; i < Math.min(s.pages, 12); i++) {
      const d = document.createElement("i")
      if (i === s.page) d.className = "on"
      dots.appendChild(d)
    }
  }
  const paging = !s.translating && s.pages > 1
  document.querySelector<HTMLButtonElement>('.lens-toolbar [data-cmd="prev"]')!.disabled = !paging || s.page === 0
  document.querySelector<HTMLButtonElement>('.lens-toolbar [data-cmd="next"]')!.disabled = !paging || s.page >= s.pages - 1

  $("keyWarn").hidden = Boolean(st.hasKey)
}

function renderChat(s: any) {
  const chat = $("chat")
  const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 40
  chat.textContent = ""
  const history: any[] = s.history ?? []
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
    t.innerHTML = "<i></i><i></i><i></i>"
    chat.appendChild(t)
  }
  $("chatEmpty").hidden = history.length > 0 || s.phase === "thinking"
  $("newChat").hidden = history.length === 0
  if (!$("screen-chat").hidden && atBottom) window.scrollTo(0, document.body.scrollHeight)
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

function renderSettings(s: any, st: any) {
  const known = KNOWN_MODELS.includes(st.model)
  setSelect("modelChoice", known ? st.model : "custom")
  $("customModelCell").hidden = known
  if (!known) setText("customModel", st.model ?? "")
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

  $("keyValue").textContent = st.hasKey ? st.keyHint || "Сохранён" : "Не задан"
  $("keyValue").style.color = st.hasKey ? "" : "var(--red)"
  $("keyState").textContent = st.hasKey ? `Сейчас сохранён ключ ${st.keyHint}. Вставьте новый, чтобы заменить.` : "Ключ пока не задан."
  $("removeKeyGroup").hidden = !st.hasKey
  $("versionText").textContent = s.version ? `Версия ${s.version}.` : ""
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
  openai: "OpenAI",
  display: "дисплей",
  error: "ошибка",
  info: "инфо",
  touch: "касание",
  translate: "перевод",
}

function renderLog(s: any) {
  $("lastHeard").textContent = s.lastTranscript ? `«${s.lastTranscript}»` : "—"
  const list = $("log")
  list.textContent = ""
  const entries: any[] = [...(s.log ?? [])].reverse()
  if (!entries.length) {
    const li = document.createElement("li")
    li.className = "cell"
    li.textContent = "Событий пока нет"
    list.appendChild(li)
  }
  for (const e of entries) {
    const li = document.createElement("li")
    li.className = `cell k-${e.kind}`
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

function modelFromForm(): string {
  const choice = field<HTMLSelectElement>("modelChoice").value
  if (choice !== "custom") return choice
  return field<HTMLInputElement>("customModel").value.trim() || current?.settings?.model || "gpt-6.1-terra"
}

function wireSettings() {
  const f = form()
  f.addEventListener("submit", (e) => e.preventDefault())

  f.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement
    const name = el.name
    if (!name) return
    if (name === "modelChoice") {
      const custom = el.value === "custom"
      $("customModelCell").hidden = !custom
      setSelect("modelChoice", el.value)
      if (custom) {
        field<HTMLInputElement>("customModel").focus()
        return
      }
      queueSave({model: el.value}, 0)
      return
    }
    if (name === "webSearch") return queueSave({webSearch: (el as HTMLInputElement).checked}, 0)
    if (el instanceof HTMLSelectElement) {
      setSelect(name, el.value)
      return queueSave({[name]: el.value}, 0)
    }
  })

  f.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement
    const name = el.name
    if (!name || el instanceof HTMLSelectElement || name === "webSearch") return
    dirty.add(name)
    if (name === "customModel") return queueSave({model: modelFromForm()}, 800)
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

function openKeySheet() {
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
  if (!/^sk-[A-Za-z0-9_\-]{16,}$/.test(key) && !confirm("Это не похоже на ключ OpenAI — обычно он начинается с sk-. Сохранить всё равно?")) return
  const s = await call("saveSettings", {apiKey: key})
  if (s) {
    closeKeySheet()
    toast("Ключ сохранён")
  }
}

// ───────────────────────── wiring ─────────────────────────

function wire() {
  document.querySelectorAll<HTMLButtonElement>(".tabbar [data-tab]").forEach((b) =>
    b.addEventListener("click", () => showTab(b.dataset.tab as Tab)),
  )

  document.querySelectorAll<HTMLButtonElement>("[data-cmd]").forEach((b) =>
    b.addEventListener("click", () => call("command", {cmd: b.dataset.cmd})),
  )

  $("testDisplay").addEventListener("click", () => {
    toast("Проверочный текст отправлен на очки")
    call("testDisplay")
  })

  $("modeSeg")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const wantTranslate = b.dataset.mode === "translate"
        if (wantTranslate === Boolean(current?.translating)) return
        call("command", {cmd: wantTranslate ? "translate" : "translateStop"})
      }),
    )

  document.querySelectorAll<HTMLElement>('[data-open="key"]').forEach((b) => b.addEventListener("click", openKeySheet))
  $("keySheet").addEventListener("click", (e) => {
    if (e.target === $("keySheet")) closeKeySheet()
  })
  $("keySheet").querySelector("[data-close]")!.addEventListener("click", closeKeySheet)
  $("saveKey").addEventListener("click", saveKey)
  $("apiKey").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") saveKey()
  })
  $("removeKey").addEventListener("click", async () => {
    if (!confirm("Удалить ключ OpenAI с этого телефона?")) return
    await call("saveSettings", {apiKey: ""})
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
    await call("ask", {text}, 90000)
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
    try {
      await navigator.clipboard.writeText(lines)
      toast("Журнал скопирован")
    } catch {
      const ta = document.createElement("textarea")
      ta.value = lines
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      ta.remove()
      toast("Журнал скопирован")
    }
  })

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
  try {
    const hash = location.hash.replace("#", "") as Tab
    if ((TABS as readonly string[]).includes(hash)) start = hash
  } catch {
    // no location
  }
  showTab(start, false)
  bridge.on("state", (s) => render(s))
  bridge.ready()
  call("getState")
}

boot()
