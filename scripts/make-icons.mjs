// Renders scripts/icon.svg to public/icons/icon{16,32,48,128}.png with headless Chrome.
// Usage: npm run icons   (set CHROME to the browser's path if it isn't in the usual place)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const svg = fs.readFileSync(path.join(root, "scripts/icon.svg"), "utf8")
const chrome =
  process.env.CHROME ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => fs.existsSync(p))

if (!chrome) throw new Error("No Chrome or Edge found; set CHROME.")

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "da-icons-"))
for (const size of [16, 32, 48, 128]) {
  const html = path.join(tmp, `icon${size}.html`)
  fs.writeFileSync(
    html,
    `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`
  )
  const out = path.join(root, "public/icons", `icon${size}.png`)
  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--default-background-color=00000000",
    `--window-size=${size},${size}`,
    `--screenshot=${out}`,
    `file:///${html.replaceAll("\\", "/")}`,
  ])
  console.log("wrote", path.relative(root, out))
}
fs.rmSync(tmp, { recursive: true, force: true })
