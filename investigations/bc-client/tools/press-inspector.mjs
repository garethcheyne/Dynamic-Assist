// Presses Ctrl+Alt+F1 as a real key event in the BC tab and records network + websocket traffic.
import fs from "node:fs"

const targets = await (await fetch("http://127.0.0.1:9333/json")).json()
const page = targets.find((t) => t.type === "page" && t.url.includes("businesscentral.dynamics.com"))
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const log = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) return pending.get(msg.id)(msg), pending.delete(msg.id)
  const p = msg.params
  switch (msg.method) {
    case "Network.requestWillBeSent":
      if (!/\.(png|svg|woff2?|css)(\?|$)/.test(p.request.url))
        log.push({ t: "req", method: p.request.method, url: p.request.url, body: p.request.postData?.slice(0, 4000) })
      break
    case "Network.webSocketFrameSent":
      log.push({ t: "ws>", data: p.response.payloadData.slice(0, 6000) })
      break
    case "Network.webSocketFrameReceived":
      log.push({ t: "ws<", data: p.response.payloadData.slice(0, 20000) })
      break
  }
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id
    pending.set(i, resolve)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
await new Promise((r) => (ws.onopen = r))
await send("Network.enable")
await send("Page.bringToFront")

const key = { key: "F1", code: "F1", windowsVirtualKeyCode: 112, nativeVirtualKeyCode: 112, modifiers: 1 | 2 } // Alt=1, Ctrl=2
await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key })
await send("Input.dispatchKeyEvent", { type: "keyUp", ...key })

await new Promise((r) => setTimeout(r, Number(process.argv[2] ?? 6000)))
fs.writeFileSync(process.argv[3] ?? "shortcut-log.json", JSON.stringify(log, null, 1))
console.log(`${log.length} events`)
for (const e of log) console.log(e.t, e.method ?? "", (e.url ?? e.data).slice(0, 200))
ws.close()
