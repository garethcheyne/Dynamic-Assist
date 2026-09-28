/**
 * The builder's query as Dataverse SQL (the Web API's T-SQL subset), for the
 * SQL tab and for starting a query in SQL mode. Operators with no SQL form
 * (today, fiscal periods, current user, hierarchy…) are left out and listed at
 * the top; relative dates become DATEADD(…, GETUTCDATE()), which counts from
 * now rather than from midnight, so they're marked as approximate.
 * Operator mapping follows SQL 4 CDS's FetchXml2Sql (MIT, Mark Carrington).
 */
import type { QueryBuilderCondition, QueryBuilderField } from "./lib/types"
import type { TableInfo } from "./metadata"
import type { Query } from "./query"

export type SqlResult = {
  sql: string
  /** Conditions with no SQL form, left out */
  left: string[]
  /** Conditions written close to, but not exactly, their FetchXML meaning */
  approximate: string[]
}

const UNITS: Record<string, string> = {
  minutes: "minute",
  hours: "hour",
  days: "day",
  weeks: "week",
  months: "month",
  years: "year",
}

export const sqlString = (v: unknown) =>
  `'${String(v ?? "").replace(/'/g, "''")}'`

/** A bare name when it's safe, [bracketed] otherwise. */
export const sqlName = (name: string) =>
  /^[A-Za-z_][\w]*$/.test(name) ? name : `[${name.replace(/]/g, "]]")}]`

function literal(v: unknown, field: QueryBuilderField | undefined): string {
  switch (field?.dataType) {
    case "number":
    case "optionset": {
      const n = Number(v)
      return Number.isFinite(n) && String(v).trim() !== ""
        ? String(n)
        : sqlString(v)
    }
    case "boolean":
      return v === true || v === "true" || v === 1 || v === "1" ? "1" : "0"
    default:
      return sqlString(v)
  }
}

export function toSql(
  query: Query,
  fields: QueryBuilderField[],
  table: TableInfo | undefined
): SqlResult {
  const left: string[] = []
  const approximate: string[] = []
  const base = query.entityName
  const fieldOf = (id: string, list = fields) => list.find((f) => f.id === id)

  // Related-table conditions join their table
  const joins: string[] = []
  const related = query.filters.groups
    .flatMap((g) => g.conditions)
    .filter((c) => c.kind === "relatedEntity")
  const qualify = related.length > 0
  const col = (name: string, alias = base) =>
    qualify ? `${sqlName(alias)}.${sqlName(name)}` : sqlName(name)

  for (const c of related) {
    if (!c.relatedEntityTarget || !c.relatedEntityName) continue
    const alias = c.relatedEntityAlias || `related_${c.relatedEntityName}`
    const pk = c.relatedEntityPrimaryId || `${c.relatedEntityTarget}id`
    joins.push(
      `INNER JOIN ${sqlName(c.relatedEntityTarget)} AS ${sqlName(alias)} ON ${sqlName(alias)}.${sqlName(pk)} = ${col(c.relatedEntityName)}`
    )
  }

  const condition = (
    c: QueryBuilderCondition,
    list: QueryBuilderField[],
    alias: string
  ): string | null => {
    const field = fieldOf(c.fieldId, list)
    const name =
      qualify || alias !== base
        ? `${sqlName(alias)}.${sqlName(c.fieldId)}`
        : sqlName(c.fieldId)
    const v = c.value
    const one = () => literal(Array.isArray(v) ? v[0] : v, field)
    const text = () =>
      String(Array.isArray(v) ? v[0] : (v ?? "")).replace(/'/g, "''")
    const list_ = () =>
      (Array.isArray(v) ? v : [v])
        .filter((x) => x !== undefined && x !== "")
        .map((x) => literal(x, field))
        .join(", ")
    const describe = () =>
      `${c.fieldId} ${c.operator}${v !== undefined && v !== "" ? ` ${Array.isArray(v) ? v.join(", ") : v}` : ""}`
    const op = c.operator

    const simple: Record<string, string> = {
      eq: "=",
      ne: "<>",
      neq: "<>",
      gt: ">",
      ge: ">=",
      lt: "<",
      le: "<=",
    }
    if (simple[op]) return `${name} ${simple[op]} ${one()}`
    switch (op) {
      case "null":
        return `${name} IS NULL`
      case "not-null":
      case "notnull":
        return `${name} IS NOT NULL`
      case "like":
        return `${name} LIKE '${text()}'`
      case "not-like":
        return `${name} NOT LIKE '${text()}'`
      case "begins-with":
      case "startswith":
        return `${name} LIKE '${text()}%'`
      case "not-begin-with":
        return `${name} NOT LIKE '${text()}%'`
      case "ends-with":
      case "endswith":
        return `${name} LIKE '%${text()}'`
      case "not-end-with":
        return `${name} NOT LIKE '%${text()}'`
      case "contains":
        return `${name} LIKE '%${text()}%'`
      case "not-contain":
      case "notcontains":
        return `${name} NOT LIKE '%${text()}%'`
      case "in":
        return `${name} IN (${list_()})`
      case "not-in":
        return `${name} NOT IN (${list_()})`
      case "between":
        return `${name} BETWEEN ${one()} AND ${literal(c.value2, field)}`
      case "not-between":
        return `(${name} < ${one()} OR ${name} > ${literal(c.value2, field)})`
      case "on":
        return `${name} >= ${one()} AND ${name} < DATEADD(day, 1, ${one()})`
      case "on-or-after":
        return `${name} >= ${one()}`
      case "on-or-before":
        return `${name} < DATEADD(day, 1, ${one()})`
      case "not-on":
        return `(${name} < ${one()} OR ${name} >= DATEADD(day, 1, ${one()}))`
      case "last-seven-days":
        approximate.push(describe())
        return `${name} >= DATEADD(day, -7, GETUTCDATE()) AND ${name} <= GETUTCDATE()`
      case "next-seven-days":
        approximate.push(describe())
        return `${name} >= GETUTCDATE() AND ${name} <= DATEADD(day, 7, GETUTCDATE())`
    }
    const relative = /^(last|next)-x-(hours|days|weeks|months|years)$/.exec(op)
    const n = Number(Array.isArray(v) ? v[0] : v)
    if (relative && Number.isFinite(n)) {
      approximate.push(describe())
      const unit = UNITS[relative[2]]
      return relative[1] === "last"
        ? `${name} >= DATEADD(${unit}, -${n}, GETUTCDATE()) AND ${name} <= GETUTCDATE()`
        : `${name} >= GETUTCDATE() AND ${name} <= DATEADD(${unit}, ${n}, GETUTCDATE())`
    }
    const older =
      /^(?:olderthan|older-than)-x-(minutes|hours|days|weeks|months|years)$/.exec(
        op
      )
    if (older && Number.isFinite(n))
      return `${name} < DATEADD(${UNITS[older[1]]}, -${n}, GETUTCDATE())`
    left.push(describe())
    return null
  }

  const groups = query.filters.groups
    .map((g) => {
      const parts: string[] = []
      for (const c of g.conditions) {
        if (c.kind === "relatedEntity") {
          const alias = c.relatedEntityAlias || `related_${c.relatedEntityName}`
          const nested = (c.nestedConditions ?? [])
            .map((n) => condition(n, c.nestedFields ?? [], alias))
            .filter((x): x is string => !!x)
          if (nested.length)
            parts.push(
              nested.length > 1
                ? `(${nested.join(` ${(c.nestedLogic ?? "and").toUpperCase()} `)})`
                : nested[0]
            )
          continue
        }
        const sql = condition(c, fields, base)
        if (sql)
          parts.push(parts.length || g.conditions.length > 1 ? wrap(sql) : sql)
      }
      if (!parts.length) return null
      return parts.length > 1
        ? `(${parts.join(` ${g.logic.toUpperCase()} `)})`
        : parts[0]
    })
    .filter((x): x is string => !!x)

  const columns = query.columns.length
    ? query.columns.map((c) => col(c))
    : [table?.primaryNameAttribute, table?.primaryIdAttribute]
        .filter((c): c is string => !!c)
        .map((c) => col(c))
  const lines: string[] = []
  if (!query.columns.length)
    lines.push(
      "-- All columns: Dataverse SQL has no SELECT *, so name the ones you need"
    )
  if (left.length) lines.push(`-- Left out, no SQL form: ${left.join("; ")}`)
  if (approximate.length)
    lines.push(`-- From now, not from midnight: ${approximate.join("; ")}`)
  lines.push(`SELECT${query.distinct ? " DISTINCT" : ""}`)
  lines.push(columns.map((c) => `  ${c}`).join(",\n") || "  -- name a column")
  lines.push(`FROM ${sqlName(base)}`)
  lines.push(...joins)
  if (groups.length) lines.push(`WHERE ${groups.join("\n  AND ")}`)
  if (query.orders.length)
    lines.push(
      `ORDER BY ${query.orders.map((o) => `${col(o.attribute)} ${o.descending ? "DESC" : "ASC"}`).join(", ")}`
    )
  return { sql: lines.join("\n"), left, approximate }
}

/** Parenthesise a condition that has its own AND or OR. */
const wrap = (sql: string) =>
  / (AND|OR) /.test(sql) && !sql.startsWith("(") ? `(${sql})` : sql
