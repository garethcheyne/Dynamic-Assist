#!/usr/bin/env node
/**
 * `vite build`, started from the project folder's real spelling
 * (canonical.mjs): from "c:\…" instead of "C:\…" it would bundle React twice.
 * vite.config.ts's singleReact() still fails the build if that ever happens.
 *
 * Then makes every built script loadable by Chrome (chromeSafe below).
 */
import fs from "node:fs"
import path from "node:path"

import { runTool } from "./canonical.mjs"

const run = runTool("vite/bin/vite.js", ["build"], { stdio: "inherit" })
if (run.status !== 0) process.exit(run.status ?? 1)

/**
 * Chrome refuses to inject a script it doesn't consider UTF-8 ("Could not load
 * file … It isn't UTF-8 encoded"), and its check rejects Unicode
 * noncharacters (U+FDD0–U+FDEF, U+xFFFE, U+xFFFF) as well as broken bytes.
 * CodeMirror's source writes "\uffff" as an escape; the minifier emits the raw
 * character, which is valid UTF-8 but a noncharacter, so the query builder
 * wouldn't open. These only occur in string and regex literals, where the
 * \u escape means the same thing, so they're written back as escapes.
 */
const NONCHARACTER = /[\uFDD0-\uFDEF\uFFFE\uFFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDFFE\uDFFF]/g
// Per UTF-16 unit, so a pair becomes \\uD83F\\uDFFF, as JavaScript expects
const escape = (s) =>
  s
    .split("")
    .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
    .join("")

function chromeSafe(dir) {
  let fixed = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      fixed += chromeSafe(file)
      continue
    }
    if (!/\.(m?js)$/.test(entry.name)) continue
    const bytes = fs.readFileSync(file)
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const safe = text.replace(NONCHARACTER, escape)
    if (safe !== text) {
      fs.writeFileSync(file, safe, "utf8")
      fixed++
      console.log(`chrome-safe: escaped noncharacters in ${path.relative(process.cwd(), file)}`)
    }
    if (NONCHARACTER.test(safe)) throw new Error(`${file} still has noncharacters`)
    NONCHARACTER.lastIndex = 0
  }
  return fixed
}

chromeSafe(path.resolve("dist"))
