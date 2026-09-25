import * as React from "react"
import { Link2Icon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { getJson } from "../metadata"
import {
  getOperatorsForType,
  getOperatorValueType,
  operatorIsMultiValue,
  operatorRequiresValue,
  operatorRequiresValue2,
} from "../lib/operators"
import type {
  QueryBuilderCondition,
  QueryBuilderField,
  QueryBuilderGroup,
  QueryBuilderState,
} from "../lib/types"
import {
  createCondition,
  createGroup,
  getDefaultValueForField,
  isOperatorValidForType,
} from "../lib/utils"
import {
  PlainSelect,
  SearchSelect,
  type SelectItem,
} from "@/query-builder/SearchSelect"

const inputClass =
  "h-7 min-w-0 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"

/**
 * The filter part of the query, on the fluentui-extended QueryBuilder model:
 * groups of conditions joined with AND/OR, each group itself AND/OR inside.
 */
export function FilterEditor({
  fields,
  defaultFieldId,
  state,
  onChange,
}: {
  fields: QueryBuilderField[]
  /** Column new conditions start on: the table's primary name */
  defaultFieldId?: string | null
  state: QueryBuilderState
  onChange: (state: QueryBuilderState) => void
}) {
  const fieldItems = React.useMemo<SelectItem[]>(
    () => fields.map((f) => ({ value: f.id, label: f.label, hint: f.id })),
    [fields]
  )
  const first = fields.find((f) => f.id === defaultFieldId) ?? fields[0]

  const setGroup = (id: string, next: QueryBuilderGroup | null) =>
    onChange({
      ...state,
      groups: next
        ? state.groups.map((g) => (g.id === id ? next : g))
        : state.groups.filter((g) => g.id !== id),
    })

  if (!first) {
    return <p className="text-xs text-muted-foreground">Loading columns…</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {state.groups.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No filters: every row is returned (up to the row limit).
        </p>
      )}
      {state.groups.map((group, i) => (
        <React.Fragment key={group.id}>
          {i > 0 && (
            <span className="self-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              and
            </span>
          )}
          <GroupEditor
            group={group}
            fields={fields}
            fieldItems={fieldItems}
            defaultField={first}
            onChange={(next) => setGroup(group.id, next)}
          />
        </React.Fragment>
      ))}
      <Button
        variant="outline"
        size="xs"
        className="self-start"
        onClick={() =>
          onChange({ ...state, groups: [...state.groups, createGroup(first)] })
        }
      >
        <PlusIcon data-icon="inline-start" />
        {state.groups.length ? "Add group" : "Add filter"}
      </Button>
    </div>
  )
}

function GroupEditor({
  group,
  fields,
  fieldItems,
  defaultField,
  onChange,
}: {
  group: QueryBuilderGroup
  fields: QueryBuilderField[]
  fieldItems: SelectItem[]
  defaultField: QueryBuilderField
  onChange: (group: QueryBuilderGroup | null) => void
}) {
  const setCondition = (id: string, next: QueryBuilderCondition | null) => {
    const conditions = next
      ? group.conditions.map((c) => (c.id === id ? next : c))
      : group.conditions.filter((c) => c.id !== id)
    onChange(conditions.length ? { ...group, conditions } : null)
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Match</span>
        <PlainSelect
          ariaLabel="Match all or any"
          value={group.logic}
          onChange={(v) => onChange({ ...group, logic: v as "and" | "or" })}
          options={[
            { value: "and", label: "all of these" },
            { value: "or", label: "any of these" },
          ]}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          title="Remove group"
          aria-label="Remove group"
          onClick={() => onChange(null)}
        >
          <Trash2Icon />
        </Button>
      </div>
      {group.conditions.map((c) =>
        c.kind === "relatedEntity" ? (
          <RelatedCondition
            key={c.id}
            condition={c}
            onRemove={() => setCondition(c.id, null)}
          />
        ) : (
          <ConditionRow
            key={c.id}
            condition={c}
            fields={fields}
            fieldItems={fieldItems}
            onChange={(next) => setCondition(c.id, next)}
          />
        )
      )}
      <Button
        variant="ghost"
        size="xs"
        className="self-start"
        onClick={() =>
          onChange({
            ...group,
            conditions: [...group.conditions, createCondition(defaultField)],
          })
        }
      >
        <PlusIcon data-icon="inline-start" />
        Condition
      </Button>
    </div>
  )
}

function ConditionRow({
  condition: c,
  fields,
  fieldItems,
  onChange,
}: {
  condition: QueryBuilderCondition
  fields: QueryBuilderField[]
  fieldItems: SelectItem[]
  onChange: (c: QueryBuilderCondition | null) => void
}) {
  const field = fields.find((f) => f.id === c.fieldId)
  const operators = field ? getOperatorsForType(field.dataType) : []

  return (
    <div className="flex flex-col gap-1 rounded-md bg-background/70 p-1.5">
      <div className="flex items-center gap-1">
        <SearchSelect
          className="flex-1"
          ariaLabel="Column"
          items={fieldItems}
          value={c.fieldId}
          selectedLabel={
            c.isUnknownField ? `${c.fieldId} (unknown)` : undefined
          }
          onChange={(id) => {
            const next = fields.find((f) => f.id === id)
            if (!next) return
            const keepOperator = isOperatorValidForType(
              c.operator,
              next.dataType
            )
            onChange({
              ...c,
              fieldId: id,
              isUnknownField: false,
              operator: keepOperator
                ? c.operator
                : (getOperatorsForType(next.dataType)[0]?.value ?? "eq"),
              value: getDefaultValueForField(next),
              value2: "",
              valueDisplayName: undefined,
            })
          }}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          title="Remove condition"
          aria-label="Remove condition"
          onClick={() => onChange(null)}
        >
          <XIcon />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <PlainSelect
          ariaLabel="Operator"
          className="w-40 shrink-0"
          value={c.operator}
          onChange={(op) => onChange({ ...c, operator: op })}
          options={
            operators.some((o) => o.value === c.operator)
              ? operators
              : [{ value: c.operator, label: c.operator }, ...operators]
          }
        />
        {field && (
          <ValueEditor field={field} condition={c} onChange={onChange} />
        )}
      </div>
    </div>
  )
}

/** The value box(es) a condition needs, by its operator and the column's type. */
function ValueEditor({
  field,
  condition: c,
  onChange,
}: {
  field: QueryBuilderField
  condition: QueryBuilderCondition
  onChange: (c: QueryBuilderCondition) => void
}) {
  const op = c.operator
  if (!operatorRequiresValue(op)) return null

  const valueType = getOperatorValueType(op)
  const kind =
    valueType === "same"
      ? field.dataType
      : valueType === "date"
        ? "datetime"
        : valueType
  const multi = operatorIsMultiValue(op)
  const two = operatorRequiresValue2(op)
  const set = (patch: Partial<QueryBuilderCondition>) =>
    onChange({ ...c, ...patch })
  const str = (v: unknown) => (v === undefined || v === null ? "" : String(v))

  if ((kind === "optionset" || kind === "boolean") && field.options?.length) {
    if (multi) {
      const selected = new Set(
        (Array.isArray(c.value) ? c.value : [c.value]).map(String)
      )
      return (
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {field.options.map((o) => {
            const on = selected.has(String(o.value))
            return (
              <button
                type="button"
                key={String(o.value)}
                onClick={() => {
                  const next = new Set(selected)
                  if (on) next.delete(String(o.value))
                  else next.add(String(o.value))
                  set({ value: [...next].filter(Boolean) })
                }}
                className={
                  "rounded border px-1.5 py-0.5 text-[11px] " +
                  (on
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "text-muted-foreground")
                }
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )
    }
    return (
      <PlainSelect
        ariaLabel="Value"
        className="flex-1"
        value={str(c.value)}
        onChange={(v) => set({ value: v })}
        options={field.options.map((o) => ({
          value: String(o.value),
          label: o.label,
        }))}
      />
    )
  }

  if (kind === "lookup" && !multi) {
    return <LookupValue field={field} condition={c} onChange={onChange} />
  }

  const type =
    kind === "number" ? "number" : kind === "datetime" ? "date" : "text"
  if (multi) {
    return (
      <input
        className={`${inputClass} flex-1`}
        aria-label="Values, comma separated"
        placeholder="Values, comma separated"
        value={Array.isArray(c.value) ? c.value.join(", ") : str(c.value)}
        onChange={(e) =>
          set({
            value: e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />
    )
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input
        type={type}
        className={`${inputClass} min-w-0 flex-1`}
        aria-label="Value"
        value={str(c.value)}
        onChange={(e) => set({ value: e.target.value })}
      />
      {two && (
        <>
          <span className="text-[11px] text-muted-foreground">and</span>
          <input
            type={type}
            className={`${inputClass} min-w-0 flex-1`}
            aria-label="Second value"
            value={str(c.value2)}
            onChange={(e) => set({ value2: e.target.value })}
          />
        </>
      )}
    </div>
  )
}

/** Pick a record for a lookup condition by searching its table's name column. */
function LookupValue({
  field,
  condition: c,
  onChange,
}: {
  field: QueryBuilderField
  condition: QueryBuilderCondition
  onChange: (c: QueryBuilderCondition) => void
}) {
  const target = field.targets?.[0]
  const [items, setItems] = React.useState<SelectItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)

  const search = (q: string) => {
    if (!target?.entitySetName || !target.primaryNameAttribute) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      setLoading(true)
      const name = target.primaryNameAttribute!
      const id = target.primaryIdAttribute ?? `${target.entityLogicalName}id`
      const filter = q.trim()
        ? `&$filter=contains(${name},'${q.trim().replace(/'/g, "''")}')`
        : ""
      try {
        const r = await getJson(
          `${target.entitySetName}?$select=${name},${id}&$orderby=${name}&$top=15${filter}`
        )
        setItems(
          (r.value as Record<string, string>[]).map((row) => ({
            value: row[id],
            label: row[name] || row[id],
            hint: target.displayName,
          }))
        )
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  if (!target?.entitySetName) {
    return (
      <input
        className={`${inputClass} flex-1 font-mono`}
        aria-label="Record ID"
        placeholder="Record ID"
        value={typeof c.value === "string" ? c.value : ""}
        onChange={(e) => onChange({ ...c, value: e.target.value })}
      />
    )
  }
  return (
    <SearchSelect
      className="flex-1"
      ariaLabel="Record"
      placeholder={`Search ${target.displayName ?? target.entityLogicalName}`}
      items={items}
      loading={loading}
      value={typeof c.value === "string" && c.value ? c.value : null}
      selectedLabel={c.valueDisplayName}
      onSearch={search}
      onChange={(id) =>
        onChange({
          ...c,
          value: id,
          valueDisplayName: items.find((i) => i.value === id)?.label,
        })
      }
    />
  )
}

/** Conditions on a linked table (from imported FetchXML): kept as they are. */
function RelatedCondition({
  condition: c,
  onRemove,
}: {
  condition: QueryBuilderCondition
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-background/70 p-1.5 text-xs">
      <Link2Icon className="size-3.5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">
        Linked <b>{c.relatedEntityTarget}</b> via {c.relatedEntityName}
        {c.nestedConditions?.length
          ? ` · ${c.nestedConditions.length} condition${c.nestedConditions.length > 1 ? "s" : ""}`
          : ""}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        title="Remove"
        aria-label="Remove linked filter"
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </div>
  )
}
