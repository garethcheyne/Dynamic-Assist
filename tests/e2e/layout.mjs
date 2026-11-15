// Business Central and Dynamics 365 side by side: the same things in the same
// places, so what you learn on one you can find on the other. Each panel's tabs,
// Tools sections, tiles and buttons are read in the order they're drawn, and what
// the two have in common has to come first and in the same order.
import { sleep, until } from "./lib/browser.mjs"
import { eq } from "./lib/harness.mjs"
import { bcLoaded, bcUrl, panelOnBc } from "./bc-panel.mjs"
import { createThrowaway, deleteThrowaways, formReady, formUrl, listReady, listUrl, panelOnCe, xrmReady } from "./lib/ce.mjs"

// The selected tab's own panel: as a background tab, the panel keeps the last tab's
// contents in the page for a while after you leave it
const ACTIVE = `document.getElementById(e.all('[role=tab]').find((x)=>x.getAttribute('aria-selected')==='true').getAttribute('aria-controls'))`

/** What a panel shows, as text, in drawn order. */
const read = (p) => ({
  tabs: () => p.run(`e.all('[role=tab]').map(x=>x.textContent.replace(/[0-9+]+$/,'').trim())`),
  sections: () => p.run(`e.all('section>div>button[aria-expanded]',${ACTIVE}).map(b=>e.norm(b.querySelector('span.truncate')?.textContent||b.textContent))`),
  /** Tiles under one section, by its title */
  tiles: (section) =>
    p.run(`(()=>{const s=e.section(${JSON.stringify(section)}).closest('section');return e.all('button',s).map(b=>e.norm(b.querySelector('span.font-medium')?.textContent)).filter(Boolean)})()`),
  /** The icon buttons on the summary card, from their labels */
  summaryActions: () => p.run(`e.all('section .ml-auto [aria-label]',${ACTIVE}).map(b=>b.getAttribute('aria-label'))`),
  /** The icon buttons in the bar at the top */
  barActions: () => p.run(`(()=>{const refresh=e.label('Read the page again');let bar=refresh;while(bar&&!bar.classList.contains('border-b'))bar=bar.parentElement;return e.all('[aria-label]',bar).map(b=>b.getAttribute('aria-label'))})()`),
})

const first = (list, n) => list.slice(0, n)
const same = (actual, expected, what) => eq(JSON.stringify(actual), JSON.stringify(expected), what)

export async function layoutTests({ b, p, run, config }) {
  const t = run.area("layout")
  const r = read(p)

  const home = await b.openTab(listUrl(config))
  await p.front(home)
  await xrmReady(b, home)
  await listReady(b, home)
  const record = await createThrowaway(b, home, "layout")
  const seen = {}
  try {
    const ce = await b.openTab(formUrl(config, record.id))
    await p.front(ce)
    await formReady(b, ce)
    await panelOnCe(p, ce)
    await p.clickTab("Record")
    await until(() => p.hasLabel("Copy record link"), { what: "the record's summary", timeout: 30000 })
    seen.ce = { tabs: await r.tabs(), summary: await r.summaryActions(), bar: await r.barActions() }
    await p.clickTab("Tools")
    await until(() => p.hasTile("Query builder"), { what: "the Tools tab" })
    await sleep(300)
    seen.ce.sections = await r.sections()
    seen.ce.query = await r.tiles("Query")
    seen.ce.page = await r.tiles("Form")
    seen.ce.record = await r.tiles("Record")
    await p.clickTab("Go to")
    await until(() => p.run(`!!e.section('You')`), { what: "the Go to tab" })
    await sleep(300)
    seen.ce.goto = await p.run(`e.norm(${ACTIVE}.querySelector('section')?.textContent).slice(0,5)`)
    seen.ce.gotoSections = await r.sections()
    await b.closeTab(ce)
    await p.front(home)
  } finally {
    await deleteThrowaways(b, home)
  }

  const bc = await b.openTab(bcUrl(config, "page=21"))
  await p.front(bc)
  await bcLoaded(b, bc)
  await panelOnBc(p, bc)
  await p.clickTab("Page")
  await until(() => p.hasLabel("Query this table"), { what: "the page's summary", timeout: 30000 })
  seen.bc = { tabs: await r.tabs(), summary: await r.summaryActions(), bar: await r.barActions() }
  await p.clickTab("Tools")
  await until(() => p.hasTile("Query builder"), { what: "the Tools tab" })
  await sleep(300)
  seen.bc.sections = await r.sections()
  seen.bc.query = await r.tiles("Query")
  seen.bc.page = await r.tiles("Page")
  seen.bc.record = await r.tiles("Record")
  await p.clickTab("Go to")
  await until(() => p.run(`!!e.section('You')`), { what: "the Go to tab" })
  await sleep(300)
  seen.bc.gotoSections = await r.sections()

  const without = (tabs, name) => tabs.filter((x) => x !== name)
  await t("Tabs: the main tab, Tools, Go to and Session, in that order", async () => {
    same(without(seen.bc.tabs, "Parts"), ["Page", "Tools", "Go to", "Session"], "Business Central")
    same(without(seen.ce.tabs, "Errors"), ["Record", "Tools", "Go to", "Session"], "Dynamics 365")
  })
  await t("Tools: Query, then the page or form, then the record", async () => {
    same(first(seen.bc.sections, 3), ["Query", "Page", "Record"], "Business Central")
    same(first(seen.ce.sections, 3), ["Query", "Form", "Record"], "Dynamics 365")
  })
  await t("Query section: the same three tiles first", async () => {
    const tiles = ["Query builder", "Query this table", "Table data"]
    same(first(seen.bc.query, 3), tiles, "Business Central")
    same(first(seen.ce.query, 3), tiles, "Dynamics 365")
  })
  await t("Page and Form sections: names, blur and expand first", async () => {
    same(first(seen.bc.page, 3), ["Field names", "Blur data", "Expand FastTabs"], "Business Central")
    same(first(seen.ce.page, 3), ["Logical names", "Blur data", "Expand tabs"], "Dynamics 365")
  })
  await t("Record section: the link, then every field or column", async () => {
    same(first(seen.bc.record, 2), ["Copy record link", "All fields"], "Business Central")
    same(first(seen.ce.record, 2), ["Copy record link", "All columns"], "Dynamics 365")
  })
  await t("Summary card: link, query, data, then a new tab", async () => {
    same(seen.bc.summary, ["Copy record link", "Query this table", "Open the table's data in a new tab", "Open this page in a new tab"], "Business Central")
    same(first(seen.ce.summary, 4), ["Copy record link", "Query this table", "Open the record in the Web API", "Open in a new tab"], "Dynamics 365")
  })
  await t("Top bar: query builder, admin center, read again", async () => {
    same(seen.bc.bar, ["Query builder", "Business Central admin center", "Read the page again"], "Business Central")
    same(seen.ce.bar, ["Query builder", "Power Platform admin center", "Read the page again"], "Dynamics 365")
  })
  await t("Go to: where to go first, then You", async () => {
    eq(seen.ce.goto, "Go to", "Dynamics 365's first card")
    same(first(seen.bc.gotoSections, 2), ["Go to", "You"], "Business Central")
    eq(seen.ce.gotoSections[0], "You", "Dynamics 365's first section after it")
  })
}
