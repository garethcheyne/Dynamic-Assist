import * as React from "react"
import { DatabaseIcon, ListIcon } from "lucide-react"

import { CollapsibleSection, Count } from "@/components/collapsible-section"
import { CopyJsonButton } from "@/components/copy-json-button"
import { FieldGroup, FieldRow } from "@/components/field-row"
import { SearchBox } from "@/components/search-box"
import { Button } from "@/components/ui/button"
import { groupBy } from "@/lib/group-by"

import type { CeField, CeOptionSetColumn } from "../types"
import type { useCeTab } from "../use-ce-tab"
import { selectedValues } from "../option-sets"
import { OptionList } from "./OptionList"

type Run = ReturnType<typeof useCeTab>["run"]

const KIND_ORDER: CeOptionSetColumn["kind"][] = [
  "Choice",
  "Choices",
  "Status",
  "Status reason",
  "Yes/No",
]

/**
 * Every choice column on the table with its options, from the table's
 * metadata: columns the form doesn't show too. On a form, the record's
 * current choice is marked.
 */
export function OptionSetsSection({
  run,
  entityName,
  fields,
  reveal = 0,
}: {
  run: Run
  entityName: string
  /** The form's fields, to mark current values; null off a form */
  fields: CeField[] | null
  /** Bumped by the Option sets tile: open, load and scroll here */
  reveal?: number
}) {
  const [columns, setColumns] = React.useState<CeOptionSetColumn[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [query, setQuery] = React.useState("")

  // Setting loading starts a request (below): the buttons, or a reveal from
  // Tools → Option sets when nothing has loaded yet
  const load = () => {
    setError(null)
    setLoading(true)
  }
  const [seenReveal, setSeenReveal] = React.useState(0)
  if (reveal !== seenReveal) {
    setSeenReveal(reveal)
    if (reveal && columns === null && !loading) load()
  }

  const fetchOptionSets = React.useEffectEvent(() =>
    run("optionSets", { entityName })
  )
  React.useEffect(() => {
    if (!loading) return
    let live = true
    fetchOptionSets()
      .then(
        (c) => live && setColumns(c),
        (e) => live && setError(e instanceof Error ? e.message : String(e))
      )
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [loading])

  const raw = new Map((fields ?? []).map((f) => [f.logicalName, f.raw]))
  const q = query.trim().toLowerCase()
  const shown = (columns ?? []).filter(
    (c) =>
      !q ||
      [
        c.logicalName,
        c.label ?? "",
        c.optionSet ?? "",
        ...c.options.flatMap((o) => [String(o.value), o.text]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
  )
  const groups = groupBy(shown, (c) => c.kind).sort(
    ([a], [b]) =>
      KIND_ORDER.indexOf(a as CeOptionSetColumn["kind"]) -
      KIND_ORDER.indexOf(b as CeOptionSetColumn["kind"])
  )

  return (
    <CollapsibleSection
      id="ce.optionsets"
      title="Option sets"
      icon={<ListIcon />}
      summary={columns && <Count>{columns.length}</Count>}
      actions={
        columns && (
          <CopyJsonButton
            data={() =>
              Object.fromEntries(
                columns.map((c) => [
                  c.logicalName,
                  Object.fromEntries(c.options.map((o) => [o.value, o.text])),
                ])
              )
            }
            what={`${columns.length} option sets`}
          />
        )
      }
      defaultCollapsed
      reveal={reveal}
    >
      {!columns ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center text-xs text-muted-foreground">
          Every choice, status and Yes/No column on {entityName} with its
          values, including ones the form doesn't show.
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <DatabaseIcon data-icon="inline-start" />
            {loading ? "Loading…" : "Load option sets"}
          </Button>
          {error && <span className="text-destructive">{error}</span>}
        </div>
      ) : columns.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {entityName} has no choice columns.
        </p>
      ) : (
        <>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search column, option label or value"
          />
          {shown.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No option sets match.
            </p>
          ) : (
            <div className="-mx-1 flex flex-col">
              {groups.map(([kind, items]) => (
                <FieldGroup key={kind} name={kind} count={items.length}>
                  {items.map((c) => (
                    <OptionSetRow
                      key={c.logicalName}
                      column={c}
                      raw={raw.get(c.logicalName) ?? null}
                    />
                  ))}
                </FieldGroup>
              ))}
            </div>
          )}
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

function OptionSetRow({
  column: c,
  raw,
}: {
  column: CeOptionSetColumn
  /** The form's value for this column, if it's on the form */
  raw: string | null
}) {
  const selected = raw ? selectedValues(raw) : undefined
  const current = c.options
    .filter((o) => selected?.has(o.value))
    .map((o) => o.text)
    .join(", ")
  const count = `${c.options.length} option${c.options.length === 1 ? "" : "s"}`

  return (
    <FieldRow
      label={c.label ?? c.logicalName}
      value={current || count}
      name={c.logicalName}
      nameWhat="logical name"
      formats={[
        {
          label: "Options as JSON",
          value: JSON.stringify(
            Object.fromEntries(c.options.map((o) => [o.value, o.text])),
            null,
            2
          ),
        },
        {
          label: "Options as CSV",
          value: [
            "value,label",
            ...c.options.map(
              (o) => `${o.value},"${o.text.replace(/"/g, '""')}"`
            ),
          ].join("\n"),
        },
        { label: "Option set name", value: c.optionSet ?? "" },
      ]}
      details={[
        { label: "Logical name", value: c.logicalName },
        { label: "Type", value: c.kind },
        {
          label: "Option set",
          value: c.optionSet
            ? `${c.optionSet} (${c.global ? "global" : "local"})`
            : "—",
        },
        { label: "Options", value: count },
      ]}
      more={<OptionList options={c.options} selected={selected} />}
    />
  )
}
