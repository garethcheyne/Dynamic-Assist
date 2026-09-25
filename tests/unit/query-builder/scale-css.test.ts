import { describe, expect, it } from "vitest"

import { scaleCss } from "@/query-builder/scale-css"

describe("scaleCss", () => {
  it("turns rem into px at 16px and scales px", () => {
    expect(scaleCss(".a{font-size:.75rem;padding:4px 8px}")).toBe(
      ".a{font-size:13.8px;padding:4.6px 9.2px}"
    )
  })

  it("leaves hairlines and zero alone", () => {
    expect(scaleCss(".a{border:1px solid;margin:0px}")).toBe(
      ".a{border:1px solid;margin:0px}"
    )
  })

  it("scales values in calc and functions, including negatives", () => {
    expect(scaleCss(".a{width:calc(100% - 2rem);translate:0,-4px}")).toBe(
      ".a{width:calc(100% - 36.8px);translate:0,-4.6px}"
    )
  })

  it("leaves values inside escaped class names alone", () => {
    const css = String.raw`.text-\[11px\]{font-size:11px}.w-\[calc\(100\%-2rem\)\]{top:0}`
    expect(scaleCss(css)).toBe(
      String.raw`.text-\[11px\]{font-size:12.65px}.w-\[calc\(100\%-2rem\)\]{top:0}`
    )
  })
})
