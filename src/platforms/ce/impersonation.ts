/**
 * Impersonation for Dynamics 365, as Level Up did it: every Web API call the
 * tab makes to its org carries MSCRMCallerID, so the app runs as that user.
 * Dataverse only honours it when the signed-in user holds "Act on Behalf of
 * Another User" (prvActOnBehalfOfAnotherUser); otherwise calls fail with 403.
 *
 * The header is added by a declarativeNetRequest session rule scoped to the one
 * tab and the org's host, so nothing else is affected, and it's gone when the
 * browser restarts. The service worker removes it when the tab closes.
 */
import * as React from "react"

import type { CeUserSummary } from "./types"

export type Impersonation = { user: CeUserSummary; host: string }

const storageKey = (tabId: number) => `impersonation:${tabId}`

// One rule per tab; tab IDs are positive integers, as rule IDs must be
const ruleId = (tabId: number) => tabId

export async function startImpersonation(
  tabId: number,
  host: string,
  user: CeUserSummary
) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId(tabId)],
    addRules: [
      {
        id: ruleId(tabId),
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: "MSCRMCallerID",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: user.id,
            },
          ],
        },
        condition: {
          tabIds: [tabId],
          requestDomains: [host],
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          ],
        },
      },
    ],
  })
  const value: Impersonation = { user, host }
  await chrome.storage.session.set({ [storageKey(tabId)]: value })
  await chrome.tabs.reload(tabId)
}

export async function stopImpersonation(tabId: number, reload = true) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId(tabId)],
  })
  await chrome.storage.session.remove(storageKey(tabId))
  if (reload) await chrome.tabs.reload(tabId)
}

/** Who the tab is impersonating, if anyone, kept up to date. */
export function useImpersonation(tabId: number | undefined, host: string) {
  const [value, setValue] = React.useState<Impersonation | null>(null)

  React.useEffect(() => {
    if (tabId === undefined) return
    const key = storageKey(tabId)
    void chrome.storage.session.get(key).then((items) => {
      setValue((items[key] as Impersonation | undefined) ?? null)
    })
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "session" && key in changes) {
        setValue((changes[key].newValue as Impersonation | undefined) ?? null)
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [tabId])

  // A rule for another org (the tab moved on) doesn't apply here
  return value && value.host === host ? value : null
}
