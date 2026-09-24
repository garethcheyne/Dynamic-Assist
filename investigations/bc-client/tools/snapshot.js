(() => {
  if (typeof DN === "undefined" || !location.href.includes("runinframe")) return null
  const SENSITIVE_KEY = /token|secret|password|passwd|credential|auth(?!or)|session|csrf|cookie|signature|apikey|api_key|upn|email|mail|user(name|id)?$|objectid|instrumentation|connectionstring/i
  const SENSITIVE_VAL = /^eyJ[\w-]+\.|@[\w-]+\.[\w.]+|Bearer\s/i
  const MAX_NODES = 7000, MAX_DEPTH = 7, MAX_PROPS = 150
  const seen = new Map()
  const nodes = {}
  const queue = []
  let count = 0

  const ctorName = (o) => { try { return o?.constructor?.name ?? typeof o } catch { return "?" } }
  const methodsOf = (o) => {
    const out = new Set()
    let p = Object.getPrototypeOf(o)
    for (let i = 0; p && p !== Object.prototype && p !== Function.prototype && i < 6; i++, p = Object.getPrototypeOf(p)) {
      for (const n of Object.getOwnPropertyNames(p)) {
        if (n === "constructor") continue
        const d = Object.getOwnPropertyDescriptor(p, n)
        if (typeof d?.value === "function") out.add(n + "()")
        else if (d?.get) out.add("get " + n)
      }
    }
    return [...out]
  }
  const prim = (k, v) => {
    if (SENSITIVE_KEY.test(k)) return "[redacted]"
    if (typeof v === "string") return SENSITIVE_VAL.test(v) ? "[redacted]" : v.length > 120 ? v.slice(0, 120) + "…" : v
    return v
  }
  const ref = (v, path, depth) => {
    if (seen.has(v)) return { $ref: seen.get(v) }
    if (depth >= MAX_DEPTH || count >= MAX_NODES) return { $type: ctorName(v), $truncated: true }
    if (v instanceof Node || v === window || v === document) return { $dom: ctorName(v) }
    seen.set(v, path)
    count++
    queue.push([v, path, depth])
    return { $ref: path }
  }
  const visit = (o, path, depth) => {
    const node = { type: ctorName(o) }
    if (typeof o === "function") node.kind = "class/function"
    if (Array.isArray(o)) node.length = o.length
    const methods = methodsOf(o)
    if (methods.length) node.methods = methods
    const props = {}
    const statics = []
    let names = []
    try { names = Object.getOwnPropertyNames(o) } catch {}
    if (typeof o === "object" && !Array.isArray(o)) for (const m of methods) if (m.startsWith("get ")) names.push(m.slice(4))
    names = [...new Set(names)].filter((n) => !n.startsWith("$") && !n.endsWith("_"))
    if (Array.isArray(o)) names = names.filter((n) => n === "length" || Number(n) < 3)
    for (const k of names.slice(0, MAX_PROPS)) {
      if (["length", "name", "prototype", "caller", "arguments"].includes(k) && typeof o === "function") continue
      let v
      try { v = o[k] } catch { props[k] = "[throws]"; continue }
      if (v == null || typeof v !== "object" && typeof v !== "function") props[k] = prim(k, v)
      else if (typeof v === "function" && !(v.prototype && Object.getOwnPropertyNames(v.prototype).length > 1) && Object.getOwnPropertyNames(v).filter((n) => !["length","name","prototype"].includes(n)).length === 0) statics.push(k + "()")
      else if (SENSITIVE_KEY.test(k)) props[k] = "[redacted]"
      else props[k] = ref(v, path + "." + k, depth + 1)
    }
    if (typeof o === "function") {
      node.staticMembers = names.filter((n) => !["length", "name", "prototype", "caller", "arguments"].includes(n))
      if (o.prototype) node.instanceMethods = Object.getOwnPropertyNames(o.prototype).filter((n) => n !== "constructor")
    }
    if (statics.length) node.functionProps = statics
    node.props = props
    nodes[path] = node
  }

  seen.set(DN, "DN")
  queue.push([DN, "DN", 0])
  while (queue.length) { const [o, p, d] = queue.shift(); visit(o, p, d) }
  return JSON.stringify({ capturedAt: new Date().toISOString(), clientUrl: location.origin, nodeCount: count, truncated: count >= MAX_NODES, nodes })
})()
