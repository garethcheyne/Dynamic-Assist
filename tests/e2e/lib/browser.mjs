// Chrome, driven over its debugging pipe with no dependencies. The pipe is what
// lets a script load the extension: Chrome ignores --load-extension in branded
// builds, but Extensions.loadUnpacked works with --enable-unsafe-extension-debugging.
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean)

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Waits until `test` returns something truthy; throws saying what it waited for. */
export async function until(test, { timeout = 15000, every = 200, what = "it" } = {}) {
  const end = Date.now() + timeout
  let last
  for (;;) {
    try {
      const value = await test()
      if (value) return value
      last = value
    } catch (error) {
      last = error.message
    }
    if (Date.now() > end)
      throw new Error(`Timed out after ${timeout / 1000}s waiting for ${what}${last ? ` (${String(last).slice(0, 160)})` : ""}`)
    await sleep(every)
  }
}

export async function launch({ dist, profile, downloads, urls = [] }) {
  const exe = CANDIDATES.find((p) => fs.existsSync(p))
  if (!exe) throw new Error("No Chrome found; set CHROME_PATH")
  fs.mkdirSync(profile, { recursive: true })
  fs.mkdirSync(downloads, { recursive: true })
  const proc = spawn(
    exe,
    [
      "--remote-debugging-pipe",
      "--enable-unsafe-extension-debugging",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      // Keeps session cookies, so the sign-in survives closing the browser
      "--restore-last-session",
      // A covered window must keep running: hidden tabs' timers otherwise fire
      // as rarely as once a minute, which isn't what's being tested
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--window-size=1500,1050",
      ...urls,
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] }
  )
  const out = proc.stdio[3]
  const inp = proc.stdio[4]
  let seq = 0
  let buffer = ""
  let closed = false
  const pending = new Map()
  const listeners = new Set()

  inp.on("data", (chunk) => {
    buffer += chunk.toString("utf8")
    let i
    while ((i = buffer.indexOf("\0")) >= 0) {
      const message = JSON.parse(buffer.slice(0, i))
      buffer = buffer.slice(i + 1)
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, method } = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) reject(new Error(`${method}: ${message.error.message}`))
        else resolve(message.result)
      } else {
        for (const listener of [...listeners]) listener(message)
      }
    }
  })
  proc.on("exit", () => {
    closed = true
    for (const { reject, method } of pending.values())
      reject(new Error(`${method}: Chrome closed`))
    pending.clear()
  })

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      if (closed) return reject(new Error(`${method}: Chrome closed`))
      const id = ++seq
      pending.set(id, { resolve, reject, method })
      out.write(`${JSON.stringify({ id, method, params, sessionId })}\0`)
    })

  await send("Target.setDiscoverTargets", { discover: true })
  await send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: path.resolve(downloads),
    eventsEnabled: true,
  })
  const loaded = await send("Extensions.loadUnpacked", { path: path.resolve(dist) })
  const extensionId = loaded.id

  const sessions = new Map()
  listeners.add((m) => {
    if (m.method === "Target.detachedFromTarget")
      for (const [targetId, sessionId] of sessions)
        if (sessionId === m.params.sessionId) sessions.delete(targetId)
    if (m.method === "Target.targetDestroyed") sessions.delete(m.params.targetId)
  })

  const targets = async () => (await send("Target.getTargets")).targetInfos
  const pages = async () => (await targets()).filter((t) => t.type === "page")

  async function session(targetId) {
    if (sessions.has(targetId)) return sessions.get(targetId)
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true })
    sessions.set(targetId, sessionId)
    return sessionId
  }

  /** Runs an expression in a target's page (or worker) world and returns its value. */
  async function evaluate(targetId, expression, { timeout = 60000 } = {}) {
    const sessionId = await session(targetId)
    const reply = await Promise.race([
      send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId),
      sleep(timeout).then(() => {
        throw new Error(`Page didn't answer in ${timeout / 1000}s: ${expression.slice(0, 80)}`)
      }),
    ])
    if (reply.exceptionDetails)
      throw new Error(
        reply.exceptionDetails.exception?.description?.split("\n")[0] ?? reply.exceptionDetails.text
      )
    return reply.result.value
  }

  const workerUrl = `chrome-extension://${extensionId}/service-worker-loader.js`

  /** The extension's service worker, started if it had stopped. */
  async function worker() {
    return until(
      async () => {
        const found = (await targets()).find((t) => t.type === "service_worker" && t.url === workerUrl)
        if (found) return found.targetId
        // Any message starts it again; a page of ours can send one
        const own = (await pages()).find((t) => t.url.startsWith(`chrome-extension://${extensionId}/`))
        if (own) await evaluate(own.targetId, `chrome.runtime.sendMessage({type:'e2e:wake'}).catch(()=>0).then(()=>1)`)
        return null
      },
      { what: "the extension's service worker", timeout: 20000 }
    )
  }
  const inWorker = async (expression, options) => evaluate(await worker(), expression, options)

  /**
   * Chrome keeps the service worker it stored for as long as the extension's version
   * stays the same, and every build has the same version until a release. Without this
   * a run tests this build's panel with an old build's worker. So every run installs it
   * afresh (chrome.runtime.reload() removes an extension loaded this way). That also
   * clears its storage, so a run starts the same each time. Tabs already open then need
   * loading again, to get the page scripts the new install registers.
   */
  async function freshInstall() {
    await send("Extensions.uninstall", { id: extensionId })
    await until(async () => !(await targets()).some((t) => t.url === workerUrl), { what: "the old service worker to stop", timeout: 10000 })
    await send("Extensions.loadUnpacked", { path: path.resolve(dist) })
    const started = await until(
      async () => (await targets()).find((t) => t.type === "service_worker" && t.url === workerUrl)?.targetId,
      { what: "the extension's service worker", timeout: 20000 }
    )
    await until(() => evaluate(started, `!!globalThis.chrome?.runtime?.id`), { what: "the service worker to start", timeout: 10000 })
    await sleep(500)
    for (const page of await pages())
      if (/^https?:/.test(page.url)) await send("Page.reload", {}, await session(page.targetId))
  }
  await freshInstall()

  /** Runs `action` and returns the page target it opened, without waiting for it to load. */
  async function newTabFrom(action, { timeout = 10000 } = {}) {
    const before = new Set((await pages()).map((t) => t.targetId))
    await action()
    const opened = await until(
      async () => (await pages()).find((t) => !before.has(t.targetId) && t.url && t.url !== "about:blank"),
      { timeout, every: 100, what: "a new tab" }
    )
    return opened
  }

  const closeTab = (targetId) => send("Target.closeTarget", { targetId }).catch(() => undefined)
  const openTab = async (url, { background = false } = {}) =>
    (await send("Target.createTarget", { url, background })).targetId

  const downloadsSeen = []
  listeners.add((m) => {
    if (m.method === "Browser.downloadWillBegin") downloadsSeen.push(m.params)
  })

  async function close() {
    try {
      await send("Browser.close")
    } catch {
      // It's closing, or already gone
    }
    await until(() => closed, { timeout: 8000, what: "Chrome to close" }).catch(() => proc.kill())
  }

  return {
    send,
    on: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    targets,
    pages,
    session,
    evaluate,
    worker,
    inWorker,
    newTabFrom,
    openTab,
    closeTab,
    close,
    extensionId,
    extensionUrl: (p) => `chrome-extension://${extensionId}/${p}`,
    downloadsSeen,
    downloadsDir: path.resolve(downloads),
    get closed() {
      return closed
    },
  }
}
