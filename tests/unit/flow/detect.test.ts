import { describe, expect, it } from "vitest"

import { detectPlatform, parseMakerUrl } from "@/shared/detect"

const ENV = "11111111-2222-4333-8444-555555555555"
const FLOW = "22222222-3333-4444-8555-666666666666"
const SOL = "33333333-4444-4555-8666-777777777777"

describe("Power Automate detection", () => {
  it.each([
    [`https://make.powerautomate.com/environments/${ENV}/flows`, "flow"],
    ["https://make.preview.powerautomate.com/", "flow"],
    ["https://flow.microsoft.com/manage/environments", "flow"],
    [`https://make.powerapps.com/environments/${ENV}/solutions`, "maker"],
    ["https://org.crm6.dynamics.com/main.aspx", "ce"],
    ["https://example.com/", "none"],
  ])("%s is %s", (url, platform) => {
    expect(detectPlatform(url)).toBe(platform)
  })
})

describe("parseMakerUrl", () => {
  it("reads a flow's details page", () => {
    const m = parseMakerUrl(
      `https://make.powerautomate.com/environments/${ENV}/flows/${FLOW}/details`
    )
    expect(m).toMatchObject({
      environmentId: ENV,
      area: "flows",
      flowId: FLOW,
      solutionId: null,
    })
  })

  it("reads a flow opened from a solution", () => {
    const m = parseMakerUrl(
      `https://make.powerautomate.com/environments/${ENV}/solutions/${SOL}/flows/${FLOW.toUpperCase()}/details`
    )
    expect(m).toMatchObject({ solutionId: SOL, flowId: FLOW })
  })

  it("reads a maker portal solution and its cloud flow", () => {
    expect(
      parseMakerUrl(
        `https://make.powerapps.com/environments/${ENV}/solutions/${SOL}`
      )
    ).toMatchObject({ area: "solutions", solutionId: SOL, flowId: null })
    expect(
      parseMakerUrl(
        `https://make.powerapps.com/environments/${ENV}/solutions/${SOL}/objects/cloudflows/${FLOW}/view`
      ).flowId
    ).toBe(FLOW)
  })

  it("ignores non-GUID segments", () => {
    const m = parseMakerUrl(
      `https://make.powerautomate.com/environments/${ENV}/flows/shared`
    )
    expect(m.flowId).toBeNull()
    expect(m.environmentId).toBe(ENV)
  })
})
