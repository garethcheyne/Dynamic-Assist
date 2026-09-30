# Changelog

What changed in each release of the Dynamic Assist browser extension, newest
first. Versions are dates (`year.month.day`); the store version is the day it
was published.

The Business Central companion app lives in its own repository,
[Dynamic-Assist_BusinessCentralAddon](https://github.com/garethcheyne/Dynamic-Assist_BusinessCentralAddon),
and is released there with its own version; its changes are listed under
"Companion app" in each release. The extension ships through the Chrome Web Store and Edge Add-ons
only.

Each item that came from feedback or a request links to its file in
[enhancements/](enhancements/README.md), which has the cause and the details.

## [Unreleased] — 2026.10.x

### Added

- **Query builder start-up steps** (Business Central): while the builder
  starts, it lists each step (load the query page, start the companion, read
  the tables, load the fields) with how long each takes, instead of one
  spinner. The first time in a company, the companion's query page loads in
  the same tab, where you can see Business Central start, instead of a hidden
  background tab; **Back** returns to the page you were on.
- **Faster query builder**: each environment's table list and the fields of
  tables you open are kept in the browser, so the builder opens in seconds
  after the first time. A refresh button in the builder reads them again.
- **Settings** (panel menu): clear the cached Business Central metadata per
  environment or all at once, and close open companion query pages to try
  the first run again.
- **What's new** (panel menu): this changelog in a browser tab, read from
  GitHub when you open it, or the copy that came with your version when
  GitHub can't be reached.
- **Right-click menu** on Business Central and Dynamics 365 pages, under
  "Dynamic Assist". Copy the logical name (Dynamics 365) or the field name and
  number (Business Central) of the field or column you right-clicked. Turn
  logical names, field names and blur on or off. Copy the record's ID or link,
  and open the query builder. In Dynamics 365, open the option set values of
  a choice field. In Business Central, select a number to open that page or
  table. A short note on the page confirms what happened. Needs the new
  `contextMenus` permission, which Chrome installs without a prompt.
  ([008](enhancements/2026.10.x/008-right-click-menu.md))
- **Microsoft links** (admin centres, build tools, service health, docs) at
  the end of the right-click menu and on the toolbar icon's right-click menu,
  so they're one click away from any page.
  ([008](enhancements/2026.10.x/008-right-click-menu.md))
- **Option set viewer** in Dynamics 365: every choice, status and Yes/No
  column on the table with its values and labels, including columns the form
  doesn't show. ([001](enhancements/2026.10.x/001-ce-option-set-viewer.md))
- **FetchXML validation and suggestions** in the query builder: tables,
  columns and operators suggested from the org's metadata as you type, and
  mistakes flagged before you run the query.
  ([005](enhancements/2026.10.x/005-fetchxml-validation-autocomplete.md))
- **SQL in the Dynamics 365 query builder**: write the query in SQL, run
  through the Dataverse Web API's SQL option with your own permissions, with
  the same suggestions and checks as FetchXML.
  ([006](enhancements/2026.10.x/006-dataverse-sql-queries.md))

### Changed

- **Business Central coupled records** (Dynamics 365 Record tab) are read
  through Dataverse as soon as the record opens, when the companion's
  couplings API is visible as a virtual table: no Business Central tab, no
  company to pick. Records that no longer exist, and couplings the sync
  skips, are marked.
- When that virtual table isn't in the org, the Business Central section says
  so and lists the setup: Microsoft's Business Central Virtual Table app (if
  it's missing), the latest companion app from GitHub, and a link to
  Business Central Configuration to make **Dynamics 365 Couplings** visible.
- Without that virtual table, coupled records only offer
  companies in the Business Central environment the org is set up with, when
  the Business Central Virtual Table app is installed, and the org's default
  company even if you haven't opened it before. Each company is listed once,
  however its link was spelled.
- FetchXML in the query builder is shown in colour.
  ([003](enhancements/2026.10.x/003-fetchxml-syntax-colours.md))
- Drag the divider between the query and the results to resize them, in both
  query builders. ([004](enhancements/2026.10.x/004-query-builder-resizable-split.md))

### Fixed

- Logical-name badges on Dynamics 365 forms sometimes showed part of an ID
  instead of the name, and squeezed field labels to one letter per line.
  ([002](enhancements/2026.10.x/002-ce-form-logical-name-badges.md))
- The query builder didn't open on some pages: Chrome refused to inject its
  script because of certain Unicode characters in it.
- Chrome, the panel and the help page still showed version 2026.9.25 after
  updating. The version now comes from one place, so it's always current.

### Companion app (2026.9.30.1)

- **Moved to its own repository**,
  [Dynamic-Assist_BusinessCentralAddon](https://github.com/garethcheyne/Dynamic-Assist_BusinessCentralAddon),
  built with Microsoft's AL-Go for GitHub (CodeCop, UICop and
  PerTenantExtensionCop on every build) and released from there. The
  extension's download and help links point to it; earlier releases stay in
  this repository.
- Declares the Base Application through `application` (PTE0020).
- **Couplings API** (`…/api/err403/dynamicassist/v1.0/…/couplings`): the
  Business Central records coupled to a Dataverse row, or the reverse, with
  each record's table, key, page and sync state. Read-only, as the caller.
  With the Business Central Virtual Table app installed it can be made
  visible as a Dataverse virtual table; `crmId` and `integrationId` are text
  so Dataverse can filter on them. See the
  [companion README](https://github.com/garethcheyne/Dynamic-Assist_BusinessCentralAddon#couplings-dataverse-integration-records).
- The couplings API reads CRM Integration Record (5331) directly instead of
  a temporary table, so the Business Central Virtual Table app can use it in
  Dataverse. The app now depends on the Base Application (25.0 or later), and
  without a filter the API pages through every coupling rather than returning
  none.

## [2026.9.25] — 2026-09-25

First release on the Chrome Web Store and Edge Add-ons.

### Added

- **Business Central**: page details (page and table IDs, page type, owning
  app, record keys); every field on the page with its value, searchable and
  copyable; FactBoxes and subpages; session details; field names and numbers
  beside captions and column headers; blur, expand FastTabs and copy record
  link; go to any object by number. It all comes from the web client itself,
  without starting a second session the way the page inspector does.
- **Business Central query builder** (with the companion app): query any table
  you can read, with filters, joins and sorting; see all fields of a record;
  open the Dynamics 365 record it's coupled to; export to Excel, CSV or JSON.
- **Dynamics 365**: record details and all columns; god mode, logical names,
  expand tabs, fill required, clone, refresh subgrids and blur; list view
  FetchXML and Web API; form, ribbon and performance debug switches; an Errors
  tab for script errors and failed requests; go to any table; security roles,
  access checks, user comparison and impersonation; the Business Central
  records coupled to a record.
- **Dynamics 365 query builder**: build or edit FetchXML over the page, run it
  with your permissions, and export the results. Save queries and run them in
  any environment, and export or import them as a file. Up to 5,000 rows, 500
  by default.
- **Power Apps maker portal**: environment and solution IDs, shortcuts, and a
  solution's flows, connection references and environment variables.
- **Power Automate**: turn many flows on or off at once; the current flow's
  details, definition and runs; connection references and environment
  variables that need attention.
- **Everywhere**: the Go anywhere menu, a home page, History with pins and
  names, light and dark themes, and a full help page.

[Unreleased]: https://github.com/garethcheyne/Dynamic-Assist/compare/89b26ea...HEAD
[2026.9.25]: https://github.com/garethcheyne/Dynamic-Assist/tree/89b26ea
