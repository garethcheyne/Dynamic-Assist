// Microsoft's own examples of what Dataverse SQL does and doesn't take, from
// https://learn.microsoft.com/power-apps/developer/data-platform/webapi/query/sql
// so the checks can't drift from the page without a test saying so.
import { describe, expect, it } from "vitest"

import { lintSql } from "@/platforms/ce/query/editor/sql-lint"

const errors = (sql: string) =>
  lintSql(sql, null)
    .filter((p) => p.severity === "error")
    .map((p) => p.message)

describe("Microsoft's examples of what works", () => {
  it.each([
    "SELECT name FROM account AS a WHERE a.name LIKE 'Fourth Coffee'",
    "SELECT a.name, a.telephone1, a.websiteurl FROM account AS a",
    "SELECT a.name AS account_name, a.telephone1 AS phone FROM account AS a",
    "SELECT a.name, c.fullname, c.emailaddress1 FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid",
    "SELECT a.name, c.fullname FROM account AS a LEFT JOIN contact AS c ON a.accountid = c.parentcustomerid",
    "SELECT a.name, c.fullname, o.name AS opportunity_name FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid INNER JOIN opportunity AS o ON a.accountid = o.customerid",
    "SELECT child.name AS account, parent.name AS parent_account FROM account AS child INNER JOIN account AS parent ON child.parentaccountid = parent.accountid",
    "SELECT a.name, c.fullname, c.emailaddress1 FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid AND c.fullname LIKE 'A%'",
    "SELECT a.name, c.fullname, c.emailaddress1 FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid AND (c.fullname LIKE 'A%' OR c.emailaddress1 LIKE 'B%')",
    "SELECT name, telephone1 FROM account ORDER BY name ASC",
    "SELECT name, createdon FROM account ORDER BY name ASC, createdon DESC",
    "SELECT a.name, c.fullname FROM account AS a LEFT JOIN contact AS c ON a.accountid = c.parentcustomerid ORDER BY c.fullname, a.name DESC",
    "SELECT name, statecode FROM account WHERE statecode <> 1",
    "SELECT name FROM account WHERE name > 'M' ORDER BY name",
    "SELECT name, telephone1 FROM account WHERE statecode = 0 AND telephone1 IS NOT NULL",
    "SELECT name FROM account WHERE (name = 'Contoso' OR name = 'Fabrikam')",
    "SELECT name, telephone1 FROM account WHERE (statecode = 0 OR statecode = 1) AND telephone1 IS NOT NULL",
    "SELECT name FROM account WHERE name LIKE '[%]off'",
    "SELECT name FROM account WHERE name NOT LIKE 'test%'",
    "SELECT name FROM account WHERE name IN ('Contoso', 'Fabrikam', 'Fourth Coffee')",
    "SELECT name FROM account WHERE name NOT IN ('Contoso', 'Fabrikam')",
    "SELECT name FROM account WHERE name BETWEEN 'A' AND 'B'",
    "SELECT name FROM account WHERE telephone1 IS NULL",
    "SELECT DISTINCT a.address1_city FROM account AS a",
    "SELECT a.name FROM account a WHERE a.createdon >= DATEADD(day, -3, '2023-01-01 17:00:00')",
    "SELECT a.name FROM account a WHERE a.createdon >= DATEADD(day, -3, GETUTCDATE())",
    "SELECT name, accountid FROM account WHERE accountid > '00000000-0000-0000-0000-000000000000' ORDER BY accountid",
    "SELECT a.name, COUNT(*) AS contact_count FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid GROUP BY a.name ORDER BY a.name",
    "SELECT COUNT(*) AS total_accounts, SUM(revenue) AS total_revenue, AVG(revenue) AS avg_revenue, MIN(revenue) AS min_revenue, MAX(revenue) AS max_revenue FROM account",
    "SELECT COUNT(*) AS active_contacts FROM contact WHERE statecode = 0",
    // Not from the page's examples, but these must stay clean too
    "SELECT TOP 5 name FROM account",
    "SELECT name FROM account WHERE name = 'ON' AND numberofemployees > 1",
    "SELECT name FROM account WHERE revenue > -1",
  ])("%s", (sql) => {
    expect(errors(sql)).toEqual([])
  })
})

it("warns that FETCH's limit is ignored, as seen on a real org", () => {
  const sql = "SELECT name FROM account ORDER BY name OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY"
  expect(errors(sql)).toEqual([])
  expect(lintSql(sql, null).map((p) => p.message).join(" ")).toMatch(
    /ignores the limit/
  )
})

describe("Microsoft's examples of what doesn't", () => {
  it.each([
    ["SELECT * FROM account", /SELECT \*/],
    ["SELECT 'abc', a.name FROM account a", /fixed value/],
    ["SELECT 1+2 AS IntValue, a.name FROM account a", /Sums/],
    [
      "SELECT DATEADD(day, -3, a.modifiedon), a.name FROM account a",
      /only works in WHERE and ON/,
    ],
    [
      "SELECT a.name FROM account AS a INNER JOIN contact AS c ON c.emailaddress1 LIKE 'B%'",
      /Join with =/,
    ],
    [
      "SELECT a.name FROM account AS a INNER JOIN contact AS c ON a.accountid <> c.parentcustomerid",
      /Join with =/,
    ],
    [
      "SELECT a.name FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid OR c.emailaddress1 LIKE 'B%'",
      /OR only works inside/,
    ],
    [
      "SELECT a.name FROM account AS a INNER JOIN contact AS c ON a.accountid = c.parentcustomerid AND a.name LIKE 'A%'",
      /joined table, c/,
    ],
    ["SELECT name FROM account ORDER BY LEN(name)", /no LEN\(\)/],
    [
      "SELECT accountid FROM account WHERE accountid IN (SELECT accountid FROM account)",
      /Subqueries/,
    ],
    ["SELECT name FROM account a WHERE EXISTS (SELECT 1 FROM contact)", /EXISTS/],
    ["SELECT name FROM account WHERE 1=1", /two values/],
    ["SELECT name FROM account a WHERE a.modifiedon > a.createdon", /two columns/],
    ["SELECT name FROM account a WHERE a.revenue > 500.0 + 125.0", /Sums/],
    [
      "SELECT a.name FROM account a WHERE DATEADD(day, 3, a.createdon) >= GETUTCDATE()",
      /can't take a column/,
    ],
    [
      "SELECT COUNT(*) FROM account a GROUP BY MONTH(a.createdon)",
      /no MONTH\(\)/,
    ],
    ["SELECT name FROM account; SELECT fullname FROM contact", /One statement/],
    ["SELECT COALESCE(name, 'x') FROM account", /no COALESCE\(\)/],
    [
      "SELECT name, COUNT(*) AS n FROM account GROUP BY name HAVING COUNT(*) > 1",
      /HAVING/,
    ],
    ["DELETE FROM account", /Only SELECT/],
  ])("%s", (sql, why) => {
    expect(errors(sql).join(" | ")).toMatch(why)
  })
})
