// Turns Vitest's JSON output (tests/results/unit-latest.json) into a readable
// report, tests/results/unit-latest.md. Run by `npm run test:report`.
import fs from "node:fs"
import path from "node:path"

const dir = path.resolve(import.meta.dirname, "results")
const data = JSON.parse(
  fs.readFileSync(path.join(dir, "unit-latest.json"), "utf8")
)
const root = path.resolve(import.meta.dirname, "..")
const icon = {
  passed: "✅",
  failed: "❌",
  skipped: "⏭️",
  pending: "⏭️",
  todo: "📝",
}

const lines = [
  "# Unit tests",
  "",
  `- **Result:** ${data.numPassedTests}/${data.numTotalTests} passed, ${data.numFailedTests} failed, ${data.numPendingTests} skipped`,
  `- **Ran:** ${new Date(data.startTime).toLocaleString()}`,
  "",
]
for (const file of data.testResults) {
  lines.push(
    `## ${path.relative(root, file.name).replace(/\\/g, "/")}`,
    "",
    "| | Test | ms |",
    "| --- | --- | --- |"
  )
  for (const t of file.assertionResults) {
    const name = [...t.ancestorTitles, t.title]
      .join(" › ")
      .replace(/\|/g, "\\|")
    lines.push(
      `| ${icon[t.status] ?? t.status} | ${name} | ${Math.round(t.duration ?? 0)} |`
    )
    for (const m of t.failureMessages ?? [])
      lines.push(`| | ${m.split("\n")[0].replace(/\|/g, "\\|")} | |`)
  }
  lines.push("")
}
fs.writeFileSync(path.join(dir, "unit-latest.md"), lines.join("\n"))
console.log(
  `${data.numPassedTests}/${data.numTotalTests} passed. Saved tests/results/unit-latest.md`
)
