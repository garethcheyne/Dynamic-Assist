import { describe, expect, it } from "vitest"

import {
  OPTION_SET_CASTS,
  optionSetPaths,
  readOptionSetColumns,
  selectedValues,
} from "@/platforms/ce/option-sets"

const cast = (kind: string) => OPTION_SET_CASTS.find((c) => c.kind === kind)!
const l = (text: string) => ({ UserLocalizedLabel: { Label: text } })

describe("optionSetPaths", () => {
  it("asks for the global set first, then the local set alone", () => {
    const [wide, narrow] = optionSetPaths("account", cast("Choice"))
    expect(wide).toBe(
      "EntityDefinitions(LogicalName='account')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName,DisplayName&$expand=OptionSet($select=Name,IsGlobal,Options),GlobalOptionSet($select=Name,IsGlobal,Options)"
    )
    expect(narrow).toMatch(
      /\$expand=OptionSet\(\$select=Name,IsGlobal,Options\)$/
    )
  })

  it("asks a Yes/No column for its two options", () => {
    expect(optionSetPaths("account", cast("Yes/No"))[1]).toContain(
      "OptionSet($select=Name,IsGlobal,TrueOption,FalseOption)"
    )
  })
})

describe("readOptionSetColumns", () => {
  it("reads a local choice column", () => {
    const [col] = readOptionSetColumns(cast("Choice"), {
      value: [
        {
          LogicalName: "hnc_deliverystatus",
          DisplayName: l("Status"),
          OptionSet: {
            Name: "hnc_account_hnc_deliverystatus",
            IsGlobal: false,
            Options: [
              { Value: 100000000, Label: l("New") },
              { Value: 100000001, Label: l("Assigned") },
              { Value: null, Label: l("Ignored") },
            ],
          },
        },
      ],
    })
    expect(col).toEqual({
      logicalName: "hnc_deliverystatus",
      label: "Status",
      kind: "Choice",
      optionSet: "hnc_account_hnc_deliverystatus",
      global: false,
      options: [
        { value: 100000000, text: "New" },
        { value: 100000001, text: "Assigned" },
      ],
    })
  })

  it("falls back to the global set and to the value for a missing label", () => {
    const [col] = readOptionSetColumns(cast("Choices"), {
      value: [
        {
          LogicalName: "hnc_tags",
          OptionSet: null,
          GlobalOptionSet: {
            Name: "hnc_tag",
            IsGlobal: true,
            Options: [{ Value: 1, Label: { UserLocalizedLabel: null } }],
          },
        },
      ],
    })
    expect(col.label).toBeNull()
    expect(col.optionSet).toBe("hnc_tag")
    expect(col.global).toBe(true)
    expect(col.options).toEqual([{ value: 1, text: "1" }])
  })

  it("reads a Yes/No column as 1 and 0", () => {
    const [col] = readOptionSetColumns(cast("Yes/No"), {
      value: [
        {
          LogicalName: "donotemail",
          OptionSet: {
            TrueOption: { Value: 1, Label: l("Do Not Allow") },
            FalseOption: { Value: 0, Label: l("Allow") },
          },
        },
      ],
    })
    expect(col.options).toEqual([
      { value: 1, text: "Do Not Allow" },
      { value: 0, text: "Allow" },
    ])
  })

  it("reads nothing from a failed request", () => {
    expect(readOptionSetColumns(cast("Status"), null)).toEqual([])
  })
})

describe("selectedValues", () => {
  it("reads a choice, a multi-select and a Yes/No value", () => {
    expect([...selectedValues("100000001")]).toEqual([100000001])
    expect([...selectedValues("[1,3]")]).toEqual([1, 3])
    expect([...selectedValues("true")]).toEqual([1])
    expect([...selectedValues("false")]).toEqual([0])
  })

  it("reads nothing from an empty or odd value", () => {
    expect(selectedValues("null").size).toBe(0)
    expect(selectedValues("").size).toBe(0)
    expect(selectedValues('"text"').size).toBe(0)
  })
})
