// A small test runner: tests run in order, each is PASS, FAIL or SKIP with a reason,
// and a failure never stops the rest. No function goes missing without saying so:
// what can't be tested is a t.skip() with its reason, not an absence.
import fs from "node:fs"
import path from "node:path"

export const fail = (message) => {
  throw new Error(message)
}
export const ok = (value, message) => {
  if (!value) fail(message ?? "expected something truthy")
  return value
}
export const eq = (actual, expected, what = "value") => {
  if (actual !== expected)
    fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
export const match = (actual, pattern, what = "text") => {
  if (!pattern.test(String(actual ?? "")))
    fail(`${what}: expected ${pattern}, got ${JSON.stringify(String(actual ?? "").slice(0, 240))}`)
}

export function createRun({ only, onFailure }) {
  const results = []
  const started = Date.now()
  const stamp = () => `${((Date.now() - started) / 1000).toFixed(0).padStart(5)}s`

  const record = (area, name, status, detail, ms) => {
    results.push({ area, name, status, detail, ms })
    const mark = { PASS: "ok  ", FAIL: "FAIL", SKIP: "skip" }[status]
    console.log(`${stamp()} ${mark} [${area}] ${name}${detail ? `: ${detail}` : ""}`)
  }

  function area(name) {
    const wanted = (test) => !only || only.test(`${name} ${test}`)
    const t = async (test, fn, { timeout = 90000 } = {}) => {
      if (!wanted(test)) return
      const begun = Date.now()
      let timer
      try {
        const detail = await Promise.race([
          fn(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Test timed out after ${timeout / 1000}s`)), timeout)
          }),
        ])
        record(name, test, "PASS", typeof detail === "string" ? detail : "", Date.now() - begun)
      } catch (error) {
        record(name, test, "FAIL", error.message, Date.now() - begun)
        // Only evidence: a tab that's gone mustn't hang the whole run
        await Promise.race([onFailure?.(name, test).catch(() => undefined), new Promise((done) => setTimeout(done, 15000))])
      } finally {
        clearTimeout(timer)
      }
    }
    t.skip = (test, reason) => {
      if (wanted(test)) record(name, test, "SKIP", reason, 0)
    }
    /** Results from a suite that ran on its own, such as the live ones */
    t.record = (test, passed, detail) => record(name, test, passed ? "PASS" : "FAIL", detail, 0)
    return t
  }

  function save(resultsDir, meta) {
    const count = (s) => results.filter((r) => r.status === s).length
    const now = new Date()
    const pad = (n) => String(n).padStart(2, "0")
    const when = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
    const summary = `${count("PASS")} passed, ${count("FAIL")} failed, ${count("SKIP")} skipped of ${results.length}`
    const report = { ranAt: now.toISOString(), seconds: Math.round((Date.now() - started) / 1000), summary, ...meta, results }
    fs.mkdirSync(resultsDir, { recursive: true })
    fs.writeFileSync(path.join(resultsDir, `e2e-${when}.json`), JSON.stringify(report, null, 2))
    const clean = (s) => String(s ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|")
    const areas = [...new Set(results.map((r) => r.area))]
    const md = [
      "# Browser test: Dynamic Assist",
      "",
      `- **Result:** ${summary}`,
      `- **Ran:** ${now.toLocaleString()} (${report.seconds} s), extension ${meta.version ?? "?"}`,
      "",
      ...(count("FAIL")
        ? ["## Failures", "", "| Area | Test | Why |", "| --- | --- | --- |",
          ...results.filter((r) => r.status === "FAIL").map((r) => `| ${r.area} | ${clean(r.name)} | ${clean(r.detail)} |`), ""]
        : []),
      ...areas.flatMap((a) => [
        `## ${a}`,
        "",
        "| | Function | Detail |",
        "| --- | --- | --- |",
        ...results
          .filter((r) => r.area === a)
          .map((r) => `| ${{ PASS: "✅", FAIL: "❌", SKIP: "⏭️" }[r.status]} | ${clean(r.name)} | ${clean(r.detail)} |`),
        "",
      ]),
    ].join("\n")
    fs.writeFileSync(path.join(resultsDir, `e2e-${when}.md`), md)
    fs.writeFileSync(path.join(resultsDir, "e2e-latest.md"), md)
    return { summary, file: `tests/results/e2e-${when}.md`, failed: count("FAIL") }
  }

  return { area, results, save }
}
