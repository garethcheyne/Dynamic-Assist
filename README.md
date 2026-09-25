# Dynamic Assist

Admin and developer tools for Business Central, Dynamics 365, Power Apps and Power Automate, in one side panel. Not affiliated with Microsoft.

A Manifest V3 extension for Chrome and Edge, built with Vite, React, TypeScript, Tailwind CSS and [shadcn/ui](https://ui.shadcn.com). Created with [extension-publisher](https://github.com/garethcheyne/extension-publisher)'s `New-Extension.ps1`.

## Develop

```powershell
npm install
npm run dev
```

Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, choose **Load unpacked** and pick `dist/`. While `npm run dev` runs, changes reload by themselves. Click the toolbar icon to open the side panel.

```text
manifest.json              the extension manifest; entries point at source files, the build rewrites them for dist/
src/
├── background/            service worker: opens the panel, impersonation rules, query builder hand-off
├── sidepanel/             the side panel shell: header, launcher (portals.ts), home, history, credits
├── help/                  the help page (index.html?page=help), opened in a browser tab
├── platforms/
│   ├── bc/                Business Central: content + main-world scripts, page reading and page tools
│   │   ├── panel/         Page, Parts, Tools, Go to and Session tabs
│   │   └── query/         BC query builder (talks to the companion app)
│   ├── ce/                Dynamics 365 apps: content + main-world scripts, impersonation
│   │   ├── panel/         Record, Tools, Go to and Session tabs; Access, Compare, coupled BC records
│   │   └── query/         Dataverse query builder (lib/ is ported from fluentui-extended)
│   ├── maker/             Power Apps maker portal panel
│   └── flow/              Power Automate panel and bulk flow on/off
├── query-builder/         shared by both builders: injected window, results grid, export
├── shared/                used by page scripts and panel alike: product detection, links, page tooltips, theme key
├── lib/                   panel helpers: Dataverse fetch, history, storage hooks
├── components/            shared React components; ui/ is shadcn/ui (npx shadcn@latest add <name>)
├── assets/brand/ms/       official Microsoft product icons (see SOURCE.md for terms)
└── styles/tokens.css      colours and per-product accents, shared by the panel and the injected builder
public/
├── icons/                 toolbar and extensions-page icons (scripts/make-icons.mjs)
└── scripts/               built main-world scripts (bc-main-world.js, ce-main-world.js), not edited by hand
bc-companion/              the optional, read-only Business Central app (AL) the BC tools talk to; see its README
tests/                     unit tests (Vitest) and live checks; see tests/README.md
marketing/                 scripted store images and screenshots from demo data; see marketing/README.md
store/                     store listing, privacy answers and IDs; see store/README.md
investigations/            notes from reverse-engineering the BC client (snapshots are git-ignored)
```

To add a popup, options page or content script, add it to `manifest.json` pointing at a source file (`.html` or `.ts`); the build picks it up.

## Release

1. Bump `version` in `manifest.json` (and `package.json` to match).
2. `npm run store` builds, zips into `releases/` and checks against both stores' rules.
3. `npm run store:publish` uploads and submits to both stores.

For testers, `npm run build` also writes `releases/dynamics-assist-beta.zip`, with side-loading instructions in its README.txt.

The first version is uploaded by hand. See "First release of a new extension" in the extension-publisher README.
