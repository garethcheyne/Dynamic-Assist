import { describe, expect, it } from "vitest"

import { displayName, type HistoryEntry } from "@/lib/history"

const ENV = "11111111-2222-4333-8444-555555555555"

const entry = (e: Partial<HistoryEntry> & Pick<HistoryEntry, "key" | "platform" | "title">): HistoryEntry => ({
  subtitle: null,
  url: "https://example.test/",
  envType: null,
  lastVisited: 0,
  visits: 1,
  ...e,
})

const maker = entry({ key: `maker:${ENV}`, platform: "maker", title: ENV, environmentId: ENV })
const org = entry({ key: "ce:contoso", platform: "ce", title: "Contoso Dev", environmentId: ENV.toUpperCase() })

describe("displayName", () => {
  it("names a Power Apps environment after the Dynamics 365 org in it", () => {
    expect(displayName(maker, [maker, org])).toBe("Contoso Dev")
  })

  it("uses your own name for that org", () => {
    expect(displayName(maker, [maker, { ...org, label: "Dev" }])).toBe("Dev")
  })

  it("keeps the ID when no org in that environment is known", () => {
    expect(displayName(maker, [maker])).toBe(ENV)
  })

  it("keeps a name the panel already gave it", () => {
    const named = { ...maker, title: "Sales Sandbox" }
    expect(displayName(named, [named, org])).toBe("Sales Sandbox")
  })

  it("puts your own name first", () => {
    const labelled = { ...maker, label: "Mine" }
    expect(displayName(labelled, [labelled, org])).toBe("Mine")
  })

  it("leaves other products' titles alone", () => {
    const bc = entry({ key: "bc:x", platform: "bc", title: "SANDBOX" })
    expect(displayName(bc, [bc, org])).toBe("SANDBOX")
  })
})
