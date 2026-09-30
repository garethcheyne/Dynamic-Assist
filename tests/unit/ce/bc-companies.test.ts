import { describe, expect, it } from "vitest"

import type { HistoryEntry } from "@/lib/history"
import { bcCompanies } from "@/platforms/ce/bc-companies"

const TENANT = "0f3a9c2e-5b1d-4e7a-8bcb-7c212a6cec39"
const OTHER_TENANT = "11111111-2222-3333-4444-555555555555"

let seq = 0
/** A BC History entry for a web client URL; later calls are newer */
function bc(path: string): HistoryEntry {
  seq++
  return {
    key: `bc:${seq}`,
    platform: "bc",
    title: "t",
    subtitle: null,
    url: `https://businesscentral.dynamics.com/${path}`,
    envType: null,
    lastVisited: seq,
    visits: 1,
  }
}

const companiesOf = (list: HistoryEntry[]) =>
  list.map((e) => new URL(e.url).searchParams.get("company"))

describe("bcCompanies", () => {
  it("offers every company, newest first, without the org's setup", () => {
    const list = [
      bc(`${TENANT}/Sandbox?company=A`),
      bc(`${TENANT}/Production?company=B`),
    ]
    expect(companiesOf(bcCompanies(list, null, TENANT))).toEqual(["B", "A"])
  })

  it("merges the same company stored in another case", () => {
    const list = [
      bc(`${TENANT}/Production?company=CRONUS`),
      bc(`${TENANT}/production?company=cronus`),
    ]
    expect(bcCompanies(list, null, TENANT)).toHaveLength(1)
  })

  it("keeps only the org's environment, in any case", () => {
    const list = [
      bc(`${TENANT}/Sandbox?company=A`),
      bc(`${TENANT}/UAT?company=B`),
      bc(`${TENANT}/uat?company=C`),
    ]
    const source = { environment: "UAT", company: null }
    expect(companiesOf(bcCompanies(list, source, TENANT))).toEqual(["C", "B"])
  })

  it("drops another tenant's environment of the same name", () => {
    const list = [
      bc(`${OTHER_TENANT}/Production?company=A`),
      bc(`${TENANT}/Production?company=B`),
      bc(`contoso.com/Production?company=C`),
    ]
    const source = { environment: "Production", company: null }
    expect(companiesOf(bcCompanies(list, source, TENANT))).toEqual(["C", "B"])
  })

  it("merges a company stored with and without the tenant", () => {
    const list = [
      bc(`Production?company=A`),
      bc(`${TENANT}/Production?company=A`),
    ]
    const source = { environment: "Production", company: null }
    expect(bcCompanies(list, source, TENANT)).toHaveLength(1)
  })

  it("adds the org's default company when History doesn't have it", () => {
    const source = { environment: "UAT", company: "CRONUS NZ" }
    const [entry] = bcCompanies([], source, TENANT)
    expect(entry.url).toBe(
      `https://businesscentral.dynamics.com/${TENANT}/UAT/?company=CRONUS%20NZ`
    )
  })

  it("doesn't add the default company twice", () => {
    const source = { environment: "UAT", company: "CRONUS NZ" }
    const list = [bc(`${TENANT}/UAT?company=cronus%20nz`)]
    expect(bcCompanies(list, source, TENANT)).toHaveLength(1)
  })
})
