/**
 * The page side of the query builder videos: a stand-in for the few chrome.*
 * APIs the injected builder uses, and a small Dataverse Web API that answers
 * from fixtures/ce-query.json. It runs FetchXML and simple SQL against that
 * data for real, so filters, sorting and row limits behave as they do on an org.
 * Nothing here talks to a real service.
 *
 * queryMockScript() returns source to run before the page's own scripts.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

export function queryMockScript({ theme = "light" } = {}) {
  const fx = JSON.parse(fs.readFileSync(path.join(here, "../fixtures/ce-query.json"), "utf8"))
  return `(() => {
  const FX = ${JSON.stringify(fx)}
  const THEME = ${JSON.stringify(theme)}

  // ---- chrome.* as the injected builder sees it --------------------------------
  const listeners = []
  const changed = []
  const store = { local: { "ui.theme": THEME }, session: {} }
  const area = (name) => ({
    get: async (keys) => {
      const all = store[name]
      if (keys == null) return { ...all }
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys)
      return Object.fromEntries(list.filter((k) => k in all).map((k) => [k, all[k]]))
    },
    set: async (items) => {
      Object.assign(store[name], items)
      const changes = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { newValue: v }]))
      changed.forEach((f) => f(changes, name))
    },
    remove: async (keys) => { for (const k of [].concat(keys)) delete store[name][k] },
  })
  window.chrome = {
    runtime: {
      id: "dynamic-assist-demo",
      getURL: (p) => "/" + p.replace(/^\\//, ""),
      sendMessage: async () => undefined,
      onMessage: { addListener: (f) => listeners.push(f), removeListener() {}, hasListener: () => true },
    },
    storage: {
      local: area("local"),
      session: area("session"),
      onChanged: { addListener: (f) => changed.push(f), removeListener() {} },
    },
  }
  /** What chrome.scripting.executeScript does: run the builder's script in this page */
  window.__daLoad = (src) =>
    new Promise((resolve, reject) => {
      if (window.__dynamicAssistQuery) return resolve()
      const s = document.createElement("script")
      s.src = src
      s.onload = () => resolve()
      s.onerror = () => reject(new Error("couldn't load " + src))
      document.head.append(s)
    })
  /** What chrome.tabs.sendMessage does: hand a message to the builder's listener */
  window.__daDeliver = (message) =>
    new Promise((resolve) => {
      let answered = false
      for (const f of listeners) f(message, {}, (r) => { answered = true; resolve(r) })
      if (!answered) setTimeout(() => resolve(true), 50)
    })

  // ---- The data ------------------------------------------------------------------
  const TABLES = FX.tables.map(([logical, display, set, id, primary]) => ({ logical, display, set, id, primary }))
  const tableBySet = (set) => TABLES.find((t) => t.set === set)
  const tableOf = (logical) => TABLES.find((t) => t.logical === logical)
  const attrsOf = (table) => (FX.attributes[table] ?? []).map(([logical, schema, display, type, targets]) => ({ logical, schema, display, type, targets }))
  const optionLabel = (attr, value) => (FX.options[attr] ?? []).find(([v]) => String(v) === String(value))?.[1]
  const guid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0")
  const userRow = ([id, fullname, email], i) => ({ systemuserid: guid(900 + i), _key: id, fullname, internalemailaddress: email })
  const users = FX.users.map(userRow)
  const userId = (key) => users.find((u) => u._key === key)
  const contacts = FX.contacts.map(([key, first, last, job, account, city], i) => ({
    _key: key, contactid: guid(500 + i), firstname: first, lastname: last, fullname: first + " " + last + (i < 10 ? " (sample)" : ""),
    jobtitle: job, emailaddress1: (first + "." + last).toLowerCase() + "@example.com", telephone1: "555-01" + String(10 + i),
    address1_city: city, _account: account, statecode: 0, ownerid: users[i % users.length], createdon: "2026-0" + (3 + (i % 6)) + "-1" + (i % 9) + "T10:00:00Z",
  }))
  const accounts = FX.accounts.map(([name, number, city, country, revenue, employees, industry, state, hold, contact, owner, created], i) => ({
    accountid: guid(100 + i), name, accountnumber: number, address1_city: city, address1_country: country,
    telephone1: "555-0" + String(100 + i), emailaddress1: "info@" + name.toLowerCase().replace(/\\(sample\\)|[^a-z]/g, "") + ".example.com",
    websiteurl: "https://www." + name.toLowerCase().replace(/\\(sample\\)|[^a-z]/g, "") + ".example.com",
    revenue, numberofemployees: employees, industrycode: industry, statecode: state, creditonhold: hold,
    primarycontactid: contacts.find((c) => c._key === contact), ownerid: userId(owner), createdon: created,
  }))
  for (const c of contacts) c.parentcustomerid = accounts[c._account - 1]
  const ROWS = { account: accounts, contact: contacts, systemuser: users }

  // ---- Values as the Web API returns them ------------------------------------------
  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const when = (iso) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).replace(",", "")
  const F = "@OData.Community.Display.V1.FormattedValue"
  const raw = (attr, row) => {
    const v = row[attr.logical]
    return v && typeof v === "object" ? v[tableOf(attr.targets?.[0] ?? "")?.id ?? ""] ?? Object.values(v)[0] : v
  }
  function project(table, row, names) {
    const attrs = attrsOf(table)
    const out = {}
    const pick = names ? names.map((n) => attrs.find((a) => a.logical === n)).filter(Boolean) : attrs
    const id = tableOf(table).id
    if (!pick.some((a) => a.logical === id)) out[id] = row[id]
    for (const a of pick) {
      const v = row[a.logical]
      if (v === undefined || v === null) continue
      if (a.targets) {
        const target = tableOf(a.targets[0])
        out["_" + a.logical + "_value"] = v[target.id]
        out["_" + a.logical + "_value" + F] = v[target.primary]
        out["_" + a.logical + "_value@Microsoft.Dynamics.CRM.lookuplogicalname"] = target.logical
        continue
      }
      out[a.logical] = v
      if (a.type === "Money") out[a.logical + F] = money(v)
      else if (a.type === "Integer") out[a.logical + F] = Number(v).toLocaleString("en-US")
      else if (a.type === "Picklist" || a.type === "State") out[a.logical + F] = optionLabel(a.logical, v)
      else if (a.type === "Boolean") out[a.logical + F] = v ? "Yes" : "No"
      else if (a.type === "DateTime") out[a.logical + F] = when(v)
    }
    return out
  }

  // ---- FetchXML, run for real against the rows --------------------------------------
  function compare(attr, row, op, values) {
    const v = raw(attr, row)
    const s = v === undefined || v === null ? null : String(typeof v === "boolean" ? (v ? 1 : 0) : v)
    const val = values[0] ?? ""
    const like = (pattern) => new RegExp("^" + pattern.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i").test(s ?? "")
    const num = (x) => (attr.type === "DateTime" ? Date.parse(x) : Number(x))
    switch (op) {
      case "eq": return s !== null && s.toLowerCase() === val.toLowerCase()
      case "ne": case "neq": return s === null || s.toLowerCase() !== val.toLowerCase()
      case "null": return s === null || s === ""
      case "not-null": return s !== null && s !== ""
      case "contains": return like("%" + val + "%")
      case "not-contain": return !like("%" + val + "%")
      case "like": return like(val)
      case "not-like": return !like(val)
      case "begins-with": return like(val + "%")
      case "not-begin-with": return !like(val + "%")
      case "ends-with": return like("%" + val)
      case "not-end-with": return !like("%" + val)
      case "gt": return s !== null && num(s) > num(val)
      case "ge": return s !== null && num(s) >= num(val)
      case "lt": return s !== null && num(s) < num(val)
      case "le": return s !== null && num(s) <= num(val)
      case "in": return values.some((x) => String(x).toLowerCase() === (s ?? "").toLowerCase())
      case "not-in": return !values.some((x) => String(x).toLowerCase() === (s ?? "").toLowerCase())
      default: return true
    }
  }
  function matches(filter, table, row) {
    const attrs = attrsOf(table)
    const parts = [...filter.children].map((el) => {
      if (el.tagName === "filter") return matches(el, table, row)
      if (el.tagName !== "condition" || el.getAttribute("entityname")) return true
      const attr = attrs.find((a) => a.logical === el.getAttribute("attribute"))
      if (!attr) return true
      const values = el.hasAttribute("value") ? [el.getAttribute("value")] : [...el.querySelectorAll("value")].map((x) => x.textContent)
      return compare(attr, row, el.getAttribute("operator") ?? "eq", values)
    })
    return filter.getAttribute("type") === "or" ? parts.some(Boolean) : parts.every(Boolean)
  }
  function sortRows(rows, table, orders) {
    const attrs = attrsOf(table)
    return [...rows].sort((x, y) => {
      for (const { name, desc } of orders) {
        const attr = attrs.find((a) => a.logical === name)
        if (!attr) continue
        const [a, b] = [raw(attr, x), raw(attr, y)]
        const lookupName = (r) => r[name]?.[tableOf(attr.targets?.[0] ?? "")?.primary ?? ""]
        const [p, q] = attr.targets ? [lookupName(x), lookupName(y)] : [a, b]
        const c = typeof p === "number" && typeof q === "number" ? p - q : String(p ?? "").localeCompare(String(q ?? ""))
        if (c) return desc ? -c : c
      }
      return 0
    })
  }
  function runFetchXml(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml")
    const fetchEl = doc.documentElement
    const entity = fetchEl.querySelector(":scope > entity")
    const table = entity?.getAttribute("name")
    if (!table || !tableOf(table)) throw new Error("The entity with a name = '" + table + "' with namemapping = 'Logical' was not found in the MetadataCache.")
    let rows = ROWS[table] ?? []
    const filter = entity.querySelector(":scope > filter")
    if (filter) rows = rows.filter((r) => matches(filter, table, r))
    const orders = [...entity.querySelectorAll(":scope > order")].map((o) => ({ name: o.getAttribute("attribute"), desc: o.getAttribute("descending") === "true" }))
    rows = sortRows(rows, table, orders)
    const limit = Number(fetchEl.getAttribute("count") || fetchEl.getAttribute("top")) || 5000
    const names = entity.querySelector(":scope > all-attributes") ? null : [...entity.querySelectorAll(":scope > attribute")].map((a) => a.getAttribute("name"))
    return { value: rows.slice(0, limit).map((r) => project(table, r, names && names.length ? names : null)), "@Microsoft.Dynamics.CRM.morerecords": rows.length > limit }
  }

  // ---- SQL: enough for SELECT [TOP n] … FROM … [WHERE … AND …] [ORDER BY …] -------
  function runSql(sql) {
    const m = /^\\s*select\\s+(?:top\\s+(\\d+)\\s+)?([\\s\\S]+?)\\s+from\\s+(\\w+)(?:\\s+where\\s+([\\s\\S]+?))?(?:\\s+order\\s+by\\s+([\\s\\S]+?))?\\s*;?\\s*$/i.exec(sql)
    if (!m) throw new Error("Only SELECT queries can be run this way.")
    const [, top, columns, table, where, order] = m
    if (!tableOf(table)) throw new Error("Invalid object name '" + table + "'.")
    const attrs = attrsOf(table)
    let rows = ROWS[table] ?? []
    if (where)
      for (const clause of where.split(/\\s+and\\s+/i)) {
        const c = /^\\s*(\\w+)\\s*(=|<>|!=|>=|<=|>|<|\\s+like\\s+|\\s+not\\s+like\\s+)\\s*(.+?)\\s*$/i.exec(clause)
        if (!c) continue
        const attr = attrs.find((a) => a.logical === c[1].toLowerCase())
        if (!attr) throw new Error("Invalid column name '" + c[1] + "'.")
        const op = { "=": "eq", "<>": "ne", "!=": "ne", ">": "gt", "<": "lt", ">=": "ge", "<=": "le" }[c[2].trim().toLowerCase()] ?? (/not/i.test(c[2]) ? "not-like" : "like")
        const value = c[3].replace(/^N?'|'$/g, "")
        rows = rows.filter((r) => compare(attr, r, op, [value]))
      }
    if (order) rows = sortRows(rows, table, order.split(",").map((o) => { const [name, dir] = o.trim().split(/\\s+/); return { name: name.toLowerCase(), desc: /desc/i.test(dir ?? "") } }))
    const names = columns.trim() === "*" ? null : columns.split(",").map((c) => c.trim().toLowerCase())
    for (const n of names ?? []) if (!attrs.some((a) => a.logical === n)) throw new Error("Invalid column name '" + n + "'.")
    const limit = top ? Number(top) : 5000
    return {
      value: rows.slice(0, limit).map((r) => {
        const p = project(table, r, names)
        // SQL returns columns as asked, without the key unless asked for
        if (names && !names.includes(tableOf(table).id)) delete p[tableOf(table).id]
        return p
      }),
    }
  }

  // ---- Metadata --------------------------------------------------------------------
  const label = (text) => ({ UserLocalizedLabel: { Label: text } })
  function attributesResponse(table) {
    return { value: attrsOf(table).map((a) => ({ LogicalName: a.logical, SchemaName: a.schema, DisplayName: label(a.display), AttributeType: a.type, AttributeTypeName: { Value: a.type + "Type" }, IsValidForAdvancedFind: { Value: true }, AttributeOf: null })) }
  }
  function optionsResponse(table, cast) {
    const type = { PicklistAttributeMetadata: "Picklist", StateAttributeMetadata: "State", StatusAttributeMetadata: "Status", BooleanAttributeMetadata: "Boolean" }[cast]
    return {
      value: attrsOf(table).filter((a) => a.type === type).map((a) => {
        const options = (FX.options[a.logical] ?? []).map(([v, t]) => ({ Value: v, Label: label(t) }))
        const set = type === "Boolean" ? { TrueOption: options.find((o) => o.Value === 1) ?? { Value: 1, Label: label("Yes") }, FalseOption: options.find((o) => o.Value === 0) ?? { Value: 0, Label: label("No") } } : { Options: options }
        return { LogicalName: a.logical, OptionSet: set, GlobalOptionSet: null }
      }),
    }
  }
  function relationshipsResponse(table) {
    const r = FX.relationships[table] ?? { manyToOne: [], oneToMany: [] }
    return {
      LogicalName: table,
      ManyToOneRelationships: r.manyToOne.map(([SchemaName, ReferencedEntity, ReferencedAttribute, ReferencingAttribute]) => ({ SchemaName, ReferencedEntity, ReferencedAttribute, ReferencingAttribute })),
      OneToManyRelationships: r.oneToMany.map(([SchemaName, ReferencingEntity, ReferencingAttribute, ReferencedAttribute]) => ({ SchemaName, ReferencingEntity, ReferencingAttribute, ReferencedAttribute })),
    }
  }

  // ---- The Web API --------------------------------------------------------------------
  const realFetch = window.fetch.bind(window)
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
  const error = (message, status = 400) => json({ error: { code: "0x80040203", message } }, status)
  window.__daUnhandled = []
  // A moment's wait, as a real org takes: the builder's spinners and timings show
  const pause = (ms) => new Promise((r) => setTimeout(r, ms))
  window.fetch = async (input, init) => {
    const href = typeof input === "string" ? input : input.url
    const at = href.indexOf("/api/data/v9.2/")
    if (at < 0) return realFetch(input, init)
    const full = href.slice(at + 15)
    const [p, query = ""] = full.split("?")
    const pathPart = decodeURIComponent(p)
    const params = new URLSearchParams(query)
    await pause(120)
    let m
    if (pathPart === "EntityDefinitions")
      return json({ value: TABLES.map((t) => ({ LogicalName: t.logical, DisplayName: label(t.display), EntitySetName: t.set, PrimaryIdAttribute: t.id, PrimaryNameAttribute: t.primary, ObjectTypeCode: 1, IsCustomEntity: false })) })
    if ((m = /^EntityDefinitions\\(LogicalName='(\\w+)'\\)\\/Attributes\\/Microsoft\\.Dynamics\\.CRM\\.LookupAttributeMetadata$/.exec(pathPart)))
      return json({ value: attrsOf(m[1]).filter((a) => a.targets).map((a) => ({ LogicalName: a.logical, Targets: a.targets })) })
    if ((m = /^EntityDefinitions\\(LogicalName='(\\w+)'\\)\\/Attributes\\/Microsoft\\.Dynamics\\.CRM\\.(\\w+)$/.exec(pathPart)))
      return json(optionsResponse(m[1], m[2]))
    if ((m = /^EntityDefinitions\\(LogicalName='(\\w+)'\\)\\/Attributes$/.exec(pathPart)))
      return json(attributesResponse(m[1]))
    if ((m = /^EntityDefinitions\\(LogicalName='(\\w+)'\\)$/.exec(pathPart))) {
      const t = tableOf(m[1])
      if (!t) return error("Could not find an entity with name " + m[1], 404)
      if ((params.get("$expand") ?? "").includes("Relationships")) return json(relationshipsResponse(m[1]))
      return json({ LogicalName: t.logical, EntitySetName: t.set, PrimaryIdAttribute: t.id, PrimaryNameAttribute: t.primary, DisplayName: label(t.display) })
    }
    if (pathPart.startsWith("FetchXmlToQueryExpression")) {
      const xml = (params.get("@p") ?? "").replace(/^'|'$/g, "").replace(/''/g, "'")
      try { runFetchXml(xml); return json({ Query: {} }) } catch (e) { return error(e.message) }
    }
    const table = tableBySet(pathPart)
    if (table) {
      try {
        if (params.has("fetchXml")) { await pause(350); return json(runFetchXml(params.get("fetchXml"))) }
        if (params.has("sql")) { await pause(450); return json(runSql(params.get("sql"))) }
        // A lookup's search: $select=name,id&$orderby=name&$top=15&$filter=contains(name,'x')
        const select = (params.get("$select") ?? "").split(",").filter(Boolean)
        const term = /contains\\(\\w+,'([^']*)'\\)|startswith\\(\\w+,'([^']*)'\\)/.exec(params.get("$filter") ?? "")
        const needle = (term?.[1] ?? term?.[2] ?? "").toLowerCase()
        const rows = (ROWS[table.logical] ?? []).filter((r) => String(r[table.primary] ?? "").toLowerCase().includes(needle))
        return json({ value: sortRows(rows, table.logical, [{ name: table.primary }]).slice(0, Number(params.get("$top")) || 50).map((r) => Object.fromEntries(select.map((s) => [s, r[s]]))) })
      } catch (e) {
        return error(e.message)
      }
    }
    window.__daUnhandled.push(pathPart + (query ? "?" + decodeURIComponent(query) : ""))
    return error("Not in the demo data: " + pathPart, 404)
  }
})();`
}
