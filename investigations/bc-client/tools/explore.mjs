// node explore.mjs  (Chrome must be running with --remote-debugging-port=9333)
// node explore.mjs "<js path expression evaluated in client frame>"  -> dumps getters/fields (1 level)
import fs from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
const expr = process.argv[2]
const js = `(() => {
  if (typeof DN === "undefined" || !location.href.includes("runinframe")) return "skip"
  const cp = DN.App.context.currentPage
  let o; try { o = (${expr}) } catch (e) { return "ERR " + e.message }
  if (o == null || typeof o !== "object") return o
  const names = new Set(); let p = o
  for (let i = 0; p && p !== Object.prototype && i < 6; i++, p = Object.getPrototypeOf(p)) Object.getOwnPropertyNames(p).forEach(n => names.add(n))
  const SECRET = /token|secret|password|credential|csrf|cookie|signature|apikey|connectionstring/i
  const out = { __type: o.constructor?.name }
  for (const n of names) {
    if (n === "constructor") continue
    let v; try { v = o[n] } catch (e) { out[n] = "ERR"; continue }
    if (typeof v === "function") continue
    if (SECRET.test(n)) out[n] = "[redacted]"
    else if (v == null || typeof v !== "object") out[n] = typeof v === "string" ? v.slice(0, 150) : v
    else out[n] = Array.isArray(v) ? "[Array " + v.length + "]" : "[" + (v.constructor?.name ?? "obj") + "]"
  }
  return out
})()`
const tmp = fileURLToPath(new URL("./_explore.js", import.meta.url))
fs.writeFileSync(tmp, js)
process.stdout.write(execFileSync("node", [fileURLToPath(new URL("./eval.mjs", import.meta.url)), tmp]).toString())
