import * as React from "react"

import { followWindow, isPopout } from "./popout"

/**
 * The active tab the panel works on, updated as the user switches tabs or
 * navigates. In the side panel, that's the active tab in the panel's own
 * window; popped out (popout.ts), it's the active tab in the browser window
 * used last, so the panel keeps following your work from its own window.
 * `url` is only set for sites in host_permissions.
 */
export function useActiveTab() {
  const [tab, setTab] = React.useState<chrome.tabs.Tab | null>(null)

  React.useEffect(() => {
    let windowId: number | undefined

    const refresh = async () => {
      let active: chrome.tabs.Tab | undefined
      if (isPopout) {
        const browser = await chrome.windows
          .getLastFocused({ windowTypes: ["normal"] })
          .catch(() => null)
        if (browser?.id !== undefined)
          [active] = await chrome.tabs.query({
            active: true,
            windowId: browser.id,
          })
      } else {
        ;[active] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
      }
      windowId = active?.windowId
      if (isPopout) followWindow(windowId)
      setTab(active ?? null)
    }

    const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
      if (isPopout || windowId === undefined || info.windowId === windowId)
        void refresh()
    }
    const onUpdated = (
      _tabId: number,
      change: chrome.tabs.OnUpdatedInfo,
      updated: chrome.tabs.Tab
    ) => {
      if (updated.active && updated.windowId === windowId) {
        if (change.url || change.status) setTab(updated)
      }
    }
    // Popped out: moving to another browser window changes the tab to follow.
    // Focus on the pop-out itself (or nowhere) keeps the tab it had.
    const onFocusChanged = (focused: number) => {
      if (focused === chrome.windows.WINDOW_ID_NONE) return
      void chrome.windows
        .get(focused)
        .then((w) => {
          if (w.type === "normal") void refresh()
        })
        .catch(() => undefined)
    }

    void refresh()
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    if (isPopout) chrome.windows.onFocusChanged.addListener(onFocusChanged)
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      if (isPopout) chrome.windows.onFocusChanged.removeListener(onFocusChanged)
    }
  }, [])

  return tab
}
