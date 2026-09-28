/**
 * SQL suggestions at the cursor, from the org's metadata: tables after FROM
 * and JOIN, a table's columns after its alias and a dot, join conditions from
 * relationships after ON, choice values after = or IN (, and only the keywords
 * and functions Dataverse SQL supports. Pure: the editor turns these into
 * completions.
 */
import type { Suggestion, Completions } from "./fetch-complete"
import { findField, typeLabel, type EditorMeta } from "./meta"
import {
  readSql,
  sqlTokens,
  tableFor,
  type SqlQuery,
  type SqlTable,
} from "./sql-parse"

/** The tables a query uses, to load before suggesting or checking. */
export const sqlTablesIn = (text: string) => [
  ...new Set(readSql(text).tables.map((t) => t.table)),
]

const kw = (label: string, info?: string, boost = 0): Suggestion => ({
  label,
  info,
  type: "keyword",
  boost,
})

const CLAUSE_KEYWORDS = [
  kw("SELECT"),
  kw("DISTINCT"),
  kw("FROM"),
  kw("WHERE"),
  kw("INNER JOIN", "Rows with a match in both tables"),
  kw("LEFT JOIN", "Every row of the first table, matched or not"),
  kw("ON"),
  kw("AND"),
  kw("OR"),
  kw("NOT"),
  kw("IN"),
  kw("LIKE", "% any text, _ one character"),
  kw("BETWEEN"),
  kw("IS NULL"),
  kw("IS NOT NULL"),
  kw("AS"),
  kw("GROUP BY"),
  kw("ORDER BY"),
  kw("ASC"),
  kw("DESC"),
]

const AGGREGATES: Suggestion[] = ["COUNT", "SUM", "AVG", "MIN", "MAX"].map(
  (f) => ({
    label: f,
    type: "function",
    snippet:
      f === "COUNT"
        ? "COUNT(*) AS ${count}"
        : `${f}(\${}) AS \${${f.toLowerCase()}}`,
    info: "Needs GROUP BY for any other columns",
  })
)

const DATE_FUNCTIONS: Suggestion[] = [
  {
    label: "GETUTCDATE",
    type: "function",
    snippet: "GETUTCDATE()",
    info: "Now, in UTC",
  },
  {
    label: "DATEADD",
    type: "function",
    snippet: "DATEADD(${day}, ${-7}, GETUTCDATE())",
    info: "Only on constants: createdon >= DATEADD(day, -7, GETUTCDATE())",
  },
]

export function completeSql(
  text: string,
  pos: number,
  meta: EditorMeta
): Completions | null {
  const query = readSql(text)
  const raw = sqlTokens(text.slice(0, pos))
  const lastRaw = raw[raw.length - 1]
  // Inside a comment or an unfinished string: nothing
  if (lastRaw?.kind === "comment" && lastRaw.to === pos) return null
  if (
    lastRaw?.kind === "string" &&
    (!lastRaw.text.endsWith("'") || lastRaw.text.length === 1)
  )
    return null
  const before = raw.filter((t) => t.kind !== "comment")
  const last = before[before.length - 1]

  // The word being typed, and what comes before it
  const typing =
    last && last.to === pos && (last.kind === "word" || last.kind === "ident")
      ? last
      : null
  const from = typing ? typing.from : pos
  const prior = typing ? before.slice(0, -1) : before
  const p1 = prior[prior.length - 1]
  const p2 = prior[prior.length - 2]

  // alias.| → that table's columns
  if (p1?.kind === "punct" && p1.value === "." && p2) {
    const t = tableFor(query, p2.kind === "ident" ? p2.value : p2.text)
    return t ? { from, options: columnsOf(t, meta, false) } : null
  }

  // FROM | / JOIN | → tables (related ones first after JOIN)
  if (p1?.kind === "word" && (p1.value === "FROM" || p1.value === "JOIN"))
    return { from, options: tableOptions(query, meta, p1.value === "JOIN") }

  // FROM account | → an alias, or the next clause
  if (
    p2?.kind === "word" &&
    (p2.value === "FROM" || p2.value === "JOIN") &&
    p1?.kind !== "punct"
  )
    return { from, options: [...CLAUSE_KEYWORDS] }

  // ON | → join conditions from relationships
  if (p1?.value === "ON") {
    const joins = joinOptions(query, meta, prior)
    return { from, options: [...joins, ...allColumns(query, meta)] }
  }

  // col = | / col <> | / col IN (| / col IN (1, | → choice values
  const compared = comparedColumn(prior)
  if (compared) {
    const t = compared.qualifier
      ? tableFor(query, compared.qualifier)
      : query.tables.length === 1
        ? query.tables[0]
        : undefined
    const field = t && findField(meta, t.table, compared.column.toLowerCase())
    if (field?.options?.length)
      return {
        from,
        options: field.options.map((o) => ({
          label: String(o.value),
          detail: o.label,
          type: "enum",
        })),
      }
  }

  // Anywhere else: columns of the query's tables, then keywords and functions
  const clause = clauseAt(query, prior)
  const options: Suggestion[] = [
    ...allColumns(query, meta),
    ...CLAUSE_KEYWORDS.map((k) => ({ ...k, boost: -1 })),
  ]
  if (clause === "select") options.push(...AGGREGATES)
  if (clause === "where" || clause === "on") options.push(...DATE_FUNCTIONS)
  if (!query.tables.length && clause === "select")
    options.push(kw("FROM", "Name the table next", 1))
  return { from, options }
}

function clauseAt(query: SqlQuery, prior: { from: number }[]) {
  const last = prior[prior.length - 1]
  if (!last) return "other"
  const i = query.code.findIndex((t) => t.from === last.from)
  return i >= 0 ? query.clauses[i] : "other"
}

function tableOptions(
  query: SqlQuery,
  meta: EditorMeta,
  joining: boolean
): Suggestion[] {
  const related = new Map<string, string>()
  if (joining)
    for (const t of query.tables)
      for (const r of meta.relationships(t.table) ?? [])
        related.set(r.table, r.schemaName)
  return meta.tables.map((t) => ({
    label: t.logicalName,
    detail: t.displayName,
    info: related.has(t.logicalName)
      ? `Related: ${related.get(t.logicalName)}`
      : undefined,
    type: "class",
    boost: related.has(t.logicalName) ? 2 : 0,
  }))
}

function columnsOf(
  t: SqlTable,
  meta: EditorMeta,
  qualify: boolean
): Suggestion[] {
  const prefix = qualify ? `${t.alias ?? t.table}.` : ""
  return (meta.fields(t.table) ?? []).map((f) => ({
    label: `${prefix}${f.id}`,
    detail: f.label,
    info: typeLabel(f),
    type: "property",
  }))
}

/** Columns of every table in the query; qualified once there's more than one. */
function allColumns(query: SqlQuery, meta: EditorMeta): Suggestion[] {
  const qualify = query.tables.length > 1
  return query.tables.flatMap((t) => columnsOf(t, meta, qualify))
}

/** The last JOINed table matched to the tables before it, from relationships. */
function joinOptions(
  query: SqlQuery,
  meta: EditorMeta,
  prior: { from: number }[]
): Suggestion[] {
  const upTo = prior[prior.length - 1]?.from ?? 0
  const earlier = query.tables.filter((t) => t.from < upTo)
  const joined = earlier[earlier.length - 1]
  if (!joined) return []
  const name = (t: SqlTable) => t.alias ?? t.table
  const options: Suggestion[] = []
  for (const other of earlier.slice(0, -1))
    for (const r of meta.relationships(other.table) ?? [])
      if (r.table === joined.table) {
        const cond = `${name(joined)}.${r.from} = ${name(other)}.${r.to}`
        options.push({
          label: cond,
          detail: r.schemaName,
          type: "text",
          boost: 3,
        })
      }
  return options
}

/** The column just compared, when the cursor is where its value goes. */
function comparedColumn(
  prior: { kind: string; value: string; text: string }[]
) {
  let i = prior.length - 1
  // IN ( 1, 2, |
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
    /^(=|<>|!=)$/.test(prior[i].value) &&
    i === prior.length - 1
  )
    i -= 1
  else return null
  if (prior[i]?.value === "NOT") i--
  const col = prior[i]
  if (!col || (col.kind !== "word" && col.kind !== "ident")) return null
  const name = col.kind === "ident" ? col.value : col.text
  const qualifier =
    prior[i - 1]?.value === "." ? (prior[i - 2]?.text ?? null) : null
  return { column: name, qualifier }
}
