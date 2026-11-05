import {describe, expect, test} from "bun:test"
import {G1_LINES} from "../src/background/g1text"
import {notesAsText, type LectureRecord} from "../src/background/lecture"
import {
  buildTalkPrompt,
  buildTipPrompt,
  findTalkTrigger,
  finishedQuestions,
  looksLikeClaim,
  parseTip,
  Talk,
  TALK_ANSWER_PRIORITY_MS,
  TALK_DEDUPE_MS,
  TALK_SETTLE_MS,
  TALK_SHOW_MS,
} from "../src/background/talk"
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

function setup(replies: (string | Promise<string>)[] = [], opts: {everySec?: number; goal?: string} = {}) {
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
    everySec: () => opts.everySec ?? 0,
    goal: () => opts.goal ?? "",
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
    expect(e.shown.at(-1)).toBe("• Слушай, кто такой Кант? …") // at once: a hint is coming
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    const first = e.shown.at(-1)!
    expect(first.replace(/\n/g, " ").startsWith("• Иммануил Кант: Немецкий философ, 1724–1804")).toBe(true)
    expect(first).not.toContain("…\n") // the placeholder was replaced
    expect(first.split("\n").length).toBeLessThanOrEqual(G1_LINES)

    e.talk.onSpeech("Это немецкий философ, он придумал категорический императив.")
    e.talk.onSpeech("А вот категорический императив это")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(2)
    expect(e.calls[1].user).toContain("— Иммануил Кант: Немецкий философ")
    expect(e.calls[1].user).toContain("он придумал категорический императив")
    expect(e.shown.at(-1)).toContain("Поступай так")
    expect(e.shown.at(-1)).toMatch(/^• Категорический императив:/)
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
    expect(e.shown.at(-1)).toContain("Иммануил Кант: Немецкий философ")
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
    expect(e.shown.at(-1)).toContain("Поступай так")
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
    expect(e.shown.at(-1)).toBe("• Когда родился Кант? …")
    await e.clock.advance(10)
    expect(e.shown.at(-1)).toBe("• Год рождения Канта: 1724.")
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

describe("analysis of the conversation: fact checks and evidence, no «Спроси»", () => {
  const LINE = "Мы обсуждаем ремонт кухни, у нас бюджет около пяти тысяч евро и сроки до весны"
  const CHAT = "Ну вот мы и договорились, давай тогда встретимся у входа после работы"

  test("prompt and parsing", () => {
    const p = buildTipPrompt("Мы обсуждаем ремонт.", ["Факт: Средняя цена ремонта кухни в Дублине — 15–25 тыс. евро."], "договориться о скидке", "ru")
    expect(p.system).toContain("фактчекер")
    expect(p.system).toContain("Цель пользователя: договориться о скидке")
    for (const label of ["Неверно:", "Спорно:", "Верно:", "Факт:", "Довод:", "Цитата:"]) expect(p.system).toContain(label)
    expect(p.system).toContain("Не предлагай, что спросить или сказать")
    expect(p.system).not.toContain("Спроси:")
    expect(p.system).not.toContain("Скажи:")
    expect(p.system).toContain("Никогда не придумывай цифры")
    expect(p.system).toContain("SKIP")
    expect(p.user).toContain("— Факт: Средняя цена")
    expect(buildTipPrompt("x", [], "", "ru").system).not.toContain("Цель пользователя")
    expect(buildTipPrompt("x", [], "", "en").system).toContain("False:")
    expect(parseTip("Неверно: Кант родился в 1724, а не в 1742.")).toEqual({label: "false", text: "Кант родился в 1724, а не в 1742."})
    expect(parseTip("Довод: По закону о защите прав потребителей гарантия — 2 года.")).toMatchObject({label: "evidence"})
    expect(parseTip("Спорно: данные о вреде кофе расходятся (Cochrane, 2021).")).toMatchObject({label: "disputed"})
    expect(parseTip("Fact: Lima is the capital of Peru.")).toEqual({label: "fact", text: "Lima is the capital of Peru."})
    // advice is not shown, even if the model slips into it
    expect(parseTip("Спроси: Есть ли скидка при оплате сразу?")).toBeNull()
    expect(parseTip("Скажи: Другая фирма дешевле.")).toBeNull()
    expect(parseTip("SKIP")).toBeNull()
    expect(parseTip("Просто текст без метки")).toBeNull()
  })

  test("claims with numbers, dates, «доказано» are worth checking", () => {
    expect(looksLikeClaim("В Китае живёт полтора миллиарда человек")).toBe(true)
    expect(looksLikeClaim("Учёные доказали, что кофе вреден для сердца")).toBe(true)
    expect(looksLikeClaim("Кант родился в 1742 году в Берлине")).toBe(true)
    expect(looksLikeClaim("А сколько стоит такой ремонт?")).toBe(false)
    expect(looksLikeClaim(CHAT)).toBe(false)
    expect(looksLikeClaim("Это 100%")).toBe(false) // too short
  })

  test("about every N seconds of talk, toward the goal, without repeats", async () => {
    const e = setup(
      ["Факт: Средняя цена ремонта кухни в Ирландии — 15–25 тыс. евро.", "Факт: Средняя цена ремонта кухни в Ирландии — 15–25 тыс. евро.", "Довод: Зимой у строителей меньше заказов, скидки до 10%."],
      {everySec: 10, goal: "договориться о скидке"},
    )
    e.talk.start({en: false})
    expect(e.shown.at(-1)).toContain("цель: договориться о скидке")
    expect(e.shown.at(-1)).toContain("проверка фактов")
    e.talk.onSpeech(CHAT)
    await e.clock.advance(10)
    expect(e.calls.length).toBe(0) // 10 s have not passed yet
    await e.clock.advance(10_000)
    e.talk.onInterim("И ещё нужно поменять")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.calls[0].system).toContain("договориться о скидке")
    expect(e.calls[0].user).toContain("встретимся у входа")
    expect(e.calls[0].user).toContain("И ещё нужно поменять") // the live text goes along
    expect(e.shown.at(-1)!.replace(/\n/g, " ")).toBe("• Факт: Средняя цена ремонта кухни в Ирландии — 15–25 тыс. евро.")

    e.talk.onSpeech(CHAT)
    await e.clock.advance(10_000)
    e.talk.onSpeech(CHAT)
    await e.clock.advance(10)
    expect(e.calls.length).toBe(2) // same finding again → not shown twice
    expect(e.talk.record!.notes.length).toBe(1)
    await e.clock.advance(10_000)
    e.talk.onSpeech(CHAT)
    await e.clock.advance(10)
    expect(e.calls.length).toBe(3)
    expect(e.shown.at(-1)).toMatch(/^· Факт: .*\n• Довод: Зимой/s) // feed: newest at the bottom
    expect(e.talk.record!.notes.map((n) => n.kind)).toEqual(["tip", "tip"])
  })

  test("a claim is checked within seconds, not at the next regular hint", async () => {
    const e = setup(["Неверно: Кант родился в 1724 году в Кёнигсберге."], {everySec: 30})
    e.talk.start({en: false})
    await e.clock.advance(6000)
    e.talk.onSpeech("Кант родился в 1742 году в Берлине, это все знают")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.shown.at(-1)!.replace(/\n/g, " ")).toBe("• Неверно: Кант родился в 1724 году в Кёнигсберге.")
  })

  test("who said what goes to the AI when voices are told apart", async () => {
    const e = setup(["SKIP"], {everySec: 10})
    e.talk.start({en: false})
    await e.clock.advance(6000)
    e.talk.onSpeech("Я думаю, что ремонт можно сделать за месяц", "me")
    e.talk.onSpeech("Нет, такой ремонт меньше трёх месяцев не делается никогда", "other")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    expect(e.calls[0].user).toContain("Вы: Я думаю")
    expect(e.calls[0].user).toContain("Собеседник: Нет, такой ремонт")
  })

  test("silence or too few words → no hint; off when the setting is 0", async () => {
    const e = setup(["Факт: x"], {everySec: 10})
    e.talk.start({en: false})
    await e.clock.advance(30_000)
    e.talk.onSpeech("Ага, да.")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(0)
    const off = setup(["Факт: x"], {everySec: 0})
    off.talk.start({en: false})
    off.talk.onSpeech(LINE)
    await off.clock.advance(30_000)
    off.talk.onSpeech(LINE)
    await off.clock.advance(10)
    expect(off.calls.length).toBe(0)
  })

  test("questions never wait for a proactive hint, and a fresh answer stays on top", async () => {
    let release: (v: string) => void = () => {}
    const e = setup([new Promise<string>((r) => (release = r)), "Q: Иммануил Кант\nA: Немецкий философ, 1724–1804."], {everySec: 10})
    e.talk.start({en: false})
    e.talk.onSpeech(LINE)
    await e.clock.advance(10_000)
    e.talk.onSpeech(LINE) // proactive request starts and hangs
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1)
    e.talk.onSpeech("Слушай, а кто такой Кант?")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(2) // asked right away, in parallel
    expect(e.shown.at(-1)).toContain("Иммануил Кант: Немецкий философ")
    release("Факт: Кант жил в Кёнигсберге всю жизнь.")
    await e.clock.advance(10)
    expect(e.shown.at(-1)).not.toContain("Факт") // the answer is fresh: the tip is kept in the list only
    expect(e.talk.record!.notes.map((n) => n.kind)).toEqual(["qa", "tip"])
    expect(TALK_ANSWER_PRIORITY_MS).toBeGreaterThan(5000)
  })
})

describe("quotes: who said it", () => {
  test("finding quotes", async () => {
    const {findQuote, buildQuotePrompt, parseTip} = await import("../src/background/talk")
    expect(findQuote("Как говорил Черчилль, успех — это идти от неудачи к неудаче.")?.complete).toBe(true)
    expect(findQuote("Есть такая фраза: что нас не убивает, делает нас сильнее.")?.complete).toBe(true)
    expect(findQuote("As Einstein said, imagination is more important than knowledge.")?.complete).toBe(true)
    expect(findQuote("Он сказал «быть или не быть, вот в чём вопрос».")?.complete).toBe(true)
    expect(findQuote("Ну как говорится,")).toEqual({text: "Ну как говорится,", complete: false})
    expect(findQuote("Я вчера говорил с мамой.")).toBeNull()
    const p = buildQuotePrompt("", "Как говорил Черчилль, успех — это идти от неудачи к неудаче.", "ru")
    expect(p.system).toContain("приписали не тому")
    expect(p.system).toContain("SKIP")
    expect(parseTip("Цитата: Ницше, «Сумерки идолов» (1888)")).toEqual({label: "quote", text: "Ницше, «Сумерки идолов» (1888)"})
  })

  test("a quote gets its author on the glasses; an announced quote waits for its words", async () => {
    const e = setup([
      "Q: Успех — идти от неудачи\nA: Приписывают Черчиллю, но надёжного источника нет.",
      "Q: Без труда не выловишь\nA: Русская пословица: без усилий нет результата.",
      "SKIP",
    ])
    e.talk.start({en: false})
    e.talk.onSpeech("Как говорил Черчилль, успех — это идти от неудачи к неудаче без потери энтузиазма.")
    await e.clock.advance(10)
    expect(e.calls[0].system).toContain("чья это цитата")
    expect(e.shown.at(-1)!.replace(/\n/g, " ")).toBe("• «Успех — идти от неудачи» — Приписывают Черчиллю, но надёжного источника нет.")
    expect(e.talk.record!.notes.at(-1)!.kind).toBe("quote")

    e.talk.onSpeech("Ну как говорится,")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(1) // the quote itself is still to come
    e.talk.onSpeech("без труда не выловишь и рыбку из пруда.")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(2)
    expect(e.calls[1].user).toContain("как говорится, без труда не выловишь")
    expect(e.shown.at(-1)!.replace(/\n/g, " ")).toContain("Русская пословица")

    e.talk.onSpeech("По словам соседа, завтра будет дождь и сильный ветер.")
    await e.clock.advance(10)
    expect(e.calls.length).toBe(3) // checked, but not a known quote: nothing shown
    expect(e.talk.record!.notes.length).toBe(2)
  })

  test("lecture key points name quoted authors; proactive hints can flag a quote", async () => {
    const {buildPointsPrompt} = await import("../src/background/lecture")
    expect(buildPointsPrompt([], "As Kant wrote...", "ru").system).toContain("Цитата: автор")
    expect(buildTipPrompt("", [], "", "ru").system).toContain("Цитата:")
  })
})
