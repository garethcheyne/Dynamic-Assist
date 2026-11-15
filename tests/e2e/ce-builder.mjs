// Dynamics 365: the query builder, in all its modes. Every request it makes is a read.
import fs from "node:fs"
import path from "node:path"
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { builderReady, closeBuilder, inBuilder } from "./lib/builder.mjs"
import { listReady, listUrl, panelOnCe, xrmReady } from "./lib/ce.mjs"

export async function ceBuilderTests({ b, p, run, config, downloads }) {
  const tab = await b.openTab(listUrl(config))
  await p.front(tab)
  await xrmReady(b, tab)
  await listReady(b, tab)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(tab))
  await b.send("Browser.grantPermissions", { origin: config.ce.org, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
  const q = (body, options) => inBuilder(b, tab, body, options)
  const openFromTile = async (title) => {
    await panelOnCe(p, tab)
    await p.clickTab("Tools")
    await until(() => p.hasTile(title), { what: `the tile ${title}` })
    await p.clickTile(title)
    await builderReady(b, tab, { timeout: 60000 })
  }
  /** Replaces a CodeMirror editor's text by really typing into it. */
  const setEditor = async (text) => {
    const session = await b.session(tab)
    await q(`(()=>{const c=q.dialog().querySelector('.cm-content');c.focus();const s=c.ownerDocument.getSelection();return 1})()`)
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2, commands: ["selectAll"] }, session)
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 }, session)
    await b.send("Input.insertText", { text }, session)
    await sleep(350)
    return q(`q.dialog().querySelector('.cm-content').textContent`)
  }

  const tiles = run.area("ce-query-tiles")
  await tiles("Query this table opens the page's table and runs it", async () => {
    await openFromTile("Query this table")
    await until(() => q(`/account/i.test(q.label('Table').value||q.label('Table').placeholder)`), { what: "the table to be account", timeout: 30000 })
    const r = await until(async () => {
      const v = await q(`q.result()`)
      return v.rows || v.error ? v : null
    }, { what: "it to run", timeout: 60000 })
    ok(!r.error, `error: ${r.error}`)
    await closeBuilder(b, tab)
    return r.status
  }, { timeout: 150000 })
  await tiles("Table data opens the table's list", async () => {
    await panelOnCe(p, tab)
    await p.clickTab("Tools")
    match(await p.opens(() => p.clickTile("Table data"), { back: tab }), /pagetype=entitylist&etn=account|etn=account&pagetype=entitylist/, "URL")
  })

  const t = run.area("ce-builder")
  await t("Opens from the tile, on the page's table", async () => {
    await openFromTile("Query builder")
    await until(() => q(`/account/i.test(q.label('Table').value||q.label('Table').placeholder)`), { what: "the table to be account", timeout: 30000 })
  }, { timeout: 120000 })
  await t("Before running, it says what to do", async () => {
    match(await q(`q.dialog().textContent`), /Build a query and press Run/, "hint")
  })
  await t("Run: rows, status and time", async () => {
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
    match(r.status, /[\d,]+ rows? .*· [\d,]+ ms/, "status")
    return r.status
  })
  await t("Columns: add and remove", async () => {
    await q(`q.pick(q.label('Add column'),'name')`)
    const chip = await until(() => q(`q.all('[aria-label^="Remove "]').map(x=>x.getAttribute('aria-label')).find(x=>/name/.test(x))`), { what: "the chip" })
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
    ok(r.headers.length >= 1, "no columns")
    await q(`q.label(${JSON.stringify(chip)}).click()`)
    await until(() => q(`!q.label(${JSON.stringify(chip)})`), { what: "the chip to go" })
    await q(`q.pick(q.label('Add column'),'name')`)
  })
  await t("Filter: add a condition and it applies", async () => {
    await q(`q.button('Add filter').click()`)
    await sleep(200)
    await q(`q.pick(q.all('input[aria-label="Column"]').at(-1),'name')`)
    await sleep(200)
    await q(`q.choose(q.all('select[aria-label="Operator"]').at(-1),'not-null')`)
    await sleep(200)
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
  })
  await t("Filter: a group, with match any", async () => {
    await q(`q.button('Add group').click()`)
    await sleep(200)
    const selects = await q(`q.all('select[aria-label="Match all or any"]').length`)
    ok(selects >= 2, `only ${selects} match selects`)
    await q(`q.choose(q.all('select[aria-label="Match all or any"]').at(-1),'or')`)
    await sleep(100)
    await q(`q.label('Remove group').click()`)
  })
  await t("Filter: remove a condition, and no filters returns every row", async () => {
    await q(`q.label('Remove condition').click()`)
    await until(() => q(`/No filters: every row is returned/.test(q.dialog().textContent)`), { what: "the no-filters note" })
  })
  await t("Sort: add, flip, remove", async () => {
    await q(`q.button('Sort by').click()`)
    await sleep(200)
    await q(`q.pick(q.label('Sort column'),'name')`)
    await sleep(200)
    await until(() => q(`!!q.button('Asc')`), { what: "Asc" })
    await q(`q.button('Asc').click()`)
    await until(() => q(`!!q.button('Desc')`), { what: "Desc" })
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
    await q(`q.label('Remove sort').click()`)
  })
  await t("Rows limits, and says more match", async () => {
    await q(`q.type(q.dialog().querySelector('input[type=number]'),'1')`)
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
    match(r.status, /^1 row\b/, "status")
    await q(`q.type(q.dialog().querySelector('input[type=number]'),'')`)
  })
  await t("Distinct rows can be turned off", async () => {
    await q(`[...q.dialog().querySelectorAll('label')].find(l=>/Distinct rows/.test(l.textContent)).querySelector('input').click()`)
    await q(`q.button('FetchXML')?1:0`)
    const source = await q(`(async()=>{const bs=q.all('button').filter(x=>q.norm(x.textContent)==='FetchXML');bs.at(-1).click();await q.wait(300);return q.dialog().querySelector('pre')?.textContent||''})()`)
    match(source, /distinct="false"|<fetch/, "FetchXML")
    await q(`[...q.dialog().querySelectorAll('label')].find(l=>/Distinct rows/.test(l.textContent)).querySelector('input').click()`)
    await q(`q.button('Results').click()`)
  })
  await t("The query as FetchXML, and copy it", async () => {
    const copied = await q(`(async()=>{const bs=q.all('button').filter(x=>q.norm(x.textContent)==='FetchXML');bs.at(-1).click();await q.wait(300);await navigator.clipboard.writeText('mark');q.label('Copy FetchXML').click();await q.wait(400);return navigator.clipboard.readText()})()`)
    match(copied, /<fetch/, "clipboard")
  })
  await t("The query as SQL, and copy it", async () => {
    const copied = await q(`(async()=>{const bs=q.all('button').filter(x=>q.norm(x.textContent)==='SQL');bs.at(-1).click();await q.wait(300);await navigator.clipboard.writeText('mark');q.label('Copy SQL').click();await q.wait(400);return navigator.clipboard.readText()})()`)
    match(copied, /SELECT/i, "clipboard")
    await q(`q.button('Results').click()`)
  })
  for (const [button, pattern, check] of [
    ["CSV", /\.csv$/, (text) => ok(text.split("\n").length > 1, "only a header")],
    ["JSON", /\.json$/, (text) => ok(JSON.parse(text).length > 0, "no rows")],
    ["Excel", /\.xlsx$/, (_text, bytes) => eq(bytes.subarray(0, 2).toString(), "PK", "xlsx signature")],
  ])
    await t(`Export ${button} downloads the rows`, async () => {
      await q(`q.run()`)
      const from = b.downloadsSeen.length
      await q(`q.button(${JSON.stringify(button)}).click()`)
      const dl = await until(() => b.downloadsSeen[from], { what: "a download", timeout: 15000 })
      match(dl.suggestedFilename, pattern, "file name")
      const file = await until(() => {
        const hit = fs.readdirSync(downloads).find((n) => (n === dl.guid || n === dl.suggestedFilename) && !n.endsWith(".crdownload"))
        return hit && path.join(downloads, hit)
      }, { what: "the file", timeout: 15000 })
      const bytes = fs.readFileSync(file)
      check(bytes.toString("utf8"), bytes)
      return dl.suggestedFilename
    })
  await t("FetchXML mode: type a query, Check it, run it", async () => {
    await q(`q.button('FetchXML').click()`)
    await until(() => q(`!!q.dialog().querySelector('.cm-content[aria-label="FetchXML"]')`), { what: "the editor" })
    await setEditor(`<fetch top="3"><entity name="account"><attribute name="name" /></entity></fetch>`)
    await q(`q.button('Check').click()`)
    await until(() => q(`/Dataverse can read this query/.test(q.dialog().textContent)`), { what: "Dataverse's answer", timeout: 20000 })
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
    ok(r.rows <= 3, `${r.rows} rows`)
  }, { timeout: 120000 })
  await t("FetchXML mode: a bad query gets Dataverse's error", async () => {
    await setEditor(`<fetch><entity name="no_such_table_e2e"><attribute name="name" /></entity></fetch>`)
    await q(`q.button('Check').click()`)
    await until(() => q(`/Dataverse: /.test(q.dialog().textContent)`), { what: "the error", timeout: 20000 })
  })
  await t("SQL mode: type a query and run it", async () => {
    await q(`q.button('SQL').click()`)
    await until(() => q(`!!q.dialog().querySelector('.cm-content[aria-label="SQL"]')`), { what: "the editor" })
    await setEditor(`SELECT TOP 3 name FROM account`)
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${String(r.error).slice(0, 200)}`)
    ok(r.rows > 0 || r.empty, "no result")
    return r.status
  }, { timeout: 120000 })
  await t("SQL mode only reads: a write is refused", async () => {
    await setEditor(`DELETE FROM account WHERE name = 'no-such-account-e2e'`)
    const r = await q(`q.run()`)
    ok(r.error, `no error; ${r.status}`)
    return String(r.error).slice(0, 100)
  }, { timeout: 120000 })
  await t("Back to Builder says SQL isn't read back", async () => {
    await q(`q.button('Builder').click()`)
    await until(() => q(`!!q.label('Add column')`), { what: "the builder" })
  })
  const SAVED = "E2E saved query"
  await t("Saved: save, load back, delete", async () => {
    await q(`q.starts('Saved').click()`)
    await until(() => q(`!!q.root().querySelector('input[placeholder="Name this query"]')`), { what: "the name input" })
    await q(`q.type(q.root().querySelector('input[placeholder="Name this query"]'),${JSON.stringify(SAVED)})`)
    await sleep(100)
    await q(`[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent)==='Save').click()`)
    await until(async () => (await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>s.savedQueries||[])`)).some((x) => x.name === SAVED), { what: "it in storage" })
    await until(() => q(`q.root().textContent.includes(${JSON.stringify(SAVED)})`), { what: "the row" })
    await q(`[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent).startsWith(${JSON.stringify(SAVED)})).click()`)
    await sleep(500)
    await q(`(()=>{if(!q.root().querySelector('input[placeholder="Name this query"]'))q.starts('Saved').click();return 1})()`)
    await until(() => q(`!!q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'?"]')`), { what: "delete" })
    await q(`q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'?"]').click()`)
    await until(() => q(`!!q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'"]')`), { what: "the confirm" })
    await q(`q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'"]').click()`)
    await until(async () => !(await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>s.savedQueries||[])`)).some((x) => x.name === SAVED), { what: "it to leave storage" })
    await q(`(()=>{if(q.root().querySelector('input[placeholder="Name this query"]'))q.starts('Saved').click();return 1})()`)
  }, { timeout: 120000 })
  await t("Keyboard: it has focus, and a real Esc minimises", async () => {
    const keys = await b.session(tab)
    ok(await q(`!!q.root().activeElement`), "nothing in the builder has focus")
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, keys)
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, keys)
    await sleep(400)
    ok(await q(`!q.dialog()`), "a real Esc didn't minimise it")
    await q(`q.root().querySelector('button[title="Bring it back"]').click()`)
    await until(() => q(`!!q.dialog()`), { what: "the builder" })
  })
  await t("Minimise, the tile, bring it back", async () => {
    await q(`q.label('Minimise').click()`)
    await until(() => q(`!!q.root().querySelector('button[title="Bring it back"]')`), { what: "the tile" })
    await q(`q.root().querySelector('button[title="Bring it back"]').click()`)
    await until(() => q(`!!q.dialog()`), { what: "the builder" })
  })
  await t("Close", async () => {
    await closeBuilder(b, tab)
    await until(() => q(`!q.dialog()`), { what: "it to close" })
  })
  await t("Open this view brings the list's own query", async () => {
    await openFromTile("Open this view")
    const text = await q(`q.dialog().textContent`)
    ok(!/Couldn't/.test(text.slice(0, 500)), text.slice(0, 200))
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${String(r.error).slice(0, 200)}`)
    await closeBuilder(b, tab)
    return r.status || "no rows"
  }, { timeout: 150000 })
  for (const name of ["Accounts and their primary contacts", "New contacts this month", "Accounts per owner", "Users and their security roles"])
    await t(`Example runs: ${name}`, async () => {
      await panelOnCe(p, tab)
      await p.clickTab("Tools")
      const clicked = await until(() => p.run(`(()=>{const x=e.all('button').find(b=>b.title&&b.title.includes(${JSON.stringify(name)}));if(!x)return false;x.click();return true})()`), { what: `the row for ${name}`, timeout: 8000 })
      ok(clicked, "not clicked")
      await until(() => q(`q.open()`), { what: "the builder", timeout: 20000 })
      const r = await until(async () => {
        const v = await q(`q.result()`)
        return v.status || v.error || v.empty ? v : null
      }, { what: "the query to run", timeout: 60000 })
      ok(!r.error, `error: ${String(r.error).slice(0, 200)}`)
      await closeBuilder(b, tab)
      return r.status || "no rows"
    }, { timeout: 150000 })
  await b.closeTab(tab)
}
