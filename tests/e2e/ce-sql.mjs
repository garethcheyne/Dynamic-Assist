// Dynamics 365: the SQL and FetchXML editors. Suggestions from the real org, checks,
// and enhancement 006's checklist, which had never been run on a real org. Read-only.
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { builderReady, closeBuilder, inBuilder, tooltipOf } from "./lib/builder.mjs"
import { editorOn } from "./lib/editor.mjs"
import { listReady, listUrl, panelOnCe, xrmReady } from "./lib/ce.mjs"

export async function ceSqlTests({ b, p, run, config }) {
  const tab = await b.openTab(listUrl(config))
  await p.front(tab)
  await xrmReady(b, tab)
  await listReady(b, tab)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(tab))
  await b.send("Browser.grantPermissions", { origin: config.ce.org, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
  await panelOnCe(p, tab)
  await p.clickTab("Tools")
  await p.clickTile("Query builder")
  await builderReady(b, tab, { timeout: 60000 })
  const q = (body, options) => inBuilder(b, tab, body, options)
  const ed = editorOn(b, tab)
  const labels = (list) => list.map((x) => x.label)
  const toMode = async (mode) => {
    await q(`q.all('button').find(x=>q.norm(x.textContent)===${JSON.stringify(mode)}).click()`)
    if (mode !== "Builder")
      await until(() => q(`!!q.dialog().querySelector('.cm-content[aria-label=${JSON.stringify(mode)}]')`), { what: `the ${mode} editor`, timeout: 15000 })
  }
  const sql = async (text) => {
    await ed.set(text)
    const r = await q(`q.run()`)
    ok(!r.error, `"${text}" gave: ${String(r.error).slice(0, 220)}`)
    return r
  }

  await until(() => q(`/account/i.test(q.label('Table').value||q.label('Table').placeholder)`), { what: "account", timeout: 30000 })

  const tips = run.area("ce-builder-tooltips")
  await tips("Tooltip: shows in front of the builder", async () => {
    const seen = await tooltipOf(b, tab, "Builder")
    match(seen.text, /Pick columns and filters/, "the tooltip")
    ok(seen.onTop, "the builder's window is drawn over the tooltip")
    ok(seen.height < 45, `a short tooltip wraps to several lines (${seen.height}px tall)`)
  })

  // ---- The column picker: it stays in the builder ------------------------------------
  const pick = run.area("ce-builder-pick-several")
  const chips = () => q(`q.all('[aria-label^="Remove "]').length`)
  const options = () => q(`[...q.root().querySelectorAll('li[role="option"]')].length`)
  const ticks = () => q(`q.all('li[role="option"][aria-selected="true"]').length`)
  const tickOption = (n) => q(`q.root().querySelectorAll('li[role="option"]')[${n}].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))`)
  const footer = (text) => q(`(()=>{const b=[...q.root().querySelectorAll('li[role="presentation"] button')].find(b=>q.norm(b.textContent).startsWith(${JSON.stringify(text)}));if(!b)return null;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));return 1})()`)
  const openPicker = async (search) => {
    await q(`(()=>{const i=q.label('Add column');i.focus();i.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));return 1})()`)
    await sleep(200)
    await q(`q.type(q.label('Add column'),${JSON.stringify(search)})`)
    await sleep(300)
  }
  await pick("Tick several, across searches, then Add puts them all in", async () => {
    const before = await chips()
    await openPicker("address1")
    const first = await options()
    ok(first >= 3, `only ${first} columns match "address1"`)
    await tickOption(0)
    await sleep(150)
    await tickOption(1)
    await sleep(200)
    eq(await chips(), before, "columns before Add")
    eq(await ticks(), 2, "ticked")
    eq(await q(`q.label('Add column').value`), "address1", "the search is kept")
    await q(`q.type(q.label('Add column'),'revenue')`)
    await sleep(300)
    await tickOption(0)
    await sleep(200)
    eq(await q(`q.norm(q.root().querySelector('[data-add-ticked]').textContent)`), "Add 3", "ticks across searches")
    await footer("Add")
    await sleep(300)
    eq(await chips(), before + 3, "columns after Add")
    eq(await options(), 0, "Add closes the list")
  })
  await pick("Esc cancels the ticks and closes only the list", async () => {
    const before = await chips()
    await openPicker("address2")
    await tickOption(0)
    await sleep(200)
    eq(await ticks(), 1, "ticked")
    await ed.closeList()
    await sleep(250)
    eq(await options(), 0, "options after Esc")
    eq(await chips(), before, "Esc adds nothing")
    ok(await q(`!!q.dialog()`), "Esc in the list shouldn't minimise the builder")
  })

  // ---- 006's checklist ----------------------------------------------------------------
  const t = run.area("ce-sql")
  let builderRows
  await t("Builder → SQL: the builder's query as SQL finds the same rows as FetchXML", async () => {
    await q(`q.type(q.dialog().querySelector('input[type=number]'),'20')`)
    // Add closes the column list: no Esc, which would minimise the builder
    await q(`q.pick(q.label('Add column'),'name')`)
    builderRows = await q(`q.run()`)
    ok(!builderRows.error, `builder: ${builderRows.error}`)
    await toMode("SQL")
    await until(async () => /SELECT[\s\S]*FROM\s+account/i.test(await ed.text()), { what: "the query as SQL" })
    const r = await q(`q.run()`)
    ok(!r.error, `SQL: ${String(r.error).slice(0, 200)}`)
    // The same rows; only the builder says there are more, since TOP asked for exactly these
    match(await ed.text(), /SELECT[\s\S]*TOP 20/, "the builder's Rows, in the SQL")
    eq(r.rows, builderRows.rows, "rows")
    return r.status
  }, { timeout: 150000 })
  await t("TOP wins over the builder's Rows, either way", async () => {
    const under = await sql("SELECT TOP 10 name FROM account")
    eq(under.rows, 10, "TOP 10, with Rows at 20")
    ok(!/more match|\+/.test(under.status.split(" · ")[0]), `a TOP isn't "more match": ${under.status}`)
    const over = await sql("SELECT TOP 30 name FROM account")
    eq(over.rows, 30, "TOP 30, with Rows at 20")
    await toMode("Builder")
    await q(`q.type(q.dialog().querySelector('input[type=number]'),'')`)
    await toMode("SQL")
  }, { timeout: 150000 })
  await t("A filter on a choice column runs", async () => {
    const r = await sql("SELECT name, statecode FROM account WHERE statecode = 0")
    ok(r.rows > 0, "no active accounts")
    return r.status
  })
  await t("A join", async () => {
    const r = await sql("SELECT TOP 5 a.name, c.fullname FROM account a INNER JOIN contact c ON c.parentcustomerid = a.accountid")
    return r.status || "no rows"
  })
  await t("An aliased column shows its alias and its source", async () => {
    const r = await sql("SELECT TOP 2 a.name AS account_name FROM account a")
    ok(r.headers.some((h) => /account_name/.test(h)), `columns: ${r.headers}`)
    return r.headers.join(", ")
  })
  await t("The row limit stops at 500 and says more match", async () => {
    const r = await sql("SELECT contactid FROM contact")
    if (r.rows < 500) return `fewer than the limit on this org: ${r.status}`
    match(r.status, /^500\+ rows/, "the status")
    return r.status
  })
  await t("A choice column's label column (statecodename)", async () => {
    await ed.set("SELECT TOP 2 name, statecodename FROM account")
    const r = await q(`q.run()`)
    return r.error ? `Dataverse: ${String(r.error).slice(0, 100)}` : `accepted: ${r.status}`
  })
  await t("A write is refused", async () => {
    await ed.set("DELETE FROM account WHERE name = 'no-such-account-e2e'")
    ok((await ed.marked("error")) > 0, "not marked before running")
    const r = await q(`q.run()`)
    ok(r.error, `no error; ${r.status}`)
  })
  await t("More than one statement is refused before anything is sent", async () => {
    await ed.set("SELECT TOP 1 name FROM account; DELETE FROM account")
    const r = await q(`q.run()`)
    match(r.error, /One query at a time/, "error")
  })
  const SAVED = "E2E CE SQL query"
  const OTHER = "E2E CE SQL other table"
  await t("A saved SQL query on another table opens in SQL mode from inside the builder", async () => {
    await ed.set("SELECT TOP 2 fullname FROM contact")
    await q(`q.starts('Saved').click()`)
    await until(() => q(`!!q.root().querySelector('input[placeholder="Name this query"]')`), { what: "the name input" })
    await q(`q.type(q.root().querySelector('input[placeholder="Name this query"]'),${JSON.stringify(OTHER)})`)
    await sleep(100)
    await q(`[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent)==='Save').click()`)
    await until(async () => (await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>s.savedQueries||[])`)).some((s) => s.name === OTHER), { what: "it in storage" })
    // Somewhere else, so loading it has to change table
    await ed.set("SELECT TOP 1 name FROM account")
    await toMode("Builder")
    await until(() => q(`/account/i.test(q.label('Table').value||q.label('Table').placeholder)`), { what: "account", timeout: 15000 })
    await q(`(()=>{if(!q.root().querySelector('input[placeholder="Name this query"]'))q.starts('Saved').click();return 1})()`)
    await until(() => q(`q.root().textContent.includes(${JSON.stringify(OTHER)})`), { what: "the saved row" })
    await q(`[...q.root().querySelectorAll('li button,button')].find(x=>q.norm(x.textContent).startsWith(${JSON.stringify(OTHER)})).click()`)
    await until(() => q(`!!q.dialog().querySelector('.cm-content[aria-label="SQL"]')`), { what: "SQL mode", timeout: 30000 })
    // Long enough for the table to have finished opening
    await sleep(3000)
    ok(await q(`!!q.dialog().querySelector('.cm-content[aria-label="SQL"]')`), "it went back to the builder")
    match(await ed.text(), /fullname FROM contact/, "the query")
    await q(`(()=>{if(q.root().querySelector('input[placeholder="Name this query"]'))q.starts('Saved').click();return 1})()`)
    await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>chrome.storage.local.set({savedQueries:(s.savedQueries||[]).filter(x=>x.name!==${JSON.stringify(OTHER)})}))`)
  }, { timeout: 120000 })
  await t("Save a SQL query, reopen it from the panel: SQL mode, and it runs", async () => {
    await ed.set("SELECT TOP 3 name FROM account")
    await q(`q.starts('Saved').click()`)
    await until(() => q(`!!q.root().querySelector('input[placeholder="Name this query"]')`), { what: "the name input" })
    await q(`q.type(q.root().querySelector('input[placeholder="Name this query"]'),${JSON.stringify(SAVED)})`)
    await sleep(100)
    await q(`[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent)==='Save').click()`)
    await until(async () => (await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>s.savedQueries||[])`)).some((s) => s.name === SAVED), { what: "it in storage" })
    await q(`(()=>{if(q.root().querySelector('input[placeholder="Name this query"]'))q.starts('Saved').click();return 1})()`)
    await closeBuilder(b, tab)
    await panelOnCe(p, tab)
    await p.clickTab("Tools")
    await until(() => p.run(`e.all('button').some(x=>x.title&&x.title.includes(${JSON.stringify(SAVED)}))`), { what: "the saved row", timeout: 8000 })
    await p.run(`(()=>{e.all('button').find(x=>x.title&&x.title.includes(${JSON.stringify(SAVED)})).click();return 1})()`)
    await until(() => q(`q.open()&&!!q.dialog().querySelector('.cm-content[aria-label="SQL"]')`), { what: "SQL mode", timeout: 30000 })
    const r = await until(async () => {
      const v = await q(`q.result()`)
      return v.status || v.error ? v : null
    }, { what: "it to run", timeout: 30000 })
    ok(!r.error, `error: ${r.error}`)
  }, { timeout: 120000 })

  // ---- SQL suggestions, by typing --------------------------------------------------------
  const s = run.area("ce-sql-suggestions")
  await s("Tables after FROM, from this org", async () => {
    await ed.set("SELECT name FROM acc")
    await ed.suggested((l) => labels(l).includes("account"), "account")
    match(await ed.accept(), /FROM account/, "the editor")
  })
  await s("Columns of the table", async () => {
    await ed.set("SELECT  FROM account")
    await ed.left(" FROM account".length)
    const list = await ed.suggested((l) => labels(l).includes("accountid"), "accountid")
    await ed.type("na")
    const narrowed = await ed.suggested((l) => labels(l).includes("name"), "name")
    ok(narrowed.length < list.length, "typing should narrow it")
    await ed.closeList()
  })
  await s("A table's columns after its alias and a dot", async () => {
    await ed.set("SELECT a. FROM account a")
    await ed.left(" FROM account a".length)
    await ed.suggested((l) => l.length > 0, "the table's columns")
    await ed.type("na")
    await ed.suggested((l) => labels(l).includes("name"), "name")
    match(await ed.accept(), /SELECT a\.name FROM/, "the editor")
  })
  await s("After JOIN, related tables come first", async () => {
    await ed.set("SELECT a.name FROM account a INNER JOIN con")
    await ed.suggested((l) => labels(l).includes("contact"), "contact")
    await ed.closeList()
  })
  await s("After ON, the join condition from a real relationship, which runs", async () => {
    await ed.set("SELECT TOP 2 a.name FROM account a INNER JOIN contact c ON ")
    const list = await ed.suggested((l) => labels(l).some((x) => /=/.test(x)), "a join condition")
    const wanted = labels(list).findIndex((x) => /=/.test(x))
    for (let i = 0; i < wanted; i++) await ed.key("ArrowDown", "ArrowDown", 40)
    await ed.accept()
    const r = await q(`q.run()`)
    ok(!r.error, `the suggested join didn't run: ${String(r.error).slice(0, 200)}`)
    return labels(list)[wanted]
  })
  await s("A choice column's values after =", async () => {
    await ed.set("SELECT name FROM account WHERE statecode = ")
    const list = await ed.suggested((l) => l.some((x) => /^\d+$/.test(x.label)), "option values")
    ok(list.some((x) => /Active/i.test(x.detail)), `no Active in ${JSON.stringify(list.slice(0, 4))}`)
    await ed.closeList()
  })
  await s("Date functions in WHERE, aggregates in SELECT", async () => {
    await ed.set("SELECT name FROM account WHERE createdon > ")
    await ed.suggested((l) => labels(l).includes("DATEADD"), "DATEADD")
    await ed.closeList()
    await ed.set("SELECT  FROM account")
    await ed.left(" FROM account".length)
    await ed.type("CO")
    await ed.suggested((l) => labels(l).includes("COUNT"), "COUNT")
    await ed.closeList()
  })

  // ---- SQL checks ---------------------------------------------------------------------------
  const c = run.area("ce-sql-checks")
  for (const [name, text] of [
    ["SELECT * is flagged", "SELECT * FROM account"],
    ["A wrong column is flagged", "SELECT nosuchcolumn FROM account"],
    ["A wrong table is flagged", "SELECT name FROM nosuchtable"],
    ["A subquery is flagged", "SELECT name FROM account WHERE accountid IN (SELECT accountid FROM account)"],
    ["HAVING is flagged", "SELECT name FROM account GROUP BY name HAVING COUNT(*) > 1"],
    ["A function on a column is flagged", "SELECT name FROM account WHERE DATEADD(day, 1, createdon) > GETUTCDATE()"],
    ["Comparing two columns is flagged", "SELECT name FROM account WHERE name = accountnumber"],
  ])
    await c(name, async () => {
      await ed.set(text)
      ok((await ed.marked("error")) > 0, "nothing marked")
    })
  await c("A good query has nothing marked", async () => {
    await ed.set("SELECT TOP 5 name FROM account WHERE statecode = 0")
    eq(await ed.marked("error"), 0, "errors marked")
  })

  // ---- FetchXML suggestions and checks ----------------------------------------------------
  const f = run.area("ce-fetchxml-editor")
  await f("Switching to FetchXML starts from the query", async () => {
    await toMode("FetchXML")
    match(await ed.text(), /<fetch/, "the editor")
  })
  await f("Element names after <", async () => {
    await ed.set(`<fetch><entity name="account"><`)
    const list = await ed.suggested((l) => labels(l).some((x) => /attribute/.test(x)), "attribute")
    return labels(list).slice(0, 6).join(", ")
  })
  await f("Table names in entity name=", async () => {
    await ed.set(`<fetch><entity name="acc`)
    await ed.suggested((l) => labels(l).includes("account"), "account")
    await ed.closeList()
  })
  await f("Column names in attribute name=", async () => {
    await ed.set(`<fetch><entity name="account"><attribute name="na`)
    await ed.suggested((l) => labels(l).includes("name"), "name")
    await ed.closeList()
  })
  await f("A wrong column is flagged", async () => {
    await ed.set(`<fetch><entity name="account"><attribute name="nosuchcolumn" /></entity></fetch>`)
    ok((await ed.marked("error")) + (await ed.marked("warning")) > 0, "nothing marked")
  })
  await f("A good query has nothing marked, and runs", async () => {
    await ed.set(`<fetch top="3"><entity name="account"><attribute name="name" /></entity></fetch>`)
    eq(await ed.marked("error"), 0, "errors marked")
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
  })
  await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>chrome.storage.local.set({savedQueries:(s.savedQueries||[]).filter(x=>x.name!==${JSON.stringify(SAVED)})})).then(()=>1)`)
  await closeBuilder(b, tab)
  await b.closeTab(tab)
}
