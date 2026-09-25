import { describe, expect, it } from "vitest"

import {
  camel,
  companionQuery,
  companionGetRequest,
  companionRequest,
  requestPlans,
  standardRequest,
  toApiQuery,
} from "@/platforms/bc/query/api"
import {
  customer,
  customersApi,
  ctx,
  F,
  fields,
  isvApi,
  joinFields,
  query,
  related,
  salespersonJoin,
} from "./fixtures"

describe("camel", () => {
  it.each([
    ["No.", "no"],
    ["Balance (LCY)", "balanceLCY"],
    ["Sell-to Customer No.", "sellToCustomerNo"],
    ["G/L Account No.", "gLAccountNo"],
    ["VAT Registration No.", "vatRegistrationNo"],
    ["$systemId", "systemId"],
    ["SystemCreatedAt", "systemCreatedAt"],
    ["2nd Address", "f2ndAddress"],
  ])("%s → %s", (name, expected) => {
    expect(camel(name)).toBe(expected)
  })
})

describe("toApiQuery", () => {
  const al = (q = query()) => toApiQuery(q, customer, fields, ctx)

  it("names the entity and endpoint after the table", () => {
    const r = al()
    expect(r.al).toContain("EntityName = 'customer';")
    expect(r.al).toContain("EntitySetName = 'customers';")
    expect(r.endpoint).toBe(
      "https://api.businesscentral.dynamics.com/v2.0/t-1/Sandbox/api/dynamicAssist/queries/v1.0/companies(c-1)/customers"
    )
  })

  it("pluralises entity sets", () => {
    const plural = (name: string) =>
      toApiQuery(query(), { ...customer, name }, fields, ctx).entitySetName
    expect(plural("Sales Header")).toBe("salesHeaders")
    expect(plural("G/L Entry")).toBe("gLEntries")
    expect(plural("Item Ledger Entry")).toBe("itemLedgerEntries")
    expect(plural("Tax Area")).toBe("taxAreas")
    expect(plural("Bank Account Ledger Entry Buffer")).toBe(
      "bankAccountLedgerEntryBuffers"
    )
  })

  it("keeps the object name within 30 characters", () => {
    const r = toApiQuery(
      query(),
      { ...customer, name: "Intercompany Outbox Purchase Line" },
      fields,
      ctx
    )
    const name = r.al.match(/query 50100 "([^"]+)"/)![1]
    expect(name.length).toBeLessThanOrEqual(30)
  })

  it("puts filters OData can express in $filter, and nothing in the object", () => {
    const r = al(query({ filters: [{ field: 1, filter: ">20000" }] }))
    expect(r.options).toContainEqual(["$filter", "no gt '20000'"])
    expect(r.inQuery).toEqual([])
    expect(r.al).not.toContain("OnBeforeOpen")
  })

  it("keeps the rest in OnBeforeOpen with SetFilter, as typed", () => {
    const r = al(
      query({
        filters: [
          { field: 2, filter: "A*B" },
          { field: 54, filter: "01-01-25..t" },
        ],
      })
    )
    expect(r.options.find(([k]) => k === "$filter")).toBeUndefined()
    expect(r.inQuery).toEqual(["Name: A*B", "Last Date Modified: 01-01-25..t"])
    expect(r.al).toContain("CurrQuery.SetFilter(name, 'A*B');")
    // A filtered field that isn't picked is still a column, for $filter and SetFilter
    expect(r.al).toContain(`column(lastDateModified; "Last Date Modified")`)
    expect(r.al).toContain(
      "CurrQuery.SetFilter(lastDateModified, '01-01-25..t');"
    )
  })

  it("escapes quotes in SetFilter literals", () => {
    const r = al(query({ filters: [{ field: 2, filter: "O'Br*n" }] }))
    expect(r.al).toContain("CurrQuery.SetFilter(name, 'O''Br*n');")
  })

  it("combines several filters on one field", () => {
    const odata = al(
      query({
        filters: [
          { field: 59, filter: ">0" },
          { field: 59, filter: "<1000" },
        ],
      })
    )
    expect(odata.options).toContainEqual([
      "$filter",
      "(balanceLCY gt 0) and (balanceLCY lt 1000)",
    ])
    const inQuery = al(
      query({
        filters: [
          { field: 2, filter: "A*B" },
          { field: 2, filter: "<>''" },
        ],
      })
    )
    expect(inQuery.al).toContain("CurrQuery.SetFilter(name, '(A*B)&(<>'''')');")
  })

  it("filters FlowFilters through a filter element, not a column", () => {
    const r = al(query({ filters: [{ field: 55, filter: "2025-01-01.." }] }))
    expect(r.al).toContain(`filter(dateFilterFilter; "Date Filter")`)
    expect(r.al).not.toContain(`column(dateFilter;`)
    expect(r.inQuery).toEqual(["Date Filter: 2025-01-01.."])
  })

  it("leaves out fields a query can't return, and says so", () => {
    const r = al(query({ fields: [1, 89, 55] }))
    expect(r.al).not.toContain("column(image")
    expect(r.al).toContain(
      "// Left out (a query can't return them): Image, Date Filter"
    )
    expect(r.options).toContainEqual(["$select", "no"])
  })

  it("uses SystemId, not $systemId", () => {
    const r = al(query({ fields: [1, 2000000000] }))
    expect(r.al).toContain("column(systemId; SystemId)")
    expect(r.al).not.toContain("$systemId")
  })

  it("sorts with OrderBy on columns", () => {
    const r = al(query({ sort: [2, 1], descending: true }))
    expect(r.al).toContain("OrderBy = descending(name), descending(no);")
  })

  it("gives unique column names", () => {
    const twins = [F.no, { ...F.name, no: 3, name: "Name." }, F.name]
    const r = toApiQuery(query({ fields: [1, 2, 3] }), customer, twins, ctx)
    expect(r.al).toContain("column(name; Name)")
    expect(r.al).toContain(`column(name2; "Name.")`)
  })

  it("encodes the URL it copies, and shows it readable", () => {
    const r = al(query({ filters: [{ field: 2, filter: "A*" }] }))
    expect(r.url).toContain("$filter=startswith(name,'A')")
    expect(r.encodedUrl).toContain("$filter=startswith(name%2C'A')")
    expect(r.encodedUrl).not.toMatch(/ /)
  })

  it("uses placeholders when the context is unknown", () => {
    const r = toApiQuery(query(), customer, fields, {
      tenant: null,
      environment: null,
      companyId: null,
    })
    expect(r.url).toContain("/v2.0/{tenantId}/{environment}/")
    expect(r.url).toContain("companies({companyId})")
    expect(r.companiesUrl).toContain("/api/v2.0/companies")
  })

  it("defaults the columns to the primary key", () => {
    const r = al(query({ fields: [] }))
    expect(r.options).toContainEqual(["$select", "no"])
  })
})

describe("standardRequest", () => {
  it("maps fields to the API's own names and uses Microsoft's route", () => {
    const p = standardRequest(
      query({ fields: [1, 2, 59], filters: [{ field: 1, filter: ">20000" }] }),
      fields,
      customersApi,
      ctx
    )
    expect(p.url).toBe(
      "https://api.businesscentral.dynamics.com/v2.0/t-1/Sandbox/api/v2.0/companies(c-1)/customers?$select=number,displayName,balance&$filter=number gt '20000'&$top=100"
    )
    expect(p.label).toBe("Microsoft customers v2.0")
    expect(p.ready).toBe(true)
  })

  it("uses the ISV's route and flags its view", () => {
    const p = standardRequest(query(), fields, isvApi, ctx)
    expect(p.url).toContain(
      "/api/contoso/crm/beta/companies(c-1)/blockedCustomers"
    )
    expect(p.view).toBe("WHERE(Blocked=FILTER(<>' '))")
    expect(p.ready).toBe(false)
  })

  it("reports picked fields the API doesn't have", () => {
    const p = standardRequest(
      query({ fields: [1, 2, 80] }),
      fields,
      customersApi,
      ctx
    )
    expect(p.missing).toEqual(["Privacy Blocked"])
    expect(p.ready).toBe(false)
  })

  it("reports filters it can't apply: unknown field or untranslatable text", () => {
    const p = standardRequest(
      query({
        filters: [
          { field: 80, filter: "Yes" },
          { field: 2, filter: "A*B" },
        ],
      }),
      fields,
      customersApi,
      ctx
    )
    expect(p.unfiltered).toEqual(["Privacy Blocked: Yes", "Name: A*B"])
    expect(p.ready).toBe(false)
  })
})

describe("requestPlans", () => {
  const keys = (plans: { key: string }[]) => plans.map((p) => p.key)

  it("puts an exact installed API first, then the companion endpoint, then the rest", () => {
    const plans = requestPlans(
      query(),
      customer,
      fields,
      [isvApi, customersApi],
      ctx
    )
    expect(keys(plans)).toEqual([
      "page:30009",
      "companion-get",
      "companion",
      "page:70000",
      "custom",
    ])
    expect(plans[0].ready).toBe(true)
  })

  it("leads with the companion endpoint when no API is exact", () => {
    // Privacy Blocked is only in the ISV API; City only in Microsoft's
    const plans = requestPlans(
      query({ fields: [1, 2, 80] }),
      customer,
      fields,
      [customersApi, isvApi],
      ctx
    )
    expect(plans.some((p) => p.ready)).toBe(false)
    expect(plans[0].key).toBe("companion-get")
    expect(plans[plans.length - 1].key).toBe("custom")
  })

  it("offers the companion endpoint and the custom query when no API exists", () => {
    expect(keys(requestPlans(query(), customer, fields, [], ctx))).toEqual([
      "companion-get",
      "companion",
      "custom",
    ])
  })

  it("ignores API pages without an entity set or fields", () => {
    const plans = requestPlans(
      query(),
      customer,
      fields,
      [
        { ...customersApi, entitySetName: "" },
        { ...isvApi, fields: [] },
      ],
      ctx
    )
    expect(keys(plans)).toEqual(["companion-get", "companion", "custom"])
  })
})

describe("the companion endpoint", () => {
  it("writes the query with tables and fields by name", () => {
    expect(
      companionQuery(
        query({
          fields: [1, 2, 2000000000],
          filters: [
            { field: 1, filter: ">20000" },
            { field: 2, filter: "  " },
          ],
          sort: [2],
          descending: true,
          top: 50,
        }),
        customer,
        fields
      )
    ).toEqual({
      table: "Customer",
      fields: ["No.", "Name", "SystemId"],
      filters: [{ field: "No.", filter: ">20000" }],
      sort: ["Name"],
      descending: true,
      top: 50,
    })
  })

  it("names joins by lookup field, table and key", () => {
    const q = companionQuery(
      query({
        joins: [
          salespersonJoin({
            fields: [2, 5102],
            inner: true,
            filters: [{ field: 2, filter: "A*" }],
          }),
        ],
      }),
      customer,
      joinFields,
      related
    )
    expect(q.joins).toEqual([
      {
        field: "Salesperson Code",
        table: "Salesperson/Purchaser",
        key: "Code",
        fields: ["Name", "E-Mail"],
        filters: [{ field: "Name", filter: "A*" }],
        inner: true,
      },
    ])
  })

  it("posts to the web service with the query as JSON text", () => {
    const p = companionRequest(query(), customer, fields, ctx, "CRONUS & Co")
    expect(p.method).toBe("POST")
    expect(p.url).toBe(
      "https://api.businesscentral.dynamics.com/v2.0/t-1/Sandbox/ODataV4/DAQuery_Run?company=CRONUS & Co"
    )
    expect(p.encodedUrl).toContain("?company=CRONUS%20%26%20Co")
    const body = JSON.parse(p.body!)
    expect(typeof body.request).toBe("string")
    expect(JSON.parse(body.request)).toEqual(p.request)
  })

  it("keeps a placeholder when the company is unknown", () => {
    const p = companionRequest(query(), customer, fields, ctx, null)
    expect(p.url).toContain("?company={company}")
  })
})

describe("the companion GET endpoint", () => {
  it("puts the query in $filter on the rows API, and selects the row data", () => {
    const p = companionGetRequest(
      query({ filters: [{ field: 2, filter: "O'Brien" }] }),
      customer,
      fields,
      ctx
    )!
    expect(p.method).toBe("GET")
    expect(p.url).toBe(
      "https://api.businesscentral.dynamics.com/v2.0/t-1/Sandbox/api/err403/dynamicAssist/v1.0/companies(c-1)/queryRows" +
        '?$filter=request eq \'{"table":"Customer","fields":["No.","Name"],"filters":[{"field":"Name","filter":"O\'\'Brien"}],"top":100}\'' +
        "&$select=rowNo,data"
    )
  })

  it("encodes the URL it copies", () => {
    const p = companionGetRequest(query(), customer, fields, ctx)!
    expect(p.encodedUrl).not.toMatch(/[ "{}]/)
    const filter = new URL(p.encodedUrl).searchParams.get("$filter")!
    expect(filter.startsWith("request eq '")).toBe(true)
    expect(JSON.parse(filter.slice(12, -1))).toEqual(p.request)
  })

  it("isn't offered when the query won't fit the 2,048-character field", () => {
    const long = query({
      filters: Array.from({ length: 80 }, () => ({
        field: 2,
        filter: "Something fairly long*",
      })),
    })
    expect(companionGetRequest(long, customer, fields, ctx)).toBeNull()
    const plans = requestPlans(long, customer, fields, [], ctx)
    expect(plans.map((p) => p.key)).toEqual(["companion", "custom"])
  })
})
