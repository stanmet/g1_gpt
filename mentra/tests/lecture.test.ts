import {describe, expect, test} from "bun:test"
import {
  answerScreen,
  buildAnswerPrompt,
  buildPointsPrompt,
  findAudienceQuestion,
  Lecture,
  LECTURE_ANSWER_HOLD_MS,
  LECTURE_MIN_INTERVAL_MS,
  LECTURE_RESUME_MS,
  LECTURE_SILENCE_FLUSH_MS,
  notesAsText,
  parseAnswer,
  parsePoints,
  pointsScreen,
  type LectureRecord,
} from "../src/background/lecture"
import {G1_LINES} from "../src/background/g1text"
import {parseLectureCommand} from "../src/background/voice"

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
      await Promise.resolve()
    }
    this.t = end
    await new Promise((r) => setTimeout(r, 0))
  }
}

const SENT =
  "Today we talk about entropy, which measures how many microscopic arrangements correspond to the same macroscopic state of a system."

function setup(replies: ((system: string, user: string) => string)[] = []) {
  const clock = new Clock()
  const shown: string[] = []
  const calls: {system: string; user: string}[] = []
  const saved: LectureRecord[] = []
  const logs: string[] = []
  const lec = new Lecture({
    complete: async (system, user) => {
      calls.push({system, user})
      const r = replies.shift()
      if (!r) throw Object.assign(new Error("no reply"), {status: 500, code: "x"})
      return r(system, user)
    },
    explainError: () => "Ошибка нейросети",
    show: (t) => void shown.push(t),
    clear: () => void shown.push("<clear>"),
    log: (_k, m) => void logs.push(m),
    lang: () => "ru",
    now: clock.now,
    setTimer: clock.set,
    clearTimer: clock.clear,
    save: (r) => void saved.push(JSON.parse(JSON.stringify(r))),
    onChange: () => {},
  })
  return {lec, clock, shown, calls, saved, logs}
}

describe("voice commands", () => {
  test("start and stop phrases", () => {
    for (const p of ["Лекция", "Режим лекции.", "Ну, конспект", "lecture mode", "Начни конспект"]) expect(parseLectureCommand(p)).toBe("start")
    for (const p of ["Стоп лекция", "Конец лекции.", "Выключи конспект", "stop lecture"]) expect(parseLectureCommand(p)).toBe("stop")
    for (const p of ["Сегодня лекция по физике", "the lecture is about entropy", "стоп"]) expect(parseLectureCommand(p)).toBeNull()
  })
})

describe("questions to the audience", () => {
  test("real questions are found, housekeeping is not", () => {
    expect(findAudienceQuestion("So what happens to the entropy of ice when it melts?")).toBe(
      "So what happens to the entropy of ice when it melts?",
    )
    expect(findAudienceQuestion("Okay. Does anyone know who formulated the second law")).toBe("Does anyone know who formulated the second law")
    expect(findAudienceQuestion("We saw that last week. Why does heat flow from hot to cold? Let's think.")).toBe(
      "Why does heat flow from hot to cold?",
    )
    expect(findAudienceQuestion("Кто знает, чему равна постоянная Больцмана?")).toBe("Кто знает, чему равна постоянная Больцмана?")
    for (const t of ["Any questions?", "Can you hear me at the back?", "Does that make sense?", "Right?", "Okay, so?", "Есть вопросы?"])
      expect(findAudienceQuestion(t)).toBeNull()
    expect(findAudienceQuestion("Entropy always increases in an isolated system.")).toBeNull()
  })
})

describe("parsing AI replies", () => {
  test("key points", () => {
    expect(parsePoints("• Энтропия — мера беспорядка\n• Растёт в замкнутой системе")).toEqual([
      "Энтропия — мера беспорядка",
      "Растёт в замкнутой системе",
    ])
    expect(parsePoints("1. Первый\n2) Второй\n- Третий\n• Четвёртый")).toEqual(["Первый", "Второй", "Третий"])
    expect(parsePoints("SKIP")).toEqual([])
    expect(parsePoints("  skip.")).toEqual([])
  })
  test("question and answer", () => {
    expect(parseAnswer("Q: Энтропия льда при таянии?\nA: Растёт: молекулы движутся свободнее.", "x")).toEqual({
      q: "Энтропия льда при таянии?",
      a: "Растёт: молекулы движутся свободнее.",
    })
    expect(parseAnswer("Растёт.", "Что с энтропией?")).toEqual({q: "Что с энтропией?", a: "Растёт."})
    expect(parseAnswer("SKIP", "x")).toBeNull()
  })
  test("screens fit the G1 display", () => {
    const long = "очень длинный тезис про термодинамику и статистическую физику ".repeat(4)
    expect(pointsScreen([long, long, long]).split("\n").length).toBeLessThanOrEqual(G1_LINES)
    const a = answerScreen("Почему тепло идёт от горячего к холодному, а не наоборот?", long)
    const lines = a.split("\n")
    expect(lines.length).toBeLessThanOrEqual(G1_LINES)
    expect(lines[0].startsWith("? ")).toBe(true)
    expect(lines[1].startsWith("→ ")).toBe(true)
  })
  test("prompts ask for the gist in the chosen language, with earlier points and context", () => {
    const p = buildPointsPrompt(["Энтропия — мера беспорядка"], SENT, "ru")
    expect(p.system).toContain("русском")
    expect(p.system).toContain("SKIP")
    expect(p.user).toContain("• Энтропия — мера беспорядка")
    expect(p.user).toContain(SENT)
    expect(buildPointsPrompt([], SENT, "en").system).toContain("English")
    const q = buildAnswerPrompt(SENT, "Why?", "ru", false)
    expect(q.user).toContain(SENT)
    expect(q.system).toContain("Q:")
  })
})

describe("lecture mode flow", () => {
  test("key points come after enough speech and time, not on every sentence", async () => {
    const e = setup([() => "• Энтропия — число микросостояний\n• Связана с беспорядком"])
    e.lec.start()
    expect(e.shown.at(-1)).toContain("Режим лекции")
    e.lec.onSpeech(SENT)
    e.lec.onSpeech(SENT)
    e.lec.onSpeech(SENT)
    expect(e.calls.length).toBe(0) // ~60 words, but 40 s have not passed
    await e.clock.advance(LECTURE_MIN_INTERVAL_MS)
    e.lec.onSpeech(SENT)
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.calls[0].user).toContain("entropy")
    expect(e.shown.at(-1)).toBe(pointsScreen(["Энтропия — число микросостояний", "Связана с беспорядком"]))
    expect(e.lec.record!.notes.map((n) => n.kind)).toEqual(["point", "point"])
    expect(e.saved.at(-1)!.notes.length).toBe(2)
  })

  test("a pause flushes what was said", async () => {
    const e = setup([() => "• Тезис после паузы"])
    e.lec.start()
    e.lec.onSpeech(SENT)
    await e.clock.advance(LECTURE_SILENCE_FLUSH_MS + 10)
    expect(e.calls.length).toBe(1)
    expect(e.shown.at(-1)).toContain("Тезис после паузы")
  })

  test("nothing substantive → nothing shown", async () => {
    const e = setup([() => "SKIP"])
    e.lec.start()
    const before = e.shown.length
    e.lec.onSpeech("Good morning everyone, let me just plug in my laptop and find the slides for today.")
    await e.clock.advance(LECTURE_SILENCE_FLUSH_MS + 10)
    expect(e.calls.length).toBe(1)
    expect(e.shown.length).toBe(before)
    expect(e.lec.record!.notes.length).toBe(0)
  })

  test("the lecturer's question is answered at once and held over the next key points", async () => {
    const e = setup([
      () => "Q: Энтропия льда при таянии?\nA: Растёт: молекулы воды движутся свободнее.",
      () => "• Второй закон термодинамики",
    ])
    e.lec.start()
    e.lec.onSpeech(SENT)
    e.lec.onSpeech("So what happens to the entropy of ice when it melts?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.calls[0].system).toContain("обратился к аудитории")
    expect(e.calls[0].user).toContain("entropy") // lecture context goes along
    const answer = e.shown.at(-1)!
    expect(answer.startsWith("? Энтропия льда")).toBe(true)
    expect(answer).toContain("→ Растёт")

    // key points arrive while the answer is held: they wait
    await e.clock.advance(LECTURE_SILENCE_FLUSH_MS + 10)
    expect(e.calls.length).toBe(2)
    expect(e.shown.at(-1)).toBe(answer)
    await e.clock.advance(LECTURE_ANSWER_HOLD_MS)
    expect(e.shown.at(-1)).toContain("Второй закон")
    expect(e.lec.record!.notes.map((n) => n.kind)).toEqual(["qa", "point"])
  })

  test("housekeeping questions cost nothing; SKIPped questions show nothing", async () => {
    const e = setup([() => "SKIP"])
    e.lec.start()
    e.lec.onSpeech("Any questions?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(0)
    const before = e.shown.length
    e.lec.onSpeech("Can everybody see the board from there?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.shown.length).toBe(before)
  })

  test("the user's own question; errors are shown once a minute; stop ignores late replies", async () => {
    let release: (v: string) => void = () => {}
    const e = setup([
      () => "Q: Что такое микросостояние?\nA: Конкретное расположение всех частиц системы.",
    ])
    e.lec.start()
    e.lec.askUser("Что такое микросостояние?")
    expect(e.shown.at(-1)).toContain("…думаю")
    await e.clock.advance(10)
    expect(e.shown.at(-1)).toContain("→ Конкретное расположение")
    expect(e.lec.record!.notes[0].kind).toBe("you")

    // no more replies → errors
    await e.clock.advance(LECTURE_ANSWER_HOLD_MS)
    e.lec.onSpeech(SENT)
    await e.clock.advance(LECTURE_SILENCE_FLUSH_MS + 10)
    expect(e.shown.at(-1)).toBe("Ошибка нейросети")
    const n = e.shown.length
    e.lec.onSpeech(SENT)
    await e.clock.advance(LECTURE_SILENCE_FLUSH_MS + 10)
    expect(e.shown.length).toBe(n) // not again within a minute

    // a reply that arrives after stop is dropped
    const slow = setup([() => new Promise<string>((r) => (release = r)) as unknown as string])
    slow.lec.start()
    slow.lec.onSpeech(SENT)
    await slow.clock.advance(LECTURE_SILENCE_FLUSH_MS + 10)
    const summary = slow.lec.stop()
    expect(summary).toEqual({points: 0, answers: 0})
    release("• Поздний тезис")
    await slow.clock.advance(10)
    expect(slow.lec.record!.notes.length).toBe(0)
    expect(slow.lec.record!.endedAt).toBeGreaterThan(0)
  })

  test("restarting soon after a stop continues the notes; later starts fresh", async () => {
    const e = setup([() => "• Первый тезис"])
    e.lec.start()
    e.lec.onSpeech(SENT)
    await e.clock.advance(LECTURE_SILENCE_FLUSH_MS + 10)
    e.lec.stop()
    await e.clock.advance(60_000)
    e.lec.start()
    expect(e.lec.record!.notes.length).toBe(1)
    expect(e.lec.record!.endedAt).toBeUndefined()
    e.lec.stop()
    await e.clock.advance(LECTURE_RESUME_MS + 1000)
    e.lec.start()
    expect(e.lec.record!.notes.length).toBe(0)
  })

  test("notes as text for copying", () => {
    const r: LectureRecord = {
      startedAt: 0,
      notes: [
        {t: 1, kind: "point", text: "Энтропия — мера беспорядка"},
        {t: 2, kind: "qa", q: "Что с энтропией льда?", text: "Растёт."},
      ],
    }
    const txt = notesAsText(r, () => "2 ноября")
    expect(txt).toBe("Конспект лекции — 2 ноября\n\n• Энтропия — мера беспорядка\nВопрос лектора: Что с энтропией льда?\n  → Растёт.")
    expect(notesAsText(null, () => "")).toBe("")
  })
})
