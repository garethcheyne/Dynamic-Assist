// Dynamics 365: the side panel's tabs, on a list and a form. The form is a throwaway
// account made for this run and deleted at the end.
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { builderReady, closeBuilder, inBuilder } from "./lib/builder.mjs"
import { answerDiscard, apiGet, createThrowaway, deleteThrowaways, discardEdits, formReady, formUrl, listReady, listUrl, nonAdminUser, panelOnCe, whoAmI, xrmReady } from "./lib/ce.mjs"

export async function cePanelTests({ b, p, run, config }) {
  const org = config.ce.org
  const orgHost = new URL(org).hostname
  const home = await b.openTab(listUrl(config))
  await p.front(home)
  await xrmReady(b, home)
  await listReady(b, home)
  const session = await b.session(home)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, session)
  await b.send("Browser.grantPermissions", { origin: org, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })

  // Anything an earlier, crashed run left behind
  await deleteThrowaways(b, home)
  const record = await createThrowaway(b, home, "panel")
  try {
    await listTests()
    const form = await b.openTab(formUrl(config, record.id))
    await p.front(form)
    await formReady(b, form)
    await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(form))
    const onForm = async (tab = "Record") => {
      await panelOnCe(p, form)
      await p.clickTab(tab)
      await sleep(200)
    }
    await run.area("ce-record-tab")("Opening a form 6 times always lists its fields", async () => {
      // Reading the form while it loaded could leave it empty until a reload
      const counts = []
      for (let i = 0; i < 6; i++) {
        const again = await b.openTab(formUrl(config, record.id))
        await p.front(again)
        await panelOnCe(p, again)
        await p.clickTab("Record")
        await until(() => p.run(`e.rows().length>20`), { what: `the fields on opening ${i + 1}`, timeout: 30000 })
        counts.push(await p.run(`e.rows().length`))
        await b.closeTab(again)
      }
      await p.front(form)
      return counts.join(", ")
    }, { timeout: 240000 })
    await recordTests(form, onForm)
    await run.area("ce-record-tiles")("Copy record link copies a link to this record", async () => {
      await onForm("Tools")
      match(await p.copied(() => p.clickTile("Copy record link")), new RegExp(`id=${record.id}`, "i"), "link")
    })
    await run.area("ce-record-tiles")("All columns: this one record, with every column", async () => {
      await onForm("Tools")
      await p.clickTile("All columns")
      await builderReady(b, form, { timeout: 60000 })
      const r = await until(async () => {
        const v = await inBuilder(b, form, `q.result()`)
        return v.rows || v.error ? v : null
      }, { what: "it to run", timeout: 60000 })
      ok(!r.error, `error: ${r.error}`)
      eq(r.rows, 1, "rows")
      ok(r.headers.length > 20, `only ${r.headers.length} columns`)
      await closeBuilder(b, form)
      return `${r.headers.length} columns`
    }, { timeout: 200000 })
    await toolsTests(form, onForm)
    await goToTests(form, onForm)
    await sessionTests(form, onForm)
    await errorsTests(form, onForm)
    await b.closeTab(form)
  } finally {
    await p.front(home)
    const n = await deleteThrowaways(b, home).catch((e) => `failed: ${e.message}`)
    console.log(`      cleaned up throwaway records: ${n}`)
  }
  await b.closeTab(home)

  async function listTests() {
    const t = run.area("ce-list")
    await t("Detects Dynamics 365 and shows the org", async () => {
      await panelOnCe(p, home)
      eq(await p.run(`document.documentElement.dataset.platform`), "ce", "platform")
    })
    await t("Record tab explains itself on a list", async () => {
      await panelOnCe(p, home)
      await p.clickTab("Record")
      await until(() => p.run(`/Open a record to see its fields/.test(e.text())`), { what: "the list message" })
      match(await p.text(), /account/, "entity")
    })
    await t("Read the page again", async () => {
      await panelOnCe(p, home)
      await p.clickLabel("Read the page again")
      await sleep(500)
      ok(await p.hasLabel("Read the page again"), "panel lost")
    })
    await t("Copy FetchXML copies the view", async () => {
      await panelOnCe(p, home)
      await p.clickTab("Tools")
      match(await p.copied(() => p.clickTile("Copy FetchXML")), /<fetch/, "clipboard")
      await p.toast(/Copied FetchXML of/)
    })
    await t("View in Web API", async () => {
      await panelOnCe(p, home)
      await p.clickTab("Tools")
      match(await p.opens(() => p.clickTile("View in Web API"), { back: home }), /\/api\/data\/v9\.2\/accounts\?(savedQuery|userQuery)=/, "URL")
    })
    await t("Logical names on a list adds them to the columns", async () => {
      await panelOnCe(p, home)
      await p.clickTab("Tools")
      await p.clickTile("Logical names")
      await until(() => b.evaluate(home, `document.querySelectorAll('.dynamic-assist-grid-name').length>0`), { what: "column names" })
      await p.toast(/Showing logical names/)
      // The tile decides from the page's state, which arrives just after the toast
      await until(async () => (await p.tileState("Logical names")).pressed === "true", { what: "the tile to show on" })
      await p.clickTile("Logical names")
      await until(() => b.evaluate(home, `document.querySelectorAll('.dynamic-assist-grid-name').length===0`), { what: "names to go" })
      await p.toast(/Labels restored/)
    })
    await t("Blur data on a list", async () => {
      await panelOnCe(p, home)
      await p.clickTab("Tools")
      await p.clickTile("Blur data")
      await until(() => b.evaluate(home, `!!document.getElementById('dynamic-assist-blur')`), { what: "the blur style" })
      await p.toast(/Values blurred/)
      // The tile decides from the page's state, which arrives just after the toast
      await until(async () => (await p.tileState("Blur data")).pressed === "true", { what: "the tile to show on" })
      await p.clickTile("Blur data")
      await until(() => b.evaluate(home, `!document.getElementById('dynamic-assist-blur')`), { what: "blur to clear" })
      await p.toast(/Blur removed/)
    })
    await t("Form-only tiles are off on a list", async () => {
      await panelOnCe(p, home)
      await p.clickTab("Tools")
      for (const title of ["God mode", "Expand tabs", "Fill required", "Clone record", "Save"])
        eq((await p.tileState(title)).disabled, true, `${title} disabled`)
    })
    await t("Access works from a list", async () => {
      await panelOnCe(p, home)
      await p.clickTab("Record")
      await p.openSection("Access")
      await p.clickButton("Check access")
      await until(() => p.run(`/privilege/i.test(e.text())&&/Organization|Business unit|User|None/.test(e.text())`), { what: "the privileges", timeout: 30000 })
    })
  }

  async function recordTests(form, onForm) {
    const t = run.area("ce-record-tab")
    await t("Shows the record: table, form type, ID", async () => {
      await onForm()
      const text = await p.text()
      match(text, /account/)
      match(text, /Update|Read only/)
      ok(text.toLowerCase().includes(record.id.toLowerCase().slice(0, 8)), "record ID not shown")
    })
    await t("Copy logical name", async () => {
      await onForm()
      eq(await p.copied(() => p.clickLabel("Copy logical name account")), "account", "clipboard")
    })
    await t("Copy record link", async () => {
      await onForm()
      const link = await p.copied(() => p.clickLabel("Copy record link"))
      ok(link.startsWith(org), `link: ${link.slice(0, 40)}`)
      match(link, /pagetype=entityrecord&etn=account&id=/, "link")
      await p.toast(/Copied record link/)
    })
    await t("Open the record in the Web API", async () => {
      await onForm()
      const url = await p.opens(() => p.clickLabel("Open the record in the Web API"), { back: form })
      match(url, /\/api\/data\/v9\.2\/accounts\(/, "URL")
    })
    await t("Open in a new tab", async () => {
      await onForm()
      match(await p.opens(() => p.clickLabel("Open in a new tab"), { back: form }), /pagetype=entityrecord&etn=account/, "URL")
    })
    await t("Refresh the form's data", async () => {
      await onForm()
      await p.clickLabel("Refresh the form's data")
      await p.toast(/Refreshed/)
    })
    for (const [label, pattern] of [["Copy record id", /[0-9a-f-]{36}/i], ["Copy form", /[0-9a-f-]{36}/i], ["Copy entity set", /^accounts$/], ["Copy primary key", /accountid/]])
      await t(`Detail: ${label}`, async () => {
        await onForm()
        match(await p.copied(() => p.clickLabel(label)), pattern, "clipboard")
      })
    const SEARCH = 'input[placeholder^="Search label"]'
    await t("Fields: search narrows the list", async () => {
      await onForm()
      await p.type(SEARCH, "zzzz-nothing")
      await until(() => p.run(`!e.all('button[aria-expanded]').some(b=>/description|name/i.test(b.textContent))`), { what: "the list to empty" })
      await p.type(SEARCH, "")
    })
    for (const chip of ["Choices", "Has value", "Required", "Hidden"])
      await t(`Fields: filter chip ${chip}`, async () => {
        await onForm()
        const has = await p.run(`!!e.chip(${JSON.stringify(chip)})`)
        if (!has) return "no such fields on this form"
        await p.clickChip(chip)
        eq(await p.run(`e.chip(${JSON.stringify(chip)}).getAttribute('aria-checked')`), "true", "aria-checked")
        await p.clickChip(chip)
      })
    await t("Fields: Changed shows only what you've changed", async () => {
      await onForm()
      await b.evaluate(form, `Xrm.Page.getAttribute('description').setValue('edited by the browser tests')`)
      await until(() => p.run(`!!e.chip('Changed')`), { what: "the Changed chip" })
      await p.clickChip("Changed")
      await until(() => p.run(`/description/i.test(e.text())`), { what: "the changed field" })
      await p.clickChip("Changed")
      await discardEdits(b, form)
    })
    await t("Fields: Unsaved shows on the record, then clears", async () => {
      await onForm()
      await b.evaluate(form, `Xrm.Page.getAttribute('description').setValue('edited by the browser tests')`)
      await until(() => p.run(`/Unsaved/i.test(e.text())`), { what: "the Unsaved badge" })
      await discardEdits(b, form)
      await onForm()
      await until(() => p.run(`!/Unsaved/i.test(e.text())`), { what: "Unsaved to clear" })
    })
    await t("Fields: Label or Name", async () => {
      await onForm()
      await p.clickRadio("Name")
      await until(() => p.run(`/accountnumber|telephone1|websiteurl|name/.test(e.text())`), { what: "logical names" })
      await p.clickRadio("Label")
    })
    await t("Fields: a row expands; copy logical name and value", async () => {
      await onForm()
      await p.type(SEARCH, "name")
      await sleep(200)
      const opened = await p.run(`(()=>{const r=e.rows().find(b=>/name/i.test(b.textContent));if(!r)return false;r.click();return true})()`)
      ok(opened, "no row")
      match(await p.copied(() => p.clickLabel("Copy logical name")), /\w+/, "logical name")
      match(await p.copied(() => p.clickLabel("Copy value")), /\S/, "value")
      await p.type(SEARCH, "")
    })
    await t("Fields: every copy format", async () => {
      for (const [item, pattern] of [["Web API name", /\w/], ["FetchXML attribute", /<attribute name=/], ["Raw value", /\S/], ["Label", /\S/], ["Name and value", /\S/]]) {
        await onForm()
        await p.type(SEARCH, "name")
        await sleep(150)
        await p.run(`(()=>{e.fire(e.label('More ways to copy'));return 1})()`)
        await until(() => p.run(`e.all('[role=menu]').length>0`), { what: "the formats menu" })
        match(await p.copied(() => p.clickMenuItem(item), `${item} to be copied`), pattern, item)
        await p.type(SEARCH, "")
      }
    })
    await t("Fields: a choice field's options copy their value", async () => {
      await onForm()
      await p.clickChip("Choices")
      await sleep(200)
      const opened = await p.run(`(()=>{const r=e.rows()[0];if(!r)return false;r.click();return true})()`)
      if (!opened) {
        await p.clickChip("Choices")
        return "no choice field on this form"
      }
      await sleep(250)
      const option = await p.run(`e.all('button').map(x=>e.norm(x.textContent)).find(x=>/\\d{1,10}$/.test(x)&&!/^Copy/.test(x))||''`)
      await p.clickChip("Choices")
      return option ? `has options: ${option.slice(0, 40)}` : "expanded; options not recognised on this field"
    })
    await t("Fields: Copy JSON", async () => {
      await onForm()
      const parsed = JSON.parse(await p.copied(() => p.clickButton("Copy JSON")))
      ok(Object.keys(parsed).length > 2, "too few fields")
      await p.toast(/Copied \d+ fields as JSON/)
    })
    await t("All columns: loads, searches, reloads, copies", async () => {
      await onForm()
      await p.openSection("All columns")
      await p.clickButton("Load columns")
      await until(() => p.run(`!!document.querySelector('input[placeholder^="Search column"]')`), { what: "the columns", timeout: 30000 })
      match(await p.text(), /accountid/, "columns")
      await p.type('input[placeholder^="Search column"]', "accountid")
      await sleep(150)
      await p.run(`(()=>{e.label('Copy column name').click();return 1})()`)
      await p.toast(/Copied/)
      await p.type('input[placeholder^="Search column"]', "")
      await p.clickButton("Load again")
      await until(() => p.run(`!!e.button('Load again')`), { what: "reload" })
      await p.closeSection("All columns")
    })
    await t("Access: check shows privileges and why", async () => {
      await onForm()
      await p.openSection("Access")
      await p.clickButton("Check access")
      await until(() => p.run(`/privilege/i.test(e.text())&&/Organization|Business unit|User|None/.test(e.text())`), { what: "the privileges", timeout: 40000 })
      await until(() => p.run(`/why they can reach this record|on this form/i.test(e.text())`), { what: "the detail", timeout: 30000 })
    }, { timeout: 120000 })
    await t("Access: check someone else, compare, then back to me", async () => {
      await onForm()
      await p.openSection("Access")
      // "Change" once a check has already run in this section
      await until(() => p.run(`!!(e.button('Check someone else')||e.button('Change'))`), { what: "Check someone else", timeout: 40000 })
      await p.run(`(e.button('Check someone else')||e.button('Change')).click()`)
      await until(() => p.run(`!!document.querySelector('input[placeholder="Search users by name or email"]')`), { what: "the picker" })
      await p.type('input[placeholder="Search users by name or email"]', "ad")
      const found = await until(() => p.run(`!!e.button('Check')`), { what: "users", timeout: 8000 }).catch(() => false)
      if (!found) {
        await p.clickButton("Cancel")
        return "no users match 'ad' on this org"
      }
      await p.clickButton("Check")
      await until(() => p.run(`/Checking /.test(e.text())&&/privilege/i.test(e.text())&&/Organization|Business unit|User|None/.test(e.text())`), { what: "their privileges", timeout: 40000 })
      await until(() => p.hasButton("Back to me"), { what: "Back to me" })
      // Compare them with me, while they're showing
      await p.clickButton("Compare")
      await until(() => p.run(`!!document.querySelector('input[placeholder="Search users by name or email"]')`), { what: "the compare picker" })
      await p.type('input[placeholder="Search users by name or email"]', "ga")
      if (await until(() => p.hasButton("Compare"), { what: "someone to compare with", timeout: 8000 }).catch(() => false)) {
        await p.clickButton("Compare")
        await until(() => p.run(`/\\d+ differences?|the same/i.test(e.text())`), { what: "the comparison", timeout: 40000 })
        await p.clickButton("Done")
      } else await p.clickButton("Cancel")
      await p.clickButton("Back to me")
      await until(async () => !(await p.hasButton("Back to me")), { what: "back to me", timeout: 40000 })
    }, { timeout: 150000 })
    await t("Business Central section says what it found", async () => {
      await onForm()
      await p.openSection("Business Central")
      const text = await until(async () => {
        const v = await p.text()
        return /Not coupled|isn't in this org|aren't set up|Find coupled|Couldn't read/.test(v) ? v : null
      }, { what: "the couplings answer", timeout: 30000 })
      return text.match(/Not coupled[^.]*|isn't in this org[^.]*|aren't set up[^.]*|Find coupled|Couldn't read[^.]*/)[0]
    })
    t.skip("Business Central: open a coupled record", "Needs a record really coupled to Business Central; run on one by hand.")
  }

  async function toolsTests(form, onForm) {
    const t = run.area("ce-tools-tab")
    await t("Logical names on a form", async () => {
      await onForm("Tools")
      await p.clickTile("Logical names")
      await until(() => b.evaluate(form, `document.querySelectorAll('.dynamic-assist-form-name,.dynamic-assist-grid-name').length>0`), { what: "names on the form" })
      await p.toast(/Showing logical names/)
      // The tile decides from the page's state, which arrives just after the toast
      await until(async () => (await p.tileState("Logical names")).pressed === "true", { what: "the tile to show on" })
      await p.clickTile("Logical names")
      await until(() => b.evaluate(form, `document.querySelectorAll('.dynamic-assist-form-name,.dynamic-assist-grid-name').length===0`), { what: "names to go" })
    })
    await t("Logical names stays off when the page is redrawing as you turn it off", async () => {
      await onForm("Tools")
      await p.clickTile("Logical names")
      await until(() => b.evaluate(form, `!!document.querySelector('.dynamic-assist-form-name,.dynamic-assist-grid-name')`), { what: "names" })
      await until(async () => (await p.tileState("Logical names")).pressed === "true", { what: "the tile to show on" })
      // A redraw every 40ms: one is always less than the badges' 150ms wait before the click
      await b.evaluate(form, `(()=>{const n=document.createElement('div');n.hidden=true;document.body.appendChild(n);window.__redraw=setInterval(()=>{n.appendChild(document.createElement('i'));if(n.childElementCount>50)n.replaceChildren()},40);return 1})()`)
      try {
        await sleep(300)
        await p.clickTile("Logical names")
        await until(async () => (await p.tileState("Logical names")).pressed === "false", { what: "the tile to show off" })
      } finally {
        await b.evaluate(form, `(()=>{clearInterval(window.__redraw);return 1})()`)
      }
      await sleep(500)
      eq(await b.evaluate(form, `document.querySelectorAll('.dynamic-assist-form-name,.dynamic-assist-grid-name').length`), 0, "names after turning it off")
    })
    await t("Logical names: clicking a badge copies it", async () => {
      await onForm("Tools")
      await p.clickTile("Logical names")
      await until(() => b.evaluate(form, `!!document.querySelector('.dynamic-assist-form-name,.dynamic-assist-grid-name')`), { what: "names" })
      const r = await b.evaluate(form, `(async()=>{const x=document.querySelector('.dynamic-assist-form-name,.dynamic-assist-grid-name');await navigator.clipboard.writeText('mark');x.click();await new Promise(r=>setTimeout(r,500));return {text:x.textContent,got:await navigator.clipboard.readText()}})()`)
      ok(r.got !== "mark", `clipboard unchanged; badge ${r.text}`)
      await p.clickTile("Logical names")
    })
    await t("Option sets tile loads the section", async () => {
      await onForm("Tools")
      await p.clickTile("Option sets")
      await until(() => p.run(`!!document.querySelector('input[placeholder^="Search column, option"]')`), { what: "the option sets", timeout: 30000 })
      match(await p.text(), /Status|Choice|Yes\/No/, "groups")
    })
    await t("Option sets: search, reload, copy formats", async () => {
      await onForm("Tools")
      await p.openSection("Option sets")
      if (await p.hasButton("Load option sets")) await p.clickButton("Load option sets")
      await until(() => p.run(`!!document.querySelector('input[placeholder^="Search column, option"]')`), { what: "the option sets", timeout: 30000 })
      await p.type('input[placeholder^="Search column, option"]', "statecode")
      await sleep(200)
      const json = await p.copied(() => p.clickButton("Copy JSON"))
      ok(JSON.parse(json), "not JSON")
      await p.type('input[placeholder^="Search column, option"]', "")
      await p.clickButton("Load again")
      await p.closeSection("Option sets")
    })
    await t("Expand tabs", async () => {
      await onForm("Tools")
      await p.clickTile("Expand tabs")
      await p.toast(/Expanded \d+ tabs/)
    })
    await t("Refresh subgrids", async () => {
      await onForm("Tools")
      await p.clickTile("Refresh subgrids")
      await p.toast(/Refreshed \d+ subgrids/)
    })
    await t("Refresh", async () => {
      await onForm("Tools")
      await p.clickTile("Refresh")
      await p.toast(/Refreshed/)
    })
    await t("Refresh with unsaved edits: says Dynamics 365 is asking, no 45s wait", async () => {
      await onForm("Tools")
      await b.evaluate(form, `Xrm.Page.getAttribute('description').setValue('edited by the browser tests')`)
      await until(async () => !(await p.tileState("Save")).disabled, { what: "the form to read as changed" })
      const started = Date.now()
      await p.clickTile("Refresh")
      await p.toast(/asking about your unsaved changes/)
      ok(Date.now() - started < 5000, `took ${Date.now() - started}ms`)
      await answerDiscard(b, form)
    })
    await t("Blur data on a form", async () => {
      await onForm("Tools")
      await p.clickTile("Blur data")
      await until(() => b.evaluate(form, `!!document.getElementById('dynamic-assist-blur')`), { what: "the blur style" })
      // The tile is busy until the page has answered
      await p.toast(/Values blurred/)
      await until(async () => (await p.tileState("Blur data")).pressed === "true", { what: "the tile to show on" })
      await p.clickTile("Blur data")
      await until(() => b.evaluate(form, `!document.getElementById('dynamic-assist-blur')`), { what: "blur to clear" })
    })
    await t("Save is off until something changes", async () => {
      await onForm("Tools")
      eq((await p.tileState("Save")).disabled, true, "Save disabled")
    })
    await t("Open this view is off on a form", async () => {
      await onForm("Tools")
      if (await p.hasTile("Open this view")) eq((await p.tileState("Open this view")).disabled, true, "disabled")
    })
    for (const [title, flag] of [["Form monitor", "monitor=true"], ["Ribbon debug", "ribbondebug=true"], ["Performance", "perf=true"]])
      await t(`${title} reloads with its flag`, async () => {
        await onForm("Tools")
        await p.clickTile(title)
        await until(async () => (await b.targets()).find((x) => x.targetId === form)?.url.includes(flag), { what: flag, timeout: 15000 })
        await b.send("Page.navigate", { url: formUrl(config, record.id) }, await b.session(form))
        await sleep(1500)
        await formReady(b, form)
      }, { timeout: 120000 })
  }

  async function goToTests(form, onForm) {
    const t = run.area("ce-go-to-tab")
    const pickTable = async (name) => {
      await p.run(`(()=>{const i=document.querySelector('input[aria-label="Table"]');i.focus();i.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));return 1})()`)
      await sleep(600)
      await p.type('input[aria-label="Table"]', name)
      // Exact logical name ranks first, once the list has caught up with the typing
      await until(() => p.run(`new RegExp(${JSON.stringify(name)},'i').test(e.all('[role=option]')[0]?.textContent||'')&&e.all('[role=option]').length<60`), { what: `the list to filter to ${name}`, timeout: 20000 })
      await p.run(`(()=>{const hit=e.all('[role=option]')[0];hit.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));hit.click();return 1})()`)
      await sleep(250)
    }
    await t("Table search, then List", async () => {
      await onForm("Go to")
      await pickTable("contact")
      match(await p.opens(() => p.clickButton("List"), { back: form }), /pagetype=entitylist&etn=contact/, "URL")
    })
    await t("Table search, then New", async () => {
      await onForm("Go to")
      await pickTable("contact")
      const url = await p.opens(() => p.clickButton("New"), { back: form })
      match(url, /pagetype=entityrecord&etn=contact/, "URL")
      ok(!/[?&]id=/.test(url), "a new record has no ID")
    })
    await t("Table search, a record ID, then Record", async () => {
      await onForm("Go to")
      await pickTable("account")
      await p.type('input[aria-label="Record ID"]', record.id)
      const url = await p.opens(() => p.clickButton("Record"), { back: form })
      ok(url.toLowerCase().includes(record.id.toLowerCase()), `URL: ${url.slice(0, 120)}`)
    })
    const here = `https://${orgHost}`
    /**
     * The status of the page the tab itself loaded. Fetching the URL again instead
     * hung for classic pages, queued behind the one just abandoned.
     */
    const answered = async (tab) => {
      const status = await until(() => b.evaluate(tab, `performance.getEntriesByType('navigation')[0]?.responseStatus||0`, { timeout: 5000 }).catch(() => 0), { what: "the page", timeout: 150000, every: 500 }).catch(async (error) => {
        const seen = await b.evaluate(tab, `JSON.stringify({ready:document.readyState,path:location.pathname,search:location.search.slice(0,80),title:document.title.slice(0,60),nav:performance.getEntriesByType('navigation')[0]?.toJSON?.(),body:document.body?.innerText?.slice(0,160)})`, { timeout: 5000 }).catch((e) => `can't read the tab: ${e.message}`)
        throw new Error(`${error.message}. The tab: ${seen}`)
      })
      // Left loading, it would hold up the next classic page in this session
      await until(() => b.evaluate(tab, `document.readyState==='complete'`, { timeout: 5000 }).catch(() => false), { what: "the page to finish", timeout: 30000 }).catch(() => undefined)
      return status
    }
    for (const [title, pattern, check] of [
      ["My user record", /etn=systemuser&id=/, true],
      ["Classic settings", /settingsonly=true/, true],
      ["Security", /adminsecurity_area\.aspx/, true],
      ["System jobs", /entitylist&etn=asyncoperation/, true],
      ["Processes", /entitylist&etn=workflow/, true],
      ["Mailboxes", /entitylist&etn=mailbox/, true],
      ["Diagnostics", /diag\.aspx\/GetMetrics/, true],
      ["Advanced find", /pagetype=advancedfind/, true],
      ["Web API", /\/api\/data\/v9\.2\/$/, true],
      ["Entity metadata", /EntityDefinitions\(LogicalName='account'\)/, true],
      ["Admin center", /admin\.powerplatform\.microsoft\.com/, false],
      ["My apps", /home\.dynamics\.com/, false],
      ["Solutions", /make\.powerapps\.com\/environments\/.*\/solutions/, false],
      ["Solution history", /make\.powerapps\.com\/environments\/.*\/history/, false],
      ["Maker portal", /make\.powerapps\.com\/environments\/.*\/home/, false],
    ])
      await t(`${title} opens the right page${check ? ", and it answers" : ""}`, async () => {
        await onForm("Go to")
        await until(() => p.hasTile(title), { what: `the tile ${title}`, timeout: 8000 }).catch(async () => {
          await p.run(`(()=>{e.all('section>div>button[aria-expanded="false"]').forEach(s=>s.click());return 1})()`)
          await until(() => p.hasTile(title), { what: `the tile ${title}`, timeout: 4000 })
        })
        const tab = await b.newTabFrom(() => p.clickTile(title))
        try {
          match(tab.url, pattern, "URL")
          if (check && tab.url.startsWith(here)) {
            const started = Date.now()
            eq(await answered(tab.targetId), 200, `${new URL(tab.url).pathname} answered`)
            return `answered in ${((Date.now() - started) / 1000).toFixed(1)} s`
          }
        } finally {
          await b.closeTab(tab.targetId)
          await p.front(form)
        }
      }, { timeout: 240000 })
    await t("My mailbox opens yours, or says you have none", async () => {
      await onForm("Go to")
      await until(() => p.hasTile("My mailbox"), { what: "the tile", timeout: 8000 })
      const before = (await b.pages()).length
      await p.clickTile("My mailbox")
      await sleep(2500)
      const now = await b.pages()
      if (now.length > before) {
        const opened = now.find((x) => /etn=mailbox/.test(x.url))
        ok(opened, "opened something else")
        await b.closeTab(opened.targetId)
        await p.front(form)
        return "opened"
      }
      match(await p.run(`e.toast()`), /no mailbox/, "toast")
      return "no mailbox"
    })
    t.skip("Other orgs", "Needs a second Dynamics 365 org in History.")
  }

  async function sessionTests(form, onForm) {
    const t = run.area("ce-session-tab")
    await t("Shows you, your roles, the app and environment", async () => {
      await onForm("Session")
      const text = await p.text()
      match(text, /You/)
      match(text, /Environment/)
      await p.openSection("Security roles")
      await until(() => p.run(`e.text().length>50`), { what: "the roles" })
    })
    for (const [label, pattern] of [["Copy user id", /[0-9a-f-]{36}/i], ["Copy org id", /[0-9a-f-]{36}/i], ["Copy tenant", /\S/]])
      await t(label, async () => {
        await onForm("Session")
        await p.openSection("Environment")
        await p.openSection("You")
        match(await p.copied(() => p.clickLabel(label)), pattern, "clipboard")
      })
    const IMP = 'input[placeholder="Search users by name or email"]'
    const USER_ROW = `e.all('li button').find((x)=>e.norm(x.textContent)==='Impersonate')`
    await t("Impersonate: search lists users to impersonate", async () => {
      await onForm("Session")
      await p.openSection("Impersonate")
      await until(() => p.run(`!!document.querySelector(${JSON.stringify(IMP)})`), { what: "the search" })
      await p.type(IMP, "ad")
      const any = await until(() => p.run(`!!${USER_ROW}`), { what: "users", timeout: 8000 }).catch(() => false)
      await p.type(IMP, "")
      return any ? "users listed" : "nobody matches 'ad'"
    })
    // Named in .env, or anyone suitable. The tab only reads while it runs as them
    const named = config.impersonateUser
    const picked = await nonAdminUser(b, form).catch(() => null)
    const search = named ?? picked?.search
    if (!search)
      t.skip("Impersonate: a user without System Administrator, read-only", "Nobody in this org is enabled, with a role and without System Administrator.")
    else
      await t("Impersonate: a user without System Administrator, read-only", async () => {
        const me = await whoAmI(b, form)
        await onForm("Session")
        await p.openSection("Impersonate")
        await p.type(IMP, search)
        // The search matches part of a name, so this person's own row: not just the first
        const row = named
          ? USER_ROW
          : `e.all('li').filter((x)=>[...x.querySelectorAll('span')].some((y)=>e.norm(y.textContent).toLowerCase()===${JSON.stringify(search.toLowerCase())})).map((x)=>x.querySelector('button'))[0]`
        await until(() => p.run(`!!${row}`), { what: "the user", timeout: 15000 })
        await p.run(`(()=>{${row}.click();return 1})()`)
        await p.toast(/Running as/)
        try {
          // They may not be allowed to read this record: the app, not the form, has to load
          await xrmReady(b, form, 90000)
          await until(() => p.run(`/Running as/.test(e.text())`), { what: "the banner", timeout: 30000 })
          ok((await b.inWorker(`chrome.declarativeNetRequest.getSessionRules().then(r=>r.length)`)) > 0, "no header rule")
          const them = await until(async () => {
            const who = await whoAmI(b, form).catch(() => null)
            return who && who !== me ? who : null
          }, { what: "Dataverse to answer as them", timeout: 30000 })
          // True or false: the report shouldn't hold anyone's ID
        if (picked && !named) eq(them === picked.id, true, "Dataverse runs as the user who was checked")
        } finally {
          // Always back to you, whatever failed above
          await p.clickButton("Stop").catch(() => undefined)
        }
        await p.toast(/Stopped impersonating/)
        await formReady(b, form, 90000)
        eq(await b.inWorker(`chrome.declarativeNetRequest.getSessionRules().then(r=>r.length)`), 0, "rules left")
        eq(await whoAmI(b, form), me, "back to you")
        return "Dataverse answered as a user without System Administrator, then as you"
      }, { timeout: 300000 })
  }

  async function errorsTests(form, onForm) {
    const t = run.area("ce-errors-tab")
    const entries = () => b.evaluate(form, `(window.__dynamicAssistLog||[]).length`)
    await t("Watch for errors turns on, and catches a real error", async () => {
      await onForm("Errors")
      await p.clickButton("Watch for errors")
      await until(() => b.inWorker(`chrome.storage.local.get('ce.errorWatch').then(s=>s['ce.errorWatch']===true)`), { what: "the setting" })
      await sleep(1000)
      // It's now watching this page, without a reload
      await b.evaluate(form, `(setTimeout(()=>{throw new Error('e2e-boom-uncaught')},0),1)`)
      await until(() => p.run(`/e2e-boom-uncaught/.test(e.text())`), { what: "the error in the log", timeout: 15000 })
      match(await p.run(`e.tabEl('Errors').textContent`), /\d/, "count on the tab")
      return `${await entries()} entries in the page`
    }, { timeout: 90000 })
    await t("Filters: search and kinds", async () => {
      await onForm("Errors")
      await p.type('input[placeholder="Search messages and sources"]', "e2e-boom")
      await sleep(200)
      match(await p.text(), /e2e-boom/, "kept")
      await p.type('input[placeholder="Search messages and sources"]', "nothing-like-this")
      await until(() => p.run(`!/e2e-boom/.test(e.text())`), { what: "it to filter out" })
      await p.type('input[placeholder="Search messages and sources"]', "")
      for (const chip of ["Errors", "Network", "Web resources", "Platform warnings"])
        if (await p.run(`!!e.chip(${JSON.stringify(chip)})`)) {
          await p.clickChip(chip)
          await p.clickChip(chip)
        }
    })
    await t("An entry expands, and copies", async () => {
      await onForm("Errors")
      await p.run(`(()=>{const x=e.all('button[aria-expanded]').find(b=>/e2e-boom/.test(b.textContent));if(x&&x.getAttribute('aria-expanded')==='false')x.click();return 1})()`)
      await until(() => p.hasLabel("Copy entry"), { what: "Copy entry" })
      match(await p.copied(() => p.clickLabel("Copy entry")), /e2e-boom/, "clipboard")
    })
    await t("Copy all shown", async () => {
      await onForm("Errors")
      match(await p.copied(() => p.clickLabel("Copy all shown")), /e2e-boom/, "clipboard")
      await p.toast(/Copied \d+ entr/)
    })
    await t("Console messages capture", async () => {
      await onForm("Errors")
      await p.run(`(()=>{const l=e.all('label').find(x=>/Console messages/.test(x.textContent));l.querySelector('input,[role=checkbox]').click();return 1})()`)
      await until(() => b.evaluate(form, `localStorage.getItem('dynamicAssist.captureConsole')==='1'`), { what: "the setting" })
      await sleep(600)
      await b.evaluate(form, `(console.error('e2e-console-message'),1)`)
      await until(() => p.run(`/e2e-console-message/.test(e.text())`), { what: "the console message", timeout: 15000 })
      await p.run(`(()=>{const l=e.all('label').find(x=>/Console messages/.test(x.textContent));l.querySelector('input,[role=checkbox]').click();return 1})()`)
    })
    await t("Clear empties the log", async () => {
      await onForm("Errors")
      await p.clickLabel("Clear")
      await until(() => p.run(`!/e2e-boom/.test(e.text())`), { what: "the log to clear" })
    })
    await t("Watching turns off", async () => {
      await onForm("Errors")
      await p.run(`(()=>{const l=e.all('label').find(x=>/Watch for errors/.test(x.textContent));l.querySelector('input,[role=checkbox]').click();return 1})()`)
      await until(() => b.inWorker(`chrome.storage.local.get('ce.errorWatch').then(s=>s['ce.errorWatch']!==true)`), { what: "the setting to clear" })
    })
    await apiGet(b, form, "WhoAmI").catch(() => undefined)
  }
}
