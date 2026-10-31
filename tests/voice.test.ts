import {describe, expect, test} from "bun:test"
import {DEFAULT_SETTINGS} from "../src/background/store"
import {detectWake, isMeaningful, parseCommand} from "../src/background/voice"

const W = DEFAULT_SETTINGS.wakeWords

describe("wake phrase", () => {
  test.each([
    ["Вопрос, сколько лететь до Рима?", "сколько лететь до Рима?"],
    ["вопрос сколько лететь до Рима", "сколько лететь до Рима"],
    ["Эй, ассистент, какая погода завтра?", "какая погода завтра?"],
    ["Чат GPT, переведи слово apple", "переведи слово apple"],
    ["ChatGPT: что такое квазар?", "что такое квазар?"],
    ["Окей, чат-джипити, кто написал Войну и мир?", "кто написал Войну и мир?"],
    ["Вопрос.", ""],
  ])("%s", (input, rest) => {
    const r = detectWake(input, W)
    expect(r.matched).toBe(true)
    expect(r.rest).toBe(rest)
  })

  test.each([
    "У меня есть вопрос к тебе завтра",
    "Сколько лететь до Рима?",
    "Мы обсуждали ассистента на работе",
  ])("not a wake phrase: %s", (input) => {
    expect(detectWake(input, W).matched).toBe(false)
  })

  test("custom wake word", () => {
    expect(detectWake("Джарвис, который час?", ["джарвис"])).toEqual({matched: true, rest: "который час?"})
  })
})

describe("commands", () => {
  test.each([
    ["Дальше.", "next"],
    ["дальше пожалуйста", "next"],
    ["Назад", "prev"],
    ["С начала", "first"],
    ["Повтори", "repeat"],
    ["Скрой", "hide"],
    ["Стоп!", "cancel"],
    ["Новый разговор", "reset"],
    ["Начни заново", "reset"],
  ])("%s → %s", (input, cmd) => {
    expect(parseCommand(input)).toBe(cmd as any)
  })

  test.each(["Что дальше делать с визой?", "Назад в будущее кто снял", "Сколько лететь до Рима"])("not a command: %s", (s) => {
    expect(parseCommand(s)).toBeNull()
  })

  test("meaningful", () => {
    expect(isMeaningful("ну")).toBe(false)
    expect(isMeaningful("почему небо синее")).toBe(true)
  })
})
