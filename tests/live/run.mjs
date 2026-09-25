// Runs the live suites in a Business Central tab and saves the results to
// tests/results: a JSON file and a Markdown report, named by date and time,
// plus live-latest.md.
//
//   builder    drives the query builder's UI (builder.live.js)
//   companion  calls the companion's engine directly (companion.live.js)
//
// Both by default; name one to run only it: npm run test:live -- builder
//
// Needs Chrome or Edge started with --remote-debugging-port=9333 (or set
// CDP_PORT), signed in to Business Central, with a tab on the "Dynamic Assist
// Query" page (page 77500) of an environment where the companion is installed.
//
//   npm run test:live
import fs from "node:fs"
import path from "node:path"

const port = process.env.CDP_PORT ?? "9333"
const here = import.meta.dirname
const resultsDir = path.resolve(here, "../results")
const suites = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["builder", "companion"]

const targets = await (
  await fetch(`http://127.0.0.1:${port}/json`)
)
  .json()
  .catch(() => {
    throw new Error(`No browser with remote debugging on port ${port}.`)
  })
const tab =
  targets.find(
    (t) =>
      t.type === "page" &&
      /businesscentral\.dynamics\.com.*[?&]page=77500/.test(t.url)
  ) ??
  targets.find(
    (t) => t.type === "page" && t.url.includes("businesscentral.dynamics.com")
  )
if (!tab)
  throw new Error(
    "No Business Central tab. Open the Dynamic Assist Query page (page 77500)."
  )

const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})
let id = 0
const pending = new Map()
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id
    pending.set(i, resolve)
    ws.send(JSON.stringify({ id: i, method, params }))
  })

const evaluate = async (expression) => {
  const reply = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    timeout: 900_000,
  })
  return reply.result?.exceptionDetails
    ? { error: reply.result.exceptionDetails.exception?.description }
    : { value: reply.result?.result?.value }
}
const builderOpen = async () =>
  (
    await evaluate(
      `!!document.getElementById("dynamic-assist-query")?.shadowRoot?.querySelector("[role=dialog]")`
    )
  ).value

console.log(
  `Running ${suites.join(" and ")} in ${new URL(tab.url).pathname.split("/").slice(0, 3).join("/")}…`
)
await send("Page.bringToFront")
const started = Date.now()
const value = { summary: "", valueTypesChecked: {}, failed: [], all: [] }
const summaries = []
for (const name of suites) {
  // The UI suite needs the query builder open: reloading page 77500 opens it
  if (name === "builder" && !(await builderOpen())) {
    await send("Page.reload")
    for (let i = 0; i < 60 && !(await builderOpen().catch(() => false)); i++)
      await new Promise((r) => setTimeout(r, 1000))
  }
  const file = path.join(here, `${name}.live.js`)
  const result = await evaluate(fs.readFileSync(file, "utf8"))
  if (result.error || typeof result.value !== "object") {
    const why = result.error ?? result.value ?? "didn't run"
    value.failed.push({ area: name, name: "suite", pass: false, detail: why })
    value.all.push(`FAIL  [${name}] suite — ${why}`)
    summaries.push(`${name}: didn't run`)
    continue
  }
  const r = result.value
  summaries.push(`${name} ${r.summary}`)
  value.failed.push(...r.failed)
  value.all.push(...r.all)
  for (const [t, n] of Object.entries(r.valueTypesChecked ?? {}))
    value.valueTypesChecked[t] = (value.valueTypesChecked[t] ?? 0) + n
}
ws.close()
const total = value.all.length
value.summary = `${total - value.failed.length}/${total} passed (${summaries.join(", ")})`

// --- Save ---------------------------------------------------------------------
const now = new Date()
const pad = (n) => String(n).padStart(2, "0")
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
const environment = decodeURIComponent(
  new URL(tab.url).pathname.split("/").filter(Boolean)[1] ?? ""
)
const report = {
  suite: "Dynamic Assist Companion, live",
  ranAt: now.toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  environment,
  ...value,
}
fs.mkdirSync(resultsDir, { recursive: true })
fs.writeFileSync(
  path.join(resultsDir, `live-${stamp}.json`),
  JSON.stringify(report, null, 2)
)

const lines = report.all.map((line) => {
  const [, status, area, name, detail] = line.match(
    /^(PASS|FAIL)\s+\[([\w-]+)\]\s+(.*?) — ([\s\S]*)$/
  ) ?? [null, "?", "", line, ""]
  return {
    status,
    area,
    name,
    detail: detail.replace(/\r?\n/g, " ").replace(/\|/g, "\\|"),
  }
})
const areas = [...new Set(lines.map((l) => l.area))]
const md = [
  `# Live test: Dynamic Assist Companion`,
  ``,
  `- **Result:** ${report.summary}`,
  `- **Ran:** ${now.toLocaleString()} (${report.seconds} s), environment \`${environment}\``,
  `- **Values type-checked:** ${Object.entries(report.valueTypesChecked)
    .map(([t, n]) => `${t} ${n}`)
    .join(", ")}`,
  ``,
  ...areas.flatMap((area) => [
    `## ${area}`,
    ``,
    `| | Check | Detail |`,
    `| --- | --- | --- |`,
    ...lines
      .filter((l) => l.area === area)
      .map(
        (l) =>
          `| ${l.status === "PASS" ? "✅" : "❌"} | ${l.name} | ${l.detail} |`
      ),
    ``,
  ]),
].join("\n")
fs.writeFileSync(path.join(resultsDir, `live-${stamp}.md`), md)
fs.writeFileSync(path.join(resultsDir, "live-latest.md"), md)

console.log(report.summary)
for (const f of report.failed)
  console.log(`FAIL [${f.area}] ${f.name}: ${f.detail}`)
console.log(`Saved tests/results/live-${stamp}.md and .json`)
process.exitCode = report.failed.length ? 1 : 0
