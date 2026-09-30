import { describe, expect, it } from "vitest"

import { parseInline, parseMarkdown } from "@/lib/mini-markdown"

describe("parseInline", () => {
  it("reads bold, code and links between text", () => {
    expect(parseInline("A **big** `x` [docs](https://a.b/c) end")).toEqual([
      { kind: "text", text: "A " },
      { kind: "bold", text: "big" },
      { kind: "text", text: " " },
      { kind: "code", text: "x" },
      { kind: "text", text: " " },
      { kind: "link", text: "docs", href: "https://a.b/c" },
      { kind: "text", text: " end" },
    ])
  })

  it("keeps a link the resolver rejects as text", () => {
    expect(parseInline("[bad](javascript:void0)", () => null)).toEqual([
      { kind: "text", text: "bad" },
    ])
  })
})

describe("parseMarkdown", () => {
  const doc = [
    "# Changelog",
    "",
    "Intro line one",
    "line two.",
    "",
    "## [2026.9.25] — 2026-09-25",
    "",
    "### Added",
    "",
    "- **One**: first",
    "  wrapped.",
    "- Two",
    "",
    "[2026.9.25]: https://github.com/x/y/tree/abc",
  ].join("\n")

  it("reads headings, paragraphs and lists, joining wrapped lines", () => {
    const blocks = parseMarkdown(doc)
    expect(blocks.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "heading",
      "list",
    ])
    expect(blocks[1]).toEqual({
      kind: "paragraph",
      spans: [{ kind: "text", text: "Intro line one line two." }],
    })
    const list = blocks[4]
    expect(list.kind === "list" && list.items.length).toBe(2)
    expect(list.kind === "list" && list.items[0]).toEqual([
      { kind: "bold", text: "One" },
      { kind: "text", text: ": first wrapped." },
    ])
  })

  it("shows a reference-link heading as its text, and drops the definitions", () => {
    const blocks = parseMarkdown(doc)
    expect(blocks[2]).toEqual({
      kind: "heading",
      level: 2,
      spans: [{ kind: "text", text: "2026.9.25 — 2026-09-25" }],
    })
    expect(JSON.stringify(blocks)).not.toContain("tree/abc")
  })
})
