import { describe, expect, it } from "vitest"

import { xmlTokens } from "@/lib/xml-tokens"

const join = (xml: string) =>
  xmlTokens(xml)
    .map((t) => t.text)
    .join("")

describe("xmlTokens", () => {
  it("colours a condition", () => {
    expect(
      xmlTokens('<condition attribute="isdisabled" operator="eq" value="0" />')
    ).toEqual([
      { kind: "punct", text: "<" },
      { kind: "tag", text: "condition" },
      { kind: "text", text: " " },
      { kind: "attr", text: "attribute" },
      { kind: "punct", text: "=" },
      { kind: "value", text: '"isdisabled"' },
      { kind: "text", text: " " },
      { kind: "attr", text: "operator" },
      { kind: "punct", text: "=" },
      { kind: "value", text: '"eq"' },
      { kind: "text", text: " " },
      { kind: "attr", text: "value" },
      { kind: "punct", text: "=" },
      { kind: "value", text: '"0"' },
      { kind: "text", text: " " },
      { kind: "punct", text: "/>" },
    ])
  })

  it("colours closing tags, text and comments", () => {
    expect(xmlTokens("<!-- x --><value>1</value>")).toEqual([
      { kind: "comment", text: "<!-- x -->" },
      { kind: "punct", text: "<" },
      { kind: "tag", text: "value" },
      { kind: "punct", text: ">" },
      { kind: "text", text: "1" },
      { kind: "punct", text: "</" },
      { kind: "tag", text: "value" },
      { kind: "punct", text: ">" },
    ])
  })

  it("gives back the input exactly, even half typed", () => {
    for (const xml of [
      '<fetch version="1.0" mapping="logical">\n  <entity name="systemuser">\n    <attribute name="fullname" />\n  </entity>\n</fetch>',
      '<?xml version="1.0"?><fetch>',
      '<entity name="acc\n  <attribute',
      "<!-- open comment",
      "<a b c='d'>& text < 5",
      "",
    ])
      expect(join(xml)).toBe(xml)
  })

  it("stops an unclosed value at the end of its line", () => {
    const tokens = xmlTokens('<entity name="acc\n<attribute name="x" />')
    expect(tokens.find((t) => t.kind === "value")?.text).toBe('"acc')
    expect(tokens.filter((t) => t.kind === "tag").map((t) => t.text)).toEqual([
      "entity",
      "attribute",
    ])
  })
})
