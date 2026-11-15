import fs from "node:fs"
import path from "path"
import { crx, type CrxPlugin } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { build as rolldown } from "rolldown"
import { defineConfig, type Plugin } from "vite"

import manifest from "./manifest.json"
import pkg from "./package.json"

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

// The open-source packages that end up in the extension, gathered from every
// bundle (the panel, the worker, the injected query builder), with their
// licence texts: their licences (MIT, ISC, OFL for the Geist font) ask for
// the notice to travel with the code. Written to dist/THIRD-PARTY-NOTICES.txt,
// which About links to. Build tools (Vite, CRXJS) don't ship, so aren't in it.
const shipped = new Map<string, string>()

function packageRoot(id: string) {
  const clean = id.replace(/\?.*$/, "").replace(/\\/g, "/")
  const at = clean.lastIndexOf("/node_modules/")
  if (at < 0) return null
  const rest = clean.slice(at + "/node_modules/".length).split("/")
  const name = rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0]
  return { dir: `${clean.slice(0, at)}/node_modules/${name}`, name }
}

function licenceText(dir: string) {
  const file = fs
    .readdirSync(dir)
    .find((f) => /^(licen[cs]e|copying|ofl)(\.(md|txt))?$/i.test(f))
  return file ? fs.readFileSync(path.join(dir, file), "utf8").trim() : ""
}

// Shipped through stylesheets rather than imports, so no bundle names them: the
// Geist font, the panel's animations and Tailwind's generated styles
const STYLE_PACKAGES = ["@fontsource-variable/geist", "tw-animate-css", "tailwindcss"]

function writeNotices(outDir: string) {
  for (const name of STYLE_PACKAGES) {
    const dir = path.join(ROOT, "node_modules", name)
    if (fs.existsSync(path.join(dir, "package.json"))) shipped.set(name, fs.realpathSync(dir))
  }
  const entries = [...shipped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, dir]) => {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
      const licence = typeof meta.license === "string" ? meta.license : meta.license?.type ?? "see below"
      const home = meta.homepage ?? (typeof meta.repository === "string" ? meta.repository : meta.repository?.url) ?? ""
      const text = licenceText(dir) || `Licensed under ${licence}.`
      return [`${name} ${meta.version} (${licence})`, home.replace(/^git\+/, ""), "", text].filter((l, i) => i !== 1 || l).join("\n")
    })
  const header = [
    "Dynamic Assist: open-source software it includes",
    "",
    "Dynamic Assist is free and open source (https://github.com/garethcheyne/Dynamic-Assist).",
    "It's built with the packages below, each under its own licence, reproduced here as",
    "those licences ask. Its controls are adapted from shadcn/ui (MIT, https://ui.shadcn.com).",
    "The Dynamics 365 tools are a rebuild of Level up for Dynamics 365/Power Apps by",
    "Natraj Yegnaraman (MIT, https://github.com/rajyraman/Levelup-for-Dynamics-CRM).",
  ].join("\n")
  const rule = "\n\n" + "-".repeat(78) + "\n\n"
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, "THIRD-PARTY-NOTICES.txt"), header + rule + entries.join(rule) + "\n")
}

function thirdPartyNotices(): Plugin {
  let outDir = path.resolve(ROOT, "dist")
  return {
    name: "third-party-notices",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    generateBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue
        for (const id of output.moduleIds) {
          const pkgRoot = packageRoot(id)
          if (pkgRoot && fs.existsSync(path.join(pkgRoot.dir, "package.json"))) shipped.set(pkgRoot.name, pkgRoot.dir)
        }
      }
    },
    // Every bundle closes with the packages seen so far; the last one has them all
    closeBundle() {
      if (shipped.size) writeNotices(outDir)
    },
  }
}

// manifest.json is the source; @crxjs bundles every entry it names (side panel,
// service worker, content scripts) and writes the final manifest to dist/.
// The version comes from package.json only, so the two can't drift apart.
export default defineConfig({
  root: ROOT,
  plugins: [
    mainWorldScripts(),
    react(),
    tailwindcss(),
    crx({ manifest: { ...manifest, version: pkg.version } }),
    singleReact(),
    noScriptWebResources(),
    thirdPartyNotices(),
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
