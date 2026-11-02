/**
 * Bluetooth page turners, presenters and keyboards connect to the iPhone as a keyboard.
 * This maps their keys to paging commands. Camera-shutter remotes press "volume up",
 * which iOS never hands to a web page, so they can't be supported here.
 */
/** Maps a remote/keyboard key to a paging command; null while typing in a field. */
export function remoteCommand(e: {key: string; target?: EventTarget | null; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean}): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  const t = e.target as HTMLElement | null
  const tag = t?.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return null
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case " ":
    case "Enter":
    case "MediaTrackNext":
      return tag === "BUTTON" && (e.key === " " || e.key === "Enter") ? null : "next"
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
    case "MediaTrackPrevious":
      return "prev"
    case "Escape":
      return "hide"
    default:
      return null
  }
}
