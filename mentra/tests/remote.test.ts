import {expect, test} from "bun:test"
import {remoteCommand} from "../src/ui/remote"

const el = (tagName: string, extra: Record<string, unknown> = {}) => ({tagName, ...extra}) as unknown as EventTarget

test("page turner and presenter keys page the answer", () => {
  for (const key of ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "MediaTrackNext"])
    expect(remoteCommand({key, target: el("BODY")})).toBe("next")
  for (const key of ["ArrowLeft", "ArrowUp", "PageUp", "MediaTrackPrevious"]) expect(remoteCommand({key, target: el("BODY")})).toBe("prev")
  expect(remoteCommand({key: "Escape", target: el("BODY")})).toBe("hide")
  expect(remoteCommand({key: "a", target: el("BODY")})).toBeNull()
})

test("typing in a field or pressing a focused button is left alone", () => {
  expect(remoteCommand({key: "ArrowRight", target: el("TEXTAREA")})).toBeNull()
  expect(remoteCommand({key: " ", target: el("INPUT")})).toBeNull()
  expect(remoteCommand({key: "Enter", target: el("BUTTON")})).toBeNull()
  expect(remoteCommand({key: "ArrowRight", target: el("BUTTON")})).toBe("next")
  expect(remoteCommand({key: "ArrowRight", target: el("DIV", {isContentEditable: true})})).toBeNull()
  expect(remoteCommand({key: "ArrowRight", target: el("BODY"), metaKey: true})).toBeNull()
})
