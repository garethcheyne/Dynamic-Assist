import { recordVisit, visitFromUrl } from "@/lib/history"

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
