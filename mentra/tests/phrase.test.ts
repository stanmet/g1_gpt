import {describe, expect, test} from "bun:test"
import {buildPhrasePrompt, cleanPhraseReply} from "../src/background/phrase"
import {parsePhraseRequest} from "../src/background/voice"

describe("«как будет на английском …»", () => {
  test("phrasings people use", () => {
    const cases: [string, string, string][] = [
      ["Как будет на английском стол?", "en", "стол"],
      ["как по-английски «спасибо»", "en", "спасибо"],
      ["Как по английски до свидания", "en", "до свидания"],
      ["Как сказать по-английски: я опаздываю.", "en", "я опаздываю"],
      ["Как будет стол на английском?", "en", "стол"],
      ["А как будет на английском языке холодильник", "en", "холодильник"],
      ["Как сказать спасибо по-немецки?", "de", "спасибо"],
      ["Слушай, как будет по-французски спасибо", "fr", "спасибо"],
      ["Переведи на английский я тебя люблю", "en", "я тебя люблю"],
      ["Как перевести «ничего страшного» на английский", "en", "ничего страшного"],
      ["How do you say table in Russian?", "ru", "table"],
      ["What is thank you in German?", "de", "thank you"],
      ["Translate good morning into Spanish", "es", "good morning"],
    ]
    for (const [t, lang, phrase] of cases) expect(parsePhraseRequest(t)).toEqual({lang: lang as any, phrase})
  })

  test("the word may come after a pause", () => {
    expect(parsePhraseRequest("Как будет на английском")).toEqual({lang: "en", phrase: ""})
    expect(parsePhraseRequest("Как это будет по-английски?")).toEqual({lang: "en", phrase: ""})
  })

  test("ordinary speech is not a request", () => {
    for (const t of ["Как дела?", "Как будет лучше?", "Я говорю по-английски", "Как ты думаешь, это на английском написано?"])
      expect(parsePhraseRequest(t)).toBeNull()
  })

  test("prompt and reply cleanup", () => {
    const p = buildPhrasePrompt("стол", "en")
    expect(p.system).toContain("английский")
    expect(p.user).toBe("стол")
    expect(cleanPhraseReply("Перевод: «table»")).toBe("table")
    expect(cleanPhraseReply("table (мебель)\ndesk (письменный)\nboard")).toBe("table (мебель), desk (письменный)")
  })
})
