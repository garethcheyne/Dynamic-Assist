#!/usr/bin/env node
/**
 * Screenshots of the real side panel (built into dist/) with demo data, for
 * store images, promo tiles and the brochure. Run `npm run build` first.
 *
 *   node marketing/capture.mjs            all scenes, light and dark
 *   node marketing/capture.mjs flow-bulk  one scene
 *
 * Writes marketing/out/shots/{scene}-{theme}.png at 2x (800 px wide).
 */
import path from "node:path"
import { fileURLToPath } from "node:url"

import { launchChrome, sleep } from "./lib/chrome.mjs"
import { mockScript } from "./lib/mock.mjs"
import { serve } from "./lib/serve.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "marketing/out/shots")
const PANEL = { width: 400, height: 820 }

/** Page helpers run inside the panel */
const HELPERS = `
  window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await __wait(100) } return null };
  window.__button = (text) => [...document.querySelectorAll("button,[role=tab]")].find((b) => b.textContent.trim().startsWith(text));
  window.__tab = async (text) => { const t = await __until(() => [...document.querySelectorAll("[role=tab]")].find((b) => b.textContent.trim().startsWith(text))); t.click(); await __wait(500) };
`

/** Each scene: the mocked product, and what to do before the screenshot */
const SCENES = {
  "bc-page": { scenario: "bc", run: `await __until(() => document.body.innerText.includes("Adatum"))` },
  "bc-tools": { scenario: "bc", run: `await __tab("Tools")` },
  "bc-goto": { scenario: "bc", run: `await __tab("Go to")` },
  "ce-record": { scenario: "ce", run: `await __until(() => document.body.innerText.includes("Adventure Works"))` },
  "ce-tools": { scenario: "ce", run: `await __tab("Tools")` },
  "flow-bulk": {
    scenario: "flow",
    run: `
      await __until(() => document.querySelector('input[aria-label="Pick every flow shown"]'))
      await __wait(400)
      // Staged: lead with the flow list, not the environment IDs card
      document.querySelector("main section, .overflow-y-auto > section")?.remove()
      // Tick the first four flows that are off
      const boxes = [...document.querySelectorAll("ul li label input[type=checkbox]")].slice(0, 4)
      for (const b of boxes) { b.click(); await __wait(60) }
      await __wait(300)
      __button("Turn on")?.click()
      await __wait(400)`,
  },
  "flow-health": {
    scenario: "flow",
    run: `
      await __until(() => document.body.innerText.includes("Failed runs"))
      ;for (const t of ["Failed runs", "Connection references"]) [...document.querySelectorAll("section button[aria-expanded=false]")].find((b) => b.textContent.includes(t))?.click()
      await __wait(900)
      // Collapse the flow list so the health sections show
      ;[...document.querySelectorAll("section button[aria-expanded=true]")].find((b) => b.textContent.includes("Flows in this solution"))?.click()
      await __wait(400)`,
  },
  home: { scenario: "none", run: `await __until(() => document.body.innerText.includes("CRONUS")); await __wait(300)` },
  "home-bottom": {
    scenario: "none",
    run: `
      await __until(() => document.body.innerText.includes("CRONUS"))
      const adm = [...document.querySelectorAll("section button[aria-expanded=false]")].find((b) => b.textContent.includes("Admin Centres"))
      adm?.click()
      await __wait(400)
      const main = document.querySelector(".overflow-y-auto")
      main.scrollTop = main.scrollHeight
      await __wait(300)`,
  },
  "bc-home": {
    scenario: "bc",
    run: `
      await __until(() => document.body.innerText.includes("Adatum"))
      document.querySelector('[aria-label="Home"]').click()
      await __until(() => document.body.innerText.includes("Version"))
      await __wait(300)`,
  },
  "ce-access-user": {
    scenario: "ce",
    run: `
      await __until(() => document.body.innerText.includes("Adventure Works"))
      ;[...document.querySelectorAll("section button[aria-expanded=false]")].find((b) => b.textContent.includes("Access"))?.click()
      ;(await __until(() => __button("Check someone else"))).click()
      await __wait(300)
      const input = document.querySelector('input[placeholder="Search users by name or email"]')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "meg")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await __until(() => document.body.innerText.includes("Megan Bowen"))
      ;[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Check").click()
      await __until(() => document.body.innerText.includes("Checking"))
      const sec = [...document.querySelectorAll("section")].find((x) => x.innerText.startsWith("Access") || x.innerText.includes("Checking"))
      sec?.scrollIntoView()
      await __wait(400)`,
  },
  "ce-access-detail": {
    scenario: "ce",
    run: `
      await __until(() => document.body.innerText.includes("Adventure Works"))
      ;[...document.querySelectorAll("section button[aria-expanded=false]")].find((b) => b.textContent.includes("Access"))?.click()
      ;(await __until(() => __button("Check access"))).click()
      await __until(() => document.body.innerText.includes("Why they can reach"))
      document.querySelector("tbody tr:last-child")?.scrollIntoView()
      await __wait(400)`,
  },
  history: {
    scenario: "none",
    run: `
      await __until(() => document.body.innerText.includes("CRONUS"))
      // History is part of the home page: bring its heading to the top
      const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim() === "History")
      const main = document.querySelector(".overflow-y-auto")
      main.scrollTop = h.getBoundingClientRect().top - main.getBoundingClientRect().top - 8
      await __wait(300)`,
  },
  "launcher-bottom": {
    scenario: "ce",
    run: `
      await __until(() => document.body.innerText.includes("Adventure Works"))
      const trigger = document.querySelector('[aria-label="Go anywhere"]')
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }))
      trigger.click()
      await __until(() => document.body.innerText.includes("Admin centres"))
      const menu = document.querySelector("[role=menu]")
      menu.scrollTop = menu.scrollHeight
      await __wait(400)`,
  },
  launcher: {
    scenario: "ce",
    run: `
      await __until(() => document.body.innerText.includes("Adventure Works"))
      const trigger = document.querySelector('[aria-label="Go anywhere"]')
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }))
      trigger.click()
      await __until(() => document.body.innerText.includes("Admin centres"))
      await __wait(400)`,
  },
}

export async function capture(names = Object.keys(SCENES), themes = ["light", "dark"]) {
  const server = await serve(ROOT)
  const chrome = await launchChrome()
  const files = []
  try {
    for (const theme of themes) {
      process.env.THEME = theme
      for (const name of names) {
        const scene = SCENES[name]
        if (!scene) throw new Error(`Unknown scene ${name}`)
        const page = await chrome.page({ ...PANEL, scale: 2, init: mockScript(scene.scenario) })
        await page.goto(`${server.url}/src/sidepanel/index.html`, 1800)
        await page.eval(`(async () => { ${HELPERS}; ${scene.run}; await __wait(300) })()`)
        const file = path.join(OUT, `${name}-${theme}.png`)
        await page.screenshot(file)
        await page.close()
        files.push(file)
        console.log("shot", path.relative(ROOT, file))
      }
    }
  } finally {
    await chrome.close()
    server.close()
  }
  return files
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = process.argv.slice(2)
  await capture(names.length ? names : undefined)
  await sleep(0)
}
