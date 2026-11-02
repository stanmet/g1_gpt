import {beforeEach, describe, expect, test} from "bun:test"
import {Assistant, DASHBOARD_WARNING, HEAD_UP_HIDES_MS, SILENCE_MS, TRANSLATE_IDLE_MS} from "../src/background/assistant"
import {buildRequestBody, effortFor, extractText} from "../src/background/openai"
import {DEFAULT_SETTINGS, Store, type KV} from "../src/background/store"

// ── fakes ────────────────────────────────────────────────────────────────
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

class Clock {
  t = 1_700_000_000_000
  timers: {id: number; at: number; fn: () => void}[] = []
  seq = 0
  now = () => this.t
  set = (fn: () => void, ms: number) => {
    const id = ++this.seq
    this.timers.push({id, at: this.t + ms, fn})
    return id
  }
  clear = (id: unknown) => {
    this.timers = this.timers.filter((x) => x.id !== id)
  }
  async advance(ms: number) {
    const end = this.t + ms
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at)
      const next = this.timers[0]
      if (!next || next.at > end) break
      this.timers.shift()
      this.t = next.at
      next.fn()
      await flush()
    }
    this.t = end
    await flush()
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function okResponse(text: string) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        model: "gpt-6.1-terra",
        output: [
          {type: "reasoning", summary: []},
          {type: "message", role: "assistant", content: [{type: "output_text", text, annotations: []}]},
        ],
        usage: {input_tokens: 100, output_tokens: 20},
      }),
  }
}

type TrHandler = (ev: any) => void
const translation: {target: string | null; handler: TrHandler | null; unsubs: number} = {target: null, handler: null, unsubs: 0}

function setup(answers: string[], settings: Partial<typeof DEFAULT_SETTINGS> = {}) {
  translation.target = null
  translation.handler = null
  translation.unsubs = 0
  const kv = new MemKV()
  const store = new Store(kv)
  store.saveSettings({...DEFAULT_SETTINGS, apiKey: "sk-test-1234567890abcdef", ...settings})
  const clock = new Clock()
  const shown: string[] = []
  const requests: any[] = []
  const fetch = async (url: string, init: any) => {
    requests.push({url, headers: init.headers, body: JSON.parse(init.body)})
    const a = answers.shift() ?? "Готово."
    return okResponse(a)
  }
  const a = new Assistant({
    store,
    fetch: fetch as any,
    show: (t) => {
      shown.push(t)
    },
    clear: () => {
      shown.push("<clear>")
    },
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    startTranslation: (target, handler) => {
      translation.target = target
      translation.handler = handler
      return () => {
        translation.unsubs++
        translation.handler = null
      }
    },
  })
  return {a, clock, shown, requests, store, kv}
}

// ── tests ────────────────────────────────────────────────────────────────
describe("voice → OpenAI → glasses, with context", () => {
  let env: ReturnType<typeof setup>
  const long =
    "Колизей открыт с 9 утра. Билет стоит около 18 евро и включает Римский форум и Палатин. Лучше купить онлайн заранее, чтобы не стоять в очереди. " +
    "Самое спокойное время — сразу после открытия или за два часа до закрытия. В жару берите воду: внутри мало тени."

  beforeEach(() => {
    env = setup([long, "Да, по понедельникам Колизей работает как обычно."])
  })

  test("full chain with paging and a follow-up that keeps context", async () => {
    const {a, clock, shown, requests} = env

    // interim results while speaking, then the final
    a.onTranscript("Вопрос", false)
    expect(a.phase).toBe("capturing")
    expect(shown.at(-1)).toBe("Слушаю…")
    a.onTranscript("Вопрос, во сколько открывается", false)
    a.onTranscript("Вопрос, во сколько открывается Колизей?", true)
    expect(shown.at(-1)).toBe("» во сколько открывается Колизей?")
    expect(requests.length).toBe(0)

    await clock.advance(SILENCE_MS + 10)
    expect(requests.length).toBe(1)
    const body = requests[0].body
    expect(requests[0].url).toBe("https://api.openai.com/v1/responses")
    expect(requests[0].headers.Authorization).toBe("Bearer sk-test-1234567890abcdef")
    expect(body.model).toBe("gpt-6.1-terra")
    expect(body.store).toBe(false)
    expect(body.reasoning).toEqual({effort: "none"})
    expect(body.input).toEqual([{role: "user", content: "во сколько открывается Колизей?"}])
    expect(body.instructions).toContain("по-русски")

    expect(a.phase).toBe("answering")
    expect(a.pages.length).toBeGreaterThan(1)
    expect(shown.at(-1)).toBe(a.pages[0])
    expect(shown.at(-1)!.split("\n").length).toBeLessThanOrEqual(5)

    a.onTranscript("Дальше.", true)
    expect(a.page).toBe(1)
    expect(shown.at(-1)).toBe(a.pages[1])
    a.onTranscript("Назад", true)
    expect(a.page).toBe(0)

    // follow-up question: must include previous exchange
    a.onTranscript("Вопрос, а по понедельникам он работает?", true)
    await clock.advance(SILENCE_MS + 10)
    expect(requests.length).toBe(2)
    expect(requests[1].body.input).toEqual([
      {role: "user", content: "во сколько открывается Колизей?"},
      {role: "assistant", content: long},
      {role: "user", content: "а по понедельникам он работает?"},
    ])
    expect(shown.at(-1)!.replace(/\n/g, " ")).toBe("Да, по понедельникам Колизей работает как обычно.")

    // reset forgets context
    a.onTranscript("Новый разговор", true)
    expect(a.history.length).toBe(0)
    a.onTranscript("Вопрос, сколько ему лет?", true)
    await clock.advance(SILENCE_MS + 10)
    expect(requests[2].body.input).toEqual([{role: "user", content: "сколько ему лет?"}])
  })

  test("history survives a restart (persisted on the phone)", async () => {
    const {a, clock, kv} = env
    a.onTranscript("Вопрос, во сколько открывается Колизей?", true)
    await clock.advance(SILENCE_MS + 10)
    const b = new Assistant({store: new Store(kv), fetch: (async () => okResponse("x")) as any, show: () => {}, clear: () => {}})
    expect(b.history.map((m) => m.role)).toEqual(["user", "assistant"])
  })

  test("question split over two utterances is joined", async () => {
    const {a, clock, requests} = env
    a.onTranscript("Вопрос, сколько стоит билет", true)
    await clock.advance(800)
    a.onTranscript("в Колизей для студентов?", true)
    await clock.advance(SILENCE_MS + 10)
    expect(requests.length).toBe(1)
    expect(requests[0].body.input.at(-1).content).toBe("сколько стоит билет в Колизей для студентов?")
  })

  test("bare wake phrase waits for the question", async () => {
    const {a, clock, requests} = env
    a.onTranscript("Ассистент.", true)
    expect(a.phase).toBe("capturing")
    await clock.advance(2000)
    a.onTranscript("Какая столица Канады?", true)
    await clock.advance(SILENCE_MS + 10)
    expect(requests[0].body.input.at(-1).content).toBe("Какая столица Канады?")
  })

  test("speech without wake phrase is ignored in wake mode", async () => {
    const {a, clock, requests} = env
    a.onTranscript("Сегодня отличная погода, пойдём гулять", true)
    await clock.advance(5000)
    expect(requests.length).toBe(0)
    expect(a.phase).toBe("idle")
  })

  test("'Ассистент, дальше' is a command, not a question", async () => {
    const {a, clock, requests} = env
    a.onTranscript("Вопрос, во сколько открывается Колизей?", true)
    await clock.advance(SILENCE_MS + 10)
    a.onTranscript("Ассистент", false) // interim starts capture
    a.onTranscript("Ассистент, дальше", true)
    await clock.advance(SILENCE_MS + 10)
    expect(requests.length).toBe(1)
    expect(a.page).toBe(1)
  })

  test("cancel while thinking drops the late answer", async () => {
    let release: (v: any) => void = () => {}
    const kv = new MemKV()
    const store = new Store(kv)
    store.saveSettings({...DEFAULT_SETTINGS, apiKey: "sk-test-1234567890abcdef"})
    const shown: string[] = []
    const clock = new Clock()
    const a = new Assistant({
      store,
      fetch: (() => new Promise((r) => (release = r))) as any,
      show: (t) => {
        shown.push(t)
      },
      clear: () => shown.push("<clear>"),
      now: clock.now,
      setTimer: clock.set,
      clearTimer: clock.clear,
    })
    a.onTranscript("Вопрос, расскажи длинную историю", true)
    await clock.advance(SILENCE_MS + 10)
    expect(a.phase).toBe("thinking")
    a.onTranscript("Стоп", true)
    expect(a.phase).toBe("idle")
    release(okResponse("поздний ответ"))
    await flush()
    expect(shown.includes("поздний ответ")).toBe(false)
    expect(a.history.length).toBe(0)
  })

  test("always mode: every phrase is a question", async () => {
    const e = setup(["Ответ"], {listenMode: "always"})
    e.a.onTranscript("Почему небо синее?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(1)
  })

  test("auto-advance and auto-clear", async () => {
    const e = setup([long], {autoAdvanceSec: 5, clearAfterSec: 10})
    e.a.onTranscript("Вопрос, про Колизей", true)
    await e.clock.advance(SILENCE_MS + 10)
    const n = e.a.pages.length
    expect(n).toBeGreaterThan(1)
    await e.clock.advance(5000 * (n - 1) + 10)
    expect(e.a.page).toBe(n - 1)
    await e.clock.advance(10_000)
    expect(e.shown.at(-1)).toBe("<clear>")
    expect(e.a.phase).toBe("idle")
  })
})

describe("counter-question from the assistant", () => {
  test("reply without wake phrase is accepted and sent with context", async () => {
    const e = setup(["Из какого города вы вылетаете?", "Из Дублина до Рима около 2 ч 50 мин прямым рейсом."])
    e.a.onTranscript("Вопрос, сколько лететь до Рима?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.shown.at(-1)).toContain("ответьте голосом")

    // the user answers without saying the wake phrase
    e.a.onTranscript("Из Дуб", false)
    expect(e.a.phase).toBe("capturing")
    e.a.onTranscript("Из Дублина.", true)
    await e.clock.advance(SILENCE_MS + 10)

    expect(e.requests.length).toBe(2)
    expect(e.requests[1].body.input).toEqual([
      {role: "user", content: "сколько лететь до Рима?"},
      {role: "assistant", content: "Из какого города вы вылетаете?"},
      {role: "user", content: "Из Дублина."},
    ])
    expect(e.shown.at(-1)!.replace(/\n/g, " ")).toContain("Из Дублина до Рима")
  })

  test("very short reply ('Да') works when only a final result arrives", async () => {
    const e = setup(["Показать цены в евро?", "Билет от 40 евро."])
    e.a.onTranscript("Вопрос, сколько стоит билет до Рима?", true)
    await e.clock.advance(SILENCE_MS + 10)
    e.a.onTranscript("Да.", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(2)
    expect(e.requests[1].body.input.at(-1)).toEqual({role: "user", content: "Да."})
  })

  test("'дальше' during the reply window still turns the page", async () => {
    const long = "Нужно уточнить детали. ".repeat(12) + "Из какого города вылет?"
    const e = setup([long])
    e.a.onTranscript("Вопрос, сколько лететь до Рима?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.a.pages.length).toBeGreaterThan(1)
    e.a.onTranscript("Дальше", false)
    e.a.onTranscript("Дальше.", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(1)
    expect(e.a.page).toBe(1)
  })

  test("reply window closes; later speech without wake phrase is ignored", async () => {
    const e = setup(["Из какого города?"])
    e.a.onTranscript("Вопрос, сколько лететь до Рима?", true)
    await e.clock.advance(SILENCE_MS + 10)
    await e.clock.advance(30_000)
    e.a.onTranscript("Пойдём пить кофе", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(1)
  })

  test("normal answers do not open a reply window", async () => {
    const e = setup(["Около 3 часов."])
    e.a.onTranscript("Вопрос, сколько лететь до Рима?", true)
    await e.clock.advance(SILENCE_MS + 10)
    e.a.onTranscript("А мне кажется, дольше", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(1)
  })
})

describe("answer language follows the question", () => {
  test("English after the Russian wake word → English instruction and footer", async () => {
    const long = "Tokyo is 9 hours ahead of Dublin, so it is evening there now. ".repeat(8)
    const e = setup([long])
    e.a.onTranscript("Вопрос, what time is it in Tokyo right now?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests[0].body.input.at(-1).content).toBe("what time is it in Tokyo right now?")
    expect(e.requests[0].body.instructions).toContain("Answer in English")
    expect(e.a.pages[0].split("\n").at(-1)).toMatch(/· next$/)
    e.a.onTranscript("Next.", true)
    expect(e.a.page).toBe(1)
  })

  test("Russian question → Russian instruction, even with English terms", async () => {
    const e = setup(["Это система оркестрации контейнеров."])
    e.a.onTranscript("Вопрос, что такое Kubernetes и зачем он нужен?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests[0].body.instructions).toContain("Последний вопрос задан по-русски")
    expect(e.requests[0].body.instructions).not.toContain("Answer in English")
  })

  test("English wake word 'Question' works too", async () => {
    const e = setup(["Canberra."])
    e.a.onTranscript("Question, what is the capital of Australia?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(1)
    expect(e.requests[0].body.input.at(-1).content).toBe("what is the capital of Australia?")
  })

  test("English counter-question shows English reply hint", async () => {
    const e = setup(["Which city are you flying from?", "About 2 h 50 min."])
    e.a.onTranscript("Вопрос, how long is the flight to Rome?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.shown.at(-1)).toContain("reply by voice")
    e.a.onTranscript("From Dublin.", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(2)
  })
})

describe("settings migration", () => {
  test("v1 settings (Russian-only STT, old wake words) upgrade to bilingual", () => {
    const kv = new MemKV()
    const old = {...DEFAULT_SETTINGS, apiKey: "sk-x", sttLanguage: "ru-RU", v: undefined,
      wakeWords: ["вопрос", "ассистент", "джипити", "чат джипити", "чат gpt", "chat gpt", "chatgpt", "гпт"]}
    kv.setItem("g1gpt.settings.v1", JSON.stringify(old))
    const s = new Store(kv).loadSettings()
    expect(s.sttLanguage).toBe("auto")
    expect(s.wakeWords).toContain("question")
    expect(s.apiKey).toBe("sk-x")
    expect(s.v).toBe(2)
  })

  test("a deliberate 'Russian only' choice in v2 is kept", () => {
    const kv = new MemKV()
    kv.setItem("g1gpt.settings.v1", JSON.stringify({...DEFAULT_SETTINGS, sttLanguage: "ru-RU", v: 2}))
    expect(new Store(kv).loadSettings().sttLanguage).toBe("ru-RU")
  })
})

describe("long answers stay until the last page", () => {
  const long = "Колизей открыт с 9 утра. Билет стоит около 18 евро и включает Форум и Палатин. ".repeat(6)

  test("no auto-clear before the last page; clear timer starts on the last page", async () => {
    const e = setup([long], {clearAfterSec: 10, autoAdvanceSec: 0})
    e.a.onTranscript("Вопрос, расскажи про Колизей", true)
    await e.clock.advance(SILENCE_MS + 10)
    const n = e.a.pages.length
    expect(n).toBeGreaterThan(2)

    await e.clock.advance(120_000) // reading slowly — must not disappear
    expect(e.a.phase).toBe("answering")
    expect(e.shown.at(-1)).toBe(e.a.pages[0])

    for (let i = 1; i < n; i++) {
      await e.clock.advance(30_000)
      e.a.onTranscript("Дальше.", true)
      expect(e.a.page).toBe(i)
      expect(e.a.phase).toBe("answering")
    }
    await e.clock.advance(9_000)
    expect(e.a.phase).toBe("answering")
    await e.clock.advance(1_100)
    expect(e.shown.at(-1)).toBe("<clear>")
    expect(e.a.phase).toBe("idle")

    // after the timer hid it, "назад" brings the answer back
    e.a.onTranscript("Назад", true)
    expect(e.a.phase).toBe("answering")
    expect(e.a.page).toBe(n - 2)
  })

  test("after an explicit «скрой», «дальше» does not pop the answer back", async () => {
    const e = setup([long])
    e.a.onTranscript("Вопрос, расскажи про Колизей", true)
    await e.clock.advance(SILENCE_MS + 10)
    e.a.onTranscript("Скрой", true)
    expect(e.a.phase).toBe("idle")
    e.a.onTranscript("Дальше", true)
    expect(e.a.phase).toBe("idle")
    e.a.onTranscript("Повтори", true)
    expect(e.a.phase).toBe("answering")
  })

  test("tolerant paging phrases", async () => {
    const e = setup([long])
    e.a.onTranscript("Вопрос, расскажи про Колизей", true)
    await e.clock.advance(SILENCE_MS + 10)
    e.a.onTranscript("Ну давай дальше", true)
    expect(e.a.page).toBe(1)
    e.a.onTranscript("Окей, дальше, пожалуйста.", true)
    expect(e.a.page).toBe(2)
    e.a.onTranscript("Назад назад", true)
    expect(e.a.page).toBe(1)
    e.a.onTranscript("Следующую страницу", true)
    expect(e.a.page).toBe(2)
  })

  test("interim «Даль…» in the reply window does not replace the answer with «Слушаю…»", async () => {
    const e = setup(["Нужно уточнить детали поездки. ".repeat(10) + "Из какого города?"])
    e.a.onTranscript("Вопрос, сколько лететь до Рима?", true)
    await e.clock.advance(SILENCE_MS + 10)
    const before = e.shown.length
    e.a.onTranscript("Даль", false)
    expect(e.a.phase).toBe("answering")
    expect(e.shown.length).toBe(before)
    e.a.onTranscript("Дальше.", true)
    expect(e.a.page).toBe(1)
  })
})

describe("looking up turns the page (G1 head-up sensor)", () => {
  const long = "Колизей открыт с 9 утра. Билет стоит около 18 евро и включает Форум и Палатин. ".repeat(6)

  test("up → next page; down and sensor bounce are ignored; nothing on the last page", async () => {
    const e = setup([long], {clearAfterSec: 10})
    e.a.onTranscript("Вопрос, расскажи про Колизей", true)
    await e.clock.advance(SILENCE_MS + 10)
    const n = e.a.pages.length
    expect(n).toBeGreaterThan(2)

    e.a.onHeadPosition("up")
    expect(e.a.page).toBe(1)
    e.a.onHeadPosition("down")
    e.a.onHeadPosition("up") // bounce right after
    expect(e.a.page).toBe(1)
    for (let i = 2; i < n; i++) {
      await e.clock.advance(1500)
      e.a.onHeadPosition("up")
      expect(e.a.page).toBe(i)
    }
    await e.clock.advance(1500)
    const shownBefore = e.shown.length
    e.a.onHeadPosition("up") // last page: stays
    expect(e.a.page).toBe(n - 1)
    expect(e.shown.length).toBe(shownBefore)
    expect(e.a.phase).toBe("answering")
    expect(e.a.log.some((l) => l.msg === "next (head)")).toBe(true)
  })

  test("ignored when no answer is on screen, while listening, or when turned off", async () => {
    const e = setup([long, long], {headNod: false})
    e.a.onHeadPosition("up")
    expect(e.shown.length).toBe(0)
    e.a.onTranscript("Вопрос, расскажи про Колизей", true)
    await e.clock.advance(SILENCE_MS + 10)
    e.a.onHeadPosition("up")
    expect(e.a.page).toBe(0)

    const on = setup([long])
    on.a.onTranscript("Вопрос, расскажи", false)
    expect(on.a.phase).toBe("capturing")
    on.a.onHeadPosition("up")
    expect(on.a.phase).toBe("capturing")
  })
})

describe("Mentra dashboard hides answers while the head is up", () => {
  test("warns once when an answer is shown while the head has been up; repaints on head down", async () => {
    const e = setup(["Колизей открыт с 9 до 19.", "Да."])
    e.a.onHeadPosition("up")
    expect(e.a.dashboardLikely()).toBe(false) // a quick glance up is normal
    await e.clock.advance(HEAD_UP_HIDES_MS + 100)
    expect(e.a.dashboardLikely()).toBe(true)
    expect(e.a.snapshot().dashboardLikely).toBe(true)

    e.a.onTranscript("Вопрос, во сколько открывается Колизей?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.a.log.filter((l) => l.msg === DASHBOARD_WARNING).length).toBe(1)
    e.a.onTranscript("Вопрос, а в понедельник?", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.a.log.filter((l) => l.msg === DASHBOARD_WARNING).length).toBe(1) // not every answer

    const before = e.shown.length
    e.a.onHeadPosition("down")
    expect(e.a.dashboardLikely()).toBe(false)
    expect(e.shown.length).toBe(before + 1)
    expect(e.shown.at(-1)).toBe("Да.")
    expect(e.a.log.some((l) => l.kind === "head" && l.msg === "Голова опущена")).toBe(true)
  })
})

describe("live translation («транслейт»)", () => {
  const tr = (text: string, isFinal: boolean, extra: Record<string, unknown> = {}) =>
    translation.handler?.({text, isFinal, sourceLanguage: "en", targetLanguage: "ru-RU", originalText: "x", utteranceId: "u1", ...extra})

  test("«Транслейт» starts translation to Russian; captions show on the glasses", async () => {
    const e = setup([])
    e.a.onTranscript("Транслейт.", true)
    expect(e.a.phase).toBe("translating")
    expect(translation.target).toBe("ru-RU")
    expect(e.shown.at(-1)).toContain("Перевод включён")

    tr("Добрый", false)
    expect(e.shown.at(-1)).toBe("Добрый")
    await e.clock.advance(100)
    tr("Добрый день, как", false) // throttled
    await e.clock.advance(400)
    expect(e.shown.at(-1)).toBe("Добрый день, как")
    tr("Добрый день, как у вас дела?", true)
    expect(e.shown.at(-1)).toBe("Добрый день, как у вас дела?")
    expect(e.requests.length).toBe(0) // no OpenAI cost
  })

  test("long conversation keeps only the last 5 lines", async () => {
    const e = setup([])
    e.a.onTranscript("Translate", true)
    for (let i = 0; i < 10; i++) {
      tr(`Это предложение номер ${i} в длинном разговоре о погоде и планах.`, true, {utteranceId: `u${i}`})
      await e.clock.advance(500)
    }
    const screen = e.shown.at(-1)!
    expect(screen.split("\n").length).toBe(5)
    expect(screen).toContain("номер 9")
    expect(screen).not.toContain("номер 0")
  })

  test("the wearer's own Russian speech is not echoed", async () => {
    const e = setup([])
    e.a.onTranscript("Переводи", true)
    const before = e.shown.length
    tr("Я сейчас скажу по-русски", true, {sourceLanguage: "ru", originalText: undefined})
    expect(e.shown.length).toBe(before)
  })

  test("«Стоп перевод» stops; English «stop» from people around does not", async () => {
    const e = setup([])
    e.a.onTranscript("Транслейт", true)
    e.a.onTranscript("Stop!", true)
    expect(e.a.phase).toBe("translating")
    e.a.onTranscript("Стоп перевод.", true)
    expect(e.a.phase).toBe("idle")
    expect(translation.unsubs).toBe(1)
    expect(e.shown.at(-1)).toContain("Перевод выключен")
    tr("поздний результат", true)
    expect(e.shown.at(-1)).toContain("Перевод выключен")
  })

  test("«Хватит» (Russian) also stops", async () => {
    const e = setup([])
    e.a.onTranscript("Транслейт", true)
    e.a.onTranscript("Хватит", true)
    expect(e.a.phase).toBe("idle")
  })

  test("«Вопрос, …» during translation stops it and asks the assistant", async () => {
    const e = setup(["Сейчас 11:05."])
    e.a.onTranscript("Транслейт", true)
    e.a.onTranscript("Вопрос, который час?", true)
    expect(translation.unsubs).toBe(1)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(1)
    expect(e.requests[0].body.input.at(-1).content).toBe("который час?")
    expect(e.shown.at(-1)).toBe("Сейчас 11:05.")
  })

  test("other people's speech is ignored as commands/questions while translating", async () => {
    const e = setup([])
    e.a.onTranscript("Транслейт", true)
    e.a.onTranscript("Next week we should meet in the office", true)
    e.a.onTranscript("Дальше", true)
    expect(e.a.phase).toBe("translating")
    expect(e.requests.length).toBe(0)
  })

  test("«Вопрос, транслейт» via interim capture also starts translation", async () => {
    const e = setup([])
    e.a.onTranscript("Вопрос", false)
    e.a.onTranscript("Вопрос, транслейт", true)
    expect(e.a.phase).toBe("translating")
  })

  test("silence clears the glasses but translation stays on", async () => {
    const e = setup([])
    e.a.onTranscript("Транслейт", true)
    tr("Привет", true)
    await e.clock.advance(TRANSLATE_IDLE_MS + 10)
    expect(e.shown.at(-1)).toBe("<clear>")
    expect(e.a.phase).toBe("translating")
    tr("Новая фраза", true, {utteranceId: "u2"})
    expect(e.shown.at(-1)).toBe("Новая фраза")
  })

  test("target language from settings", async () => {
    const e = setup([], {translateTo: "en-US"})
    e.a.onTranscript("Translate", true)
    expect(translation.target).toBe("en-US")
    expect(e.shown.at(-1)).toContain("Translation on")
  })
})

describe("errors are explained on the glasses", () => {
  test("no key", async () => {
    const e = setup([], {apiKey: ""})
    e.a.onTranscript("Вопрос, привет", true)
    await e.clock.advance(SILENCE_MS + 10)
    expect(e.requests.length).toBe(0)
    expect(e.shown.at(-1)).toContain("Нет ключа OpenAI")
  })

  test.each([
    [401, '{"error":{"code":"invalid_api_key","message":"Incorrect API key"}}', "Ключ OpenAI не принят"],
    [429, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}', "нет средств"],
    [404, '{"error":{"code":"model_not_found","message":"The model does not exist"}}', "Модель недоступна"],
  ])("HTTP %d", async (status, raw, expected) => {
    const kv = new MemKV()
    const store = new Store(kv)
    store.saveSettings({...DEFAULT_SETTINGS, apiKey: "sk-test-1234567890abcdef"})
    const shown: string[] = []
    const clock = new Clock()
    const a = new Assistant({
      store,
      fetch: (async () => ({ok: false, status, text: async () => raw})) as any,
      show: (t) => {
        shown.push(t)
      },
      clear: () => {},
      now: clock.now,
      setTimer: clock.set,
      clearTimer: clock.clear,
    })
    await a.ask("тест", "ui")
    expect(shown.at(-1)).toContain(expected)
    expect(a.lastError).toContain(expected)
  })

  test("400 about reasoning → retried without the parameter", async () => {
    const kv = new MemKV()
    const store = new Store(kv)
    store.saveSettings({...DEFAULT_SETTINGS, apiKey: "sk-test-1234567890abcdef", model: "gpt-6.1-sol", effort: "none"})
    const bodies: any[] = []
    const a = new Assistant({
      store,
      fetch: (async (_u: string, init: any) => {
        const b = JSON.parse(init.body)
        bodies.push(b)
        if (b.reasoning)
          return {ok: false, status: 400, text: async () => '{"error":{"message":"Unsupported value: reasoning.effort none"}}'}
        return okResponse("ok")
      }) as any,
      show: () => {},
      clear: () => {},
    })
    await a.ask("тест", "ui")
    expect(bodies.length).toBe(2)
    expect(bodies[1].reasoning).toBeUndefined()
    expect(a.lastAnswer).toBe("ok")
  })
})

describe("request building", () => {
  test("about-me, custom instructions, web search, history limit", () => {
    const s = {...DEFAULT_SETTINGS, apiKey: "k", aboutMe: "Меня зовут Стас, живу в Дублине.", instructions: "Цены в евро", webSearch: true, historyMessages: 2}
    const hist = [
      {role: "user" as const, content: "a", at: 1},
      {role: "assistant" as const, content: "b", at: 1},
      {role: "user" as const, content: "c", at: 2},
      {role: "assistant" as const, content: "d", at: 2},
    ]
    const body = buildRequestBody(s, hist, "e")
    expect(body.instructions as string).toContain("Меня зовут Стас")
    expect(body.instructions as string).toContain("Цены в евро")
    expect(body.tools).toEqual([{type: "web_search"}])
    expect(body.input).toEqual([
      {role: "user", content: "c"},
      {role: "assistant", content: "d"},
      {role: "user", content: "e"},
    ])
  })

  test("effort auto per model", () => {
    expect(effortFor({...DEFAULT_SETTINGS, model: "gpt-6-luna"})).toBe("none")
    expect(effortFor({...DEFAULT_SETTINGS, model: "gpt-6.1-sol"})).toBe("low")
    expect(effortFor({...DEFAULT_SETTINGS, model: "gpt-5.4-mini"})).toBeNull()
    expect(effortFor({...DEFAULT_SETTINGS, model: "gpt-5.4-mini", effort: "medium"})).toBe("medium")
  })

  test("extractText handles output_text and message items", () => {
    expect(extractText({output_text: " a "})).toBe("a")
    expect(extractText({output: [{type: "web_search_call"}, {type: "message", content: [{type: "output_text", text: "x"}]}]})).toBe("x")
  })
})
