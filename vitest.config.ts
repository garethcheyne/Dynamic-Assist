// Tests run the pure logic (filters, generated AL, URLs) in Node. Kept apart
// from vite.config.ts so the extension plugins don't load.
import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
})
