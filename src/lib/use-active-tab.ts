import * as React from "react"

/**
 * The active tab in the side panel's window, updated as the user switches tabs
 * or navigates. `url` is only set for sites in host_permissions.
 */
export function useActiveTab() {
  const [tab, setTab] = React.useState<chrome.tabs.Tab | null>(null)

  React.useEffect(() => {
    let windowId: number | undefined

    const refresh = async () => {
      const [active] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      windowId = active?.windowId
      setTab(active ?? null)
    }

    const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
      if (windowId === undefined || info.windowId === windowId) void refresh()
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

    void refresh()
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [])

  return tab
}
