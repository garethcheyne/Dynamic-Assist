import { describe, expect, it } from "vitest"

import { bcRecordLink, parseBcUrl } from "@/platforms/bc/url"

const FORM = { pageId: 21, bookmark: "abc" }

describe("bcRecordLink", () => {
  it("keeps the company in the URL", () => {
    const ctx = parseBcUrl(
      "https://businesscentral.dynamics.com/SANDBOX?company=CRONUS"
    )
    expect(bcRecordLink(ctx, FORM)).toContain("company=CRONUS")
  })

  it("names the session's company when the URL doesn't", () => {
    const ctx = parseBcUrl("https://businesscentral.dynamics.com/SANDBOX")
    const link = bcRecordLink(ctx, FORM, { company: { name: "CRONUS NZ" } })
    expect(link).toContain("company=CRONUS%20NZ")
    expect(link).toContain("page=21")
    expect(link).toContain("bookmark=abc")
  })

  it("has no link without a record", () => {
    const ctx = parseBcUrl("https://businesscentral.dynamics.com/SANDBOX")
    expect(bcRecordLink(ctx, { pageId: 22, bookmark: null })).toBeNull()
  })
})
