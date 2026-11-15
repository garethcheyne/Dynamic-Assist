// Business Central: SQL mode. Business Central has no SQL of its own: this checks the
// suggestions come from the real environment, that what compiles really runs, and
// that it finds the same rows the builder finds for the same query. Read-only.
import fs from "node:fs"
import path from "node:path"
import { sleep, until } from "./lib/browser.mjs"
import { eq, match, ok } from "./lib/harness.mjs"
import { builderReady, closeBuilder, inBuilder, tooltipOf } from "./lib/builder.mjs"
import { editorOn } from "./lib/editor.mjs"
import { bcLoaded, bcUrl, panelOnBc } from "./bc-panel.mjs"

export async function bcSqlTests({ b, p, run, config, downloads }) {
  const tab = await b.openTab(bcUrl(config, "page=21"))
  await p.front(tab)
  await bcLoaded(b, tab)
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }, await b.session(tab))
  await b.send("Browser.grantPermissions", { origin: "https://businesscentral.dynamics.com", permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] })
  await panelOnBc(p, tab)
  await p.clickLabel("Query builder")
  await builderReady(b, tab)
  const q = (body, options) => inBuilder(b, tab, body, options)
  const ed = editorOn(b, tab)
  const toBuilder = async () => {
    await q(`q.button('Builder').click()`)
    await until(() => q(`!!q.label('Add column')`), { what: "the builder", timeout: 15000 })
  }
  const toSql = async () => {
    await q(`q.button('SQL').click()`)
    await until(() => q(`!!q.dialog().querySelector('.cm-content[aria-label="SQL"]')`), { what: "the SQL editor", timeout: 15000 })
  }
  /** Runs SQL and returns what came back; fails on an error */
  const sql = async (text) => {
    await ed.set(text)
    const r = await q(`q.run()`)
    ok(!r.error, `"${text}" gave: ${String(r.error).slice(0, 220)}`)
    return r
  }
  const refused = async (text, pattern) => {
    await ed.set(text)
    const r = await q(`q.run()`)
    match(r.error, pattern, `the error for "${text}"`)
    return String(r.error).slice(0, 120)
  }

  const tips = run.area("bc-builder-tooltips")
  await tips("Tooltip: shows in front of the builder", async () => {
    const seen = await tooltipOf(b, tab, "Builder")
    match(seen.text, /Pick a table, columns and filters/, "the tooltip")
    ok(seen.onTop, "the builder's window is drawn over the tooltip")
    ok(seen.height < 45, `a short tooltip wraps to several lines (${seen.height}px tall)`)
  })

  // ---- The field picker first: it stays in the builder ------------------------------
  const pick = run.area("bc-builder-pick-several")
  await q(`q.table('Customer')`)
  const chips = () => q(`q.all('[aria-label^="Remove "]').length`)
  const openPicker = async (search) => {
    await q(`(()=>{const i=q.label('Add column');i.focus();i.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));return 1})()`)
    await sleep(200)
    await q(`q.type(q.label('Add column'),${JSON.stringify(search)})`)
    await sleep(300)
  }
  const tickOption = (n) => q(`q.root().querySelectorAll('li[role="option"]')[${n}].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))`)
  const footer = (text) => q(`(()=>{const b=[...q.root().querySelectorAll('li[role="presentation"] button')].find(b=>q.norm(b.textContent).startsWith(${JSON.stringify(text)}));if(!b)return null;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));return 1})()`)
  const addLabel = () => q(`q.norm(q.root().querySelector('[data-add-ticked]')?.textContent??'')`)
  const ticks = () => q(`q.all('li[role="option"][aria-selected="true"]').length`)
  await pick("Ticking adds nothing until Add, and ticks are kept as the search changes", async () => {
    const before = await chips()
    await openPicker("bal")
    const shown = await q(`q.all('li[role="option"]').length`)
    ok(shown >= 3, `only ${shown} fields match "bal"`)
    await tickOption(0)
    await sleep(150)
    await tickOption(1)
    await sleep(200)
    eq(await chips(), before, "columns before Add")
    eq(await ticks(), 2, "ticked")
    eq(await addLabel(), "Add 2", "the Add button")
    eq(await q(`q.label('Add column').value`), "bal", "the search is kept")
    // Another search: the first two stay ticked
    await q(`q.type(q.label('Add column'),'name')`)
    await sleep(300)
    await tickOption(0)
    await sleep(200)
    eq(await addLabel(), "Add 3", "ticks across searches")
    await footer("Add")
    await sleep(300)
    eq(await chips(), before + 3, "columns after Add")
    ok(await q(`!q.root().querySelector('li[role="option"]')`), "Add closes the list")
  })
  await pick("Select all shown, then Esc: nothing is added", async () => {
    const before = await chips()
    await openPicker("code")
    const shown = await q(`q.all('li[role="option"]').length`)
    ok(shown >= 2, `only ${shown} fields match "code"`)
    ok(await footer("Select all shown"), "Select all shown")
    await sleep(200)
    eq(await ticks(), shown, "all shown ticked")
    ok(await footer("Untick shown"), "it becomes Untick shown")
    await sleep(200)
    eq(await ticks(), 0, "Untick shown unticks them")
    await footer("Select all shown")
    await sleep(150)
    await ed.closeList()
    await sleep(250)
    eq(await chips(), before, "Esc adds nothing")
    ok(await q(`!!q.dialog()`), "Esc in the list shouldn't minimise the builder")
  })
  await pick("Enter with nothing ticked adds the highlighted field and stays, Esc closes only the list", async () => {
    const before = await q(`q.all('[aria-label^="Remove "]').length`)
    const session = await b.session(tab)
    await q(`(()=>{window.focus();q.label('Add column').focus();return 1})()`)
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, session)
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, session)
    await sleep(250)
    eq(await q(`q.all('[aria-label^="Remove "]').length`), before + 1, "columns after Enter")
    ok(await q(`!!q.root().querySelector('li[role="option"]')`), "the list closed on Enter")
    await ed.closeList()
    await sleep(250)
    ok(await q(`!q.root().querySelector('li[role="option"]')`), "Esc should close the list")
    ok(await q(`!!q.dialog()`), "Esc in the list shouldn't minimise the builder")
    const r = await q(`q.run()`)
    ok(!r.error, `error with the picked columns: ${r.error}`)
  })
  await pick("The other pickers still close on a pick", async () => {
    await q(`q.table('Item')`)
    ok(await q(`!q.root().querySelector('li[role="option"]')`), "the table list stayed open")
    await q(`q.table('Customer')`)
  })

  // ---- Modes ----------------------------------------------------------------------------
  const t = run.area("bc-sql")
  let builderRows
  await t("The SQL tab shows a built query as SQL", async () => {
    await q(`q.table('Customer')`)
    builderRows = await q(`q.run()`)
    await q(`q.all('button').filter(x=>q.norm(x.textContent)==='SQL').at(-1).click()`)
    await until(() => q(`/FROM\\s+Customer/.test(q.dialog().querySelector('pre')?.textContent||'')`), { what: "the SQL", timeout: 5000 })
    match(await q(`(async()=>{await navigator.clipboard.writeText('mark');q.label('Copy SQL').click();await q.wait(400);return navigator.clipboard.readText()})()`), /^SELECT/, "copied SQL")
    await q(`q.button('Results').click()`)
  })
  await t("SQL mode starts from the builder's query, and says it's translated", async () => {
    await toSql()
    await until(async () => /SELECT[\s\S]*FROM\s+Customer/.test(await ed.text()), { what: "the query as SQL" })
    match(await q(`q.dialog().textContent`), /no SQL of its own/, "the note")
  })
  await t("The builder's own query, run as SQL, finds the same rows", async () => {
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${r.error}`)
    eq(r.status.split(" · ")[0], builderRows.status.split(" · ")[0], "row count")
    eq(JSON.stringify(r.cells[0]), JSON.stringify(builderRows.cells[0]), "first row")
    return r.status
  })

  // ---- Suggestions, by typing ------------------------------------------------------
  const s = run.area("bc-sql-suggestions")
  const labels = (list) => list.map((x) => x.label)
  await s("Tables after FROM, from this environment", async () => {
    await ed.set("SELECT Name FROM ")
    const all = await ed.suggested((l) => l.length > 50, "a long list of tables")
    await ed.type("Cust")
    const list = await ed.suggested((l) => labels(l).includes("Customer"), "Customer")
    match(list[0].label, /^\[?Cust/, "the best match, first")
    await ed.closeList()
    return `${all.length} shown; after typing, first: ${labels(list).slice(0, 3).join(", ")}`
  })
  await s("Typing narrows it, and Enter puts it in, bracketed when it needs it", async () => {
    await ed.set("SELECT [No.] FROM Sales")
    await ed.suggested((l) => labels(l).includes("[Sales Header]"), "[Sales Header]")
    await ed.q(`(()=>{const li=[...q.root().querySelectorAll('.cm-tooltip-autocomplete li')].findIndex(x=>/^\\[Sales Header\\]/.test(q.norm(x.textContent)));window.__pick=li;return li})()`)
    const index = await q(`window.__pick`)
    for (let i = 0; i < index; i++) await ed.key("ArrowDown", "ArrowDown", 40)
    match(await ed.accept(), /FROM \[Sales Header\]/, "the editor")
  })
  await s("Fields of the table, with their kind", async () => {
    await ed.set("SELECT  FROM Customer")
    await ed.left(" FROM Customer".length)
    const list = await ed.suggested((l) => labels(l).some((x) => /Balance/.test(x)), "the Balance FlowField")
    const address = labels(list).findIndex((x) => x === "Address")
    ok(address >= 0 && labels(list)[address + 1] === "[Address 2]", `Address and [Address 2] should sit together: ${labels(list).slice(0, 8)}`)
    await ed.type("[No")
    await ed.suggested((l) => labels(l).includes("[No.]"), "[No.]")
    await ed.closeList()
    await ed.set("SELECT Na FROM Customer")
    await ed.left(" FROM Customer".length)
    await ed.suggested((l) => labels(l).includes("Name"), "Name")
    await ed.closeList()
  })
  await s("Functions that fit SELECT", async () => {
    await ed.set("SELECT  FROM Customer")
    await ed.left(" FROM Customer".length)
    await ed.type("CO")
    await ed.suggested((l) => labels(l).includes("COUNT"), "COUNT")
    await ed.closeList()
  })
  await s("A table's fields after its alias and a dot", async () => {
    await ed.set("SELECT c. FROM Customer c")
    await ed.left(" FROM Customer c".length)
    const list = await ed.suggested((l) => l.length > 0, "the table's fields")
    ok(!labels(list).some((x) => /^c\./.test(x)), "shouldn't repeat the alias")
    await ed.type("Na")
    await ed.suggested((l) => labels(l).includes("Name"), "Name")
    match(await ed.accept(), /SELECT c\.Name FROM/, "the editor")
  })
  await s("After JOIN, the tables Customer looks up come first", async () => {
    await ed.set("SELECT c.Name FROM Customer c LEFT JOIN Sales")
    const list = await ed.suggested((l) => labels(l).some((x) => /Salesperson/.test(x)), "Salesperson/Purchaser")
    return labels(list).slice(0, 3).join(", ")
  })
  await s("After ON, the join condition from the real lookup", async () => {
    await ed.set("SELECT c.Name FROM Customer c LEFT JOIN [Salesperson/Purchaser] s ON ")
    const list = await ed.suggested((l) => labels(l).some((x) => /Salesperson Code.*= s\.Code/.test(x)), "the join condition")
    const wanted = labels(list).findIndex((x) => /Salesperson Code.*= s\.Code/.test(x))
    for (let i = 0; i < wanted; i++) await ed.key("ArrowDown", "ArrowDown", 40)
    match(await ed.accept(), /ON c\.\[Salesperson Code\] = s\.Code/, "the editor")
    const r = await q(`q.run()`)
    ok(!r.error, `the accepted join didn't run: ${String(r.error).slice(0, 200)}`)
  })
  await s("An option field's values after =, which then run", async () => {
    await ed.set("SELECT [No.] FROM [Sales Header] WHERE [Document Type] = ")
    const list = await ed.suggested((l) => labels(l).includes("'Order'"), "'Order'")
    const wanted = labels(list).indexOf("'Order'")
    for (let i = 0; i < wanted; i++) await ed.key("ArrowDown", "ArrowDown", 40)
    match(await ed.accept(), /= 'Order'/, "the editor")
    const r = await q(`q.run()`)
    ok(!r.error, `error: ${String(r.error).slice(0, 200)}`)
  })
  await s("Date functions as a value", async () => {
    await ed.set("SELECT [Entry No.] FROM [G/L Entry] WHERE [Posting Date] >= ")
    const list = await ed.suggested((l) => labels(l).includes("DATEADD"), "DATEADD")
    ok(labels(list).includes("TODAY"), "no TODAY")
    await ed.closeList()
  })
  await s("Functions and keywords that fit WHERE, and none that don't translate", async () => {
    for (const [typed, fn] of [["YE", "YEAR"], ["UPP", "UPPER"], ["TOD", "TODAY"], ["LIK", "LIKE"]]) {
      await ed.set(`SELECT Name FROM Customer WHERE ${typed}`)
      await ed.suggested((l) => labels(l).includes(fn), fn)
      await ed.closeList()
    }
    for (const [typed, not] of [["HAV", "HAVING"], ["UNI", "UNION"], ["SUBST", "SUBSTRING"]]) {
      await ed.set(`SELECT Name FROM Customer WHERE ${typed}`)
      await sleep(500)
      ok(!labels(await ed.suggestions()).includes(not), `offers ${not}, which can't translate`)
      await ed.closeList()
    }
  })

  // ---- It runs, and means what it says --------------------------------------------------
  const x = run.area("bc-sql-queries")
  const CASES = [
    ["TOP", "SELECT TOP 3 [No.], Name FROM Customer", (r) => match(r.status, /^3 rows? /, "rows")],
    ["= and a quoted value", "SELECT [No.] FROM [Sales Header] WHERE [Document Type] = 'Order'"],
    ["<> and IS NOT NULL", "SELECT TOP 5 [No.], City FROM Customer WHERE City IS NOT NULL AND [No.] <> 'nothing-like-this'"],
    ["LIKE ignores case", "SELECT TOP 5 [No.], Name FROM Customer WHERE Name LIKE '%a%'"],
    ["NOT LIKE", "SELECT TOP 5 [No.], Name FROM Customer WHERE Name NOT LIKE 'zzz%'"],
    ["BETWEEN on numbers", "SELECT TOP 5 [Entry No.] FROM [G/L Entry] WHERE [Entry No.] BETWEEN 1 AND 100000000"],
    ["IN", "SELECT [No.] FROM [Sales Header] WHERE [Document Type] IN ('Order', 'Invoice')"],
    ["OR on one field", "SELECT [No.] FROM [Sales Header] WHERE [Document Type] = 'Order' OR [Document Type] = 'Invoice'"],
    ["ORDER BY DESC", "SELECT TOP 5 [Entry No.] FROM [G/L Entry] ORDER BY [Entry No.] DESC", (r) => {
      const n = r.cells.map((c) => Number(c[1].replace(/,/g, "")))
      ok(n[0] >= n[1] && n[1] >= n[2], `not descending: ${n}`)
    }],
    ["a table by number", "SELECT TOP 2 [No.] FROM [18]"],
    ["a field by number", "SELECT TOP 2 [1], [2] FROM Customer"],
    ["SELECT *", "SELECT TOP 2 * FROM Customer", (r) => ok(r.headers.length > 10, `only ${r.headers.length} columns`)],
    ["a FlowField", "SELECT TOP 5 [No.], [Balance (LCY)] FROM Customer", (r) => ok(r.headers.some((h) => /Balance/.test(h)), `columns: ${r.headers}`)],
    ["TODAY()", "SELECT TOP 2 [Entry No.] FROM [G/L Entry] WHERE [Posting Date] <= TODAY()"],
    ["WORKDATE()", "SELECT TOP 2 [Entry No.] FROM [G/L Entry] WHERE [Posting Date] <= WORKDATE()"],
    ["DATEADD()", "SELECT TOP 2 [Entry No.] FROM [G/L Entry] WHERE [Posting Date] >= DATEADD(year, -100, TODAY())"],
    ["YEAR()", "SELECT TOP 2 [Entry No.] FROM [G/L Entry] WHERE YEAR([Posting Date]) = 2025"],
    ["UPPER()", "SELECT TOP 2 [No.] FROM Customer WHERE UPPER(Name) LIKE '%A%'"],
    ["LEFT JOIN through a lookup", "SELECT TOP 5 c.[No.], s.Name FROM Customer c LEFT JOIN [Salesperson/Purchaser] s ON c.[Salesperson Code] = s.Code", (r) => ok(r.headers.some((h) => h.includes("›")), `no joined column: ${r.headers}`)],
    ["INNER JOIN, with a filter on the joined table", "SELECT TOP 5 c.[No.], s.Name FROM Customer c INNER JOIN [Salesperson/Purchaser] s ON c.[Salesperson Code] = s.Code WHERE s.Code <> 'zzz'"],
  ]
  for (const [name, text, check] of CASES)
    await x(name, async () => {
      const r = await sql(text)
      check?.(r)
      return r.status || "no rows"
    })
  await x("A filter finds what the builder's same filter finds", async () => {
    await toBuilder()
    await q(`q.table('Customer')`)
    await q(`q.button('BC syntax').click()`)
    await q(`q.button('Filter').click()`)
    await sleep(200)
    await q(`q.pick(q.all('input[aria-label="Filter field"]').at(-1),'Name')`)
    await sleep(200)
    await q(`q.type(q.label('Filter'),'@*a*')`)
    const built = await q(`q.run()`)
    ok(!built.error, `builder: ${built.error}`)
    await q(`q.label('Remove filter').click()`)
    await q(`q.button('Conditions').click()`)
    await toSql()
    const written = await sql("SELECT [No.] FROM Customer WHERE Name LIKE '%a%'")
    eq(written.status.split(" · ")[0], built.status.split(" · ")[0], "rows found")
    return written.status
  }, { timeout: 150000 })

  // ---- Aggregates --------------------------------------------------------------------------
  const a = run.area("bc-sql-aggregates")
  await a("COUNT(*) agrees with the builder's Count all matches", async () => {
    const r = await sql("SELECT COUNT(*) AS n FROM Customer")
    eq(r.headers.at(-1), "n", "column")
    const counted = Number(r.cells[0].at(-1).replace(/,/g, ""))
    await toBuilder()
    await q(`q.table('Customer')`)
    await q(`[...q.dialog().querySelectorAll('label')].find(l=>/Count all matches/.test(l.textContent)).querySelector('input').click()`)
    await q(`q.run()`)
    const shown = Number((await q(`q.dialog().textContent.match(/([\\d,]+) records? match in all/)?.[1]`)).replace(/,/g, ""))
    await q(`[...q.dialog().querySelectorAll('label')].find(l=>/Count all matches/.test(l.textContent)).querySelector('input').click()`)
    await toSql()
    eq(counted, shown, "count")
    return String(counted)
  }, { timeout: 150000 })
  /** The rows of the query just run, whole: the grid only draws what's in view */
  const exported = async () => {
    const from = b.downloadsSeen.length
    await q(`q.button('JSON').click()`)
    const dl = await until(() => b.downloadsSeen[from], { what: "the export", timeout: 15000 })
    const file = await until(() => {
      const hit = fs.readdirSync(downloads).find((n) => n === dl.guid || n === dl.suggestedFilename)
      return hit && !hit.endsWith(".crdownload") ? path.join(downloads, hit) : null
    }, { what: "the file", timeout: 15000 })
    return JSON.parse(fs.readFileSync(file, "utf8"))
  }
  const number = (v) => Number(String(v).replace(/,/g, ""))
  const shown = (r, count) => r.cells[0].slice(-count).map(number)
  let customers
  await a("SUM, COUNT, MIN, MAX and AVG equal working them out by hand from the rows", async () => {
    const r = await sql("SELECT SUM([Credit Limit (LCY)]) AS total, COUNT(*) AS n, MIN([Credit Limit (LCY)]) AS lo, MAX([Credit Limit (LCY)]) AS hi, AVG([Credit Limit (LCY)]) AS mean FROM Customer")
    const [total, n, lo, hi, mean] = shown(r, 5)
    match(await q(`q.dialog().textContent`), /Worked out in your browser from [\d,]+ rows/, "the note")
    const plain = await sql("SELECT TOP 5000 [No.], City, [Credit Limit (LCY)] FROM Customer")
    ok(!/\+/.test(plain.status.split(" · ")[0]), `more customers than one query shows: ${plain.status}`)
    customers = await exported()
    const key = Object.keys(customers[0]).find((k) => /Credit Limit/.test(k))
    ok(key, `no credit limit in the export: ${Object.keys(customers[0])}`)
    const limits = customers.map((row) => number(row[key]))
    const added = limits.reduce((sum, v) => sum + v, 0)
    eq(n, limits.length, "COUNT(*)")
    ok(Math.abs(total - added) < 0.01, `SUM ${total}, by hand ${added}`)
    eq(lo, Math.min(...limits), "MIN")
    eq(hi, Math.max(...limits), "MAX")
    ok(Math.abs(mean - added / limits.length) < 0.01, `AVG ${mean}, by hand ${added / limits.length}`)
    return `${n} customers, total ${total}`
  }, { timeout: 150000 })
  await a("GROUP BY, sorted on a total, with TOP on the groups, equals counting by hand", async () => {
    const r = await sql("SELECT TOP 3 City, COUNT(*) AS n FROM Customer GROUP BY City ORDER BY n DESC")
    ok(r.rows <= 3, `${r.rows} groups`)
    const counts = r.cells.map((c) => number(c.at(-1)))
    ok(counts.every((v, i) => i === 0 || counts[i - 1] >= v), `not sorted: ${counts}`)
    ok(customers, "no rows from the test before")
    const key = Object.keys(customers[0]).find((k) => /City/.test(k))
    const byCity = new Map()
    for (const row of customers) byCity.set(row[key] ?? "", (byCity.get(row[key] ?? "") ?? 0) + 1)
    const expected = [...byCity.values()].sort((x, y) => y - x).slice(0, 3)
    eq(JSON.stringify(counts), JSON.stringify(expected), "the three biggest groups")
    return counts.join(", ")
  }, { timeout: 150000 })
  await a("An aggregate on a real G/L table, over several thousand rows", async () => {
    const r = await sql("SELECT [G/L Account No.], SUM(Amount) AS total FROM [G/L Entry] WHERE [Entry No.] BETWEEN 1 AND 6000 GROUP BY [G/L Account No.] ORDER BY total DESC")
    return `${r.status}; ${await q(`q.dialog().textContent.match(/Worked out in your browser from [\\d,]+ rows|only cover the first [\\d,]+ rows/)?.[0]||''`)}`
  }, { timeout: 200000 })

  // ---- Checks -------------------------------------------------------------------------------
  const c = run.area("bc-sql-checks")
  await c("A wrong field is marked in the editor as you type", async () => {
    await ed.set("SELECT NoSuchField FROM Customer")
    ok((await ed.marked("error")) > 0, "nothing marked")
  })
  await c("A correct query has nothing marked", async () => {
    await ed.set("SELECT [No.], Name FROM Customer WHERE City IS NOT NULL")
    eq(await ed.marked("error"), 0, "errors marked")
  })
  for (const [name, text, why] of [
    ["A write is refused", "DELETE FROM Customer", /Only SELECT/],
    ["An update is refused", "UPDATE Customer SET Name = 'x'", /Only SELECT/],
    ["A wrong table", "SELECT Name FROM NoSuchTable", /no table NoSuchTable/],
    ["A wrong field", "SELECT NoSuchField FROM Customer", /no field NoSuchField/],
    ["OR across two fields, and why", "SELECT Name FROM Customer WHERE City = 'A' OR Name = 'B'", /OR across different fields/],
    ["AND and OR without brackets", "SELECT Name FROM Customer WHERE City = 'A' AND Name = 'B' OR Name = 'C'", /without brackets/],
    ["Two fields compared", "SELECT Name FROM Customer WHERE City = Name", /comparing two fields/],
    ["Mixed sort directions", "SELECT Name FROM Customer ORDER BY City ASC, Name DESC", /one way/],
    ["A join that isn't a lookup", "SELECT c.Name FROM Customer c LEFT JOIN [Salesperson/Purchaser] s ON c.[Salesperson Code] = s.Name AND c.City = 'x'", /one condition/],
    ["A function that doesn't translate", "SELECT Name FROM Customer WHERE FOO(Name) = 1", /FOO\(\) can't be translated/],
    ["A subquery", "SELECT Name FROM Customer WHERE City IN (SELECT City FROM Customer)", /Subqueries/],
    ["A column left out of GROUP BY", "SELECT Name, COUNT(*) FROM Customer", /GROUP BY/],
  ])
    await c(name, () => refused(text, why))

  // ---- It joins up with the rest ------------------------------------------------------------
  const j = run.area("bc-sql-with-the-builder")
  await j("Running SQL updates the AL tab", async () => {
    await sql("SELECT TOP 3 [No.], Name FROM Customer WHERE City IS NOT NULL")
    await q(`q.all('button').filter(x=>q.norm(x.textContent)==='AL').at(-1).click()`)
    await until(() => q(`/City/.test(q.dialog().querySelector('pre')?.textContent||'')`), { what: "the filter in the AL", timeout: 5000 })
    await q(`q.button('Results').click()`)
  })
  await j("Another table: the builder moves to it", async () => {
    await sql("SELECT TOP 2 [No.] FROM Item")
    await until(() => q(`/Item/.test(q.label('Table').value||q.label('Table').placeholder)`), { what: "the table to change", timeout: 15000 })
  })
  await j("Back to Builder shows what the SQL compiled to", async () => {
    await sql("SELECT TOP 4 [No.], Name FROM Customer ORDER BY Name DESC")
    await toBuilder()
    await until(() => q(`/Customer/.test(q.label('Table').value||q.label('Table').placeholder)`), { what: "Customer", timeout: 15000 })
    eq(await q(`q.dialog().querySelector('input[type=number]').value`), "4", "Rows")
    ok(await q(`!!q.button('Descending')`), "the sort should be descending")
    ok(await q(`!!q.label('Remove sort field')`), "the sort field")
    await toSql()
    match(await ed.text(), /ORDER BY Name DESC/, "the SQL is kept as written")
  })
  await j("Back to Builder with an aggregate says it stays in SQL", async () => {
    await sql("SELECT COUNT(*) FROM Customer")
    await q(`q.button('Builder').click()`)
    await until(() => q(`/it doesn't add rows up/.test(q.dialog().textContent)`), { what: "the note", timeout: 8000 })
    await toSql()
  })
  const SAVED = "E2E SQL query"
  await j("Saved: a SQL query saves as written, and reopens in SQL mode", async () => {
    await ed.set("SELECT TOP 2 [No.], Name FROM Customer -- kept as written")
    await q(`q.starts('Saved').click()`)
    await until(() => q(`!!q.root().querySelector('input[placeholder="Name this query"]')`), { what: "the name input" })
    await q(`q.type(q.root().querySelector('input[placeholder="Name this query"]'),${JSON.stringify(SAVED)})`)
    await sleep(100)
    await q(`[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent)==='Save').click()`)
    await until(async () => (await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>s.savedQueries||[])`)).some((s) => s.name === SAVED && s.sql), { what: "it in storage, with its SQL" })
    await q(`(()=>{if(q.root().querySelector('input[placeholder="Name this query"]'))q.starts('Saved').click();return 1})()`)
    await ed.set("SELECT Name FROM Item")
    await q(`q.starts('Saved').click()`)
    await until(() => q(`q.root().textContent.includes(${JSON.stringify(SAVED)})`), { what: "the row" })
    await q(`[...q.root().querySelectorAll('button')].find(x=>q.norm(x.textContent).startsWith(${JSON.stringify(SAVED)})).click()`)
    await until(async () => /kept as written/.test(await ed.text()), { what: "the SQL back as written", timeout: 8000 })
  })
  await j("From the panel, a saved SQL query opens in SQL mode and runs", async () => {
    await closeBuilder(b, tab)
    await panelOnBc(p, tab)
    await p.clickTab("Tools")
    await until(() => p.run(`e.all('button').some(x=>x.title&&x.title.includes(${JSON.stringify(SAVED)}))`), { what: "the saved row", timeout: 8000 })
    await p.run(`(()=>{e.all('button').find(x=>x.title&&x.title.includes(${JSON.stringify(SAVED)})).click();return 1})()`)
    await until(() => q(`q.open()&&!!q.dialog().querySelector('.cm-content[aria-label="SQL"]')`), { what: "SQL mode", timeout: 30000 })
    const r = await until(async () => {
      const v = await q(`q.result()`)
      return v.status || v.error ? v : null
    }, { what: "it to run", timeout: 30000 })
    ok(!r.error, `error: ${r.error}`)
    match(r.status, /^2 rows/, "rows")
  }, { timeout: 120000 })
  await j("Ctrl+Enter runs from the editor, and Esc in a suggestion list only closes it", async () => {
    await ed.set("SELECT TOP 1 [No.] FROM Cust")
    await ed.suggested((l) => labels(l).includes("Customer"), "Customer")
    await ed.closeList()
    await sleep(200)
    ok(await q(`!!q.dialog()`), "Esc in the suggestions minimised the builder")
    await ed.set("SELECT TOP 1 [No.] FROM Customer")
    await ed.key("Enter", "Enter", 13, 2)
    await until(() => q(`/^1 row/.test(q.result().status)`), { what: "1 row", timeout: 15000 })
  })
  await b.inWorker(`chrome.storage.local.get('savedQueries').then(s=>chrome.storage.local.set({savedQueries:(s.savedQueries||[]).filter(x=>x.name!==${JSON.stringify(SAVED)})})).then(()=>1)`)
  await closeBuilder(b, tab)
  await b.closeTab(tab)
}
