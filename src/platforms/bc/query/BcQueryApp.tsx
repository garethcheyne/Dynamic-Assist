import * as React from "react"
import { TooltipPortalContainer } from "@/components/ui/tooltip"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FilterIcon,
  ListOrderedIcon,
  Loader2Icon,
  LinkIcon,
  LockIcon,
  PackageOpenIcon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  TableIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import type { Cell, Results, Row } from "@/query-builder/results"
import { CopyButton } from "@/components/copy-button"
import {
  ResultsPane,
  Section,
  type QuerySource,
} from "@/query-builder/ResultsPane"
import {
  PlainSelect,
  SearchSelect,
  type SelectItem,
} from "@/query-builder/SearchSelect"

import { buildBcUrl, parseBcUrl } from "../url"
import {
  alName,
  BRIDGE_PAGE_ID,
  BridgeClient,
  cleanValue,
  type BcColumn,
  type BcField,
  type BcFilter,
  type BcJoin,
  type BcInfo,
  type BcQuery,
  type BcQueryResult,
  type BcTable,
} from "./bridge"
import { toAl } from "./al"
import {
  arity,
  fromBcFilter,
  kindOf,
  operatorsFor,
  toBcFilter,
  type Condition,
} from "./conditions"
import {
  requestPlans,
  toApiQuery,
  type BcApi,
  type RelatedTables,
  type RequestPlan,
} from "./api"
import { Hint } from "@/components/hint"

export type BcOpenRequest = {
  app: "bc"
  /** Start on this table (the page's source table) */
  tableId?: number | null
  /** Start with these filters (on tableId) */
  filters?: BcFilter[]
  /** Start with these columns; "all" for every field that can be shown */
  fields?: number[] | "all"
  /** Run it straight away */
  run?: boolean
}

const COMPANION_HELP_URL =
  "https://github.com/garethcheyne/Dynamic-Assist/tree/main/bc-companion"

/** Columns picked for a new query: the key, then a few everyday fields. */
const DEFAULT_COLUMNS = 8
const DEFAULT_TABLE = 18 // Customer
/** localStorage: how the builder shows filters */
const FILTER_MODE_KEY = "dynamic-assist.bc-filter-mode"

const isPlain = (f: BcField) =>
  f.class === "Normal" &&
  f.enabled &&
  !["BLOB", "Media", "MediaSet"].includes(f.type)

function defaultColumns(fields: BcField[]) {
  const key = fields.filter((f) => f.pk).map((f) => f.no)
  const rest = fields
    .filter((f) => !f.pk && isPlain(f) && f.no < 2000000000 && !f.obsolete)
    .map((f) => f.no)
  return [...key, ...rest].slice(0, Math.max(DEFAULT_COLUMNS, key.length))
}

function newQuery(table: number, fields: BcField[]): BcQuery {
  return {
    table,
    fields: defaultColumns(fields),
    filters: [],
    sort: [],
    descending: false,
    top: 100,
    count: false,
  }
}

function toResults(r: BcQueryResult): Results {
  const keyOf = (c: BcColumn) =>
    c.join ? `${c.tableName}.${alName(c.name)}` : alName(c.name)
  const columns = r.columns.map((c) => ({
    key: keyOf(c),
    label: c.join ? `${c.tableCaption} › ${c.caption}` : c.caption,
  }))
  const rows = r.rows.map((values): Row =>
    Object.fromEntries(
      r.columns.map((c, i): [string, Cell] => {
        const value = cleanValue(c.type, values[i])
        return [
          keyOf(c),
          {
            value,
            formatted:
              typeof value === "boolean" ? (value ? "Yes" : "No") : null,
          },
        ]
      })
    )
  )
  return { columns, rows, more: r.more, ms: r.ms }
}

type Status = "connecting" | "missing" | "denied" | "ready"

/** The companion's answer when the user lacks the DA QUERY permission set */
const NO_ACCESS = /DA QUERY permission set/

/** The Business Central query builder, as a large modal over the web client. */
export function BcQueryApp({
  request,
  dark,
  onClose,
}: {
  request: BcOpenRequest & { seq: number }
  dark: boolean
  onClose: () => void
}) {
  // Tooltips render inside the builder's shadow root, in its styles and theme
  const [rootEl, setRootEl] = React.useState<HTMLDivElement | null>(null)
  const client = React.useMemo(() => new BridgeClient(), [])
  React.useEffect(() => () => client.dispose(), [client])

  const [status, setStatus] = React.useState<Status>("connecting")
  const [info, setInfo] = React.useState<BcInfo | null>(null)
  const [tables, setTables] = React.useState<BcTable[]>([])
  const [fields, setFields] = React.useState<BcField[]>([])
  const [readable, setReadable] = React.useState(true)
  const [apis, setApis] = React.useState<BcApi[]>([])
  /** Fields of tables the query joins, by table number */
  const [related, setRelated] = React.useState<RelatedTables>({})
  const loadRelated = React.useCallback(
    async (tableId: number) => {
      if (related[tableId]) return related[tableId]
      const loaded = await client.fields(tableId)
      const entry = {
        name: loaded.name,
        caption: loaded.caption,
        fields: loaded.fields,
      }
      setRelated((r) => ({ ...r, [tableId]: entry }))
      return entry
    },
    [client, related]
  )
  /** The REST endpoint picked on the API tab; null picks the best */
  const [planKey, setPlanKey] = React.useState<string | null>(null)
  const [loadingFields, setLoadingFields] = React.useState(true)
  const [query, setQuery] = React.useState<BcQuery | null>(null)
  const [results, setResults] = React.useState<Results | null>(null)
  const [lastRun, setLastRun] = React.useState<BcQueryResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [filterMode, setFilterMode] = React.useState<FilterMode>(() => {
    try {
      return localStorage.getItem(FILTER_MODE_KEY) === "bc"
        ? "bc"
        : "conditions"
    } catch {
      return "conditions"
    }
  })
  const changeFilterMode = (mode: FilterMode) => {
    setFilterMode(mode)
    try {
      localStorage.setItem(FILTER_MODE_KEY, mode)
    } catch {
      // Private window: it just won't be remembered
    }
  }
  const [denied, setDenied] = React.useState<string | null>(null)

  /** Runs a query and shows its first page */
  const runQuery = React.useCallback(
    async (q: BcQuery) => {
      setRunning(true)
      setError(null)
      try {
        const r = await client.query(q)
        setLastRun(r)
        setResults(toResults(r))
      } catch (e) {
        setResults(null)
        setLastRun(null)
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setRunning(false)
      }
    },
    [client]
  )

  const openTable = React.useCallback(
    (table: number, start?: BcOpenRequest) => {
      setLoadingFields(true)
      setError(null)
      setResults(null)
      setLastRun(null)
      return client
        .fields(table)
        .then(async (loaded) => {
          setApis(await client.apis(table))
          setPlanKey(null)
          setFields(loaded.fields)
          setReadable(loaded.readable)
          const q = newQuery(table, loaded.fields)
          // Opened with a query in mind (a record's fields, a table's list…)
          if (start?.fields === "all")
            q.fields = loaded.fields.filter(isPlain).map((f) => f.no)
          else if (start?.fields?.length) q.fields = start.fields
          if (start?.filters?.length) q.filters = start.filters
          setQuery(q)
          if (start?.run) void runQuery(q)
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoadingFields(false))
    },
    [client, runQuery]
  )

  React.useEffect(() => {
    let cancelled = false
    void client.connect().then(async (ok) => {
      if (cancelled) return
      if (!ok) {
        setStatus("missing")
        return
      }
      setStatus("ready")
      try {
        const [i, t] = await Promise.all([client.info(), client.tables()])
        if (cancelled) return
        setInfo(i)
        setTables(t)
        const start =
          t.find((x) => x.id === request.tableId) ??
          t.find((x) => x.id === DEFAULT_TABLE) ??
          t[0]
        if (start)
          await openTable(
            start.id,
            start.id === request.tableId ? request : undefined
          )
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        // No DA QUERY permission set: say so, instead of an empty builder
        if (NO_ACCESS.test(message)) {
          setDenied(message)
          setStatus("denied")
          return
        }
        setError(message)
        setLoadingFields(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [client, openTable, request])

  const table = tables.find((t) => t.id === query?.table)
  const sources = React.useMemo<QuerySource[]>(() => {
    if (!query || !table) return []
    const ctx = parseBcUrl(window.location.href)
    const apiCtx = {
      tenant: ctx.tenant,
      environment: ctx.environment,
      companyId: info?.companyId ?? null,
    }
    const plans = requestPlans(
      query,
      table,
      fields,
      apis,
      apiCtx,
      related,
      info?.company ?? null
    )
    const plan = plans.find((p) => p.key === planKey) ?? plans[0]
    const custom = plans[plans.length - 1]
    return [
      {
        label: "AL",
        // Record code, then the custom API query object
        text: `${toAl(query, table, fields, related)}\n\n${toApiQuery(query, table, fields, apiCtx, related).al}`,
      },
      {
        label: "API",
        text: plan.encodedUrl,
        view: (
          <ApiEndpoint
            plans={plans}
            plan={plan}
            onPick={setPlanKey}
            companyKnown={!!info?.companyId}
            customInQuery={custom.inQuery ?? []}
          />
        ),
      },
    ]
  }, [query, table, fields, info, apis, planKey, related])

  const run = React.useCallback(async () => {
    if (query) await runQuery(query)
  }, [query, runQuery])

  /** Appends the next page of the last run */
  const loadMore = React.useCallback(async () => {
    if (!query || !lastRun?.next) return
    setLoadingMore(true)
    try {
      const r = await client.query({ ...query, after: lastRun.next })
      const page = toResults(r)
      setResults((prev) =>
        prev
          ? {
              ...prev,
              rows: [...prev.rows, ...page.rows],
              more: page.more,
              ms: page.ms,
            }
          : page
      )
      setLastRun((prev) => ({ ...r, count: prev?.count ?? r.count }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMore(false)
    }
  }, [client, query, lastRun])

  const tableItems = React.useMemo<SelectItem[]>(
    () =>
      tables.map((t) => ({
        value: String(t.id),
        label: t.caption || t.name,
        hint: `${t.id} · ${t.name}`,
      })),
    [tables]
  )

  return (
    <TooltipPortalContainer.Provider value={rootEl}>
      <div
        ref={setRootEl}
        className={cn("da-root", dark && "dark")}
        data-platform="bc"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose()
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void run()
          }
        }}
      >
        <div className="fixed inset-0 z-[2147483000] bg-black/40 backdrop-blur-[2px]" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Query builder"
          className="fixed inset-x-[3vw] inset-y-[4vh] z-[2147483001] flex flex-col overflow-hidden rounded-xl border bg-background text-foreground shadow-2xl"
        >
          {/* Header */}
          <div className="relative flex h-12 shrink-0 items-center gap-3 border-b bg-linear-to-b from-background to-card px-4">
            <DatabaseIcon className="size-4.5 text-primary" />
            <span className="text-sm font-semibold tracking-tight">
              Query builder
            </span>
            {status === "ready" && (
              <SearchSelect
                className="w-80"
                ariaLabel="Table"
                placeholder="Search tables by name or number"
                items={tableItems}
                loading={!tables.length}
                value={query ? String(query.table) : null}
                onChange={(id) => void openTable(Number(id))}
              />
            )}
            {info && (
              <Hint label={`${info.app} ${info.version}`}>
                <span className="truncate text-xs text-muted-foreground">
                  {info.company}
                </span>
              </Hint>
            )}
            <div className="ml-auto flex items-center gap-1">
              {status === "ready" && (
                <Button
                  size="sm"
                  onClick={() => void run()}
                  disabled={running || !query || loadingFields}
                  title="Run (Ctrl+Enter)"
                >
                  {running ? (
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                  Run
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                title="Close (Esc)"
                aria-label="Close"
                onClick={onClose}
              >
                <XIcon />
              </Button>
            </div>
            <span
              aria-hidden
              className="absolute inset-x-0 -bottom-px h-0.5"
              style={{ background: "var(--brand-gradient)" }}
            />
          </div>

          {status === "connecting" ? (
            <p className="flex items-center gap-2 p-6 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" /> Looking for the
              Dynamic Assist Companion app…
            </p>
          ) : status === "missing" ? (
            <CompanionMissing />
          ) : status === "denied" ? (
            <NoAccess message={denied} />
          ) : (
            <>
              {!readable && (
                <div className="border-b bg-sandbox px-4 py-1.5 text-xs text-sandbox-foreground">
                  You don't have permission to read this table, so a query will
                  fail.
                </div>
              )}
              <div className="flex min-h-0 flex-1">
                <div className="flex w-[420px] shrink-0 flex-col gap-4 overflow-y-auto border-r p-4">
                  {loadingFields || !query ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2Icon className="size-3.5 animate-spin" /> Loading
                      fields…
                    </p>
                  ) : (
                    <>
                      <Section icon={<TableIcon />} title="Columns">
                        <ColumnsEditor
                          fields={fields}
                          columns={query.fields}
                          onChange={(f) => setQuery({ ...query, fields: f })}
                        />
                      </Section>
                      <Section icon={<FilterIcon />} title="Filters">
                        <FilterModeSwitch
                          mode={filterMode}
                          onChange={changeFilterMode}
                        />
                        <FiltersEditor
                          fields={fields}
                          filters={query.filters}
                          mode={filterMode}
                          onChange={(filters) =>
                            setQuery({ ...query, filters })
                          }
                        />
                      </Section>
                      <Section icon={<LinkIcon />} title="Related tables">
                        <JoinsEditor
                          fields={fields}
                          tables={tables}
                          related={related}
                          joins={query.joins ?? []}
                          filterMode={filterMode}
                          onLoad={loadRelated}
                          onChange={(joins) => setQuery({ ...query, joins })}
                        />
                      </Section>
                      <Section icon={<ListOrderedIcon />} title="Sort">
                        <SortEditor
                          fields={fields}
                          query={query}
                          onChange={setQuery}
                        />
                      </Section>
                      <Section icon={<SettingsIcon />} title="Options">
                        <OptionsEditor
                          query={query}
                          maxRows={info?.maxRows ?? 10000}
                          onChange={setQuery}
                        />
                      </Section>
                    </>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <ResultsPane
                    sources={sources}
                    onLoadMore={
                      lastRun?.next ? () => void loadMore() : undefined
                    }
                    loadingMore={loadingMore}
                    results={results}
                    error={error}
                    running={running}
                    name={(table?.name ?? "query").replace(/[^\w-]+/g, "-")}
                    hint="Pick columns and filters, then press Run (Ctrl+Enter). Filters use Business Central's syntax: 10000..20000, A*|B*, <>''."
                  />
                  {lastRun?.count !== undefined && (
                    <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                      {lastRun.count.toLocaleString()} record
                      {lastRun.count === 1 ? "" : "s"} match in all
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipPortalContainer.Provider>
  )
}

const list = (items: string[]) =>
  items.map((f, i) => (
    <React.Fragment key={f}>
      {i > 0 && ", "}
      <code>{f}</code>
    </React.Fragment>
  ))

/**
 * The query as a REST request. Picks an API that's already installed when one
 * covers the query (no deployment), else the custom API query on the AL tab.
 */
function ApiEndpoint({
  plans,
  plan,
  onPick,
  companyKnown,
  customInQuery,
}: {
  plans: RequestPlan[]
  plan: RequestPlan
  onPick: (key: string) => void
  companyKnown: boolean
  customInQuery: string[]
}) {
  const standard = plans.filter((p) => p.kind === "standard")
  return (
    <div className="flex flex-col gap-2.5 p-4 text-xs">
      {/* Where it would run */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-muted-foreground">Endpoint</span>
        {plans.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPick(p.key)}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-0.5",
              p.key === plan.key
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.kind === "standard" && (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  p.ready ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
            )}
            {p.label}
          </button>
        ))}
      </div>

      <Verdict
        plan={plan}
        hasStandard={standard.length > 0}
        customInQuery={customInQuery}
      />

      <div className="flex items-start gap-2">
        <span className="mt-px rounded bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
          {plan.method ?? "GET"}
        </span>
        <code className="min-w-0 flex-1 break-all">{plan.url}</code>
      </div>
      {plan.options.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-md border bg-background px-3 py-2">
          {plan.options.map(([key, value]) => (
            <React.Fragment key={key}>
              <dt className="font-mono font-semibold text-primary">{key}</dt>
              <dd className="min-w-0 font-mono break-all">{value}</dd>
              <CopyButton value={value} what={key} />
            </React.Fragment>
          ))}
        </dl>
      )}
      {plan.request && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {plan.body ? "Body" : "The query"}
            </span>
            <span className="text-muted-foreground">
              {plan.body ? (
                <>
                  the query goes in <code>request</code>, as JSON text
                </>
              ) : (
                <>
                  sent in <code>$filter=request eq '…'</code> (up to 2,048
                  characters)
                </>
              )}
            </span>
            <span className="ml-auto">
              <CopyButton
                value={plan.body ?? JSON.stringify(plan.request)}
                what={plan.body ? "request body" : "query"}
              />
            </span>
          </div>
          <pre className="rounded-md border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {JSON.stringify(plan.request, null, 2)}
          </pre>
        </div>
      )}
      <p className="leading-relaxed text-muted-foreground">
        Send it with a Microsoft Entra token (
        <code>Authorization: Bearer …</code>).
        {plan.key !== "companion" && !companyKnown && (
          <>
            {" "}
            Replace <code>{"{companyId}"}</code> with the ID from{" "}
            <code>…/api/v2.0/companies</code> (or update the companion app,
            which fills it in).
          </>
        )}
      </p>
    </div>
  )
}

/** Whether the picked endpoint runs this query as is, and what's missing. */
function Verdict({
  plan,
  hasStandard,
  customInQuery,
}: {
  plan: RequestPlan
  hasStandard: boolean
  customInQuery: string[]
}) {
  const box = (tone: "ok" | "warn", children: React.ReactNode) => (
    <div
      className={cn(
        "rounded-md border px-3 py-2 leading-relaxed",
        tone === "ok"
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-amber-500/40 bg-amber-500/10"
      )}
    >
      {children}
    </div>
  )
  if (plan.kind === "companion")
    return box(
      "ok",
      <>
        <b>One endpoint for any query.</b> The Dynamic Assist Companion runs
        this exact query (joins and Business Central filters included) as the
        caller, read-only. An admin turns it on once on the <b>Web Services</b>{" "}
        page: Object Type <code>Codeunit</code>, Object ID <code>77502</code>,
        Service Name <code>DAQuery</code>. Tables and fields go by name; a wrong
        one comes back as an error.{" "}
        {plan.method === "GET" ? (
          <>
            Each row comes back as an entity whose <code>data</code> is the
            record as JSON text.
          </>
        ) : (
          <>
            The answer's <code>value</code> is the result as JSON text.
          </>
        )}
      </>
    )
  if (plan.kind === "custom")
    return box(
      "warn",
      <>
        <b>Needs a custom API.</b>{" "}
        {hasStandard
          ? "The installed APIs for this table don't cover this query. "
          : "No API is installed for this table. "}
        Add the API query from the AL tab to your own extension and publish it
        once.
        {customInQuery.length > 0 && (
          <>
            {" "}
            OData can't express {list(customInQuery)}, so that query applies{" "}
            {customInQuery.length === 1 ? "it" : "them"} itself.
          </>
        )}
      </>
    )
  if (plan.ready)
    return box(
      "ok",
      <>
        <b>Out of the box.</b> This API is already installed and covers the
        query: nothing to deploy.
      </>
    )
  return box(
    "warn",
    <>
      <b>Close, but not exact.</b>
      {plan.missing.length > 0 && (
        <> It doesn't return {list(plan.missing)}; they're left out.</>
      )}
      {plan.unfiltered.length > 0 && (
        <> It can't apply {list(plan.unfiltered)}, so it returns more rows.</>
      )}
      {plan.view && (
        <>
          {" "}
          It only returns rows matching its own view <code>{plan.view}</code>.
        </>
      )}{" "}
      Pick <b>Custom API query</b> for the exact query.
    </>
  )
}

/** The user doesn't have the DA QUERY permission set. */
function NoAccess({ message }: { message: string | null }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-xs">
        <LockIcon className="size-7 text-destructive" />
        <h2 className="text-sm font-semibold">
          You don't have permission to query
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Dynamic Assist Query needs the <b>DA QUERY</b> permission set (or DA
          QUERY ADMIN). Ask your system administrator to assign it to you, then
          open the query builder again.
        </p>
        {message && (
          <p className="rounded-md bg-muted px-3 py-2 text-left font-mono text-[11px] text-muted-foreground">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

function CompanionMissing() {
  const openPage = () => {
    const ctx = parseBcUrl(window.location.href)
    window.location.href = buildBcUrl(ctx, { page: BRIDGE_PAGE_ID })
  }
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-xs">
        <PackageOpenIcon className="size-7 text-primary" />
        <h2 className="text-sm font-semibold">
          Querying Business Central needs the companion app
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Business Central has no API for reading any table, so the query
          builder talks to a small extension, <b>Dynamic Assist Companion</b>,
          through its <b>Dynamic Assist Query</b> page. It's read-only and runs
          as you: you only see what your permissions allow.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          If it's installed, open the page and the query builder opens over it.
          If Business Central says the page doesn't exist, install the app
          first.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={openPage}>
            <DatabaseIcon data-icon="inline-start" />
            Open the query page
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(COMPANION_HELP_URL, "_blank")}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            How to install
          </Button>
        </div>
      </div>
    </div>
  )
}

const fieldItems = (fields: BcField[], exclude: number[] = []) =>
  fields
    .filter((f) => !exclude.includes(f.no))
    .map((f) => ({
      value: String(f.no),
      label: f.caption || f.name,
      hint: `${f.no} · ${f.type}${f.class === "Normal" ? "" : ` · ${f.class}`}`,
    }))

function ColumnsEditor({
  fields,
  columns,
  onChange,
}: {
  fields: BcField[]
  columns: number[]
  onChange: (columns: number[]) => void
}) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const allPlain = fields.filter(isPlain).map((f) => f.no)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {columns.length === 0 && (
          <span className="rounded-md border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground">
            Primary key
          </span>
        )}
        {columns.map((no) => {
          const f = byNo.get(no)
          return (
            <Hint label={`${f?.name ?? no} (${no})`}>
              <span
                key={no}
                className={cn(
                  "flex items-center gap-1 rounded-md border bg-accent py-0.5 pr-0.5 pl-1.5 text-[11px] text-accent-foreground",
                  f?.class === "FlowField" && "border-dashed"
                )}
              >
                {f?.caption ?? no}
                <button
                  type="button"
                  aria-label={`Remove ${f?.caption ?? no}`}
                  className="rounded p-0.5 hover:bg-background/60"
                  onClick={() => onChange(columns.filter((x) => x !== no))}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            </Hint>
          )
        })}
      </div>
      <SearchSelect
        ariaLabel="Add column"
        placeholder="Add a field"
        items={fieldItems(fields, columns)}
        value={null}
        onChange={(no) => onChange([...columns, Number(no)])}
      />
      <div className="flex flex-wrap gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => onChange(allPlain)}
          className="rounded border border-dashed px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
        >
          All fields ({allPlain.length})
        </button>
        <button
          type="button"
          onClick={() => onChange(fields.filter((f) => f.pk).map((f) => f.no))}
          className="rounded border border-dashed px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
        >
          Key only
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        FlowFields (dashed) are calculated per row, so they slow a query down.
      </p>
    </div>
  )
}

/** A placeholder in Business Central's filter syntax, for the field's type. */
function filterHint(f: BcField | undefined) {
  switch (f?.type) {
    case "Integer":
    case "BigInteger":
    case "Decimal":
      return "100..500, >0, <>0"
    case "Date":
      return "2026-01-01..2026-12-31, t, ''"
    case "DateTime":
      return "2026-01-01..t"
    case "Boolean":
      return "Yes / No"
    case "Option":
      return f.options?.slice(0, 3).join("|") ?? ""
    default:
      return "10000..20000, A*|B*, <>''"
  }
}

/** How filters are written: as conditions (field, operator, value) or BC syntax */
export type FilterMode = "conditions" | "bc"

type FilterRow = BcQuery["filters"][number]

const inputClass =
  "h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"

/** The switch between conditions and BC syntax */
function FilterModeSwitch({
  mode,
  onChange,
}: {
  mode: FilterMode
  onChange: (mode: FilterMode) => void
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      Filter with
      <div className="flex rounded-md bg-muted p-0.5">
        {(
          [
            ["conditions", "Conditions"],
            ["bc", "BC syntax"],
          ] as const
        ).map(([value, label]) => (
          <Hint
            label={
              value === "conditions"
                ? "Pick an operator: equals, contains, between…"
                : "Write Business Central filters: 10000..20000, A*|B*, <>''"
            }
          >
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={cn(
                "rounded px-2 py-0.5 font-medium",
                mode === value
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              )}
            >
              {label}
            </button>
          </Hint>
        ))}
      </div>
    </div>
  )
}

/** The condition a row holds: set by the row, or read from its BC filter */
function conditionOf(row: FilterRow, type: string): Condition | null {
  if (row.op)
    return { op: row.op, value: row.value ?? "", value2: row.value2 ?? "" }
  if (!(row.filter ?? "").trim())
    return { op: operatorsFor(type)[0].value, value: "", value2: "" }
  return fromBcFilter(row.filter, type)
}

/** The value inputs a condition needs, for the field's type */
function ConditionValues({
  field,
  condition,
  listId,
  onChange,
}: {
  field: BcField
  condition: Condition
  listId: string
  onChange: (c: Condition) => void
}) {
  const kind = kindOf(field.type)
  const n = arity(condition.op)
  if (n === 0) return null
  const set = (patch: Partial<Condition>) =>
    onChange({ ...condition, ...patch })
  const many = condition.op === "in" || condition.op === "notIn"

  if (kind === "boolean")
    return (
      <PlainSelect
        ariaLabel="Value"
        className="flex-1"
        value={condition.value}
        onChange={(value) => set({ value })}
        options={[
          { value: "", label: "Choose…" },
          { value: "Yes", label: "Yes" },
          { value: "No", label: "No" },
        ]}
      />
    )
  if (kind === "option" && !many)
    return (
      <PlainSelect
        ariaLabel="Value"
        className="flex-1"
        value={condition.value}
        onChange={(value) => set({ value })}
        options={[
          { value: "", label: "(blank)" },
          ...(field.options ?? []).map((o) => ({ value: o, label: o })),
        ]}
      />
    )

  const inputType = kind === "date" && !many ? "date" : "text"
  const placeholder = many
    ? kind === "option"
      ? (field.options ?? []).slice(0, 2).join(", ")
      : "A, B, C"
    : kind === "number"
      ? "0"
      : ""
  const one = (value: string, key: "value" | "value2", label: string) => (
    <input
      aria-label={label}
      type={inputType}
      inputMode={kind === "number" ? "decimal" : undefined}
      list={kind === "option" && many ? listId : undefined}
      placeholder={placeholder}
      value={value}
      onChange={(e) => set({ [key]: e.target.value })}
      className={inputClass}
    />
  )
  return (
    <>
      {one(condition.value, "value", n === 2 ? "From" : "Value")}
      {n === 2 && (
        <>
          <span className="text-[11px] text-muted-foreground">and</span>
          {one(condition.value2, "value2", "To")}
        </>
      )}
      {kind === "option" && many && (
        <datalist id={listId}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  )
}

function FiltersEditor({
  fields,
  filters,
  onChange,
  mode,
  idPrefix = "da-options",
}: {
  fields: BcField[]
  filters: BcQuery["filters"]
  onChange: (filters: BcQuery["filters"]) => void
  mode: FilterMode
  /** Keeps option lists apart when there are several editors */
  idPrefix?: string
}) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const items = fieldItems(fields)
  const firstField = fields.find((f) => f.pk)?.no ?? fields[0]?.no ?? 1
  const update = (i: number, row: FilterRow) =>
    onChange(filters.map((x, j) => (j === i ? row : x)))

  return (
    <div className="flex flex-col gap-1.5">
      {filters.map((flt, i) => {
        const f = byNo.get(flt.field)
        const listId = `${idPrefix}-${i}`
        const condition =
          mode === "conditions" && f ? conditionOf(flt, f.type) : null
        // A filter no condition can express stays as BC syntax
        const raw = mode === "bc" || !f || !condition
        const remove = (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Remove filter"
            onClick={() => onChange(filters.filter((_, j) => j !== i))}
          >
            <XIcon />
          </Button>
        )
        const fieldPicker = (
          <SearchSelect
            className="w-40 shrink-0"
            ariaLabel="Filter field"
            items={items}
            value={String(flt.field)}
            onChange={(no) => update(i, { field: Number(no), filter: "" })}
          />
        )

        if (raw)
          return (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                {fieldPicker}
                <input
                  aria-label="Filter"
                  list={f?.options ? listId : undefined}
                  placeholder={filterHint(f)}
                  value={flt.filter}
                  onChange={(e) =>
                    update(i, { field: flt.field, filter: e.target.value })
                  }
                  className={cn(inputClass, "font-mono")}
                />
                {f?.options && (
                  <datalist id={listId}>
                    {f.options.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
                {remove}
              </div>
              {mode === "conditions" && (
                <p className="pl-1 text-[10px] text-muted-foreground">
                  BC syntax: no condition says exactly this, so it stays as
                  written.
                </p>
              )}
            </div>
          )

        const set = (next: Condition) => {
          // Only operators that fit the field (a stale one starts again)
          const c = operatorsFor(f.type).some((o) => o.value === next.op)
            ? next
            : { ...next, op: operatorsFor(f.type)[0].value }
          update(i, {
            field: flt.field,
            filter: toBcFilter(c, f.type),
            op: c.op,
            value: c.value,
            value2: c.value2,
          })
        }
        return (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-md border border-dashed p-1.5"
          >
            <div className="flex items-center gap-1">
              {fieldPicker}
              <PlainSelect
                ariaLabel="Operator"
                className="min-w-0 flex-1"
                value={condition.op}
                onChange={(op) =>
                  set({ ...condition, op: op as Condition["op"] })
                }
                options={operatorsFor(f.type)}
              />
              {remove}
            </div>
            {arity(condition.op) > 0 && (
              <div className="flex items-center gap-1">
                <ConditionValues
                  field={f}
                  condition={condition}
                  listId={listId}
                  onChange={set}
                />
              </div>
            )}
            <p className="pl-1 font-mono text-[10px] text-muted-foreground">
              {flt.filter ? `= ${flt.filter}` : "Incomplete: left out"}
            </p>
          </div>
        )
      })}
      <Button
        variant="ghost"
        size="xs"
        className="self-start"
        onClick={() =>
          onChange([...filters, { field: firstField, filter: "" }])
        }
      >
        <PlusIcon data-icon="inline-start" />
        Filter
      </Button>
    </div>
  )
}

function SortEditor({
  fields,
  query,
  onChange,
}: {
  fields: BcField[]
  query: BcQuery
  onChange: (q: BcQuery) => void
}) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const sortable = fields.filter((f) => f.class === "Normal")
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {query.sort.length === 0 && (
          <span className="rounded-md border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground">
            Primary key
          </span>
        )}
        {query.sort.map((no) => (
          <span
            key={no}
            className="flex items-center gap-1 rounded-md border bg-accent py-0.5 pr-0.5 pl-1.5 text-[11px] text-accent-foreground"
          >
            {byNo.get(no)?.caption ?? no}
            <button
              type="button"
              aria-label="Remove sort field"
              className="rounded p-0.5 hover:bg-background/60"
              onClick={() =>
                onChange({ ...query, sort: query.sort.filter((x) => x !== no) })
              }
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <Button
          variant="outline"
          size="xs"
          className="ml-auto"
          onClick={() => onChange({ ...query, descending: !query.descending })}
        >
          {query.descending ? (
            <ArrowDownIcon data-icon="inline-start" />
          ) : (
            <ArrowUpIcon data-icon="inline-start" />
          )}
          {query.descending ? "Descending" : "Ascending"}
        </Button>
      </div>
      <SearchSelect
        ariaLabel="Add sort field"
        placeholder="Sort by a field"
        items={fieldItems(sortable, query.sort)}
        value={null}
        onChange={(no) =>
          onChange({ ...query, sort: [...query.sort, Number(no)] })
        }
      />
    </div>
  )
}

function OptionsEditor({
  query,
  maxRows,
  onChange,
}: {
  query: BcQuery
  maxRows: number
  onChange: (q: BcQuery) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <label className="flex items-center gap-1.5">
        Rows
        <input
          type="number"
          min={1}
          max={maxRows}
          placeholder={String(maxRows)}
          className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
          value={query.top ?? ""}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange({
              ...query,
              top: e.target.value && n > 0 ? Math.min(n, maxRows) : null,
            })
          }}
        />
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={!!query.count}
          onChange={(e) => onChange({ ...query, count: e.target.checked })}
        />
        Count all matches
      </label>
    </div>
  )
}

/**
 * Related tables: each joins through a lookup field on the main table
 * (Salesperson Code → Salesperson/Purchaser) and adds columns from it.
 */
function JoinsEditor({
  fields,
  tables,
  related,
  joins,
  filterMode,
  onLoad,
  onChange,
}: {
  fields: BcField[]
  tables: BcTable[]
  related: RelatedTables
  joins: BcJoin[]
  filterMode: FilterMode
  onLoad: (tableId: number) => Promise<RelatedTables[number]>
  onChange: (joins: BcJoin[]) => void
}) {
  const [problem, setProblem] = React.useState<string | null>(null)
  const tableName = (id: number) => {
    const t = tables.find((x) => x.id === id)
    return t?.caption || t?.name || `Table ${id}`
  }
  const lookups = fields.filter(
    (f) => f.relationTable && f.class === "Normal" && f.enabled
  )
  const items = lookups.map((f) => ({
    value: String(f.no),
    label: `${f.caption} → ${tableName(f.relationTable!)}`,
    hint: String(f.relationTable),
  }))
  const update = (i: number, change: Partial<BcJoin>) =>
    onChange(joins.map((j, k) => (k === i ? { ...j, ...change } : j)))

  const add = async (no: number) => {
    setProblem(null)
    const from = lookups.find((f) => f.no === no)
    if (!from?.relationTable) return
    try {
      const target = await onLoad(from.relationTable)
      const pk = target.fields.filter((f) => f.pk)
      const key = from.relationField ?? (pk.length === 1 ? pk[0].no : undefined)
      if (!key) {
        setProblem(
          `${target.caption} has a key of several fields, so ${from.caption} can't be joined to it on its own.`
        )
        return
      }
      // Start with a name or description, the columns people usually want
      const start = target.fields
        .filter(
          (f) =>
            !f.pk &&
            f.class === "Normal" &&
            /^(name|description|search name)$/i.test(f.name)
        )
        .slice(0, 1)
        .map((f) => f.no)
      const used = new Set(joins.map((j) => j.id))
      let id = `j${joins.length + 1}`
      for (let i = joins.length + 2; used.has(id); i++) id = `j${i}`
      onChange([
        ...joins,
        {
          id,
          field: no,
          table: from.relationTable,
          key,
          fields: start.length ? start : pk.map((f) => f.no),
          filters: [],
          inner: false,
        },
      ])
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {joins.map((j, i) => {
        const target = related[j.table]
        const from = fields.find((f) => f.no === j.field)
        return (
          <div
            key={j.id}
            className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2"
          >
            <div className="flex items-center gap-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium">
                {from?.caption ?? j.field} →{" "}
                {target?.caption ?? tableName(j.table)}
              </span>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={j.inner}
                  onChange={(e) => update(i, { inner: e.target.checked })}
                />
                Only with a match
              </label>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Remove related table"
                onClick={() => onChange(joins.filter((_, k) => k !== i))}
              >
                <XIcon />
              </Button>
            </div>
            {target ? (
              <>
                <ColumnsEditor
                  fields={target.fields}
                  columns={j.fields}
                  onChange={(cols) => update(i, { fields: cols })}
                />
                <FiltersEditor
                  fields={target.fields}
                  filters={j.filters}
                  mode={filterMode}
                  idPrefix={`da-options-${j.id}`}
                  onChange={(filters) => update(i, { filters })}
                />
              </>
            ) : (
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" /> Loading fields…
              </p>
            )}
          </div>
        )
      })}
      {joins.length < 5 && (
        <SearchSelect
          ariaLabel="Add related table"
          placeholder={
            lookups.length
              ? "Join a table through a lookup field"
              : "This table has no lookup fields"
          }
          items={items}
          value={null}
          onChange={(no) => void add(Number(no))}
        />
      )}
      {problem && <p className="text-[11px] text-destructive">{problem}</p>}
      {joins.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          A filter on a related table keeps only rows with a match there.
        </p>
      )}
    </div>
  )
}
