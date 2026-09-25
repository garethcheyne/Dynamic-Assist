/**
 * A headless Chrome of our own for rendering marketing images: a throwaway
 * profile, so no sign-ins, cookies or real data are anywhere near it.
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launchChrome(port = 9555) {
  const exe = CANDIDATES.find((p) => fs.existsSync(p))
  if (!exe) throw new Error("No Chrome or Edge found; set CHROME_PATH")
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "da-marketing-"))
  const proc = spawn(
    exe,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "about:blank",
    ],
    { stdio: "ignore" }
  )
  let version
  for (let i = 0; i < 50 && !version; i++) {
    await sleep(200)
    version = await fetch(`http://127.0.0.1:${port}/json/version`)
      .then((r) => r.json())
      .catch(() => null)
  }
  if (!version) throw new Error("Chrome didn't start")

  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const m = JSON.parse(event.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, (m) =>
        m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)
      )
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })

  /** A new page at the given CSS size and pixel ratio. */
  async function page({ width, height, scale = 2, init } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" })
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true })
    const s = (method, params) => send(method, params, sessionId)
    await s("Page.enable")
    await s("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
    })
    if (init) await s("Page.addScriptToEvaluateOnNewDocument", { source: init })
    return {
      async goto(url, settle = 1500) {
        await s("Page.navigate", { url })
        await sleep(settle)
      },
      async eval(expression) {
        const r = await s("Runtime.evaluate", {
          expression,
          awaitPromise: true,
          returnByValue: true,
        })
        if (r.exceptionDetails)
          throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      },
      async hover(x, y) {
        await s("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
        await sleep(700)
      },
      async click(x, y) {
        await s("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
        await s("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
        await s("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
        await sleep(400)
      },
      async screenshot(file, { transparent = false } = {}) {
        if (transparent)
          await s("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })
        const { data } = await s("Page.captureScreenshot", { format: "png" })
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, Buffer.from(data, "base64"))
      },
      /** Prints to PDF at the page's CSS @page size, with backgrounds. */
      async pdf(file) {
        const { data } = await s("Page.printToPDF", {
          printBackground: true,
          preferCSSPageSize: true,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        })
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, Buffer.from(data, "base64"))
      },
      close: () => send("Target.closeTarget", { targetId }),
    }
  }

  async function close() {
    ws.close()
    proc.kill()
    await sleep(300)
    // Chrome can hold the folder a moment after exiting; a temp folder left behind is harmless
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}
  }

  return { page, close }
}

export { sleep }
