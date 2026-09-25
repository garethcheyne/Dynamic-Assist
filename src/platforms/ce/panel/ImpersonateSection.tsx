import { UserRoundCogIcon } from "lucide-react"

import { CollapsibleSection } from "@/components/collapsible-section"
import { Button } from "@/components/ui/button"
import type { Act } from "@/lib/use-action"

import {
  startImpersonation,
  stopImpersonation,
  type Impersonation,
} from "../impersonation"
import type { useCeTab } from "../use-ce-tab"
import { UserPicker } from "./UserPicker"

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
          <UserPicker
            run={run}
            action="Impersonate"
            onPick={(u) =>
              act("impersonate", async () => {
                await startImpersonation(tab.id!, host, u)
                return `Running as ${u.name}`
              })
            }
          />
        </div>
      )}
    </CollapsibleSection>
  )
}
