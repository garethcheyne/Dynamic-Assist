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
      pending.set(id, sendResponse)
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
