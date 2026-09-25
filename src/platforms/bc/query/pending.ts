/**
 * Opening the query builder from any Business Central page: over that page.
 * On the companion's query page it talks to the bridge there; anywhere else
 * it relays through a query page opened in the background (bridge.ts).
 */
import { openQueryBuilder } from "@/query-builder/open"

import type { BcOpenRequest } from "./BcQueryApp"

export async function openBcQuery(
  tab: chrome.tabs.Tab,
  request: BcOpenRequest
) {
  await openQueryBuilder(tab.id!, request)
  return "Opened in the query builder"
}
