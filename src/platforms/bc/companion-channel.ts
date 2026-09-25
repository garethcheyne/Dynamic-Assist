/**
 * The companion app from the side panel. Its bridge only lives on its query
 * page (77500), so requests go to a tab showing that page in the same
 * environment and company; with none open, one opens in the background (and
 * stays, for next time). Everything runs as you, read-only, like the builder.
 */
import type { CompanionCall } from "./coupling"
import {
  CHANNEL_TABS_KEY,
  COMPANION_REQUEST,
  type BcCompanionRequest,
  type CompanionAnswer,
} from "./messages"
import { BRIDGE_PAGE_ID } from "./query/bridge"
import { buildBcUrl, parseBcUrl, type BcContext } from "./url"

/** How long a freshly opened query page gets to load BC and the bridge */
const OPEN_WAIT_MS = 90_000

const same = (a: string | null, b: string | null) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase()

/** A tab on the query page for this environment and company. */
async function findChannel(ctx: BcContext) {
  const tabs = await chrome.tabs.query({
    url: "https://businesscentral.dynamics.com/*",
  })
  return tabs.find((t) => {
    if (!t.url || t.id === undefined) return false
    const c = parseBcUrl(t.url)
    return (
      c.page === BRIDGE_PAGE_ID &&
      same(c.environment, ctx.environment) &&
      same(c.company, ctx.company) &&
      (!c.tenant || !ctx.tenant || same(c.tenant, ctx.tenant))
    )
  })
}

async function openChannel(ctx: BcContext) {
  const tab = await chrome.tabs.create({
    url: buildBcUrl(ctx, { page: BRIDGE_PAGE_ID }),
    active: false,
  })
  // So the service worker doesn't open the query builder over it
  const stored = await chrome.storage.session.get(CHANNEL_TABS_KEY)
  const ids = (stored[CHANNEL_TABS_KEY] as number[] | undefined) ?? []
  await chrome.storage.session.set({ [CHANNEL_TABS_KEY]: [...ids, tab.id] })
  return tab
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * A caller for the companion in this environment and company. `onOpening`
 * says when it had to open the query page (the first call then takes a while).
 */
export async function companionFor(
  ctx: BcContext,
  onOpening?: () => void
): Promise<CompanionCall> {
  let tab = await findChannel(ctx)
  // When the page we talk to was (re)loaded: it gets OPEN_WAIT_MS to answer
  let loadedAt = 0
  if (!tab) {
    onOpening?.()
    tab = await openChannel(ctx)
    loadedAt = Date.now()
  }
  let tabId = tab.id!

  /**
   * The query page to talk to: this one while it's open and still on the
   * query page; else another that is, or a new one in the background (the
   * user may have closed it, or gone elsewhere in it).
   */
  const ensureChannel = async () => {
    const current = await chrome.tabs.get(tabId).catch(() => null)
    const url = current?.pendingUrl || current?.url
    if (url && parseBcUrl(url).page === BRIDGE_PAGE_ID) return
    onOpening?.()
    const next = (await findChannel(ctx)) ?? (await openChannel(ctx))
    tabId = next.id!
    loadedAt = Date.now()
  }

  return async <T>(method: string, params?: object) => {
    const request: BcCompanionRequest = {
      type: COMPANION_REQUEST,
      method,
      params,
    }
    // A query page opened before the extension was updated or reloaded has no
    // content script to answer; reloading it once brings the bridge back
    let reloaded = false
    const started = Date.now()
    for (;;) {
      await ensureChannel()
      // A few seconds for a page that's up; longer for one still loading
      const deadline = Math.max(started + 5000, loadedAt + OPEN_WAIT_MS)
      const answer = (await chrome.tabs
        .sendMessage(tabId, request, { frameId: 0 })
        .catch(() => null)) as CompanionAnswer | null
      if (answer?.ready) {
        if (answer.ok) return answer.result as T
        throw new Error(answer.error)
      }
      // Still loading, or no companion on that page
      if (Date.now() > deadline && !reloaded) {
        reloaded = true
        onOpening?.()
        await chrome.tabs.reload(tabId).catch(() => undefined)
        loadedAt = Date.now()
        continue
      }
      if (Date.now() > deadline && reloaded)
        throw new Error(
          "Couldn't reach the Dynamic Assist Companion. Is it installed in this environment, and can you open its Dynamic Assist Query page (77500)?"
        )
      await wait(1000)
    }
  }
}
