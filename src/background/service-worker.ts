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
  COMPANION_RELAY,
  type BcCompanionRelay,
  type BcBridgeReady,
} from "@/platforms/bc/messages"
import { companionFor } from "@/platforms/bc/companion-channel"
import type { CompanionCall } from "@/platforms/bc/coupling"
import { parseBcUrl } from "@/platforms/bc/url"
import { openQueryBuilder } from "@/query-builder/open"
import { ERROR_WATCH_KEY, ERROR_WATCH_SCRIPT } from "@/platforms/ce/error-log"

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
  {
    // The Errors tab's log, only while it's switched on: from the start of
    // the page, in every frame (web resources too), before the page's scripts
    id: "ce-error-watch",
    js: [ERROR_WATCH_SCRIPT],
    matches: ["https://*.dynamics.com/*"],
    excludeMatches: ["https://businesscentral.dynamics.com/*"],
    world: "MAIN",
    allFrames: true,
    runAt: "document_start",
    persistAcrossSessions: true,
  },
]

/**
 * Makes the registrations match MAIN_WORLD_SCRIPTS: adds missing ones, updates
 * the rest, and drops the error watcher unless it's switched on. Run on every
 * worker start, not only on install, so a script added in an update (or a
 * registration Chrome dropped) is always in place.
 */
async function registerMainWorldScripts() {
  const watching =
    (await chrome.storage.local.get(ERROR_WATCH_KEY))[ERROR_WATCH_KEY] === true
  const wanted = MAIN_WORLD_SCRIPTS.filter(
    (s) => watching || !s.js?.includes(ERROR_WATCH_SCRIPT)
  )
  const all = MAIN_WORLD_SCRIPTS.map((s) => s.id)
  const existing = new Set(
    (await chrome.scripting.getRegisteredContentScripts({ ids: all })).map(
      (s) => s.id
    )
  )
  const unwanted = all.filter(
    (id) => existing.has(id) && !wanted.some((s) => s.id === id)
  )
  if (unwanted.length)
    await chrome.scripting.unregisterContentScripts({ ids: unwanted })
  const missing = wanted.filter((s) => !existing.has(s.id))
  const present = wanted.filter((s) => existing.has(s.id))
  if (missing.length) await chrome.scripting.registerContentScripts(missing)
  if (present.length) await chrome.scripting.updateContentScripts(present)
}

registerMainWorldScripts().catch((error) => console.error(error))
// The Errors tab's switch
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && ERROR_WATCH_KEY in changes)
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
        await openQueryBuilder(tabId, { app: "bc" }, message.dark)
      })
      .catch((error) => console.warn("Couldn't open the query builder", error))
  }
  return false
})

// The query builder on any BC page reaches the companion through the query
// page of the same environment and company, found or opened in the
// background (companion-channel.ts). One caller per company while the worker
// lives; a failed one is dropped so the next request tries again.
const relays = new Map<string, Promise<CompanionCall>>()
chrome.runtime.onMessage.addListener(
  (message: BcCompanionRelay, _sender, respond) => {
    if (message?.type !== COMPANION_RELAY) return false
    const ctx = parseBcUrl(message.url)
    const key = [ctx.tenant, ctx.environment, ctx.company]
      .join("/")
      .toLowerCase()
    let caller = relays.get(key)
    if (!caller) {
      caller = companionFor(ctx)
      relays.set(key, caller)
    }
    caller
      .then((call) => call(message.method, message.params))
      .then((result) => respond({ ok: true, result }))
      .catch((error: unknown) => {
        relays.delete(key)
        respond({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    return true
  }
)

// Impersonation rules are per tab (platforms/ce/impersonation.ts); drop a
// closed tab's rule so its ID can't carry over to a tab that reuses it.
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [tabId] })
    .catch(() => {})
  void chrome.storage.session.remove(`impersonation:${tabId}`)
})
