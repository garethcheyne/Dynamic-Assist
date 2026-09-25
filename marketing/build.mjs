#!/usr/bin/env node
/**
 * Renders the store promo tiles from marketing/templates/promo.html, using the
 * panel screenshots from capture.mjs (captured first unless --no-capture).
 *
 *   npm run marketing                 capture, then render
 *   node marketing/build.mjs --no-capture
 *
 * Writes store/images/promo-marquee-1400x560.png and promo-small-440x280.png.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"

import { capture } from "./capture.mjs"
import { launchChrome } from "./lib/chrome.mjs"
import { serve } from "./lib/serve.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const TILES = [
  { size: "marquee", width: 1400, height: 560, file: "store/images/promo-marquee-1400x560.png" },
  { size: "small", width: 440, height: 280, file: "store/images/promo-small-440x280.png" },
]

if (!process.argv.includes("--no-capture")) await capture(["bc-tools", "ce-record", "flow-bulk"], ["light"])

const server = await serve(ROOT)
const chrome = await launchChrome()
try {
  for (const tile of TILES) {
    // Rendered at exactly the store's pixel size
    const page = await chrome.page({ width: tile.width, height: tile.height, scale: 1 })
    await page.goto(`${server.url}/marketing/templates/promo.html?size=${tile.size}`, 800)
    await page.eval(`new Promise((r) => { const t = setInterval(() => document.body.dataset.ready && (clearInterval(t), r()), 50) })`)
    await page.screenshot(path.join(ROOT, tile.file))
    await page.close()
    console.log("tile", tile.file)
  }
} finally {
  await chrome.close()
  server.close()
}
