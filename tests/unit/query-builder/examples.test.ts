import { describe, expect, it } from "vitest"

import { EXAMPLE_QUERIES } from "@/query-builder/examples"
import { importQueries, SAVED_QUERIES_KEY } from "@/query-builder/saved"

// A minimal chrome.storage.local, for the import check
const store: Record<string, unknown> = {}
Object.assign(globalThis, {
  chrome: {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (items: Record<string, unknown>) =>
          Object.assign(store, items),
      },
    },
  },
})

const all = [...EXAMPLE_QUERIES.ce, ...EXAMPLE_QUERIES.bc]

/** Every tag closed, in order: FetchXML the Web API can parse */
function balanced(xml: string) {
  const open: string[] = []
  for (const [, close, name, self] of xml.matchAll(
    /<(\/?)([\w-]+)[^>]*?(\/?)>/g
  )) {
    if (self) continue
    if (!close) open.push(name)
    else if (open.pop() !== name) return false
  }
  return open.length === 0
}

describe("example queries", () => {
  it("have unique example ids and sit under their own platform", () => {
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length)
    for (const q of all) expect(q.id).toMatch(/^example:/)
    for (const q of EXAMPLE_QUERIES.ce) expect(q.platform).toBe("ce")
    for (const q of EXAMPLE_QUERIES.bc) expect(q.platform).toBe("bc")
  })

  it("are all valid saved queries", async () => {
    const file = JSON.stringify({ queries: all })
    expect(await importQueries(file)).toBe(all.length)
    expect(store[SAVED_QUERIES_KEY]).toHaveLength(all.length)
  })

  it("Dynamics 365: well-formed FetchXML on a named table", () => {
    for (const q of EXAMPLE_QUERIES.ce) {
      if (q.platform !== "ce") continue
      expect(q.fetchXml).toMatch(/<fetch[^>]*>\s*<entity name="\w+">/)
      expect(balanced(q.fetchXml), q.name).toBe(true)
    }
  })

  it("Business Central: filters, sort and joins use the query's fields", () => {
    for (const q of EXAMPLE_QUERIES.bc) {
      if (q.platform !== "bc") continue
      const { fields, sort, joins = [] } = q.query
      expect(fields.length, q.name).toBeGreaterThan(0)
      for (const n of sort) expect(fields, q.name).toContain(n)
      for (const j of joins) expect(fields, q.name).toContain(j.field)
    }
  })
})
