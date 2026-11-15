/**
 * SQL to a Business Central query. Business Central online has no SQL engine: it
 * filters and reads through the companion app. So SQL here is a way of writing
 * the query the builder already runs (BcQuery), compiled in the browser: what
 * can't be compiled says why, with where it is. Aggregates, which the companion
 * doesn't do, are added up here from the rows it returns (aggregate.ts).
 */
import type { Problem } from "@/platforms/ce/query/editor/fetch-lint"
import { sqlTokens, type SqlToken } from "@/platforms/ce/query/editor/sql-parse"

import type { BcField, BcFilter, BcJoin, BcQuery, BcTable } from "../bridge"

export type BcSqlMeta = {
  tables: BcTable[]
  /** A table's fields; null until they've been loaded */
  fields: (table: number) => BcField[] | null
}

export type AggregateFn = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"

export type Measure = {
  fn: AggregateFn
  /** The field added up; null for COUNT(*) */
  field: number | null
  label: string
}

export type BcAggregate = {
  /** Fields of the main table to group by, in order */
  groupBy: number[]
  measures: Measure[]
  /** Result columns to sort by, by label or field number, and which way */
  order: { key: string; descending: boolean }[]
  /** TOP: applied to the groups, not to the rows they're made from */
  top: number | null
}

export type BcSqlResult = {
  /** Null while there are errors, or the tables aren't loaded */
  query: BcQuery | null
  /** Set when the query adds rows up, so it runs on all of them */
  aggregate: BcAggregate | null
  problems: Problem[]
}

const low = (s: string | null | undefined) => (s ?? "").toLowerCase()

export function findTable(meta: BcSqlMeta, name: string) {
  const n = low(name)
  return (
    meta.tables.find((t) => String(t.id) === n) ??
    meta.tables.find((t) => low(t.name) === n) ??
    meta.tables.find((t) => low(t.caption) === n)
  )
}

export function findField(fields: BcField[], name: string) {
  const n = low(name)
  return (
    fields.find((f) => String(f.no) === n) ??
    fields.find((f) => low(f.name) === n) ??
    fields.find((f) => low(f.caption) === n)
  )
}

/**
 * A value as a Business Central filter takes it: these characters mean
 * something in a filter, so a value holding them goes in single quotes.
 */
export function quoteFilter(value: string) {
  if (value === "") return "''"
  return /[&|()<>=.*@?']/.test(value) || value !== value.trim()
    ? `'${value.replace(/'/g, "''")}'`
    : value
}

/** LIKE's % and _ as a filter's * and ?, with what's between them quoted. */
function likeFilter(pattern: string) {
  return pattern
    .split(/([%_])/)
    .map((part) =>
      part === "%" ? "*" : part === "_" ? "?" : part && quoteFilter(part)
    )
    .join("")
}

const pad = (n: number) => String(n).padStart(2, "0")
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const DATE_UNITS: Record<string, (d: Date, n: number) => void> = {
  DAY: (d, n) => d.setDate(d.getDate() + n),
  DD: (d, n) => d.setDate(d.getDate() + n),
  D: (d, n) => d.setDate(d.getDate() + n),
  WEEK: (d, n) => d.setDate(d.getDate() + n * 7),
  WK: (d, n) => d.setDate(d.getDate() + n * 7),
  MONTH: (d, n) => d.setMonth(d.getMonth() + n),
  MM: (d, n) => d.setMonth(d.getMonth() + n),
  YEAR: (d, n) => d.setFullYear(d.getFullYear() + n),
  YY: (d, n) => d.setFullYear(d.getFullYear() + n),
  YYYY: (d, n) => d.setFullYear(d.getFullYear() + n),
}

/** Now, as these functions read it */
const TODAY_FUNCTIONS = new Set(["TODAY", "GETDATE", "GETUTCDATE", "NOW"])
const AGGREGATES = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"])

const NOT_HERE: Record<string, string> = {
  UNION: "UNION can't be translated: run the queries separately",
  INTERSECT: "INTERSECT can't be translated",
  EXCEPT: "EXCEPT can't be translated",
  CASE: "CASE can't be translated",
  EXISTS: "EXISTS can't be translated",
  HAVING: "HAVING can't be translated: filter with WHERE before grouping",
  OFFSET: "OFFSET can't be translated: raise TOP, or add a filter",
  RIGHT: "RIGHT JOIN can't be translated: swap the tables and use LEFT JOIN",
  FULL: "FULL JOIN can't be translated",
  CROSS: "CROSS JOIN can't be translated",
  WITH: "WITH can't be translated",
}

type Scope = {
  alias: string | null
  table: BcTable
  fields: BcField[]
  /** Null for the main table */
  join: BcJoin | null
}

type Output = { text: string; to: number }

/** Compiles SQL. `now` is only for tests. */
export function fromSql(
  text: string,
  meta: BcSqlMeta,
  now: () => Date = () => new Date()
): BcSqlResult {
  const code = sqlTokens(text).filter((t) => t.kind !== "comment")
  const problems: Problem[] = []
  const add = (
    at: { from: number; to: number } | undefined,
    message: string,
    severity: Problem["severity"] = "error"
  ) => {
    const place = at ?? code[code.length - 1] ?? { from: 0, to: 0 }
    problems.push({ from: place.from, to: place.to, severity, message })
  }
  const empty = (): BcSqlResult => ({
    query: null,
    aggregate: null,
    problems: problems.sort((a, b) => a.from - b.from),
  })
  if (!code.length) return empty()

  const word = (i: number) => (code[i]?.kind === "word" ? code[i].value : "")
  const isP = (i: number, p: string) =>
    code[i]?.kind === "punct" && code[i].value === p
  const isName = (i: number) => {
    const t = code[i]
    return (
      !!t &&
      (t.kind === "ident" || (t.kind === "word" && !RESERVED.has(t.value)))
    )
  }
  const nameAt = (i: number) =>
    code[i].kind === "ident" ? code[i].value : code[i].text

  if (word(0) !== "SELECT") {
    add(
      code[0],
      "Only SELECT queries: this only reads, and Business Central's data can't be changed from here"
    )
    return empty()
  }
  code.forEach((t) => {
    if (t.kind === "word" && NOT_HERE[t.value]) add(t, NOT_HERE[t.value])
  })
  const semis = code.filter((t) => t.kind === "punct" && t.value === ";")
  if (semis.some((s) => s !== code[code.length - 1]))
    add(semis[0], "One statement per query")

  // --- Where the clauses are, at the top level -------------------------------
  const at = { from: -1, where: -1, group: -1, order: -1 }
  let depth = 0
  code.forEach((t, i) => {
    if (t.kind === "punct" && t.value === "(") depth++
    if (t.kind === "punct" && t.value === ")") depth--
    if (depth !== 0 || t.kind !== "word") return
    if (t.value === "FROM" && at.from < 0) at.from = i
    if (t.value === "WHERE" && at.where < 0) at.where = i
    if (t.value === "GROUP" && word(i + 1) === "BY") at.group = i
    if (t.value === "ORDER" && word(i + 1) === "BY") at.order = i
  })
  if (at.from < 0) {
    add(code[0], "Say which table: SELECT … FROM table")
    return empty()
  }
  const end = code.length - (isP(code.length - 1, ";") ? 1 : 0)
  const nextClause = (after: number) =>
    Math.min(
      ...[at.where, at.group, at.order, end].filter((x) => x > after),
      end
    )

  // --- FROM and JOIN ----------------------------------------------------------
  const scopes: Scope[] = []
  let i = at.from + 1
  const fromEnd = nextClause(at.from)
  const readTable = (asJoin: boolean): Scope | null => {
    if (!isName(i) && code[i]?.kind !== "number") {
      add(code[i] ?? code[i - 1], "Name a table here")
      return null
    }
    const token = code[i]
    const name = token.kind === "number" ? token.text : nameAt(i)
    i++
    if (word(i) === "AS") i++
    let alias: string | null = null
    if (isName(i)) alias = nameAt(i++)
    const table = findTable(meta, name)
    if (!table) {
      add(token, `There's no table ${name}, or you can't read it`)
      return null
    }
    const fields = meta.fields(table.id)
    if (!fields) return null
    return {
      alias,
      table,
      fields,
      join: asJoin
        ? {
            id: alias ?? `join${scopes.length}`,
            field: 0,
            table: table.id,
            key: 0,
            fields: [],
            filters: [],
            inner: false,
          }
        : null,
    }
  }
  const main = readTable(false)
  if (!main) return empty()
  scopes.push(main)
  const scopeNamed = (q: string) => {
    const n = low(q)
    return (
      scopes.find((s) => low(s.alias) === n) ??
      scopes.find(
        (s) =>
          low(s.table.name) === n ||
          low(s.table.caption) === n ||
          String(s.table.id) === n
      )
    )
  }

  /** [scope.]field at i; moves past it. Null with a problem if it's no field. */
  const readColumn = (): { scope: Scope; field: BcField } | null => {
    if (!isName(i) && code[i]?.kind !== "number") {
      add(code[i] ?? code[i - 1], "Name a field here")
      return null
    }
    const first = code[i]
    const firstName = first.kind === "number" ? first.text : nameAt(i)
    i++
    if (isP(i, ".")) {
      i++
      const scope = scopeNamed(firstName)
      if (!scope) {
        add(first, `${firstName} isn't a table or alias in this query`)
        if (isName(i)) i++
        return null
      }
      if (!isName(i) && code[i]?.kind !== "number") {
        add(code[i - 1], `Name a field of ${scope.table.name}`)
        return null
      }
      const token = code[i]
      const name = token.kind === "number" ? token.text : nameAt(i)
      i++
      const field = findField(scope.fields, name)
      if (!field) {
        add(token, `${scope.table.name} has no field ${name}`)
        return null
      }
      return { scope, field }
    }
    const owners = scopes.flatMap((s) => {
      const f = findField(s.fields, firstName)
      return f ? [{ scope: s, field: f }] : []
    })
    if (!owners.length) {
      add(
        first,
        scopes.length === 1
          ? `${main.table.name} has no field ${firstName}`
          : `No table in the query has a field ${firstName}`
      )
      return null
    }
    if (owners.length > 1)
      add(
        first,
        `${firstName} is on ${owners.map((o) => o.scope.alias ?? o.scope.table.name).join(" and ")}: this means the first; say which to be sure`,
        "warning"
      )
    return owners[0]
  }

  while (i < fromEnd) {
    let inner = true
    if (word(i) === "LEFT") {
      inner = false
      i++
      if (word(i) === "OUTER") i++
    } else if (word(i) === "INNER") i++
    if (word(i) !== "JOIN") {
      add(code[i], `I can't read ${code[i].text} here: expected JOIN or WHERE`)
      break
    }
    i++
    const scope = readTable(true)
    if (!scope) return empty()
    scope.join!.inner = inner
    scopes.push(scope)
    if (word(i) !== "ON") {
      add(code[i - 1], "A join needs ON lookup = key")
      break
    }
    const onToken = code[i]
    i++
    const left = readColumn()
    if (!(code[i]?.kind === "op" && code[i].value === "=")) {
      add(
        code[i] ?? onToken,
        "Join with = between a lookup and the other table's key"
      )
      break
    }
    i++
    const right = readColumn()
    if (!left || !right) break
    const lookup: { scope: Scope; field: BcField } =
      left.scope === main ? left : right
    const key: { scope: Scope; field: BcField } =
      left.scope === main ? right : left
    if (lookup.scope !== main || key.scope !== scope) {
      add(
        onToken,
        `Join through a field of ${main.table.name}: Business Central joins follow a lookup on the main table`
      )
      break
    }
    if (
      lookup.field.relationTable !== undefined &&
      lookup.field.relationTable !== scope.table.id
    ) {
      add(
        onToken,
        `${lookup.field.name} looks up table ${lookup.field.relationTable}, not ${scope.table.name}`
      )
      break
    }
    if (lookup.field.relationTable === undefined)
      add(
        onToken,
        `${lookup.field.name} isn't a lookup to ${scope.table.name}, so this matches on its value alone`,
        "info"
      )
    scope.join!.field = lookup.field.no
    scope.join!.key = key.field.no
    if (word(i) === "AND" && i < fromEnd) {
      add(code[i], "A join has one condition: put other conditions in WHERE")
      break
    }
  }

  // --- SELECT -----------------------------------------------------------------
  const query: BcQuery = {
    table: main.table.id,
    fields: [],
    filters: [],
    sort: [],
    descending: false,
    top: null,
  }
  const aggregate: BcAggregate = {
    groupBy: [],
    measures: [],
    order: [],
    top: null,
  }
  /** Plain columns of the main table, to check against GROUP BY */
  const plain: { no: number; token: SqlToken }[] = []
  i = 1
  if (word(i) === "DISTINCT") {
    add(
      code[i],
      "DISTINCT can't be translated. For one row per value, GROUP BY those fields"
    )
    i++
  }
  if (word(i) === "TOP") {
    i++
    const paren = isP(i, "(")
    if (paren) i++
    if (code[i]?.kind === "number") query.top = Number(code[i].value)
    else add(code[i] ?? code[i - 1], "TOP takes a number of rows")
    i++
    if (paren) i++
  }
  const addColumn = (scope: Scope, no: number) => {
    const list = scope.join ? scope.join.fields : query.fields
    if (!list.includes(no)) list.push(no)
  }
  const selectable = (f: BcField) =>
    f.enabled && !["BLOB", "Media", "MediaSet"].includes(f.type)
  while (i < at.from) {
    if (isP(i, ",")) {
      i++
      continue
    }
    const token = code[i]
    // *, alias.*
    if (token.kind === "op" && token.value === "*") {
      main.fields
        .filter((f) => selectable(f) && f.class === "Normal")
        .forEach((f) => addColumn(main, f.no))
      i++
      continue
    }
    if (isName(i) && isP(i + 1, ".") && code[i + 2]?.value === "*") {
      const scope = scopeNamed(nameAt(i))
      if (!scope)
        add(token, `${nameAt(i)} isn't a table or alias in this query`)
      else
        scope.fields
          .filter((f) => selectable(f) && f.class === "Normal")
          .forEach((f) => addColumn(scope, f.no))
      i += 3
      continue
    }
    // COUNT(*), SUM(x)…
    if (token.kind === "word" && isP(i + 1, "(")) {
      const fn = token.value
      if (!AGGREGATES.has(fn)) {
        add(
          token,
          `${token.text}() can't go in SELECT here. In SELECT: COUNT, SUM, AVG, MIN and MAX`
        )
        i = skipCall(i + 1)
        continue
      }
      i += 2
      let field: number | null = null
      let shown = "*"
      if (code[i]?.value === "*") {
        if (fn !== "COUNT")
          add(code[i], `${fn}(*) has nothing to add up: name a field`)
        i++
      } else {
        const column = readColumn()
        if (column) {
          if (column.scope !== main)
            add(
              token,
              `${fn}() works on ${main.table.name}'s fields: joined ones can't be added up`
            )
          field = column.field.no
          shown = column.field.caption || column.field.name
          addColumn(main, column.field.no)
        }
      }
      if (isP(i, ")")) i++
      else add(code[i] ?? token, `Close ${fn}( with a )`)
      let label = `${fn}(${shown})`
      if (word(i) === "AS") i++
      if (isName(i)) label = nameAt(i++)
      aggregate.measures.push({ fn: fn as AggregateFn, field, label })
      continue
    }
    // A field, with or without an alias
    const before = i
    const column = readColumn()
    if (column) {
      addColumn(column.scope, column.field.no)
      if (column.scope === main)
        plain.push({ no: column.field.no, token: code[before] })
    }
    if (word(i) === "AS" || isName(i)) {
      if (word(i) === "AS") i++
      if (isName(i)) {
        add(
          code[i],
          "Columns keep Business Central's names: this alias isn't used",
          "info"
        )
        i++
      }
    }
    if (i === before) i++
  }
  function skipCall(open: number) {
    let d = 0
    let j = open
    do {
      if (isP(j, "(")) d++
      if (isP(j, ")")) d--
      j++
    } while (d > 0 && j < code.length)
    return j
  }

  // --- WHERE ------------------------------------------------------------------
  const whereOf = (scope: Scope) =>
    scope.join ? scope.join.filters : query.filters

  /** A value on the right of a comparison, as filter text. */
  const readValue = (): Output | null => {
    const t = code[i]
    if (!t) {
      add(code[code.length - 1], "A value goes here")
      return null
    }
    if (t.kind === "string") {
      i++
      return { text: quoteFilter(t.value), to: i }
    }
    if (t.kind === "number") {
      i++
      return { text: t.text, to: i }
    }
    if (t.kind === "op" && t.value === "-" && code[i + 1]?.kind === "number") {
      i += 2
      return { text: `-${code[i - 1].text}`, to: i }
    }
    if (t.kind === "word" && t.value === "NULL") {
      i++
      return { text: "''", to: i }
    }
    if (t.kind === "word" && (t.value === "TRUE" || t.value === "FALSE")) {
      i++
      return { text: t.value === "TRUE" ? "Yes" : "No", to: i }
    }
    if (t.kind === "word" && isP(i + 1, "(")) {
      const date = readDate()
      return date === null ? null : { text: date.filter, to: i }
    }
    add(
      t,
      "Compare a field with a value: comparing two fields can't be translated"
    )
    i++
    return null
  }

  /** A date function: for a filter, and as a date when there's arithmetic to do. */
  function readDate(): { filter: string; date: Date | null } | null {
    const t = code[i]
    const fn = t.value
    if (TODAY_FUNCTIONS.has(fn)) {
      i += 2
      if (isP(i, ")")) i++
      return { filter: "t", date: now() }
    }
    if (fn === "WORKDATE") {
      i += 2
      if (isP(i, ")")) i++
      return { filter: "w", date: null }
    }
    if (fn === "DATEADD") {
      i += 2
      const unit = code[i]
      const apply = unit && DATE_UNITS[unit.value?.toUpperCase()]
      if (!apply) {
        add(unit ?? t, "DATEADD's first argument is day, week, month or year")
        i = skipCall(i - 1)
        return null
      }
      i++
      if (isP(i, ",")) i++
      let sign = 1
      if (code[i]?.value === "-") {
        sign = -1
        i++
      }
      if (code[i]?.kind !== "number") {
        add(code[i] ?? unit, "DATEADD's second argument is a number")
        i = skipCall(i - 1)
        return null
      }
      const amount = sign * Number(code[i].value)
      i++
      if (isP(i, ",")) i++
      let base: Date | null = null
      if (code[i]?.kind === "string") {
        base = new Date(`${code[i].value}T00:00:00`)
        i++
      } else if (code[i]?.kind === "word" && isP(i + 1, "(")) {
        const inner = readDate()
        if (!inner) return null
        if (!inner.date) {
          add(
            t,
            "DATEADD can't start from WORKDATE(): the work date isn't known here"
          )
          return null
        }
        base = inner.date
      }
      if (!base || Number.isNaN(base.getTime())) {
        add(t, "DATEADD's last argument is a date, or TODAY()")
        return null
      }
      if (isP(i, ")")) i++
      else add(code[i] ?? t, "Close DATEADD( with a )")
      const moved = new Date(base)
      apply(moved, amount)
      return { filter: isoDate(moved), date: moved }
    }
    add(
      t,
      `${t.text}() can't be translated. In WHERE: TODAY, WORKDATE, DATEADD, YEAR, UPPER and LOWER`
    )
    i = skipCall(i + 1)
    return null
  }

  type Condition = { scope: Scope; field: BcField; filter: string }

  /** One condition: field op value, or UPPER/LOWER/YEAR(field) op value. */
  const readCondition = (): Condition | null => {
    let caseless = false
    let year = false
    const start = code[i]
    if (start?.kind === "word" && isP(i + 1, "(")) {
      const fn = start.value
      if (fn === "UPPER" || fn === "LOWER") caseless = true
      else if (fn === "YEAR") year = true
      else {
        add(
          start,
          AGGREGATES.has(fn)
            ? `${fn}() can't go in WHERE: it's worked out after filtering`
            : `${start.text}() can't be translated on a field. On fields: YEAR, UPPER and LOWER`
        )
        i = skipCall(i + 1)
        return null
      }
      i += 2
    }
    const column = readColumn()
    if (!column) {
      while (
        i < code.length &&
        !["AND", "OR"].includes(word(i)) &&
        !isP(i, ")")
      )
        i++
      return null
    }
    if (caseless || year) {
      if (isP(i, ")")) i++
      else add(code[i] ?? start, "Close the function with a )")
    }
    const done = (filter: string): Condition => ({ ...column, filter })
    const prefix = caseless ? "@" : ""
    const t = code[i]
    if (!t) {
      add(start, "This condition isn't finished")
      return null
    }

    if (year) {
      const isEq = t.kind === "op" && t.value === "="
      i++
      if (!isEq || code[i]?.kind !== "number") {
        add(t, "YEAR(field) compares with = and a year: YEAR(field) = 2025")
        return null
      }
      const y = code[i].value
      i++
      return done(`${y}-01-01..${y}-12-31`)
    }

    if (t.kind === "word" && t.value === "IS") {
      i++
      const not = word(i) === "NOT"
      if (not) i++
      if (word(i) !== "NULL") {
        add(code[i] ?? t, "IS goes with NULL or NOT NULL")
        return null
      }
      i++
      return done(not ? "<>''" : "''")
    }
    const negated = t.kind === "word" && t.value === "NOT"
    if (negated) i++
    const verb = code[i]
    if (verb?.kind === "word" && verb.value === "LIKE") {
      i++
      const pattern = code[i]
      if (pattern?.kind !== "string") {
        add(pattern ?? verb, "LIKE takes a pattern in quotes, such as 'Con%'")
        return null
      }
      i++
      const filter = `@${likeFilter(pattern.value)}`
      return done(negated ? `<>${filter}` : filter)
    }
    if (verb?.kind === "word" && verb.value === "BETWEEN") {
      i++
      const low2 = readValue()
      if (word(i) !== "AND") {
        add(code[i] ?? verb, "BETWEEN needs AND: BETWEEN 10 AND 20")
        return null
      }
      i++
      const high = readValue()
      if (!low2 || !high) return null
      if (negated) {
        add(verb, "NOT BETWEEN can't be translated: use < and >")
        return null
      }
      return done(`${low2.text}..${high.text}`)
    }
    if (verb?.kind === "word" && verb.value === "IN") {
      i++
      if (!isP(i, "(")) {
        add(code[i] ?? verb, "IN takes a list in brackets: IN ('NZ', 'AU')")
        return null
      }
      i++
      const values: string[] = []
      while (i < code.length && !isP(i, ")")) {
        if (isP(i, ",")) {
          i++
          continue
        }
        if (word(i) === "SELECT") {
          add(code[i], "Subqueries can't be translated")
          i = skipCall(i - 1) - 1
          return null
        }
        const v = readValue()
        if (v) values.push(v.text)
      }
      i++
      if (!values.length) {
        add(verb, "IN needs at least one value")
        return null
      }
      return done(
        negated
          ? values.map((v) => `<>${v}`).join("&")
          : values.map((v) => `${prefix}${v}`).join("|")
      )
    }
    if (negated) {
      add(verb ?? t, "NOT goes before LIKE, IN or BETWEEN here")
      return null
    }
    if (t.kind === "op" && /^(=|<>|!=|<|<=|>|>=)$/.test(t.value)) {
      i++
      if (word(i) === "NULL") {
        add(
          code[i],
          `Use IS ${t.value === "=" ? "" : "NOT "}NULL: fields in Business Central are blank, not NULL`,
          "warning"
        )
      }
      if (isName(i) && !isP(i + 1, "(")) {
        add(
          code[i],
          "Compare a field with a value: comparing two fields can't be translated. Text values go in single quotes"
        )
        i++
        return null
      }
      const value = readValue()
      if (!value) return null
      const op = t.value === "!=" ? "<>" : t.value === "=" ? "" : t.value
      return done(`${op}${prefix}${value.text}`)
    }
    add(t, "Expected =, <>, <, >, LIKE, IN, BETWEEN or IS here")
    i++
    return null
  }

  /** ORs outside brackets: beside an AND, SQL reads them differently (below) */
  const bareOrs: SqlToken[] = []

  /** condition [OR condition…], or the same in brackets: all on one field. */
  const readGroup = (): Condition | null => {
    const bracket = isP(i, "(")
    if (bracket) i++
    const firstToken = code[i]
    const first = bracket && isP(i, "(") ? readGroup() : readCondition()
    if (!first) {
      if (bracket) {
        let d = 1
        while (i < code.length && d > 0) {
          if (isP(i, "(")) d++
          if (isP(i, ")")) d--
          i++
        }
      }
      return null
    }
    const alternatives = [first.filter]
    while (word(i) === "OR") {
      const orToken = code[i]
      if (!bracket) bareOrs.push(orToken)
      i++
      const next = readCondition()
      if (!next) continue
      if (next.field.no !== first.field.no || next.scope !== first.scope)
        add(
          orToken,
          `OR across different fields can't be translated: Business Central filters each field on its own, so ${first.field.name} and ${next.field.name} can only both apply, with AND`
        )
      else alternatives.push(next.filter)
    }
    if (bracket) {
      if (isP(i, ")")) i++
      else
        add(
          code[i] ?? firstToken,
          word(i) === "AND"
            ? "AND inside brackets can't be translated: take these brackets off"
            : "Close the bracket with a )"
        )
    }
    return { ...first, filter: alternatives.join("|") }
  }

  if (at.where >= 0) {
    i = at.where + 1
    const whereEnd = nextClause(at.where)
    /** Filters so far, by scope and field: conditions on one field combine */
    const collected = new Map<string, Condition[]>()
    let andBetween = false
    while (i < whereEnd) {
      const before = i
      const condition = readGroup()
      if (condition) {
        const key = `${scopes.indexOf(condition.scope)}/${condition.field.no}`
        collected.set(key, [...(collected.get(key) ?? []), condition])
      }
      if (word(i) === "AND") {
        andBetween = true
        i++
      } else if (i < whereEnd && i === before) i++
      else if (i < whereEnd && !isP(i, ")") && !condition) {
        while (i < whereEnd && word(i) !== "AND") i++
        if (word(i) === "AND") i++
      }
    }
    // a AND b OR c means (a AND b) OR c in SQL, and filters would run it as
    // a AND (b OR c): different rows, so it needs brackets to say which is meant
    if (andBetween && bareOrs.length)
      add(
        bareOrs[0],
        "AND and OR are mixed without brackets, and SQL does AND first: bracket the ORs, such as (City = 'A' OR City = 'B') AND Name = 'C'"
      )
    for (const group of collected.values()) {
      const filter: BcFilter = {
        field: group[0].field.no,
        filter:
          group.length === 1
            ? group[0].filter
            : group
                .map((c) =>
                  c.filter.includes("|") ? `(${c.filter})` : c.filter
                )
                .join("&"),
      }
      whereOf(group[0].scope).push(filter)
    }
  }

  // --- GROUP BY ---------------------------------------------------------------
  const grouping = at.group >= 0
  if (grouping) {
    i = at.group + 2
    const groupEnd = nextClause(at.group + 1)
    while (i < groupEnd) {
      if (isP(i, ",")) {
        i++
        continue
      }
      const token = code[i]
      const column = readColumn()
      if (!column) {
        i = Math.max(i, code.indexOf(token) + 1)
        continue
      }
      if (column.scope !== main)
        add(
          token,
          `Group by ${main.table.name}'s fields: joined ones can't be grouped on`
        )
      else aggregate.groupBy.push(column.field.no)
      addColumn(main, column.field.no)
    }
  }
  const aggregating = grouping || aggregate.measures.length > 0
  if (aggregating) {
    for (const p of plain)
      if (!aggregate.groupBy.includes(p.no))
        add(
          p.token,
          `With COUNT, SUM and the like, every other field needs to be in GROUP BY`
        )
    if (scopes.length > 1)
      add(
        code[at.from],
        "Adding up across a join can't be translated: filter with the join's own table first, or leave it out"
      )
  }

  // --- ORDER BY ---------------------------------------------------------------
  if (at.order >= 0) {
    i = at.order + 2
    const directions = new Set<boolean>()
    while (i < end) {
      if (isP(i, ",")) {
        i++
        continue
      }
      const token = code[i]
      let key: string | null = null
      if (aggregating && token && isName(i)) {
        const label = nameAt(i)
        const measure = aggregate.measures.find(
          (m) => low(m.label) === low(label)
        )
        if (measure) {
          key = measure.label
          i++
        }
      }
      if (aggregating && !key && token?.kind === "word" && isP(i + 1, "(")) {
        const fn = token.value
        const closes = skipCall(i + 1)
        const inside = code
          .slice(i + 2, closes - 1)
          .map((x) => (x.kind === "ident" ? x.value : x.text))
          .join("")
        const measure: Measure | undefined = aggregate.measures.find(
          (m) =>
            m.fn === fn &&
            (inside === "*"
              ? m.field === null
              : m.field === findField(main.fields, inside)?.no)
        )
        if (measure) key = measure.label
        else add(token, `Put ${fn}(${inside}) in SELECT to sort by it`)
        i = closes
      }
      let column: { scope: Scope; field: BcField } | null = null
      if (!key && !(aggregating && token?.kind === "word" && isP(i, ")"))) {
        const position = i
        column = key ? null : readColumn()
        if (!column && i === position) i++
      }
      const descending = word(i) === "DESC"
      if (word(i) === "ASC" || word(i) === "DESC") i++
      directions.add(descending)
      if (aggregating) {
        if (key) aggregate.order.push({ key, descending })
        else if (column)
          aggregate.order.push({ key: String(column.field.no), descending })
        continue
      }
      if (column) {
        if (column.scope !== main)
          add(
            token,
            `Sort by ${main.table.name}'s fields: Business Central can't sort on a joined table`
          )
        else query.sort.push(column.field.no)
      }
    }
    if (!aggregating) {
      if (directions.size > 1)
        add(
          code[at.order],
          "Business Central sorts everything one way: use all ASC or all DESC"
        )
      query.descending = [...directions][0] ?? false
    }
  }

  const joins = scopes.flatMap((s) => (s.join ? [s.join] : []))
  if (joins.length) query.joins = joins
  // SELECT of only a joined table's columns, or only aggregates
  if (aggregating) {
    aggregate.top = query.top
    query.top = null
  }

  const failed = problems.some((p) => p.severity === "error")
  return {
    query: failed ? null : query,
    aggregate: !failed && aggregating ? aggregate : null,
    problems: problems.sort((a, b) => a.from - b.from),
  }
}

/** Words that can't be a bare field or table name, or an alias */
const RESERVED = new Set(
  (
    "SELECT DISTINCT TOP FROM WHERE AND OR NOT IN LIKE BETWEEN IS NULL AS ON JOIN INNER LEFT RIGHT FULL " +
    "OUTER CROSS GROUP BY ORDER ASC DESC HAVING UNION ALL INTERSECT EXCEPT CASE WHEN THEN ELSE END " +
    "EXISTS OFFSET WITH INSERT UPDATE DELETE MERGE INTO VALUES SET CREATE ALTER DROP TRUNCATE EXEC TRUE FALSE"
  ).split(" ")
)
