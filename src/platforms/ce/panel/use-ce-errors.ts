import * as React from "react"

import { useStorage } from "@/lib/use-storage"

import {
  ERROR_WATCH_KEY,
  ERROR_WATCH_SCRIPT,
  type CeLogEntry,
} from "../error-log"
import type { useCeTab } from "../use-ce-tab"

const POLL_MS = 1500
const KEEP = 500

type Run = ReturnType<typeof useCeTab>["run"]

/**
 * The page's error log (error-watch.ts), kept up to date while the panel is
 * open: new entries every POLL_MS, repeats merged by id, and a fresh start
 * when the page reloads.
 */
export function useCeErrors(run: Run, tabId: number | undefined) {
  const [watching, setWatching] = useStorage(ERROR_WATCH_KEY, false)
  const [entries, setEntries] = React.useState<CeLogEntry[]>([])
  const [consoleOn, setConsoleOn] = React.useState(false)
  const since = React.useRef(0)
  const session = React.useRef<string | null>(null)

  // The panel is mounted per tab, so each tab starts with an empty list
  React.useEffect(() => {
    if (!watching) return
    since.current = 0
    session.current = null
    let stopped = false
    let busy = false
    const poll = async () => {
      if (busy || stopped) return
      busy = true
      try {
        const slice = await run("errors", { since: since.current })
        if (stopped) return
        setConsoleOn(slice.console)
        if (session.current !== slice.session) {
          // A new page load: start over from its first entry
          const fresh = session.current !== null && since.current > 0
          session.current = slice.session
          since.current = 0
          setEntries([])
          if (fresh) return
        }
        if (!slice.entries.length) return
        since.current = Math.max(...slice.entries.map((e) => e.seq))
        setEntries((old) => {
          const byId = new Map(old.map((e) => [e.id, e]))
          for (const e of slice.entries) byId.set(e.id, e)
          return [...byId.values()].sort((a, b) => a.seq - b.seq).slice(-KEEP)
        })
      } catch {
        // The page isn't reachable yet (loading, or needs a reload)
      } finally {
        busy = false
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [run, tabId, watching])

  const clear = React.useCallback(async () => {
    setEntries([])
    await run("clearErrors").catch(() => {})
  }, [run])

  const watchConsole = React.useCallback(
    async (on: boolean) => {
      setConsoleOn(on)
      await run("errorsConsole", { on }).catch(() => setConsoleOn(!on))
    },
    [run]
  )

  /**
   * On: every Dynamics 365 page from its start (the service worker registers
   * the watcher), and this page from now. Off: gone from both at once.
   */
  const watch = React.useCallback(
    async (on: boolean) => {
      setWatching(on)
      if (!on) setEntries([])
      if (tabId === undefined) return
      await chrome.scripting
        .executeScript(
          on
            ? {
                target: { tabId, allFrames: true },
                world: "MAIN",
                files: [ERROR_WATCH_SCRIPT],
              }
            : {
                target: { tabId, allFrames: true },
                world: "MAIN",
                func: () =>
                  (
                    window as Window & { __dynamicAssistUnwatch?: () => void }
                  ).__dynamicAssistUnwatch?.(),
              }
        )
        .catch(() => {})
    },
    [setWatching, tabId]
  )

  return {
    entries: watching ? entries : [],
    clear,
    consoleOn,
    watchConsole,
    watching,
    watch,
  }
}
