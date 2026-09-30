import { describe, expect, it } from "vitest"

import { findMenuTarget, matchMenuElement } from "@/platforms/ce/menu-target"

type Fake = {
  tagName: string
  id: string
  attrs: Record<string, string>
  getAttribute(name: string): string | null
  parentElement: Fake | null
}

/** A stand-in element: tag, attributes (id among them) and a parent */
function el(
  tagName: string,
  attrs: Record<string, string> = {},
  parentElement: Fake | null = null
): Fake {
  return {
    tagName,
    id: attrs.id ?? "",
    attrs,
    getAttribute: (name) => attrs[name] ?? null,
    parentElement,
  }
}

describe("matchMenuElement", () => {
  it("reads a grid column and a linked table's column", () => {
    expect(matchMenuElement(el("DIV", { "col-id": "name" }))).toEqual({
      kind: "column",
      name: "name",
      alias: null,
    })
    expect(
      matchMenuElement(el("DIV", { "col-id": "a_1234.emailaddress1" }))
    ).toEqual({ kind: "column", name: "emailaddress1", alias: "a_1234" })
  })

  it("skips the grid's own columns", () => {
    expect(matchMenuElement(el("DIV", { "col-id": "__row_status" }))).toBeNull()
  })

  it("reads a form field from its label, container or control", () => {
    expect(
      matchMenuElement(
        el("LABEL", {
          id: "id-0f3a9c2e-5b1d-4e7a-8bcb-7c212a6cec39-12-telephone1-field-label",
        })
      )
    ).toEqual({ kind: "control", control: "telephone1" })
    expect(
      matchMenuElement(
        el("DIV", { "data-id": "header_ownerid-FieldSectionItemContainer" })
      )
    ).toEqual({ kind: "control", control: "header_ownerid" })
    expect(
      matchMenuElement(
        el("INPUT", { "data-id": "name.fieldControl-text-box-text" })
      )
    ).toEqual({ kind: "control", control: "name" })
  })

  it("reads tabs and sections", () => {
    expect(
      matchMenuElement(
        el("LI", { role: "tab", "data-id": "tablist-SUMMARY_TAB" })
      )
    ).toEqual({ kind: "tab", name: "SUMMARY_TAB" })
    expect(
      matchMenuElement(el("SECTION", { "data-id": "ACCOUNT_INFORMATION" }))
    ).toEqual({ kind: "section", name: "ACCOUNT_INFORMATION" })
  })

  it("ignores other data-ids", () => {
    expect(matchMenuElement(el("DIV", { "data-id": "form-header" }))).toBeNull()
  })
})

describe("findMenuTarget", () => {
  it("takes the nearest match up the tree", () => {
    const section = el("SECTION", { "data-id": "SUMMARY" })
    const field = el(
      "DIV",
      { "data-id": "revenue-FieldSectionItemContainer" },
      section
    )
    const span = el("SPAN", {}, el("DIV", {}, field))
    expect(findMenuTarget(span)?.target).toEqual({
      kind: "control",
      control: "revenue",
    })
    expect(findMenuTarget(el("DIV", {}, section))?.target).toEqual({
      kind: "section",
      name: "SUMMARY",
    })
  })

  it("finds nothing outside fields, columns, tabs and sections", () => {
    expect(findMenuTarget(el("SPAN", {}, el("BODY")))).toBeNull()
    expect(findMenuTarget(null)).toBeNull()
  })
})
