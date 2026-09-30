import * as React from "react"

import {
  PANEL_INTENT_FRESH_MS,
  PANEL_INTENT_KEY,
  type PanelIntent,
} from "./panel-intent"

/** The latest intent for this tab, or null. */
export function usePanelIntent(tabId: number | undefined) {
  const [intent, setIntent] = React.useState<PanelIntent | null>(null)
  React.useEffect(() => {
    if (tabId === undefined) return
    const take = (value: unknown) => {
      const i = value as PanelIntent | undefined
      if (i?.tabId === tabId && Date.now() - i.seq < PANEL_INTENT_FRESH_MS)
        setIntent(i)
    }
    void chrome.storage.session
      .get(PANEL_INTENT_KEY)
      .then((items) => take(items[PANEL_INTENT_KEY]))
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "session" && PANEL_INTENT_KEY in changes)
        take(changes[PANEL_INTENT_KEY].newValue)
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [tabId])
  return intent
}
