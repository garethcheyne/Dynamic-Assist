import fs from "node:fs"
import path from "path"
import { crx, type CrxPlugin } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { build as rolldown } from "rolldown"
import { defineConfig, type Plugin } from "vite"

import manifest from "./manifest.json"

// The project folder as it's spelled on disk. Started from "c:…" rather than
// "C:…" (VS Code can do that), Vite would see some files under both
// spellings and bundle React twice, which blanks the panel. process.chdir
// makes every later path, ours or a plugin's, use this one.
const ROOT = fs.realpathSync.native(__dirname)
process.chdir(ROOT)

// Scripts that run in the page's own JS world (world: "MAIN"). @crxjs wraps
// content scripts in a loader that import()s a chunk by relative URL, which
// can't work from the page's world, so these are bundled to one IIFE each in
// public/scripts/ and registered by the service worker.
const MAIN_WORLD_SCRIPTS: Record<string, string> = {
  "bc-main-world.js": "src/platforms/bc/main-world.ts",
  "ce-main-world.js": "src/platforms/ce/main-world.ts",
  "ce-error-watch.js": "src/platforms/ce/error-watch.ts",
}

function mainWorldScripts(): Plugin {
  const outDir = path.resolve(ROOT, "public/scripts")
  const normalize = (file: string) => path.resolve(file).toLowerCase()
  // Every source file the scripts are built from, from the last build, so an
  // edit elsewhere (a panel component) doesn't rebuild them
  let sources = new Set<string>()

  const buildAll = async () => {
    const results = await Promise.all(
      Object.entries(MAIN_WORLD_SCRIPTS).map(([file, input]) =>
        rolldown({
          input: path.resolve(ROOT, input),
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

// React's own module sets this once; seen twice in a bundle means two Reacts
const REACT_DEFINITION =
  "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE="

// Fails the build if React ends up in the output twice, which blanks the side
// panel ("Cannot read properties of null (reading 'useState')"). It happened
// when Vite started from "c:…" rather than "C:…" (see ROOT); this makes sure.
function singleReact(): Plugin {
  return {
    name: "single-react",
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((c) => c.type === "chunk")
      const copies = chunks.flatMap((c) =>
        c.code
          .split(REACT_DEFINITION)
          .slice(1)
          .map(() => c)
      )
      if (copies.length <= 1) return
      const detail = [...new Set(copies)]
        .map(
          (c) =>
            `${c.fileName}:\n  ${c.moduleIds.filter((id) => /node_modules[\\/]react/.test(id)).join("\n  ")}`
        )
        .join("\n")
      this.error(
        `React is in this build ${copies.length} times; rebuild.\n${detail}`
      )
    },
  }
}

// @crxjs makes every ?script import web-accessible to all sites. The query
// builder (inject.tsx?script&iife) is injected with scripting.executeScript,
// which doesn't need that, and exposing it lets any site detect the extension.
function noScriptWebResources(): CrxPlugin {
  return {
    name: "no-script-web-resources",
    apply: "build",
    enforce: "post",
    renderCrxManifest(manifest) {
      manifest.web_accessible_resources =
        manifest.web_accessible_resources?.filter(
          (entry) => !entry.resources.includes("src/query-builder/inject.js")
        )
      return manifest
    },
  }
}

// manifest.json is the source; @crxjs bundles every entry it names (side panel,
// service worker, content scripts) and writes the final manifest to dist/.
export default defineConfig({
  root: ROOT,
  plugins: [
    mainWorldScripts(),
    react(),
    tailwindcss(),
    crx({ manifest }),
    singleReact(),
    noScriptWebResources(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(ROOT, "./src"),
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
    rolldownOptions: {
      output: {
        // React must load once per page. If its CommonJS module is emitted
        // twice, hooks from one copy run in the other's renderer ("Cannot
        // read properties of null (reading 'useState')"): the chunk names it
        // in one place, ROOT keeps one spelling of every path, and
        // singleReact() checks the result. The injected query
        // builder is a separate one-file build (?script&iife) and isn't split.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
