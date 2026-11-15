// Business Central: the query builder and the companion app's page, end to end.
// Running a query adds a row to the companion's own Query Log, as it does for anyone.
import fs from "node:fs"
import path from "node:path"
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { builderReady, closeBuilder, inBuilder } from "./lib/builder.mjs"
import { bcLoaded, bcUrl, CLIENT, panelOnBc } from "./bc-panel.mjs"

const LIVE = path.resolve(import.meta.dirname, "../live")

export async function bcBuilderTests({ b, p, run, config, downloads }) {
  const clientEval = (targetId, body) => b.evaluate(targetId, `(()=>{const w=${CLIENT};if(!w)return null;const d=w.document;return (${body})})()`)
  const q = (targetId, body, options) => inBuilder(b, targetId, body, options)

  // ---- Starting up -------------------------------------------------------------
  const start = run.area("bc-builder-start")
  const tab = await b.openTab(bcUrl(config, "page=21"))
  await p.front(tab)
  await bcLoaded(b, tab)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(tab))
  await b.send("Browser.grantPermissions", { origin: "https://businesscentral.dynamics.com", permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
  await panelOnBc(p, tab)
  const urlOf = async (id) => (await b.targets()).find((x) => x.targetId === id)?.url ?? ""

  // What the extension has written down about query pages: tab, up or loading, and
  // whether that tab is still open. No names: the results can be shared
  const channels = async () => {
    const records = await b.inWorker(`chrome.storage.session.get('bc:channels').then(s=>s['bc:channels']??{})`)
    const open = await b.inWorker(`chrome.tabs.query({}).then(ts=>ts.map(t=>t.id))`)
    return Object.entries(records).map(([id, c]) => `tab ${id} ${c.ready ? "up" : "loading"}${open.includes(Number(id)) ? "" : " (closed)"}`).join(", ") || "none"
  }
  await start("First run: loads the query page in this tab, no new tab", async () => {
    // With a query page open anywhere, the builder rightly uses it and stays on this page.
    // Its URL needn't say so (an older companion's dialog drops page=77500), so every
    // other Business Central tab goes
    const others = (await b.pages()).filter((x) => x.targetId !== tab && x.url.startsWith("https://businesscentral.dynamics.com/"))
    for (const x of others) await b.closeTab(x.targetId)
    if (others.length) await sleep(1500)
    const believed = await channels()
    await p.front(tab)
    const before = (await b.pages()).length
    await p.clickLabel("Query builder")
    await builderReady(b, tab)
    eq((await b.pages()).length, before, "open tabs")
    try {
      match(await urlOf(tab), /[?&]page=77500\b/, "URL")
    } catch (error) {
      throw new Error(`${error.message}; written down before: ${believed}; now: ${await channels()}`)
    }
    return others.length ? `closed ${others.length} Business Central tab(s) left open by earlier tests` : undefined
  }, { timeout: 200000 })
  await start("The URL keeps the page number once it's settled", async () => {
    await sleep(4000)
    match(await urlOf(tab), /[?&]page=77500\b/, "URL")
  })
  await start("It opens on the table of the page you came from", async () => {
    match(await q(tab, `q.label('Table').value||q.label('Table').placeholder`), /Customer/, "table")
  })
  await start("Back returns to the page you were on", async () => {
    await q(tab, `q.button('Back').click()`)
    await until(async () => /[?&]page=21\b/.test(await urlOf(tab)), { what: "page 21 again", timeout: 30000 })
    await bcLoaded(b, tab)
  })
  await start("Opened again after Back, it loads the query page here again, no new tab", async () => {
    // This tab is still written down as having the query page, though it has left it:
    // the builder has to ask, not believe the record
    await panelOnBc(p, tab)
    const before = (await b.pages()).length
    await p.clickLabel("Query builder")
    await builderReady(b, tab)
    eq((await b.pages()).length, before, "open tabs")
    try {
      match(await urlOf(tab), /[?&]page=77500\b/, "URL")
    } catch (error) {
      throw new Error(`${error.message}; written down: ${await channels()}`)
    }
    await closeBuilder(b, tab)
  }, { timeout: 200000 })

  // ---- The companion's page ------------------------------------------------------
  const page = run.area("bc-companion-page")
  const bridgeText = `(()=>{const walk=(x)=>{for(let i=0;i<x.frames.length;i++){try{const f=x.frames[i];const el=f.document.getElementById('da-status-title');if(el)return f.document.body.innerText;const r=walk(f);if(r)return r}catch{}}return ''};return walk(window)})()`
  const onQueryPage = async () => {
    // Back left this tab on the page it came from: the query page again, for real
    await b.send("Page.navigate", { url: bcUrl(config, "page=77500") }, await b.session(tab))
    await sleep(1000)
    await bcLoaded(b, tab, 60000)
    await until(() => q(tab, `q.open()`).catch(() => false), { what: "the builder to open over it", timeout: 60000 })
    await closeBuilder(b, tab)
  }
  await page("Says it's connected, and to keep the tab open", async () => {
    await onQueryPage()
    const text = await until(() => b.evaluate(tab, bridgeText), { what: "the companion page", timeout: 20000 })
    match(text, /Dynamic Assist is connected\. Keep this tab open\./, "banner")
  })
  await page("Shows your access, and the store links", async () => {
    const hrefs = await b.evaluate(tab, `(()=>{const walk=(x)=>{for(let i=0;i<x.frames.length;i++){try{const f=x.frames[i];if(f.document.getElementById('da-status-title'))return [...f.document.querySelectorAll('a.da-store')].map(a=>a.href);const r=walk(f);if(r)return r}catch{}}return null};return walk(window)})()`)
    ok(hrefs?.some((h) => h.includes("chromewebstore.google.com")), `Chrome link: ${hrefs}`)
    ok(hrefs?.some((h) => h.includes("microsoftedge.microsoft.com")), `Edge link: ${hrefs}`)
    await until(async () => /You have access/i.test(await b.evaluate(tab, bridgeText)), { what: "the access pill", timeout: 15000 })
  })
  t_skipStates(run.area("bc-builder-states"))

  // ---- From the panel ------------------------------------------------------------
  const panel = run.area("bc-builder-from-panel")
  const onTools = async () => {
    await panelOnBc(p, tab)
    await p.clickTab("Tools")
    await until(() => p.hasTile("Query builder"), { what: "the tile" })
  }
  const ran = async (id, timeout = 90000) => {
    try {
      return await until(async () => {
        const v = await q(id, `q.open()?q.result():null`)
        return v && (v.status || v.error || v.empty) ? v : null
      }, { what: "the query to run", timeout })
    } catch (error) {
      // What the builder shows instead is the useful part
      throw new Error(`${error.message}. Builder says: ${await q(id, `q.text()`).catch(() => "?")}`)
    }
  }

  const record = await b.openTab(bcUrl(config, "page=21"))
  await p.front(record)
  await bcLoaded(b, record)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(record))
  const onRecordTools = async () => {
    await panelOnBc(p, record)
    await p.clickTab("Tools")
    await until(() => p.hasTile("Query builder"), { what: "the tile" })
  }
  await panel("Query builder tile, from another tab, reuses the query page", async () => {
    await onRecordTools()
    const before = (await b.pages()).length
    await p.clickTile("Query builder")
    await builderReady(b, record)
    eq((await b.pages()).length, before, "open tabs")
    await closeBuilder(b, record)
  }, { timeout: 200000 })
  await panel("Query this table (Tools) runs straight away", async () => {
    await onRecordTools()
    await p.clickTile("Query this table")
    await builderReady(b, record)
    const r = await ran(record)
    ok(!r.error, `error: ${r.error}`)
    await closeBuilder(b, record)
    return r.status
  }, { timeout: 200000 })
  await panel("Query this table (Page tab icon) opens without running", async () => {
    await panelOnBc(p, record)
    await p.clickTab("Page")
    await p.clickLabel("Query this table")
    await builderReady(b, record)
    await sleep(1500)
    eq((await q(record, `q.result()`)).status, "", "status before Run")
    await closeBuilder(b, record)
  }, { timeout: 200000 })
  await panel("All fields shows the one record", async () => {
    await onRecordTools()
    await p.clickTile("All fields")
    await builderReady(b, record)
    const r = await ran(record)
    ok(!r.error, `error: ${r.error}`)
    match(r.status, /^1 row\b/, "row count")
    await closeBuilder(b, record)
  }, { timeout: 200000 })
  await panel("All fields includes the record's FlowFields, as its tile says", async () => {
    await onRecordTools()
    await p.clickTile("All fields")
    await builderReady(b, record)
    await ran(record)
    const r = await q(record, `q.result()`)
    await closeBuilder(b, record)
    // Balance is a FlowField on every customer
    ok(r.headers.some((h) => /^Balance/.test(h)), `columns: ${r.headers.slice(0, 40).join(", ")}`)
  }, { timeout: 200000 })
  for (const name of ["Customers with a balance", "Items low on stock", "Sales orders with customer details", "Latest G/L entries"])
    await panel(`Example runs: ${name}`, async () => {
      await onRecordTools()
      await p.openSection("Query")
      const clicked = await p.run(`(()=>{const x=e.all('button').find(b=>b.title&&b.title.includes(${JSON.stringify(name)}));if(!x)return false;x.click();return true})()`)
      ok(clicked, `no row for ${name}`)
      await builderReady(b, record)
      const started = Date.now()
      const r = await ran(record, 170000)
      const secs = ((Date.now() - started) / 1000).toFixed(1)
      ok(!r.error, `error after ${secs}s: ${String(r.error).slice(0, 200)}`)
      await closeBuilder(b, record)
      // An example is someone's first impression: it can't take minutes
      ok(Number(secs) < 30, `took ${secs}s: ${r.status}`)
      return `${r.status || "no rows"} in ${secs}s`
    }, { timeout: 280000 })

  const MISSING = "E2E missing table"
  await panel("A saved query on a table that isn't here says so, and doesn't run", async () => {
    const saved = { id: "e2e-missing", name: MISSING, savedAt: Date.now(), where: "elsewhere", table: "Gone (99998)", platform: "bc", query: { table: 99998, fields: [1], filters: [], sort: [], descending: false, top: null } }
    await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>chrome.storage.local.set({savedQueries:[...(s.savedQueries||[]),${JSON.stringify(saved)}]}))`)
    try {
      await onRecordTools()
      await p.openSection("Query")
      await until(() => p.run(`e.all('button').some(x=>x.title&&x.title.includes(${JSON.stringify(MISSING)}))`), { what: "the saved row", timeout: 8000 })
      await p.run(`(()=>{e.all('button').find(x=>x.title&&x.title.includes(${JSON.stringify(MISSING)})).click();return 1})()`)
      await builderReady(b, record)
      await until(() => q(record, `/Table 99998 isn't in this environment/.test(q.root().textContent)`), { what: "the message", timeout: 60000 })
      const r = await q(record, `q.result()`)
      eq(r.rows, 0, "rows from a query that shouldn't have run")
      await closeBuilder(b, record)
    } finally {
      await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>chrome.storage.local.set({savedQueries:(s.savedQueries||[]).filter(x=>x.id!=='e2e-missing')}))`)
    }
  }, { timeout: 200000 })

  // ---- The builder itself ----------------------------------------------------------
  const ui = run.area("bc-builder")
  await panelOnBc(p, tab)
  await p.clickLabel("Query builder")
  await builderReady(b, tab)
  await q(tab, `q.table('Customer')`)

  await ui("Run shows rows, status and a time", async () => {
    const r = await q(tab, `q.run()`)
    ok(!r.error, `error: ${r.error}`)
    match(r.status, /[\d,]+ rows? .*· [\d,]+ ms/, "status")
    ok(r.rows > 0, "no rows")
    return r.status
  })
  await ui("Ctrl+Enter runs", async () => {
    const before = await q(tab, `q.result().status`)
    const table = await q(tab, `q.label('Table').value||q.label('Table').placeholder`)
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'5')`)
    await q(tab, `(()=>{q.label('Table').focus();return 1})()`)
    await sleep(200)
    await q(tab, `(()=>{q.label('Table').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,composed:true}));return 1})()`)
    await until(() => q(tab, `/^5 rows/.test(q.result().status)`), { what: `5 rows after Ctrl+Enter (was ${before})`, timeout: 30000 })
    await q(tab, `(()=>{q.label('Table').blur();return 1})()`)
    await sleep(200)
    eq(await q(tab, `q.label('Table').value||q.label('Table').placeholder`), table, "the table")
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'')`)
  })
  await ui("Add a column, then remove it", async () => {
    await q(tab, `q.pick(q.label('Add column'),'Blocked')`)
    await until(() => q(tab, `!!q.label('Remove Blocked')`), { what: "the Blocked chip" })
    await q(tab, `q.label('Remove Blocked').click()`)
    await until(() => q(tab, `!q.label('Remove Blocked')`), { what: "the chip to go" })
  })
  await ui("All fields (n), then Key only", async () => {
    const before = await q(tab, `q.all('[aria-label^="Remove "]').length`)
    await q(tab, `q.starts('All fields').click()`)
    await until(async () => (await q(tab, `q.all('[aria-label^="Remove "]').length`)) > before, { what: "more columns" })
    await q(tab, `q.button('Key only').click()`)
    await until(() => q(tab, `/Primary key/.test(q.dialog().textContent)`), { what: "Primary key" })
    const r = await q(tab, `q.run()`)
    ok(!r.error, `error: ${r.error}`)
    await q(tab, `q.table('Customer')`)
  })
  await ui("Filter: a condition narrows the rows, and shows its BC syntax", async () => {
    await q(tab, `q.button('Filter').click()`)
    await sleep(200)
    await q(tab, `q.pick(q.all('input[aria-label="Filter field"]').at(-1),'No.')`)
    await sleep(200)
    await q(tab, `q.choose(q.all('select[aria-label="Operator"]').at(-1),'notEmpty')`)
    await sleep(200)
    const r = await q(tab, `q.run()`)
    ok(!r.error, `error: ${r.error}`)
    ok(r.rows > 0, "no rows")
  })
  await ui("Filter: BC syntax mode, and it's remembered", async () => {
    await q(tab, `q.button('BC syntax').click()`)
    await until(() => q(tab, `!!q.label('Filter')`), { what: "the Filter input" })
    await q(tab, `q.type(q.label('Filter'),'<>\\'\\'')`)
    const r = await q(tab, `q.run()`)
    ok(!r.error, `error: ${r.error}`)
    eq(await b.evaluate(tab, `localStorage.getItem('dynamic-assist.bc-filter-mode')`), "bc", "stored mode")
    await q(tab, `q.button('Conditions').click()`)
  })
  await ui("Filter: Remove filter", async () => {
    await q(tab, `q.label('Remove filter').click()`)
    await until(() => q(tab, `!q.label('Remove filter')`), { what: "the row to go" })
  })
  await ui("A bad filter shows an error, not rows", async () => {
    await q(tab, `q.button('BC syntax').click()`)
    await q(tab, `q.button('Filter').click()`)
    await sleep(200)
    await q(tab, `q.pick(q.all('input[aria-label="Filter field"]').at(-1),'Balance')`)
    await sleep(200)
    await q(tab, `q.type(q.label('Filter'),'not-a-number')`)
    const r = await q(tab, `q.run()`)
    ok(r.error, `no error shown; ${r.status}`)
    await q(tab, `q.label('Remove filter').click()`)
    await q(tab, `q.button('Conditions').click()`)
    return String(r.error).slice(0, 100)
  })
  await ui("Sort: add, flip, remove", async () => {
    await q(tab, `q.pick(q.label('Add sort field'),'Name')`)
    await until(() => q(tab, `!!q.button('Ascending')`), { what: "Ascending" })
    await q(tab, `q.button('Ascending').click()`)
    await until(() => q(tab, `!!q.button('Descending')`), { what: "Descending" })
    const r = await q(tab, `q.run()`)
    ok(!r.error, `error: ${r.error}`)
    await q(tab, `q.label('Remove sort field').click()`)
    await until(() => q(tab, `!q.label('Remove sort field')`), { what: "the sort to go" })
  })
  await ui("Rows limits the rows, and says more match", async () => {
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'3')`)
    const r = await q(tab, `q.run()`)
    match(r.status, /^3 rows \(more match/, "status")
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'')`)
  })
  await ui("Rows above 5,000 is capped", async () => {
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'99999')`)
    await sleep(150)
    ok(Number(await q(tab, `q.dialog().querySelector('input[type=number]').value`)) <= 5000, "not capped")
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'')`)
  })
  await ui("Count all matches", async () => {
    await q(tab, `[...q.dialog().querySelectorAll('label')].find(l=>/Count all matches/.test(l.textContent)).querySelector('input').click()`)
    await q(tab, `q.run()`)
    match(await q(tab, `q.dialog().textContent`), /\d[\d,]* records? match in all/, "count")
    await q(tab, `[...q.dialog().querySelectorAll('label')].find(l=>/Count all matches/.test(l.textContent)).querySelector('input').click()`)
  })
  await ui("Join: add, shows its columns, Only with a match, remove", async () => {
    await q(tab, `q.table('Customer')`)
    await q(tab, `q.pick(q.label('Add related table'),'Salesperson Code')`)
    await until(() => q(tab, `!!q.label('Remove related table')`), { what: "the join card" })
    const r = await q(tab, `q.run()`)
    ok(!r.error, `error: ${r.error}`)
    ok(r.headers.some((h) => h.includes("›")), `no joined column in ${r.headers.join(", ")}`)
    await q(tab, `[...q.dialog().querySelectorAll('label')].find(l=>/Only with a match/.test(l.textContent)).querySelector('input').click()`)
    const inner = await q(tab, `q.run()`)
    ok(!inner.error, `error with Only with a match: ${inner.error}`)
    await q(tab, `q.label('Remove related table').click()`)
    await until(() => q(tab, `!q.label('Remove related table')`), { what: "the join to go" })
  })
  await ui("AL tab shows code and copies it", async () => {
    await q(tab, `q.button('AL').click()`)
    await until(() => q(tab, `/Customer/.test(q.dialog().querySelector('pre')?.textContent||'')`), { what: "the AL" })
    const al = await q(tab, `(async()=>{await navigator.clipboard.writeText('mark');q.label('Copy AL').click();await q.wait(400);return navigator.clipboard.readText()})()`)
    match(al, /Customer/, "copied AL")
    await q(tab, `q.button('Results').click()`).catch(() => undefined)
  })
  await ui("API tab offers endpoints and copies one", async () => {
    await q(tab, `q.button('API').click()`)
    await until(() => q(tab, `/Dynamic Assist GET/.test(q.dialog().textContent)&&/Dynamic Assist POST/.test(q.dialog().textContent)&&/Custom API query/.test(q.dialog().textContent)`), { what: "the endpoints", timeout: 30000 })
    const url = await q(tab, `(async()=>{await navigator.clipboard.writeText('mark');q.label('Copy API').click();await q.wait(400);return navigator.clipboard.readText()})()`)
    ok(url !== "mark" && /http|api/i.test(url), `copied: ${url.slice(0, 80)}`)
    await q(tab, `q.button('Results').click()`).catch(() => undefined)
  })
  for (const [button, pattern, check] of [
    ["CSV", /\.csv$/, (text) => ok(text.split("\n").length > 1, "only a header")],
    ["JSON", /\.json$/, (text) => ok(JSON.parse(text).length > 0, "no rows")],
    ["Excel", /\.xlsx$/, (_text, bytes) => eq(bytes.subarray(0, 2).toString(), "PK", "xlsx signature")],
  ])
    await ui(`Export ${button} downloads the rows`, async () => {
      await q(tab, `q.run()`)
      const from = b.downloadsSeen.length
      await q(tab, `q.button(${JSON.stringify(button)}).click()`)
      const dl = await until(() => b.downloadsSeen[from], { what: "a download", timeout: 15000 })
      match(dl.suggestedFilename, pattern, "file name")
      const file = await until(() => {
        const names = fs.existsSync(downloads) ? fs.readdirSync(downloads) : []
        const hit = names.find((n) => n === dl.guid || n === dl.suggestedFilename)
        return hit && !hit.endsWith(".crdownload") ? path.join(downloads, hit) : null
      }, { what: "the file", timeout: 15000 })
      const bytes = fs.readFileSync(file)
      check(bytes.toString("utf8"), bytes)
      return dl.suggestedFilename
    })
  const SAVED = "E2E saved query"
  await ui("Saved: save, then it's listed and stored", async () => {
    await q(tab, `q.starts('Saved').click()`)
    await until(() => q(tab, `!!q.root().querySelector('input[placeholder="Name this query"]')`), { what: "the name input" })
    await q(tab, `q.type(q.root().querySelector('input[placeholder="Name this query"]'),${JSON.stringify(SAVED)})`)
    await sleep(100)
    await q(tab, `[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent)==='Save').click()`)
    await until(() => q(tab, `q.root().textContent.includes('Saved “'+${JSON.stringify(SAVED)}+'”')`), { what: "the saved message" })
    const stored = await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>s.savedQueries||[])`)
    ok(stored.some((x) => x.name === SAVED), "not in storage")
  })
  await ui("Saved: export then import it", async () => {
    const from = b.downloadsSeen.length
    await q(tab, `[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent)==='Export').click()`)
    const dl = await until(() => b.downloadsSeen[from], { what: "the export", timeout: 10000 })
    eq(dl.suggestedFilename, "dynamic-assist-queries.json", "file name")
    const json = await until(() => {
      const hit = fs.readdirSync(downloads).find((n) => n === dl.guid || n === dl.suggestedFilename)
      return hit && fs.readFileSync(path.join(downloads, hit), "utf8")
    }, { what: "the file" })
    const imported = await q(tab, `(async()=>{const input=q.root().querySelector('input[type=file]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(json)}],'q.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await q.wait(600);return q.root().textContent.match(/Imported \\d+ quer\\w+|Couldn't import[^.]*/)?.[0]||''})()`)
    match(imported, /Imported \d+ quer/, "import message")
  })
  await ui("Saved: an imported file that isn't queries is refused", async () => {
    const msg = await q(tab, `(async()=>{const input=q.root().querySelector('input[type=file]');const dt=new DataTransfer();dt.items.add(new File(['not json'],'bad.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await q.wait(600);return q.root().textContent.match(/Couldn't import/)?.[0]||''})()`)
    match(msg, /Couldn't import/, "message")
  })
  await ui("Saved: load it back", async () => {
    await q(tab, `q.table('Item')`)
    await q(tab, `(()=>{const s=q.starts('Saved');if(!q.root().querySelector('input[placeholder="Name this query"]'))s.click();return 1})()`)
    await until(() => q(tab, `q.root().textContent.includes(${JSON.stringify(SAVED)})`), { what: "the saved row" })
    await q(tab, `[...q.root().querySelectorAll('li button,button')].find(x=>q.norm(x.textContent).startsWith(${JSON.stringify(SAVED)})).click()`)
    await until(() => q(tab, `/Customer/.test(q.label('Table').value||q.label('Table').placeholder)`), { what: "Customer to load" })
  })
  await ui("Saved: delete takes two clicks", async () => {
    await q(tab, `(()=>{if(!q.root().querySelector('input[placeholder="Name this query"]'))q.starts('Saved').click();return 1})()`)
    await until(() => q(tab, `!!q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'?"]')`), { what: "the delete button" })
    await q(tab, `q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'?"]').click()`)
    await until(() => q(tab, `!!q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'"]')`), { what: "the confirm" })
    await q(tab, `q.root().querySelector('[aria-label="Delete '+${JSON.stringify(SAVED)}+'"]').click()`)
    await until(async () => {
      const stored = await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>s.savedQueries||[])`)
      return !stored.some((x) => x.name === SAVED)
    }, { what: "it to leave storage" })
    await q(tab, `(()=>{const s=q.starts('Saved');if(q.root().querySelector('input[placeholder="Name this query"]'))s.click();return 1})()`)
  })
  await ui("Read tables and fields again", async () => {
    await q(tab, `q.label('Read tables and fields again').click()`)
    await sleep(800)
    await builderReady(b, tab, { timeout: 90000 })
  })
  await ui("Minimise leaves a tile, which brings it back", async () => {
    await q(tab, `q.table('Customer')`)
    await q(tab, `q.run()`)
    await q(tab, `q.label('Minimise').click()`)
    await until(() => q(tab, `!q.dialog()&&!!q.root().querySelector('[role=list][aria-label="Minimised query builders"]')`), { what: "the tile" })
    const tile = await q(tab, `q.root().querySelector('[role=list][aria-label="Minimised query builders"]').textContent`)
    match(tile, /Customer.*rows/, "tile title")
    await q(tab, `q.root().querySelector('button[title="Bring it back"]').click()`)
    await until(() => q(tab, `!!q.dialog()`), { what: "the builder" })
    ok((await q(tab, `q.result()`)).rows > 0, "rows lost")
  })
  const keyboard = async () => {
    await p.front(tab)
    const keys = await b.session(tab)
    await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, keys)
    return keys
  }
  const press = async (keys, key, code, vk, modifiers = 0) => {
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }, keys)
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }, keys)
    await sleep(400)
  }
  const restoreFromTile = async () => {
    await until(() => q(tab, `!!q.root().querySelector('button[title="Bring it back"]')`), { what: "the tile" })
    await q(tab, `q.root().querySelector('button[title="Bring it back"]').click()`)
    await until(() => q(tab, `!!q.dialog()`), { what: "the builder" })
    await sleep(200)
  }
  await ui("Keyboard: it has focus as soon as it's back, and a real Esc minimises", async () => {
    const keys = await keyboard()
    await q(tab, `q.label('Minimise').click()`)
    await restoreFromTile()
    ok(await q(tab, `!!q.root().activeElement`), "nothing in the builder has focus")
    await press(keys, "Escape", "Escape", 27)
    ok(await q(tab, `!q.dialog()`), "a real Esc didn't minimise it")
    await restoreFromTile()
  })
  await ui("Keyboard: a real Ctrl+Enter runs, with no click first", async () => {
    const keys = await keyboard()
    const before = await q(tab, `q.result().status`)
    await q(tab, `(()=>{q.label('Minimise').click();return 1})()`)
    await restoreFromTile()
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'7')`)
    await q(tab, `(()=>{q.dialog().focus();return 1})()`)
    await press(keys, "Enter", "Enter", 13, 2)
    await until(() => q(tab, `/^7 rows/.test(q.result().status)`), { what: `7 rows (was: ${before})`, timeout: 15000 })
    await q(tab, `q.type(q.dialog().querySelector('input[type=number]'),'')`)
  })
  await ui("Keyboard: Esc in a picker closes its list, and the next Esc minimises", async () => {
    const keys = await keyboard()
    await q(tab, `(()=>{const i=q.label('Table');i.focus();i.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));return 1})()`)
    await sleep(300)
    await press(keys, "Escape", "Escape", 27)
    ok(await q(tab, `!!q.dialog()`), "the first Esc should only close the list")
    ok(await q(tab, `!!q.root().activeElement`), "focus fell out of the builder")
    await press(keys, "Escape", "Escape", 27)
    ok(await q(tab, `!q.dialog()`), "the second Esc didn't minimise it")
    await restoreFromTile()
  })
  await ui("A tile can be closed", async () => {
    await until(() => q(tab, `!!q.dialog()`), { what: "the builder" })
    await q(tab, `q.label('Minimise').click()`)
    await until(() => q(tab, `!!q.root().querySelector('button[title="Bring it back"]')`), { what: "the tile" })
    await q(tab, `q.root().querySelector('[role=list][aria-label="Minimised query builders"] [aria-label^="Close "]').click()`)
    await until(() => q(tab, `!q.root().querySelector('button[title="Bring it back"]')`), { what: "the tile to go" })
  })
  await ui("The split between query and results resizes, and is remembered", async () => {
    await panelOnBc(p, tab)
    await p.clickLabel("Query builder")
    await builderReady(b, tab, { timeout: 60000 })
    const sep = await q(tab, `(()=>{const s=q.label('Resize the query and results');return !!s})()`)
    ok(sep, "no separator")
    const before = await q(tab, `q.label('Resize the query and results').getAttribute('aria-valuenow')`)
    await q(tab, `(()=>{const s=q.label('Resize the query and results');s.focus();s.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,composed:true}));return 1})()`)
    await sleep(300)
    const after = await q(tab, `q.label('Resize the query and results').getAttribute('aria-valuenow')`)
    ok(after !== before, `the divider didn't move from ${before}`)
    const SPLIT = `Object.keys(localStorage).filter(k=>k.includes('dynamic-assist.split'))`
    await until(() => q(tab, `${SPLIT}.length>0`), { what: "the width to be remembered", timeout: 5000 })
    // Remembered on this site, so otherwise each run moves it further for the next
    await q(tab, `${SPLIT}.forEach(k=>localStorage.removeItem(k))`)
    return `${before} → ${after}`
  })
  await ui("Close removes it", async () => {
    await closeBuilder(b, tab)
    await until(() => q(tab, `!q.dialog()`), { what: "it to close" })
  })

  // ---- The query suites that already exist ------------------------------------------
  const engine = run.area("bc-query-engine")
  await p.front(tab)
  await onQueryPage()
  for (const [suite, needsBuilder] of [["companion", false], ["builder", true]]) {
    try {
      if (needsBuilder) {
        await panelOnBc(p, tab)
        await p.clickLabel("Query builder")
        await builderReady(b, tab, { timeout: 60000 })
      }
      const code = fs.readFileSync(path.join(LIVE, `${suite}.live.js`), "utf8")
      const r = await b.evaluate(tab, code, { timeout: 900000 })
      if (typeof r !== "object" || !r) {
        engine.record(`${suite} suite`, false, `didn't run: ${r}`)
        continue
      }
      for (const f of r.failed ?? []) engine.record(`${suite} / ${f.area}: ${f.name}`, false, String(f.detail ?? ""))
      engine.record(`${suite} suite`, !(r.failed ?? []).length, r.summary)
    } catch (error) {
      engine.record(`${suite} suite`, false, error.message)
    }
  }
  await b.closeTab(record)
  await b.closeTab(tab)
}

function t_skipStates(t) {
  t.skip("Companion missing state", "Needs an environment without the companion. Run by hand on one, or uninstall it first.")
  t.skip("You don't have permission to query", "Needs a user without DA QUERY.")
  t.skip("Table you can't read", "Needs a user without read permission on a table.")
  t.skip("Admin-center panel state", "Covered only by opening the admin center by hand: it isn't an environment page.")
}
