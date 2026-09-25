import * as React from "react"
import {
  ArrowLeftRightIcon,
  CheckIcon,
  Loader2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"

import type {
  CeDepth,
  CePermissions,
  CePrivilegeType,
  CeUserRoles,
  CeUserSummary,
} from "../types"
import type { useCeTab } from "../use-ce-tab"
import { relatedIssues, SHORT_DEPTH } from "./access-rules"
import { UserPicker } from "./UserPicker"
import { useAccessDetail } from "./use-access-detail"

type Run = ReturnType<typeof useCeTab>["run"]
type Who = { id: string; name: string }

const RANK: CeDepth[] = ["None", "Basic", "Local", "Deep", "Global"]
const SHORT: Record<CeDepth, string> = {
  None: "None",
  Basic: "User",
  Local: "BU",
  Deep: "BU + child",
  Global: "Org",
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

type Side = { perms: CePermissions; roles: CeUserRoles }

/**
 * Two users side by side: their privileges on this table (and access to the
 * open record), and their security roles, with the differences picked out.
 * Read-only: it only asks Dynamics what each user can do.
 */
export function CompareUsers({
  run,
  entityName,
  recordId,
  first,
  onClose,
}: {
  run: Run
  entityName: string
  recordId: string | null
  first: Who
  onClose: () => void
}) {
  const [second, setSecond] = React.useState<CeUserSummary | null>(null)
  const [sides, setSides] = React.useState<[Side, Side] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const compare = async (other: CeUserSummary) => {
    setSecond(other)
    setLoading(true)
    setError(null)
    try {
      const side = async (id: string): Promise<Side> => {
        const [perms, roles] = await Promise.all([
          run("permissions", { entityName, recordId, userId: id }),
          run("userRoles", { userId: id }),
        ])
        return { perms, roles }
      }
      setSides(await Promise.all([side(first.id), side(other.id)]))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!second)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Compare <b className="text-foreground">{first.name}</b> with someone
          else: their privileges on {entityName}
          {recordId ? ", access to this record" : ""} and security roles.
        </p>
        <UserPicker
          run={run}
          action="Compare"
          onPick={(u) => void compare(u)}
          autoFocus
        />
        <Button
          size="xs"
          variant="ghost"
          className="self-start"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    )

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
        <UsersIcon className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">
          <b>{first.name}</b> vs <b>{second.name}</b>
        </span>
        <Button size="xs" variant="ghost" onClick={() => setSecond(null)}>
          <ArrowLeftRightIcon data-icon="inline-start" />
          Change
        </Button>
        <Button size="xs" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>

      {loading && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" /> Comparing…
        </p>
      )}
      {error && <p className="text-destructive">{error}</p>}
      {sides && !loading && (
        <>
          <Comparison a={sides[0]} b={sides[1]} />
          <DetailComparison
            run={run}
            entityName={entityName}
            recordId={recordId}
            a={sides[0]}
            b={sides[1]}
          />
        </>
      )}
    </div>
  )
}

function Comparison({ a, b }: { a: Side; b: Side }) {
  const rows = a.perms.privileges.map((p) => {
    const other = b.perms.privileges.find((q) => q.type === p.type)
    return { type: p.type, name: p.name, a: p.depth, b: other?.depth ?? "None" }
  })
  const differs = rows.filter((r) => r.a !== r.b).length
  const record = a.perms.recordAccess !== null || b.perms.recordAccess !== null
  const has = (side: Side, type: CePrivilegeType) =>
    side.perms.recordAccess?.includes(ACCESS[type]) ?? false

  return (
    <>
      {/* Where each user sits: levels are relative to their business unit */}
      <div className="grid grid-cols-2 gap-2">
        {[a, b].map((s) => (
          <div
            key={s.roles.user.id}
            className="min-w-0 rounded-md border px-2 py-1.5"
          >
            <p className="truncate font-medium">{s.roles.user.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {s.roles.user.businessUnit ?? "No business unit"}
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {a.perms.entityName}{" "}
          <span
            className={cn(
              "normal-case",
              differs ? "text-amber-600 dark:text-amber-400" : ""
            )}
          >
            ·{" "}
            {differs
              ? `${differs} difference${differs === 1 ? "" : "s"}`
              : "the same"}
          </span>
        </p>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] tracking-wide text-muted-foreground uppercase">
              <th className="pb-1 text-left font-semibold">Privilege</th>
              <th className="pb-1 text-left font-semibold">First</th>
              <th className="pb-1 text-left font-semibold">Second</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.a !== r.b
              const recordDiff = record && has(a, r.type) !== has(b, r.type)
              return (
                <Hint key={r.type} label={r.name}>
                  <tr
                    className={cn(
                      "border-t",
                      (diff || recordDiff) && "bg-amber-500/10"
                    )}
                  >
                    <td className="py-1.5 pr-2 pl-1">{LABELS[r.type]}</td>
                    {[
                      [r.a, has(a, r.type)] as const,
                      [r.b, has(b, r.type)] as const,
                    ].map(([depth, onRecord], i) => (
                      <td key={i} className="py-1.5 pr-1">
                        <span className="flex items-center gap-1.5">
                          <Meter depth={depth} />
                          <span
                            className={cn(
                              "truncate",
                              depth === "None" && "text-muted-foreground",
                              diff &&
                                RANK.indexOf(depth) >
                                  RANK.indexOf(i ? r.a : r.b) &&
                                "font-semibold"
                            )}
                          >
                            {SHORT[depth]}
                          </span>
                          {record &&
                            (onRecord ? (
                              <CheckIcon
                                className="ml-auto size-3 shrink-0 text-primary"
                                aria-label="Has it on this record"
                              />
                            ) : (
                              <XIcon
                                className="ml-auto size-3 shrink-0 text-muted-foreground"
                                aria-label="Not on this record"
                              />
                            ))}
                        </span>
                      </td>
                    ))}
                  </tr>
                </Hint>
              )
            })}
          </tbody>
        </table>
        {record && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Ticks: the right on the open record (ownership, sharing and teams
            included).
          </p>
        )}
      </div>

      <Roles a={a.roles} b={b.roles} />
    </>
  )
}

/** Each user's roles, direct or through a team, as shared and one-sided lists */
function Roles({ a, b }: { a: CeUserRoles; b: CeUserRoles }) {
  const sources = (r: CeUserRoles) => {
    const map = new Map<string, string[]>()
    for (const name of r.direct)
      map.set(name, [...(map.get(name) ?? []), "direct"])
    for (const t of r.viaTeams)
      map.set(t.role, [...(map.get(t.role) ?? []), `team ${t.team}`])
    return map
  }
  const sa = sources(a)
  const sb = sources(b)
  const both = [...sa.keys()].filter((n) => sb.has(n)).sort()
  const onlyA = [...sa.keys()].filter((n) => !sb.has(n)).sort()
  const onlyB = [...sb.keys()].filter((n) => !sa.has(n)).sort()

  const group = (
    title: string,
    names: string[],
    from: Map<string, string[]>,
    tone?: string
  ) => (
    <div>
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title} <span className="normal-case">· {names.length}</span>
      </p>
      {names.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">None</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {names.map((n) => {
            const via = from.get(n) ?? []
            const teamOnly = via.every((v) => v !== "direct")
            return (
              <Hint
                key={n}
                label={via
                  .map((v) =>
                    v === "direct" ? "Assigned directly" : `Through ${v}`
                  )
                  .join(", ")}
              >
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    tone,
                    teamOnly && "border-dashed"
                  )}
                >
                  {n}
                </span>
              </Hint>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Security roles
      </p>
      {group(
        `Only ${a.user.name}`,
        onlyA,
        sa,
        "border-amber-500/50 bg-amber-500/10"
      )}
      {group(
        `Only ${b.user.name}`,
        onlyB,
        sb,
        "border-amber-500/50 bg-amber-500/10"
      )}
      {group("Both", both, sa)}
      <p className="text-[10px] text-muted-foreground">
        Dashed: through a team only. Hover a role to see where it comes from.
      </p>
    </div>
  )
}

function Meter({ depth }: { depth: CeDepth }) {
  const level = RANK.indexOf(depth)
  return (
    <span className="flex shrink-0 gap-0.5" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-1 rounded-sm",
            i <= level ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </span>
  )
}

/**
 * The form's lookups and subgrids, and the table's secured columns, for both
 * users: only the rows where they differ, so the answer stands out.
 */
function DetailComparison({
  run,
  entityName,
  recordId,
  a,
  b,
}: {
  run: Run
  entityName: string
  recordId: string | null
  a: Side
  b: Side
}) {
  const da = useAccessDetail(run, entityName, recordId, a.perms.user.id)
  const db = useAccessDetail(run, entityName, recordId, b.perms.user.id)
  if (da.loading || db.loading)
    return (
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" /> Comparing lookups,
        subgrids and secured columns…
      </p>
    )
  if (!da.detail || !db.detail)
    return (
      <p className="text-destructive">{da.error ?? db.error ?? "No details"}</p>
    )

  // Lookups and subgrids where the levels or the problems differ
  const key = (r: { control: string; table: string }) =>
    `${r.control}:${r.table}`
  const bRelated = new Map(db.detail.related.map((r) => [key(r), r]))
  const related = da.detail.related
    .map((ra) => {
      const rb = bRelated.get(key(ra))
      if (!rb) return null
      const ia = relatedIssues(ra, a.perms).map((i) => i.text)
      const ib = relatedIssues(rb, b.perms).map((i) => i.text)
      const same =
        ra.read === rb.read &&
        ra.create === rb.create &&
        ra.append === rb.append &&
        ra.appendTo === rb.appendTo &&
        ia.join() === ib.join()
      return same ? null : { ra, rb, ia, ib }
    })
    .filter((x) => x !== null)

  // Secured columns where their rights differ
  const bCols = new Map((db.detail.secured ?? []).map((c) => [c.column, c]))
  const columns = (da.detail.secured ?? [])
    .map((ca) => ({ ca, cb: bCols.get(ca.column) }))
    .filter(
      ({ ca, cb }) =>
        cb &&
        (ca.read !== cb.read ||
          ca.update !== cb.update ||
          ca.create !== cb.create)
    )

  const names = [a.roles.user.name, b.roles.user.name]
  const rights = (c: { read: boolean; update: boolean; create: boolean }) =>
    [c.read && "Read", c.update && "Update", c.create && "Create"]
      .filter(Boolean)
      .join(", ") || "None"

  return (
    <>
      <div>
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          On this form{" "}
          <span
            className={cn(
              "normal-case",
              related.length && "text-amber-600 dark:text-amber-400"
            )}
          >
            ·{" "}
            {da.detail.related.length === 0
              ? "no lookups or subgrids here"
              : related.length
                ? `${related.length} difference${related.length === 1 ? "" : "s"}`
                : "the same"}
          </span>
        </p>
        {related.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {related.map(({ ra, rb, ia, ib }) => (
              <li
                key={key(ra)}
                className="flex flex-col gap-1 bg-amber-500/5 px-2 py-1.5"
              >
                <p className="font-medium">
                  {ra.label}{" "}
                  <span className="font-normal text-muted-foreground">
                    {ra.kind === "lookup" ? "lookup" : "subgrid"} · {ra.table}
                  </span>
                </p>
                {[
                  [names[0], ra, ia],
                  [names[1], rb, ib],
                ].map(([name, r, issues]) => {
                  const rel = r as typeof ra
                  return (
                    <div key={name as string} className="text-[11px]">
                      <span className="font-medium">{name as string}:</span>{" "}
                      <span className="text-muted-foreground">
                        Read {SHORT_DEPTH[rel.read]}
                        {rel.kind === "lookup"
                          ? `, Append to ${SHORT_DEPTH[rel.appendTo]}`
                          : `, Create ${SHORT_DEPTH[rel.create]}, Append ${SHORT_DEPTH[rel.append]}`}
                      </span>
                      {(issues as string[]).map((t) => (
                        <p
                          key={t}
                          className="text-amber-700 dark:text-amber-400"
                        >
                          {t}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Secured columns{" "}
          <span
            className={cn(
              "normal-case",
              columns.length && "text-amber-600 dark:text-amber-400"
            )}
          >
            ·{" "}
            {da.detail.secured === null || db.detail.secured === null
              ? "couldn't read column security"
              : da.detail.secured.length === 0
                ? "none on this table"
                : columns.length
                  ? `${columns.length} difference${columns.length === 1 ? "" : "s"}`
                  : "the same"}
          </span>
        </p>
        {columns.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] tracking-wide text-muted-foreground uppercase">
                <th className="pb-1 text-left font-semibold">Column</th>
                <th className="pb-1 text-left font-semibold">First</th>
                <th className="pb-1 text-left font-semibold">Second</th>
              </tr>
            </thead>
            <tbody>
              {columns.map(({ ca, cb }) => (
                <tr key={ca.column} className="border-t bg-amber-500/10">
                  <td className="max-w-0 py-1 pr-2 pl-1">
                    <span className="block truncate">{ca.label}</span>
                  </td>
                  <td className="py-1 pr-1">{rights(ca)}</td>
                  <td className="py-1">{rights(cb!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
