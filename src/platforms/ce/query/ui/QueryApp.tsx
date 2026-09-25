import * as React from "react"
import { TooltipPortalContainer } from "@/components/ui/tooltip"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CodeXmlIcon,
  DatabaseIcon,
  FilterIcon,
  ListOrderedIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  TableIcon,
  WrenchIcon,
  XIcon,
  MinusIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

import type { QueryBuilderField } from "../lib/types"
import { loadFields, loadTables, type TableInfo } from "../metadata"
import {
  entityOf,
  fromFetchXml,
  newQuery,
  toFetchXml,
  type Query,
} from "../query"
import { entitySetOf, runFetchXmlLimited, type Results } from "../run"
import { FilterEditor } from "./FilterEditor"
import { DEFAULT_ROWS, MAX_ROWS, parseRows } from "@/query-builder/limits"
import { ResultsPane, Section } from "@/query-builder/ResultsPane"
import { SavedQueries } from "@/query-builder/SavedQueries"
import { SearchSelect, type SelectItem } from "@/query-builder/SearchSelect"
import { Hint } from "@/components/hint"

export type OpenRequest = {
  entityName?: string | null
  fetchXml?: string | null
  /** Run it once it's loaded (a saved or example query from the panel) */
  run?: boolean
}

type Mode = "builder" | "fetchxml"

/** The query builder, as a large modal over the Dynamics page. */
export function QueryApp({
  request,
  dark,
  onClose,
  onMinimize,
  onTitle,
}: {
  request: OpenRequest & { seq: number }
  dark: boolean
  onClose: () => void
  /** Down to a tile at the bottom of the page, to come back to */
  onMinimize?: () => void
  /** What its tile says while minimised */
  onTitle?: (title: string) => void
}) {
  // Tooltips render inside the builder's shadow root, in its styles and theme
  const [rootEl, setRootEl] = React.useState<HTMLDivElement | null>(null)
  const [tables, setTables] = React.useState<TableInfo[]>([])
  const [fields, setFields] = React.useState<QueryBuilderField[]>([])
  const [loadingFields, setLoadingFields] = React.useState(true)
  const [query, setQuery] = React.useState<Query | null>(null)
  const [mode, setMode] = React.useState<Mode>("builder")
  const [xmlText, setXmlText] = React.useState("")
  const [notice, setNotice] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<Results | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  // Each run's number: only the latest run's rows show
  const runId = React.useRef(0)
  React.useEffect(() => () => void runId.current++, [])

  React.useEffect(() => {
    loadTables()
      .then(setTables)
      .catch((e) => setError(String(e?.message ?? e)))
  }, [])

  /**
   * Load a table, keeping a query read from FetchXML if there is one. State is
   * only set once the fields are in; switchTable clears the old table first.
   */
  const openTable = React.useCallback(
    (entityName: string, fromXml?: string) =>
      loadFields(entityName)
        .then((loaded) => {
          setFields(loaded)
          if (fromXml) {
            const parsed = fromFetchXml(fromXml, loaded)
            setQuery(parsed.query ?? newQuery(entityName))
            setNotice(
              [parsed.error, ...parsed.warnings].filter(Boolean).join(" ") ||
                null
            )
            setXmlText(fromXml)
            // Aggregates and linked columns only survive in the FetchXML itself
            setMode(parsed.warnings.length ? "fetchxml" : "builder")
          } else {
            setQuery(newQuery(entityName))
            setMode("builder")
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoadingFields(false)),
    []
  )

  const switchTable = (entityName: string, fromXml?: string) => {
    setLoadingFields(true)
    setError(null)
    setNotice(null)
    setResults(null)
    void openTable(entityName, fromXml)
  }

  // Each open request (from the panel) starts from what it carries; the
  // component is keyed per request, so its state starts clean
  const fromXml = request.fetchXml ?? undefined
  const startEntity =
    (fromXml && entityOf(fromXml)) || request.entityName || "account"
  React.useEffect(() => {
    void openTable(startEntity, fromXml)
  }, [startEntity, fromXml, openTable])

  const builtXml = React.useMemo(
    () => (query && fields.length ? toFetchXml(query, fields) : ""),
    [query, fields]
  )
  const xml = mode === "fetchxml" ? xmlText : builtXml
  const table = tables.find((t) => t.logicalName === query?.entityName)

  const run = React.useCallback(async () => {
    if (!xml.trim()) return
    const id = ++runId.current
    const current = () => runId.current === id
    setRunning(true)
    setError(null)
    try {
      const entity = entityOf(xml)
      if (!entity) throw new Error("The FetchXML has no <entity name=…>.")
      const set =
        tables.find((t) => t.logicalName === entity)?.entitySetName ??
        (await entitySetOf(entity))
      const results = await runFetchXmlLimited(
        xml,
        set,
        fields,
        query?.columns ?? []
      )
      if (current()) setResults(results)
    } catch (e) {
      if (!current()) return
      setResults(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (current()) setRunning(false)
    }
  }, [xml, tables, fields, query])

  // Asked to run on open: once, when the starting query has loaded
  const runOnOpen = React.useRef(request.run === true)
  React.useEffect(() => {
    if (!runOnOpen.current || loadingFields || !xml.trim()) return
    runOnOpen.current = false
    void run()
  }, [loadingFields, xml, run])

  const switchMode = (next: Mode) => {
    if (next === mode) return
    if (next === "fetchxml") {
      setXmlText(builtXml)
    } else {
      // Back to the builder: read the edited FetchXML into it
      const entity = entityOf(xmlText)
      if (entity && entity !== query?.entityName) {
        switchTable(entity, xmlText)
        return
      }
      const parsed = fromFetchXml(xmlText, fields)
      if (!parsed.query) {
        setNotice(parsed.error)
        return
      }
      setQuery(parsed.query)
      setNotice(
        [parsed.error, ...parsed.warnings].filter(Boolean).join(" ") || null
      )
    }
    setMode(next)
  }

  const tableItems = React.useMemo<SelectItem[]>(
    () =>
      tables.map((t) => ({
        value: t.logicalName,
        label: t.displayName,
        hint: t.logicalName,
      })),
    [tables]
  )

  // The tile's title while minimised: the table, and what the last run found
  const tileTitle = [
    table?.displayName ?? query?.entityName,
    results &&
      `${results.rows.length}${results.more ? "+" : ""} ${results.rows.length === 1 && !results.more ? "row" : "rows"}`,
  ]
    .filter(Boolean)
    .join(" · ")
  React.useEffect(() => {
    if (tileTitle) onTitle?.(tileTitle)
  }, [tileTitle, onTitle])

  return (
    <TooltipPortalContainer.Provider value={rootEl}>
      <div
        ref={setRootEl}
        className={cn("da-root", dark && "dark")}
        data-platform="ce"
        onKeyDown={(e) => {
          // Esc minimises: a query isn't lost to a stray key
          if (e.key === "Escape") (onMinimize ?? onClose)()
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
            <SearchSelect
              className="w-72"
              ariaLabel="Table"
              placeholder="Search tables"
              items={tableItems}
              loading={!tables.length}
              value={query?.entityName ?? null}
              onChange={(entity) => switchTable(entity)}
            />
            <div className="flex rounded-md bg-muted p-0.5">
              {(["builder", "fetchxml"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
                    mode === m
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "builder" ? (
                    <WrenchIcon className="size-3.5" />
                  ) : (
                    <CodeXmlIcon className="size-3.5" />
                  )}
                  {m === "builder" ? "Builder" : "FetchXML"}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <SavedQueries
                platform="ce"
                current={() =>
                  query && xml.trim()
                    ? {
                        platform: "ce",
                        fetchXml: xml,
                        table: table?.displayName ?? query.entityName,
                        where: location.host,
                      }
                    : null
                }
                onLoad={(saved) => {
                  if (saved.platform !== "ce") return
                  const entity = entityOf(saved.fetchXml)
                  if (!entity) return setError("That saved query has no table.")
                  switchTable(entity, saved.fetchXml)
                }}
              />
              <Button
                size="sm"
                onClick={() => void run()}
                disabled={running || !xml.trim()}
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
              {onMinimize && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Minimise (Esc): keep it as a tile at the bottom of the page"
                  aria-label="Minimise"
                  onClick={onMinimize}
                >
                  <MinusIcon />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                title="Close"
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

          {notice && (
            <div className="border-b bg-sandbox px-4 py-1.5 text-xs text-sandbox-foreground">
              {notice}
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            {/* Left: the query */}
            <div className="flex w-[420px] shrink-0 flex-col border-r">
              {mode === "builder" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                  {loadingFields || !query ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2Icon className="size-3.5 animate-spin" /> Loading
                      columns…
                    </p>
                  ) : (
                    <>
                      <Section icon={<TableIcon />} title="Columns">
                        <ColumnsEditor
                          fields={fields}
                          table={table}
                          columns={query.columns}
                          onChange={(columns) =>
                            setQuery({ ...query, columns })
                          }
                        />
                      </Section>
                      <Section icon={<FilterIcon />} title="Filters">
                        <FilterEditor
                          fields={fields}
                          defaultFieldId={table?.primaryNameAttribute}
                          state={query.filters}
                          onChange={(filters) =>
                            setQuery({ ...query, filters })
                          }
                        />
                      </Section>
                      <Section icon={<ListOrderedIcon />} title="Sort">
                        <SortEditor
                          fields={fields}
                          defaultFieldId={table?.primaryNameAttribute}
                          query={query}
                          onChange={setQuery}
                        />
                      </Section>
                      <Section icon={<SettingsIcon />} title="Options">
                        <OptionsEditor query={query} onChange={setQuery} />
                      </Section>
                    </>
                  )}
                </div>
              ) : (
                <textarea
                  aria-label="FetchXML"
                  spellCheck={false}
                  value={xmlText}
                  onChange={(e) => setXmlText(e.target.value)}
                  className="min-h-0 flex-1 resize-none bg-muted/30 p-4 font-mono text-xs leading-relaxed outline-none"
                />
              )}
            </div>

            {/* Right: results */}
            <ResultsPane
              sources={[{ label: "FetchXML", text: xml }]}
              results={results}
              error={error}
              running={running}
              name={query?.entityName ?? "query"}
            />
          </div>
        </div>
      </div>
    </TooltipPortalContainer.Provider>
  )
}

function ColumnsEditor({
  fields,
  table,
  columns,
  onChange,
}: {
  fields: QueryBuilderField[]
  table: TableInfo | undefined
  columns: string[]
  onChange: (columns: string[]) => void
}) {
  const labelOf = new Map(fields.map((f) => [f.id, f.label]))
  const items = fields
    .filter((f) => !columns.includes(f.id))
    .map((f) => ({ value: f.id, label: f.label, hint: f.id }))
  const suggestions = [table?.primaryNameAttribute, "createdon", "modifiedon"]
    .filter((c): c is string => !!c && !columns.includes(c) && labelOf.has(c))
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {columns.length === 0 && (
          <span className="rounded-md border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground">
            All columns
          </span>
        )}
        {columns.map((c) => (
          <Hint label={c}>
            <span
              key={c}
              className="flex items-center gap-1 rounded-md border bg-accent py-0.5 pr-0.5 pl-1.5 text-[11px] text-accent-foreground"
            >
              {labelOf.get(c) ?? c}
              <button
                type="button"
                aria-label={`Remove ${c}`}
                className="rounded p-0.5 hover:bg-background/60"
                onClick={() => onChange(columns.filter((x) => x !== c))}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          </Hint>
        ))}
      </div>
      <SearchSelect
        ariaLabel="Add column"
        placeholder="Add a column"
        items={items}
        value={null}
        onChange={(c) => onChange([...columns, c])}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange([...columns, c])}
              className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              + {labelOf.get(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SortEditor({
  fields,
  defaultFieldId,
  query,
  onChange,
}: {
  fields: QueryBuilderField[]
  defaultFieldId?: string | null
  query: Query
  onChange: (q: Query) => void
}) {
  const items = fields.map((f) => ({ value: f.id, label: f.label, hint: f.id }))
  const set = (orders: Query["orders"]) => onChange({ ...query, orders })

  return (
    <div className="flex flex-col gap-1.5">
      {query.orders.map((o, i) => (
        <div key={i} className="flex items-center gap-1">
          <SearchSelect
            className="flex-1"
            ariaLabel="Sort column"
            items={items}
            value={o.attribute}
            onChange={(attribute) =>
              set(
                query.orders.map((x, j) => (j === i ? { ...x, attribute } : x))
              )
            }
          />
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              set(
                query.orders.map((x, j) =>
                  j === i ? { ...x, descending: !x.descending } : x
                )
              )
            }
          >
            {o.descending ? (
              <ArrowDownIcon data-icon="inline-start" />
            ) : (
              <ArrowUpIcon data-icon="inline-start" />
            )}
            {o.descending ? "Desc" : "Asc"}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Remove sort"
            onClick={() => set(query.orders.filter((_, j) => j !== i))}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="xs"
        className="self-start"
        onClick={() =>
          set([
            ...query.orders,
            {
              attribute:
                fields.find((f) => f.id === defaultFieldId)?.id ??
                fields[0]?.id ??
                "",
              descending: false,
            },
          ])
        }
      >
        <PlusIcon data-icon="inline-start" />
        Sort by
      </Button>
    </div>
  )
}

function OptionsEditor({
  query,
  onChange,
}: {
  query: Query
  onChange: (q: Query) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <label className="flex items-center gap-1.5">
        Rows
        <input
          type="number"
          min={1}
          max={MAX_ROWS}
          placeholder={String(DEFAULT_ROWS)}
          title={`Up to ${MAX_ROWS.toLocaleString()}; empty means ${DEFAULT_ROWS}`}
          className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
          value={query.top ?? ""}
          onChange={(e) =>
            onChange({ ...query, top: parseRows(e.target.value) })
          }
        />
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={query.distinct}
          onChange={(e) => onChange({ ...query, distinct: e.target.checked })}
        />
        Distinct rows
      </label>
    </div>
  )
}

/** A tab beside the results showing the query as text, with a copy button. */
