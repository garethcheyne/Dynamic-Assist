import * as React from "react"
import {
  CheckIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  UserRoundSearchIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { CollapsibleSection } from "@/components/collapsible-section"
import { Button } from "@/components/ui/button"

import type {
  CeDepth,
  CePermissions,
  CePrivilegeType,
  CeUserSummary,
} from "../types"
import type { useCeTab } from "../use-ce-tab"
import { Hint } from "@/components/hint"
import { AccessDetail } from "./AccessDetail"
import { CompareUsers } from "./CompareUsers"
import { UserPicker } from "./UserPicker"

type Run = ReturnType<typeof useCeTab>["run"]

const DEPTHS: Record<CeDepth, { label: string; level: number }> = {
  None: { label: "None", level: 0 },
  Basic: { label: "User", level: 1 },
  Local: { label: "Business unit", level: 2 },
  Deep: { label: "Parent: child BUs", level: 3 },
  Global: { label: "Organization", level: 4 },
}

const LABELS: Record<CePrivilegeType, string> = {
  Create: "Create",
  Read: "Read",
  Write: "Write",
  Delete: "Delete",
  Append: "Append",
  AppendTo: "Append to",
  Assign: "Assign",
  Share: "Share",
}

/** RetrievePrincipalAccess rights for each privilege row. */
const ACCESS: Record<CePrivilegeType, string> = {
  Create: "CreateAccess",
  Read: "ReadAccess",
  Write: "WriteAccess",
  Delete: "DeleteAccess",
  Append: "AppendAccess",
  AppendTo: "AppendToAccess",
  Assign: "AssignAccess",
  Share: "ShareAccess",
}

/**
 * What a user may do with this table, at which level, and on the open record:
 * you (or the user you're impersonating), or anyone you pick. Dynamics shows levels as filled circles;
 * this uses the same idea as a four-step meter.
 */
export function PermissionsSection({
  run,
  entityName,
  recordId,
  userId,
}: {
  run: Run
  entityName: string
  recordId: string | null
  /** Check someone else's access (the impersonated user) */
  userId: string | null
}) {
  const [data, setData] = React.useState<CePermissions | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  // Someone picked to check instead of you; null: you (or who you impersonate)
  const [picked, setPicked] = React.useState<CeUserSummary | null>(null)
  const [picking, setPicking] = React.useState(false)
  const [comparing, setComparing] = React.useState(false)

  const load = async (who: CeUserSummary | null = picked) => {
    setLoading(true)
    setError(null)
    try {
      setData(
        await run("permissions", {
          entityName,
          recordId,
          userId: who?.id ?? userId,
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }
  const check = (who: CeUserSummary | null) => {
    setPicked(who)
    setPicking(false)
    void load(who)
  }
  const whose = picked
    ? picked.name
    : userId
      ? "The impersonated user's"
      : "Your"

  return (
    <CollapsibleSection
      id="ce.permissions"
      title="Access"
      icon={<KeyRoundIcon />}
      summary={
        data && (
          <span className="truncate font-normal text-muted-foreground">
            {data.user.name}
          </span>
        )
      }
      actions={
        data && (
          <Button
            variant="ghost"
            size="icon-xs"
            title="Check again"
            aria-label="Check again"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
          </Button>
        )
      }
      defaultCollapsed
    >
      {comparing && data ? (
        <CompareUsers
          run={run}
          entityName={entityName}
          recordId={recordId}
          first={data.user}
          onClose={() => setComparing(false)}
        />
      ) : picking ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Check another user&apos;s privileges on {entityName}
            {recordId ? " and their access to this record" : ""}, from their
            security roles. You need permission to read users and their roles.
          </p>
          <UserPicker run={run} action="Check" onPick={check} autoFocus />
          <Button
            size="xs"
            variant="ghost"
            className="self-start"
            onClick={() => setPicking(false)}
          >
            Cancel
          </Button>
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center text-xs text-muted-foreground">
          {whose} privileges on {entityName}
          {recordId ? " and access to this record" : ""}, from security roles.
          <div className="flex flex-wrap justify-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <KeyRoundIcon data-icon="inline-start" />
              {loading ? "Checking…" : "Check access"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPicking(true)}
              disabled={loading}
            >
              <UserRoundSearchIcon data-icon="inline-start" />
              Check someone else
            </Button>
          </div>
          {error && <span className="text-destructive">{error}</span>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
            <span className="min-w-0 flex-1 truncate">
              Checking <b>{data.user.name}</b>
            </span>
            <Button size="xs" variant="ghost" onClick={() => setPicking(true)}>
              <UserRoundSearchIcon data-icon="inline-start" />
              Change
            </Button>
            {picked && (
              <Button size="xs" variant="ghost" onClick={() => check(null)}>
                Back to me
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              title={`Compare ${data.user.name} with someone else`}
              onClick={() => setComparing(true)}
            >
              <UsersIcon data-icon="inline-start" />
              Compare
            </Button>
          </div>
          {error && <span className="text-xs text-destructive">{error}</span>}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] tracking-wide text-muted-foreground uppercase">
                <th className="pb-1 text-left font-semibold">Privilege</th>
                <th className="pb-1 text-left font-semibold">Level</th>
                {data.recordAccess && (
                  <th className="pb-1 text-right font-semibold">Record</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.privileges.map((p) => (
                <Hint key={p.type} label={p.name}>
                  <tr className="border-t">
                    <td className="py-1.5 pr-2">{LABELS[p.type]}</td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <DepthMeter depth={p.depth} />
                        <span
                          className={cn(
                            "truncate",
                            p.depth === "None" && "text-muted-foreground"
                          )}
                        >
                          {DEPTHS[p.depth].label}
                        </span>
                      </span>
                    </td>
                    {data.recordAccess && (
                      <td className="py-1.5 text-right">
                        {data.recordAccess.includes(ACCESS[p.type]) ? (
                          <CheckIcon
                            className="ml-auto size-3.5 text-primary"
                            aria-label="Allowed"
                          />
                        ) : (
                          <XIcon
                            className="ml-auto size-3.5 text-muted-foreground"
                            aria-label="Not allowed"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                </Hint>
              ))}
            </tbody>
          </table>
          <AccessDetail
            key={data.user.id}
            run={run}
            main={data}
            entityName={entityName}
            recordId={recordId}
            userId={data.user.id}
          />
        </div>
      )}
    </CollapsibleSection>
  )
}

function DepthMeter({ depth }: { depth: CeDepth }) {
  const level = DEPTHS[depth].level
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-1.5 rounded-sm",
            i <= level ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </span>
  )
}
