import { describe, expect, it } from "vitest"

import { companionStepsText } from "@/platforms/bc/companion-text"
import { classifyPageError, pageErrorText } from "@/platforms/bc/page-error"

/** A document holding these error pages, as far as pageErrorText looks */
const docWith = (...texts: string[]) =>
  ({
    querySelectorAll: () => texts.map((innerText) => ({ innerText })),
  }) as unknown as Document

// What BC 28 shows for a page that doesn't exist (seen live, 2026-11-15)
const NOT_FOUND = [
  "Something went wrong.",
  "Cannot build the page 77500.",
  "The metadata object Page 77500 was not found.",
  "Date and time: Sun, 15 Nov 2026 06:29:10 GMT",
  "Microsoft Entra tenant: 00000000-0000-0000-0000-000000000000",
  "Operation: 051e9e016d2b4014a793541c31bd8212",
  "Go back home",
].join("\n")

describe("pageErrorText", () => {
  it("keeps the sentences that name the page", () => {
    expect(pageErrorText(docWith(NOT_FOUND), 77500)).toBe(
      "Cannot build the page 77500. The metadata object Page 77500 was not found."
    )
  })

  it("splits sentences when the error is one line", () => {
    const oneLine = NOT_FOUND.replace(/\n/g, " ")
    expect(pageErrorText(docWith(oneLine), 77500)).toMatch(
      /^Cannot build the page 77500\. The metadata object Page 77500 was not found\./
    )
  })

  it("ignores an error about another page", () => {
    expect(pageErrorText(docWith(NOT_FOUND), 77501)).toBeNull()
    expect(
      pageErrorText(docWith(NOT_FOUND.replace(/77500/g, "775001")), 77500)
    ).toBeNull()
  })

  it("is null without an error page", () => {
    expect(pageErrorText(docWith(), 77500)).toBeNull()
  })
})

describe("classifyPageError", () => {
  it("reads not found as missing", () => {
    expect(
      classifyPageError("The metadata object Page 77500 was not found.")
    ).toBe("missing")
  })

  it("reads a permission error as denied", () => {
    expect(
      classifyPageError(
        "You do not have the following permissions on Page 77500: Execute"
      )
    ).toBe("denied")
  })

  it("leaves other languages as an error, not a guess", () => {
    expect(
      classifyPageError("Das Metadatenobjekt Page 77500 wurde nicht gefunden.")
    ).toBe("error")
  })
})

describe("companionStepsText", () => {
  it("names the environment and the release to install", () => {
    const text = companionStepsText("missing", "Production")
    expect(text).toContain("environment Production")
    expect(text).toContain("/releases/latest")
    expect(text).toContain("DA QUERY")
  })

  it("asks only for the permission set when the page is there", () => {
    const text = companionStepsText("denied", "Production")
    expect(text).toContain("DA QUERY permission set")
    expect(text).not.toContain("Download")
  })
})
