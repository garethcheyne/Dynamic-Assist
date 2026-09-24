import {
  CE_COMMAND,
  CE_RESULT,
  CE_STATE,
  CE_STATE_REQUEST,
  type CeCommandResponse,
  type CeEvent,
  type CeRequest,
  type CeResultMessage,
  type CeState,
} from "./types"

// Runs in the top frame of Dynamics 365 pages, in the extension's isolated
// world. Relays between the side panel and main-world.ts, which has Xrm.

let state: CeState | null = null

function report() {
  const event: CeEvent = { type: "ce:state", state }
  chrome.runtime.sendMessage(event).catch(() => {})
}

let nextId = 1
/**
 * Long enough for the slowest command (loading all tables' metadata on a big
 * org). If the page script never answers (not injected: the tab predates the
 * install), the panel gets an error instead of waiting forever.
 */
const COMMAND_TIMEOUT_MS = 45_000
const pending = new Map<number, (r: CeCommandResponse) => void>()

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data?.type === CE_STATE) {
    state = event.data.state ?? null
    report()
  } else if (event.data?.type === CE_RESULT) {
    const m = event.data as CeResultMessage
    pending.get(m.id)?.({ ok: m.ok, result: m.result, error: m.error })
    pending.delete(m.id)
  }
})

chrome.runtime.onMessage.addListener(
  (message: CeRequest, _sender, sendResponse) => {
    if (message.type === "ce:ping") {
      report()
      window.postMessage({ type: CE_STATE_REQUEST }, location.origin)
      return false
    }
    if (message.type === "ce:command") {
      const id = nextId++
      const timer = window.setTimeout(() => {
        pending.delete(id)
        sendResponse({
          ok: false,
          error: "The page didn't answer. Reload the tab and try again.",
        })
      }, COMMAND_TIMEOUT_MS)
      pending.set(id, (response) => {
        window.clearTimeout(timer)
        sendResponse(response)
      })
      window.postMessage(
        { type: CE_COMMAND, id, command: message.command, args: message.args },
        location.origin
      )
      return true
    }
    return false
  }
)

window.postMessage({ type: CE_STATE_REQUEST }, location.origin)
