import { describe, expect, it } from "vitest"

import type { QueryBuilderCondition } from "@/platforms/ce/query/lib/types"
import { newQuery, type Query } from "@/platforms/ce/query/query"
import { toSql } from "@/platforms/ce/query/to-sql"
import { lintSql } from "@/platforms/ce/query/editor/sql-lint"

import { FIELDS, META, TABLES } from "./fixtures/meta"

const account = TABLES[0]
let n = 0
const cond = (
  fieldId: string,
  operator: string,
  value?: QueryBuilderCondition["value"],
  extra: Partial<QueryBuilderCondition> = {}
): QueryBuilderCondition => ({
  id: String(n++),
  fieldId,
  operator,
  value,
  ...extra,
})
const query = (
  conditions: QueryBuilderCondition[],
  extra: Partial<Query> = {}
): Query => ({
  ...newQuery("account"),
  columns: ["name", "revenue"],
  filters: {
    groups: conditions.length ? [{ id: "g", logic: "and", conditions }] : [],
  },
  ...extra,
})
const sql = (q: Query) => toSql(q, FIELDS.account, account)

describe("toSql", () => {
  it("writes columns, filters and sort", () => {
    const r = sql(
      query([cond("statecode", "eq", 0), cond("name", "begins-with", "Con")], {
        orders: [{ attribute: "name", descending: true }],
      })
    )
    expect(r.sql).toBe(
      [
        "SELECT DISTINCT",
        "  name,",
        "  revenue",
        "FROM account",
        "WHERE (statecode = 0 AND name LIKE 'Con%')",
        "ORDER BY name DESC",
      ].join("\n")
    )
    expect(lintSql(r.sql, META)).toEqual([])
  })

  it("names the primary columns when the builder has none", () => {
    const r = sql(query([], { columns: [], distinct: false }))
    expect(r.sql).toBe(
      "-- All columns: Dataverse SQL has no SELECT *, so name the ones you need\nSELECT\n  name,\n  accountid\nFROM account"
    )
  })

  it("maps operators to SQL", () => {
    const where = (c: QueryBuilderCondition) =>
      sql(query([c]))
        .sql.split("\n")
        .find((l) => l.startsWith("WHERE"))
    expect(where(cond("name", "contains", "O'Neil"))).toBe(
      "WHERE name LIKE '%O''Neil%'"
    )
    expect(where(cond("statecode", "in", [0, 1]))).toBe(
      "WHERE statecode IN (0, 1)"
    )
    expect(where(cond("revenue", "between", 10, { value2: 20 }))).toBe(
      "WHERE revenue BETWEEN 10 AND 20"
    )
    expect(where(cond("revenue", "not-between", 10, { value2: 20 }))).toBe(
      "WHERE (revenue < 10 OR revenue > 20)"
    )
    expect(where(cond("name", "null"))).toBe("WHERE name IS NULL")
    expect(where(cond("donotemail", "eq", true))).toBe("WHERE donotemail = 1")
    expect(where(cond("createdon", "on", "2026-01-31"))).toBe(
      "WHERE createdon >= '2026-01-31' AND createdon < DATEADD(day, 1, '2026-01-31')"
    )
    expect(where(cond("createdon", "older-than-x-days", 30))).toBe(
      "WHERE createdon < DATEADD(day, -30, GETUTCDATE())"
    )
  })

  it("marks relative dates as approximate and leaves out what SQL can't say", () => {
    const r = sql(
      query([
        cond("createdon", "last-x-days", 7),
        cond("createdon", "today"),
        cond("ownerid", "eq-userid"),
      ])
    )
    expect(r.approximate).toEqual(["createdon last-x-days 7"])
    expect(r.left).toEqual(["createdon today", "ownerid eq-userid"])
    expect(r.sql).toContain(
      "-- Left out, no SQL form: createdon today; ownerid eq-userid"
    )
    expect(r.sql).toContain(
      "WHERE (createdon >= DATEADD(day, -7, GETUTCDATE()) AND createdon <= GETUTCDATE())"
    )
  })

  it("joins related-table conditions", () => {
    const r = sql(
      query([
        cond("", "eq", undefined, {
          kind: "relatedEntity",
          relatedEntityName: "ownerid",
          relatedEntityTarget: "systemuser",
          relatedEntityPrimaryId: "systemuserid",
          relatedEntityAlias: "owner",
          nestedConditions: [cond("fullname", "begins-with", "G")],
          nestedFields: FIELDS.systemuser,
        }),
      ])
    )
    expect(r.sql).toContain(
      "INNER JOIN systemuser AS owner ON owner.systemuserid = account.ownerid"
    )
    expect(r.sql).toContain("WHERE owner.fullname LIKE 'G%'")
    expect(r.sql).toContain("  account.name,")
    expect(lintSql(r.sql, META).filter((p) => p.severity === "error")).toEqual(
      []
    )
  })
})
