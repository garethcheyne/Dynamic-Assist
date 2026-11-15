/**
 * The page side of the Business Central query builder video: a stand-in for
 * the chrome.* APIs the injected builder uses, and for the companion app it
 * reaches through the extension's worker (bc:companion-relay). It answers
 * info, tables, fields and query from fixtures/bc-query.json, applying the
 * query's filters, sort and row limit for real. Nothing here talks to a real
 * service.
 *
 * bcQueryMockScript() returns source to run before the page's own scripts.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

export function bcQueryMockScript({ theme = "light", address }) {
  const fx = JSON.parse(fs.readFileSync(path.join(here, "../fixtures/bc-query.json"), "utf8"))
  return `(() => {
  const FX = ${JSON.stringify(fx)}
  const THEME = ${JSON.stringify(theme)}
  // The builder reads the environment and company from the address: show it
  // the Business Central one (same origin, nothing loads)
  history.replaceState(null, "", ${JSON.stringify(address)})

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
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  window.chrome = {
    runtime: {
      id: "dynamic-assist-demo",
      getURL: (p) => "/" + p.replace(/^\\//, ""),
      sendMessage: async (message) => {
        // The companion's query page is open for this company
        if (message?.type === "bc:channel-status") return { open: true }
        if (message?.type !== "bc:companion-relay") return undefined
        await wait(120 + Math.random() * 260)
        try {
          return { ok: true, result: companion(message.method, message.params ?? {}) }
        } catch (error) {
          return { ok: false, error: error.message }
        }
      },
      onMessage: { addListener: (f) => listeners.push(f), removeListener() {}, hasListener: () => true },
    },
    storage: {
      local: area("local"),
      session: area("session"),
      onChanged: { addListener: (f) => changed.push(f), removeListener() {} },
    },
  }
  window.__daLoad = (src) =>
    new Promise((resolve, reject) => {
      if (window.__dynamicAssistQuery) return resolve()
      const s = document.createElement("script")
      s.src = src
      s.onload = () => resolve()
      s.onerror = () => reject(new Error("couldn't load " + src))
      document.head.append(s)
    })
  window.__daDeliver = (message) =>
    new Promise((resolve) => {
      let answered = false
      for (const f of listeners) f(message, {}, (r) => { answered = true; resolve(r) })
      if (!answered) setTimeout(() => resolve(true), 50)
    })

  // ---- The companion ------------------------------------------------------------
  const tableOf = (id) => FX.tables.find(([t]) => t === id)
  const fieldsOf = (id) => {
    const t = tableOf(id)
    const raw = FX.fields[id] ?? [[1, "No.", "No.", "Code", "Normal", 20, true], [2, "Name", "Name", "Text", "Normal", 100]]
    return raw.map(([no, name, caption, type, cls, length, pk, relationTable, options]) => ({
      no, name, caption, type, class: cls, length, enabled: true, obsolete: false, pk: !!pk,
      ...(relationTable ? { relationTable, relationField: 0 } : {}),
      ...(options ? { options } : {}),
    }))
  }
  const text = (v) => String(v ?? "").toLowerCase()
  const num = (v) => Number(String(v).replace(/,/g, ""))
  const numeric = (type) => /Decimal|Integer|BigInteger/.test(type)

  /** One condition, as the builder sends it, or failing that its BC filter expression */
  function matches(value, field, f) {
    const n = numeric(field.type)
    const cmp = (a, b) => (n ? num(a) - num(b) : text(a) < text(b) ? -1 : text(a) > text(b) ? 1 : 0)
    const list = (s) => String(s).split(/[,|]/).map((x) => x.trim()).filter(Boolean)
    switch (f.op) {
      case "eq": return cmp(value, f.value) === 0
      case "ne": return cmp(value, f.value) !== 0
      case "gt": return cmp(value, f.value) > 0
      case "ge": return cmp(value, f.value) >= 0
      case "lt": return cmp(value, f.value) < 0
      case "le": return cmp(value, f.value) <= 0
      case "between": return cmp(value, f.value) >= 0 && cmp(value, f.value2) <= 0
      case "contains": return text(value).includes(text(f.value))
      case "begins": return text(value).startsWith(text(f.value))
      case "ends": return text(value).endsWith(text(f.value))
      case "in": return list(f.value).some((x) => cmp(value, x) === 0)
      case "notIn": return !list(f.value).some((x) => cmp(value, x) === 0)
      case "empty": return String(value ?? "").trim() === "" || (n && num(value) === 0)
      case "notEmpty": return !(String(value ?? "").trim() === "" || (n && num(value) === 0))
    }
    // A Business Central filter expression: a|b, a..b, <>a, >a, *a*, '' and plain values
    return String(f.filter ?? "").split("|").some((part) => {
      const p = part.trim().replace(/^@/, "")
      if (p === "''") return String(value ?? "").trim() === ""
      if (p.includes("..")) {
        const [lo, hi] = p.split("..")
        return (!lo || cmp(value, lo) >= 0) && (!hi || cmp(value, hi) <= 0)
      }
      const op = /^(<>|>=|<=|>|<)/.exec(p)?.[1]
      const rest = op ? p.slice(op.length) : p
      if (op === "<>") return cmp(value, rest) !== 0
      if (op === ">") return cmp(value, rest) > 0
      if (op === ">=") return cmp(value, rest) >= 0
      if (op === "<") return cmp(value, rest) < 0
      if (op === "<=") return cmp(value, rest) <= 0
      if (rest.includes("*")) {
        const re = new RegExp("^" + rest.split("*").map((s) => s.replace(/[.+?^\${}()|[\\]\\\\]/g, "\\\\$&")).join(".*") + "$", "i")
        return re.test(String(value ?? ""))
      }
      return cmp(value, rest) === 0
    })
  }

  function companion(method, params) {
    if (method === "info") return FX.info
    if (method === "tables") return FX.tables.map(([id, name, caption]) => ({ id, name, caption, perCompany: true, obsolete: false }))
    if (method === "apis") return []
    if (method === "fields") {
      const t = tableOf(params.table)
      if (!t) throw new Error("Table " + params.table + " doesn't exist.")
      return { table: t[0], name: t[1], caption: t[2], readable: true, fields: fieldsOf(t[0]) }
    }
    if (method === "query") {
      const t = tableOf(params.table)
      if (!t) throw new Error("Table " + params.table + " doesn't exist.")
      if (params.joins?.length) throw new Error("Related tables aren't part of this demo.")
      const all = fieldsOf(t[0])
      const at = (no) => all.findIndex((f) => f.no === no)
      let rows = (FX.rows[t[0]] ?? []).slice()
      for (const f of params.filters ?? []) {
        const i = at(f.field)
        if (i >= 0) rows = rows.filter((r) => matches(r[i], all[i], f))
      }
      const sortBy = (params.sort?.length ? params.sort : all.filter((f) => f.pk).map((f) => f.no)).map(at).filter((i) => i >= 0)
      rows.sort((a, b) => {
        for (const i of sortBy) {
          const n = numeric(all[i].type)
          const d = n ? num(a[i]) - num(b[i]) : String(a[i]).localeCompare(String(b[i]), undefined, { numeric: true })
          if (d) return d
        }
        return 0
      })
      if (params.descending) rows.reverse()
      const count = rows.length
      const top = params.top ?? 500
      const cols = (params.fields?.length ? params.fields : all.filter((f) => f.pk).map((f) => f.no)).map(at).filter((i) => i >= 0)
      const where = (params.filters ?? []).map((f) => all[at(f.field)]?.name + "=FILTER(" + f.filter + ")").join(",")
      return {
        table: t[0], name: t[1], caption: t[2],
        columns: cols.map((i) => ({ no: all[i].no, name: all[i].name, caption: all[i].caption, type: all[i].type, class: all[i].class })),
        rows: rows.slice(0, top).map((r) => cols.map((i) => r[i])),
        more: count > top,
        ...(params.count ? { count } : {}),
        view: "SORTING(" + sortBy.map((i) => all[i].name).join(",") + ")" + (params.descending ? " ORDER(Descending)" : "") + (where ? " WHERE(" + where + ")" : ""),
        ms: 40 + Math.round(Math.random() * 80),
      }
    }
    throw new Error("The companion doesn't know " + method + ".")
  }
})()`
}
