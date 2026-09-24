// Usage: node cdp.mjs <file-with-js-expression> [urlFilter]
// Evaluates the expression in the page's own JS world of every BC frame and prints results.
import fs from "node:fs"

const exprFile = process.argv[2]
const filter = process.argv[3] ?? "businesscentral.dynamics.com"
const expression = fs.readFileSync(exprFile, "utf8")

const targets = await (await fetch("http://127.0.0.1:9333/json")).json()
const page = targets.find((t) => t.type === "page" && t.url.includes(filter))
if (!page) {
  console.log("No BC tab. Tabs:", targets.filter((t) => t.type === "page").map((t) => t.url))
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const contexts = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method === "Runtime.executionContextCreated") {
    contexts.push(msg.params.context)
  }
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id
    pending.set(i, resolve)
    ws.send(JSON.stringify({ id: i, method, params }))
  })

await new Promise((r) => (ws.onopen = r))
await send("Runtime.enable")
await new Promise((r) => setTimeout(r, 500))

const mains = contexts.filter(
  (c) => c.auxData?.isDefault && c.origin.includes(filter)
)
for (const ctx of mains) {
  const res = await send("Runtime.evaluate", {
    expression,
    contextId: ctx.id,
    returnByValue: true,
    awaitPromise: true,
    timeout: 15000,
  })
  const r = res.result
  const out = r?.exceptionDetails
    ? "EXCEPTION: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    : r?.result?.value
  console.log(`--- frame ${ctx.auxData.frameId.slice(0, 8)} ${ctx.name || ""}`)
  console.log(typeof out === "string" ? out : JSON.stringify(out, null, 1))
}
ws.close()
