// Tests run the pure logic (filters, generated AL, URLs) in Node. Kept apart
// from vite.config.ts so the extension plugins don't load.
import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "vitest/config"

// The folder as spelled on disk: from "c:…" instead of "C:…" Vitest finds no
// tests (see vite.config.ts)
const ROOT = fs.realpathSync.native(import.meta.dirname)
process.chdir(ROOT)

export default defineConfig({
  root: ROOT,
  resolve: {
    alias: { "@": path.resolve(ROOT, "./src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
})
