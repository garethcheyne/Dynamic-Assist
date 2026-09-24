import type { BcEvent, BcFrameState, BcRequest } from "./messages"
import { PAGE_MESSAGE, REQUEST_MESSAGE, type BcPageInfo } from "./page-info"

// Runs in every businesscentral.dynamics.com frame, in the extension's isolated
// world. main-world.ts (same frame, page world) reads BC's form model and posts
// it here; this forwards it to the side panel, which picks the frame with a page.

let page: BcPageInfo | null = null

function report() {
  const state: BcFrameState = {
    url: location.href,
    isTop: window === window.top,
    page,
  }
  const event: BcEvent = { type: "bc:state", state }
  // Fails when the side panel is closed; it asks again when it opens.
  chrome.runtime.sendMessage(event).catch(() => {})
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== PAGE_MESSAGE) return
  page = event.data.page ?? null
  report()
})

chrome.runtime.onMessage.addListener((message: BcRequest) => {
  if (message.type === "bc:ping") {
    report()
    window.postMessage({ type: REQUEST_MESSAGE }, location.origin)
  }
  return false
})

window.postMessage({ type: REQUEST_MESSAGE }, location.origin)
