// Dynamics 365: the right-click menu, on a throwaway account and a list. As in
// bc-menu.mjs, Chrome's own menu is replaced by firing the click it would send.
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { builderReady, closeBuilder, inBuilder } from "./lib/builder.mjs"
import { createThrowaway, deleteThrowaways, formReady, formUrl, listReady, listUrl, panelOnCe, xrmReady } from "./lib/ce.mjs"

export async function ceMenuTests({ b, p, run, config }) {
  const t = run.area("ce-right-click")
  const list = await b.openTab(listUrl(config))
  await p.front(list)
  await xrmReady(b, list)
  await listReady(b, list)
  const record = await createThrowaway(b, list, "menu")
  const menu = (id) =>
    b.inWorker(`(async()=>{const [tab]=await chrome.tabs.query({active:true,url:${JSON.stringify(`${config.ce.org}/*`)}});if(!tab)throw new Error('No active org tab');chrome.contextMenus.onClicked.dispatch({menuItemId:${JSON.stringify(id)},frameId:0,editable:false,pageUrl:tab.url},tab);return 1})()`)
  const note = (targetId, pattern) =>
    until(
      async () => {
        const text = await b.evaluate(targetId, `document.getElementById('dynamic-assist-note')?.textContent||''`)
        return pattern.test(text) ? text : null
      },
      { timeout: 10000, every: 100, what: `the page's note to match ${pattern}` }
    )
  const rightClick = (targetId, selector) =>
    b.evaluate(targetId, `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;for(const type of ['mousedown','contextmenu'])el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:2}));return true})()`)

  try {
    const form = await b.openTab(formUrl(config, record.id))
    await p.front(form)
    await formReady(b, form)
    await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(form))
    await b.send("Browser.grantPermissions", { origin: config.ce.org, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
    await panelOnCe(p, form)
    const FIELD = `label[id$="-field-label"]`

    await t("Copy logical name, from a field's label", async () => {
      await until(() => rightClick(form, FIELD), { what: "a field label" })
      const name = await p.copied(() => menu("ce-copy-name"))
      match(name, /^\w+$/, "clipboard")
      await note(form, /Copied /)
      return name
    })
    await t("Copy logical name says so when nothing's under the mouse", async () => {
      await rightClick(form, "body")
      await menu("ce-copy-name")
      await note(form, /Right-click a field, its label or a column header first/)
    })
    await t("Logical names on/off", async () => {
      await menu("ce-logical-names")
      await note(form, /Showing logical names/)
      await menu("ce-logical-names")
      await note(form, /Labels restored/)
    })
    await t("Blur data on/off", async () => {
      await menu("ce-blur")
      await until(() => b.evaluate(form, `!!document.getElementById('dynamic-assist-blur')`), { what: "blur" })
      await note(form, /Values blurred/)
      await menu("ce-blur")
      await until(() => b.evaluate(form, `!document.getElementById('dynamic-assist-blur')`), { what: "blur to clear" })
      await note(form, /Blur removed/)
    })
    await t("Copy record ID", async () => {
      const id = await p.copied(() => menu("ce-record-id"))
      eq(id.toLowerCase().replace(/[{}]/g, ""), record.id.toLowerCase(), "clipboard")
      await note(form, /Copied the .* ID/)
    })
    await t("Copy record link", async () => {
      const link = await p.copied(() => menu("ce-record-link"))
      ok(link.toLowerCase().includes(record.id.toLowerCase()), `link: ${link.slice(0, 100)}`)
      await note(form, /Copied the link to this/)
    })
    await t("God mode", async () => {
      await menu("ce-god-mode")
      await note(form, /God mode: unlocked \d+ controls/)
    })
    await t("Option set values refuses a field that isn't a choice", async () => {
      await rightClick(form, "body")
      await menu("ce-option-set")
      await note(form, /Right-click a choice field or column first|isn't a choice column/)
    })
    await t("Open this view refuses on a form", async () => {
      await menu("ce-open-view")
      await note(form, /Open a list view first/)
    })
    await t("Microsoft links: a link opens", async () => {
      const tab = await b.newTabFrom(() => menu("link|ce|https://learn.microsoft.com/dynamics365/"))
      await b.closeTab(tab.targetId)
      await p.front(form)
      match(tab.url, /learn\.microsoft\.com/, "URL")
    })
    t.skip("Menu items appear when you right-click", "Chrome's own menu can't be read or clicked by a script; check it by hand")
    await b.closeTab(form)

    await p.front(list)
    await panelOnCe(p, list)
    await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(list))
    await t("Copy logical name, from a list column", async () => {
      await until(() => rightClick(list, ".ag-header-cell[col-id]"), { what: "a column" })
      const name = await p.copied(() => menu("ce-copy-name"))
      match(name, /^\w+$/, "clipboard")
      return name
    })
    await t("Option set values, from a choice column", async () => {
      const col = await b.evaluate(list, `(()=>{const cols=[...document.querySelectorAll('.ag-header-cell[col-id]')].map(c=>c.getAttribute('col-id'));return cols.find(c=>/statecode|statuscode|code$/.test(c))||null})()`)
      if (!col) return "this view has no choice column"
      await rightClick(list, `.ag-header-cell[col-id="${col}"]`)
      await menu("ce-option-set")
      await until(() => p.run(`!!document.querySelector('input[placeholder^="Search column, option"]')`), { what: "the option sets in the panel", timeout: 30000 })
      eq(await p.run(`document.querySelector('input[placeholder^="Search column, option"]').value`), col, "search")
      return col
    })
    await t("Copy record ID refuses on a list", async () => {
      await menu("ce-record-id")
      await note(list, /Open a saved record first/)
    })
    await t("God mode refuses on a list", async () => {
      await menu("ce-god-mode")
      await note(list, /Open a record form first/)
    })
    await t("Open this view in the query builder", async () => {
      await menu("ce-open-view")
      await builderReady(b, list, { timeout: 60000 })
      const r = await inBuilder(b, list, `q.run()`)
      ok(!r.error, `error: ${String(r.error).slice(0, 200)}`)
      await closeBuilder(b, list)
    }, { timeout: 120000 })
  } finally {
    await p.front(list)
    await deleteThrowaways(b, list).catch((e) => console.log(`      cleanup failed: ${e.message}`))
  }
  await sleep(100)
  await b.closeTab(list)
}
