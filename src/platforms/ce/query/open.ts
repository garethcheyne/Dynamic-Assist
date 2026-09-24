/** Opens the query builder in a Dynamics 365 tab, from the side panel. */
import queryScript from "./inject.tsx?script&iife"
// Built by the main build, where Tailwind processes it; the injected bundle
// can't process CSS itself, so it links this file into its shadow root
import queryCss from "./query.css?url"
import { QUERY_OPEN, type QueryOpenMessage } from "./messages"
import type { OpenRequest } from "./ui/QueryApp"

export async function openQueryBuilder(tabId: number, request: OpenRequest) {
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    files: [queryScript],
  })
  const message: QueryOpenMessage = {
    type: QUERY_OPEN,
    request,
    dark: document.documentElement.classList.contains("dark"),
    cssUrl: chrome.runtime.getURL(queryCss.replace(/^\//, "")),
  }
  // The script registers its listener as it runs; allow a moment on a busy page
  for (let attempt = 0; ; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message, { frameId: 0 })
      return
    } catch (error) {
      if (attempt >= 30) throw error
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}
