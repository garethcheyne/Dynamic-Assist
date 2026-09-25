#!/usr/bin/env node
/** `vitest`, started from the project folder's real spelling (canonical.mjs). */
import { runTool } from "./canonical.mjs"

const run = runTool("vitest/vitest.mjs", process.argv.slice(2), {
  stdio: "inherit",
})
process.exit(run.status ?? 1)
