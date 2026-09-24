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
  const normalize = (file: string) => path.resolve(file).toLowerCase()
  // Every source file the scripts are built from, from the last build, so an
  // edit elsewhere (a panel component) doesn't rebuild them
  let sources = new Set<string>()

  const buildAll = async () => {
    const results = await Promise.all(
      Object.entries(MAIN_WORLD_SCRIPTS).map(([file, input]) =>
        rolldown({
          input: path.resolve(__dirname, input),
          output: { file: path.join(outDir, file), format: "iife" },
          write: true,
        })
      )
    )
    sources = new Set(
      results.flatMap((r) =>
        r.output.flatMap((chunk) =>
          "moduleIds" in chunk ? chunk.moduleIds.map(normalize) : []
        )
      )
    )
  }

  return {
    name: "main-world-scripts",
    async buildStart() {
      await buildAll()
    },
    async handleHotUpdate({ file }) {
      if (sources.has(normalize(file))) await buildAll()
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
  // React reads process.env.NODE_ENV; the ?script&iife bundle (the query
  // builder injected into the page) doesn't get Vite's usual replacement
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "production"
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
})
