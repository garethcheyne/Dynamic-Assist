import { describe, expect, it } from "vitest"

import { toODataFilter } from "@/platforms/bc/query/odata"
import { F } from "./fixtures"

describe("toODataFilter", () => {
  const cases: [string, typeof F.no, string, string | null][] = [
    // Comparisons and values
    ["plain code", F.no, "10000", "x eq '10000'"],
    ["greater than", F.no, ">20000", "x gt '20000'"],
    ["greater or equal", F.no, ">=20000", "x ge '20000'"],
    ["less than", F.no, "<20000", "x lt '20000'"],
    ["less or equal", F.no, "<=20000", "x le '20000'"],
    ["not equal", F.no, "<>10000", "x ne '10000'"],
    ["explicit equal", F.no, "=10000", "x eq '10000'"],
    ["blank", F.no, "''", "x eq ''"],
    ["not blank", F.no, "<>''", "x ne ''"],
    ["quoted value", F.name, "'Adatum'", "x eq 'Adatum'"],
    ["apostrophe", F.name, "O'Brien", "x eq 'O''Brien'"],
    ["quoted apostrophe", F.name, "'O''Brien'", "x eq 'O''Brien'"],
    // Ranges
    ["range", F.no, "10000..30000", "x ge '10000' and x le '30000'"],
    ["open end", F.no, "10000..", "x ge '10000'"],
    ["open start", F.no, "..30000", "x le '30000'"],
    ["bare range", F.no, "..", null],
    // OR / AND
    [
      "or",
      F.no,
      "10000|20000|30000",
      "(x eq '10000') or (x eq '20000') or (x eq '30000')",
    ],
    ["and", F.balance, ">0&<1000", "(x gt 0) and (x lt 1000)"],
    [
      "or of ranges",
      F.no,
      "1..2|5..6",
      "(x ge '1' and x le '2') or (x ge '5' and x le '6')",
    ],
    // Wildcards
    ["starts with", F.name, "A*", "startswith(x,'A')"],
    ["ends with", F.name, "*ltd", "endswith(x,'ltd')"],
    ["contains", F.name, "*art*", "contains(x,'art')"],
    ["wildcard in the middle", F.name, "A*B", null],
    ["only a wildcard", F.name, "*", null],
    ["single character", F.name, "A?", null],
    ["case-insensitive", F.name, "@adatum", null],
    ["parentheses", F.name, "(A|B)", null],
    ["wildcard on a number", F.balance, "1*", null],
    // Numbers
    ["decimal", F.balance, "12.5", "x eq 12.5"],
    ["negative", F.balance, "<-10", "x lt -10"],
    ["not a number", F.balance, "abc", null],
    ["number with comma", F.balance, "1,000", null],
    // Booleans
    ["yes", F.privacy, "Yes", "x eq true"],
    ["no", F.privacy, "no", "x eq false"],
    ["true", F.privacy, "true", "x eq true"],
    ["not a boolean", F.privacy, "maybe", null],
    // Dates
    ["ISO date", F.lastModified, "2025-01-31", "x eq 2025-01-31"],
    [
      "ISO date range",
      F.lastModified,
      "2025-01-01..2025-12-31",
      "x ge 2025-01-01 and x le 2025-12-31",
    ],
    ["local date", F.lastModified, "01-01-25", null],
    ["today", F.lastModified, "t", null],
    ["work date", F.lastModified, "w", null],
    [
      "ISO datetime",
      F.createdAt,
      ">2025-01-01T00:00:00Z",
      "x gt 2025-01-01T00:00:00Z",
    ],
    // Options and GUIDs
    ["option", F.blocked, "Ship|Invoice", "(x eq 'Ship') or (x eq 'Invoice')"],
    ["blank option", F.blocked, "' '", "x eq ' '"],
    [
      "guid with braces",
      F.systemId,
      "{0B5C4A1E-1111-2222-3333-444455556666}",
      "x eq 0B5C4A1E-1111-2222-3333-444455556666",
    ],
    ["not a guid", F.systemId, "abc", null],
    // Types OData can't compare
    ["media", F.image, "x", null],
  ]

  it.each(cases)("%s: %s", (_label, field, text, expected) => {
    expect(toODataFilter(field, "x", text)).toBe(expected)
  })

  it("never throws, and every result has balanced quotes and parentheses", () => {
    const alphabet = [
      "A",
      "1",
      "*",
      "?",
      "@",
      "|",
      "&",
      "..",
      "<",
      ">",
      "=",
      "'",
      "(",
      ")",
      " ",
      "-",
      "t",
      "{",
      "}",
    ]
    // Deterministic pseudo-random strings, so a failure can be replayed
    let seed = 42
    const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const all = [
      F.no,
      F.name,
      F.balance,
      F.privacy,
      F.lastModified,
      F.blocked,
      F.systemId,
      F.createdAt,
    ]
    for (let i = 0; i < 5000; i++) {
      const text = Array.from(
        { length: 1 + Math.floor(next() * 8) },
        () => alphabet[Math.floor(next() * alphabet.length)]
      ).join("")
      for (const f of all) {
        const out = toODataFilter(f, "x", text)
        if (out === null) continue
        expect(
          (out.match(/'/g) ?? []).length % 2,
          `${f.type} ${text} → ${out}`
        ).toBe(0)
        const depth = [...out.replace(/'[^']*'/g, "")].reduce(
          (d, c) => (d < 0 ? d : d + (c === "(" ? 1 : c === ")" ? -1 : 0)),
          0
        )
        expect(depth, `${f.type} ${text} → ${out}`).toBe(0)
      }
    }
  })
})
