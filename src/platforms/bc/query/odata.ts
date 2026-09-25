/**
 * Business Central filter text to an OData $filter, for the API tab's URL.
 * Covers what people type most: values, comparisons, ranges (a..b), OR (|),
 * AND (&), blanks ('') and wildcards at the start or end (A*, *A, *A*).
 * Anything else (A*B, ?, @, parentheses, dates in the user's own format)
 * returns null, and the caller keeps that filter in the API query itself.
 */
import type { BcField } from "./bridge"

const NUMBER = /^-?\d+(\.\d+)?$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})?$/
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`

/** A value as an OData literal for the field's type, or null if it can't be. */
function literal(field: BcField, raw: string): string | null {
  let value = raw.trim()
  // 'quoted' values are literal text
  if (/^'.*'$/.test(value)) value = value.slice(1, -1).replace(/''/g, "'")
  switch (field.type) {
    case "Integer":
    case "BigInteger":
    case "Decimal":
      return NUMBER.test(value) ? value : null
    case "Boolean": {
      const v = value.toLowerCase()
      if (["yes", "true", "1"].includes(v)) return "true"
      if (["no", "false", "0"].includes(v)) return "false"
      return null
    }
    case "Date":
      return ISO_DATE.test(value) ? value : null
    case "DateTime":
      return ISO_DATETIME.test(value) ? value : null
    case "GUID":
      return GUID.test(value.replace(/[{}]/g, ""))
        ? value.replace(/[{}]/g, "")
        : null
    case "Code":
    case "Text":
    case "Option":
      return /[*?@()&|<>=]/.test(value) || value.includes("..")
        ? null
        : quote(value)
    default:
      return null
  }
}

/** One comparison: <>x, >=x, a..b, A*, … */
function part(field: BcField, name: string, text: string): string | null {
  const t = text.trim()
  if (t === "''") return `${name} eq ''`
  if (t.includes("..")) {
    const [from, to] = t.split("..")
    const lo = from.trim() ? literal(field, from) : null
    const hi = to.trim() ? literal(field, to) : null
    if ((from.trim() && !lo) || (to.trim() && !hi) || (!lo && !hi)) return null
    return [lo && `${name} ge ${lo}`, hi && `${name} le ${hi}`]
      .filter(Boolean)
      .join(" and ")
  }
  for (const [op, odata] of [
    ["<>", "ne"],
    [">=", "ge"],
    ["<=", "le"],
    [">", "gt"],
    ["<", "lt"],
    ["=", "eq"],
  ] as const) {
    if (t.startsWith(op)) {
      const value = t.slice(op.length)
      if (value.trim() === "''") return `${name} ${odata} ''`
      const lit = literal(field, value)
      return lit ? `${name} ${odata} ${lit}` : null
    }
  }
  // Wildcards: only at the ends, on text
  if (t.includes("*") && ["Code", "Text"].includes(field.type)) {
    const inner = t.replace(/^\*/, "").replace(/\*$/, "")
    if (!inner || /[*?@()&|<>=]/.test(inner)) return null
    const q = quote(inner)
    if (t.startsWith("*") && t.endsWith("*")) return `contains(${name},${q})`
    if (t.endsWith("*")) return `startswith(${name},${q})`
    return `endswith(${name},${q})`
  }
  const lit = literal(field, t)
  return lit ? `${name} eq ${lit}` : null
}

/** A whole BC filter on one field as OData, or null if it can't be expressed. */
export function toODataFilter(
  field: BcField,
  name: string,
  text: string
): string | null {
  if (/[()@?]/.test(text) && !/^'.*'$/.test(text.trim())) return null
  const ors = text.split("|").map((or) => {
    const ands = or.split("&").map((p) => part(field, name, p))
    if (ands.some((a) => a === null)) return null
    return ands.length > 1 ? ands.map((a) => `(${a})`).join(" and ") : ands[0]
  })
  if (ors.some((o) => o === null)) return null
  return ors.length > 1 ? ors.map((o) => `(${o})`).join(" or ") : ors[0]
}
