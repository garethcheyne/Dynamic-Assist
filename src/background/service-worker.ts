import {
  applyHistoryOp,
  HISTORY_MESSAGE,
  recordVisit,
  visitFromUrl,
  type HistoryOp,
} from "@/lib/history"
import {
  BRIDGE_READY,
  CHANNEL_TABS_KEY,
  type BcBridgeReady,
} from "@/platforms/bc/messages"
import { takePendingQuery } from "@/platforms/bc/query/pending"
import { openQueryBuilder } from "@/query-builder/open"

// Open the side panel when the toolbar icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error))

// Page-world scripts (built by vite.config.ts into public/scripts/). They're
// registered here rather than in manifest.json because @crxjs's content script
// loader doesn't work in the page's world. Tabs open before install need a reload.
const MAIN_WORLD_SCRIPTS: chrome.scripting.RegisteredContentScript[] = [
  {
    id: "bc-main-world",
    js: ["scripts/bc-main-world.js"],
    matches: ["https://businesscentral.dynamics.com/*"],
    world: "MAIN",
    allFrames: true,
    runAt: "document_idle",
    persistAcrossSessions: true,
  },
  {
    // Model-driven apps: top frame only, where Xrm lives
    id: "ce-main-world",
    js: ["scripts/ce-main-world.js"],
    matches: ["https://*.dynamics.com/*"],
    excludeMatches: ["https://businesscentral.dynamics.com/*"],
    world: "MAIN",
    allFrames: false,
    runAt: "document_idle",
    persistAcrossSessions: true,
  },
]

async function registerMainWorldScripts() {
  const ids = MAIN_WORLD_SCRIPTS.map((s) => s.id)
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids })
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids })
  await chrome.scripting.registerContentScripts(MAIN_WORLD_SCRIPTS)
}

chrome.runtime.onInstalled.addListener(() => {
  registerMainWorldScripts().catch((error) => console.error(error))
})

// History: every BC environment / CE org you open, recorded from the tab's URL
// (host permissions let us see those URLs). The panel adds friendly names.
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if (change.status !== "complete" || !tab.url) return
  const visit = visitFromUrl(tab.url)
  if (visit) void recordVisit(visit)
})

// The panel's History changes (names, pins, renames) come here, so the worker
// is History's only writer.
chrome.runtime.onMessage.addListener(
  (message: { type?: string; op?: HistoryOp }) => {
    if (message?.type === HISTORY_MESSAGE && message.op) {
      void applyHistoryOp(message.op)
    }
    return false
  }
)

// The companion app's query page loaded in a BC tab: open the query builder
// over it (the page itself only hosts the bridge).
chrome.runtime.onMessage.addListener((message: BcBridgeReady, sender) => {
  if (message?.type === BRIDGE_READY && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id
    chrome.storage.session
      .get(CHANNEL_TABS_KEY)
      .then(async (stored) => {
        // A query page the panel opened in the background to reach the
        // companion (coupled records): no builder over it
        const channels =
          (stored[CHANNEL_TABS_KEY] as number[] | undefined) ?? []
        if (channels.includes(tabId)) return
        // A query asked for from another page (All fields, Query this table…)
        const pending = await takePendingQuery()
        await openQueryBuilder(tabId, pending ?? { app: "bc" }, message.dark)
      })
      .catch((error) => console.warn("Couldn't open the query builder", error))
  }
  return false
})

// Impersonation rules are per tab (platforms/ce/impersonation.ts); drop a
// closed tab's rule so its ID can't carry over to a tab that reuses it.
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [tabId] })
    .catch(() => {})
  void chrome.storage.session.remove(`impersonation:${tabId}`)
})
