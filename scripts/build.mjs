#!/usr/bin/env node
/**
 * `vite build`, started from the project folder's real spelling
 * (canonical.mjs): from "c:\…" instead of "C:\…" it would bundle React twice.
 * vite.config.ts's singleReact() still fails the build if that ever happens.
 */
import { runTool } from "./canonical.mjs"

const run = runTool("vite/bin/vite.js", ["build"], { stdio: "inherit" })
process.exit(run.status ?? 1)
