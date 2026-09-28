import { describe, expect, it } from "vitest"

import {
  completeSql,
  sqlTablesIn,
} from "@/platforms/ce/query/editor/sql-complete"

import { META } from "./fixtures/meta"

function at(marked: string) {
  const pos = marked.indexOf("|")
  return completeSql(marked.replace("|", ""), pos, META)
}
const labels = (marked: string) => at(marked)?.options.map((o) => o.label) ?? []

describe("completeSql", () => {
  it("suggests tables after FROM and JOIN, related ones first", () => {
    expect(labels("SELECT name FROM |")).toEqual([
      "account",
      "contact",
      "systemuser",
    ])
    const join = at("SELECT a.name FROM account a INNER JOIN |")!.options
    expect(join.find((o) => o.label === "contact")?.boost).toBe(2)
    expect(labels("SELECT name FROM acc|")).toContain("account")
    expect(at("SELECT name FROM acc|")!.from).toBe("SELECT name FROM ".length)
  })

  it("suggests a table's columns after its alias", () => {
    const cols = labels(
      "SELECT c.| FROM account a INNER JOIN contact c ON a.accountid = c.parentcustomerid"
    )
    expect(cols).toContain("fullname")
    expect(cols).not.toContain("revenue")
    expect(labels("SELECT a.na| FROM account a")).toContain("name")
  })

  it("suggests columns of the query's tables, qualified when there are several", () => {
    expect(labels("SELECT | FROM account")).toContain("name")
    expect(labels("SELECT | FROM account")).toContain("COUNT")
    const both = labels(
      "SELECT | FROM account a LEFT JOIN contact c ON a.accountid = c.parentcustomerid"
    )
    expect(both).toContain("a.name")
    expect(both).toContain("c.fullname")
  })

  it("suggests join conditions from relationships after ON", () => {
    expect(
      at("SELECT a.name FROM account a INNER JOIN contact c ON |")!.options[0]
    ).toMatchObject({
      label: "c.parentcustomerid = a.accountid",
      detail: "contact_customer_accounts",
    })
  })

  it("suggests choice values after = and IN (", () => {
    expect(
      at("SELECT name FROM account WHERE statecode = |")!.options.map((o) => [
        o.label,
        o.detail,
      ])
    ).toEqual([
      ["0", "Active"],
      ["1", "Inactive"],
    ])
    expect(
      labels("SELECT a.name FROM account a WHERE a.statecode IN (0, |")
    ).toEqual(["0", "1"])
  })

  it("offers date functions in WHERE, not in SELECT", () => {
    expect(labels("SELECT name FROM account WHERE createdon > |")).toContain(
      "DATEADD"
    )
    expect(labels("SELECT | FROM account")).not.toContain("DATEADD")
  })

  it("stays quiet inside strings and comments", () => {
    expect(at("SELECT name FROM account WHERE name = 'Con|")).toBeNull()
    expect(at("SELECT name FROM account -- a |")).toBeNull()
  })

  it("lists the tables a query uses", () => {
    expect(
      sqlTablesIn(
        "SELECT a.name FROM account a JOIN contact c ON a.accountid = c.parentcustomerid"
      )
    ).toEqual(["account", "contact"])
  })
})
