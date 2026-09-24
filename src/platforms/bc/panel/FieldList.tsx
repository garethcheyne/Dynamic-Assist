import * as React from "react"
import {
  EyeOffIcon,
  FunctionSquareIcon,
  PuzzleIcon,
  TextCursorInputIcon,
} from "lucide-react"

import { FieldGroup, FieldRow, type DetailRow } from "@/components/field-row"
import { FilterChip } from "@/components/filter-chip"
import { SearchBox } from "@/components/search-box"
import { groupBy } from "@/lib/group-by"

import { alReference, apiName, odataName, type BcField } from "../page-info"

type Filters = {
  values: boolean
  extensions: boolean
  flowFields: boolean
  hidden: boolean
}

const NO_FILTERS: Filters = {
  values: false,
  extensions: false,
  flowFields: false,
  hidden: false,
}

/** Searchable, filterable fields of one BC page, grouped by FastTab. */
export function FieldList({ fields }: { fields: BcField[] }) {
  const [query, setQuery] = React.useState("")
  const [filters, setFilters] = React.useState(NO_FILTERS)
  const toggle = (k: keyof Filters) => setFilters((f) => ({ ...f, [k]: !f[k] }))

  if (fields.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        No table fields on this page.
      </p>
    )
  }

  const q = query.trim().toLowerCase()
  const shown = fields.filter(
    (f) =>
      (filters.hidden || f.visible) &&
      (!filters.values || !!f.value) &&
      (!filters.extensions || !!f.appId) &&
      (!filters.flowFields || f.fieldClass !== "Normal") &&
      (!q ||
        [f.caption, f.schemaName, f.fieldNo, f.value, f.appName]
          .join(" ")
          .toLowerCase()
          .includes(q))
  )
  const groups = groupBy(shown, (f) => f.group ?? "General")
  const count = (pred: (f: BcField) => boolean) => fields.filter(pred).length

  return (
    <div className="flex flex-col gap-2">
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search caption, name, number or value"
      />
      <div className="flex flex-wrap gap-1">
        <FilterChip
          label="Has value"
          icon={<TextCursorInputIcon />}
          count={count((f) => !!f.value)}
          on={filters.values}
          tip="Only fields with a value"
          onToggle={() => toggle("values")}
        />
        <FilterChip
          label="Extensions"
          icon={<PuzzleIcon />}
          count={count((f) => !!f.appId)}
          on={filters.extensions}
          tip="Only fields added by another app"
          onToggle={() => toggle("extensions")}
        />
        <FilterChip
          label="FlowFields"
          icon={<FunctionSquareIcon />}
          count={count((f) => f.fieldClass !== "Normal")}
          on={filters.flowFields}
          tip="Only FlowFields and FlowFilters"
          onToggle={() => toggle("flowFields")}
        />
        {fields.some((f) => !f.visible) && (
          <FilterChip
            label="Hidden"
            icon={<EyeOffIcon />}
            count={count((f) => !f.visible)}
            on={filters.hidden}
            tip="Include fields hidden on the page"
            onToggle={() => toggle("hidden")}
          />
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          No fields match.
        </p>
      ) : (
        <div className="-mx-1 flex flex-col">
          {groups.map(([name, items]) =>
            groups.length > 1 ? (
              <FieldGroup key={name} name={name} count={items.length}>
                {items.map((f) => (
                  <BcFieldRow key={f.fieldNo} field={f} />
                ))}
              </FieldGroup>
            ) : (
              items.map((f) => <BcFieldRow key={f.fieldNo} field={f} />)
            )
          )}
        </div>
      )}
    </div>
  )
}

function BcFieldRow({ field: f }: { field: BcField }) {
  const details: DetailRow[] = [
    { label: "Schema name", value: f.schemaName },
    { label: "Field no.", value: String(f.fieldNo) },
    { label: "Type", value: f.dataType },
    { label: "Class", value: f.fieldClass },
    { label: "Control", value: f.controlName ?? "—" },
    { label: "Editable", value: f.editable ? "Yes" : "No" },
  ]
  if (f.appId) details.push({ label: "App", value: f.appName ?? f.appId })
  if (f.value) details.push({ label: "Value", value: f.value, long: true })

  return (
    <FieldRow
      label={f.caption || f.schemaName}
      value={f.value ?? ""}
      name={f.schemaName}
      nameWhat="schema name"
      dimmed={!f.visible}
      markers={
        <>
          {f.fieldClass !== "Normal" && (
            <FunctionSquareIcon
              className="size-3 shrink-0 text-primary"
              aria-label={f.fieldClass}
            />
          )}
          {f.appId && (
            <PuzzleIcon
              className="size-3 shrink-0 text-primary"
              aria-label={`Added by ${f.appName ?? "an extension"}`}
            />
          )}
        </>
      }
      formats={[
        { label: "AL reference", value: alReference(f.schemaName) },
        { label: "API name", value: apiName(f.schemaName) },
        { label: "OData name", value: odataName(f.schemaName) },
        { label: "Field number", value: String(f.fieldNo) },
        { label: "Caption", value: f.caption ?? "" },
        { label: "Name and value", value: `${f.schemaName}: ${f.value ?? ""}` },
      ]}
      details={details}
    />
  )
}
