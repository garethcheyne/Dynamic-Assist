import { describe, expect, it } from "vitest"

import { instanceKey } from "@/lib/history"
import { flowState } from "@/platforms/flow/flows"
import { detectPlatform, parseMakerUrl } from "@/shared/detect"

const ENV = "11111111-2222-4333-8444-555555555555"
const FLOW = "66666666-7777-4888-9999-aaaaaaaaaaaa"
const SOL = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"

describe("Flow states", () => {
  it("doesn't call a suspended flow off", () => {
    expect(flowState({ on: true, suspended: false })).toBe("On")
    expect(flowState({ on: false, suspended: false })).toBe("Off")
    expect(flowState({ on: false, suspended: true })).toBe("Suspended")
  })
})

describe("the flow panel's instance", () => {
  it("stays the same when you open a flow, so a picked solution stays", () => {
    const list = `https://make.powerautomate.com/environments/${ENV}/flows`
    const flow = `https://make.powerautomate.com/environments/${ENV}/flows/${FLOW}/details`
    expect(instanceKey(flow)).toBe(instanceKey(list))
    expect(instanceKey(list)).toBe(`flow:${ENV}`)
  })
})

describe("Power Automate detection", () => {
  it.each([
    [`https://make.powerautomate.com/environments/${ENV}/flows`, "flow"],
    ["https://make.preview.powerautomate.com/", "flow"],
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
