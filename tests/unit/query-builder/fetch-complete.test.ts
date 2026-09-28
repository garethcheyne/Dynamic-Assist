import { describe, expect, it } from "vitest"

import {
  completeFetchXml,
  tablesIn,
} from "@/platforms/ce/query/editor/fetch-complete"

import { META } from "./fixtures/meta"

/** Completions at the | in the text. */
function at(marked: string) {
  const pos = marked.indexOf("|")
  const text = marked.replace("|", "")
  return completeFetchXml(text, pos, META)
}
const labels = (marked: string) => at(marked)?.options.map((o) => o.label) ?? []

describe("completeFetchXml", () => {
  it("suggests the root, then only the children that fit", () => {
    expect(labels("<|")).toEqual(["fetch"])
    expect(labels("<fetch><|")).toEqual(["entity"])
    expect(labels('<fetch><entity name="account"><filter><|')).toEqual([
      "condition",
      "filter",
      "link-entity",
      "link-entity contact (parentcustomerid)",
      "link-entity systemuser (ownerid)",
    ])
  })

  it("offers joins from relationships as ready-made link-entities", () => {
    const join = at('<fetch><entity name="account"><|')!.options.find(
      (o) => o.label === "link-entity contact (parentcustomerid)"
    )!
    expect(join.snippet).toContain(
      'link-entity name="contact" from="parentcustomerid" to="accountid"'
    )
    expect(join.detail).toBe("children")
  })

  it("suggests attributes not already there, required first", () => {
    const options = at(
      '<fetch><entity name="account"><condition attribute="name" |'
    )!.options
    expect(options.map((o) => o.label)).not.toContain("attribute")
    expect(options.find((o) => o.label === "operator")?.boost).toBe(1)
    expect(options.find((o) => o.label === "operator")?.snippet).toBe(
      'operator="${}"'
    )
  })

  it("suggests tables, related ones first for a link-entity", () => {
    expect(labels('<fetch><entity name="|')).toEqual([
      "account",
      "contact",
      "systemuser",
    ])
    const link = at(
      '<fetch><entity name="account"><link-entity name="|'
    )!.options
    expect(link.find((o) => o.label === "contact")?.boost).toBe(2)
    expect(link.find((o) => o.label === "account")?.boost).toBe(0)
  })

  it("suggests the right table's columns", () => {
    expect(
      labels('<fetch><entity name="contact"><attribute name="|')
    ).toContain("fullname")
    expect(
      labels('<fetch><entity name="contact"><attribute name="|')
    ).not.toContain("revenue")
    // Inside a link-entity: its table
    expect(
      labels(
        '<fetch><entity name="account"><link-entity name="contact"><attribute name="|'
      )
    ).toContain("parentcustomerid")
    // A condition naming a link-entity alias: that table
    expect(
      labels(
        '<fetch><entity name="account"><filter><condition entityname="c" attribute="|" /></filter><link-entity name="contact" alias="c" /></entity></fetch>'
      )
    ).toContain("fullname")
  })

  it("puts relationship columns first for a link-entity's from and to", () => {
    const from = at(
      '<fetch><entity name="account"><link-entity name="contact" from="|'
    )!.options
    expect(from.find((o) => o.label === "parentcustomerid")?.boost).toBe(2)
    const to = at(
      '<fetch><entity name="account"><link-entity name="contact" to="|'
    )!.options
    expect(to.find((o) => o.label === "accountid")?.boost).toBe(2)
    expect(to.map((o) => o.label)).toContain("revenue")
  })

  it("suggests operators that fit the column's type", () => {
    const dateOps = labels(
      '<fetch><entity name="account"><filter><condition attribute="createdon" operator="|'
    )
    expect(dateOps).toContain("last-x-days")
    expect(dateOps).not.toContain("like")
    const stringOps = labels(
      '<fetch><entity name="account"><filter><condition attribute="name" operator="|'
    )
    expect(stringOps).toContain("like")
    expect(stringOps).not.toContain("last-x-days")
    expect(
      labels(
        '<fetch><entity name="account"><filter><condition attribute="parentaccountid" operator="|'
      )
    ).toContain("under")
    expect(
      labels(
        '<fetch><entity name="account"><filter><condition attribute="ownerid" operator="|'
      )
    ).toContain("eq-userid")
  })

  it("suggests choice values, labelled", () => {
    const options = at(
      '<fetch><entity name="account"><filter><condition attribute="statecode" operator="eq" value="|'
    )!.options
    expect(options.map((o) => [o.label, o.detail])).toEqual([
      ["0", "Active"],
      ["1", "Inactive"],
    ])
    expect(
      labels(
        '<fetch><entity name="account"><filter><condition attribute="statecode" operator="in"><value>|'
      )
    ).toEqual(["0", "1"])
  })

  it("suggests enum values, booleans and aliases", () => {
    expect(labels('<fetch><entity name="account"><filter type="|')).toEqual([
      "and",
      "or",
    ])
    expect(labels('<fetch distinct="|')).toEqual(["true", "false"])
    expect(
      labels(
        '<fetch><entity name="account"><order entityname="|" /><link-entity name="contact" alias="c" /></entity></fetch>'
      )
    ).toEqual(["c"])
  })

  it("closes the open element", () => {
    expect(at('<fetch><entity name="account"></|')!.options[0].apply).toBe(
      "entity>"
    )
  })

  it("lists the tables a query uses", () => {
    expect(
      tablesIn(
        '<fetch><entity name="account"><link-entity name="contact" /></entity></fetch>'
      )
    ).toEqual(["account", "contact"])
  })
})
