import { describe, expect, it } from "vitest"

import { pascal, toAl } from "@/platforms/bc/query/al"
import {
  requestPlans,
  standardRequest,
  toApiQuery,
} from "@/platforms/bc/query/api"
import {
  ctx,
  customer,
  customersApi,
  joinFields,
  paymentTermsJoin,
  query,
  related,
  salespersonJoin,
} from "./fixtures"

const api = (q = query()) => toApiQuery(q, customer, joinFields, ctx, related)

describe("joins in the API query", () => {
  it("nests the related table with a DataItemLink back to the lookup field", () => {
    const r = api(query({ joins: [salespersonJoin()] }))
    expect(r.al).toContain(
      `dataitem(salespersonPurchaser; "Salesperson/Purchaser")`
    )
    expect(r.al).toContain(`DataItemLink = Code = customer."Salesperson Code";`)
    expect(r.al).toContain("SqlJoinType = LeftOuterJoin;")
    expect(r.al).toContain("column(salespersonPurchaserName; Name)")
  })

  it("selects joined columns alongside the main ones", () => {
    const r = api(query({ joins: [salespersonJoin({ fields: [2, 5102] })] }))
    expect(r.options).toContainEqual([
      "$select",
      "no,name,salespersonPurchaserName,salespersonPurchaserEMail",
    ])
  })

  it("makes it an inner join for 'only with a match' and for related filters", () => {
    expect(
      api(query({ joins: [salespersonJoin({ inner: true })] })).al
    ).toContain("SqlJoinType = InnerJoin;")
    const filtered = api(
      query({
        joins: [salespersonJoin({ filters: [{ field: 2, filter: "A*" }] })],
      })
    )
    expect(filtered.al).toContain("SqlJoinType = InnerJoin;")
    expect(filtered.options).toContainEqual([
      "$filter",
      "startswith(salespersonPurchaserName,'A')",
    ])
  })

  it("keeps related filters OData can't express in the object, on the nested item", () => {
    const r = api(
      query({
        joins: [salespersonJoin({ filters: [{ field: 3, filter: "(>5)" }] })],
      })
    )
    // A filtered field is a column (so $filter could reach it), not in $select
    const nested = r.al.slice(r.al.indexOf("dataitem(salespersonPurchaser"))
    expect(nested).toContain(
      `column(salespersonPurchaserCommission; "Commission %")`
    )
    expect(r.al).toContain(
      "CurrQuery.SetFilter(salespersonPurchaserCommission, '(>5)');"
    )
    expect(r.options).toContainEqual([
      "$select",
      "no,name,salespersonPurchaserName",
    ])
    expect(r.inQuery).toEqual(["Salesperson/Purchaser.Commission %: (>5)"])
  })

  it("chains several joins, each linking back to the main table", () => {
    const r = api(query({ joins: [salespersonJoin(), paymentTermsJoin()] }))
    const sp = r.al.indexOf("dataitem(salespersonPurchaser")
    const pt = r.al.indexOf(`dataitem(paymentTerms; "Payment Terms")`)
    expect(sp).toBeGreaterThan(0)
    expect(pt).toBeGreaterThan(sp)
    expect(r.al).toContain(
      `DataItemLink = Code = customer."Payment Terms Code";`
    )
    // Braces balance
    expect((r.al.match(/\{/g) ?? []).length).toBe(
      (r.al.match(/\}/g) ?? []).length
    )
  })

  it("gives joined columns names that can't clash with the main ones", () => {
    const r = api(
      query({
        fields: [1, 2],
        joins: [salespersonJoin({ fields: [1, 2] })],
      })
    )
    expect(r.al).toContain("column(name; Name)")
    expect(r.al).toContain("column(salespersonPurchaserName; Name)")
    expect(r.al).toContain("column(salespersonPurchaserCode; Code)")
  })

  it("skips joins it can't describe (missing metadata)", () => {
    const r = toApiQuery(
      query({ joins: [salespersonJoin()] }),
      customer,
      joinFields,
      ctx,
      {}
    )
    expect(r.al).not.toContain("dataitem(salespersonPurchaser")
  })
})

describe("joins in record code", () => {
  it("names variables after the table", () => {
    expect(pascal("Salesperson/Purchaser")).toBe("SalespersonPurchaser")
    expect(pascal("G/L Entry")).toBe("GLEntry")
    expect(pascal("123 Table")).toBe("T123Table")
  })

  it("looks up the related record per row: left join", () => {
    const code = toAl(
      query({ joins: [salespersonJoin()] }),
      customer,
      joinFields,
      related
    )
    expect(code).toContain(
      `SalespersonPurchaser: Record "Salesperson/Purchaser";`
    )
    expect(code).toContain("SalespersonPurchaser.SetLoadFields(Name);")
    expect(code).toContain(
      `SalespersonPurchaser.SetRange(Code, Rec."Salesperson Code");`
    )
    expect(code).toContain("if not SalespersonPurchaser.FindFirst() then")
    expect(code).toContain("SalespersonPurchaser.Init();")
  })

  it("inner join: only rows with a match, with the related filters set once", () => {
    const code = toAl(
      query({
        joins: [salespersonJoin({ filters: [{ field: 2, filter: "O'Br*" }] })],
      }),
      customer,
      joinFields,
      related
    )
    expect(code).toContain("SalespersonPurchaser.SetFilter(Name, 'O''Br*');")
    expect(code).toContain("if SalespersonPurchaser.FindFirst() then begin")
    expect(code).toContain("// Only rows with a match get here")
  })

  it("keeps variable names unique when two lookups use one table", () => {
    const code = toAl(
      query({
        joins: [
          salespersonJoin(),
          salespersonJoin({ id: "j2", field: 27, table: 13 }),
        ],
      }),
      customer,
      joinFields,
      related
    )
    expect(code).toContain(
      `SalespersonPurchaser: Record "Salesperson/Purchaser";`
    )
    expect(code).toContain(
      `SalespersonPurchaser2: Record "Salesperson/Purchaser";`
    )
  })
})

describe("joins and installed APIs", () => {
  it("an API page returns one table, so a join means it isn't exact", () => {
    const p = standardRequest(
      query({
        joins: [salespersonJoin({ filters: [{ field: 2, filter: "A*" }] })],
      }),
      joinFields,
      customersApi,
      ctx,
      related
    )
    expect(p.missing).toContain("Salesperson/Purchaser.Name")
    expect(p.unfiltered).toContain("Salesperson/Purchaser.Name: A*")
    expect(p.ready).toBe(false)
  })

  it("an inner join with no filters is still something the API can't do", () => {
    const p = standardRequest(
      query({ joins: [salespersonJoin({ inner: true, fields: [] })] }),
      joinFields,
      customersApi,
      ctx,
      related
    )
    expect(p.unfiltered).toEqual(["only rows with a Salesperson/Purchaser"])
  })

  it("so the plans fall back to the custom API query", () => {
    const plans = requestPlans(
      query({ joins: [salespersonJoin()] }),
      customer,
      joinFields,
      [customersApi],
      ctx,
      related
    )
    expect(plans.find((p) => p.ready)).toBeUndefined()
    expect(plans[plans.length - 1].kind).toBe("custom")
  })
})
