/**
 * Opening the query builder from any Business Central page. It needs the
 * companion's query page (its bridge lives there), so from another page the
 * query waits in session storage while that page opens in a new tab; the
 * service worker hands it over when the page announces itself.
 */
import { openQueryBuilder } from "@/query-builder/open"

import { buildBcUrl, parseBcUrl } from "../url"
import type { BcOpenRequest } from "./BcQueryApp"
import { BRIDGE_PAGE_ID } from "./bridge"

const PENDING_KEY = "bc:pendingQuery"
/** A query waits this long for its page to open */
const MAX_AGE_MS = 2 * 60 * 1000

/** Opens the builder with this query: here on the query page, else in a new tab. */
export async function openBcQuery(
  tab: chrome.tabs.Tab,
  request: BcOpenRequest
) {
  const ctx = parseBcUrl(tab.url!)
  if (ctx.page === BRIDGE_PAGE_ID) {
    await openQueryBuilder(tab.id!, request)
    return "Opened in the query builder"
  }
  await chrome.storage.session.set({
    [PENDING_KEY]: { request, at: Date.now() },
  })
  await chrome.tabs.create({ url: buildBcUrl(ctx, { page: BRIDGE_PAGE_ID }) })
  return "Opening the query builder in a new tab"
}

/** The query waiting for the page that just opened, if any (once). */
export async function takePendingQuery(): Promise<BcOpenRequest | null> {
  const items = await chrome.storage.session.get(PENDING_KEY)
  const pending = items[PENDING_KEY] as
    { request: BcOpenRequest; at: number } | undefined
  if (!pending) return null
  await chrome.storage.session.remove(PENDING_KEY)
  return Date.now() - pending.at < MAX_AGE_MS ? pending.request : null
}
