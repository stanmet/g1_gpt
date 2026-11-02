import {describe, expect, test} from "bun:test"
import {G1_LINES} from "../src/background/g1text"
import {notesAsText, type LectureRecord} from "../src/background/lecture"
import {buildTalkPrompt, findTalkTrigger, finishedQuestions, Talk, TALK_DEDUPE_MS, TALK_SETTLE_MS, TALK_SHOW_MS} from "../src/background/talk"
import {parseTalkCommand} from "../src/background/voice"

class Clock {
  t = 1_000_000
  timers: {at: number; fn: () => void; id: number}[] = []
  private seq = 0
  now = () => this.t
  set = (fn: () => void, ms: number) => {
    const id = ++this.seq
    this.timers.push({at: this.t + ms, fn, id})
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
      await Promise.resolve()
    }
    this.t = end
    await new Promise((r) => setTimeout(r, 0))
  }
}

function setup(replies: (string | Promise<string>)[] = []) {
  const clock = new Clock()
  const shown: string[] = []
  const calls: {system: string; user: string}[] = []
  const talk = new Talk({
    complete: async (system, user) => {
      calls.push({system, user})
      if (!replies.length) throw new Error("no reply")
      return replies.shift()!
    },
    explainError: () => "Ошибка нейросети",
    show: (t) => void shown.push(t),
    clear: () => void shown.push("<clear>"),
    log: () => {},
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    save: () => {},
    onChange: () => {},
  })
  return {talk, clock, shown, calls}
}

describe("what needs a hint", () => {
  test("factual questions, with or without a question mark", () => {
    expect(findTalkTrigger("Кто такой Кант?")).toEqual({kind: "question", text: "Кто такой Кант?"})
    expect(findTalkTrigger("Слушай, а когда он родился")).toEqual({kind: "question", text: "Слушай, а когда он родился"})
    expect(findTalkTrigger("Знаешь ли ты, кто написал Войну и мир")?.kind).toBe("question")
    expect(findTalkTrigger("What is the capital of Peru?")?.kind).toBe("question")
    expect(findTalkTrigger("Мы вчера спорили. Сколько весит Земля?")).toEqual({kind: "question", text: "Сколько весит Земля?"})
  })

  test("the speaker trails off on a fact", () => {
    expect(findTalkTrigger("А вот категорический императив это")?.kind).toBe("prompt")
    expect(findTalkTrigger("А вот категорический императив — это…")?.kind).toBe("prompt")
    expect(findTalkTrigger("Категорический императив это.")?.kind).toBe("prompt") // recognition added a full stop
    expect(findTalkTrigger("Кант родился в")?.kind).toBe("prompt")
    expect(findTalkTrigger("Он там был...")?.kind).toBe("prompt")
    expect(findTalkTrigger("The speed of light is about")?.kind).toBe("prompt")
  })

  test("hesitation after the cue still counts; finished questions in live text", () => {
    expect(findTalkTrigger("Категорический императив это ну как бы")?.kind).toBe("prompt")
    expect(findTalkTrigger("Кант родился в э")?.kind).toBe("prompt")
    expect(finishedQuestions("Слушай, кто такой Кант? И когда")).toEqual([{kind: "question", text: "Слушай, кто такой Кант?"}])
    expect(finishedQuestions("Кто такой Кант")).toEqual([]) // not finished yet
    expect(finishedQuestions("Как дела? Нормально.")).toEqual([])
  })

  test("small talk and finished statements cost nothing", () => {
    for (const t of [
      "Как дела?", "Будешь кофе?", "Ты понял?", "Что?", "Ну, это", "Он там был.", "Я думаю, что это хорошая идея.",
      "Как я говорил, это важно.", "How are you?", "Да.",
    ])
      expect(findTalkTrigger(t)).toBeNull()
  })

  test("voice commands", () => {
    for (const p of ["Беседа", "Режим беседы.", "Суфлёр", "Ну, подсказки", "conversation mode"]) expect(parseTalkCommand(p)).toBe("start")
    for (const p of ["Стоп беседа", "Конец беседы.", "Выключи подсказки", "stop conversation"]) expect(parseTalkCommand(p)).toBe("stop")
    for (const p of ["У нас была интересная беседа", "стоп", "хватит"]) expect(parseTalkCommand(p)).toBeNull()
  })
})

describe("prompt", () => {
  test("carries the conversation, earlier hints and the language of the utterance", () => {
    const p = buildTalkPrompt(
      "Кто такой Кант? Это философ.",
      [{q: "Кант", a: "Немецкий философ, 1724–1804"}],
      {kind: "prompt", text: "А категорический императив это"},
      false,
      "ru",
    )
    expect(p.system).toContain("суфлёр")
    expect(p.system).toContain("SKIP")
    expect(p.system).toContain("русском")
    expect(p.user).toContain("— Кант: Немецкий философ, 1724–1804")
    expect(p.user).toContain("оборвана")
    expect(p.user).toContain("Кто такой Кант?")
    const own = buildTalkPrompt("", [], {kind: "question", text: "Who was Kant?"}, true, "en")
    expect(own.system).toContain("ответь обязательно")
    expect(own.system).not.toContain("ровно SKIP")
    expect(own.system).toContain("English")
  })
})

describe("conversation flow", () => {
  test("question → answer at once; follow-up uses the previous hint; screen clears later", async () => {
    const e = setup([
      "Q: Иммануил Кант\nA: Немецкий философ, 1724–1804, Кёнигсберг. «Критика чистого разума».",
      "Q: Категорический императив\nA: Поступай так, чтобы правило поступка могло стать всеобщим законом.",
    ])
    e.talk.start({en: false})
    expect(e.shown.at(-1)).toContain("Режим беседы")
    await e.clock.advance(6000) // intro goes away
    expect(e.shown.at(-1)).toBe("<clear>")

    e.talk.onSpeech("Слушай, кто такой Кант?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    const first = e.shown.at(-1)!
    expect(first.startsWith("? Иммануил Кант")).toBe(true)
    expect(first).toContain("→ Немецкий философ, 1724–1804")
    expect(first.split("\n").length).toBeLessThanOrEqual(G1_LINES)

    e.talk.onSpeech("Это немецкий философ, он придумал категорический императив.")
    e.talk.onSpeech("А вот категорический императив это")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(2)
    expect(e.calls[1].user).toContain("— Иммануил Кант: Немецкий философ")
    expect(e.calls[1].user).toContain("он придумал категорический императив")
    expect(e.shown.at(-1)).toContain("→ Поступай так")
    expect(e.talk.record!.notes.map((n) => n.kind)).toEqual(["qa", "hint"])

    await e.clock.advance(TALK_SHOW_MS + 10)
    expect(e.shown.at(-1)).toBe("<clear>")
    expect(e.talk.screen).toBe("")
  })

  test("live text: a finished question is answered before the utterance ends, not twice", async () => {
    const e = setup(["Q: Иммануил Кант\nA: Немецкий философ, 1724–1804."])
    e.talk.start({en: false})
    e.talk.onInterim("Слушай,")
    e.talk.onInterim("Слушай, кто такой")
    e.talk.onInterim("Слушай, кто такой Кант?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1) // at once, no pause needed
    expect(e.shown.at(-1)).toContain("→ Немецкий философ")
    e.talk.onInterim("Слушай, кто такой Кант? Ну, в двух словах")
    e.talk.onSpeech("Слушай, кто такой Кант? Ну, в двух словах.")
    await e.clock.advance(TALK_SETTLE_MS + 10)
    expect(e.calls.length).toBe(1)
  })

  test("live text: a trailing «это» is answered after a short pause, not twice", async () => {
    const e = setup(["Q: Категорический императив\nA: Поступай так, чтобы правило могло стать всеобщим законом."])
    e.talk.start({en: false})
    e.talk.onInterim("А вот категорический")
    await e.clock.advance(500)
    e.talk.onInterim("А вот категорический императив это")
    await e.clock.advance(TALK_SETTLE_MS - 100)
    expect(e.calls.length).toBe(0) // still speaking?
    await e.clock.advance(200)
    expect(e.calls.length).toBe(1)
    expect(e.calls[0].user).toContain("оборвана")
    e.talk.onSpeech("А вот категорический императив это.")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.shown.at(-1)).toContain("→ Поступай так")
  })

  test("small talk is skipped by the AI; duplicates are ignored; the newest wins while busy", async () => {
    let release: (v: string) => void = () => {}
    const slow = new Promise<string>((r) => (release = r))
    const e = setup(["SKIP", slow, "Q: Население Перу\nA: Около 34 млн человек."])
    e.talk.start({en: false})
    e.talk.onSpeech("Где мы встретимся завтра?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.talk.record!.notes.length).toBe(0)

    e.talk.onSpeech("Какая столица Перу?")
    e.talk.onSpeech("Какая столица Перу?") // repeated within TALK_DEDUPE_MS
    e.talk.onSpeech("Сколько людей живёт в Боливии?") // superseded while busy
    e.talk.onSpeech("А сколько людей живёт в Перу?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(2)
    release("Q: Столица Перу\nA: Лима.")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(3)
    expect(e.calls[2].user).toContain("сколько людей живёт в Перу")
    expect(e.talk.record!.notes.map((n) => n.q)).toEqual(["Столица Перу", "Население Перу"])

    await e.clock.advance(TALK_DEDUPE_MS + 10)
    e.talk.onSpeech("Какая столица Перу?") // asked again later: answered again
    await e.clock.advance(10)
    expect(e.calls.length).toBe(4)
  })

  test("own question is always answered; stop drops late replies; notes as text", async () => {
    let release: (v: string) => void = () => {}
    const e = setup(["Q: Год рождения Канта\nA: 1724.", new Promise<string>((r) => (release = r))])
    e.talk.start({en: false})
    e.talk.askUser("Когда родился Кант?")
    expect(e.shown.at(-1)).toContain("…думаю")
    await e.clock.advance(10)
    expect(e.shown.at(-1)).toContain("→ 1724.")
    expect(e.calls[0].system).toContain("ответь обязательно")

    e.talk.onSpeech("А когда он умер?")
    await e.clock.advance(10)
    expect(e.talk.stop()).toEqual({hints: 1})
    release("Q: Смерть Канта\nA: 1804.")
    await e.clock.advance(10)
    expect(e.talk.record!.notes.length).toBe(1)

    const text = notesAsText(e.talk.record as LectureRecord, () => "2 ноября", {title: "Подсказки в беседе", asked: "Вопрос"})
    expect(text).toBe("Подсказки в беседе — 2 ноября\n\nМой вопрос: Год рождения Канта\n  → 1724.")
  })
})
