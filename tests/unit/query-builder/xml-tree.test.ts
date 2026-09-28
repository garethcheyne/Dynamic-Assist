import { describe, expect, it } from "vitest"

import { attr, readXml } from "@/lib/xml-tree"

const FETCH = `<fetch top="5">
  <entity name="account">
    <attribute name="name" />
    <filter type="and">
      <condition attribute="statecode" operator="eq" value="0" />
    </filter>
  </entity>
</fetch>`

describe("readXml", () => {
  it("reads elements, attributes and positions", () => {
    const tree = readXml(FETCH)
    expect(tree.problems).toEqual([])
    expect(tree.roots.map((r) => r.name)).toEqual(["fetch"])
    expect(tree.all.map((e) => e.name)).toEqual([
      "fetch",
      "entity",
      "attribute",
      "filter",
      "condition",
    ])
    const condition = tree.all[4]
    expect(attr(condition, "operator")).toBe("eq")
    expect(condition.parent?.name).toBe("filter")
    expect(condition.parent?.parent?.name).toBe("entity")
    const value = condition.attrs.find((a) => a.name === "value")!
    expect(FETCH.slice(value.valueFrom, value.valueTo)).toBe("0")
    expect(FETCH.slice(condition.nameFrom, condition.nameTo)).toBe("condition")
  })

  it("reads text inside elements", () => {
    const tree = readXml(
      '<condition attribute="x" operator="in"><value> 1 </value><value>2</value></condition>'
    )
    expect(tree.all.slice(1).map((v) => v.text[0]?.value)).toEqual(["1", "2"])
  })

  it("reports mistakes and carries on", () => {
    const messages = (xml: string) =>
      readXml(xml).problems.map((p) => p.message)
    expect(messages("<fetch><entity></fetch>")).toEqual([
      "<entity> is never closed",
    ])
    expect(messages("<fetch></entity></fetch>")).toEqual([
      "</entity> has no matching <entity>",
    ])
    expect(messages('<a b="1" b="2" />')).toEqual(["b appears twice on <a>"])
    expect(messages("<a b=1 />")).toEqual(["Put the value of b in quotes"])
    expect(messages("<a b />")).toEqual(['b needs a value (b="…")'])
    expect(messages("<a />\n<b />")).toEqual([
      "Only one root element is allowed",
    ])
    expect(messages('<a b="1\n/>')).toEqual([
      "The value of b is missing its closing quote",
    ])
    expect(messages("<fetch>")).toEqual(["<fetch> is never closed"])
  })

  it("says what's being typed at the cursor", () => {
    const at = (xml: string) => readXml(xml, xml.length).cursor

    const tag = at('<fetch><entity name="account"><attr')
    expect(tag).toMatchObject({ kind: "tag-name", typed: "attr" })
    expect(tag.kind === "tag-name" && tag.parent?.name).toBe("entity")

    expect(at("<fetch><")).toMatchObject({ kind: "tag-name", typed: "" })

    const name = at('<fetch><entity name="account" ')
    expect(name).toMatchObject({ kind: "attr-name", typed: "" })
    expect(name.kind === "attr-name" && name.element.name).toBe("entity")

    expect(at("<fetch><entity na")).toMatchObject({
      kind: "attr-name",
      typed: "na",
    })

    const value = at('<fetch><entity name="acc')
    expect(value).toMatchObject({
      kind: "attr-value",
      attr: "name",
      typed: "acc",
      quote: '"',
    })

    const inText = at('<fetch><entity name="account">\n  ')
    expect(inText.kind).toBe("text")
    expect(inText.kind === "text" && inText.parent?.name).toBe("entity")

    expect(at("<fetch></fe")).toMatchObject({ kind: "close-tag", typed: "fe" })
  })

  it("doesn't report unclosed elements when reading up to the cursor", () => {
    const xml = '<fetch><entity name="account">'
    expect(readXml(xml, xml.length).problems).toEqual([])
  })
})
