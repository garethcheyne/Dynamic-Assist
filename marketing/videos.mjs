#!/usr/bin/env node
/**
 * Short demo videos of the real query builder and side panel (built into dist/),
 * on a stage with made-up data, for the website and the store listings. A script
 * moves a visible cursor, clicks and types; Chrome records each frame and ffmpeg
 * makes MP4 files, with a poster image. Run `pnpm build` first.
 *
 *   node marketing/videos.mjs                 every scene, light theme
 *   node marketing/videos.mjs ce-builder      one scene
 *   node marketing/videos.mjs --theme=dark    dark versions
 *   node marketing/videos.mjs --probe         open the builder, print its controls, no video
 *
 * Writes marketing/out/videos/{scene}-{theme}.{mp4,jpg} and a chapters
 * file ({scene}-{theme}.json) with when each step starts, for the website.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { launchChrome, sleep } from "./lib/chrome.mjs"
import { mockScript } from "./lib/mock.mjs"
import { bcQueryMockScript } from "./lib/bc-query-mock.mjs"
import { queryMockScript } from "./lib/query-mock.mjs"
import { serve } from "./lib/serve.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "marketing/out/videos")
const VIEW = { width: 1440, height: 900, scale: 1.5 }
const args = process.argv.slice(2)
const theme = args.find((a) => a.startsWith("--theme="))?.slice(8) ?? "light"
/** --probe (Dynamics 365) or --probe=bc: the builder's controls, no video */
const probe = args.find((a) => a.startsWith("--probe"))
const probeProduct = probe?.split("=")[1] ?? "ce"
const wanted = args.filter((a) => !a.startsWith("--"))

/**
 * In the panel: it opens the query builder in "the tab", which here is the
 * page frame beside it. Loading the builder's script and its query:open
 * message go there.
 */
const OPEN_IN_PAGE = `;(() => {
  const page = () => parent.document.getElementById("page").contentWindow
  const exec = chrome.scripting.executeScript
  chrome.scripting.executeScript = async (o) =>
    o.files ? (await page().__daLoad("/" + o.files[0].replace(/^\\//, "")), [{ result: true }]) : exec(o)
  const send = chrome.tabs.sendMessage
  chrome.tabs.sendMessage = async (id, msg, opt) =>
    msg && msg.type === "query:open" ? page().__daDeliver(msg) : send(id, msg, opt)
})()`

/** Sets up every frame of the stage: the panel gets its mock, the page the builder's */
function initScript(product) {
  process.env.THEME = theme
  if (product === "flow")
    return `
if (location.pathname.startsWith("/src/sidepanel/")) {
  ${mockScript("flow")}
  // A flow turned on or off in the panel changes on the page beside it too
  addEventListener("da:flow", (e) => parent.document.getElementById("page").contentWindow.postMessage({ type: "da:flow", ...e.detail }, "*"))
}`
  if (product === "bc")
    return `
if (location.pathname.startsWith("/src/sidepanel/")) {
  ${mockScript("bc")}
  ${OPEN_IN_PAGE}
} else if (location.pathname.startsWith("/marketing/stage/bc-page")) {
  ${bcQueryMockScript({ theme, address: "/contoso.onmicrosoft.com/Sandbox/?company=CRONUS%20NZ&page=21" })}
}`
  return `
if (location.pathname.startsWith("/src/sidepanel/")) {
  ${mockScript("ce")}
  ${OPEN_IN_PAGE}
  // Logical names and Blur data change the form beside it
  addEventListener("da:ce", (e) => parent.document.getElementById("page").contentWindow.postMessage({ type: "da:ce", ...e.detail }, "*"))
} else if (location.pathname.startsWith("/marketing/stage/ce-page")) {
  ${queryMockScript({ theme })}
}`
}

/** Finds things in the stage's frames, in the top page's coordinates */
const FIND = `(() => {
  const frame = (id) => document.getElementById(id)
  const norm = (s) => (s || "").replace(/\\s+/g, " ").trim()
  const builder = () => frame("page").contentDocument.getElementById("dynamic-assist-query")?.shadowRoot
  const dialog = () => builder()?.querySelector('[role=dialog][aria-label="Query builder"]')
  const panel = () => frame("panel").contentDocument
  const at = (el, f) => {
    if (!el) return null
    el.scrollIntoView?.({ block: "nearest" })
    const r = el.getBoundingClientRect()
    const o = f ? frame(f).getBoundingClientRect() : { x: 0, y: 0 }
    return { x: Math.round(o.x + r.x + r.width / 2), y: Math.round(o.y + r.y + r.height / 2), w: r.width, h: r.height }
  }
  return { frame, norm, builder, dialog, panel, at }
})()`

async function main() {
  const server = await serve(ROOT, 4181)
  const chrome = await launchChrome(9556)
  try {
    const scenes = probe ? ["probe"] : wanted.length ? wanted : Object.keys(SCENES)
    for (const name of scenes) {
      if (!probe && !SCENES[name]) throw new Error(`No scene "${name}". Scenes: ${Object.keys(SCENES).join(", ")}`)
      const product = probe ? probeProduct : SCENES[name].product
      const page = await chrome.page({ ...VIEW, init: initScript(product) })
      await page.goto(`${server.url}/marketing/stage/stage.html?product=${product}&theme=${theme}`, 2500)
      const r = recorder(page)
      if (probe) await runProbe(r)
      else await record(r, name, SCENES[name].run)
      await page.close()
    }
  } finally {
    await chrome.close()
    server.close()
  }
}

/** The things a scene does: move, click, type, caption, wait */
function recorder(page) {
  let mouse = { x: 1100, y: 500 }
  const chapters = []
  let started = 0
  const r = {
    page,
    chapters,
    startClock: () => (started = Date.now()),
    eval: (js) => page.eval(js),
    /** A point for the element `body` returns, given f (the finder): f.dialog(), f.panel()… */
    where: (body) => page.eval(`(() => { const f = ${FIND}; return (${body}) })()`),
    async until(body, ms = 20000, what = body) {
      const end = Date.now() + ms
      while (Date.now() < end) {
        const v = await r.where(body).catch(() => null)
        if (v) return v
        await sleep(100)
      }
      throw new Error(`Timed out waiting for ${what}`)
    },
    async move(to, ms = 650) {
      const from = { ...mouse }
      // A slight arc, eased in and out, as a hand moves. By the clock, not by
      // steps: each step is a round trip to Chrome, and those take their time
      const bend = Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) * 0.12)
      const start = Date.now()
      for (let t = 0; t < 1; ) {
        t = Math.min(1, (Date.now() - start) / ms)
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        const x = from.x + (to.x - from.x) * e
        const y = from.y + (to.y - from.y) * e - Math.sin(Math.PI * e) * bend
        await Promise.all([
          page.cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }),
          page.eval(`__stage.cursor(${x}, ${y})`),
        ])
      }
      mouse = { x: to.x, y: to.y }
    },
    async click(body, { wait = 450, ms } = {}) {
      const to = typeof body === "string" ? await r.until(body) : body
      await r.move(to, ms)
      await sleep(120)
      await page.eval(`__stage.click(${to.x}, ${to.y})`)
      await page.cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: to.x, y: to.y, button: "left", clickCount: 1 })
      await sleep(70)
      await page.cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", clickCount: 1 })
      await sleep(wait)
      return to
    },
    async type(text, { perChar = 38 } = {}) {
      for (const ch of text) {
        if (ch === "\n") await r.key("Enter")
        else await page.cdp("Input.insertText", { text: ch })
        await sleep(perChar + Math.random() * 25)
      }
    },
    async key(key, modifiers = 0) {
      const codes = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, ArrowDown: 40, ArrowUp: 38 }
      const code = codes[key] ?? key.toUpperCase().charCodeAt(0)
      for (const type of ["rawKeyDown", "keyUp"])
        await page.cdp("Input.dispatchKeyEvent", { type, key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: code, modifiers })
      await sleep(80)
    },
    async caption(step, text) {
      if (text) chapters.push({ step, text, at: started ? (Date.now() - started) / 1000 : 0 })
      await page.eval(`__stage.caption(${JSON.stringify(step ?? "")}, ${JSON.stringify(text ?? "")})`)
    },
    wait: sleep,
  }
  return r
}

/** Prints the builder's labelled controls, to write scenes against */
async function runProbe(r) {
  await r.click(`f.at([...f.panel().querySelectorAll('[role=tab]')].find(t => /Tools/.test(t.textContent)), "panel")`)
  await r.click(`f.at([...f.panel().querySelectorAll('button')].find(b => f.norm(b.textContent).startsWith('Query builder')), "panel")`)
  await r.until(`f.dialog() && !/Read the list of tables|Loading/.test(f.dialog().textContent)`, 30000, "the builder")
  await sleep(2500)
  await r.page.screenshot(path.join(OUT, `probe-open-${theme}.png`))
  const report = await r.where(`(() => {
    const d = f.dialog()
    const labelled = [...d.querySelectorAll('[aria-label]')].map(e => e.tagName.toLowerCase() + '[' + e.getAttribute('aria-label') + ']')
    const buttons = [...d.querySelectorAll('button')].map(b => f.norm(b.textContent)).filter(Boolean)
    return { labelled: [...new Set(labelled)], buttons: [...new Set(buttons)], text: f.norm(d.textContent).slice(0, 600) }
  })()`)
  console.log(JSON.stringify(report, null, 1))
  try {
    await probeMore(r)
  } catch (error) {
    console.log("probe stopped:", error.message)
  }
  await r.page.screenshot(path.join(OUT, `probe-${theme}.png`))
}

/** Filter and sort rows, the results' tabs: names that may differ by product */
async function probeMore(r) {
  if (probeProduct === "bc") {
    await r.click($.button("Filter"))
    await sleep(600)
    console.log("after Filter:", await r.where(`[...f.dialog().querySelectorAll('[aria-label], select, input')].map(e => e.tagName.toLowerCase() + '[' + (e.getAttribute('aria-label') ?? e.placeholder ?? '') + ']' + (e.tagName === 'SELECT' ? ' {' + [...e.options].map(o => o.value + '=' + o.text).join('|') + '}' : ''))`))
    return
  }
  // What a filter row and a sort row are made of
  await r.click(`f.at([...f.dialog().querySelectorAll('button')].find(b => f.norm(b.textContent) === 'Add filter'), "page")`)
  await r.click(`f.at([...f.dialog().querySelectorAll('button')].find(b => f.norm(b.textContent) === 'Sort by'), "page")`)
  await sleep(500)
  console.log("after Add filter and Sort by:", await r.where(`[...f.dialog().querySelectorAll('[aria-label]')].map(e => e.tagName.toLowerCase() + '[' + e.getAttribute('aria-label') + ']' + (e.tagName === 'SELECT' ? ' {' + [...e.options].map(o => o.value + '=' + o.text).join('|') + '}' : ''))`))
  console.log("unhandled API calls:", await r.eval(`document.getElementById('page').contentWindow.__daUnhandled`))
  // The results pane's own SQL tab, clicked with the mouse
  await r.click($.button("Run"), { wait: 1500 })
  const target = await r.where($.button("SQL", true))
  const hit = await r.where(`(() => { const fr = f.frame("page").getBoundingClientRect(); const el = f.builder().elementFromPoint(${target.x} - fr.x, ${target.y} - fr.y); return el ? el.tagName + ' ' + f.norm(el.textContent).slice(0, 40) + ' / ' + el.outerHTML.slice(0, 160) : null })()`)
  console.log("SQL tab at", target, "hit:", hit)
  await r.click(target, { wait: 1200 })
  console.log("after click, shows SQL text:", await r.where(`/SELECT/.test(f.dialog().textContent)`))
}

/** Records a scene to frames, then encodes it */
async function record(r, name, scene) {
  const base = `${name}-${theme}`
  const framesDir = path.join(OUT, `.frames-${base}`)
  fs.rmSync(framesDir, { recursive: true, force: true })
  fs.mkdirSync(framesDir, { recursive: true })
  const frames = []
  const stop = r.page.on("Page.screencastFrame", (p) => {
    const file = path.join(framesDir, `f${String(frames.length).padStart(5, "0")}.jpg`)
    fs.writeFileSync(file, Buffer.from(p.data, "base64"))
    frames.push({ file, t: p.metadata.timestamp })
    void r.page.cdp("Page.screencastFrameAck", { sessionId: p.sessionId })
  })
  await r.page.cdp("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: VIEW.width * VIEW.scale, maxHeight: VIEW.height * VIEW.scale })
  await sleep(300)
  r.startClock()
  let poster = null
  try {
    await scene(r, { poster: () => (poster = frames.length - 1) })
  } catch (error) {
    await r.page.cdp("Page.stopScreencast").catch(() => {})
    await r.page.screenshot(path.join(OUT, `failed-${base}.png`))
    throw error
  }
  await sleep(600)
  await r.page.cdp("Page.stopScreencast")
  stop()
  if (frames.length < 2) throw new Error("No frames recorded")

  // Each frame lasts until the next; the last one a moment
  const list = frames
    .map((f, i) => `file '${f.file.replace(/\\/g, "/")}'\nduration ${((frames[i + 1]?.t ?? f.t + 0.8) - f.t).toFixed(4)}`)
    .join("\n")
  const listFile = path.join(framesDir, "list.txt")
  fs.writeFileSync(listFile, `${list}\nfile '${frames.at(-1).file.replace(/\\/g, "/")}'\n`)
  const ff = (...a) => {
    const res = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" })
    if (res.status !== 0) throw new Error(`ffmpeg failed (${a.at(-1)})`)
  }
  // Frames are JPEG (full range); video players expect TV range, yuv420p, H.264.
  // WebM was tried and dropped: Chrome failed to decode it, and it was no smaller
  const vf = "fps=30,scale=1920:-2:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p"
  ff("-f", "concat", "-safe", "0", "-i", listFile, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart", "-an", path.join(OUT, `${base}.mp4`))
  const still = frames[poster ?? frames.length - 1].file
  ff("-i", still, "-vf", "scale=1920:-2:flags=lanczos", "-q:v", "3", path.join(OUT, `${base}.jpg`))
  fs.writeFileSync(path.join(OUT, `${base}.json`), JSON.stringify({ scene: name, theme, duration: frames.at(-1).t - frames[0].t, chapters: r.chapters }, null, 2))
  fs.rmSync(framesDir, { recursive: true, force: true })
  const size = (f) => `${(fs.statSync(path.join(OUT, f)).size / 1024 / 1024).toFixed(1)} MB`
  console.log(`${base}: ${frames.length} frames, ${r.chapters.length} steps, mp4 ${size(`${base}.mp4`)}`)
}

// ---- Scenes -------------------------------------------------------------------------
/** Each scene: the product page it's staged on, and what it does */
const SCENES = {}
const scene = (name, product, run) => (SCENES[name] = { product, run })
// Things to point at, as code for r.where/r.click (f is the finder above)
const $ = {
  panelTab: (t) => `f.at([...f.panel().querySelectorAll('[role=tab]')].find(x => f.norm(x.textContent).startsWith(${JSON.stringify(t)})), "panel")`,
  panelTile: (t) => `f.at([...f.panel().querySelectorAll('button')].find(x => f.norm(x.textContent).startsWith(${JSON.stringify(t)})), "panel")`,
  button: (t, last = false) => `f.at([...f.dialog().querySelectorAll('button')].filter(x => f.norm(x.textContent) === ${JSON.stringify(t)}).at(${last ? -1 : 0}), "page")`,
  label: (l) => `f.at([...f.dialog().querySelectorAll('[aria-label=${JSON.stringify(l)}]')].at(-1), "page")`,
  option: (t) => `f.at([...f.builder().querySelectorAll('li[role=option]')].find(x => f.norm(x.querySelector('span')?.textContent ?? x.textContent) === ${JSON.stringify(t)}), "page")`,
  editor: (l) => `f.at(f.dialog().querySelector('.cm-content[aria-label=${JSON.stringify(l)}]'), "page")`,
}
/** Sets a native select without opening its popup, which a recording doesn't show */
const choose = (label, value) =>
  `(() => { const s = [...f.dialog().querySelectorAll('select[aria-label=${JSON.stringify(label)}]')].at(-1); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return 1 })()`
const builderReady = `f.dialog() && !/Read the list of tables|Loading/.test(f.dialog().textContent) && !![...f.dialog().querySelectorAll('button')].find(b => f.norm(b.textContent) === 'Run' && !b.disabled)`
const resultsIn = `f.dialog().querySelectorAll('tbody tr').length > 0 && !![...f.dialog().querySelectorAll('button')].find(b => f.norm(b.textContent) === 'Run' && !b.disabled)`

async function openFromPanel(r, captions = true) {
  if (captions) await r.caption("1", "Open the panel on any record")
  await r.wait(1400)
  await r.click($.panelTab("Tools"), { wait: 700 })
  if (captions) await r.caption("2", "Tools → Query builder")
  await r.click($.panelTile("Query builder"), { wait: 300 })
  await r.until(builderReady, 30000, "the builder")
  await r.wait(700)
}

/**
 * Ticks several columns in one go, a search for each ([search, label] pairs),
 * then Add. Ticks stay as the search changes.
 */
async function addColumns(r, picks) {
  await r.click($.label("Add column"), { wait: 250 })
  for (const [i, [search, label]] of picks.entries()) {
    if (i) {
      await r.key("a", 2)
      await r.key("Backspace")
    }
    await r.type(search)
    await r.wait(300)
    await r.click($.option(label), { wait: 300, ms: 450 })
  }
  await r.wait(400)
  await r.click(`f.at(f.builder().querySelector('[data-add-ticked]'), "page")`, { wait: 600 })
}

scene("ce-builder", "ce", async (r, { poster }) => {
  await openFromPanel(r)
  await r.caption("3", "Tick the columns you want, then Add")
  await addColumns(r, [["name", "Account Name"], ["city", "Address 1: City"], ["rev", "Annual Revenue"], ["ind", "Industry"]])

  await r.caption("4", "Filter: revenue over $2 million")
  await r.click($.button("Add filter"), { wait: 500 })
  await r.click($.label("Column"), { wait: 300 })
  await r.type("revenue")
  await r.wait(400)
  await r.click($.option("Annual Revenue"), { wait: 500 })
  await r.move(await r.until($.label("Operator")))
  await r.wait(250)
  await r.where(choose("Operator", "gt"))
  await r.wait(500)
  await r.click($.label("Value"), { wait: 200 })
  await r.type("2000000")
  await r.wait(500)

  await r.caption("5", "Sort, biggest first")
  await r.click($.button("Sort by"), { wait: 400 })
  await r.click($.label("Sort column"), { wait: 300 })
  await r.type("revenue")
  await r.wait(400)
  await r.click($.option("Annual Revenue"), { wait: 500 })
  await r.click($.button("Asc"), { wait: 600 })

  await r.caption("6", "Run it, as you, with your permissions")
  await r.click($.button("Run"), { wait: 300 })
  await r.until(resultsIn, 15000, "the results")
  await r.wait(600)
  await r.move({ x: 1050, y: 520 }, 900)
  await r.wait(1800)
  poster()

  await r.caption("7", "Export it, or see the same query as SQL")
  await r.move(await r.until($.button("Excel")), 700)
  await r.wait(700)
  await r.click($.button("SQL", true), { wait: 2600 })
  await r.click($.button("Results"), { wait: 1400 })
  await r.caption()
  await r.wait(600)
})

scene("ce-sql", "ce", async (r, { poster }) => {
  await openFromPanel(r, false)
  await r.caption("1", "Switch to SQL")
  await r.click($.button("SQL"), { wait: 600 })
  await r.click($.editor("SQL"), { wait: 300 })
  await r.key("a", 2)
  await r.caption("2", "Write SQL, with suggestions as you type")
  await r.type("SELECT TOP 5 name, address1_city, revenue")
  await r.type(" "); await r.key("Enter")
  await r.type("FROM acc")
  await r.wait(900)
  await r.type("ount")
  await r.type(" "); await r.key("Enter")
  await r.type("WHERE address1_country = 'United States'")
  await r.type(" "); await r.key("Enter")
  // A column that doesn't exist, as a slip of the keyboard
  await r.type("ORDER BY revenu ")
  await r.wait(300)
  await r.caption("3", "A column that doesn't exist is underlined")
  await r.move({ x: 420, y: 300 }, 500)
  await r.wait(2400)
  await r.key("Backspace")
  await r.type("e DESC")
  await r.wait(600)
  await r.caption("4", "Run it")
  await r.click($.button("Run"), { wait: 300 })
  await r.until(resultsIn, 15000, "the results")
  await r.wait(600)
  await r.move({ x: 1050, y: 560 }, 900)
  await r.wait(2200)
  poster()
  await r.caption()
  await r.wait(800)
})

// Business Central: the builder on any table, through the companion app
scene("bc-builder", "bc", async (r, { poster }) => {
  await r.caption("1", "Open the panel on any Business Central page")
  await r.wait(1600)
  await r.click($.panelTab("Tools"), { wait: 700 })
  await r.caption("2", "Tools → Query builder")
  await r.click($.panelTile("Query builder"), { wait: 300 })
  await r.until(builderReady, 30000, "the builder")
  await r.wait(900)

  await r.caption("3", "Tick the fields you want, then Add")
  await r.click($.button("Key only"), { wait: 500 })
  await addColumns(r, [["name", "Name"], ["city", "City"], ["bal", "Balance (LCY)"]])

  await r.caption("4", "Filter: balance over 10,000")
  await r.click($.button("Filter"), { wait: 500 })
  await r.click($.label("Filter field"), { wait: 300 })
  await r.type("bal")
  await r.wait(400)
  await r.click($.option("Balance (LCY)"), { wait: 500 })
  await r.move(await r.until($.label("Operator")))
  await r.wait(250)
  await r.where(choose("Operator", "gt"))
  await r.wait(500)
  await r.click($.label("Value"), { wait: 200 })
  await r.type("10000")
  await r.wait(500)

  // Not by balance: Business Central can't sort on a FlowField, so the
  // builder doesn't offer it
  await r.caption("5", "Sort by city")
  await r.click($.label("Add sort field"), { wait: 300 })
  await r.type("city")
  await r.wait(400)
  await r.click($.option("City"), { wait: 700 })

  await r.caption("6", "Run it through the companion app, as you")
  await r.click($.button("Run"), { wait: 300 })
  await r.until(resultsIn, 15000, "the results")
  await r.wait(600)
  // Below the rows, where hovering shows no cell's tooltip
  await r.move({ x: 760, y: 660 }, 900)
  await r.wait(1800)
  poster()

  await r.caption("7", "The same query as AL, ready to paste")
  await r.click($.button("AL", true), { wait: 2800 })
  await r.click($.button("Results"), { wait: 1200 })
  await r.caption()
  await r.wait(600)
})

const panelEl = (js) => `f.at(${js}, "panel")`
const panelText = (re, sel = "*") =>
  panelEl(`[...f.panel().querySelectorAll(${JSON.stringify(sel)})].filter(e => ${re}.test(f.norm(e.textContent))).at(-1)`)

// The panel on a Dynamics 365 record: find, filter, then tools that change the form
scene("ce-tour", "ce", async (r, { poster }) => {
  await r.caption("1", "Open the panel on any record")
  await r.until(panelText(/^Adventure Works \(sample\)$/), 20000, "the record")
  await r.wait(1200)
  await r.move(await r.where(panelText(/^Adventure Works \(sample\)$/)), 900)
  await r.wait(1400)

  await r.caption("2", "Find any field by label, logical name or value")
  // Bring the fields up, so what the search finds is on screen
  const search = `f.panel().querySelector('input[placeholder^="Search label"]')`
  // In the panel's own scrolling area (its header and tabs stay): room below,
  // so a shorter list doesn't pull the box away, then the Fields section to the top
  await r.where(`(() => {
    const section = ${search}.closest('section') ?? ${search}
    let s = section.parentElement
    while (s && !/auto|scroll/.test(getComputedStyle(s).overflowY)) s = s.parentElement
    if (!s) return 1
    s.style.paddingBottom = s.clientHeight + 'px'
    s.scrollBy({ top: section.getBoundingClientRect().top - s.getBoundingClientRect().top - 8, behavior: 'smooth' })
    return 1
  })()`)
  await r.wait(900)
  await r.click(panelEl(search), { wait: 250 })
  await r.where(`${search}.focus() || 1`)
  await r.type("revenue", { perChar: 70 })
  await r.wait(2000)
  for (let i = 0; i < 7; i++) await r.key("Backspace")
  await r.wait(500)

  await r.caption("3", "Filter: has a value, changed, required")
  // A chip reads "Changed1": its count is a separate span
  await r.click(panelText(/^Changed\s*\d+$/, "button"), { wait: 1800 })
  await r.click(panelText(/^Changed\s*\d+$/, "button"), { wait: 400 })
  await r.click(panelText(/^Required\s*\d+$/, "button"), { wait: 1800 })
  await r.click(panelText(/^Required\s*\d+$/, "button"), { wait: 500 })

  await r.caption("4", "Show every field's logical name on the form")
  await r.click($.panelTab("Tools"), { wait: 700 })
  await r.click($.panelTile("Logical names"), { wait: 400 })
  await r.move({ x: 470, y: 400 }, 900)
  await r.wait(2000)
  poster()

  await r.caption("5", "Blur the values before a screenshot or a demo")
  await r.click($.panelTile("Blur data"), { wait: 400 })
  await r.move({ x: 700, y: 430 }, 900)
  await r.wait(2200)
  await r.click($.panelTile("Blur data"), { wait: 300 })
  await r.click($.panelTile("Logical names"), { wait: 600 })

  await r.caption("6", "Jump to any table, view or admin page")
  await r.click($.panelTab("Go to"), { wait: 1200 })
  await r.move({ x: 1240, y: 560 }, 1000)
  await r.wait(2200)
  await r.caption()
  await r.wait(600)
})

// Power Automate: a solution's flows that are off, all turned on at once

scene("flow-bulk", "flow", async (r, { poster }) => {
  await r.caption("1", "Open the panel in any solution")
  await r.until(panelEl(`f.panel().querySelector('input[aria-label="Pick every flow shown"]')`), 20000, "the flow list")
  await r.wait(1200)
  await r.move(await r.where(panelText(/^Flows in this solution/, "button")), 800)
  await r.wait(900)

  await r.caption("2", "Pick the flows that are off, or all of them")
  await r.click(panelEl(`f.panel().querySelector('input[aria-label="Pick every flow shown"]')`), { wait: 900 })

  await r.caption("3", "Turn them all on in one click")
  await r.click(panelText(/^Turn on \(\d+\)$/, "button"), { wait: 900 })
  await r.click(panelText(/^Turn on$/, "button"), { wait: 300 })
  await r.caption("4", "Each one turns on in Power Automate")
  await r.move({ x: 520, y: 330 }, 900)
  // "n done" shows once every flow has had its turn
  await r.until(`/\\d+ done/.test(f.panel().body.textContent)`, 20000, "the flows to finish")
  await r.wait(2200)
  poster()

  await r.caption("5", "One that can't turn on says why")
  // Point at its red mark, not over the reason itself
  await r.move(await r.until(panelEl(`f.panel().querySelector('li svg.text-destructive')`)), 900)
  await r.wait(3200)
  await r.caption()
  await r.wait(700)
})

await main()
