/**
 * The query builder's first run in a Business Central company. The companion
 * only answers on its query page (77500); with none open, the builder asks
 * for it to load in the same tab, where you can see Business Central start,
 * instead of in a hidden background tab. The worker remembers the builder's
 * request, loads the page, and opens the builder over it as soon as the tab
 * has loaded, so its steps show while the companion starts.
 */
import { hasChannel } from "@/platforms/bc/companion-channel"
import {
  CHANNEL_STATUS,
  SETUP_REQUEST,
  SETUP_TABS_KEY,
  type BcChannelStatus,
  type BcSetupRequest,
  type BcSetupTab,
} from "@/platforms/bc/messages"
import { BRIDGE_PAGE_ID } from "@/platforms/bc/query/bridge"
import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"
import { openQueryBuilder } from "@/query-builder/open"

const BC_ORIGIN = "https://businesscentral.dynamics.com/"

/** A setup older than this is abandoned (the page never loaded, or you left) */
const SETUP_MAX_MS = 10 * 60 * 1000

type Setups = Record<string, BcSetupTab>

// One change at a time: the tab's load and the bridge's hello can race
let queue: Promise<unknown> = Promise.resolve()
function change<T>(work: (setups: Setups) => T | Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const stored = await chrome.storage.session.get(SETUP_TABS_KEY)
    const setups = { ...((stored[SETUP_TABS_KEY] as Setups | undefined) ?? {}) }
    for (const [id, s] of Object.entries(setups))
      if (Date.now() - s.at > SETUP_MAX_MS) delete setups[id]
    const result = await work(setups)
    await chrome.storage.session.set({ [SETUP_TABS_KEY]: setups })
    return result
  })
  queue = next.catch(() => undefined)
  return next
}

/**
 * Opens the builder over the query page being set up in this tab, once.
 * True when the tab is being set up (whether or not it opened just now).
 */
export function openSetupBuilder(tabId: number, done = false) {
  return change(async (setups) => {
    const setup = setups[tabId]
    if (!setup) return false
    if (!setup.opened) {
      setup.opened = true
      await openQueryBuilder(
        tabId,
        {
          ...setup.request,
          setup: { returnUrl: setup.returnUrl, startedAt: setup.at },
        },
        setup.dark
      ).catch((error) => console.warn("Couldn't open the query builder", error))
    }
    // The companion has answered: the setup is over
    if (done) delete setups[tabId]
    return true
  })
}

export function listenForBcSetup() {
  chrome.runtime.onMessage.addListener(
    (message: BcChannelStatus | BcSetupRequest, sender, respond) => {
      if (message?.type === CHANNEL_STATUS) {
        hasChannel(parseBcUrl(message.url)).then(
          (open) => respond({ open }),
          () => respond({ open: false })
        )
        return true
      }
      if (message?.type === SETUP_REQUEST) {
        const tab = sender.tab
        if (tab?.id === undefined || !tab.url) return false
        const tabId = tab.id
        const returnUrl = tab.url
        void change((setups) => {
          setups[tabId] = {
            request: message.request,
            returnUrl,
            dark: message.dark,
            at: Date.now(),
          }
        })
          .then(() =>
            chrome.tabs.update(tabId, {
              url: buildBcUrl(parseBcUrl(returnUrl), { page: BRIDGE_PAGE_ID }),
            })
          )
          .then(
            () => respond({ ok: true }),
            (error: unknown) =>
              respond({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              })
          )
        return true
      }
      return false
    }
  )

  // The query page has loaded in a tab being set up: open the builder at once,
  // before the companion is ready, so its steps show while BC starts
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== "complete" || !tab.url?.startsWith(BC_ORIGIN)) return
    if (parseBcUrl(tab.url).page !== BRIDGE_PAGE_ID) return
    void openSetupBuilder(tabId)
  })

  chrome.tabs.onRemoved.addListener((tabId) => {
    void change((setups) => {
      delete setups[tabId]
    })
  })
}
