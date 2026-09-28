import { describe, expect, it } from "vitest"

import { lintSql } from "@/platforms/ce/query/editor/sql-lint"
import { readSql } from "@/platforms/ce/query/editor/sql-parse"

import { META } from "./fixtures/meta"

const messages = (sql: string) =>
  lintSql(sql, META).map((p) => `${p.severity}: ${p.message}`)

describe("readSql", () => {
  it("finds tables, aliases, columns and clauses", () => {
    const q = readSql(
      "SELECT a.name, c.fullname AS person, COUNT(*) n FROM account AS a LEFT JOIN contact c ON a.accountid = c.parentcustomerid WHERE a.statecode = 0 ORDER BY person"
    )
    expect(q.tables).toMatchObject([
      { table: "account", alias: "a", join: "from" },
      { table: "contact", alias: "c", join: "left" },
    ])
    expect(
      q.columns.map((c) => `${c.clause}:${c.qualifier ?? ""}.${c.column}`)
    ).toEqual([
      "select:a.name",
      "select:c.fullname",
      "on:a.accountid",
      "on:c.parentcustomerid",
      "where:a.statecode",
      "order:.person",
    ])
    expect([...q.columnAliases]).toEqual(["person", "n"])
  })

  it("reads bracketed names, strings with quotes and comments", () => {
    const q = readSql(
      "SELECT [name] FROM [account] -- note\nWHERE name = 'O''Brien'"
    )
    expect(q.tables[0].table).toBe("account")
    expect(q.code.find((t) => t.kind === "string")?.value).toBe("O'Brien")
    expect(q.tokens.some((t) => t.kind === "comment")).toBe(true)
  })
})

describe("lintSql", () => {
  it("passes the documented examples", () => {
    for (const sql of [
      "SELECT name FROM account AS a WHERE a.name LIKE 'Fourth Coffee'",
      "SELECT a.name, c.fullname, c.emailaddress1 FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid AND c.fullname LIKE 'A%'",
      "SELECT a.name, COUNT(*) AS contact_count FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid GROUP BY a.name ORDER BY a.name",
      "SELECT a.name FROM account a WHERE a.createdon >= DATEADD(day, -3, GETUTCDATE())",
      "SELECT name FROM account WHERE statecode IN (0, 1) AND revenue BETWEEN 10 AND 20",
      "SELECT DISTINCT a.name FROM account AS a",
      "SELECT owneridname FROM account",
    ])
      expect(lintSql(sql, null).filter((p) => p.severity === "error")).toEqual(
        []
      )
  })

  it("rejects what Dataverse SQL doesn't support", () => {
    expect(messages("SELECT * FROM account")).toEqual([
      "error: Name the columns: Dataverse SQL doesn't support SELECT *",
    ])
    expect(messages("UPDATE account SET name = 'x'")[0]).toBe(
      "error: Only SELECT queries: Dataverse SQL is read-only"
    )
    expect(
      messages("SELECT name FROM account; SELECT fullname FROM contact")
    ).toContain(
      "error: One statement per query: Dataverse doesn't return several result sets"
    )
    expect(
      messages(
        "SELECT name FROM account WHERE accountid IN (SELECT accountid FROM account)"
      )
    ).toContain("error: Subqueries aren't supported")
    expect(
      messages(
        "SELECT name, COUNT(*) AS n FROM account GROUP BY name HAVING COUNT(*) > 1"
      )
    ).toContain(
      "error: HAVING isn't supported: filter with WHERE before grouping"
    )
    expect(
      messages(
        "SELECT a.name FROM account a RIGHT JOIN contact c ON a.accountid = c.parentcustomerid"
      )
    ).toContain(
      "error: RIGHT JOIN isn't supported: swap the tables and use LEFT JOIN"
    )
    expect(messages("SELECT UPPER(name) FROM account")).toContain(
      "error: Dataverse SQL has no UPPER() function"
    )
    expect(
      messages(
        "SELECT name FROM account WHERE DATEADD(day, 3, createdon) >= GETUTCDATE()"
      )
    ).toContain(
      "error: DATEADD() can't take a column: apply it to a constant and compare the column with it"
    )
    expect(
      messages("SELECT name FROM account WHERE modifiedon > createdon")
    ).toContain(
      "error: Compare a column with a value: comparing two columns isn't supported"
    )
    expect(
      messages(
        "SELECT a.name FROM account a INNER JOIN contact c ON a.accountid <> c.parentcustomerid"
      )
    ).toContain(
      "error: Join with = between the two tables' columns (other conditions go after AND)"
    )
    expect(messages("SELECT GETUTCDATE() FROM account")).toContain(
      "error: GETUTCDATE() only works in WHERE and ON"
    )
  })

  it("warns about = NULL and leading wildcards", () => {
    expect(messages("SELECT name FROM account WHERE name = NULL")).toEqual([
      "warning: Use IS NULL: comparing with NULL never matches",
    ])
    expect(
      messages("SELECT name FROM account WHERE name LIKE '%coffee'")
    ).toEqual([
      "info: A leading % can't use an index and scans the whole table",
    ])
  })

  it("checks tables and columns against metadata", () => {
    expect(messages("SELECT name FROM acount")).toEqual([
      "error: There's no table acount",
    ])
    expect(messages("SELECT nam FROM account")).toEqual([
      "error: account has no column nam",
    ])
    expect(messages("SELECT x.name FROM account a")).toEqual([
      "error: x isn't a table or alias in this query",
    ])
    expect(messages("SELECT a.fullname FROM account a")).toEqual([
      "error: account has no column fullname",
    ])
    expect(
      messages(
        "SELECT statecode FROM account a INNER JOIN contact c ON a.accountid = c.parentcustomerid"
      )
    ).toEqual(["warning: statecode is on a and c: say which (alias.statecode)"])
    expect(messages("SELECT name AS n FROM account ORDER BY n")).toEqual([])
  })

  it("wants a choice's value, not its label", () => {
    expect(
      messages("SELECT name FROM account WHERE statecode = 'Active'")
    ).toEqual(["warning: Use the value 0, not the label 'Active'"])
  })
})
