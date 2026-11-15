/**
 * The builder's query as SQL, for its SQL tab and for starting SQL mode from.
 * Filters are Business Central's syntax: the common forms have a SQL form, and
 * any other is listed in a comment and left out, so what's shown never quietly
 * means something else.
 */
import type { BcField, BcFilter, BcQuery, BcTable } from "../bridge"

export type RelatedFields = Record<
  number,
  { name: string; caption: string; fields: BcField[] }
>

const PLAIN = /^[A-Za-z_][A-Za-z0-9_]*$/
const WORDS = new Set(
  "SELECT FROM WHERE AND OR NOT IN LIKE BETWEEN IS NULL AS ON JOIN INNER LEFT GROUP BY ORDER ASC DESC TOP COUNT SUM".split(
    " "
  )
)

/** A name as SQL writes it: in brackets unless it's a plain word. */
export const sqlName = (name: string) =>
  PLAIN.test(name) && !WORDS.has(name.toUpperCase()) ? name : `[${name}]`

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`

/** One unquoted part of a filter: a number stays a number. */
function literal(part: string, field: BcField | undefined) {
  const quoted = /^'(.*)'$/.exec(part)
  const text = quoted ? quoted[1].replace(/''/g, "'") : part
  const numeric = ["Integer", "BigInteger", "Decimal"].includes(
    field?.type ?? ""
  )
  return numeric && /^-?\d+(\.\d+)?$/.test(text) ? text : sqlString(text)
}

/** Splits on a character outside single quotes. */
function split(filter: string, by: string) {
  const parts: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < filter.length; i++) {
    const c = filter[i]
    if (c === "'") quoted = !quoted
    if (!quoted && filter.startsWith(by, i)) {
      parts.push(current)
      current = ""
      i += by.length - 1
      continue
    }
    current += c
  }
  parts.push(current)
  return parts
}

/** A filter as a SQL condition on `column`, or null if it hasn't a SQL form. */
export function filterToSql(
  filter: string,
  column: string,
  field: BcField | undefined
): string | null {
  const f = filter.trim()
  if (f === "''") return `${column} IS NULL`
  if (f === "<>''") return `${column} IS NOT NULL`
  if (f === "t") return `${column} = TODAY()`
  if (f === "w") return `${column} = WORKDATE()`
  const ors = split(f, "|")
  if (ors.length > 1) {
    const each = ors.map((part) => filterToSql(part, column, field))
    if (each.some((s) => s === null)) return null
    // All plain equals: a list reads better
    if (ors.every((p) => !/^[<>@]|\.\.|[*?]/.test(p)))
      return `${column} IN (${ors.map((p) => literal(p, field)).join(", ")})`
    return `(${each.join(" OR ")})`
  }
  const ands = split(f, "&")
  if (ands.length > 1) {
    const each = ands.map((part) => filterToSql(part, column, field))
    return each.some((s) => s === null) ? null : each.join(" AND ")
  }
  const range = split(f, "..")
  if (range.length === 2 && range[0] && range[1])
    return `${column} BETWEEN ${literal(range[0], field)} AND ${literal(range[1], field)}`
  if (range.length === 2) return null
  const op = /^(<>|<=|>=|<|>)(.*)$/.exec(f)
  if (op) {
    if (/[*?]/.test(op[2]) && op[1] === "<>") {
      const like = filterToSql(op[2], column, field)
      return like?.replace(" LIKE ", " NOT LIKE ") ?? null
    }
    return `${column} ${op[1]} ${literal(op[2], field)}`
  }
  const caseless = f.startsWith("@")
  const rest = caseless ? f.slice(1) : f
  if (
    /[*?]/.test(
      split(rest, "'")
        .filter((_, i) => i % 2 === 0)
        .join("")
    )
  ) {
    const pattern = split(rest, "'")
      .map((part, i) =>
        i % 2 === 0 ? part.replace(/\*/g, "%").replace(/\?/g, "_") : part
      )
      .join("")
    return `${column} LIKE ${sqlString(pattern)}`
  }
  if (/[()=<>]/.test(rest.replace(/'[^']*'/g, ""))) return null
  return caseless
    ? `UPPER(${column}) = ${literal(rest, field)}`
    : `${column} = ${literal(rest, field)}`
}

const name = (f: BcField | undefined, no: number) =>
  sqlName(f?.name ?? String(no))

/** The whole query as SQL. */
export function toBcSql(
  query: BcQuery,
  table: Pick<BcTable, "name"> | undefined,
  fields: BcField[],
  related: RelatedFields = {}
) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const joins = query.joins ?? []
  const main = joins.length ? "m" : ""
  const col = (no: number) =>
    main ? `${main}.${name(byNo.get(no), no)}` : name(byNo.get(no), no)
  const leftOut: string[] = []
  const select: string[] = (
    query.fields.length
      ? query.fields
      : fields.filter((f) => f.pk).map((f) => f.no)
  ).map(col)
  const lines: string[] = []
  const conditions: string[] = []
  const addFilter = (
    f: BcFilter,
    column: string,
    field: BcField | undefined
  ) => {
    const sql = filterToSql(f.filter, column, field)
    if (sql) conditions.push(sql)
    else leftOut.push(`${column}: ${f.filter}`)
  }
  for (const f of query.filters) addFilter(f, col(f.field), byNo.get(f.field))

  const from: string[] = [
    `FROM ${sqlName(table?.name ?? String(query.table))}${main ? ` ${main}` : ""}`,
  ]
  joins.forEach((j, index) => {
    const r = related[j.table]
    const alias = `j${index + 1}`
    const rBy = new Map((r?.fields ?? []).map((f) => [f.no, f]))
    const jCol = (no: number) => `${alias}.${name(rBy.get(no), no)}`
    j.fields.forEach((no) => select.push(jCol(no)))
    from.push(
      `${j.inner ? "INNER" : "LEFT"} JOIN ${sqlName(r?.name ?? String(j.table))} ${alias} ON ${col(j.field)} = ${jCol(j.key)}`
    )
    for (const f of j.filters) addFilter(f, jCol(f.field), rBy.get(f.field))
  })

  lines.push(
    `SELECT${query.top ? ` TOP ${query.top}` : ""} ${select.join(",\n       ")}`,
    ...from
  )
  if (conditions.length) lines.push(`WHERE ${conditions.join("\n  AND ")}`)
  if (query.sort.length)
    lines.push(
      `ORDER BY ${query.sort.map((no) => `${col(no)}${query.descending ? " DESC" : ""}`).join(", ")}`
    )
  const notes = leftOut.map((l) => `-- Left out, it has no SQL form: ${l}`)
  return [...notes, ...lines].join("\n")
}
