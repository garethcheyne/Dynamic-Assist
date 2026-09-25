/**
 * Filters as conditions (field, operator, value), like FetchXML or Advanced
 * Find, for people who don't write Business Central's filter syntax. Each
 * condition becomes a BC filter expression, which is what the companion runs,
 * so everything downstream (AL, API, REST) is unchanged.
 *
 * Going back, a BC filter becomes a condition only if the condition gives the
 * exact same filter again; anything else stays as BC syntax, so switching
 * modes never changes what a query returns.
 */

export type ConditionOp =
  | "eq"
  | "ne"
  | "gt"
  | "ge"
  | "lt"
  | "le"
  | "between"
  | "contains"
  | "begins"
  | "ends"
  | "in"
  | "notIn"
  | "empty"
  | "notEmpty"
  | "today"

export type Condition = {
  op: ConditionOp
  /** The value; for "in" and "notIn", values separated by commas */
  value: string
  /** The upper bound, for "between" */
  value2: string
}

type Kind = "text" | "number" | "date" | "boolean" | "option" | "other"

/** Which operators make sense for a field type */
export function kindOf(type: string): Kind {
  switch (type) {
    case "Code":
    case "Text":
    case "GUID":
      return "text"
    case "Integer":
    case "BigInteger":
    case "Decimal":
    case "Duration":
      return "number"
    case "Date":
    case "DateTime":
      return "date"
    case "Boolean":
      return "boolean"
    case "Option":
      return "option"
    default:
      return "other"
  }
}

const LABELS: Record<ConditionOp, string> = {
  eq: "equals",
  ne: "does not equal",
  gt: "greater than",
  ge: "greater than or equal",
  lt: "less than",
  le: "less than or equal",
  between: "between",
  contains: "contains",
  begins: "begins with",
  ends: "ends with",
  in: "is any of",
  notIn: "is none of",
  empty: "is empty",
  notEmpty: "has a value",
  today: "is today",
}

const BY_KIND: Record<Kind, ConditionOp[]> = {
  text: [
    "eq",
    "ne",
    "between",
    "contains",
    "begins",
    "ends",
    "in",
    "notIn",
    "notEmpty",
    "empty",
  ],
  number: ["eq", "ne", "gt", "ge", "lt", "le", "between", "in", "notIn"],
  date: [
    "eq",
    "ne",
    "ge",
    "le",
    "gt",
    "lt",
    "between",
    "today",
    "notEmpty",
    "empty",
  ],
  boolean: ["eq"],
  option: ["eq", "ne", "in", "notIn"],
  other: ["eq", "ne", "notEmpty", "empty"],
}

/** Date labels read as "on", "on or after"… */
const DATE_LABELS: Partial<Record<ConditionOp, string>> = {
  eq: "on",
  ne: "not on",
  ge: "on or after",
  le: "on or before",
  gt: "after",
  lt: "before",
}

export function operatorsFor(type: string) {
  const kind = kindOf(type)
  return BY_KIND[kind].map((op) => ({
    value: op,
    label: (kind === "date" && DATE_LABELS[op]) || LABELS[op],
  }))
}

/** How many values an operator takes */
export const arity = (op: ConditionOp) =>
  op === "between"
    ? 2
    : op === "empty" || op === "notEmpty" || op === "today"
      ? 0
      : 1

/** Characters with a meaning in BC filters */
const SPECIAL = /[=<>|&.*@()'?]/

/** A value as a BC filter literal: quoted when it holds special characters */
function literal(value: string, kind: Kind) {
  if (kind === "number" || kind === "boolean") return value.trim()
  if (value === "") return "''"
  if (SPECIAL.test(value) || value !== value.trim())
    return `'${value.replace(/'/g, "''")}'`
  return value
}

/**
 * A value inside a wildcard pattern: quotes can't mix with wildcards, so
 * special characters match as "any one character" (?) instead.
 */
const pattern = (value: string) => value.replace(/[=<>|&.*@()'?]/g, "?")

const list = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)

/** Whether a value fits the field: numbers, ISO dates, yes/no; text is anything */
function fits(value: string, kind: Kind) {
  const v = value.trim()
  switch (kind) {
    case "number":
      return /^-?\d+(\.\d+)?$/.test(v)
    case "date":
      return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$/.test(v)
    case "boolean":
      return /^(yes|no|true|false)$/i.test(v)
    default:
      return true
  }
}

/** The value as it goes into a filter: typed values as they are, text quoted */
const put = (value: string, kind: Kind) =>
  kind === "number" || kind === "date" || kind === "boolean"
    ? value.trim()
    : literal(value, kind)

/** A condition as a BC filter expression ("" when it's incomplete or doesn't fit the field). */
export function toBcFilter(c: Condition, type: string): string {
  const kind = kindOf(type)
  const v = c.value
  const typed = kind === "number" || kind === "date" || kind === "boolean"
  switch (c.op) {
    case "eq":
      if (typed && !fits(v, kind)) return ""
      return put(v, kind)
    case "ne":
      if (typed && !fits(v, kind)) return ""
      return `<>${put(v, kind)}`
    case "gt":
    case "ge":
    case "lt":
    case "le": {
      if (!v.trim() || !fits(v, kind)) return ""
      const sign = { gt: ">", ge: ">=", lt: "<", le: "<=" }[c.op]
      return `${sign}${put(v, kind)}`
    }
    case "between": {
      const from = v.trim()
      const to = c.value2.trim()
      if (!from && !to) return ""
      if ((from && !fits(from, kind)) || (to && !fits(to, kind))) return ""
      return `${from ? put(from, kind) : ""}..${to ? put(to, kind) : ""}`
    }
    case "contains":
      return v ? `@*${pattern(v)}*` : ""
    case "begins":
      return v ? `@${pattern(v)}*` : ""
    case "ends":
      return v ? `@*${pattern(v)}` : ""
    case "in": {
      const values = list(v)
      if (!values.length || (typed && !values.every((x) => fits(x, kind))))
        return ""
      return values.map((x) => put(x, kind)).join("|")
    }
    case "notIn": {
      const values = list(v)
      if (!values.length || (typed && !values.every((x) => fits(x, kind))))
        return ""
      return values.map((x) => `<>${put(x, kind)}`).join("&")
    }
    case "empty":
      return "''"
    case "notEmpty":
      return "<>''"
    case "today":
      return "t"
  }
  // An operator this doesn't know makes no filter
  return ""
}

const unquote = (s: string) =>
  /^'.*'$/.test(s) ? s.slice(1, -1).replace(/''/g, "'") : s

/** The candidate conditions a BC filter might have come from */
function candidates(text: string): Condition[] {
  const t = text.trim()
  const c = (op: ConditionOp, value = "", value2 = ""): Condition => ({
    op,
    value,
    value2,
  })
  const out: Condition[] = []
  if (t === "''") out.push(c("empty"))
  if (t === "<>''") out.push(c("notEmpty"))
  if (/^t$/i.test(t)) out.push(c("today"))
  let m: RegExpMatchArray | null
  if ((m = t.match(/^@\*(.+)\*$/))) out.push(c("contains", m[1]))
  if ((m = t.match(/^@([^*].*)\*$/))) out.push(c("begins", m[1]))
  if ((m = t.match(/^@\*(.*[^*])$/))) out.push(c("ends", m[1]))
  if ((m = t.match(/^(<>|>=|<=|>|<)(.+)$/))) {
    const op = { "<>": "ne", ">=": "ge", "<=": "le", ">": "gt", "<": "lt" }[
      m[1]
    ] as ConditionOp
    out.push(c(op, unquote(m[2])))
  }
  if ((m = t.match(/^([^.]+)\.\.([^.]+)$/)))
    out.push(c("between", unquote(m[1]), unquote(m[2])))
  if (t.includes("|")) out.push(c("in", t.split("|").map(unquote).join(", ")))
  if (/^<>/.test(t) && t.includes("&"))
    out.push(
      c(
        "notIn",
        t
          .split("&")
          .map((x) => unquote(x.replace(/^<>/, "")))
          .join(", ")
      )
    )
  out.push(c("eq", unquote(t)))
  return out
}

/**
 * The condition a BC filter is, or null when no condition gives exactly that
 * filter (keep it as BC syntax then).
 */
export function fromBcFilter(text: string, type: string): Condition | null {
  if (!text.trim()) return null
  const allowed = new Set(operatorsFor(type).map((o) => o.value))
  for (const candidate of candidates(text)) {
    if (!allowed.has(candidate.op)) continue
    if (toBcFilter(candidate, type) === text.trim()) return candidate
  }
  return null
}
