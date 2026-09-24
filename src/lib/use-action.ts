import * as React from "react"

import { useNotify } from "@/lib/copy"

/**
 * Runs one action at a time with a busy key for its tile, and reports how it
 * went as a toast: the returned text on success, the error message on failure.
 */
export function useAction() {
  const notify = useNotify()
  const [busy, setBusy] = React.useState<string | null>(null)

  const act = React.useCallback(
    async (key: string, fn: () => Promise<string | void> | string | void) => {
      setBusy(key)
      try {
        const message = await fn()
        if (message) notify(message)
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error), "error")
      } finally {
        setBusy(null)
      }
    },
    [notify]
  )

  return { busy, act }
}

export type Act = ReturnType<typeof useAction>["act"]
