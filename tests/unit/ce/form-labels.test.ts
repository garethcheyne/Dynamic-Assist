import { describe, expect, it } from "vitest"

import { controlNameFromLabelId } from "@/platforms/ce/form-labels"

describe("controlNameFromLabelId", () => {
  it("reads a plain control name", () => {
    expect(
      controlNameFromLabelId(
        "id-0f3a9c2e-5b1d-4e7a-8bcb-7c212a6cec39-12-name-field-label"
      )
    ).toBe("name")
  })

  it("skips a GUID with an all-digit segment", () => {
    expect(
      controlNameFromLabelId(
        "id-0f3a9c2e-5b1d-4e7a-8bcb-7c212a6cec39-139-hnc_deliveryagentstatus-field-label"
      )
    ).toBe("hnc_deliveryagentstatus")
    expect(
      controlNameFromLabelId(
        "id-a1b2c3d4-1234-5678-8bcb-7c212a6cec39-140-hnc_assignment-field-label"
      )
    ).toBe("hnc_assignment")
  })

  it("keeps header control names", () => {
    expect(
      controlNameFromLabelId(
        "id-a1b2c3d4-1234-5678-9012-7c212a6cec39-3-header_ownerid-field-label"
      )
    ).toBe("header_ownerid")
  })

  it("returns null for other labels", () => {
    expect(controlNameFromLabelId("some-label")).toBeNull()
  })
})
