import { describe, expect, it } from "vitest"

import type { BcField, BcTable } from "@/platforms/bc/query/bridge"
import { runAggregate } from "@/platforms/bc/query/sql/aggregate"
import { completeBcSql } from "@/platforms/bc/query/sql/complete"
import {
  fromSql,
  quoteFilter,
  type BcSqlMeta,
} from "@/platforms/bc/query/sql/from-sql"
import { filterToSql, toBcSql } from "@/platforms/bc/query/sql/to-sql"

const field = (
  no: number,
  name: string,
  extra: Partial<BcField> = {}
): BcField => ({
  no,
  name,
  caption: name,
  type: "Text",
  class: "Normal",
  length: 50,
  enabled: true,
  obsolete: false,
  pk: false,
  ...extra,
})

const CUSTOMER: BcField[] = [
  field(1, "No.", { pk: true, type: "Code" }),
  field(2, "Name"),
  field(7, "City"),
  field(29, "Salesperson Code", { type: "Code", relationTable: 13 }),
  field(59, "Balance (LCY)", { type: "Decimal", class: "FlowField" }),
  field(39, "Blocked", {
    type: "Option",
    options: [" ", "Ship", "Invoice", "All"],
  }),
  field(90, "Picture", { type: "BLOB" }),
  field(100, "Credit Limit", { type: "Decimal" }),
  field(101, "Last Date", { type: "Date", caption: "Last Date Modified" }),
  field(102, "Privacy Blocked", { type: "Boolean" }),
]
const SALESPERSON: BcField[] = [
  field(1, "Code", { pk: true, type: "Code" }),
  field(2, "Name"),
]
const TABLES = [
  { id: 18, name: "Customer", caption: "Customer" },
  { id: 13, name: "Salesperson/Purchaser", caption: "Salesperson" },
  { id: 36, name: "Sales Header", caption: "Sales Header" },
] as BcTable[]
const meta: BcSqlMeta = {
  tables: TABLES,
  fields: (t) => (t === 18 ? CUSTOMER : t === 13 ? SALESPERSON : null),
}
const NOW = () => new Date(2026, 10, 6, 12)
const sql = (text: string) => fromSql(text, meta, NOW)
const ok = (text: string) => {
  const r = sql(text)
  expect(r.problems.filter((p) => p.severity === "error")).toEqual([])
  return r
}
const errors = (text: string) =>
  sql(text)
    .problems.filter((p) => p.severity === "error")
    .map((p) => p.message)
    .join(" / ")

describe("SQL to a Business Central query", () => {
  it("reads columns and the table, by name, caption or number", () => {
    const { query } = ok("SELECT [No.], Name, [59] FROM Customer")
    expect(query).toMatchObject({ table: 18, fields: [1, 2, 59], filters: [] })
    expect(ok("SELECT Name FROM [18]").query?.table).toBe(18)
    expect(ok("SELECT Name FROM Salesperson").query?.table).toBe(13)
  })

  it("is not fooled by comments or case", () => {
    const { query } = ok("select name -- the name\nfrom customer /* x */")
    expect(query?.fields).toEqual([2])
  })

  it("SELECT * is every plain field, without BLOBs or FlowFields", () => {
    const fields = ok("SELECT * FROM Customer").query?.fields
    expect(fields).toContain(1)
    expect(fields).not.toContain(90)
    expect(fields).not.toContain(59)
  })

  it("TOP", () => {
    expect(ok("SELECT TOP 5 Name FROM Customer").query?.top).toBe(5)
    expect(ok("SELECT TOP (5) Name FROM Customer").query?.top).toBe(5)
  })

  it.each([
    ["Name = 'A'", "A"],
    ["Name <> 'A'", "<>A"],
    ["[Credit Limit] > 100", ">100"],
    ["[Credit Limit] <= 100", "<=100"],
    ["[Credit Limit] != 5", "<>5"],
    ["[Credit Limit] = -5", "-5"],
    ["Name LIKE 'Con%'", "@Con*"],
    ["Name LIKE '_ontoso'", "@?ontoso"],
    ["Name NOT LIKE 'Con%'", "<>@Con*"],
    ["[Credit Limit] BETWEEN 10 AND 20", "10..20"],
    ["City IN ('NZ', 'AU')", "NZ|AU"],
    ["City NOT IN ('NZ', 'AU')", "<>NZ&<>AU"],
    ["City IS NULL", "''"],
    ["City IS NOT NULL", "<>''"],
    ["City = 'A' OR City = 'B'", "A|B"],
    ["(City = 'A' OR City = 'B')", "A|B"],
    ["UPPER(Name) = 'ABC'", "@ABC"],
    ["LOWER(Name) LIKE 'a%'", "@a*"],
    ["YEAR([Last Date]) = 2025", "2025-01-01..2025-12-31"],
    ["[Last Date] = TODAY()", "t"],
    ["[Last Date] >= WORKDATE()", ">=w"],
    ["[Last Date] >= DATEADD(day, -30, TODAY())", ">=2026-10-07"],
    ["[Last Date] >= DATEADD(month, -1, GETDATE())", ">=2026-10-06"],
    ["[Last Date] >= DATEADD(year, 1, '2025-01-15')", ">=2026-01-15"],
    [
      "[Last Date] BETWEEN DATEADD(week, -1, TODAY()) AND TODAY()",
      "2026-10-30..t",
    ],
    ["[Privacy Blocked] = TRUE", "Yes"],
  ])("WHERE %s becomes the filter %s", (where, filter) => {
    const { query } = ok(`SELECT Name FROM Customer WHERE ${where}`)
    expect(query?.filters.map((f) => f.filter)).toEqual([filter])
  })

  it("quotes values holding a filter's special characters", () => {
    expect(
      ok("SELECT Name FROM Customer WHERE Name = 'A&B'").query?.filters[0]
        .filter
    ).toBe("'A&B'")
    expect(
      ok("SELECT Name FROM Customer WHERE Name = 'O''Brien'").query?.filters[0]
        .filter
    ).toBe("'O''Brien'")
    expect(
      ok("SELECT Name FROM Customer WHERE Name LIKE 'A.B%'").query?.filters[0]
        .filter
    ).toBe("@'A.B'*")
    expect(quoteFilter("plain")).toBe("plain")
    expect(quoteFilter("")).toBe("''")
    expect(quoteFilter("a|b")).toBe("'a|b'")
  })

  it("conditions on different fields are separate filters", () => {
    const { query } = ok(
      "SELECT Name FROM Customer WHERE City = 'A' AND [Credit Limit] > 5"
    )
    expect(query?.filters).toEqual([
      { field: 7, filter: "A" },
      { field: 100, filter: ">5" },
    ])
  })

  it("conditions on one field combine, as BC filters each field once", () => {
    const { query } = ok(
      "SELECT Name FROM Customer WHERE [Credit Limit] > 5 AND [Credit Limit] < 9"
    )
    expect(query?.filters).toEqual([{ field: 100, filter: ">5&<9" }])
    const mixed = ok(
      "SELECT Name FROM Customer WHERE (City = 'A' OR City = 'B') AND City <> 'C'"
    )
    expect(mixed.query?.filters[0].filter).toBe("(A|B)&<>C")
    // Brackets say what's meant, and BETWEEN's own AND isn't one of these
    expect(
      ok(
        "SELECT Name FROM Customer WHERE (City = 'A' OR City = 'B') AND Name = 'C'"
      ).query?.filters.map((f) => f.filter)
    ).toEqual(["A|B", "C"])
    expect(
      ok(
        "SELECT Name FROM Customer WHERE [Credit Limit] BETWEEN 1 AND 2 OR [Credit Limit] = 5"
      ).query?.filters[0].filter
    ).toBe("1..2|5")
  })

  it("BETWEEN's AND isn't mistaken for the next condition", () => {
    const { query } = ok(
      "SELECT Name FROM Customer WHERE [Credit Limit] BETWEEN 1 AND 2 AND City = 'X'"
    )
    expect(query?.filters).toEqual([
      { field: 100, filter: "1..2" },
      { field: 7, filter: "X" },
    ])
  })

  it("ORDER BY", () => {
    const { query } = ok("SELECT Name FROM Customer ORDER BY City, Name")
    expect(query).toMatchObject({ sort: [7, 2], descending: false })
    expect(
      ok("SELECT Name FROM Customer ORDER BY Name DESC").query?.descending
    ).toBe(true)
  })

  it("LEFT JOIN through a lookup, with the join's columns and filters", () => {
    const { query } = ok(`SELECT c.Name, s.Name
      FROM Customer c LEFT JOIN Salesperson s ON c.[Salesperson Code] = s.Code
      WHERE s.Name LIKE 'A%' AND c.City = 'X'`)
    expect(query?.fields).toEqual([2])
    expect(query?.filters).toEqual([{ field: 7, filter: "X" }])
    expect(query?.joins).toEqual([
      {
        id: "s",
        field: 29,
        table: 13,
        key: 1,
        fields: [2],
        filters: [{ field: 2, filter: "@A*" }],
        inner: false,
      },
    ])
  })

  it("INNER JOIN, written either way round", () => {
    const { query } = ok(
      "SELECT c.Name, s.Name FROM Customer c INNER JOIN Salesperson s ON s.Code = c.[Salesperson Code]"
    )
    expect(query?.joins?.[0]).toMatchObject({ inner: true, field: 29, key: 1 })
  })

  it("an empty result rather than a guess while tables load", () => {
    const r = sql("SELECT Name FROM [Sales Header]")
    expect(r.query).toBeNull()
    expect(r.problems).toEqual([])
  })

  it.each([
    ["DELETE FROM Customer", /Only SELECT/],
    ["SELECT Name", /Say which table/],
    ["SELECT Name FROM Nope", /There's no table Nope/],
    ["SELECT Nope FROM Customer", /Customer has no field Nope/],
    ["SELECT x.Name FROM Customer c", /x isn't a table or alias/],
    ["SELECT DISTINCT Name FROM Customer", /DISTINCT can't be translated/],
    [
      "SELECT Name FROM Customer WHERE City = 'A' OR Name = 'B'",
      /OR across different fields/,
    ],
    // AND comes first in SQL: these would otherwise run with a different meaning
    [
      "SELECT Name FROM Customer WHERE City = 'A' AND Name = 'B' OR Name = 'C'",
      /without brackets/,
    ],
    [
      "SELECT Name FROM Customer WHERE City = 'A' OR City = 'B' AND Name = 'C'",
      /without brackets/,
    ],
    [
      "SELECT Name FROM Customer WHERE City = 'A' AND City = 'B' OR City = 'C'",
      /without brackets/,
    ],
    [
      "SELECT Name FROM Customer WHERE (City = 'A' AND Name = 'B') OR Name = 'C'",
      /AND inside brackets/,
    ],
    ["SELECT Name FROM Customer WHERE City = Name", /comparing two fields/],
    ["SELECT Name FROM Customer ORDER BY City ASC, Name DESC", /one way/],
    [
      "SELECT Name FROM Customer WHERE SUM(Name) > 1",
      /SUM\(\) can't go in WHERE/,
    ],
    [
      "SELECT Name FROM Customer WHERE FOO(Name) = 1",
      /FOO\(\) can't be translated/,
    ],
    [
      "SELECT COALESCE(Name, City) FROM Customer",
      /COALESCE\(\) can't go in SELECT/,
    ],
    [
      "SELECT c.Name FROM Customer c LEFT JOIN Salesperson s ON c.City = s.Code",
      /isn't a lookup|looks up/,
    ],
    [
      "SELECT c.Name FROM Customer c RIGHT JOIN Salesperson s ON c.[Salesperson Code] = s.Code",
      /RIGHT JOIN can't be translated/,
    ],
    [
      "SELECT Name FROM Customer UNION SELECT Name FROM Customer",
      /UNION can't be translated/,
    ],
    [
      "SELECT Name FROM Customer WHERE City IN (SELECT City FROM Customer)",
      /Subqueries/,
    ],
    ["SELECT Name; SELECT City FROM Customer", /./],
    ["SELECT Name, COUNT(*) FROM Customer", /needs to be in GROUP BY/],
    [
      "SELECT c.Name, SUM(c.[Credit Limit]) FROM Customer c LEFT JOIN Salesperson s ON c.[Salesperson Code] = s.Code GROUP BY c.Name",
      /across a join/,
    ],
  ])("explains why it can't: %s", (text, why) => {
    const r = sql(text)
    const hard = r.problems.filter(
      (p) => p.severity === "error" || p.severity === "info"
    )
    expect(hard.map((p) => p.message).join(" / ")).toMatch(why)
  })

  it("says where the problem is", () => {
    const text = "SELECT Nope FROM Customer"
    const [p] = sql(text).problems
    expect(text.slice(p.from, p.to)).toBe("Nope")
  })

  it("warns about = NULL, and still works", () => {
    const r = sql("SELECT Name FROM Customer WHERE City = NULL")
    expect(r.problems[0]).toMatchObject({ severity: "warning" })
    expect(r.query?.filters[0].filter).toBe("''")
  })

  it("never lets an unfinished query through as if it were whole", () => {
    for (const text of [
      "SELECT",
      "SELECT Name FROM",
      "SELECT Name FROM Customer WHERE",
      "SELECT Name FROM Customer WHERE City",
      "SELECT Name FROM Customer WHERE City =",
      "SELECT Name FROM Customer WHERE City IN (",
      "SELECT Name FROM Customer WHERE City BETWEEN",
      "SELECT Name FROM Customer c LEFT JOIN",
      "SELECT Name FROM Customer c LEFT JOIN Salesperson s ON",
      "SELECT Name FROM Customer ORDER BY",
    ])
      expect(() => sql(text)).not.toThrow()
    expect(errors("SELECT Name FROM Customer WHERE City =")).not.toBe("")
    expect(errors("SELECT Name FROM")).not.toBe("")
  })
})

describe("aggregates", () => {
  const page = (rows: unknown[][], more = false, next?: string) => ({
    table: 18,
    name: "Customer",
    caption: "Customer",
    columns: [
      { no: 7, name: "City", caption: "City", type: "Text", class: "Normal" },
      {
        no: 100,
        name: "Credit Limit",
        caption: "Credit Limit",
        type: "Decimal",
        class: "Normal",
      },
    ],
    rows,
    more,
    next,
    view: "",
    ms: 1,
  })
  const plan = (text: string) => {
    const r = ok(text)
    return { query: r.query!, aggregate: r.aggregate! }
  }

  it("compiles to the fields it needs", () => {
    const { query, aggregate } = plan(
      "SELECT City, SUM([Credit Limit]) AS total, COUNT(*) AS n FROM Customer WHERE City <> '' GROUP BY City ORDER BY total DESC"
    )
    expect(query.fields).toEqual([7, 100])
    expect(aggregate).toMatchObject({
      groupBy: [7],
      measures: [
        { fn: "SUM", field: 100, label: "total" },
        { fn: "COUNT", field: null, label: "n" },
      ],
      order: [{ key: "total", descending: true }],
    })
  })

  it("a lone COUNT(*) is the companion's own count", async () => {
    const { query, aggregate } = plan("SELECT COUNT(*) FROM Customer")
    const asked: unknown[] = []
    const out = await runAggregate(query, aggregate, async (q) => {
      asked.push(q)
      return { ...page([]), count: 87 }
    })
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ count: true, top: 1 })
    expect(out.result.rows).toEqual([[87]])
  })

  it("groups, adds up, sorts and takes TOP, across pages", async () => {
    const { query, aggregate } = plan(
      "SELECT TOP 2 City, SUM([Credit Limit]) AS total, COUNT(*) AS n, AVG([Credit Limit]) AS a, MIN([Credit Limit]) AS lo, MAX([Credit Limit]) AS hi FROM Customer GROUP BY City ORDER BY total DESC"
    )
    expect(query.top).toBeNull()
    const pages = [
      page(
        [
          ["A", 10],
          ["B", 5],
        ],
        true,
        "c1"
      ),
      page([
        ["A", 30],
        ["C", 1],
        ["B", null],
      ]),
    ]
    const asked: { after?: string }[] = []
    const out = await runAggregate(query, aggregate, async (q) => {
      asked.push(q)
      return pages.shift()!
    })
    expect(asked[1].after).toBe("c1")
    expect(out.rows).toBe(5)
    expect(out.capped).toBe(false)
    expect(out.result.columns.map((c) => c.caption)).toEqual([
      "City",
      "total",
      "n",
      "a",
      "lo",
      "hi",
    ])
    expect(out.result.rows).toEqual([
      ["A", 40, 2, 20, 10, 30],
      ["B", 5, 2, 5, 5, 5],
    ])
  })

  it("no rows and no GROUP BY still answers one row", async () => {
    const { query, aggregate } = plan(
      "SELECT COUNT([Credit Limit]) AS n, SUM([Credit Limit]) AS s FROM Customer"
    )
    const out = await runAggregate(query, aggregate, async () => page([]))
    expect(out.result.rows).toEqual([[0, null]])
  })

  it("stops at the cap and says so, rather than a short total", async () => {
    const { query, aggregate } = plan(
      "SELECT SUM([Credit Limit]) AS s FROM Customer"
    )
    const full = Array.from({ length: 5000 }, () => ["A", 1])
    const out = await runAggregate(query, aggregate, async () =>
      page(full, true, "more")
    )
    expect(out.capped).toBe(true)
    expect(out.rows).toBe(50_000)
  })
})

describe("a query as SQL", () => {
  const table = { name: "Customer" }
  it.each([
    ["A", "City = 'A'"],
    ["<>A", "City <> 'A'"],
    ["''", "City IS NULL"],
    ["<>''", "City IS NOT NULL"],
    ["A|B", "City IN ('A', 'B')"],
    ["10..20", "City BETWEEN '10' AND '20'"],
    ["@Con*", "City LIKE 'Con%'"],
    ["<>@Con*", "City NOT LIKE 'Con%'"],
    ["t", "City = TODAY()"],
    ["'A&B'", "City = 'A&B'"],
    ["'O''Brien'", "City = 'O''Brien'"],
    [">5&<9", "City > '5' AND City < '9'"],
  ])("the filter %s", (filter, want) => {
    expect(filterToSql(filter, "City", CUSTOMER[2])).toBe(want)
  })

  it("numbers stay numbers on a numeric field", () => {
    expect(filterToSql(">5", "x", CUSTOMER[7])).toBe("x > 5")
    expect(filterToSql("10..20", "x", CUSTOMER[7])).toBe("x BETWEEN 10 AND 20")
  })

  it("a filter with no SQL form is listed and left out, never altered", () => {
    expect(filterToSql("(A|B)&<>C", "City", CUSTOMER[2])).toBeNull()
    const text = toBcSql(
      {
        table: 18,
        fields: [2],
        filters: [{ field: 7, filter: "(A|B)&<>C" }],
        sort: [],
        descending: false,
        top: null,
      },
      table,
      CUSTOMER
    )
    expect(text).toMatch(/-- Left out, it has no SQL form: City: \(A\|B\)&<>C/)
    expect(text).not.toMatch(/WHERE/)
  })

  const roundTrips: [string, Parameters<typeof toBcSql>[0]][] = [
    [
      "columns, filters and sort",
      {
        table: 18,
        fields: [1, 2, 59],
        filters: [
          { field: 7, filter: "A|B" },
          { field: 100, filter: ">5" },
        ],
        sort: [2],
        descending: true,
        top: 10,
      },
    ],
    [
      "a blank and a wildcard",
      {
        table: 18,
        fields: [2],
        filters: [
          { field: 7, filter: "''" },
          { field: 2, filter: "@Con*" },
        ],
        sort: [],
        descending: false,
        top: null,
      },
    ],
    [
      "a join",
      {
        table: 18,
        fields: [2],
        filters: [],
        sort: [],
        descending: false,
        top: null,
        joins: [
          {
            id: "x",
            field: 29,
            table: 13,
            key: 1,
            fields: [2],
            filters: [{ field: 2, filter: "A" }],
            inner: true,
          },
        ],
      },
    ],
  ]
  it.each(roundTrips)("round trips: %s", (_name, query) => {
    const text = toBcSql(query, table, CUSTOMER, {
      13: {
        name: "Salesperson/Purchaser",
        caption: "Salesperson",
        fields: SALESPERSON,
      },
    })
    const back = ok(text).query!
    expect(back.table).toBe(query.table)
    expect(back.fields).toEqual(query.fields)
    expect(back.sort).toEqual(query.sort)
    expect(back.descending).toBe(query.descending)
    expect(back.top).toBe(query.top)
    expect(back.filters.map((f) => [f.field, f.filter]).sort()).toEqual(
      query.filters.map((f) => [f.field, f.filter]).sort()
    )
    if (query.joins) {
      expect(back.joins?.[0]).toMatchObject({
        field: 29,
        table: 13,
        key: 1,
        fields: [2],
        inner: true,
      })
      expect(back.joins?.[0].filters).toEqual(query.joins[0].filters)
    }
  })
})

describe("suggestions", () => {
  const at = (text: string) => {
    const pos = text.indexOf("|")
    const clean = text.replace("|", "")
    return completeBcSql(clean, pos, meta)
  }
  const labels = (text: string) => at(text)?.options.map((o) => o.label) ?? []

  it("tables after FROM", () => {
    const l = labels("SELECT Name FROM |")
    expect(l).toContain("Customer")
    expect(l).toContain("[Sales Header]")
    expect(l).toContain("[Salesperson/Purchaser]")
  })
  it("after JOIN, what the main table looks up comes first", () => {
    const options = at("SELECT Name FROM Customer c LEFT JOIN |")!.options
    const salesperson = options.find(
      (o) => o.label === "[Salesperson/Purchaser]"
    )!
    expect(salesperson.boost).toBeGreaterThan(0)
    expect(salesperson.info).toMatch(/Through Customer\.Salesperson Code/)
  })
  it("fields, bracketed when they need it, and what kind they are", () => {
    const options = at("SELECT | FROM Customer")!.options
    const balance = options.find((o) => o.label === "[Balance (LCY)]")!
    expect(balance.info).toMatch(/FlowField/)
    expect(options.map((o) => o.label)).toContain("Name")
  })
  it("the fields of an alias", () => {
    const l = labels(
      "SELECT s.| FROM Customer c LEFT JOIN Salesperson s ON c.[Salesperson Code] = s.Code"
    )
    expect(l).toEqual(["Code", "Name"])
  })
  it("the fields of an alias on the only table", () => {
    expect(labels("SELECT c.| FROM Customer c")).toContain("Name")
  })
  it("names with and without brackets sort together", () => {
    const options = at("SELECT | FROM Customer")!.options
    const sortOf = (label: string) =>
      options.find((o) => o.label === label)!.sortText
    expect(sortOf("[Balance (LCY)]")).toBe("Balance (LCY)")
    expect(sortOf("Name")).toBe("Name")
  })
  it("the join condition, from the real lookup", () => {
    const l = labels(
      "SELECT c.Name FROM Customer c LEFT JOIN Salesperson s ON |"
    )
    expect(l[0]).toBe("c.[Salesperson Code] = s.Code")
  })
  it("a field's options after =", () => {
    expect(labels("SELECT Name FROM Customer WHERE Blocked = |")).toEqual([
      "'Ship'",
      "'Invoice'",
      "'All'",
    ])
    expect(
      labels("SELECT Name FROM Customer WHERE Blocked IN ('Ship', |")
    ).toContain("'All'")
  })
  it("yes or no on a Boolean", () => {
    expect(
      labels("SELECT Name FROM Customer WHERE [Privacy Blocked] = |")
    ).toEqual(["TRUE", "FALSE"])
  })
  it("date functions as a value", () => {
    const l = labels("SELECT Name FROM Customer WHERE [Last Date] >= |")
    expect(l).toEqual(expect.arrayContaining(["TODAY", "WORKDATE", "DATEADD"]))
  })
  it("functions that fit the clause", () => {
    expect(labels("SELECT | FROM Customer")).toEqual(
      expect.arrayContaining(["COUNT", "SUM", "AVG", "MIN", "MAX"])
    )
    expect(labels("SELECT | FROM Customer")).not.toContain("YEAR")
    expect(labels("SELECT Name FROM Customer WHERE |")).toEqual(
      expect.arrayContaining(["YEAR", "UPPER", "LOWER"])
    )
  })
  it("only keywords that translate", () => {
    const l = labels("SELECT Name FROM Customer |")
    expect(l).toEqual(
      expect.arrayContaining(["WHERE", "LEFT JOIN", "ORDER BY", "GROUP BY"])
    )
    expect(l).not.toContain("HAVING")
    expect(l).not.toContain("UNION")
  })
  it("nothing inside a string or comment", () => {
    expect(at("SELECT Name FROM Customer WHERE City = 'ab|")).toBeNull()
    expect(at("SELECT Name -- note|")).toBeNull()
  })
  it("doesn't throw on a half-typed query", () => {
    for (const text of [
      "|",
      "S|",
      "SELECT [|",
      "SELECT Name FROM [Sales|",
      "SELECT Name FROM Customer WHERE Blocked IN (|",
    ])
      expect(() => at(text)).not.toThrow()
  })
})
