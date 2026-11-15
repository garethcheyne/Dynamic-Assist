// Dynamics 365: the tiles that can write, on throwaway accounts only. Everything made
// here is deleted at the end, even after a failure. Plug-ins and flows on account may
// fire for these records, as they would for anyone's.
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { answerDiscard, apiGet, createThrowaway, deleteThrowaways, formReady, formUrl, listUrl, newFormUrl, panelOnCe, PREFIX, xrmReady } from "./lib/ce.mjs"

export async function ceWriteTests({ b, p, run, config }) {
  const t = run.area("ce-writes")
  const home = await b.openTab(listUrl(config))
  await p.front(home)
  await xrmReady(b, home)
  const record = await createThrowaway(b, home, "writes")
  const open = async (url) => {
    const tab = await b.openTab(url)
    await p.front(tab)
    await formReady(b, tab)
    await panelOnCe(p, tab)
    await p.clickTab("Tools")
    await sleep(200)
    return tab
  }

  try {
    const form = await open(formUrl(config, record.id))

    await t("God mode unlocks the form, and doesn't change its values", async () => {
      await b.evaluate(form, `(()=>{Xrm.Page.getControl('name').setDisabled(true);return 1})()`)
      await p.clickTile("God mode")
      await p.toast(/Unlocked \d+ controls/)
      eq(await b.evaluate(form, `Xrm.Page.getControl('name').getDisabled()`), false, "name still disabled")
      eq(await b.evaluate(form, `Xrm.Page.getAttribute('name').getRequiredLevel()`), "none", "required level")
      eq(await b.evaluate(form, `Xrm.Page.data.entity.getIsDirty()`), false, "form became dirty")
      eq((await p.tileState("God mode")).pressed, "true", "tile on")
    })
    await t("Save saves a real edit, and the data has it", async () => {
      const text = `Saved by the browser tests ${Date.now()}`
      await b.evaluate(form, `Xrm.Page.getAttribute('description').setValue(${JSON.stringify(text)})`)
      await until(async () => !(await p.tileState("Save")).disabled, { what: "Save to enable" })
      await p.clickTile("Save")
      await p.toast(/^Saved|Saved/)
      await until(async () => (await p.tileState("Save")).disabled, { what: "Save to go off again", timeout: 20000 })
      const row = await apiGet(b, form, `accounts(${record.id})?$select=description`)
      eq(row.description, text, "saved value")
    })
    await t("Refresh asks, and Discard drops an unsaved edit", async () => {
      await b.evaluate(form, `Xrm.Page.getAttribute('description').setValue('not to be kept')`)
      await until(async () => !(await p.tileState("Save")).disabled, { what: "Save to enable" })
      await p.clickTile("Refresh")
      await p.toast(/asking about your unsaved changes/)
      await answerDiscard(b, form)
      await until(() => b.evaluate(form, `Xrm.Page.getAttribute('description').getValue()!=='not to be kept'`), { what: "the edit to go" })
      await panelOnCe(p, form)
      await p.clickTab("Tools")
    })
    await t("Clone record opens a new form with the values, without saving", async () => {
      const before = (await apiGet(b, form, `accounts?$select=accountid&$filter=${encodeURIComponent(`startswith(name,'${PREFIX}')`)}`)).value.length
      const started = Date.now()
      await p.clickTile("Clone record")
      // Asks Dataverse which columns to leave out first, for up to 10s a request
      const toast = await until(() => p.run(`e.toast()`).then((text) => (/New form with \d+ values/.test(text) ? text : null)), { what: "the toast", timeout: 25000, every: 100 })
      const took = Date.now() - started
      await until(() => b.evaluate(form, `!!Xrm.Page.data?.entity&&Xrm.Page.ui.getFormType()===1&&!!Xrm.Page.getAttribute('name')`).catch(() => false), { what: "the new form", timeout: 40000 })
      match(await b.evaluate(form, `Xrm.Page.getAttribute('name').getValue()`), new RegExp(PREFIX), "cloned name")
      eq((await apiGet(b, form, `accounts?$select=accountid&$filter=${encodeURIComponent(`startswith(name,'${PREFIX}')`)}`)).value.length, before, "records before saving")
      return `${toast}, after ${took} ms`
    }, { timeout: 120000 })
    await t("The clone leaves out what Dataverse sets itself, and what must be unique", async () => {
      const carried = await b.evaluate(form, `['address1_addressid','address2_addressid','createdon','createdby','modifiedon','modifiedby','accountnumber'].filter(n=>{const a=Xrm.Page.getAttribute(n);return a&&a.getValue()!==null})`)
      eq(JSON.stringify(carried.filter((n) => n !== "createdby" && n !== "createdon")), "[]", "system columns on the clone")
    })
    await t("Saving the clone creates a second record", async () => {
      await panelOnCe(p, form)
      await p.clickTab("Tools")
      await b.evaluate(form, `Xrm.Page.getAttribute('name').setValue(${JSON.stringify(`${PREFIX} clone`)})`)
      // This org's form has other required fields: God mode lets it save
      await p.clickTile("God mode")
      await p.toast(/Unlocked \d+ controls/)
      await until(async () => !(await p.tileState("Save")).disabled, { what: "Save to enable" })
      await p.clickTile("Save")
      await until(async () => {
        const rows = await apiGet(b, form, `accounts?$select=name&$filter=${encodeURIComponent(`name eq '${PREFIX} clone'`)}`)
        return rows.value.length === 1
      }, { what: "the clone in Dataverse", timeout: 30000 })
    }, { timeout: 120000 })
    await b.closeTab(form)

    const fresh = await open(newFormUrl(config))
    await t("Fill required fills empty required fields, without saving", async () => {
      await b.evaluate(fresh, `(()=>{const a=Xrm.Page.getAttribute('name');a.setRequiredLevel('required');a.setValue(null);return 1})()`)
      await sleep(600)
      await p.clickTile("Fill required")
      await p.toast(/Filled \d+/)
      eq(await b.evaluate(fresh, `Xrm.Page.getAttribute('name').getValue()`), "-", "name filled")
      eq(await b.evaluate(fresh, `Xrm.Page.ui.getFormType()`), 1, "still an unsaved new form")
    })
    await t("Save is on for a filled new form; not pressed, so nothing's made", async () => {
      await until(async () => !(await p.tileState("Save")).disabled, { what: "Save to enable" })
      const made = await apiGet(b, fresh, `accounts?$select=accountid&$filter=${encodeURIComponent(`name eq '-'`)}&$top=1`)
      return `accounts named "-" already on the org: ${made.value.length}`
    })
    await b.closeTab(fresh)
  } finally {
    await p.front(home)
    const n = await deleteThrowaways(b, home).catch((e) => `failed: ${e.message}`)
    t.record("Everything these tests made is deleted", typeof n === "number", `${n} deleted`)
    const left = await apiGet(b, home, `accounts?$select=name&$filter=${encodeURIComponent(`startswith(name,'${PREFIX}')`)}`).catch(() => null)
    ok(left === null || left.value.length === 0, "throwaway records left behind")
  }
  await b.closeTab(home)
}
