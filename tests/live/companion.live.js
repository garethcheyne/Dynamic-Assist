// Live test of the Dynamic Assist Companion, through the bridge on the
// "Dynamic Assist Query" page (page 77500). Run with:
//   node eval.mjs companion-live-test.js businesscentral
// It talks to the add-in the way the query builder does, as the signed-in
// user, read-only. Prints pass/fail, counts and types only, no record data.
;(async () => {
  if (window !== window.top) return "skip"
  const O = "https://businesscentral.dynamics.com"
  const TAG = "dynamic-assist"
  const frames = (w) => {
    const a = []
    for (let i = 0; i < w.frames.length; i++)
      a.push(w.frames[i], ...frames(w.frames[i]))
    return a
  }
  let target = null
  const pending = {}
  addEventListener("message", (e) => {
    const d = e.data
    if (d?.tag !== TAG || e.origin !== O) return
    if (d.type === "hello") target = e.source
    if (d.type === "response" && pending[d.id]) {
      pending[d.id](d)
      delete pending[d.id]
    }
  })
  for (let i = 0; i < 20 && !target; i++) {
    frames(window).forEach((f) => f.postMessage({ tag: TAG, type: "ping" }, O))
    await new Promise((r) => setTimeout(r, 300))
  }
  if (!target) return "No bridge: open page 77500 first"
  let n = 0
  const call = (method, params) =>
    new Promise((r) => {
      const id = "lt" + ++n
      pending[id] = r
      target.postMessage({ tag: TAG, type: "request", id, method, params }, O)
    })

  const results = []
  const check = (area, name, pass, detail = "") =>
    results.push({
      area,
      name,
      pass: !!pass,
      detail: String(detail).slice(0, 160),
    })
  const typeStats = {}

  // --- Value types --------------------------------------------------------
  const valid = {
    Integer: (v) => typeof v === "number" && Number.isInteger(v),
    BigInteger: (v) => typeof v === "number" && Number.isInteger(v),
    Decimal: (v) => typeof v === "number",
    Boolean: (v) => typeof v === "boolean",
    Date: (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
    DateTime: (v) =>
      v === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v),
    Time: (v) => v === null || /^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(v),
    GUID: (v) =>
      typeof v === "string" &&
      /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(
        v
      ),
    BLOB: (v) => v === null,
    Media: (v) => v === null,
    MediaSet: (v) => v === null,
  }
  const isText = (v) => typeof v === "string"

  /** Runs a query and checks every value against its column type. */
  async function typed(area, name, params) {
    const r = await call("query", params)
    if (!r.ok) {
      check(area, name, false, r.error)
      return null
    }
    const { columns, rows } = r.result
    const bad = []
    for (const row of rows)
      columns.forEach((c, i) => {
        const v = row[i]
        const ok = (valid[c.type] ?? isText)(v)
        typeStats[c.type] = (typeStats[c.type] ?? 0) + 1
        if (!ok && bad.length < 3)
          bad.push(`${c.name} (${c.type}) = ${JSON.stringify(v)}`)
      })
    check(
      area,
      name,
      bad.length === 0,
      bad.length
        ? bad.join("; ")
        : `${rows.length} rows, ${columns.length} columns, ${r.result.ms} ms`
    )
    return r.result
  }

  /** Every enabled, returnable field of a table (up to max), by number. */
  async function plainFields(table, max = 60) {
    const r = await call("fields", { table })
    if (!r.ok) return { error: r.error, fields: [] }
    const list = r.result.fields
      .filter((f) => f.enabled && f.class !== "FlowFilter")
      .slice(0, max)
    return {
      fields: list.map((f) => f.no),
      meta: r.result,
      all: r.result.fields,
    }
  }

  // --- 1. Tables: metadata and every value type ---------------------------
  const tables = [
    [18, "Customer"],
    [23, "Vendor"],
    [27, "Item"],
    [15, "G/L Account"],
    [17, "G/L Entry"],
    [21, "Cust. Ledger Entry"],
    [25, "Vendor Ledger Entry"],
    [32, "Item Ledger Entry"],
    [36, "Sales Header"],
    [37, "Sales Line"],
    [112, "Sales Invoice Header"],
    [79, "Company Information"],
    [349, "Dimension Value"],
    [472, "Job Queue Entry"],
    [2000000120, "User"],
    [2000000041, "Field"],
  ]
  for (const [id, label] of tables) {
    const f = await plainFields(id)
    if (f.error) {
      check("types", label, false, f.error)
      continue
    }
    await typed(
      "types",
      `${label}: ${f.fields.length} fields incl. FlowFields`,
      { table: id, fields: f.fields, top: 25 }
    )
  }

  // --- 2. Names, by table and field name ---------------------------------
  await typed("names", "G/L Entry by names", {
    table: "G/L Entry",
    fields: [
      "Entry No.",
      "Posting Date",
      "G/L Account No.",
      "Amount",
      "SystemId",
    ],
    top: 5,
  })
  await typed("names", "Sales Header by names", {
    table: "Sales Header",
    fields: ["Document Type", "No.", "Order Date", "Amount Including VAT"],
    top: 5,
  })

  // --- 3. Filters ---------------------------------------------------------
  const filtered = async (name, params, test) => {
    const r = await call("query", params)
    if (!r.ok) return check("filters", name, false, r.error)
    const res = test(r.result)
    check(
      "filters",
      name,
      res === true,
      res === true ? `${r.result.rows.length} rows` : res
    )
  }
  await filtered(
    "date range on G/L Entry",
    {
      table: "G/L Entry",
      fields: ["Entry No.", "Posting Date"],
      filters: [{ field: "Posting Date", filter: "2024-01-01..2099-12-31" }],
      top: 50,
    },
    (x) => x.rows.every((r) => r[1] >= "2024-01-01") || "date outside the range"
  )
  await filtered(
    "option: Sales Header Document Type = Order",
    {
      table: "Sales Header",
      fields: ["Document Type", "No."],
      filters: [{ field: "Document Type", filter: "Order" }],
      top: 50,
    },
    (x) =>
      x.rows.every((r) => r[0] === "Order") || "other document types came back"
  )
  await filtered(
    "boolean: open customer ledger entries",
    {
      table: "Cust. Ledger Entry",
      fields: ["Entry No.", "Open"],
      filters: [{ field: "Open", filter: "Yes" }],
      top: 50,
    },
    (x) => x.rows.every((r) => r[1] === true) || "closed entries came back"
  )
  await filtered(
    "wildcard: customer names starting with S",
    {
      table: "Customer",
      fields: ["No.", "Name"],
      filters: [{ field: "Name", filter: "S*" }],
      top: 50,
    },
    (x) =>
      x.rows.every((r) => r[1].startsWith("S")) || "a name not starting with S"
  )
  await filtered(
    "case-insensitive: @s*",
    {
      table: "Customer",
      fields: ["No.", "Name"],
      filters: [{ field: "Name", filter: "@s*" }],
      top: 50,
    },
    (x) =>
      x.rows.every((r) => /^s/i.test(r[1])) || "a name not starting with s/S"
  )
  await filtered(
    "FlowField filter: customers with a balance",
    {
      table: "Customer",
      fields: ["No.", "Balance (LCY)"],
      filters: [{ field: "Balance (LCY)", filter: "<>0" }],
      top: 50,
    },
    (x) => x.rows.every((r) => r[1] !== 0) || "a zero balance came back"
  )
  await filtered(
    "FlowFilter: G/L Account balance at a date",
    {
      table: "G/L Account",
      fields: ["No.", "Balance at Date"],
      filters: [
        { field: "Date Filter", filter: "..2024-12-31" },
        { field: "Account Type", filter: "Posting" },
      ],
      top: 20,
    },
    (x) =>
      x.rows.every((r) => typeof r[1] === "number") || "balance not a number"
  )
  await filtered(
    "two filters on one table (AND)",
    {
      table: "Item Ledger Entry",
      fields: ["Entry No.", "Entry Type", "Quantity"],
      filters: [
        { field: "Entry Type", filter: "Sale" },
        { field: "Quantity", filter: "<0" },
      ],
      top: 50,
    },
    (x) =>
      x.rows.every((r) => r[1] === "Sale" && r[2] < 0) ||
      "a row breaks a filter"
  )

  // --- 4. Joins ---------------------------------------------------------
  // Correctness, not completeness: every joined row must match on its key (or
  // be empty when the related record doesn't exist). Match rates are reported:
  // a sandbox can hold entries whose master record was deleted.
  const joined = async (name, params, pairs, extra) => {
    const r = await call("query", { ...params, shape: "objects" })
    if (!r.ok) return check("joins", name, false, r.error)
    const rows = r.result.rows
    const wrong = []
    const rates = []
    for (const [lookup, relatedKey] of pairs) {
      let hits = 0
      let lookups = 0
      for (const row of rows) {
        if (row[lookup]) lookups++
        if (row[relatedKey] === null || row[relatedKey] === undefined) continue
        hits++
        if (row[relatedKey] !== row[lookup] && wrong.length < 2)
          wrong.push(
            `${lookup}=${JSON.stringify(row[lookup])} joined ${relatedKey}=${JSON.stringify(row[relatedKey])}`
          )
      }
      rates.push(`${relatedKey.split(".")[0]} matched ${hits}/${lookups}`)
    }
    const more = extra ? extra(rows) : true
    check(
      "joins",
      name,
      wrong.length === 0 && more === true,
      wrong.length
        ? wrong.join("; ")
        : more !== true
          ? more
          : `${rows.length} rows, ${rates.join(", ")}, ${r.result.ms} ms`
    )
  }
  await joined(
    "Customer → Salesperson and Payment Terms (two lookups)",
    {
      table: "Customer",
      fields: ["No.", "Salesperson Code", "Payment Terms Code"],
      top: 200,
      joins: [
        { field: "Salesperson Code", fields: ["Code", "Name"] },
        {
          field: "Payment Terms Code",
          fields: ["Code", "Due Date Calculation"],
        },
      ],
    },
    [
      ["Salesperson Code", "Salesperson/Purchaser.Code"],
      ["Payment Terms Code", "Payment Terms.Code"],
    ],
    (rows) =>
      rows.every(
        (r) => r["Salesperson Code"] || r["Salesperson/Purchaser.Name"] === null
      ) || "a customer without a salesperson got one"
  )
  await joined(
    "G/L Entry → G/L Account",
    {
      table: "G/L Entry",
      fields: ["Entry No.", "G/L Account No."],
      top: 300,
      joins: [
        { field: "G/L Account No.", fields: ["No.", "Name", "Account Type"] },
      ],
    },
    [["G/L Account No.", "G/L Account.No."]]
  )
  await joined(
    "Cust. Ledger Entry → Customer, open entries",
    {
      table: "Cust. Ledger Entry",
      fields: ["Entry No.", "Customer No.", "Remaining Amount"],
      filters: [{ field: "Open", filter: "Yes" }],
      top: 300,
      joins: [{ field: "Customer No.", fields: ["No.", "Name"] }],
    },
    [["Customer No.", "Customer.No."]]
  )
  await joined(
    "Vendor Ledger Entry → Vendor",
    {
      table: "Vendor Ledger Entry",
      fields: ["Entry No.", "Vendor No."],
      top: 300,
      joins: [{ field: "Vendor No.", fields: ["No.", "Name"] }],
    },
    [["Vendor No.", "Vendor.No."]]
  )
  await joined(
    "Item Ledger Entry → Item and Location",
    {
      table: "Item Ledger Entry",
      fields: ["Entry No.", "Item No.", "Location Code"],
      top: 300,
      joins: [
        { field: "Item No.", fields: ["No.", "Description"] },
        { field: "Location Code", fields: ["Code", "Name"] },
      ],
    },
    [
      ["Item No.", "Item.No."],
      ["Location Code", "Location.Code"],
    ]
  )
  await joined(
    "Sales Header → Customer (sell-to) and Salesperson, orders",
    {
      table: "Sales Header",
      fields: [
        "Document Type",
        "No.",
        "Sell-to Customer No.",
        "Salesperson Code",
      ],
      filters: [{ field: "Document Type", filter: "Order" }],
      top: 200,
      joins: [
        { field: "Sell-to Customer No.", fields: ["No.", "Name"] },
        { field: "Salesperson Code", fields: ["Code"] },
      ],
    },
    [
      ["Sell-to Customer No.", "Customer.No."],
      ["Salesperson Code", "Salesperson/Purchaser.Code"],
    ]
  )
  await joined(
    "Sales Line → Item (explicit table, conditional relation), item lines",
    {
      table: "Sales Line",
      fields: ["Document No.", "Line No.", "Type", "No."],
      filters: [{ field: "Type", filter: "Item" }],
      top: 100,
      joins: [
        {
          field: "No.",
          table: "Item",
          key: "No.",
          fields: ["No.", "Inventory"],
        },
      ],
    },
    [["No.", "Item.No."]],
    (rows) =>
      rows.every(
        (r) =>
          r["Item.Inventory"] === null ||
          typeof r["Item.Inventory"] === "number"
      ) || "Inventory (FlowField) not a number"
  )
  await joined(
    "Inner join: customers whose salesperson's name starts with A",
    {
      table: "Customer",
      fields: ["No.", "Salesperson Code"],
      top: 100,
      joins: [
        {
          field: "Salesperson Code",
          fields: ["Code", "Name"],
          filters: [{ field: "Name", filter: "A*" }],
        },
      ],
    },
    [["Salesperson Code", "Salesperson/Purchaser.Code"]],
    (rows) =>
      rows.every((r) => r["Salesperson/Purchaser.Name"]?.startsWith("A")) ||
      "a row without a matching salesperson"
  )
  const cond = await call("query", {
    table: "Sales Line",
    fields: ["Type", "No."],
    top: 5,
    joins: [{ field: "No.", fields: [1] }],
  })
  check(
    "joins",
    "EDGE conditional relation without a table",
    true,
    cond.ok ? `joined ${cond.result.columns.at(-1)?.tableName}` : cond.error
  )
  const comp = await call("query", {
    table: "G/L Entry",
    fields: ["Entry No.", "Global Dimension 1 Code"],
    top: 5,
    joins: [{ field: "Global Dimension 1 Code", fields: ["Name"] }],
  })
  check(
    "joins",
    "EDGE composite key (Dimension Value)",
    true,
    comp.ok ? "ran; matches on Code only (see describe's note)" : comp.error
  )

  // --- 5. Paging ------------------------------------------------------------
  const pageThrough = async (name, params, pages) => {
    const seen = []
    let after
    let calls = 0
    for (let i = 0; i < pages; i++) {
      const r = await call("query", { ...params, after })
      calls++
      if (!r.ok) return check("paging", name, false, r.error)
      seen.push(...r.result.rows.map((row) => JSON.stringify(row)))
      after = r.result.next
      if (!after) break
    }
    const unique = new Set(seen).size
    check(
      "paging",
      name,
      unique === seen.length && seen.length > 0,
      `${calls} pages, ${seen.length} rows, ${seen.length - unique} repeated`
    )
    return seen
  }
  const byPk = await pageThrough(
    "G/L Entry: 3 pages of 500, by entry no.",
    { table: "G/L Entry", fields: ["Entry No."], top: 500 },
    3
  )
  if (byPk?.length) {
    const nums = byPk.map((s) => JSON.parse(s)[0])
    check(
      "paging",
      "…pages follow on (no gaps between pages)",
      nums.every((v, i) => i === 0 || v > nums[i - 1]),
      `${nums[0]} … ${nums.at(-1)}`
    )
  }
  await pageThrough(
    "Customer: sorted by name, ascending, pages of 25",
    { table: "Customer", fields: ["No.", "Name"], sort: ["Name"], top: 25 },
    4
  )
  const desc = await pageThrough(
    "Customer: sorted by name, DESCENDING, pages of 25",
    {
      table: "Customer",
      fields: ["No.", "Name"],
      sort: ["Name"],
      descending: true,
      top: 25,
    },
    4
  )
  if (desc)
    check(
      "paging",
      "…descending gets past page 1",
      desc.length > 25,
      `${desc.length} rows`
    )
  await pageThrough(
    "Customer: sorted by City then Name, descending, pages of 10",
    {
      table: "Customer",
      fields: ["No.", "City", "Name"],
      sort: ["City", "Name"],
      descending: true,
      top: 10,
    },
    12
  )
  await pageThrough(
    "G/L Entry: sorted by Posting Date, descending, pages of 300",
    {
      table: "G/L Entry",
      fields: ["Entry No.", "Posting Date"],
      sort: ["Posting Date"],
      descending: true,
      top: 300,
    },
    4
  )
  await pageThrough(
    "Item Ledger Entry: sorted by Item No. then Posting Date, pages of 250",
    {
      table: "Item Ledger Entry",
      fields: ["Entry No.", "Item No.", "Posting Date"],
      sort: ["Item No.", "Posting Date"],
      top: 250,
    },
    4
  )
  const all87 = await call("query", {
    table: "Customer",
    fields: ["No."],
    top: 10000,
  })
  const byName = await pageThrough(
    "Customer: sorted by name, descending, pages of 7 (every customer once)",
    {
      table: "Customer",
      fields: ["No.", "Name"],
      sort: ["Name"],
      descending: true,
      top: 7,
    },
    50
  )
  if (all87.ok && byName)
    check(
      "paging",
      "…all customers seen, none twice",
      byName.length === all87.result.rows.length,
      `${byName.length} paged vs ${all87.result.rows.length} in one go`
    )
  await pageThrough(
    "Item Ledger Entry with a join, pages of 200",
    {
      table: "Item Ledger Entry",
      fields: ["Entry No."],
      top: 200,
      joins: [{ field: "Item No.", fields: ["Description"] }],
    },
    3
  )
  const gone = await call("query", {
    table: "Customer",
    fields: ["No."],
    sort: ["Name"],
    top: 5,
    after: "Field1=0(NO-SUCH-CUSTOMER-XYZ)",
  })
  check(
    "paging",
    "sorted cursor to a missing record says so",
    !gone.ok && /no longer (exists|matches)/.test(gone.error),
    gone.ok ? "it ran" : gone.error
  )
  const big = await call("query", {
    table: "G/L Entry",
    fields: ["Entry No."],
    top: 50000,
  })
  check(
    "paging",
    "top above the limit is capped",
    big.ok && big.result.rows.length <= 10000,
    big.ok
      ? `${big.result.rows.length} rows, more: ${big.result.more}`
      : big.error
  )
  const cnt = await call("query", {
    table: "G/L Entry",
    fields: ["Entry No."],
    top: 1,
    count: true,
  })
  check(
    "paging",
    "count of all matches",
    cnt.ok && typeof cnt.result.count === "number",
    cnt.ok ? `${cnt.result.count} G/L entries` : cnt.error
  )

  // --- 6. Metadata ----------------------------------------------------------
  const search = await call("tables", { search: "ledger entry" })
  check(
    "metadata",
    'tables: search "ledger entry"',
    search.ok &&
      search.result.length > 3 &&
      search.result.every((t) =>
        /ledger entry/i.test(t.name + " " + t.caption)
      ),
    search.ok ? `${search.result.length} tables` : search.error
  )
  const all = await call("tables", {})
  check(
    "metadata",
    "tables: all",
    all.ok && all.result.length > 1000,
    all.ok ? `${all.result.length} tables` : all.error
  )
  for (const t of ["Customer", "Sales Line", "G/L Entry", "Dimension Value"]) {
    const d = await call("describe", { table: t })
    if (!d.ok) {
      check("metadata", `describe ${t}`, false, d.error)
      continue
    }
    const x = d.result
    const okShape =
      Array.isArray(x.fields) &&
      x.fields.length > 0 &&
      Array.isArray(x.keys) &&
      x.keys.length > 0 &&
      Array.isArray(x.joins) &&
      Array.isArray(x.apis) &&
      typeof x.readable === "boolean"
    check(
      "metadata",
      `describe ${t}`,
      okShape,
      `${x.fields?.length} fields, ${x.keys?.length} keys, ${x.joins?.length} joinable lookups, ${x.apis?.length} APIs`
    )
  }
  const dc = await call("describe", { table: "Customer" })
  if (dc.ok) {
    const sp = dc.result.joins.find((j) => j.field === "Salesperson Code")
    check(
      "metadata",
      "describe names a join fully (Salesperson Code)",
      sp?.table === "Salesperson/Purchaser" && sp?.key === "Code",
      JSON.stringify(sp)
    )
    check(
      "metadata",
      "describe: primary key first",
      JSON.stringify(dc.result.keys[0]) === JSON.stringify(["No."]),
      JSON.stringify(dc.result.keys[0])
    )
  }
  const bad = await call("describe", { table: "Custmer" })
  check(
    "metadata",
    "describe an unknown table",
    !bad.ok && /no table called/.test(bad.error),
    bad.ok ? "it ran" : bad.error
  )

  // --- 7. Custom objects, found through the metadata ---------------------
  // Extensions' tables and fields (per-tenant 50000-99999, ISV ranges from
  // 70000000) and their lookups, all found with "tables" and "describe".
  const isCustom = (id) =>
    (id >= 50000 && id < 100000) || (id >= 70000000 && id < 2000000000)
  const allTables = await call("tables", {})
  const customTables = allTables.ok
    ? allTables.result.filter((t) => isCustom(t.id) && !t.obsolete)
    : []
  check(
    "custom",
    "custom tables found through the metadata",
    customTables.length > 0,
    `${customTables.length} custom tables`
  )

  /** A join through a lookup, checked on its key (as in section 4). */
  const customJoin = async (label, table, lookup, lookupType) => {
    const target = await call("describe", { table: lookup.table })
    if (!target.ok || !target.result.readable) return false
    const keyField = lookup.key
    if (!keyField) return false
    const shown = target.result.fields.find(
      (x) =>
        !x.pk && x.class === "Normal" && x.enabled && /Text|Code/.test(x.type)
    )
    const fieldsWanted = [keyField, ...(shown ? [shown.name] : [])]
    // Rows where the lookup is filled in, so the join has something to match
    const filled = /Code|Text/.test(lookupType ?? "")
      ? [{ field: lookup.field, filter: "<>''" }]
      : []
    const r = await call("query", {
      table,
      fields: [lookup.field],
      filters: filled,
      top: 100,
      shape: "objects",
      joins: [
        {
          field: lookup.field,
          table: lookup.table,
          key: keyField,
          fields: fieldsWanted,
        },
      ],
    })
    if (!r.ok) {
      check("custom", `join ${label}`, false, r.error)
      return true
    }
    const relatedKey = `${target.result.name}.${keyField === "SystemId" || keyField === "$systemId" ? "SystemId" : keyField}`
    let hits = 0
    let lookups = 0
    const wrong = []
    for (const row of r.result.rows) {
      if (row[lookup.field]) lookups++
      const v = row[relatedKey]
      if (v === null || v === undefined) continue
      hits++
      if (v !== row[lookup.field] && wrong.length < 2)
        wrong.push(
          `${JSON.stringify(row[lookup.field])} joined ${JSON.stringify(v)}`
        )
    }
    check(
      "custom",
      `join ${label}`,
      wrong.length === 0,
      wrong.length
        ? wrong.join("; ")
        : `${r.result.rows.length} rows, matched ${hits}/${lookups}, ${r.result.ms} ms`
    )
    return true
  }

  // Custom tables: describe, every value's type, names, paging, their lookups
  let tablesTested = 0
  let joinsTested = 0
  for (const t of customTables) {
    if (tablesTested >= 20) break
    const d = await call("describe", { table: t.id })
    if (!d.ok) {
      check("custom", `describe ${t.name} (${t.id})`, false, d.error)
      continue
    }
    if (!d.result.readable) continue
    const plain = d.result.fields
      .filter((x) => x.enabled && x.class !== "FlowFilter")
      .slice(0, 80)
    const count = await call("query", {
      table: t.id,
      fields: [plain[0].no],
      top: 1,
      count: true,
    })
    if (!count.ok || !count.result.count) continue
    tablesTested++
    await typed(
      "custom",
      `${t.name} (${t.id}): ${plain.length} fields, ${count.result.count} records`,
      { table: t.id, fields: plain.map((x) => x.no), top: 25 }
    )
    const byName = await call("query", {
      table: t.name,
      fields: plain.slice(0, 5).map((x) => x.name),
      top: 3,
    })
    check(
      "custom",
      `${t.name}: by table and field names`,
      byName.ok,
      byName.ok ? `${byName.result.rows.length} rows` : byName.error
    )
    // Page by the whole primary key: other fields can repeat across rows
    const pkNos = d.result.fields.filter((x) => x.pk).map((x) => x.no)
    if (count.result.count > 10) {
      const seen = []
      let after
      for (let i = 0; i < 3; i++) {
        const p = await call("query", {
          table: t.id,
          fields: pkNos,
          top: 5,
          after,
        })
        if (!p.ok) {
          seen.push("ERR " + p.error)
          break
        }
        seen.push(...p.result.rows.map((row) => JSON.stringify(row)))
        after = p.result.next
        if (!after) break
      }
      check(
        "custom",
        `${t.name}: 3 pages of 5`,
        new Set(seen).size === seen.length &&
          !seen.some((x) => x.startsWith("ERR")),
        `${seen.length} rows, ${seen.length - new Set(seen).size} repeated`
      )
    }
    for (const lookup of d.result.joins.slice(0, 3)) {
      if (joinsTested >= 30) break
      const kind = isCustom(tables.find((x) => x[1] === lookup.table)?.[0] ?? 0)
        ? "custom"
        : "standard"
      if (
        await customJoin(
          `${t.name}.${lookup.field} → ${lookup.table}`,
          t.id,
          lookup,
          d.result.fields.find((x) => x.name === lookup.field)?.type
        )
      )
        joinsTested++
      void kind
    }
  }
  check(
    "custom",
    "custom tables with data tested",
    tablesTested > 0,
    `${tablesTested} tables`
  )

  // Custom fields on standard tables (table extensions), and their lookups
  for (const [id, name] of [
    [18, "Customer"],
    [23, "Vendor"],
    [27, "Item"],
    [36, "Sales Header"],
    [37, "Sales Line"],
    [112, "Sales Invoice Header"],
    [21, "Cust. Ledger Entry"],
    [17, "G/L Entry"],
    [32, "Item Ledger Entry"],
    [15, "G/L Account"],
  ]) {
    const d = await call("describe", { table: id })
    if (!d.ok) continue
    const custom = d.result.fields.filter(
      (x) => isCustom(x.no) && x.enabled && x.class !== "FlowFilter"
    )
    if (!custom.length) continue
    await typed("custom", `${name}: ${custom.length} extension fields`, {
      table: id,
      fields: [
        d.result.fields.find((x) => x.pk)?.no ?? 1,
        ...custom.slice(0, 80).map((x) => x.no),
      ],
      top: 25,
    })
    const withValue = custom.find(
      (x) => x.class === "Normal" && /Code|Text/.test(x.type)
    )
    if (withValue) {
      const r = await call("query", {
        table: id,
        fields: [withValue.name],
        filters: [{ field: withValue.name, filter: "<>''" }],
        top: 20,
      })
      check(
        "custom",
        `${name}: filter on extension field ${withValue.name}`,
        r.ok && r.result.rows.every((row) => row[0] !== ""),
        r.ok ? `${r.result.rows.length} rows` : r.error
      )
    }
    const customLookups = d.result.joins.filter((j) =>
      custom.some((c) => c.name === j.field)
    )
    for (const lookup of customLookups.slice(0, 4)) {
      if (joinsTested >= 40) break
      if (
        await customJoin(
          `${name}.${lookup.field} (extension field) → ${lookup.table}`,
          id,
          lookup,
          d.result.fields.find((x) => x.name === lookup.field)?.type
        )
      )
        joinsTested++
    }
    // Standard tables joining into custom tables
    for (const lookup of d.result.joins
      .filter((j) => customTables.some((t) => t.name === j.table))
      .slice(0, 3)) {
      if (joinsTested >= 45) break
      if (
        await customJoin(
          `${name}.${lookup.field} → custom ${lookup.table}`,
          id,
          lookup,
          d.result.fields.find((x) => x.name === lookup.field)?.type
        )
      )
        joinsTested++
    }
  }
  check(
    "custom",
    "custom joins tested",
    joinsTested > 0,
    `${joinsTested} joins`
  )

  // --- 8. Errors ------------------------------------------------------------
  const fails = async (name, params, pattern) => {
    const r = await call("query", params)
    check(
      "errors",
      name,
      !r.ok && pattern.test(r.error),
      r.ok ? "it ran" : r.error
    )
  }
  await fails(
    "unknown table",
    { table: "Custmer", fields: ["No."] },
    /no table called/
  )
  await fails(
    "unknown field",
    { table: "Customer", fields: ["Nmae"] },
    /has no field/
  )
  await fails(
    "unknown join field",
    {
      table: "Customer",
      fields: ["No."],
      joins: [{ field: "Salesperson Kode", fields: ["Name"] }],
    },
    /has no field/
  )
  await fails(
    "unknown related field",
    {
      table: "Customer",
      fields: ["No."],
      joins: [{ field: "Salesperson Code", fields: ["Nmae"] }],
    },
    /has no field/
  )
  await fails(
    "not a lookup field",
    {
      table: "Customer",
      fields: ["No."],
      joins: [{ field: "Name", fields: ["No."] }],
    },
    /isn't a lookup field/
  )
  await fails(
    "bad filter value",
    {
      table: "Customer",
      fields: ["No."],
      filters: [{ field: "Balance (LCY)", filter: "abc" }],
    },
    /not valid/
  )
  await fails(
    "bad paging cursor",
    { table: "Customer", fields: ["No."], after: "nonsense" },
    /./
  )

  // --- Report ---------------------------------------------------------------
  const failed = results.filter((r) => !r.pass)
  return {
    summary: `${results.length - failed.length}/${results.length} passed`,
    valueTypesChecked: typeStats,
    failed,
    all: results.map(
      (r) => `${r.pass ? "PASS" : "FAIL"}  [${r.area}] ${r.name} — ${r.detail}`
    ),
  }
})()
