import * as React from "react"
import {
  DatabaseIcon,
  ExternalLinkIcon,
  LayoutListIcon,
  LinkIcon,
  RefreshCwIcon,
  ScrollTextIcon,
} from "lucide-react"

import { CollapsibleSection, Count } from "@/components/collapsible-section"
import { CopyButton } from "@/components/copy-button"
import { CopyJsonButton } from "@/components/copy-json-button"
import { Detail, DetailGrid } from "@/components/detail-grid"
import { FieldRow } from "@/components/field-row"
import { SearchBox } from "@/components/search-box"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/lib/copy"
import type { Act } from "@/lib/use-action"

import type { CeColumn, CeForm, CeState } from "../types"
import { ceUrls, FORM_TYPES } from "../urls"
import type { useCeTab } from "../use-ce-tab"
import { CeFieldList } from "./CeFieldList"

type Run = ReturnType<typeof useCeTab>["run"]

/** The open record: what it is, its form fields, and every column via the Web API. */
export function RecordView({
  state,
  run,
  act,
}: {
  state: CeState
  run: Run
  act: Act
}) {
  const form = state.form
  if (!form) return <PageContext state={state} />

  return (
    <div className="flex flex-col gap-3">
      <RecordSummary state={state} form={form} act={act} run={run} />
      <CollapsibleSection
        id="ce.fields"
        title="Form fields"
        icon={<LayoutListIcon />}
        summary={<Count>{form.fields.length}</Count>}
        actions={
          <CopyJsonButton
            data={() =>
              Object.fromEntries(
                form.fields.map((f) => [f.logicalName, parseRaw(f.raw)])
              )
            }
            what={`${form.fields.length} fields`}
          />
        }
      >
        <CeFieldList fields={form.fields} />
      </CollapsibleSection>
      {form.id && <AllColumns key={form.id} run={run} />}
    </div>
  )
}

function RecordSummary({
  state,
  form,
  act,
  run,
}: {
  state: CeState
  form: CeForm
  act: Act
  run: Run
}) {
  const copy = useCopy()
  const urls = ceUrls(state)
  const recordUrl = form.id ? urls.record(form.entityName, form.id) : null

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-6 items-center gap-1 rounded-md border bg-background pr-0.5 pl-1.5 text-xs">
          <span className="font-mono">{form.entityName}</span>
          <CopyButton
            value={form.entityName}
            what={`logical name ${form.entityName}`}
            className="size-5 [&_svg]:size-3"
          />
        </span>
        {form.objectTypeCode !== null && (
          <Badge
            variant="outline"
            className="font-mono"
            title="Object type code"
          >
            {form.objectTypeCode}
          </Badge>
        )}
        <Badge variant="secondary">
          {FORM_TYPES[form.formType] ?? form.formType}
        </Badge>
        {form.isDirty && <Badge>Unsaved</Badge>}
        <div className="ml-auto flex">
          {recordUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Copy record link"
              aria-label="Copy record link"
              onClick={() => copy(recordUrl, "record link")}
            >
              <LinkIcon />
            </Button>
          )}
          {form.id && form.entitySetName && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Open the record in the Web API"
              aria-label="Open the record in the Web API"
              onClick={() =>
                chrome.tabs.create({
                  url: urls.webApiRecord(form.entitySetName!, form.id!),
                })
              }
            >
              <DatabaseIcon />
            </Button>
          )}
          {recordUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Open in a new tab"
              aria-label="Open in a new tab"
              onClick={() => chrome.tabs.create({ url: recordUrl })}
            >
              <ExternalLinkIcon />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Refresh the form's data"
            aria-label="Refresh the form's data"
            onClick={() =>
              act("refresh", async () => {
                await run("refresh")
                return "Refreshed"
              })
            }
          >
            <RefreshCwIcon />
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="truncate text-base leading-tight font-semibold">
          {form.primaryName || (form.id ? "(no name)" : "New record")}
        </h2>
        <p className="truncate text-xs text-muted-foreground">
          {form.entityDisplayName ?? form.entityName}
        </p>
      </div>

      <DetailGrid>
        {form.id && (
          <Detail label="Record ID" value={form.id} copy={form.id} mono wide />
        )}
        {form.formName && (
          <Detail
            label="Form"
            value={form.formName}
            copy={form.formId ?? undefined}
            title={form.formId ?? undefined}
            wide
          />
        )}
        {form.entitySetName && (
          <Detail
            label="Entity set"
            value={form.entitySetName}
            copy={form.entitySetName}
            mono
          />
        )}
        {form.primaryIdAttribute && (
          <Detail
            label="Primary key"
            value={form.primaryIdAttribute}
            copy={form.primaryIdAttribute}
            mono
          />
        )}
        <Detail
          label="Tabs"
          value={`${form.tabs.filter((t) => t.visible).length} of ${form.tabs.length} visible`}
        />
      </DetailGrid>
    </section>
  )
}

/** Every column of the record from the Web API, including ones not on the form. */
function AllColumns({ run }: { run: Run }) {
  const [columns, setColumns] = React.useState<CeColumn[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setColumns(await run("allColumns"))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const q = query.trim().toLowerCase()
  const shown = (columns ?? []).filter(
    (c) =>
      !q ||
      `${c.name} ${c.value} ${c.formatted ?? ""}`.toLowerCase().includes(q)
  )

  return (
    <CollapsibleSection
      id="ce.allcolumns"
      title="All columns"
      icon={<ScrollTextIcon />}
      summary={columns && <Count>{columns.length}</Count>}
      actions={
        columns && (
          <CopyJsonButton
            data={() =>
              Object.fromEntries(columns.map((c) => [c.name, c.value]))
            }
            what={`${columns.length} columns`}
          />
        )
      }
      defaultCollapsed
    >
      {!columns ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center text-xs text-muted-foreground">
          Every column of this record from the Web API, including ones the form
          doesn't show.
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <DatabaseIcon data-icon="inline-start" />
            {loading ? "Loading…" : "Load columns"}
          </Button>
          {error && <span className="text-destructive">{error}</span>}
        </div>
      ) : (
        <>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search column or value"
          />
          <div className="-mx-1 flex flex-col">
            {shown.map((c) => (
              <FieldRow
                key={c.name}
                label={c.name}
                value={c.formatted ?? c.value}
                name={c.name}
                nameWhat="column name"
                formats={[
                  { label: "Raw value", value: c.value },
                  { label: "Formatted value", value: c.formatted ?? "" },
                  { label: "Name and value", value: `${c.name}: ${c.value}` },
                ]}
                details={[
                  { label: "Column", value: c.name },
                  { label: "Raw", value: c.value || "—", long: true },
                  ...(c.formatted
                    ? [{ label: "Formatted", value: c.formatted, long: true }]
                    : []),
                ]}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            className="self-start text-[11px] text-primary hover:underline"
          >
            Load again
          </button>
        </>
      )}
    </CollapsibleSection>
  )
}

/** Not on a form: say what page this is. */
function PageContext({ state }: { state: CeState }) {
  const p = state.page
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary">{p.pageType ?? "Unknown page"}</Badge>
        {p.entityName && (
          <Badge variant="outline" className="font-mono">
            {p.entityName}
          </Badge>
        )}
      </div>
      <DetailGrid>
        {p.entityName && (
          <Detail
            label="Entity"
            value={p.entityName}
            copy={p.entityName}
            mono
          />
        )}
        {p.viewId && (
          <Detail label="View ID" value={p.viewId} copy={p.viewId} mono wide />
        )}
      </DetailGrid>
      <p className="text-xs text-muted-foreground">
        Open a record to see its fields. List tools are under Tools.
      </p>
    </section>
  )
}

/** The form value as JSON-native data: numbers, booleans, lookup arrays, ISO dates. */
function parseRaw(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return raw
  }
}
