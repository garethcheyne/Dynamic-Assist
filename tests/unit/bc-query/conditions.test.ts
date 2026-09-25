import { describe, expect, it } from "vitest"

import {
  arity,
  fromBcFilter,
  operatorsFor,
  toBcFilter,
  type Condition,
  type ConditionOp,
} from "@/platforms/bc/query/conditions"

const c = (op: ConditionOp, value = "", value2 = ""): Condition => ({
  op,
  value,
  value2,
})

describe("conditions to BC filters", () => {
  it.each([
    // Text
    ["Text", c("eq", "Adatum"), "Adatum"],
    ["Text", c("eq", "O'Brien"), "'O''Brien'"],
    ["Text", c("eq", "A&B Ltd."), "'A&B Ltd.'"],
    ["Text", c("eq", " padded "), "' padded '"],
    ["Text", c("eq", ""), "''"],
    ["Code", c("ne", "10000"), "<>10000"],
    ["Code", c("between", "10000", "20000"), "10000..20000"],
    ["Code", c("ne", "A|B"), "<>'A|B'"],
    ["Text", c("contains", "art"), "@*art*"],
    ["Text", c("contains", "A&B"), "@*A?B*"],
    ["Text", c("begins", "ad"), "@ad*"],
    ["Text", c("ends", "ltd."), "@*ltd?"],
    ["Code", c("in", "10000, 20000,30000"), "10000|20000|30000"],
    ["Code", c("in", "A&B, C"), "'A&B'|C"],
    ["Code", c("notIn", "10000, 20000"), "<>10000&<>20000"],
    ["Text", c("notEmpty"), "<>''"],
    ["Text", c("empty"), "''"],
    // Numbers
    ["Decimal", c("eq", "12.5"), "12.5"],
    ["Decimal", c("gt", "0"), ">0"],
    ["Decimal", c("ge", "-5"), ">=-5"],
    ["Integer", c("lt", "100"), "<100"],
    ["Integer", c("le", "100"), "<=100"],
    ["Decimal", c("between", "0", "1000"), "0..1000"],
    ["Decimal", c("between", "0", ""), "0.."],
    ["Integer", c("in", "1, 2, 3"), "1|2|3"],
    ["Integer", c("notIn", "1,2"), "<>1&<>2"],
    // Dates (ISO, which BC reads whatever the user's language)
    ["Date", c("eq", "2025-01-31"), "2025-01-31"],
    ["Date", c("ge", "2025-01-01"), ">=2025-01-01"],
    ["Date", c("le", "2025-12-31"), "<=2025-12-31"],
    [
      "Date",
      c("between", "2025-01-01", "2025-12-31"),
      "2025-01-01..2025-12-31",
    ],
    ["Date", c("today"), "t"],
    ["Date", c("empty"), "''"],
    // Yes/no and options
    ["Boolean", c("eq", "Yes"), "Yes"],
    ["Boolean", c("eq", "No"), "No"],
    ["Option", c("eq", "Ship"), "Ship"],
    ["Option", c("ne", "Ship"), "<>Ship"],
    ["Option", c("in", "Ship, Invoice"), "Ship|Invoice"],
    ["Option", c("notIn", "Ship, Invoice"), "<>Ship&<>Invoice"],
  ] as const)("%s %j → %s", (type, condition, expected) => {
    expect(toBcFilter(condition, type)).toBe(expected)
  })

  it("leaves incomplete conditions out", () => {
    expect(toBcFilter(c("gt", ""), "Decimal")).toBe("")
    expect(toBcFilter(c("contains", ""), "Text")).toBe("")
    expect(toBcFilter(c("in", " , "), "Code")).toBe("")
    expect(toBcFilter(c("between", "", ""), "Date")).toBe("")
  })

  it("needs values that fit numbers, dates and yes/no", () => {
    expect(toBcFilter(c("eq", "abc"), "Decimal")).toBe("")
    expect(toBcFilter(c("gt", "1,000"), "Decimal")).toBe("")
    expect(toBcFilter(c("eq", "31/01/2025"), "Date")).toBe("")
    expect(toBcFilter(c("between", "2025-01-01", "soon"), "Date")).toBe("")
    expect(toBcFilter(c("in", "1, two"), "Integer")).toBe("")
    expect(toBcFilter(c("eq", "maybe"), "Boolean")).toBe("")
    expect(toBcFilter(c("ge", "2025-01-01T10:30"), "DateTime")).toBe(
      ">=2025-01-01T10:30"
    )
  })

  it("offers operators that fit the field type", () => {
    const ops = (type: string) => operatorsFor(type).map((o) => o.value)
    expect(ops("Text")).toContain("contains")
    expect(ops("Decimal")).not.toContain("contains")
    expect(ops("Decimal")).toContain("between")
    expect(ops("Boolean")).toEqual(["eq"])
    expect(ops("Option")).toEqual(["eq", "ne", "in", "notIn"])
    expect(operatorsFor("Date").find((o) => o.value === "ge")?.label).toBe(
      "on or after"
    )
  })

  it("knows how many values each takes", () => {
    expect(arity("between")).toBe(2)
    expect(arity("empty")).toBe(0)
    expect(arity("today")).toBe(0)
    expect(arity("eq")).toBe(1)
  })
})

describe("BC filters back to conditions", () => {
  it.each([
    ["Text", "Adatum", c("eq", "Adatum")],
    ["Text", "'O''Brien'", c("eq", "O'Brien")],
    ["Text", "@*art*", c("contains", "art")],
    ["Text", "@ad*", c("begins", "ad")],
    ["Text", "@*ltd", c("ends", "ltd")],
    ["Code", "<>10000", c("ne", "10000")],
    ["Code", "10000..20000", c("between", "10000", "20000")],
    ["Code", "10000|20000", c("in", "10000, 20000")],
    ["Code", "<>1&<>2", c("notIn", "1, 2")],
    ["Text", "<>''", c("notEmpty")],
    ["Text", "''", c("empty")],
    ["Decimal", ">0", c("gt", "0")],
    ["Decimal", "0..1000", c("between", "0", "1000")],
    [
      "Date",
      "2025-01-01..2025-12-31",
      c("between", "2025-01-01", "2025-12-31"),
    ],
    ["Date", "t", c("today")],
    ["Boolean", "Yes", c("eq", "Yes")],
    ["Option", "Ship|Invoice", c("in", "Ship, Invoice")],
  ] as const)("%s %s → %j", (type, text, expected) => {
    expect(fromBcFilter(text, type)).toEqual(expected)
  })

  it.each([
    ["Text", "A*B"],
    ["Text", "A*"],
    ["Text", "*art*"],
    ["Code", "10000..20000|30000"],
    ["Decimal", "(>0)&(<10)"],
    ["Date", "01-01-25..t"],
    ["Text", "@a?c"],
  ])("keeps %s %s as BC syntax (no condition gives it back)", (type, text) => {
    expect(fromBcFilter(text, type)).toBeNull()
  })

  it("round-trips every condition it makes", () => {
    const samples: [string, Condition][] = [
      ["Text", c("eq", "Adatum Corporation")],
      ["Text", c("eq", "A&B")],
      ["Text", c("ne", "O'Brien")],
      ["Text", c("contains", "art")],
      ["Text", c("begins", "ad")],
      ["Text", c("ends", "co")],
      ["Code", c("in", "A, B, C")],
      ["Code", c("notIn", "A, B")],
      ["Decimal", c("between", "1", "2")],
      ["Decimal", c("le", "10")],
      ["Date", c("ge", "2025-01-01")],
      ["Date", c("today")],
      ["Option", c("notIn", "Ship, All")],
      ["Text", c("notEmpty")],
    ]
    for (const [type, condition] of samples) {
      const filter = toBcFilter(condition, type)
      const back = fromBcFilter(filter, type)
      expect(
        back,
        `${type} ${JSON.stringify(condition)} → ${filter}`
      ).not.toBeNull()
      expect(toBcFilter(back!, type)).toBe(filter)
    }
  })
})
