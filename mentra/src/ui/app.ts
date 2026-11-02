/**
 * Phone UI (settings + diagnostics). Plain DOM, no framework. Talks to the
 * background layer through the `mentra` global the Mentra app injects.
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
      capsuleMenu?: {left: number; width: number; bottom: number}
    }
  }
}

const KNOWN_MODELS = ["gpt-6.1-terra", "gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"]
const PHASE_LABEL: Record<string, string> = {
  idle: "Готов — слушаю",
  capturing: "Слушаю вопрос…",
  thinking: "Думаю…",
  answering: "Показываю ответ",
  translating: "Перевод включён",
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

function mockBridge(): Bridge {
  // Lets the page render in a normal browser (for previews); the Mentra app supplies the real bridge.
  const state: any = {
    phase: "answering",
    page: 0,
    pages: 2,
    currentScreen: "Рим — около 3 ч 10 мин\nпрямым рейсом из Дублина.\nС пересадкой 5–7 ч.\nЛучше лететь утром.\n1/2 · дальше",
    lastTranscript: "Вопрос, сколько лететь до Рима?",
    glassesConnected: true,
    lastError: "",
    settings: {
      model: "gpt-6.1-terra",
      effort: "auto",
      answerWords: 60,
      webSearch: false,
      historyMessages: 20,
      aboutMe: "",
      instructions: "",
      listenMode: "wake",
      wakeWords: ["вопрос", "ассистент"],
      sttLanguage: "ru-RU",
      followUpSec: 0,
      autoAdvanceSec: 0,
      clearAfterSec: 90,
      hasKey: false,
      keyHint: "",
    },
    historyCount: 2,
    history: [
      {role: "user", content: "Сколько лететь до Рима?", at: Date.now()},
      {role: "assistant", content: "Около 3 ч 10 мин прямым рейсом.", at: Date.now()},
    ],
    log: [
      {t: Date.now(), kind: "stt", msg: "Вопрос, сколько лететь до Рима?"},
      {t: Date.now(), kind: "openai", msg: "Ответ за 2.1 с (gpt-6.1-terra)"},
    ],
  }
  return {
    ready() {},
    async request() {
      return state
    },
    on() {
      return () => {}
    },
  }
}

const bridge: Bridge = window.mentra ?? mockBridge()
let current: any = null
let formDirty = false

function toast(msg: string, ms = 2600) {
  const el = $("toast")
  el.textContent = msg
  el.hidden = false
  clearTimeout((toast as any)._t)
  ;(toast as any)._t = setTimeout(() => (el.hidden = true), ms)
}

function applySafeArea() {
  const g = window.MentraOS ?? {}
  const insets = g.safeAreaInsets
  const root = document.documentElement.style
  if (insets) {
    root.setProperty("--pad-top", `${Math.max(insets.top, 12) + 12}px`)
    root.setProperty("--pad-bottom", `${insets.bottom}px`)
  }
  const cap = g.capsuleMenu
  if (cap) root.setProperty("--capsule-right", `${Math.max(0, window.innerWidth - cap.left) + 8}px`)
}

function fmtTime(t: number) {
  const d = new Date(t)
  const p = (n: number) => (n < 10 ? "0" + n : "" + n)
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function render(s: any) {
  current = s
  if (!s) return
  const phaseEl = $("phase")
  const listenOff = s.settings?.listenMode === "off"
  phaseEl.textContent = listenOff ? "Микрофон выключен" : PHASE_LABEL[s.phase] ?? s.phase
  phaseEl.className = "pill" + (s.lastError || !s.settings?.hasKey ? " warn" : "")
  if (!s.settings?.hasKey) phaseEl.textContent = "Нужен ключ OpenAI"

  const g = $("glasses")
  g.textContent = s.glassesConnected === true ? "Очки подключены" : s.glassesConnected === false ? "Очки не подключены" : "Очки: нет данных"

  const wakeWord = String((s.settings?.wakeWords ?? [])[0] ?? "вопрос")
  const wakeCap = wakeWord.charAt(0).toUpperCase() + wakeWord.slice(1)
  if (s.translating) {
    $("hud").textContent = s.currentScreen || "Перевод включён — жду речь вокруг…"
  } else if (s.phase === "idle") {
    const last = s.currentScreen ? `\n\nПоследний ответ (скрыт):\n${s.currentScreen}` : ""
    $("hud").textContent = (s.lastError ? s.lastError + "\n\n" : "") + `Экран очков пуст. Скажите: «${wakeCap}, …»` + last
  } else {
    $("hud").textContent = s.currentScreen || (s.lastError ? s.lastError : "—")
  }
  $("pageinfo").textContent = s.translating ? "перевод" : s.pages > 1 ? `${s.page + 1} / ${s.pages}` : ""
  const tb = $<HTMLButtonElement>("translateBtn")
  tb.textContent = s.translating ? "Перевод: выключить" : "Перевод: включить"
  tb.className = s.translating ? "wide primary" : "wide"
  $("lastHeard").textContent = `Последняя распознанная фраза: ${s.lastTranscript || "—"}`

  const st = s.settings ?? {}
  $("keyState").textContent = st.hasKey ? `Ключ сохранён: ${st.keyHint}` : "Ключ не задан — без него помощник не ответит."
  $("keyCard").classList.toggle("needs", !st.hasKey)
  const wake = (st.wakeWords ?? [])[0] ?? "вопрос"
  $("wakeExample").textContent = `«${wake.charAt(0).toUpperCase() + wake.slice(1)}, …»`

  if (!formDirty) fillForm(st)

  $("histCount").textContent = `Сообщений в памяти: ${s.historyCount}`
  const hist = $("history")
  hist.textContent = ""
  for (const m of s.history ?? []) {
    const div = document.createElement("div")
    div.className = "msg " + m.role
    div.textContent = (m.role === "user" ? "Вы: " : "GPT: ") + m.content
    hist.appendChild(div)
  }

  const log = $("log")
  const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 8
  log.textContent = ""
  for (const e of s.log ?? []) {
    const div = document.createElement("div")
    div.className = "k-" + e.kind
    div.textContent = `${fmtTime(e.t)} [${e.kind}] ${e.msg}`
    log.appendChild(div)
  }
  if (atBottom) log.scrollTop = log.scrollHeight
}

function fillForm(st: any) {
  const f = $("settingsForm") as HTMLFormElement
  const el = (n: string) => f.elements.namedItem(n) as HTMLInputElement
  const known = KNOWN_MODELS.includes(st.model)
  ;(el("modelChoice") as unknown as HTMLSelectElement).value = known ? st.model : "custom"
  el("customModel").value = known ? "" : st.model ?? ""
  $("customModelField").hidden = known
  ;(el("effort") as unknown as HTMLSelectElement).value = st.effort ?? "auto"
  el("answerWords").value = String(st.answerWords ?? 60)
  el("webSearch").checked = Boolean(st.webSearch)
  el("historyMessages").value = String(st.historyMessages ?? 20)
  ;(el("aboutMe") as unknown as HTMLTextAreaElement).value = st.aboutMe ?? ""
  ;(el("instructions") as unknown as HTMLTextAreaElement).value = st.instructions ?? ""
  ;(el("listenMode") as unknown as HTMLSelectElement).value = st.listenMode ?? "wake"
  el("wakeWords").value = (st.wakeWords ?? []).join(", ")
  ;(el("sttLanguage") as unknown as HTMLSelectElement).value = st.sttLanguage ?? "auto"
  ;(el("translateTo") as unknown as HTMLSelectElement).value = st.translateTo ?? "ru-RU"
  el("followUpSec").value = String(st.followUpSec ?? 0)
  el("autoAdvanceSec").value = String(st.autoAdvanceSec ?? 0)
  el("clearAfterSec").value = String(st.clearAfterSec ?? 90)
}

function readForm() {
  const f = $("settingsForm") as HTMLFormElement
  const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value
  const choice = v("modelChoice")
  return {
    model: choice === "custom" ? v("customModel").trim() || "gpt-6.1-terra" : choice,
    effort: v("effort"),
    answerWords: Number(v("answerWords")),
    webSearch: (f.elements.namedItem("webSearch") as HTMLInputElement).checked,
    historyMessages: Number(v("historyMessages")),
    aboutMe: v("aboutMe"),
    instructions: v("instructions"),
    listenMode: v("listenMode"),
    wakeWords: v("wakeWords")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean),
    sttLanguage: v("sttLanguage"),
    translateTo: v("translateTo"),
    followUpSec: Number(v("followUpSec")),
    autoAdvanceSec: Number(v("autoAdvanceSec")),
    clearAfterSec: Number(v("clearAfterSec")),
  }
}

async function call(channel: string, payload: unknown = {}, timeout = 15000) {
  try {
    const s = await bridge.request(channel, payload, {timeout})
    if (s) render(s)
    return s
  } catch (e: any) {
    toast(`Ошибка: ${e?.message ?? e}`)
    return null
  }
}

function wire() {
  document.querySelectorAll<HTMLButtonElement>("[data-cmd]").forEach((b) =>
    b.addEventListener("click", (ev) => {
      ev.preventDefault()
      const cmd = b.dataset.cmd!
      if (cmd === "reset" && !confirm("Забыть весь текущий разговор?")) return
      call("command", {cmd})
    }),
  )

  $("translateBtn").addEventListener("click", () => {
    call("command", {cmd: current?.translating ? "translateStop" : "translate"})
  })

  $("testDisplay").addEventListener("click", () => {
    toast("Отправил тест на очки — посмотрите на дисплей")
    call("testDisplay")
  })

  $("saveKey").addEventListener("click", async () => {
    const input = $<HTMLInputElement>("apiKey")
    const key = input.value.trim()
    if (!key) return toast("Вставьте ключ в поле")
    if (!/^sk-[A-Za-z0-9_\-]{16,}$/.test(key)) {
      if (!confirm("Ключ не похож на ключ OpenAI (обычно начинается с sk-). Сохранить всё равно?")) return
    }
    const s = await call("saveSettings", {apiKey: key})
    if (s) {
      input.value = ""
      toast("Ключ сохранён на телефоне. Проверьте: спросите что‑нибудь текстом.")
    }
  })

  $("removeKey").addEventListener("click", async () => {
    if (!confirm("Удалить ключ OpenAI с телефона?")) return
    await call("saveSettings", {apiKey: ""})
    toast("Ключ удалён")
  })

  const ask = async () => {
    const input = $<HTMLInputElement>("askText")
    const text = input.value.trim()
    if (!text) return
    input.value = ""
    toast("Спрашиваю… ответ появится на очках")
    await call("ask", {text}, 90000)
  }
  $("askBtn").addEventListener("click", ask)
  $("askText").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") ask()
  })

  const sim = async () => {
    const input = $<HTMLInputElement>("simText")
    const text = input.value.trim()
    if (!text) return
    input.value = ""
    await call("simulateSpeech", {text})
  }
  $("simBtn").addEventListener("click", sim)
  $("simText").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") sim()
  })

  const form = $("settingsForm") as HTMLFormElement
  form.addEventListener("input", () => {
    formDirty = true
    const choice = (form.elements.namedItem("modelChoice") as HTMLSelectElement).value
    $("customModelField").hidden = choice !== "custom"
  })
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    const s = await call("saveSettings", readForm())
    if (s) {
      formDirty = false
      fillForm(s.settings)
      toast("Настройки сохранены")
    }
  })
}

function boot() {
  applySafeArea()
  wire()
  bridge.on("state", (s) => render(s))
  bridge.ready()
  call("getState")
  $("foot").textContent = window.mentra ? "" : "Предпросмотр вне Mentra (данные-пример)"
}

boot()
