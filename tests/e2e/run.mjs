// pnpm test:e2e               everything
// pnpm test:e2e bc-panel      one or more areas, by name
// pnpm test:e2e --only=blur   only tests whose name matches
//
// Starts Chrome with its own profile (outside the repo), loads dist/ itself, and
// clicks through the real extension on a real Business Central and Dynamics 365.
// Sign in when it asks; the sign-in stays in the profile. See tests/README.md.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { launch, until } from "./lib/browser.mjs"
import { loadConfig } from "./lib/config.mjs"
import { createRun } from "./lib/harness.mjs"
import { makePanel } from "./lib/panel.mjs"

const here = import.meta.dirname
const args = process.argv.slice(2)
const onlyArg = args.find((a) => a.startsWith("--only="))
const keep = args.includes("--keep")
const wanted = args.filter((a) => !a.startsWith("--"))

const config = loadConfig()
if (!config) {
  console.error("Copy .env.example to .env and fill it in.")
  process.exit(2)
}
const dist = path.resolve(here, "../../dist")
if (!fs.existsSync(path.join(dist, "manifest.json"))) {
  console.error("No build: run pnpm build first.")
  process.exit(2)
}
const home = process.env.E2E_HOME ?? path.join(os.homedir(), "AppData", "Local", "DynamicAssist-e2e")
const downloads = path.join(home, "downloads")
fs.rmSync(downloads, { recursive: true, force: true })

const AREAS = {
  "bc-panel": () => import("./bc-panel.mjs").then((m) => m.bcPanelTests),
  "bc-menu": () => import("./bc-menu.mjs").then((m) => m.bcMenuTests),
  "bc-builder": () => import("./bc-builder.mjs").then((m) => m.bcBuilderTests),
  "bc-sql": () => import("./bc-sql.mjs").then((m) => m.bcSqlTests),
  shell: () => import("./shell.mjs").then((m) => m.shellTests),
  "ce-panel": () => import("./ce-panel.mjs").then((m) => m.cePanelTests),
  "ce-write": () => import("./ce-write.mjs").then((m) => m.ceWriteTests),
  "ce-builder": () => import("./ce-builder.mjs").then((m) => m.ceBuilderTests),
  "ce-sql": () => import("./ce-sql.mjs").then((m) => m.ceSqlTests),
  "ce-menu": () => import("./ce-menu.mjs").then((m) => m.ceMenuTests),
  flow: () => import("./flow.mjs").then((m) => m.flowTests),
  layout: () => import("./layout.mjs").then((m) => m.layoutTests),
}
const toRun = wanted.length ? wanted : Object.keys(AREAS)
for (const name of toRun)
  if (!AREAS[name]) {
    console.error(`No area "${name}". Areas: ${Object.keys(AREAS).join(", ")}`)
    process.exit(2)
  }

const b = await launch({
  dist,
  profile: path.join(home, "profile"),
  downloads,
  urls: [
    `https://businesscentral.dynamics.com/${config.bc.tenant}/${config.bc.environment}/?company=${encodeURIComponent(config.bc.company)}`,
    `${config.ce.org}/main.aspx?pagetype=entitylist&etn=account`,
  ],
})
const shots = path.resolve(here, "../results/e2e-shots")
fs.rmSync(shots, { recursive: true, force: true })
fs.mkdirSync(shots, { recursive: true })
let shot = 0

const run = createRun({
  only: onlyArg ? new RegExp(onlyArg.slice(7), "i") : null,
  // What the browser showed when it failed; results are git-ignored
  onFailure: async (area, test) => {
    if (!panel?.current) return
    const name = `${String(++shot).padStart(3, "0")}-${area}-${test}`.replace(/[^\w.-]+/g, "_").slice(0, 90)
    const { data } = await b.send("Page.captureScreenshot", { format: "png" }, await b.session(panel.current))
    fs.writeFileSync(path.join(shots, `${name}.png`), Buffer.from(data, "base64"))
    // The panel can't be photographed behind the page: its text is next to it
    fs.writeFileSync(path.join(shots, `${name}.panel.txt`), await panel.text())
  },
})
let panel

let summary
try {
  // Sign-in first: this waits as long as you need
  const signedIn = (t, ms = 900000) =>
    until(t, { timeout: ms, every: 1000, what: "you to sign in to the test browser" })
  await signedIn(async () => (await b.pages()).find((t) => t.url.startsWith("https://businesscentral.dynamics.com/")))
  await signedIn(async () => {
    const t = (await b.pages()).find((p) => p.url.startsWith(config.ce.org))
    return t && (await b.evaluate(t.targetId, `typeof Xrm!=='undefined'&&!!Xrm.Utility?.getGlobalContext`).catch(() => false))
  })
  console.log(`Signed in. Extension ${b.extensionId}, running: ${toRun.join(", ")}`)

  // A clean extension each run: nothing left over from the last one
  await b.inWorker(`Promise.all([chrome.storage.local.clear(),chrome.storage.session.clear()]).then(()=>1)`)
  const version = await b.inWorker(`chrome.runtime.getManifest().version`)
  const p = await makePanel(b)
  panel = p
  for (const start of await b.pages())
    if (start.url.startsWith("https://")) await b.closeTab(start.targetId)

  for (const name of toRun) {
    console.log(`\n=== ${name} ===`)
    try {
      const tests = await AREAS[name]()
      await p.reset()
      await tests({ b, p, run, config, downloads })
    } catch (error) {
      run.area(name).record("the area itself", false, `stopped: ${error.message}`)
    }
    // Leave nothing behind for the next area
    for (const t of await b.pages())
      if (t.url.startsWith("https://")) await b.closeTab(t.targetId)
  }
  summary = run.save(path.resolve(here, "../results"), { version, areas: toRun })
} catch (error) {
  console.error(`The run stopped: ${error.message}`)
  summary = run.save(path.resolve(here, "../results"), { areas: toRun, stopped: error.message })
}
console.log(`\n${summary.summary}\nSaved ${summary.file}`)
if (!keep) await b.close()
process.exit(summary.failed ? 1 : 0)
