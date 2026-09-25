#!/usr/bin/env node
/**
 * Renders the brochure (marketing/templates/brochure.html) to an A4 PDF, plus
 * a PNG of each page for previews. Uses the panel screenshots from
 * capture.mjs, captured first unless --no-capture. Run `npm run build` first.
 *
 *   npm run marketing:brochure
 *   node marketing/brochure.mjs --no-capture [--theme=dark]
 *
 * Writes marketing/out/dynamic-assist-brochure.pdf and out/brochure/page-N.png.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { capture } from "./capture.mjs"
import { launchChrome } from "./lib/chrome.mjs"
import { serve } from "./lib/serve.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "marketing/out")
const SCENES = ["bc-page", "bc-tools", "ce-record", "ce-tools", "ce-access-user", "ce-access-detail", "flow-bulk", "flow-health", "launcher", "home", "history"]
const theme = process.argv.find((a) => a.startsWith("--theme="))?.slice(8) ?? "light"
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"))

if (!process.argv.includes("--no-capture")) await capture(SCENES, [theme])

const server = await serve(ROOT)
const chrome = await launchChrome()
try {
  // A4 at 96 dpi is 794 x 1123 CSS px
  const page = await chrome.page({ width: 794, height: 1123, scale: 2 })
  await page.goto(`${server.url}/marketing/templates/brochure.html?theme=${theme}&version=${version}`, 800)
  await page.eval(`new Promise((r) => { const t = setInterval(() => document.body.dataset.ready && (clearInterval(t), r()), 50) })`)
  const pdf = path.join(OUT, "dynamic-assist-brochure.pdf")
  await page.pdf(pdf)
  console.log("pdf", path.relative(ROOT, pdf))

  // One PNG per page: each page scrolled into the viewport in turn
  const count = await page.eval(`document.querySelectorAll(".page").length`)
  await page.eval(`document.body.style.background = "#fff"; for (const p of document.querySelectorAll(".page")) p.style.margin = "0"; true`)
  for (let i = 0; i < count; i++) {
    await page.eval(`window.scrollTo(0, ${i} * 1123); true`)
    const file = path.join(OUT, "brochure", `page-${i + 1}.png`)
    await page.screenshot(file)
    console.log("page", path.relative(ROOT, file))
  }
  await page.close()
} finally {
  await chrome.close()
  server.close()
}
