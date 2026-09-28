/**
 * What the query editors know about the org: tables, and (once loaded) each
 * table's columns and relationships. Suggestions and checks read it
 * synchronously; the editor loads what a query mentions before asking.
 */
import type { QueryBuilderField } from "../lib/types"
import type { Relationship, TableInfo } from "../metadata"
import type { OperatorType } from "./fetch-schema"

export type EditorMeta = {
  tables: TableInfo[]
  table(name: string): TableInfo | undefined
  /** undefined until loaded (or when the table doesn't exist) */
  fields(table: string): QueryBuilderField[] | undefined
  relationships(table: string): Relationship[] | undefined
}

export function staticMeta(
  tables: TableInfo[],
  fields: Record<string, QueryBuilderField[]>,
  relationships: Record<string, Relationship[]> = {}
): EditorMeta {
  const byName = new Map(tables.map((t) => [t.logicalName, t]))
  return {
    tables,
    table: (name) => byName.get(name),
    fields: (table) => fields[table],
    relationships: (table) => relationships[table],
  }
}

export const findField = (
  meta: EditorMeta,
  table: string | null | undefined,
  column: string
) => (table ? meta.fields(table)?.find((f) => f.id === column) : undefined)

/** Which operator groups (Microsoft Learn's) fit a column. */
export function operatorTypesOf(
  field: QueryBuilderField,
  table: string
): OperatorType[] {
  const t = field.attributeType ?? ""
  if (t === "multiselectpicklist") return ["choice"]
  switch (field.dataType) {
    case "optionset":
    case "boolean":
      return ["choice"]
    case "datetime":
      return ["datetime"]
    case "number":
      return ["number"]
    case "string":
      return ["string"]
    case "lookup": {
      const types: OperatorType[] = ["id"]
      if (t === "owner") types.push("owner")
      // A key, or a lookup to the same table, can walk a hierarchy
      if (
        t === "uniqueidentifier" ||
        field.targets?.some((x) => x.entityLogicalName === table)
      )
        types.push("hierarchy")
      return types
    }
  }
}

/** A short type name for suggestion details. */
export function typeLabel(field: QueryBuilderField): string {
  const t = field.attributeType
  if (t === "multiselectpicklist") return "choices"
  if (t === "picklist" || t === "state" || t === "status") return "choice"
  if (field.dataType === "lookup" && field.targets?.length)
    return `lookup → ${field.targets.map((x) => x.entityLogicalName).join(", ")}`
  return t || field.dataType
}
