import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { SearchBox } from "@/components/search-box"
import { Button } from "@/components/ui/button"

import type { CeUserSummary } from "../types"
import type { useCeTab } from "../use-ce-tab"

type Run = ReturnType<typeof useCeTab>["run"]

/**
 * Search the org's enabled users by name or email, as you type, and pick one.
 * Used to impersonate someone and to check someone's access.
 */
export function UserPicker({
  run,
  action,
  onPick,
  autoFocus,
}: {
  run: Run
  /** The button on each result: "Impersonate", "Check" */
  action: string
  onPick: (user: CeUserSummary) => void
  autoFocus?: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [users, setUsers] = React.useState<CeUserSummary[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const box = React.useRef<HTMLDivElement>(null)
  // Results only mean something for the query that's still typed
  const shown = query.trim().length >= 2 ? users : null

  React.useEffect(() => {
    if (autoFocus) box.current?.querySelector("input")?.focus()
  }, [autoFocus])

  // Search as you type, a moment after the last key
  React.useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        setUsers(await run("searchUsers", { query: q }))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, run])

  return (
    <div ref={box} className="flex flex-col gap-2">
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search users by name or email"
      />
      {searching && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" /> Searching…
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {shown && shown.length === 0 && !searching && (
        <p className="text-xs text-muted-foreground">No users match.</p>
      )}
      {shown && shown.length > 0 && (
        <ul className="-mx-1.5 flex flex-col">
          {shown.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium">{u.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {u.domainName}
                </span>
              </span>
              <Button size="xs" variant="outline" onClick={() => onPick(u)}>
                {action}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
