/**
 * Reads Dataverse SQL (the Web API's read-only T-SQL subset) enough for an
 * editor: tokens with positions, which clause each sits in, the tables and
 * aliases in FROM and JOIN, and the column references. Forgiving: half-typed
 * queries still read.
 * https://learn.microsoft.com/power-apps/developer/data-platform/webapi/query/sql
 */

export type SqlTokenKind =
  | "word" // keyword or plain identifier
  | "ident" // [bracketed] or "quoted" identifier
  | "string"
  | "number"
  | "op"
  | "punct" // , ( ) . ;
  | "comment"

export type SqlToken = {
  kind: SqlTokenKind
  text: string
  /** Upper-cased word, or the identifier without brackets */
  value: string
  from: number
  to: number
}

const WORD = /[A-Za-z_@#][\w@#$]*/y
const NUMBER = /\d+(\.\d+)?([eE][+-]?\d+)?/y
const OP = /<>|!=|<=|>=|[=<>+\-*/%]/y

function at(re: RegExp, text: string, i: number) {
  re.lastIndex = i
  return re.exec(text)?.[0] ?? null
}

export function sqlTokens(text: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let i = 0
  const push = (kind: SqlTokenKind, from: number, to: number, value?: string) =>
    tokens.push({
      kind,
      text: text.slice(from, to),
      value: value ?? text.slice(from, to),
      from,
      to,
    })
  while (i < text.length) {
    const c = text[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (text.startsWith("--", i)) {
      const eol = text.indexOf("\n", i)
      const to = eol < 0 ? text.length : eol
      push("comment", i, to)
      i = to
      continue
    }
    if (text.startsWith("/*", i)) {
      const close = text.indexOf("*/", i + 2)
      const to = close < 0 ? text.length : close + 2
      push("comment", i, to)
      i = to
      continue
    }
    if (c === "'") {
      let j = i + 1
      let value = ""
      while (j < text.length) {
        if (text[j] === "'" && text[j + 1] === "'") {
          value += "'"
          j += 2
        } else if (text[j] === "'") break
        else value += text[j++]
      }
      const to = Math.min(j + 1, text.length)
      push("string", i, to, value)
      i = to
      continue
    }
    if (c === "[" || c === '"') {
      const close = text.indexOf(c === "[" ? "]" : '"', i + 1)
      const to = close < 0 ? text.length : close + 1
      push("ident", i, to, text.slice(i + 1, close < 0 ? text.length : close))
      i = to
      continue
    }
    const word = at(WORD, text, i)
    if (word) {
      push("word", i, i + word.length, word.toUpperCase())
      i += word.length
      continue
    }
    const num = at(NUMBER, text, i)
    if (num) {
      push("number", i, i + num.length)
      i += num.length
      continue
    }
    const op = at(OP, text, i)
    if (op) {
      push("op", i, i + op.length)
      i += op.length
      continue
    }
    push("punct", i, i + 1)
    i++
  }
  return tokens
}

/** Words that are SQL, not names. */
export const KEYWORDS = new Set(
  (
    "SELECT DISTINCT TOP FROM WHERE AND OR NOT IN LIKE BETWEEN IS NULL AS ON JOIN INNER LEFT RIGHT FULL " +
    "OUTER CROSS APPLY GROUP BY ORDER ASC DESC HAVING UNION ALL INTERSECT EXCEPT CASE WHEN THEN ELSE END " +
    "EXISTS OFFSET ROWS ROW FETCH NEXT ONLY WITH INSERT UPDATE DELETE MERGE INTO VALUES SET CREATE ALTER " +
    "DROP TRUNCATE EXEC EXECUTE DECLARE OVER PARTITION TRUE FALSE"
  ).split(" ")
)

export type Clause =
  "select" | "from" | "join" | "on" | "where" | "group" | "order" | "other"

export type SqlTable = {
  table: string
  alias: string | null
  /** Where the table's name is */
  from: number
  to: number
  join: "from" | "inner" | "left" | "other"
}

export type SqlColumnRef = {
  /** The alias or table before the dot, if any */
  qualifier: string | null
  column: string
  from: number
  to: number
  clause: Clause
  /** Index of the column's token */
  index: number
  /** Inside a function call's parentheses (not an aggregate) */
  inFunction: string | null
}

export type SqlQuery = {
  tokens: SqlToken[]
  /** Tokens without comments */
  code: SqlToken[]
  /** Clause each code token is in */
  clauses: Clause[]
  tables: SqlTable[]
  columns: SqlColumnRef[]
  /** Column aliases from SELECT (… AS name) */
  columnAliases: Set<string>
}

export const AGGREGATE_FUNCTIONS = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
])

const nameOf = (t: SqlToken | undefined) =>
  t && (t.kind === "ident" || (t.kind === "word" && !KEYWORDS.has(t.value)))
    ? t.kind === "ident"
      ? t.value
      : t.text
    : null

export function readSql(text: string): SqlQuery {
  const tokens = sqlTokens(text)
  const code = tokens.filter((t) => t.kind !== "comment")
  const clauses: Clause[] = []
  const tables: SqlTable[] = []
  const columns: SqlColumnRef[] = []
  const columnAliases = new Set<string>()
  let clause: Clause = "other"
  // Function calls we're inside, by paren depth
  const calls: (string | null)[] = []

  for (let i = 0; i < code.length; i++) {
    const t = code[i]
    const next = code[i + 1]
    if (t.kind === "word") {
      switch (t.value) {
        case "SELECT":
          clause = "select"
          break
        case "FROM":
          clause = "from"
          break
        case "JOIN":
          clause = "join"
          break
        case "ON":
          clause = "on"
          break
        case "WHERE":
          clause = "where"
          break
        case "GROUP":
          if (next?.value === "BY") clause = "group"
          break
        case "ORDER":
          if (next?.value === "BY") clause = "order"
          break
      }
    }
    clauses.push(clause)

    // Tables: FROM name [AS] alias, JOIN name [AS] alias
    if (t.kind === "word" && (t.value === "FROM" || t.value === "JOIN")) {
      const nameTok = code[i + 1]
      const name = nameOf(nameTok)
      if (name && nameTok) {
        let j = i + 2
        if (code[j]?.value === "AS") j++
        const alias = nameOf(code[j])
        const prev = code[i - 1]?.value
        const before = code[i - 2]?.value
        tables.push({
          table: name.toLowerCase(),
          alias: alias,
          from: nameTok.from,
          to: nameTok.to,
          join:
            t.value === "FROM"
              ? "from"
              : prev === "INNER" || prev === "JOIN"
                ? "inner"
                : prev === "LEFT" || (prev === "OUTER" && before === "LEFT")
                  ? "left"
                  : "other",
        })
      }
      continue
    }

    if (t.kind === "punct" && t.value === "(") {
      const fn = code[i - 1]?.kind === "word" ? code[i - 1].value : null
      calls.push(
        fn && !AGGREGATE_FUNCTIONS.has(fn) && !KEYWORDS.has(fn) ? fn : null
      )
      continue
    }
    if (t.kind === "punct" && t.value === ")") {
      calls.pop()
      continue
    }

    // Column references: [qualifier.]column, not names of tables, aliases or functions
    if (clause === "from" || clause === "join") continue
    const name = nameOf(t)
    if (!name) continue
    if (next?.kind === "punct" && next.value === "(") continue // a function
    const prev = code[i - 1]
    if (prev?.kind === "punct" && prev.value === ".") continue // handled with its qualifier
    if (prev?.value === "AS") {
      if (clause === "select") columnAliases.add(name.toLowerCase())
      continue
    }
    // An alias right after a column or call, without AS: SELECT a.name n
    if (
      clause === "select" &&
      prev &&
      (nameOf(prev) !== null || (prev.kind === "punct" && prev.value === ")"))
    ) {
      columnAliases.add(name.toLowerCase())
      continue
    }
    if (DATEPARTS.has(t.value) && calls[calls.length - 1] === "DATEADD")
      continue
    const inFunction = [...calls].reverse().find((c) => c !== null) ?? null
    if (next?.kind === "punct" && next.value === ".") {
      const colTok = code[i + 2]
      const column =
        colTok && (colTok.kind === "ident" || colTok.kind === "word")
          ? colTok.kind === "ident"
            ? colTok.value
            : colTok.text
          : ""
      columns.push({
        qualifier: name,
        column,
        from: colTok ? colTok.from : next.to,
        to: colTok ? colTok.to : next.to,
        clause,
        index: i + 2,
        inFunction,
      })
      const skip = colTok && column ? 2 : 1
      for (let k = 0; k < skip; k++) clauses.push(clause)
      i += skip
      continue
    }
    columns.push({
      qualifier: null,
      column: name,
      from: t.from,
      to: t.to,
      clause,
      index: i,
      inFunction,
    })
  }
  return { tokens, code, clauses, tables, columns, columnAliases }
}

/** DATEADD's first argument */
export const DATEPARTS = new Set(
  "YEAR YY YYYY QUARTER QQ Q MONTH MM M DAYOFYEAR DY Y DAY DD D WEEK WK WW WEEKDAY DW HOUR HH MINUTE MI N SECOND SS S MILLISECOND MS".split(
    " "
  )
)

/** The table an alias (or a table name) stands for. */
export function tableFor(
  query: Pick<SqlQuery, "tables">,
  qualifier: string
): SqlTable | undefined {
  const q = qualifier.toLowerCase()
  return (
    query.tables.find((t) => t.alias?.toLowerCase() === q) ??
    query.tables.find((t) => !t.alias && t.table === q) ??
    query.tables.find((t) => t.table === q)
  )
}
