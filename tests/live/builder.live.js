// UI test of the Business Central query builder: drives the real modal on the
// "Dynamic Assist Query" page the way a person would (pick a table, columns,
// conditions or BC filters, joins, sort, rows, run) and checks what the grid
// shows. Run by tests/live/run.mjs. Prints pass/fail and counts only.
;(async () => {
  if (window !== window.top) return "skip"
  const root = () => document.getElementById("dynamic-assist-query")?.shadowRoot
  if (!root())
    return "The query builder isn't open: open page 77500 with the extension installed."

  // --- Driving the UI ------------------------------------------------------
  // Timers in a hidden tab (a minimised or covered browser window) fire as
  // rarely as once a minute; message-channel ticks aren't throttled, so the
  // suite runs as fast in the background as in front
  const wait = (ms) =>
    new Promise((resolve) => {
      const end = performance.now() + ms
      const { port1, port2 } = new MessageChannel()
      port1.onmessage = () =>
        performance.now() >= end ? resolve() : port2.postMessage(0)
      port2.postMessage(0)
    })
  async function until(test, ms = 20000) {
    const start = Date.now()
    while (Date.now() - start < ms) {
      const v = test()
      if (v) return v
      await wait(150)
    }
    return null
  }
  const all = (sel) => [...root().querySelectorAll(sel)]
  const one = (sel) => root().querySelector(sel)
  const button = (text, within = root()) =>
    [...within.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === text
    )
  const click = async (el) => {
    if (!el) throw new Error("nothing to click")
    el.click()
    await wait(200)
  }
  const type = (el, value) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }
  const choose = async (select, value) => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value"
    ).set.call(select, value)
    select.dispatchEvent(new Event("change", { bubbles: true }))
    await wait(200)
  }
  /** Picks from a search select: types, then clicks the option named exactly that (or the first) */
  const pick = async (input, text) => {
    if (!input) throw new Error(`no picker for "${text}"`)
    input.focus()
    // A background tab doesn't fire focus events: send the one React listens for
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    await wait(100)
    type(input, text)
    await wait(300)
    const options = all('li[role="option"]')
    const exact = options.find(
      (li) =>
        li.querySelector("span")?.textContent.trim().toLowerCase() ===
        text.toLowerCase()
    )
    const target = exact ?? options[0]
    if (!target) throw new Error(`nothing matches "${text}"`)
    target.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    )
    await wait(300)
  }
  const loaded = () =>
    until(
      () =>
        !root().textContent.includes("Loading fields") &&
        !root().textContent.includes("Loading columns") &&
        button("Run") &&
        !button("Run").disabled
    )

  async function table(name) {
    await pick(one('input[aria-label="Table"]'), name)
    await wait(300)
    await loaded()
    await wait(300)
  }
  async function run() {
    const runButton = button("Run")
    runButton.click()
    await until(() => runButton.disabled, 3000)
    await until(() => !runButton.disabled, 60000)
    await wait(300)
    return grid()
  }
  function grid() {
    const headers = all("thead th")
      .slice(1)
      .map((th) => th.textContent.trim())
    const rows = all("tbody tr").map((tr) =>
      [...tr.children].slice(1).map((td) => td.textContent)
    )
    const status =
      all("span")
        .map((s) => s.textContent)
        .find((t) => /\d+ rows?.* · \d+ ms/.test(t)) ?? ""
    const error =
      all("div").find(
        (d) =>
          d.className.includes("text-destructive") &&
          d.className.includes("border")
      )?.textContent ?? null
    const col = (name) => headers.indexOf(name)
    return {
      headers,
      rows,
      status,
      error,
      col,
      values: (name) => rows.map((r) => r[col(name)]),
    }
  }
  const filterRows = () => all('input[aria-label="Filter field"]')
  const lastOf = (sel) => all(sel).at(-1)
  async function mode(which) {
    const label = which === "bc" ? "BC syntax" : "Conditions"
    const el = await until(() => button(label))
    if (!el) throw new Error(`no "${label}" switch`)
    await click(el)
  }
  /** Adds a filter on a field in the main Filters section, returns its index */
  async function addFilter(field) {
    await click(button("Filter"))
    const inputs = filterRows()
    const index = inputs.length - 1
    await pick(inputs[index], field)
    return index
  }
  async function condition(op, value, value2) {
    await choose(lastOf('select[aria-label="Operator"]'), op)
    if (value !== undefined) {
      const valueSelect = lastOf('select[aria-label="Value"]')
      const valueInput = lastOf(
        'input[aria-label="Value"], input[aria-label="From"]'
      )
      if (
        valueSelect &&
        (!valueInput ||
          valueSelect.compareDocumentPosition(valueInput) &
            Node.DOCUMENT_POSITION_PRECEDING)
      )
        await choose(valueSelect, value)
      else type(valueInput, value)
    }
    if (value2 !== undefined) type(lastOf('input[aria-label="To"]'), value2)
    await wait(200)
  }
  async function keyOnly() {
    await click(button("Key only"))
  }
  async function addColumn(name) {
    await pick(one('input[aria-label="Add column"]'), name)
  }

  // --- Checks ------------------------------------------------------------------
  const results = []
  const check = (area, name, pass, detail = "") =>
    results.push({
      area,
      name,
      pass: !!pass,
      detail: String(detail).slice(0, 160),
    })
  async function step(area, name, body) {
    try {
      const r = await body()
      if (r === true) check(area, name, true)
      else if (typeof r === "string") check(area, name, false, r)
      else check(area, name, r.pass, r.detail)
    } catch (e) {
      check(area, name, false, "threw: " + (e?.message ?? e))
    }
  }
  const ok = (pass, detail) => ({ pass, detail })

  await loaded()

  // 1. Tables and columns
  await step("ui-basics", "Vendor: switch table and run", async () => {
    await table("Vendor")
    const g = await run()
    return ok(
      !g.error && g.rows.length > 0 && g.headers.includes("No."),
      g.error ?? `${g.rows.length} rows, ${g.headers.length} columns`
    )
  })
  await step("ui-basics", "Customer: key only", async () => {
    await table("Customer")
    await keyOnly()
    const g = await run()
    return ok(
      !g.error && g.headers.length === 1 && g.headers[0] === "No.",
      g.error ?? g.headers.join(", ")
    )
  })
  await step("ui-basics", "add a column by searching for it", async () => {
    await addColumn("City")
    const g = await run()
    return ok(g.headers.includes("City"), g.headers.join(", "))
  })

  // 2. Conditions
  await step("ui-conditions", "switch to conditions", async () => {
    await mode("conditions")
    return true
  })
  let someNo = ""
  let someName = ""
  await step("ui-conditions", "has a value (No.)", async () => {
    await table("Customer")
    await addFilter("No.")
    await condition("notEmpty")
    const g = await run()
    someNo = g.values("No.")[0] ?? ""
    someName = g.values("Name").find((n) => /[a-z]{4}/i.test(n)) ?? ""
    return ok(!g.error && g.rows.length > 0, g.error ?? `${g.rows.length} rows`)
  })
  await step("ui-conditions", "equals: one customer by No.", async () => {
    await condition("eq", someNo)
    const g = await run()
    return ok(
      g.rows.length === 1 && g.values("No.")[0] === someNo,
      g.error ?? `${g.rows.length} rows`
    )
  })
  await step("ui-conditions", "does not equal: everyone else", async () => {
    await condition("ne", someNo)
    const g = await run()
    return ok(
      !g.error && g.rows.length > 0 && !g.values("No.").includes(someNo),
      g.error ?? `${g.rows.length} rows`
    )
  })
  await step("ui-conditions", "contains (any case) on Name", async () => {
    await table("Customer")
    const part = someName.replace(/[^a-z]/gi, "").slice(1, 4)
    await addFilter("Name")
    await condition("contains", part.toLowerCase())
    const g = await run()
    const names = g.values("Name")
    return ok(
      !g.error &&
        names.length > 0 &&
        names.every((n) => n.toLowerCase().includes(part.toLowerCase())),
      g.error ?? `"${part.toLowerCase()}": ${names.length} rows`
    )
  })
  await step("ui-conditions", "begins with", async () => {
    const first = someName.slice(0, 3)
    await condition("begins", first)
    const g = await run()
    return ok(
      !g.error &&
        g
          .values("Name")
          .every((n) => n.toLowerCase().startsWith(first.toLowerCase())),
      g.error ?? `"${first}": ${g.rows.length} rows`
    )
  })
  await step(
    "ui-conditions",
    "greater than on a FlowField (Balance (LCY) > 0)",
    async () => {
      await table("Customer")
      await addColumn("Balance (LCY)")
      await addFilter("Balance (LCY)")
      await condition("gt", "0")
      const g = await run()
      const v = g.values("Balance (LCY)").map(Number)
      return ok(
        !g.error && v.every((x) => x > 0),
        g.error ?? `${v.length} rows`
      )
    }
  )
  await step(
    "ui-conditions",
    "date: on or after (Cust. Ledger Entry)",
    async () => {
      await table("Cust. Ledger Entry")
      await addFilter("Posting Date")
      await condition("ge", "2024-01-01")
      const g = await run()
      const dates = g.values("Posting Date")
      return ok(
        !g.error && dates.length > 0 && dates.every((d) => d >= "2024-01-01"),
        g.error ?? `${dates.length} rows`
      )
    }
  )
  await step("ui-conditions", "date: between", async () => {
    await condition("between", "2024-01-01", "2025-12-31")
    const g = await run()
    const dates = g.values("Posting Date")
    return ok(
      !g.error && dates.every((d) => d >= "2024-01-01" && d <= "2025-12-31"),
      g.error ?? `${dates.length} rows`
    )
  })
  await step("ui-conditions", "yes/no: open entries", async () => {
    await table("Cust. Ledger Entry")
    await addColumn("Open")
    await addFilter("Open")
    await condition("eq", "Yes")
    const g = await run()
    const v = g.values("Open")
    return ok(
      !g.error && v.length > 0 && v.every((x) => x === "Yes"),
      g.error ?? `${v.length} rows`
    )
  })
  await step(
    "ui-conditions",
    "option: Sales Header document type equals Order",
    async () => {
      await table("Sales Header")
      await addFilter("Document Type")
      await condition("eq", "Order")
      const g = await run()
      const v = g.values("Document Type")
      return ok(
        !g.error && v.length > 0 && v.every((x) => x === "Order"),
        g.error ?? `${v.length} rows`
      )
    }
  )
  await step("ui-conditions", "option: is any of Order, Invoice", async () => {
    await condition("in", "Order, Invoice")
    const g = await run()
    const v = g.values("Document Type")
    return ok(
      !g.error && v.every((x) => x === "Order" || x === "Invoice"),
      g.error ?? `${v.length} rows, ${[...new Set(v)].join("/")}`
    )
  })
  await step(
    "ui-conditions",
    "an incomplete condition is left out",
    async () => {
      await table("Customer")
      await addFilter("Balance (LCY)")
      await condition("gt", "not a number")
      const note = all("p").some((p) => p.textContent.includes("Incomplete"))
      const g = await run()
      return ok(
        note && !g.error && g.rows.length > 0,
        g.error ?? `note shown: ${note}, ${g.rows.length} rows`
      )
    }
  )

  // 3. Switching between conditions and BC syntax
  await step("ui-modes", "a condition shows as its BC filter", async () => {
    await table("Customer")
    await addFilter("Name")
    await condition("contains", "art")
    await mode("bc")
    const raw = lastOf('input[aria-label="Filter"]')?.value
    return ok(raw === "@*art*", raw)
  })
  await step(
    "ui-modes",
    "a BC range reads back as a between condition",
    async () => {
      await table("Customer")
      await addFilter("No.")
      type(lastOf('input[aria-label="Filter"]'), `${someNo}..${someNo}`)
      await mode("conditions")
      const op = lastOf('select[aria-label="Operator"]')?.value
      const from = lastOf('input[aria-label="From"]')?.value
      const g = await run()
      return ok(
        op === "between" && from === someNo && g.rows.length === 1,
        `operator ${op}, from ${from}, ${g.rows.length} rows`
      )
    }
  )
  await step(
    "ui-modes",
    "a BC filter no condition can say stays as written",
    async () => {
      await mode("bc")
      type(lastOf('input[aria-label="Filter"]'), "A*|B*")
      await mode("conditions")
      const kept = lastOf('input[aria-label="Filter"]')?.value
      const note = all("p").some((p) =>
        p.textContent.includes("stays as written")
      )
      const g = await run()
      return ok(
        kept === "A*|B*" && note && !g.error,
        g.error ?? `kept "${kept}", note ${note}`
      )
    }
  )
  await step("ui-modes", "a bad BC filter shows the error", async () => {
    await mode("bc")
    await table("Customer")
    await addFilter("Balance (LCY)")
    type(lastOf('input[aria-label="Filter"]'), "abc")
    const g = await run()
    return ok(g.error && /not valid/.test(g.error), g.error ?? "no error shown")
  })
  await step("ui-modes", "back to conditions", async () => {
    await mode("conditions")
    return true
  })

  // 4. Joins
  await step(
    "ui-joins",
    "join Salesperson through Salesperson Code",
    async () => {
      await table("Customer")
      await keyOnly()
      await pick(
        one('input[aria-label="Add related table"]'),
        "Salesperson Code"
      )
      await until(() => !root().textContent.includes("Loading fields…"))
      await wait(400)
      const g = await run()
      const header = g.headers.find((h) =>
        h.startsWith("Salesperson/Purchaser › ")
      )
      return ok(!g.error && header, g.error ?? g.headers.join(", "))
    }
  )
  await step(
    "ui-joins",
    "a condition on the related table keeps only matches",
    async () => {
      const before = grid().rows.length
      const card = all("div")
        .filter((d) => d.className.includes("bg-muted/30"))
        .at(-1)
      await click(button("Filter", card))
      await choose(lastOf('select[aria-label="Operator"]'), "notEmpty")
      const g = await run()
      const header = g.headers.find((h) =>
        h.startsWith("Salesperson/Purchaser › ")
      )
      const v = g.values(header)
      return ok(
        !g.error && v.every((x) => x !== ""),
        g.error ?? `${before} → ${v.length} rows, all with a salesperson`
      )
    }
  )
  await step(
    "ui-joins",
    "switching table clears joins and filters",
    async () => {
      await table("Vendor")
      const cards = all("div").filter((d) =>
        d.className.includes("bg-muted/30")
      ).length
      return ok(
        cards === 0 && filterRows().length === 0,
        `${cards} join cards, ${filterRows().length} filters`
      )
    }
  )

  // 5. Sort, rows, paging, count
  await step("ui-options", "sort by name, descending", async () => {
    await table("Customer")
    await pick(one('input[aria-label="Add sort field"]'), "Name")
    await click(button("Ascending"))
    const g = await run()
    const names = g.values("Name").filter(Boolean)
    const inversions = names.filter(
      (n, i) =>
        i > 0 &&
        names[i - 1].localeCompare(n, undefined, { sensitivity: "base" }) < 0
    ).length
    return ok(
      !g.error &&
        names.length > 5 &&
        inversions <= Math.ceil(names.length * 0.05),
      g.error ?? `${names.length} names, ${inversions} out of order`
    )
  })
  await step("ui-options", "rows: 5, then load more", async () => {
    await table("Customer")
    const rowsInput = one('input[type="number"]')
    type(rowsInput, "5")
    const g = await run()
    const moreText = g.status.includes("more match")
    const more = button("Load more rows")
    if (!more)
      return `5-row run: ${g.rows.length} rows, no Load more (${g.status})`
    await click(more)
    await until(() => grid().rows.length === 10, 20000)
    const g2 = grid()
    const unique = new Set(g2.values("No.")).size
    return ok(
      g.rows.length === 5 && moreText && g2.rows.length === 10 && unique === 10,
      `${g.rows.length} → ${g2.rows.length} rows, ${unique} unique`
    )
  })
  await step("ui-options", "count all matches", async () => {
    await click(one('input[type="checkbox"]'))
    await run()
    const counted = all("div")
      .map((d) => d.textContent)
      .find((t) => /^\d[\d,]* records? match in all$/.test(t.trim()))
    return ok(counted, counted ?? "no count shown")
  })

  // 6. The AL and API tabs follow the query
  await step("ui-tabs", "AL tab: record code and the API query", async () => {
    await table("Customer")
    await addFilter("No.")
    await condition("notEmpty")
    await click(button("AL"))
    const text = one("pre")?.textContent ?? ""
    await click(button("Results"))
    return ok(
      text.includes(`Rec.SetFilter("No.", '<>''''');`) &&
        text.includes("QueryType = API"),
      text.slice(0, 120)
    )
  })
  await step("ui-tabs", "API tab: endpoints and the request", async () => {
    await click(button("API"))
    const endpoints = all("button")
      .map((b) => b.textContent.trim())
      .filter((t) => /Microsoft|Dynamic Assist|Custom API query/.test(t))
    const url =
      all("code")
        .map((c) => c.textContent)
        .find((x) => x.startsWith("https://")) ?? ""
    await click(button("Results"))
    return ok(
      endpoints.includes("Custom API query") &&
        endpoints.some((e) => e.startsWith("Dynamic Assist")) &&
        url.includes("api.businesscentral.dynamics.com"),
      `${endpoints.length} endpoints`
    )
  })

  const failed = results.filter((r) => !r.pass)
  return {
    summary: `${results.length - failed.length}/${results.length} passed`,
    valueTypesChecked: {},
    failed,
    all: results.map(
      (r) => `${r.pass ? "PASS" : "FAIL"}  [${r.area}] ${r.name} — ${r.detail}`
    ),
  }
})()
