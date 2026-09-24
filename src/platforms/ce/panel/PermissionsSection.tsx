import * as React from "react"
import { CheckIcon, KeyRoundIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { CollapsibleSection } from "@/components/collapsible-section"
import { Button } from "@/components/ui/button"

import type { CeDepth, CePermissions, CePrivilegeType } from "../types"
import type { useCeTab } from "../use-ce-tab"

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
 * What the user (or the impersonated user) may do with this table, at which
 * level, and on the open record. Dynamics shows levels as filled circles;
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

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await run("permissions", { entityName, recordId, userId }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

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
            onClick={load}
            disabled={loading}
          >
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
          </Button>
        )
      }
      defaultCollapsed
    >
      {!data ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center text-xs text-muted-foreground">
          Your privileges on {entityName}
          {recordId ? " and your access to this record" : ""}, from your
          security roles.
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <KeyRoundIcon data-icon="inline-start" />
            {loading ? "Checking…" : "Check access"}
          </Button>
          {error && <span className="text-destructive">{error}</span>}
        </div>
      ) : (
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
              <tr key={p.type} className="border-t" title={p.name}>
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
            ))}
          </tbody>
        </table>
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
