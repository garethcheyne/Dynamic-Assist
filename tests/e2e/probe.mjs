// node tests/e2e/probe.mjs: opens the test browser for signing in, and reports
// what the suite can rely on. Run it once; the sign-in stays in the profile.
import os from "node:os"
import fs from "node:fs"
import path from "node:path"
import { launch, sleep, until } from "./lib/browser.mjs"
import { loadConfig } from "./lib/config.mjs"

const here = import.meta.dirname
const config = loadConfig()
if (!config) {
  console.error("Copy .env.example to .env and fill it in.")
  process.exit(2)
}
const profile = process.env.E2E_PROFILE ?? path.join(os.homedir(), "AppData", "Local", "DynamicAssist-e2e", "profile")
const bcUrl = `https://businesscentral.dynamics.com/${config.bc.tenant}/${config.bc.environment}/?company=${encodeURIComponent(config.bc.company)}&page=21`
const ceUrl = `${config.ce.org}/main.aspx?pagetype=entitylist&etn=account`

const b = await launch({
  dist: path.resolve(here, "../../dist"),
  profile,
  downloads: path.join(path.dirname(profile), "downloads"),
  urls: [bcUrl, ceUrl],
})
const say = (s) => console.log(s)
say(`Chrome is open, extension ${b.extensionId}. Sign in to both tabs; waiting up to 15 minutes.`)

try {
  const bc = await until(
    async () => (await b.pages()).find((t) => t.url.startsWith("https://businesscentral.dynamics.com/") && !/SignIn/i.test(t.url)),
    { timeout: 900000, every: 1000, what: "the Business Central sign-in" }
  )
  say("Business Central: signed in")
  const ce = await until(
    async () => {
      const t = (await b.pages()).find((p) => p.url.startsWith(config.ce.org))
      if (!t) return null
      const ok = await b.evaluate(t.targetId, `typeof Xrm !== 'undefined' && !!Xrm.Utility && !!Xrm.Utility.getGlobalContext`).catch(() => false)
      return ok ? t : null
    },
    { timeout: 900000, every: 1000, what: "the Dynamics 365 sign-in" }
  )
  say(`Dynamics 365: signed in: ${await b.evaluate(ce.targetId, `Xrm.Utility.getGlobalContext().userSettings.userName ? 'user known' : 'no user'`)}`)
  await sleep(6000)

  // 1. Can a script open the real side panel?
  const windowId = await b.inWorker(`chrome.tabs.query({active:true,currentWindow:false}).then(()=>chrome.windows.getLastFocused()).then(w=>w.id)`)
  const opened = await b
    .inWorker(`chrome.sidePanel.open({windowId:${windowId}}).then(()=>'opened',e=>'refused: '+e.message)`)
    .catch((e) => `threw: ${e.message}`)
  await sleep(1500)
  const panel = (await b.targets()).find((t) => t.url.includes("sidepanel/index.html"))
  say(`Real side panel by script: ${opened}; target ${panel ? `${panel.type}` : "none"}`)

  // 2. Does a menu click reach the worker's handler?
  const dispatch = await b
    .inWorker(`typeof chrome.contextMenus.onClicked.dispatch`)
    .catch((e) => `threw: ${e.message}`)
  say(`contextMenus.onClicked.dispatch: ${dispatch}`)

  // 3. Clipboard from a panel page, focus emulated
  const pageUrl = b.extensionUrl("src/sidepanel/index.html")
  const pageId = panel?.targetId ?? (await b.openTab(pageUrl, { background: true }))
  await sleep(1000)
  const sid = await b.session(pageId)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, sid)
  await b.send("Browser.grantPermissions", {
    origin: `chrome-extension://${b.extensionId}`,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  })
  const clip = await b
    .evaluate(pageId, `navigator.clipboard.writeText('e2e-'+Date.now()).then(()=>navigator.clipboard.readText())`)
    .catch((e) => `failed: ${e.message}`)
  say(`Clipboard in panel: ${String(clip).slice(0, 20)}`)
  say(`Panel says: ${(await b.evaluate(pageId, `document.body.innerText.slice(0,80)`)).replace(/\n/g, " ")}`)

  // 4. The Business Central page
  const bcNow = (await b.pages()).find((t) => t.url.startsWith("https://businesscentral.dynamics.com/"))
  const frames = await b.evaluate(
    bcNow.targetId,
    `(()=>{const out=[];const walk=(w)=>{for(let i=0;i<w.frames.length;i++){try{out.push(w.frames[i].location.search.slice(0,60));walk(w.frames[i])}catch(e){out.push('cross-origin')}}};walk(window);return out})()`
  )
  say(`BC frames: ${JSON.stringify(frames)}; title ${bcNow.title}`)
  say("PROBE DONE. The browser stays open until you close it, or 20 minutes.")
  await until(() => b.closed, { timeout: 1200000, every: 2000, what: "Chrome to be closed" }).catch(() => undefined)
} catch (error) {
  say(`PROBE FAILED: ${error.message}`)
}
await b.close().catch(() => undefined)
process.exit(0)
