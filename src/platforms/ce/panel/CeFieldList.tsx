import * as React from "react"
import {
  AsteriskIcon,
  EyeOffIcon,
  LockIcon,
  PencilIcon,
  TextCursorInputIcon,
} from "lucide-react"

import { FieldGroup, FieldRow, type DetailRow } from "@/components/field-row"
import { FieldNamingToggle } from "@/components/field-naming"
import { FilterChip } from "@/components/filter-chip"
import { SearchBox } from "@/components/search-box"
import { groupBy } from "@/lib/group-by"

import type { CeField } from "../types"

type Filters = {
  values: boolean
  changed: boolean
  required: boolean
  hidden: boolean
}

const NO_FILTERS: Filters = {
  values: false,
  changed: false,
  required: false,
  hidden: false,
}

/** The form's attributes, grouped by form tab, with the same row as BC. */
export function CeFieldList({ fields }: { fields: CeField[] }) {
  const [query, setQuery] = React.useState("")
  const [filters, setFilters] = React.useState(NO_FILTERS)
  const toggle = (k: keyof Filters) => setFilters((f) => ({ ...f, [k]: !f[k] }))

  if (fields.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        No fields on this form.
      </p>
    )
  }

  const q = query.trim().toLowerCase()
  const shown = fields.filter(
    (f) =>
      (filters.hidden || f.visible) &&
      (!filters.values || !!f.display) &&
      (!filters.changed || f.dirty) &&
      (!filters.required || f.requiredLevel === "required") &&
      (!q ||
        [f.label, f.logicalName, f.display, f.raw]
          .join(" ")
          .toLowerCase()
          .includes(q))
  )
  const groups = groupBy(shown, (f) => f.tab ?? "Header and hidden")
  const count = (pred: (f: CeField) => boolean) => fields.filter(pred).length
  const changed = count((f) => f.dirty)

  return (
    <div className="flex flex-col gap-2">
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search label, logical name or value"
      />
      <div className="flex flex-wrap items-center gap-1">
        <FilterChip
          label="Has value"
          icon={<TextCursorInputIcon />}
          count={count((f) => !!f.display)}
          on={filters.values}
          tip="Only fields with a value"
          onToggle={() => toggle("values")}
        />
        <FilterChip
          label="Changed"
          icon={<PencilIcon />}
          count={changed}
          on={filters.changed}
          tip="Only fields changed since the form loaded"
          onToggle={() => toggle("changed")}
        />
        <FilterChip
          label="Required"
          icon={<AsteriskIcon />}
          count={count((f) => f.requiredLevel === "required")}
          on={filters.required}
          tip="Only business-required fields"
          onToggle={() => toggle("required")}
        />
        <FilterChip
          label="Hidden"
          icon={<EyeOffIcon />}
          count={count((f) => !f.visible)}
          on={filters.hidden}
          tip="Include fields hidden on the form"
          onToggle={() => toggle("hidden")}
        />
        <FieldNamingToggle className="ml-auto" />
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
                  <CeFieldRow key={f.logicalName} field={f} />
                ))}
              </FieldGroup>
            ) : (
              items.map((f) => <CeFieldRow key={f.logicalName} field={f} />)
            )
          )}
        </div>
      )}
    </div>
  )
}

/** The Web API property for a column: lookups are _name_value. */
const webApiName = (f: CeField) =>
  f.type === "lookup" ? `_${f.logicalName}_value` : f.logicalName

function CeFieldRow({ field: f }: { field: CeField }) {
  const details: DetailRow[] = [
    { label: "Logical name", value: f.logicalName },
    { label: "Type", value: f.format ? `${f.type} (${f.format})` : f.type },
    { label: "Required", value: f.requiredLevel },
    {
      label: "Tab / section",
      value: [f.tab, f.section].filter(Boolean).join(" / ") || "—",
    },
    { label: "Visible", value: f.visible ? "Yes" : "No" },
    { label: "Read-only", value: f.disabled ? "Yes" : "No" },
    { label: "Changed", value: f.dirty ? "Yes" : "No" },
  ]
  for (const l of f.lookups ?? []) {
    details.push({ label: `→ ${l.entityType}`, value: l.id })
  }
  if (f.raw && f.raw !== "null")
    details.push({ label: "Raw value", value: f.raw, long: true })

  const formats = [
    { label: "Web API name", value: webApiName(f) },
    {
      label: "FetchXML attribute",
      value: `<attribute name="${f.logicalName}" />`,
    },
    { label: "Raw value", value: f.raw === "null" ? "" : f.raw },
    { label: "Label", value: f.label },
    { label: "Name and value", value: `${f.logicalName}: ${f.display}` },
  ]
  if (f.lookups?.length === 1) {
    formats.splice(3, 0, { label: "Lookup id", value: f.lookups[0].id })
  }

  return (
    <FieldRow
      label={f.label}
      value={f.display}
      name={f.logicalName}
      nameWhat="logical name"
      dimmed={!f.visible}
      highlight={f.dirty}
      markers={
        <>
          {f.requiredLevel === "required" && (
            <AsteriskIcon
              className="size-3 shrink-0 text-destructive"
              aria-label="Required"
            />
          )}
          {f.disabled && (
            <LockIcon
              className="size-3 shrink-0 text-muted-foreground"
              aria-label="Read-only"
            />
          )}
          {f.dirty && (
            <PencilIcon
              className="size-3 shrink-0 text-primary"
              aria-label="Changed"
            />
          )}
        </>
      }
      formats={formats}
      details={details}
    />
  )
}
