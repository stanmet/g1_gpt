import {describe, expect, test} from "bun:test"
import {G1_GLYPH_PX} from "../src/background/glyphs"
import {G1_LINE_PX, charPx, fitScreen, paginate, sanitizeForG1, textPx, wrapLines} from "../src/background/g1text"

const LONG_RU =
  "Рим — столица Италии и один из старейших городов Европы. Лучшее время для поездки — апрель, май, сентябрь и октябрь: тепло, но не жарко. " +
  "Обязательно посмотрите Колизей, Римский форум, Пантеон и фонтан Треви. Билеты в Ватиканские музеи покупайте заранее онлайн, иначе очередь может занять два часа. " +
  "Передвигаться удобнее пешком и на метро; такси дороже, чем кажется. Кофе у барной стойки стоит около 1,5 евро."

describe("sanitizeForG1", () => {
  test("strips markdown, links, emoji and keeps Cyrillic incl. ё/й", () => {
    const md = "## Итог\n\n**Важно:** смотрите [сайт](https://example.com/page?x=1) 😀\n\n- первый пункт\n- второй `код`\n\n| A | B |\n|---|---|\n| ёж | йод |"
    const out = sanitizeForG1(md)
    expect(out).toBe("Итог\nВажно: смотрите сайт\n• первый пункт\n• второй код\nA · B\nёж · йод")
  })

  test("bare URLs shrink to domain, № is replaced", () => {
    expect(sanitizeForG1("Подробнее: https://www.gov.uk/visas/apply №5")).toBe("Подробнее: gov.uk №5".replace("№", "No"))
  })

  test("output only contains glyphs the G1 font has", () => {
    const out = sanitizeForG1("Привет 👋 мир ✨ — «цитата» 中文 café ½ €")
    for (const ch of out) if (ch !== "\n") expect(G1_GLYPH_PX[ch]).toBeDefined()
    expect(out).toContain("Привет")
    expect(out).toContain("«цитата»")
    expect(out).not.toContain("中")
  })
})

describe("wrapping and pagination", () => {
  test("Cyrillic width is never under the host's 18 px assumption", () => {
    for (const ch of "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАЁЖЩ") expect(charPx(ch)).toBeGreaterThanOrEqual(18)
    expect(charPx(" ")).toBe(6)
  })

  test("every wrapped line fits the safe width", () => {
    const lines = wrapLines(sanitizeForG1(LONG_RU))
    expect(lines.length).toBeGreaterThan(5)
    for (const l of lines) expect(textPx(l)).toBeLessThanOrEqual(G1_LINE_PX)
  })

  test("pages have at most 5 lines, footer on multi-page, no words lost", () => {
    const clean = sanitizeForG1(LONG_RU)
    const pages = paginate(clean)
    expect(pages.length).toBeGreaterThan(1)
    for (const [i, p] of pages.entries()) {
      const lines = p.split("\n")
      expect(lines.length).toBeLessThanOrEqual(5)
      expect(lines[lines.length - 1]).toStartWith(`${i + 1}/${pages.length} · `)
      for (const l of lines) expect(textPx(l)).toBeLessThanOrEqual(G1_LINE_PX)
    }
    const body = pages.map((p) => p.split("\n").slice(0, -1).join(" ")).join(" ")
    expect(body.replace(/\s+/g, " ")).toBe(clean.replace(/\s+/g, " "))
  })

  test("short answer is one screen without footer", () => {
    const pages = paginate("Столица Австралии — Канберра.")
    expect(pages).toEqual(["Столица Австралии — Канберра."])
  })

  test("very long word is split with hyphen", () => {
    const lines = wrapLines("Превысокомногорассмотрительствующий".repeat(2))
    expect(lines.length).toBeGreaterThan(1)
    for (const l of lines) expect(textPx(l)).toBeLessThanOrEqual(G1_LINE_PX)
  })

  test("fitScreen truncates to 5 lines with ellipsis", () => {
    const s = fitScreen(LONG_RU)
    expect(s.split("\n").length).toBe(5)
    expect(s.endsWith("…")).toBe(true)
  })
})
