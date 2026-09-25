import { describe, expect, it } from "vitest"

import { toAl } from "@/platforms/bc/query/al"
import { alName, cleanValue } from "@/platforms/bc/query/bridge"
import { customer, fields, query } from "./fixtures"

describe("toAl", () => {
  it("writes record code with load fields, key, order and filters", () => {
    const code = toAl(
      query({
        fields: [1, 2, 59],
        sort: [2],
        descending: true,
        filters: [
          { field: 1, filter: "10000..20000" },
          { field: 2, filter: "O'Brien" },
          { field: 7, filter: "  " },
        ],
      }),
      customer,
      fields
    )
    expect(code).toContain("Rec: Record Customer;")
    expect(code).toContain(`Rec.SetLoadFields("No.", Name);`)
    expect(code).toContain("Rec.SetCurrentKey(Name);")
    expect(code).toContain("Rec.Ascending(false);")
    expect(code).toContain(`Rec.SetFilter("No.", '10000..20000');`)
    expect(code).toContain(`Rec.SetFilter(Name, 'O''Brien');`)
    // Blank filters are skipped
    expect(code).not.toContain("City")
    // FlowFields are calculated, not loaded
    expect(code).toContain(`Rec.CalcFields("Balance (LCY)");`)
  })

  it("uses SystemId, not $systemId", () => {
    const code = toAl(query({ fields: [2000000000] }), customer, fields)
    expect(code).toContain("Rec.SetLoadFields(SystemId);")
  })

  it("quotes table names that need it", () => {
    const code = toAl(query(), { ...customer, name: "Sales Header" }, fields)
    expect(code).toContain(`Rec: Record "Sales Header";`)
  })
})

describe("value cleanup", () => {
  it("renames $systemId only", () => {
    expect(alName("$systemId")).toBe("SystemId")
    expect(alName("No.")).toBe("No.")
  })

  it.each([
    ["Option", " ", ""],
    ["Option", "Ship", "Ship"],
    [
      "GUID",
      "{0B5C4A1E-1111-2222-3333-444455556666}",
      "0b5c4a1e-1111-2222-3333-444455556666",
    ],
    ["Code", " A ", " A "],
    ["Decimal", 12.5, 12.5],
    ["Boolean", false, false],
    ["Date", null, null],
    ["Date", undefined, null],
  ] as const)("%s %j → %j", (type, value, expected) => {
    expect(cleanValue(type, value)).toEqual(expected)
  })
})
