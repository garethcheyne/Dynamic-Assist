import * as React from "react"

import type { BcEvent, BcFrameState, BcRequest } from "./messages"

type Frames = Map<number, BcFrameState>

/**
 * Collects what each frame of a BC tab reports and returns the current page.
 * Mount it per tab (a React key) so frames from another tab drop out.
 */
export function useBcTab(tabId: number | undefined) {
  const [frames, setFrames] = React.useState<Frames>(new Map())

  React.useEffect(() => {
    if (tabId === undefined) return

    const onMessage = (
      message: BcEvent,
      sender: chrome.runtime.MessageSender
    ) => {
      if (message?.type !== "bc:state" || sender.tab?.id !== tabId) return
      const frameId = sender.frameId ?? 0
      setFrames((prev) => new Map(prev).set(frameId, message.state))
    }
    chrome.runtime.onMessage.addListener(onMessage)

    const ping: BcRequest = { type: "bc:ping" }
    // No content script yet (tab opened before the extension loaded): ignore.
    chrome.tabs.sendMessage(tabId, ping).catch(() => {})

    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [tabId])

  const states = [...frames.values()]
  // The client runs in a ?runinframe=1 iframe; the top frame only has a form
  // model while a designer pane is open, so prefer an inner frame's page.
  const page =
    states.find((s) => s.page && !s.isTop)?.page ??
    states.find((s) => s.page)?.page ??
    null

  const refresh = React.useCallback(() => {
    if (tabId === undefined) return
    const ping: BcRequest = { type: "bc:ping" }
    chrome.tabs.sendMessage(tabId, ping).catch(() => {})
  }, [tabId])

  return { connected: states.length > 0, page, refresh }
}
