/**
 * SQL suggestions at the cursor, from this environment's tables and fields:
 * tables after FROM and JOIN, fields after an alias and a dot, join conditions
 * from the real lookups after ON, option values after = and IN (, and only the
 * keywords and functions that compile to a Business Central query. Pure: the
 * editor turns these into completions.
 */
import type {
  Completions,
  Suggestion,
} from "@/platforms/ce/query/editor/fetch-complete"
import {
  readSql,
  sqlTokens,
  type SqlQuery,
} from "@/platforms/ce/query/editor/sql-parse"

import type { BcField, BcTable } from "../bridge"
import { findField, findTable, type BcSqlMeta } from "./from-sql"
import { sqlName } from "./to-sql"

/** The tables a query names, to load before suggesting or checking. */
export const bcSqlTablesIn = (text: string) => [
  ...new Set(readSql(text).tables.map((t) => t.table)),
]

const kw = (label: string, info?: string): Suggestion => ({
  label,
  info,
  type: "keyword",
  boost: -1,
})

const KEYWORDS = [
  kw("SELECT"),
  kw("TOP", "TOP 10: at most this many rows"),
  kw("FROM"),
  kw("WHERE"),
  kw("INNER JOIN", "Through a lookup: only rows with a match"),
  kw("LEFT JOIN", "Through a lookup: every row, matched or not"),
  kw("ON"),
  kw("AND"),
  kw("OR", "Within one field: x = 'A' OR x = 'B'"),
  kw("NOT"),
  kw("IN"),
  kw("LIKE", "% any text, _ one character. Ignores case"),
  kw("BETWEEN"),
  kw("IS NULL", "Blank, in Business Central"),
  kw("IS NOT NULL", "Not blank"),
  kw("GROUP BY"),
  kw("ORDER BY"),
  kw("ASC"),
  kw("DESC"),
]

const fn = (label: string, snippet: string, info: string): Suggestion => ({
  label,
  snippet,
  info,
  type: "function",
})

const SELECT_FUNCTIONS = [
  fn("COUNT", "COUNT(*)", "How many records match"),
  fn(
    "SUM",
    "SUM(${})",
    "Added up here, from the rows Business Central returns"
  ),
  fn(
    "AVG",
    "AVG(${})",
    "Worked out here, from the rows Business Central returns"
  ),
  fn(
    "MIN",
    "MIN(${})",
    "Worked out here, from the rows Business Central returns"
  ),
  fn(
    "MAX",
    "MAX(${})",
    "Worked out here, from the rows Business Central returns"
  ),
]

const VALUE_FUNCTIONS = [
  fn("TODAY", "TODAY()", "Today: Business Central's t"),
  fn("WORKDATE", "WORKDATE()", "Your work date: Business Central's w"),
  fn(
    "DATEADD",
    "DATEADD(${day}, ${-7}, TODAY())",
    "A date from today: DATEADD(day, -7, TODAY()). day, week, month or year"
  ),
]

const FIELD_FUNCTIONS = [
  fn("YEAR", "YEAR(${})", "YEAR(field) = 2025: that whole year"),
  fn("UPPER", "UPPER(${})", "Ignore case: UPPER(field) = 'ABC'"),
  fn("LOWER", "LOWER(${})", "Ignore case: LOWER(field) = 'abc'"),
]

const fieldKind = (f: BcField) =>
  `${f.type}${f.class === "Normal" ? "" : ` · ${f.class}`}${f.pk ? " · key" : ""}`

export function completeBcSql(
  text: string,
  pos: number,
  meta: BcSqlMeta
): Completions | null {
  const query = readSql(text)
  const raw = sqlTokens(text.slice(0, pos))
  const lastRaw = raw[raw.length - 1]
  if (lastRaw?.kind === "comment" && lastRaw.to === pos) return null
  if (
    lastRaw?.kind === "string" &&
    (!lastRaw.text.endsWith("'") || lastRaw.text.length === 1)
  )
    return null
  const before = raw.filter((t) => t.kind !== "comment")
  const last = before[before.length - 1]
  const typing =
    last && last.to === pos && (last.kind === "word" || last.kind === "ident")
      ? last
      : null
  const from = typing ? typing.from : pos
  const prior = typing ? before.slice(0, -1) : before
  const p1 = prior[prior.length - 1]
  const p2 = prior[prior.length - 2]

  const tableOf = (name: string) => {
    const n = name.toLowerCase()
    const hit =
      query.tables.find((t) => t.alias?.toLowerCase() === n) ??
      query.tables.find((t) => t.table === n)
    return hit ? findTable(meta, hit.table) : findTable(meta, name)
  }
  const fieldsOf = (t: BcTable | undefined) =>
    t ? (meta.fields(t.id) ?? []) : []
  const fieldOptions = (t: BcTable, prefix = ""): Suggestion[] =>
    fieldsOf(t).map((f) => ({
      label: `${prefix}${sqlName(f.name)}`,
      // [Address 2] beside Address, not ahead of every name without brackets
      sortText: `${prefix}${f.name}`,
      detail: f.caption && f.caption !== f.name ? f.caption : `${f.no}`,
      info: `${f.no} · ${fieldKind(f)}`,
      type: "property",
    }))
  const inQuery = () =>
    query.tables.flatMap((t) => {
      const table = findTable(meta, t.table)
      return table
        ? fieldOptions(
            table,
            query.tables.length > 1 ? `${t.alias ?? sqlName(table.name)}.` : ""
          )
        : []
    })

  // alias.| → that table's fields
  if (p1?.kind === "punct" && p1.value === "." && p2) {
    const t = tableOf(p2.kind === "ident" ? p2.value : p2.text)
    return t ? { from, options: fieldOptions(t) } : null
  }

  // FROM | / JOIN | → tables; after JOIN, what the main table looks up first
  if (p1?.kind === "word" && (p1.value === "FROM" || p1.value === "JOIN")) {
    const main = query.tables[0] && findTable(meta, query.tables[0].table)
    const lookups =
      p1.value === "JOIN" && main
        ? new Map(
            fieldsOf(main)
              .filter((f) => f.relationTable)
              .map((f) => [f.relationTable, f.name])
          )
        : new Map<number | undefined, string>()
    return {
      from,
      options: meta.tables.map((t) => ({
        label: sqlName(t.name),
        sortText: t.name,
        detail: t.caption && t.caption !== t.name ? t.caption : `${t.id}`,
        info: lookups.has(t.id)
          ? `Through ${main?.name}.${lookups.get(t.id)} · table ${t.id}`
          : `Table ${t.id}`,
        type: "class",
        boost: lookups.has(t.id) ? 2 : 0,
      })),
    }
  }

  // FROM Customer | → an alias, or the next clause
  if (
    p2?.kind === "word" &&
    (p2.value === "FROM" || p2.value === "JOIN") &&
    p1?.kind !== "punct"
  )
    return { from, options: KEYWORDS }

  // TOP | → a number goes here; nothing to suggest
  if (p1?.kind === "word" && p1.value === "TOP") return null

  // ON | → the join's condition, from the lookup
  if (p1?.value === "ON")
    return { from, options: [...joinOptions(query, meta, prior), ...inQuery()] }

  // field = | / field IN (| → its options, and date functions
  const compared = comparedColumn(prior)
  if (compared) {
    const scope = compared.qualifier
      ? tableOf(compared.qualifier)
      : query.tables[0] && findTable(meta, query.tables[0].table)
    const field = scope && findField(fieldsOf(scope), compared.column)
    if (field?.type === "Boolean")
      return {
        from,
        options: ["TRUE", "FALSE"].map((label) => ({ label, type: "enum" })),
      }
    if (field?.options?.length)
      return {
        from,
        options: field.options
          .filter((o) => o.trim())
          .map((o) => ({
            label: `'${o.replace(/'/g, "''")}'`,
            type: "enum",
          })),
      }
    if (field && ["Date", "DateTime"].includes(field.type))
      return { from, options: VALUE_FUNCTIONS }
    return { from, options: VALUE_FUNCTIONS }
  }

  // Anywhere else: the fields in play, then what fits this clause
  const clause = clauseAt(query, prior)
  const options: Suggestion[] = [...inQuery(), ...KEYWORDS]
  if (clause === "select") options.push(...SELECT_FUNCTIONS)
  if (clause === "where" || clause === "on")
    options.push(...FIELD_FUNCTIONS, ...VALUE_FUNCTIONS)
  if (clause === "order") options.push(...SELECT_FUNCTIONS)
  if (!query.tables.length && clause === "select")
    options.push({ ...kw("FROM", "Name the table next"), boost: 1 })
  return { from, options }
}

function clauseAt(query: SqlQuery, prior: { from: number }[]) {
  const last = prior[prior.length - 1]
  if (!last) return "other"
  const i = query.code.findIndex((t) => t.from === last.from)
  return i >= 0 ? query.clauses[i] : "other"
}

/** The join being written, matched to the main table through its lookups. */
function joinOptions(
  query: SqlQuery,
  meta: BcSqlMeta,
  prior: { from: number }[]
): Suggestion[] {
  const upTo = prior[prior.length - 1]?.from ?? 0
  const earlier = query.tables.filter((t) => t.from < upTo)
  const joined = earlier[earlier.length - 1]
  const first = query.tables[0]
  if (!joined || !first || joined === first) return []
  const main = findTable(meta, first.table)
  const other = findTable(meta, joined.table)
  if (!main || !other) return []
  const otherFields = meta.fields(other.id) ?? []
  const keyOf = (f: BcField) =>
    otherFields.find((x) => x.no === f.relationField) ??
    otherFields.find((x) => x.pk)
  const mainName = first.alias ?? sqlName(main.name)
  const otherName = joined.alias ?? sqlName(other.name)
  return (meta.fields(main.id) ?? [])
    .filter((f) => f.relationTable === other.id)
    .flatMap((f) => {
      const key = keyOf(f)
      return key
        ? [
            {
              label: `${mainName}.${sqlName(f.name)} = ${otherName}.${sqlName(key.name)}`,
              detail: "lookup",
              type: "text",
              boost: 3,
            },
          ]
        : []
    })
}

/** The field just compared, when the cursor is where its value goes. */
function comparedColumn(
  prior: { kind: string; value: string; text: string }[]
) {
  let i = prior.length - 1
  while (
    i >= 0 &&
    (prior[i].kind === "number" ||
      prior[i].kind === "string" ||
      prior[i].value === ",")
  )
    i--
  if (prior[i]?.value === "(" && prior[i - 1]?.value === "IN") i -= 2
  else if (
    prior[i]?.kind === "op" &&
    /^(=|<>|!=|<|<=|>|>=)$/.test(prior[i].value) &&
    i === prior.length - 1
  )
    i -= 1
  else if (prior[i]?.value === "BETWEEN" && i === prior.length - 1) i -= 1
  else return null
  if (prior[i]?.value === "NOT") i--
  // YEAR(field) and the like close with a bracket before the operator
  if (prior[i]?.value === ")") i--
  const col = prior[i]
  if (!col || (col.kind !== "word" && col.kind !== "ident")) return null
  const name = col.kind === "ident" ? col.value : col.text
  const qualifier =
    prior[i - 1]?.value === "." ? (prior[i - 2]?.text ?? null) : null
  return { column: name, qualifier }
}
