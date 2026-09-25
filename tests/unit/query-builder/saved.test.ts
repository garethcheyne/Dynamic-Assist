import { beforeEach, describe, expect, it } from "vitest"

import {
  deleteQuery,
  exportQueries,
  importQueries,
  saveQuery,
  SAVED_QUERIES_KEY,
} from "@/query-builder/saved"

// A minimal chrome.storage.local
let store: Record<string, unknown> = {}
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
const all = () =>
  store[SAVED_QUERIES_KEY] as { name: string; platform: string }[]

const ce = {
  platform: "ce" as const,
  fetchXml: "<fetch/>",
  table: "Account",
  where: "contoso",
}
const bc = {
  platform: "bc" as const,
  query: {
    table: 18,
    fields: [1, 2],
    filters: [],
    sort: [],
    descending: false,
    top: 100,
  },
  table: "Customer (18)",
  where: "Sandbox · CRONUS",
}

describe("saved queries", () => {
  beforeEach(() => (store = {}))

  it("saves newest first and replaces one with the same name and platform", async () => {
    await saveQuery({ ...ce, name: "Open accounts" })
    await saveQuery({ ...bc, name: "Open accounts" })
    await saveQuery({
      ...ce,
      name: "open ACCOUNTS",
      fetchXml: "<fetch top='5'/>",
    })
    expect(all().map((q) => `${q.platform}:${q.name}`)).toEqual([
      "ce:open ACCOUNTS",
      "bc:Open accounts",
    ])
  })

  it("deletes by id", async () => {
    const q = await saveQuery({ ...ce, name: "A" })
    await saveQuery({ ...ce, name: "B" })
    await deleteQuery(q.id)
    expect(all().map((x) => x.name)).toEqual(["B"])
  })

  it("exports and imports, skipping entries that aren't queries", async () => {
    await saveQuery({ ...ce, name: "A" })
    await saveQuery({ ...bc, name: "B" })
    const file = JSON.parse(await exportQueries())
    file.queries.push({ name: "junk", platform: "ce" })
    store = {}
    expect(await importQueries(JSON.stringify(file))).toBe(2)
    expect(
      all()
        .map((x) => x.name)
        .sort()
    ).toEqual(["A", "B"])
  })

  it("refuses a file with no queries", async () => {
    await expect(importQueries(`{"hello":1}`)).rejects.toThrow(
      "No saved queries"
    )
  })
})
