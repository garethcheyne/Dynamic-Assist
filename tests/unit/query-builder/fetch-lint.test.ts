import { describe, expect, it } from "vitest"

import { lintFetchXml } from "@/platforms/ce/query/editor/fetch-lint"

import { META } from "./fixtures/meta"

const messages = (xml: string) =>
  lintFetchXml(xml, META).map((p) => `${p.severity}: ${p.message}`)
const wrap = (inner: string, fetch = "") =>
  `<fetch${fetch}><entity name="account">${inner}</entity></fetch>`

describe("lintFetchXml", () => {
  it("passes a good query", () => {
    expect(
      messages(
        wrap(
          '<attribute name="name" /><order attribute="name" descending="false" /><filter type="and"><condition attribute="statecode" operator="eq" value="0" /></filter><link-entity name="contact" from="parentcustomerid" to="accountid" alias="c"><attribute name="fullname" /></link-entity>'
        )
      )
    ).toEqual([])
  })

  it("reports broken XML", () => {
    expect(messages('<fetch><entity name="account"></fetch>')).toContain(
      "error: <entity> is never closed"
    )
  })

  it("checks structure", () => {
    expect(messages("<entity />")).toEqual([
      "error: A query starts with <fetch>",
    ])
    expect(messages("<fetch />")).toEqual(["error: <fetch> needs an <entity>"])
    expect(messages(wrap("<fetch />"))).toContain(
      "error: <fetch> can't go inside <entity>"
    )
    expect(messages(wrap('<attribute nme="name" />'))).toEqual([
      'error: <attribute> needs name="…"',
      "error: <attribute> has no nme attribute",
    ])
    expect(messages(wrap('<filter type="xor" />'))).toContain(
      "error: type must be one of: and, or"
    )
    expect(messages(wrap("", ' top="many"'))).toEqual([
      "error: top must be a whole number",
    ])
    expect(messages(wrap("<bogus />"))).toEqual([
      "error: <bogus> isn't a FetchXML element",
    ])
  })

  it("checks tables and columns against metadata", () => {
    expect(messages('<fetch><entity name="acount" /></fetch>')).toEqual([
      "error: There's no table acount",
    ])
    expect(messages(wrap('<attribute name="nam" />'))).toEqual([
      "error: account has no column nam",
    ])
    expect(
      messages(
        wrap(
          '<link-entity name="contact" from="parentcustomer" to="accountid" alias="c" />'
        )
      )
    ).toEqual(["error: contact has no column parentcustomer"])
    expect(
      messages(
        wrap(
          '<filter><condition entityname="x" attribute="fullname" operator="null" /></filter>'
        )
      )
    ).toEqual(["error: No link-entity has the alias x"])
  })

  it("checks operators and their values", () => {
    expect(
      messages(
        wrap(
          '<filter><condition attribute="name" operator="equals" value="x" /></filter>'
        )
      )
    ).toEqual(["error: equals isn't a FetchXML operator"])
    expect(
      messages(
        wrap('<filter><condition attribute="name" operator="eq" /></filter>')
      )
    ).toEqual(['error: eq needs value="…"'])
    expect(
      messages(
        wrap(
          '<filter><condition attribute="createdon" operator="between" value="1" /></filter>'
        )
      )
    ).toEqual(["error: between needs two <value> elements"])
    expect(
      messages(
        wrap('<filter><condition attribute="name" operator="today" /></filter>')
      )
    ).toEqual(["warning: today doesn't apply to name (string)"])
    expect(
      messages(
        wrap(
          '<filter><condition attribute="name" operator="neq" value="x" /></filter>'
        )
      )
    ).toEqual(["info: neq is deprecated: use ne"])
  })

  it("wants a choice's value, not its label", () => {
    expect(
      messages(
        wrap(
          '<filter><condition attribute="statecode" operator="eq" value="Active" /></filter>'
        )
      )
    ).toEqual(['warning: Use the value 0, not the label "Active"'])
    expect(
      messages(
        wrap(
          '<filter><condition attribute="statecode" operator="in"><value>0</value><value>7</value></condition></filter>'
        )
      )
    ).toEqual(["warning: 7 isn't one of statecode's values"])
  })

  it("applies the aggregate rules", () => {
    expect(
      messages(
        wrap(
          '<attribute name="name" groupby="true" alias="n" /><attribute name="revenue" aggregate="sum" /><attribute name="statecode" alias="s" /><order attribute="name" />',
          ' aggregate="true"'
        )
      )
    ).toEqual([
      "warning: In an aggregate query, give every attribute an alias",
      'error: In an aggregate query, every attribute needs aggregate="…" or groupby="true"',
      'error: In an aggregate query, sort by alias="…", not attribute',
    ])
    expect(
      messages(wrap('<attribute name="revenue" aggregate="sum" alias="r" />'))
    ).toEqual(['error: aggregate and groupby need <fetch aggregate="true">'])
  })

  it("applies the filter link rules", () => {
    expect(
      messages(
        wrap(
          '<link-entity name="contact" from="parentcustomerid" to="accountid" link-type="any" />'
        )
      )
    ).toEqual(['error: link-type="any" only works inside a <filter>'])
    expect(
      messages(
        wrap(
          '<filter><link-entity name="contact" from="parentcustomerid" to="accountid" link-type="inner"><attribute name="fullname" /></link-entity></filter>'
        )
      )
    ).toEqual([
      'error: A link-entity inside a filter needs link-type any, "not any", all or "not all"',
      "warning: A link-entity inside a filter can't return columns",
    ])
  })

  it("applies paging, alias and retention rules", () => {
    expect(messages(wrap("", ' top="10" count="5"'))).toEqual([
      "error: top can't be used with page or count",
    ])
    expect(messages(wrap('<attribute name="name" alias="1st" />'))).toEqual([
      "error: An alias uses letters, digits and _, and doesn't start with a digit",
    ])
    expect(
      messages(
        wrap(
          '<link-entity name="contact" from="parentcustomerid" to="accountid" />',
          ' datasource="retained"'
        )
      )
    ).toEqual(["error: Long-term retention queries can't use link-entity"])
    expect(
      messages(
        wrap(
          '<link-entity name="contact" from="parentcustomerid" to="accountid" alias="c" /><link-entity name="contact" from="parentcustomerid" to="accountid" alias="c" />'
        )
      )
    ).toEqual(["error: The alias c is used twice"])
  })

  it("notes slow patterns", () => {
    expect(
      messages(
        wrap(
          '<filter><condition attribute="name" operator="like" value="%coffee" /></filter>'
        )
      )
    ).toEqual([
      "info: A leading % can't use an index and scans the whole table",
    ])
    expect(
      messages(
        wrap(
          '<link-entity name="contact" from="parentcustomerid" to="accountid"><order attribute="fullname" /></link-entity>'
        )
      )
    ).toEqual([
      "info: Sorting on a link-entity makes Dataverse use slower legacy paging",
    ])
  })

  it("links each rule to Microsoft Learn", () => {
    const [p] = lintFetchXml(
      wrap('<attribute name="revenue" aggregate="sum" alias="r" />'),
      META
    )
    expect(p.link).toContain("learn.microsoft.com")
  })

  it("skips metadata checks without metadata", () => {
    expect(
      lintFetchXml(
        '<fetch><entity name="whatever"><attribute name="x" /></entity></fetch>',
        null
      )
    ).toEqual([])
  })
})
