/**
 * A short note at the bottom of a BC or Dynamics 365 page, for the right-click
 * menu, which has no panel to report back in: "Copied accountnumber", "Open a
 * record form first". It can copy text as it shows, from the frame you
 * right-clicked in, since only a focused document may write the clipboard.
 */

/** Service worker → content script: show a note, and copy `copy` if given */
export const PAGE_NOTE = "da:page-note"
export type PageNote = {
  type: typeof PAGE_NOTE
  text: string
  tone?: "ok" | "error"
  copy?: string
}

const NOTE_ID = "dynamic-assist-note"
const SHOW_MS = 2600

let timer: number | undefined

function show(text: string, tone: "ok" | "error") {
  document.getElementById(NOTE_ID)?.remove()
  window.clearTimeout(timer)
  const note = document.createElement("div")
  note.id = NOTE_ID
  note.setAttribute("role", "status")
  note.textContent = text
  note.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:24px",
    "transform:translateX(-50%)",
    "z-index:2147483647",
    "max-width:min(560px,calc(100vw - 32px))",
    "padding:8px 14px",
    "border-radius:8px",
    "font:500 13px/18px 'Segoe UI',system-ui,sans-serif",
    "color:#fff",
    `background:${tone === "error" ? "#a4262c" : "#242424"}`,
    "box-shadow:0 4px 16px rgba(0,0,0,.25)",
    "pointer-events:none",
    "overflow-wrap:anywhere",
  ].join(";")
  document.body.appendChild(note)
  timer = window.setTimeout(() => note.remove(), SHOW_MS)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Not focused (or no clipboard API): the old way, from a hidden textarea
    const area = document.createElement("textarea")
    area.value = text
    area.style.cssText = "position:fixed;opacity:0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  }
}

/** Answers the worker's notes in this frame; answered with { shown: true }. */
export function listenForPageNotes() {
  chrome.runtime.onMessage.addListener(
    (message: PageNote, _sender, respond) => {
      if (message?.type !== PAGE_NOTE) return false
      void (async () => {
        if (message.copy !== undefined && !(await copyText(message.copy)))
          show(`Couldn't copy: click the page, then try again`, "error")
        else show(message.text, message.tone ?? "ok")
        respond({ shown: true })
      })()
      return true
    }
  )
}
