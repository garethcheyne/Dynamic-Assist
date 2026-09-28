/**
 * Checks a query against what the Dataverse Web API's SQL accepts, before it's
 * sent: one SELECT, named columns, INNER and LEFT joins on =, column-versus-
 * constant filters, and only the documented functions. Then against the org's
 * metadata. Each rule comes from the Microsoft Learn page linked below.
 */
import {
  AGGREGATE_FUNCTIONS,
  KEYWORDS,
  readSql,
  tableFor,
  type SqlToken,
} from "./sql-parse"
import type { Problem } from "./fetch-lint"
import { findField, type EditorMeta } from "./meta"

export const SQL_DOCS =
  "https://learn.microsoft.com/power-apps/developer/data-platform/webapi/query/sql"
const SUPPORTED = `${SQL_DOCS}#supported-sql`
const FILTERS = `${SQL_DOCS}#filter-rows`
const JOINS = `${SQL_DOCS}#join-tables`
const DATES = `${SQL_DOCS}#using-dateadd-and-getutcdate-functions`

/** Functions Dataverse SQL has, besides the aggregates. */
const FUNCTIONS = new Set(["DATEADD", "GETUTCDATE"])

const UNSUPPORTED: Record<string, string> = {
  HAVING: "HAVING isn't supported: filter with WHERE before grouping",
  UNION: "UNION isn't supported: run the queries separately",
  INTERSECT: "INTERSECT isn't supported",
  EXCEPT: "EXCEPT isn't supported",
  CASE: "CASE isn't supported",
  EXISTS: "EXISTS isn't supported",
  OVER: "Window functions aren't supported",
  RIGHT: "RIGHT JOIN isn't supported: swap the tables and use LEFT JOIN",
  FULL: "FULL JOIN isn't supported",
  CROSS: "CROSS JOIN and CROSS APPLY aren't supported",
  APPLY: "APPLY isn't supported",
  INTO: "SELECT INTO isn't supported: Dataverse SQL is read-only",
}

export function lintSql(text: string, meta: EditorMeta | null): Problem[] {
  if (!text.trim()) return []
  const q = readSql(text)
  const { code } = q
  const problems: Problem[] = []
  const add = (
    at: { from: number; to: number },
    severity: Problem["severity"],
    message: string,
    link = SUPPORTED
  ) => problems.push({ from: at.from, to: at.to, severity, message, link })

  if (code.length === 0) return []

  // One SELECT statement
  const first = code[0]
  if (first.value === "WITH")
    add(first, "error", "Common table expressions (WITH) aren't supported")
  else if (first.value !== "SELECT")
    add(first, "error", "Only SELECT queries: Dataverse SQL is read-only")
  const semis = code.filter((t) => t.kind === "punct" && t.value === ";")
  const lastCode = code[code.length - 1]
  for (const s of semis)
    if (s !== lastCode)
      add(
        s,
        "error",
        "One statement per query: Dataverse doesn't return several result sets"
      )

  code.forEach((t, i) => {
    const prev = code[i - 1]
    const next = code[i + 1]
    if (t.kind === "word" && UNSUPPORTED[t.value])
      add(t, "error", UNSUPPORTED[t.value])
    // SELECT * and alias.*
    if (t.kind === "op" && t.value === "*") {
      const inCount = prev?.value === "(" && code[i - 2]?.value === "COUNT"
      const star =
        prev?.value === "SELECT" ||
        prev?.value === "DISTINCT" ||
        prev?.value === "," ||
        prev?.value === "."
      if (star && !inCount && q.clauses[i] === "select")
        add(
          t,
          "error",
          "Name the columns: Dataverse SQL doesn't support SELECT *",
          `${SQL_DOCS}#select-columns`
        )
    }
    // Subqueries
    if (t.value === "SELECT" && prev?.kind === "punct" && prev.value === "(")
      add(t, "error", "Subqueries aren't supported")
    // Functions
    if (t.kind === "word" && next?.kind === "punct" && next.value === "(") {
      const fn = t.value
      if (AGGREGATE_FUNCTIONS.has(fn)) {
        if (q.clauses[i] === "where" || q.clauses[i] === "on")
          add(
            t,
            "error",
            `${fn}() can't be used in ${q.clauses[i] === "on" ? "ON" : "WHERE"}`
          )
      } else if (FUNCTIONS.has(fn)) {
        if (q.clauses[i] !== "where" && q.clauses[i] !== "on")
          add(t, "error", `${fn}() only works in WHERE and ON`, DATES)
      } else if (!KEYWORDS.has(fn))
        add(t, "error", `Dataverse SQL has no ${t.text}() function`, SUPPORTED)
    }
    // = NULL
    if (
      t.kind === "op" &&
      (t.value === "=" || t.value === "<>" || t.value === "!=") &&
      next?.value === "NULL"
    )
      add(
        next,
        "warning",
        `Use IS ${t.value === "=" ? "" : "NOT "}NULL: comparing with NULL never matches`,
        FILTERS
      )
  })

  // Functions can't take columns
  for (const c of q.columns)
    if (c.inFunction)
      add(
        c,
        "error",
        `${c.inFunction}() can't take a column: apply it to a constant and compare the column with it`,
        DATES
      )

  // WHERE compares a column with a constant, never two columns
  code.forEach((t, i) => {
    if (t.kind !== "op" || !/^(=|<>|!=|<|>|<=|>=)$/.test(t.value)) return
    const clause = q.clauses[i]
    if (clause !== "where") return
    const left = columnEndingAt(i - 1)
    const right = columnStartingAt(i + 1)
    if (left && right)
      add(
        { from: left.from, to: right.to },
        "error",
        "Compare a column with a value: comparing two columns isn't supported",
        FILTERS
      )
  })

  // JOIN … ON must match the two tables' columns with =
  code.forEach((t, i) => {
    if (t.value !== "ON") return
    const firstOp = code
      .slice(i + 1)
      .find((x) => x.kind === "op" || x.value === "LIKE" || x.value === "IN")
    if (firstOp && firstOp.value !== "=")
      add(
        firstOp,
        "error",
        "Join with = between the two tables' columns (other conditions go after AND)",
        JOINS
      )
  })

  function columnEndingAt(i: number) {
    return q.columns.find((c) => c.index === i)
  }
  function columnStartingAt(i: number) {
    // A qualified column starts at its qualifier
    return q.columns.find(
      (c) => c.index === i || (c.qualifier && c.index === i + 2)
    )
  }

  // Leading wildcards
  code.forEach((t, i) => {
    if (
      t.value === "LIKE" &&
      code[i + 1]?.kind === "string" &&
      code[i + 1].value.startsWith("%")
    )
      add(
        code[i + 1],
        "info",
        "A leading % can't use an index and scans the whole table",
        "https://learn.microsoft.com/power-apps/developer/data-platform/query-antipatterns"
      )
  })

  // --- Metadata ---------------------------------------------------------------
  if (!meta || meta.tables.length === 0) return sorted(problems)
  if (
    q.tables.length === 0 &&
    first.value === "SELECT" &&
    !code.some((t) => t.value === "FROM")
  )
    add(first, "error", "Say which table: SELECT … FROM table")

  for (const t of q.tables)
    if (!meta.table(t.table)) add(t, "error", `There's no table ${t.table}`)

  const inScope = q.tables.filter((t) => meta.table(t.table))
  for (const c of q.columns) {
    if (!c.column) continue
    const name = c.column.toLowerCase()
    if (c.qualifier) {
      const t = tableFor(q, c.qualifier)
      if (!t) {
        add(
          { from: c.from, to: c.to },
          "error",
          `${c.qualifier} isn't a table or alias in this query`
        )
        continue
      }
      const fields = meta.fields(t.table)
      if (fields && !hasColumn(fields, name))
        add(c, "error", `${t.table} has no column ${c.column}`)
    } else {
      if (
        q.columnAliases.has(name) &&
        (c.clause === "order" || c.clause === "group")
      )
        continue
      const loaded = inScope.map((t) => meta.fields(t.table))
      if (loaded.some((f) => !f)) continue
      const owners = inScope.filter((_, i) => hasColumn(loaded[i]!, name))
      if (owners.length === 0 && inScope.length)
        add(
          c,
          "error",
          inScope.length === 1
            ? `${inScope[0].table} has no column ${c.column}`
            : `No table in the query has a column ${c.column}`
        )
      else if (owners.length > 1)
        add(
          c,
          "warning",
          `${c.column} is on ${owners.map((o) => o.alias ?? o.table).join(" and ")}: say which (alias.${c.column})`
        )
    }
  }

  // Choice columns compare with the option's number, not its label
  code.forEach((t, i) => {
    if (
      t.kind !== "op" ||
      !/^(=|<>|!=)$/.test(t.value) ||
      code[i + 1]?.kind !== "string"
    )
      return
    const col = columnEndingAt(i - 1)
    if (!col) return
    const table = col.qualifier
      ? tableFor(q, col.qualifier)?.table
      : inScope.length === 1
        ? inScope[0].table
        : undefined
    const field = findField(meta, table, col.column.toLowerCase())
    if (!field?.options?.length) return
    const value = code[i + 1].value
    const byLabel = field.options.find(
      (o) => o.label.toLowerCase() === value.toLowerCase()
    )
    add(
      code[i + 1],
      "warning",
      byLabel
        ? `Use the value ${byLabel.value}, not the label '${value}'`
        : `${col.column} is a choice: compare with a number`
    )
  })

  return sorted(problems)
}

/** Lookups and choices also answer to their name columns (ownerid → owneridname). */
function hasColumn(fields: { id: string }[], name: string) {
  return fields.some(
    (f) =>
      f.id === name ||
      `${f.id}name` === name ||
      `${f.id}yominame` === name ||
      `${f.id}type` === name
  )
}

const sorted = (problems: Problem[]) => problems.sort((a, b) => a.from - b.from)

export type { SqlToken }
