import * as React from "react"

import { runCe } from "./command"
import type {
  CeCommand,
  CeCommands,
  CeEvent,
  CeRequest,
  CeState,
} from "./types"

/**
 * The CE page's state and a way to run commands in it. Mount per tab (React key).
 * Only the top frame reports, so there's no frame picking as with BC.
 */
export function useCeTab(tabId: number | undefined) {
  const [state, setState] = React.useState<CeState | null>(null)
  const [connected, setConnected] = React.useState(false)

  const ping = React.useCallback(() => {
    if (tabId === undefined) return
    const request: CeRequest = { type: "ce:ping" }
    chrome.tabs.sendMessage(tabId, request, { frameId: 0 }).catch(() => {})
  }, [tabId])

  React.useEffect(() => {
    if (tabId === undefined) return
    const onMessage = (
      message: CeEvent,
      sender: chrome.runtime.MessageSender
    ) => {
      if (message?.type !== "ce:state" || sender.tab?.id !== tabId) return
      setConnected(true)
      setState(message.state)
    }
    chrome.runtime.onMessage.addListener(onMessage)
    ping()
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [tabId, ping])

  const run = React.useCallback(
    async <C extends CeCommand>(
      command: C,
      ...args: CeCommands[C]["args"] extends void ? [] : [CeCommands[C]["args"]]
    ): Promise<CeCommands[C]["result"]> => {
      if (tabId === undefined) throw new Error("No tab.")
      return runCe(tabId, command, ...args)
    },
    [tabId]
  )

  return { connected, state, refresh: ping, run }
}
