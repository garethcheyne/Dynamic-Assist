import { describe, expect, it } from "vitest"

import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"

const ctx = parseBcUrl(
  "https://businesscentral.dynamics.com/00000000-1111-2222-3333-444444444444/Production/?company=Contoso%20Trading%20East&page=21"
)

describe("buildBcUrl", () => {
  it("reads a company with spaces from the address", () => {
    expect(ctx.company).toBe("Contoso Trading East")
  })

  it("writes spaces as %20, which Business Central reads, not +", () => {
    const url = buildBcUrl(ctx, { page: 77500 })
    expect(url).toBe(
      "https://businesscentral.dynamics.com/00000000-1111-2222-3333-444444444444/Production/?company=Contoso%20Trading%20East&page=77500"
    )
    expect(url).not.toContain("+")
  })

  it("encodes filters and other characters, and reads back the same", () => {
    const url = buildBcUrl(
      { ...ctx, company: "CRONUS & Co (NZ)" },
      { page: 21, filter: "'No.' IS '10000'" }
    )
    expect(url).toContain("company=CRONUS%20%26%20Co%20(NZ)")
    expect(url).toContain("filter='No.'%20IS%20'10000'")
    expect(parseBcUrl(url).company).toBe("CRONUS & Co (NZ)")
  })

  it("has no query without a company or parameters", () => {
    expect(buildBcUrl({ ...ctx, company: null }, {})).toBe(
      "https://businesscentral.dynamics.com/00000000-1111-2222-3333-444444444444/Production/"
    )
  })
})
