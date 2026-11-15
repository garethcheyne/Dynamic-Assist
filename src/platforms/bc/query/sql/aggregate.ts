/**
 * COUNT, SUM, AVG, MIN, MAX and GROUP BY. The companion app reads records and
 * doesn't add up, so this does: it reads every matching row a page at a time and
 * works the answer out here, up to MAX_ROWS. Over that it says so, rather than
 * quietly giving a total that's short.
 */
import type { BcColumn, BcQuery, BcQueryResult } from "../bridge"
import type { BcAggregate, Measure } from "./from-sql"

/** The most rows read to add up: 50,000, as Dataverse's aggregates allow */
export const MAX_ROWS = 50_000
const PAGE = 5000

export type AggregateOutcome = {
  result: BcQueryResult
  /** Rows read */
  rows: number
  /** Stopped at MAX_ROWS: there were more */
  capped: boolean
}

type Reader = (q: BcQuery) => Promise<BcQueryResult>

const numeric = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Sorts text as text and numbers as numbers. */
const compare = (a: unknown, b: unknown) => {
  const x = numeric(a)
  const y = numeric(b)
  if (x !== null && y !== null) return x - y
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

type Totals = {
  count: number
  sum: number
  numbers: number
  min: unknown
  max: unknown
}
const blank = (): Totals => ({
  count: 0,
  sum: 0,
  numbers: 0,
  min: null,
  max: null,
})

function add(t: Totals, value: unknown) {
  // Like SQL, a blank isn't counted, summed or compared
  if (value === null || value === undefined || value === "") return
  t.count++
  const n = numeric(value)
  if (n !== null) {
    t.sum += n
    t.numbers++
  }
  if (t.min === null || compare(value, t.min) < 0) t.min = value
  if (t.max === null || compare(value, t.max) > 0) t.max = value
}

function answer(m: Measure, t: Totals, rows: number) {
  switch (m.fn) {
    case "COUNT":
      return m.field === null ? rows : t.count
    case "SUM":
      return t.numbers ? t.sum : null
    case "AVG":
      return t.numbers ? t.sum / t.numbers : null
    case "MIN":
      return t.min
    case "MAX":
      return t.max
  }
}

/** Reads the rows and adds them up. `readRows` is the companion's query. */
export async function runAggregate(
  query: BcQuery,
  aggregate: BcAggregate,
  readRows: Reader
): Promise<AggregateOutcome> {
  const started = Date.now()
  const wanted = [
    ...new Set([
      ...aggregate.groupBy,
      ...aggregate.measures.flatMap((m) => (m.field === null ? [] : [m.field])),
    ]),
  ]
  // A plain COUNT(*) needs no rows: the companion counts
  if (
    !aggregate.groupBy.length &&
    aggregate.measures.length === 1 &&
    aggregate.measures[0].fn === "COUNT" &&
    aggregate.measures[0].field === null
  ) {
    const counted = await readRows({
      ...query,
      fields: wanted,
      top: 1,
      count: true,
    })
    if (counted.count !== undefined)
      return {
        rows: counted.count,
        capped: false,
        result: {
          ...counted,
          columns: [measureColumn(aggregate.measures[0])],
          rows: [[counted.count]],
          more: false,
          next: undefined,
          ms: Date.now() - started,
        },
      }
  }

  const groups = new Map<
    string,
    { key: unknown[]; rows: number; totals: Totals[] }
  >()
  let columns: BcColumn[] = []
  let last: BcQueryResult | undefined
  let read = 0
  let after: string | undefined
  let capped = false
  for (;;) {
    const page = await readRows({
      ...query,
      fields: wanted,
      top: Math.min(PAGE, MAX_ROWS - read),
      after,
    })
    last = page
    columns = page.columns
    const at = new Map(columns.map((c, i) => [c.no, i]))
    for (const row of page.rows) {
      const key = aggregate.groupBy.map((no) => row[at.get(no) ?? -1])
      const id = JSON.stringify(key)
      let group = groups.get(id)
      if (!group) {
        group = { key, rows: 0, totals: aggregate.measures.map(blank) }
        groups.set(id, group)
      }
      group.rows++
      aggregate.measures.forEach((m, i) => {
        if (m.field !== null) add(group.totals[i], row[at.get(m.field) ?? -1])
      })
    }
    read += page.rows.length
    if (!page.more || !page.next) break
    if (read >= MAX_ROWS) {
      capped = true
      break
    }
    after = page.next
  }

  const groupColumns = aggregate.groupBy.map(
    (no) =>
      columns.find((c) => c.no === no) ?? {
        no,
        name: String(no),
        caption: String(no),
        type: "Text",
        class: "Normal",
      }
  )
  // No rows, no GROUP BY: SQL still answers one row (COUNT is 0)
  if (!groups.size && !aggregate.groupBy.length)
    groups.set("[]", {
      key: [],
      rows: 0,
      totals: aggregate.measures.map(blank),
    })

  let rows = [...groups.values()].map((g) => [
    ...g.key,
    ...aggregate.measures.map((m, i) => answer(m, g.totals[i], g.rows)),
  ])

  const labels = aggregate.measures.map((m) => m.label)
  const indexOfKey = (key: string) => {
    const byLabel = labels.findIndex((l) => l === key)
    if (byLabel >= 0) return aggregate.groupBy.length + byLabel
    return aggregate.groupBy.indexOf(Number(key))
  }
  if (aggregate.order.length)
    rows = rows.sort((a, b) => {
      for (const { key, descending } of aggregate.order) {
        const i = indexOfKey(key)
        if (i < 0) continue
        const c = compare(a[i], b[i])
        if (c) return descending ? -c : c
      }
      return 0
    })
  if (aggregate.top !== null) rows = rows.slice(0, aggregate.top)

  return {
    rows: read,
    capped,
    result: {
      table: query.table,
      name: last?.name ?? "",
      caption: last?.caption ?? "",
      columns: [...groupColumns, ...aggregate.measures.map(measureColumn)],
      rows,
      more: false,
      view: last?.view ?? "",
      ms: Date.now() - started,
    },
  }
}

const measureColumn = (m: Measure): BcColumn => ({
  no: 0,
  name: m.label,
  caption: m.label,
  type: m.fn === "MIN" || m.fn === "MAX" ? "Text" : "Decimal",
  class: "Normal",
})
