import * as React from "react"
import {
  AlertTriangleIcon,
  Building2Icon,
  CheckIcon,
  FileLockIcon,
  LayoutListIcon,
  Loader2Icon,
  ShareIcon,
  UserRoundCheckIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { Hint, HintBody } from "@/components/hint"

import type { CeAccessDetail, CePermissions } from "../types"
import { relatedIssues, SHORT_DEPTH } from "./access-rules"
import { useAccessDetail } from "./use-access-detail"

function Heading({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase [&_svg]:size-3.5 [&_svg]:text-primary">
      {icon}
      {children}
    </p>
  )
}

const Tick = ({ on, label }: { on: boolean; label: string }) =>
  on ? (
    <CheckIcon className="size-3.5 text-primary" aria-label={`${label}: yes`} />
  ) : (
    <XIcon
      className="size-3.5 text-muted-foreground"
      aria-label={`${label}: no`}
    />
  )

/**
 * Beyond the table's own privileges: the form's lookups and subgrids, the
 * table's secured columns, and where access to the open record comes from.
 */
export function AccessDetail({
  run,
  main,
  entityName,
  recordId,
  userId,
}: {
  run: Parameters<typeof useAccessDetail>[0]
  main: CePermissions
  entityName: string
  recordId: string | null
  userId: string | null
}) {
  const { detail, error, loading } = useAccessDetail(
    run,
    entityName,
    recordId,
    userId
  )

  if (loading)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" /> Checking lookups,
        subgrids, secured columns and the record…
      </p>
    )
  if (error || !detail)
    return <p className="text-xs text-destructive">{error ?? "No details"}</p>

  return (
    <div className="flex flex-col gap-4 text-xs">
      <RelatedList detail={detail} main={main} />
      <SecuredColumns detail={detail} />
      {detail.record && <RecordReasons detail={detail} />}
      <p className="text-[10px] leading-snug text-muted-foreground">
        Not checked here: hierarchy security, business rules and form scripts
        that hide or lock fields, and which apps the user&apos;s roles can open.
      </p>
    </div>
  )
}

function RelatedList({
  detail,
  main,
}: {
  detail: CeAccessDetail
  main: CePermissions
}) {
  if (!detail.related.length)
    return (
      <div className="flex flex-col gap-1.5">
        <Heading icon={<LayoutListIcon />}>On this form</Heading>
        <p className="text-muted-foreground">
          No lookups or subgrids to check here. Open a record form to see them.
        </p>
      </div>
    )
  const withIssues = detail.related.filter(
    (r) => relatedIssues(r, main).length
  ).length
  return (
    <div className="flex flex-col gap-1.5">
      <Heading icon={<LayoutListIcon />}>
        On this form{" "}
        <span
          className={cn(
            "normal-case",
            withIssues && "text-amber-600 dark:text-amber-400"
          )}
        >
          · {withIssues ? `${withIssues} with problems` : "all fine"}
        </span>
      </Heading>
      <ul className="flex flex-col divide-y rounded-lg border">
        {detail.related.map((r) => {
          const issues = relatedIssues(r, main)
          return (
            <li
              key={`${r.control}:${r.table}`}
              className={cn(
                "flex flex-col gap-1 px-2 py-1.5",
                issues.length && "bg-amber-500/5"
              )}
            >
              <div className="flex items-center gap-2">
                <Hint label={`Form control: ${r.control}`}>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.label}
                  </span>
                </Hint>
                <span className="shrink-0 rounded border px-1 text-[10px] text-muted-foreground">
                  {r.kind === "lookup" ? "Lookup" : "Subgrid"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono">{r.table}</span>
                <Level name="Read" depth={r.read} />
                {r.kind === "lookup" ? (
                  <Level name="Append to" depth={r.appendTo} />
                ) : (
                  <>
                    <Level name="Create" depth={r.create} />
                    <Level name="Append" depth={r.append} />
                  </>
                )}
              </div>
              {issues.map((i) => (
                <p
                  key={i.text}
                  className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                  {i.text}
                </p>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Level({
  name,
  depth,
}: {
  name: string
  depth: CeAccessDetail["related"][number]["read"]
}) {
  return (
    <span
      className={cn(depth === "None" && "text-amber-700 dark:text-amber-400")}
    >
      {name}: <b className="font-medium">{SHORT_DEPTH[depth]}</b>
    </span>
  )
}

function SecuredColumns({ detail }: { detail: CeAccessDetail }) {
  const cols = detail.secured
  return (
    <div className="flex flex-col gap-1.5">
      <Heading icon={<FileLockIcon />}>
        Secured columns
        {cols && cols.length > 0 && (
          <span className="normal-case"> · {cols.length}</span>
        )}
      </Heading>
      {cols === null ? (
        <p className="text-muted-foreground">
          Couldn&apos;t read column security (needs permission to read field
          security profiles).
        </p>
      ) : cols.length === 0 ? (
        <p className="text-muted-foreground">
          No secured columns on this table.
        </p>
      ) : (
        <>
          {detail.systemAdministrator && (
            <p className="text-muted-foreground">
              System Administrator: sees and edits every secured column.
            </p>
          )}
          <table className="w-full">
            <thead>
              <tr className="text-[10px] tracking-wide text-muted-foreground uppercase">
                <th className="pb-1 text-left font-semibold">Column</th>
                <th className="pb-1 font-semibold">Read</th>
                <th className="pb-1 font-semibold">Update</th>
                <th className="pb-1 font-semibold">Create</th>
              </tr>
            </thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.column} className="border-t">
                  <td className="max-w-0 py-1 pr-2">
                    <Hint
                      label={<HintBody title={c.label}>{c.column}</HintBody>}
                    >
                      <span className="block truncate">{c.label}</span>
                    </Hint>
                  </td>
                  {(["read", "update", "create"] as const).map((k) => (
                    <td key={k} className="py-1">
                      <span className="flex justify-center">
                        <Tick on={c[k]} label={k} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground">
            No Read: the value shows as ••••• on forms and views.
          </p>
        </>
      )}
    </div>
  )
}

function RecordReasons({ detail }: { detail: CeAccessDetail }) {
  const r = detail.record!
  const owns = r.owner.isUser
    ? "They own this record."
    : r.owner.isUsersTeam
      ? `Their team ${r.owner.name} owns this record.`
      : `Owned by ${r.owner.name}${r.owner.kind === "team" ? " (a team they're not in)" : ""}.`
  return (
    <div className="flex flex-col gap-1.5">
      <Heading icon={<UserRoundCheckIcon />}>
        Why they can reach this record
      </Heading>
      <p className="flex items-start gap-1.5">
        <UserRoundCheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
        {owns}
      </p>
      <p
        className={cn(
          "flex items-start gap-1.5",
          !r.sameBusinessUnit && "text-amber-700 dark:text-amber-400"
        )}
      >
        <Building2Icon className="mt-0.5 size-3.5 shrink-0" />
        {r.sameBusinessUnit
          ? `In their business unit (${r.recordBusinessUnit}), so "BU" level applies.`
          : `In ${r.recordBusinessUnit ?? "another business unit"}, not theirs (${r.userBusinessUnit ?? "unknown"}): "User" and "BU" levels don't reach it; it needs "BU + child", "Org", ownership or a share.`}
      </p>
      {r.shares === null ? (
        <p className="text-muted-foreground">
          Couldn&apos;t read who it&apos;s shared with.
        </p>
      ) : r.shares.length === 0 ? (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <ShareIcon className="mt-0.5 size-3.5 shrink-0" />
          Not shared with them or their teams.
        </p>
      ) : (
        r.shares.map((s) => (
          <p key={s.principal} className="flex items-start gap-1.5">
            <ShareIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              Shared with {s.kind === "user" ? "them" : s.principal}
              {s.kind === "team" ? " (their team)" : ""}:{" "}
              <span className="text-muted-foreground">
                {s.rights.map((x) => x.replace(/Access$/, "")).join(", ")}
              </span>
            </span>
          </p>
        ))
      )}
    </div>
  )
}
