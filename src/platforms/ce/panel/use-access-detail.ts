import * as React from "react"

import type { CeAccessDetail } from "../types"
import type { useCeTab } from "../use-ce-tab"

type Run = ReturnType<typeof useCeTab>["run"]

/** Loads the detail for one user; shared by the single view and Compare. */
export function useAccessDetail(
  run: Run,
  entityName: string,
  recordId: string | null,
  userId: string | null
) {
  const [detail, setDetail] = React.useState<CeAccessDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    let live = true
    run("accessDetail", { entityName, recordId, userId }).then(
      (d) => {
        if (!live) return
        setDetail(d)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!live) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    )
    return () => {
      live = false
    }
  }, [run, entityName, recordId, userId])
  return { detail, error, loading }
}
