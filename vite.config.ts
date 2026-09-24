import path from "path"
import { crx } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { build as rolldown } from "rolldown"
import { defineConfig, type Plugin } from "vite"

import manifest from "./manifest.json"

// Scripts that run in the page's own JS world (world: "MAIN"). @crxjs wraps
// content scripts in a loader that import()s a chunk by relative URL, which
// can't work from the page's world, so these are bundled to one IIFE each in
// public/scripts/ and registered by the service worker.
const MAIN_WORLD_SCRIPTS: Record<string, string> = {
  "bc-main-world.js": "src/platforms/bc/main-world.ts",
  "ce-main-world.js": "src/platforms/ce/main-world.ts",
}

function mainWorldScripts(): Plugin {
  const outDir = path.resolve(__dirname, "public/scripts")
  const buildAll = () =>
    Promise.all(
      Object.entries(MAIN_WORLD_SCRIPTS).map(([file, input]) =>
        rolldown({
          input: path.resolve(__dirname, input),
          output: { file: path.join(outDir, file), format: "iife" },
          write: true,
        })
      )
    )

  return {
    name: "main-world-scripts",
    async buildStart() {
      await buildAll()
    },
    async handleHotUpdate({ file }) {
      if (file.replaceAll("\\", "/").includes("/src/platforms/")) await buildAll()
    },
  }
}

// manifest.json is the source; @crxjs bundles every entry it names (side panel,
// service worker, content scripts) and writes the final manifest to dist/.
export default defineConfig({
  plugins: [mainWorldScripts(), react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
})
