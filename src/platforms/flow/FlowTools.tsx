import * as React from "react"
import {
  BracesIcon,
  CableIcon,
  CheckIcon,
  CircleAlertIcon,
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  VariableIcon,
  WorkflowIcon,
  XCircleIcon,
} from "lucide-react"
import { cn } from "cn"

import { CollapsibleSection } from "@/components/collapsible-section"
import { Detail, DetailGrid } from "@/components/detail-grid"
import { SearchBox } from "@/components/search-box"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/lib/copy"
import { useLoad, type Load } from "@/lib/use-load"

import {
  getFlow,
  listConnectionReferences,
  listEnvVariables,
  listFlows,
  listRuns,
  listSolutions,
  setFlowOn,
  type ConnectionReference,
  type EnvVariable,
  type Flow,
  type FlowDetail,
  type FlowRun,
} from "./flows"
import { flowUrl } from "./use-org"
import { Hint } from "@/components/hint"

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—"

function Status({ load, empty }: { load: Load<unknown>; empty?: string }) {
  if (load.loading)
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" /> Loading…
      </p>
    )
  if (load.error)
    return (
      <p className="flex items-start gap-2 text-xs text-destructive">
        <CircleAlertIcon className="mt-px size-3.5 shrink-0" />
        {load.error}
      </p>
    )
  return empty ? <p className="text-xs text-muted-foreground">{empty}</p> : null
}

/** Icon-only "Copy as JSON" for a section header, leaving room for its title. */
function JsonCopy({ data, what }: { data: () => unknown; what: string }) {
  const copy = useCopy()
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      title={`Copy ${what} as JSON`}
      aria-label={`Copy ${what} as JSON`}
      onClick={(e) => {
        e.stopPropagation()
        void copy(JSON.stringify(data(), null, 2), `${what} as JSON`)
      }}
    >
      <BracesIcon />
    </Button>
  )
}

const ReloadButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="ghost"
    size="icon-xs"
    title="Load again"
    aria-label="Load again"
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
  >
    <RefreshCwIcon />
  </Button>
)

// --- This flow ---------------------------------------------------------------

/** The flow on screen: its state, definition JSON and recent runs. */
export function FlowDetails({
  org,
  env,
  flowId,
}: {
  org: string
  env: string
  flowId: string
}) {
  const copy = useCopy()
  const flow = useLoad<FlowDetail | null>(
    () => getFlow(org, flowId),
    [org, flowId]
  )
  const [showJson, setShowJson] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const [switchError, setSwitchError] = React.useState<string | null>(null)
  const f = flow.data
  const json = f ? JSON.stringify(f.definition, null, 2) : ""

  const toggle = async () => {
    if (!f) return
    setSwitching(true)
    setSwitchError(null)
    try {
      await setFlowOn(org, f.workflowid, !f.on)
      flow.reload()
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : String(e))
    } finally {
      setSwitching(false)
    }
  }

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    )
    const a = document.createElement("a")
    a.href = url
    a.download = `${(f?.name ?? "flow").replace(/[^\w.-]+/g, "_")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CollapsibleSection
      id="flow.this"
      title="This flow"
      icon={<WorkflowIcon />}
      actions={<ReloadButton onClick={flow.reload} />}
    >
      {!f ? (
        <Status
          load={flow}
          empty="This flow isn't in Dataverse: only solution-aware flows are. Add it to a solution to use these tools."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <DetailGrid>
            <Detail label="Name" value={f.name} copy={f.name} wide />
            <Detail
              label="State"
              value={
                <span
                  className={cn(
                    "font-medium",
                    f.on
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {f.on ? "On" : "Off"} · {f.status}
                </span>
              }
            />
            <Detail label="Modified" value={when(f.modifiedon)} />
            <Detail label="Owner" value={f.owner ?? "—"} />
            <Detail label="Managed" value={f.managed ? "Yes" : "No"} />
            <Detail
              label="Flow ID"
              value={f.resourceid ?? "—"}
              copy={f.resourceid ?? undefined}
              mono
              wide
            />
            <Detail
              label="Workflow ID (Dataverse)"
              value={f.workflowid}
              copy={f.workflowid}
              mono
              wide
            />
          </DetailGrid>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={f.on ? "outline" : "default"}
              disabled={switching}
              onClick={() => void toggle()}
            >
              {switching ? (
                <Loader2Icon className="animate-spin" />
              ) : f.on ? (
                <PowerOffIcon />
              ) : (
                <PowerIcon />
              )}
              {f.on ? "Turn off" : "Turn on"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowJson((s) => !s)}
            >
              <BracesIcon />
              {showJson ? "Hide JSON" : "Show JSON"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void copy(json, "flow definition")}
            >
              Copy JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={download}
              title="Download the definition as a .json file"
            >
              <DownloadIcon />
            </Button>
          </div>
          {switchError && (
            <p className="text-xs text-destructive">{switchError}</p>
          )}
          {showJson && (
            <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-2 font-mono text-[11px] leading-snug">
              {json}
            </pre>
          )}
          <RunsList org={org} env={env} workflowId={f.workflowid} all />
        </div>
      )}
    </CollapsibleSection>
  )
}

// --- Runs --------------------------------------------------------------------

function RunsList({
  org,
  env,
  workflowId,
  all = false,
  solutionId = null,
}: {
  org: string
  env: string
  workflowId?: string
  all?: boolean
  solutionId?: string | null
}) {
  const runs = useLoad<FlowRun[]>(
    () =>
      listRuns(org, {
        workflowId,
        all,
        solutionId,
        top: workflowId ? 10 : 50,
      }),
    [org, workflowId, all, solutionId]
  )
  if (!runs.data) return <Status load={runs} />
  if (!runs.data.length)
    return (
      <p className="text-xs text-muted-foreground">
        {all
          ? "No runs in the last 28 days."
          : "No failed runs in the last 28 days."}
      </p>
    )
  return (
    <ul className="flex flex-col divide-y rounded-lg border text-xs">
      {runs.data.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5 px-2 py-1.5">
          <div className="flex items-center gap-2">
            {r.status === "Succeeded" ? (
              <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
            ) : (
              <XCircleIcon
                className={cn(
                  "size-3.5 shrink-0",
                  r.status === "Failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              />
            )}
            <span className="min-w-0 flex-1 truncate font-medium">
              {workflowId ? r.status : (r.flow ?? r.workflowId)}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {when(r.start)}
            </span>
          </div>
          {r.error && (
            <Hint label={r.error}>
              <p className="line-clamp-3 pl-5.5 text-[11px] text-destructive">
                {r.error}
              </p>
            </Hint>
          )}
        </li>
      ))}
      {!workflowId && (
        <li className="px-2 py-1.5 text-[11px] text-muted-foreground">
          From Dataverse's flow run history.{" "}
          <a
            className="text-primary hover:underline"
            href={`https://make.powerautomate.com/environments/${env}/monitor`}
            target="_blank"
            rel="noreferrer"
          >
            Monitor
          </a>
        </li>
      )}
    </ul>
  )
}

export function FailedRuns({
  org,
  env,
  solutionId,
}: {
  org: string
  env: string
  solutionId: string | null
}) {
  const [key, setKey] = React.useState(0)
  return (
    <CollapsibleSection
      id="flow.failed"
      title="Failed runs"
      icon={<XCircleIcon />}
      defaultCollapsed
      actions={<ReloadButton onClick={() => setKey((k) => k + 1)} />}
    >
      <RunsList key={key} org={org} env={env} solutionId={solutionId} />
    </CollapsibleSection>
  )
}

// --- Many flows: select and turn on or off ------------------------------------

type Outcome = { ok: boolean; message?: string }

/** Runs `task` over `items`, `limit` at a time. */
async function pool<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift())
        await task(item)
    })
  )
}

/**
 * Cloud flows in a solution (or the environment) with checkboxes: pick many
 * and turn them all on, instead of one at a time in the portal.
 */
export function FlowsManager({
  org,
  env,
  solutionId,
}: {
  org: string
  env: string
  solutionId: string | null
}) {
  const flows = useLoad<Flow[]>(
    () => listFlows(org, solutionId),
    [org, solutionId]
  )
  const [show, setShow] = React.useState<"off" | "all">("off")
  const [search, setSearch] = React.useState("")
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const [confirm, setConfirm] = React.useState<"on" | "off" | null>(null)
  const [running, setRunning] = React.useState(false)
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({})

  const all = flows.data ?? []
  const offCount = all.filter((f) => !f.on).length
  const q = search.trim().toLowerCase()
  const visible = all.filter(
    (f) =>
      (show === "all" || !f.on || outcomes[f.workflowid]) &&
      (!q || f.name.toLowerCase().includes(q))
  )
  const chosen = all.filter((f) => picked.has(f.workflowid))
  const allPicked =
    visible.length > 0 && visible.every((f) => picked.has(f.workflowid))

  const togglePick = (id: string) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = async (on: boolean) => {
    setConfirm(null)
    setRunning(true)
    const targets = chosen.filter((f) => f.on !== on)
    const results: Record<string, Outcome> = {}
    await pool(targets, 4, async (f) => {
      try {
        await setFlowOn(org, f.workflowid, on)
        results[f.workflowid] = { ok: true }
      } catch (e) {
        results[f.workflowid] = {
          ok: false,
          message: e instanceof Error ? e.message : String(e),
        }
      }
      setOutcomes((o) => ({ ...o, [f.workflowid]: results[f.workflowid] }))
    })
    setRunning(false)
    // Keep the ones that failed picked, so fixing and retrying is one click
    setPicked(new Set(Object.keys(results).filter((id) => !results[id].ok)))
    flows.reload()
  }

  const done = Object.values(outcomes)
  const failed = done.filter((o) => !o.ok).length

  return (
    <CollapsibleSection
      id="flow.many"
      title={solutionId ? "Flows in this solution" : "Cloud flows"}
      icon={<PowerIcon />}
      summary={
        flows.data && (
          <span className="rounded-full bg-muted px-1.5 text-[10px] leading-4 text-muted-foreground tabular-nums">
            {offCount} off / {all.length}
          </span>
        )
      }
      actions={
        <ReloadButton
          onClick={() => {
            setOutcomes({})
            flows.reload()
          }}
        />
      }
    >
      {!flows.data ? (
        <Status load={flows} />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Filter flows"
              />
            </div>
            <select
              aria-label="Which flows"
              value={show}
              onChange={(e) => setShow(e.target.value as "off" | "all")}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
            >
              <option value="off">Off</option>
              <option value="all">All</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {show === "off" && !q
                ? "Every flow here is on."
                : "No flows match."}
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-lg border text-xs">
              <li className="sticky top-0 z-10 flex items-center gap-2 bg-card px-2 py-1.5 font-medium">
                <input
                  type="checkbox"
                  aria-label="Pick every flow shown"
                  checked={allPicked}
                  onChange={() =>
                    setPicked((p) => {
                      const next = new Set(p)
                      for (const f of visible) {
                        if (allPicked) next.delete(f.workflowid)
                        else next.add(f.workflowid)
                      }
                      return next
                    })
                  }
                />
                <span className="flex-1 text-muted-foreground">
                  {picked.size
                    ? `${picked.size} picked`
                    : `${visible.length} shown`}
                </span>
              </li>
              {visible.map((f) => {
                const o = outcomes[f.workflowid]
                return (
                  <li
                    key={f.workflowid}
                    className="flex flex-col gap-0.5 px-2 py-1.5"
                  >
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={picked.has(f.workflowid)}
                        onChange={() => togglePick(f.workflowid)}
                      />
                      <Hint label={f.on ? "On" : "Off"}>
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            f.on ? "bg-emerald-500" : "bg-muted-foreground/40"
                          )}
                        />
                      </Hint>
                      <Hint label={f.name}>
                        <span className="min-w-0 flex-1 truncate">
                          {f.name}
                        </span>
                      </Hint>
                      {o &&
                        (o.ok ? (
                          <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircleIcon className="size-3.5 shrink-0 text-destructive" />
                        ))}
                      {f.resourceid && (
                        <Hint label="Open in Power Automate">
                          <a
                            href={flowUrl(env, f.resourceid)}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLinkIcon className="size-3.5" />
                          </a>
                        </Hint>
                      )}
                    </label>
                    {o && !o.ok && (
                      <p className="pl-9 text-[11px] text-destructive">
                        {o.message}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {confirm ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-accent p-2 text-xs text-accent-foreground">
              <p>
                Turn {confirm}{" "}
                {chosen.filter((f) => f.on !== (confirm === "on")).length}{" "}
                flow(s)? They'll{" "}
                {confirm === "on"
                  ? "start running on their triggers"
                  : "stop running"}{" "}
                straight away.
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => void run(confirm === "on")}>
                  Turn {confirm}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                disabled={running || !chosen.some((f) => !f.on)}
                onClick={() => setConfirm("on")}
              >
                {running ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PowerIcon />
                )}
                Turn on
                {chosen.length
                  ? ` (${chosen.filter((f) => !f.on).length})`
                  : ""}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={running || !chosen.some((f) => f.on)}
                onClick={() => setConfirm("off")}
              >
                <PowerOffIcon />
                Turn off
                {chosen.length ? ` (${chosen.filter((f) => f.on).length})` : ""}
              </Button>
              {done.length > 0 && !running && (
                <span
                  className={cn(
                    "text-[11px]",
                    failed ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {done.length - failed} done
                  {failed ? `, ${failed} failed` : ""}
                </span>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Runs as you. A flow whose connection references have no connection
            won't turn on; the reason shows under it.
          </p>
        </div>
      )}
    </CollapsibleSection>
  )
}

// --- Environment variables and connection references ------------------------

export function EnvVariables({
  org,
  solutionId,
}: {
  org: string
  solutionId: string | null
}) {
  const vars = useLoad<EnvVariable[]>(
    () => listEnvVariables(org, solutionId),
    [org, solutionId]
  )
  const [search, setSearch] = React.useState("")
  const q = search.trim().toLowerCase()
  const shown = (vars.data ?? []).filter(
    (v) =>
      !q ||
      v.schemaName.toLowerCase().includes(q) ||
      v.displayName.toLowerCase().includes(q)
  )
  const missing = (vars.data ?? []).filter(
    (v) => v.value === null && v.defaultValue === null
  ).length
  return (
    <CollapsibleSection
      id="flow.envvars"
      title="Environment variables"
      icon={<VariableIcon />}
      defaultCollapsed
      summary={
        vars.data && (
          <span
            className={cn(
              "rounded-full px-1.5 text-[10px] leading-4 tabular-nums",
              missing
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            )}
          >
            {missing ? `${missing} unset / ` : ""}
            {vars.data.length}
          </span>
        )
      }
      actions={
        <>
          {vars.data && (
            <JsonCopy data={() => vars.data} what="environment variables" />
          )}
          <ReloadButton onClick={vars.reload} />
        </>
      }
    >
      {!vars.data ? (
        <Status load={vars} />
      ) : !vars.data.length ? (
        <p className="text-xs text-muted-foreground">None here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Filter variables"
          />
          <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-lg border text-xs">
            {shown.map((v) => {
              const value = v.value ?? v.defaultValue
              return (
                <li key={v.id} className="flex flex-col gap-0.5 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Hint label={v.schemaName}>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {v.displayName}
                      </span>
                    </Hint>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {v.type}
                    </span>
                  </div>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {v.schemaName}
                  </span>
                  <Hint label={value ?? undefined}>
                    <span
                      className={cn(
                        "line-clamp-2 font-mono text-[11px]",
                        value === null && "text-destructive"
                      )}
                    >
                      {value === null
                        ? "No value and no default"
                        : `${v.value === null ? "Default: " : ""}${value}`}
                    </span>
                  </Hint>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </CollapsibleSection>
  )
}

export function ConnectionReferences({
  org,
  solutionId,
}: {
  org: string
  solutionId: string | null
}) {
  const refs = useLoad<ConnectionReference[]>(
    () => listConnectionReferences(org, solutionId),
    [org, solutionId]
  )
  const broken = (refs.data ?? []).filter((r) => !r.connectionId)
  const [onlyBroken, setOnlyBroken] = React.useState(false)
  const shown = onlyBroken ? broken : (refs.data ?? [])
  return (
    <CollapsibleSection
      id="flow.connrefs"
      title="Connection references"
      icon={<CableIcon />}
      defaultCollapsed
      summary={
        refs.data && (
          <span
            className={cn(
              "rounded-full px-1.5 text-[10px] leading-4 tabular-nums",
              broken.length
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            )}
          >
            {broken.length ? `${broken.length} unconnected / ` : ""}
            {refs.data.length}
          </span>
        )
      }
      actions={
        <>
          {refs.data && (
            <JsonCopy data={() => refs.data} what="connection references" />
          )}
          <ReloadButton onClick={refs.reload} />
        </>
      }
    >
      {!refs.data ? (
        <Status load={refs} />
      ) : !refs.data.length ? (
        <p className="text-xs text-muted-foreground">None here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {broken.length > 0 && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={onlyBroken}
                onChange={() => setOnlyBroken((b) => !b)}
              />
              Only ones without a connection
            </label>
          )}
          <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-lg border text-xs">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  {r.connectionId ? (
                    <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleAlertIcon className="size-3.5 shrink-0 text-destructive" />
                  )}
                  <Hint label={r.logicalName}>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.displayName}
                    </span>
                  </Hint>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {r.connector.replace(/^shared_/, "")}
                  </span>
                </div>
                <span className="truncate pl-5.5 font-mono text-[11px] text-muted-foreground">
                  {r.connectionId ?? "No connection"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollapsibleSection>
  )
}

/**
 * Which solution the lists cover when the page isn't in one: every
 * solution-aware flow, or one solution's.
 */
export function SolutionPicker({
  org,
  value,
  onChange,
}: {
  org: string
  value: string | null
  onChange: (id: string | null) => void
}) {
  const solutions = useLoad(() => listSolutions(org), [org])
  return (
    <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs shadow-xs">
      <span className="shrink-0 font-semibold">Solution</span>
      <select
        aria-label="Solution"
        value={value ?? ""}
        disabled={!solutions.data}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs"
      >
        <option value="">
          {solutions.loading
            ? "Loading solutions…"
            : "All solution-aware flows"}
        </option>
        {solutions.data?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.managed ? " (managed)" : ""}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Shown while the org is looked up, or when it can't be found. */
export function OrgMissing({
  loading,
  onRetry,
}: {
  loading: boolean
  onRetry: () => void
}) {
  if (loading)
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" /> Finding this
        environment's Dataverse org…
      </p>
    )
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
      <p>
        Couldn't find this environment's Dataverse org yet. Open a solution or a
        flow in this tab (the portal loads it then), or open the environment's
        Dynamics 365 app once, and try again.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={onRetry}
      >
        <RefreshCwIcon /> Try again
      </Button>
    </div>
  )
}
