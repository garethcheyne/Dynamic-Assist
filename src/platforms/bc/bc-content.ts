import { BRIDGE_TAG, BridgeClient } from "./query/bridge"
import {
  BRIDGE_READY,
  COMPANION_REQUEST,
  type BcCompanionRequest,
  type CompanionAnswer,
  type BcBridgeReady,
  type BcEvent,
  type BcFrameState,
  type BcRequest,
  type BcToolRequest,
  TOOL_REQUEST,
} from "./messages"
import {
  PAGE_MESSAGE,
  REQUEST_MESSAGE,
  TOOL_MESSAGE,
  TOOL_RESULT_MESSAGE,
  type BcPageInfo,
} from "./page-info"

// Runs in every businesscentral.dynamics.com frame, in the extension's isolated
// world. main-world.ts (same frame, page world) reads BC's form model and posts
// it here; this forwards it to the side panel, which picks the frame with a page.

let page: BcPageInfo | null = null
let unsupported = false

function report() {
  const state: BcFrameState = {
    url: location.href,
    isTop: window === window.top,
    page,
    unsupported,
  }
  const event: BcEvent = { type: "bc:state", state }
  // Fails when the side panel is closed; it asks again when it opens.
  chrome.runtime.sendMessage(event).catch(() => {})
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== PAGE_MESSAGE) return
  page = event.data.page ?? null
  unsupported = event.data.unsupported === true
  report()
})

// The companion app's query page announces itself to the top frame when it
// loads (bc-companion/src/bridge/bridge.js): open the query builder over it.
if (window === window.top) {
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.data?.tag !== BRIDGE_TAG ||
      event.data?.type !== "hello" ||
      !event.data?.announce
    )
      return
    const ready: BcBridgeReady = {
      type: BRIDGE_READY,
      dark: matchMedia("(prefers-color-scheme: dark)").matches,
    }
    chrome.runtime.sendMessage(ready).catch(() => {})
  })
}

// The companion, for the panel (coupled records): the top frame of a tab on
// the query page passes requests to its bridge, as the query builder does
if (window === window.top) {
  let bridge: BridgeClient | null = null
  chrome.runtime.onMessage.addListener(
    (message: BcCompanionRequest, _sender, respond) => {
      if (message?.type !== COMPANION_REQUEST) return false
      const answer = (a: CompanionAnswer) => respond(a)
      void (async () => {
        bridge ??= new BridgeClient()
        if (!(await bridge.connect(3000))) return answer({ ready: false })
        try {
          const result = await bridge.request(message.method, message.params)
          answer({ ready: true, ok: true, result })
        } catch (error) {
          answer({
            ready: true,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })()
      return true
    }
  )
}

// Page tools: only the frame running the web client (it has a page) answers
chrome.runtime.onMessage.addListener(
  (message: BcToolRequest, _sender, respond) => {
    if (message?.type !== TOOL_REQUEST || !page) return false
    const id = Math.random().toString(36).slice(2)
    const onResult = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.data?.type !== TOOL_RESULT_MESSAGE ||
        event.data.id !== id
      )
        return
      window.removeEventListener("message", onResult)
      respond({ message: event.data.message })
    }
    window.addEventListener("message", onResult)
    window.postMessage(
      {
        type: TOOL_MESSAGE,
        id,
        command: message.command,
        on: message.on,
        data: message.data,
      },
      location.origin
    )
    return true
  }
)

chrome.runtime.onMessage.addListener((message: BcRequest) => {
  if (message.type === "bc:ping") {
    report()
    window.postMessage({ type: REQUEST_MESSAGE }, location.origin)
  }
  return false
})

window.postMessage({ type: REQUEST_MESSAGE }, location.origin)
