/**
 * Runs a tool from the project folder as it's spelled on disk. Started from
 * "c:\…" rather than "C:\…" (VS Code can do that), Node loads some modules
 * under both spellings: Vite bundles React twice and Vitest finds no tests.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = fs.realpathSync.native(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
)

/** Runs node_modules/<script> with these arguments; returns its result. */
export function runTool(script, args, options = {}) {
  process.chdir(ROOT)
  return spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules", script), ...args],
    {
      cwd: ROOT,
      ...options,
    }
  )
}
