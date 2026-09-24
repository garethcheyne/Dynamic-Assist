import * as React from "react"
import { Loader2Icon, UserRoundCogIcon } from "lucide-react"

import { CollapsibleSection } from "@/components/collapsible-section"
import { SearchBox } from "@/components/search-box"
import { Button } from "@/components/ui/button"
import type { Act } from "@/lib/use-action"

import {
  startImpersonation,
  stopImpersonation,
  type Impersonation,
} from "../impersonation"
import type { CeUserSummary } from "../types"
import type { useCeTab } from "../use-ce-tab"

type Run = ReturnType<typeof useCeTab>["run"]

/** Run the app as another user, to see what they see. */
export function ImpersonateSection({
  tab,
  host,
  run,
  act,
  active,
}: {
  tab: chrome.tabs.Tab
  host: string
  run: Run
  act: Act
  active: Impersonation | null
}) {
  const [query, setQuery] = React.useState("")
  const [users, setUsers] = React.useState<CeUserSummary[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Results only mean something for the query that's still typed
  const shown = query.trim().length >= 2 ? users : null

  // Search as you type, a moment after the last key
  React.useEffect(() => {
    if (active) return
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
  }, [query, run, active])

  return (
    <CollapsibleSection
      id="ce.impersonate"
      title="Impersonate"
      icon={<UserRoundCogIcon />}
      defaultCollapsed={!active}
    >
      {active ? (
        <div className="flex flex-col gap-2 text-xs">
          <p>
            This tab is running as <b>{active.user.name}</b>
            {active.user.domainName && (
              <span className="text-muted-foreground">
                {" "}
                ({active.user.domainName})
              </span>
            )}
            . Records, forms and privileges are theirs until you stop.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() =>
              act("stopImpersonation", async () => {
                await stopImpersonation(tab.id!)
                return "Stopped impersonating"
              })
            }
          >
            Stop impersonating
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            The tab reloads and runs as the user you pick. You need the “Act on
            Behalf of Another User” privilege; without it the app's requests
            fail until you stop.
          </p>
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
                  className="group/user flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-medium">
                      {u.name}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {u.domainName}
                    </span>
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      act("impersonate", async () => {
                        await startImpersonation(tab.id!, host, u)
                        return `Running as ${u.name}`
                      })
                    }
                  >
                    Impersonate
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}
