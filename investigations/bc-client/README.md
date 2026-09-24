# Business Central web client internals

Notes from probing a live BC client (BC 28.0, platform 28.0.54688.0, sandbox, 24 Sep 2026)
and reading its bundle. None of this is a public API; re-check after BC updates.

## Where things live

- **Bundle**: `https://bc-cdn.dynamics.com/res/<hash>/js/client.js`, gzip-compressed, about 7 MB
  once unpacked. Lazy chunks sit next to it (`client.<id>.chunk.js`).
- **Global**: the bundle assigns its exports to `var DN`. Its chunk loader is
  `globalThis.webpackChunkDN`.
- **Frames**: the top page is a shell. The client runs in an iframe with `?runinframe=1`, and
  `DN` there is the one that holds the open forms. The top frame also has a `DN`; it boots its
  own client only for designer panes (see the page inspector below).

## `DN` exports

| Export | What it's good for |
| --- | --- |
| `App.context.currentPage` | `{ entry, queryString }` for the top-most page. `openPage()` and `openPageOnTop()` sit next to it |
| `App.host` | App host: `designerController`, `sessionInfo`, `appOptions`, `openInNewWindow()`, `downloadFile()` |
| `SinglePageNavigation.instance` | Navigation stack: `topMostEntry`, `navigationStack`, `openPage()`, `pushView()`, `pop()` |
| `BrowserLogicalClient.instance` | `rootForms`, `sideForms`, `session`, `findControlByIdOrReference()` |
| `ExecutionContext.Instance` | `EnvName`, `EnvType` (sandbox/production), `AadTenantId`, `RuntimeId`, `ClusterAddress`, `AppServiceUrl` |
| `ClientConfiguration.settings` | `PlatformVersion`, `ApplicationId`, `LanguageName`, `Telemetry`… |
| `ClientDevTool` | A hidden developer pane, see below |
| `AppLinkBuilder` | `toUniversalAppURL()`, `getConnectionString()`, `getInstanceName()` |
| `ServerAddressProvider` | Server URL building (`serverAddress`, `buildServerAddress()`) |
| `getInteractionQueueDebugger()` | Debugger for the client→server interaction queue (not explored yet) |
| `playRecording()` / `resumePlayback()` | Page scripting playback |
| `ApplicationMemoryConsumption.instance` | Memory usage |

## User and session

```text
DN.BrowserPageSession.instance
  .userName / .userDisplayName / .userUpn / .userPuid / .authenticationObjectId (Entra object ID)
  .userInfo.userGuid                     BC User Security ID
  .isTenantAdmin (via $isTenantAdmin), .timeZone, .languageInfo { id, name, countryCode }
  .profileDescription { Id, Caption, Description, ProfileAppId }    current role/profile
  .permissions.permissions               client feature flags (AllowActionExportToExcel, AllowPageScriptingRecording, AllowCopilotChat…)
  .companyInformation { name, displayName, id, systemIndicatorText, evaluationCompany }
  .environmentName, .tenantId, .aadTenantId
DN.BrowserLogicalClient.instance.session
  .availableCompanies, .openedRootForms, .openedSideForms
  .sessionInfo (on App.host): sessionId + requestToken (CSRF, treat as a secret)
```

The client only holds what it needs for the UI. There's no query API in it: records reach
it through pages the server opens for the session, under the user's permissions.

## The form model (what the side panel reads)

```text
DN.App.context.currentPage.entry.formAdapter.logicalControl   → LogicalForm
  .name / .caption / .pageType (AL PageType: 0 Card, 1 List, 3 CardPart, 4 ListPart…)
  .metadata = { id: <page id>, sourceTableId, primaryKeyIds }
  .bookmark, .systemId, .serverFormHandle
  .appId / .appName / .appPublisher / .appVersion                (the app that owns the page)
  .children.items[]                                              controls (MobX-backed)
     .typeName        StringControl, DecimalControl, SelectionControl, RepeaterControl, LogicalForm (a part)…
     .tableFieldNo    bound field, -1 if unbound
     .designName / .caption / .stringValue / .visible / .sourceAppId
  RepeaterControl
     .columns.items[]            column definitions (caption, tableFieldNo)
     .currentRow.children.items  the selected row's cells, same order as columns
     .totalRowCount, .selectedRowIds
```

Nested `LogicalForm`s are the page's parts (FactBoxes, subpages), and each has its own
`metadata` and app.

## Page inspector (Ctrl+Alt+F1)

- Handler: `handleOpenPageInspectorShortcut` checks `altKey && ctrlKey && !shift && !meta && which === 112`.
  A real key event works (tested through DevTools `Input.dispatchKeyEvent`).
- It starts the designer at `DesignerLevels.Inspector`, which adds `theme-designer-inspector` to `<body>`.
- **The top frame loads `client.js` again, gets a new CSRF token and opens a second session**, then
  shows page **9631** ("Page Inspection") in `.designer-design-pane`, filtered on
  `Current Form ID = <serverFormHandle>` plus the bookmark. Page **9632** is its Table Fields part.
  The server reads the live form, so it can show things the client doesn't have: the table name,
  field data types, every table field (not only those on the page) and table extensions.
- Pane text format: `Item List (31, List)`, `Item (27)`, then per field
  `No. (1, Code[20], PK, Text Search)` / value / owning app.

Dynamic Assist reads the client model instead, so it doesn't pay for that second session.
It can't get what only the server knows (table name, data types, fields not on the page).

## Hidden: `DN.ClientDevTool`

```js
static get canShow() { return !isTestMode && isNonProdDeployment() }
// isNonProdDeployment: ClientConfiguration.settings.Telemetry.deploymentType ∈ DEVELOPMENT | TEST | PPE
static toggle()        // opens a React pane (lazy chunks 267, 730, 704, 278)
static getRootForm()   // SinglePageNavigation.instance.topMostEntryWithAdapter.rootAdapter.logicalControl
static findControl(path) // rootForm.findByPath(path)
```

Also listed in the settings menu as `clientDevToolId`. It's off in production (`canShow === false`).
Untested lead: set `deploymentType` in memory and call `toggle()`.

## Other shortcuts found in the keyboard handler

| Keys | Action |
| --- | --- |
| Ctrl+Alt+F1 | Page inspector |
| Ctrl+F12 | Toggle wide layout (unless `alwaysRenderInWideLayout`) |
| Alt+F2 | Toggle FactBox pane |
| Alt+Shift+F2 | Switch FactBox tab |

Also handled: product overview, get help, my settings, new record, new note, system indicator
tooltip, yes/no dialog and pop out. Their key bindings haven't been checked yet.

## Tools

In `tools/`. Start a Chrome with DevTools enabled, sign in to BC, then run them from here:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9333 `
  --remote-debugging-address=127.0.0.1 --user-data-dir="$env:TEMP\bc-probe" https://businesscentral.dynamics.com/
```

| Script | |
| --- | --- |
| `node eval.mjs <file.js>` | Runs the expression in the file in every BC frame and prints the result |
| `node explore.mjs "<expr>"` | Lists one object's fields. `cp` is `DN.App.context.currentPage`, e.g. `"cp.entry.formAdapter.logicalControl.metadata"` |
| `$env:OUT="x.json"; node eval-save.mjs snapshot.js` | Structural snapshot of `DN` (class names, methods, props, short values; secrets redacted) |
| `node press-inspector.mjs [ms] [log.json]` | Presses Ctrl+Alt+F1 for real and logs the network traffic |

`snapshots/` is git-ignored, because snapshots contain tenant data (company, records, environment).
