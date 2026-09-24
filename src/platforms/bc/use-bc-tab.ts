import * as React from "react"

import type { BcEvent, BcFrameState, BcRequest } from "./messages"

type Frames = Map<number, BcFrameState & { receivedAt: number }>

/**
 * Collects what each frame of a BC tab reports and returns the current page.
 * Mount it per tab and instance (a React key) so other tabs' frames drop out.
 *
 * A reload or company switch gives the client a new frame while the old one's
 * last report stays in the map, so the page comes from whichever frame
 * reported one most recently, not whichever was seen first.
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
      setFrames((prev) =>
        new Map(prev).set(frameId, { ...message.state, receivedAt: Date.now() })
      )
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
  const newest = (list: typeof states) =>
    list.reduce<(typeof states)[number] | null>(
      (best, s) => (!best || s.receivedAt > best.receivedAt ? s : best),
      null
    )
  const page =
    newest(states.filter((s) => s.page && !s.isTop))?.page ??
    newest(states.filter((s) => s.page))?.page ??
    null

  const refresh = React.useCallback(() => {
    if (tabId === undefined) return
    const ping: BcRequest = { type: "bc:ping" }
    chrome.tabs.sendMessage(tabId, ping).catch(() => {})
  }, [tabId])

  return { connected: states.length > 0, page, refresh }
}
