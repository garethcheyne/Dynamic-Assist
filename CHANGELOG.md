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

## [2026.11.16] — 2026-11-16

### Added

- **Buy me a coffee**: a link on the home page and in About, for anyone who'd
  like to say thanks. It's a plain link; nothing loads until you click it.
- **Pop out**: the More menu opens the panel in a window of its own, to move,
  size or put on another screen. It follows the tab you're working in, in the
  browser window you used last, and Dock to side panel puts it back.
- **Hide the welcome card**: the card at the top of the home page has a ×
  to hide it, and Settings → Home page shows it again.

### Fixed

- **Power Apps environment names**: the home page, History and the Go
  anywhere menu showed a Power Apps environment by its ID when the portal's
  environment picker couldn't be read. They now show its name (from the
  picker, the Dynamics 365 org in the same environment, or the environment's
  own Dataverse) with the ID underneath in History and in the home card's
  tooltip.

### Changed

- **Help is the website's docs**: Help, on the home page and in the More
  menu, opens the docs on dynamicassist.err403.com at the product you're in,
  instead of a help page built into the extension. The docs cover the same
  tools, with pictures and search, and are kept up to date between releases.
  The built-in help page is gone, which makes the extension smaller.
- **What's new is the website's changelog**: What's new opens the changelog on
  dynamicassist.err403.com at your version. The extension no longer downloads
  the changelog from GitHub, so it talks only to the Microsoft services you're
  using.
- **About shows the website**: About & credits links dynamicassist.err403.com
  by name, with its docs, changelog, feedback page and privacy policy, instead
  of a small "Website" link next to the author's name.
- **Two privacy policies on the website**: what the extension and the
  companion app do stays on the privacy page; what the website itself keeps
  (visit counts and feedback) is now on its own page, and the help's privacy
  tab links both.

## [2026.11.15] — 2026-11-15

### Added

- **Website**: dynamicassist.err403.com has the docs, the changelog, downloads
  and a feedback page. **Feedback** on the panel's home page, **Report a
  problem** on the help page, **Help build it** in About and **Report it** after
  a crash now open that page, with the version (and after a crash, the message)
  filled in, instead of GitHub issues. The help page's Privacy tab links to the
  privacy policy for every err403 extension, which the store listings now point
  to, and to the website's privacy page.
- **SQL in the Business Central query builder**, with suggestions from your own
  tables, fields, lookups and option values as you type, and checks that say what
  can't be translated and why. Business Central has no SQL of its own, so this
  compiles to the query the builder runs, read-only, with your permissions. Joins,
  LIKE, IN, BETWEEN, TODAY(), DATEADD(), YEAR() and UPPER(); COUNT, SUM, AVG, MIN,
  MAX and GROUP BY are worked out in your browser, across up to 50,000 rows. The
  builder's SQL tab shows a built query as SQL, and SQL queries can be saved.
  ([007](enhancements/2026.10.x/007-bc-sql-queries.md))
- **When the companion app isn't installed**, Business Central says so within
  seconds and the extension listens: the query builder, Query this table, All
  fields and the Dynamics 365 record lookup are turned off in that environment,
  the panel's database buttons take you to the Tools tab, and both the Tools tab
  and the builder say what's wrong in Business Central's own words, with the
  install steps, **Download**, **Copy for your admin** and **Check again**.
  Before, the builder waited up to two and a half minutes, and a background
  lookup up to three, before saying it couldn't reach the companion, and left
  its tab behind. It's checked again after a day, or as soon as the companion's
  page opens.
- **Download the companion as an .app**: the install steps' Download button and
  links get DynamicAssistCompanion.app, ready to upload, from the website,
  instead of a zip to unzip first.
- **Links to the website**: the store listing, the README and the help page
  link to the website's docs and its feedback page. The companion install steps
  in the panel and the query builder link to the website's companion page.
- **Pick several fields at once** in both query builders: tick as many as you
  like in the column list, across different searches or with **Select all
  shown**, then press **Add**. Enter still adds the highlighted field straight
  away; Esc closes the list without adding.
  ([009](enhancements/2026.10.x/009-bc-pick-several-fields.md))
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

- **Business Central and Dynamics 365 panels are laid out the same way**, so what
  you learn on one you can find on the other. The Tools tab goes Query, then Page
  or Form, then Record, with the same tiles first in each. The summary card and
  the top bar have the same buttons in the same order, and Go to starts the same.
  ([010](enhancements/2026.10.x/010-panel-layout-consistency.md))
- **New in Dynamics 365, to match:** Query this table, Table data, Copy record
  link and All columns on the Tools tab, and the query builder and admin center
  in the top bar. **New in Business Central:** Copy record link on the Page tab.
- In the Dynamics 365 Tools tab, Refresh, Save, Fill required and Clone record are
  now under **Record**. The Web API button has a new icon, so the database icon
  means the query builder in both panels.
- **Repository layout**: the extension and companion repositories now sit
  together in a `Dynamic-Assist-Workspace` folder, so the build and store
  scripts look for `extension-publisher` two folders up.
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
- Coupled records only offer the Business Central companies connected to the
  org: the ones Business Central created a business unit for, the Virtual Table
  app's companies, and companies the companion has said sync with it. Companies
  that sync with another org aren't offered. With one company, there's nothing
  to pick: it just says which company it looks in.
- FetchXML in the query builder is shown in colour.
  ([003](enhancements/2026.10.x/003-fetchxml-syntax-colours.md))
- Drag the divider between the query and the results to resize them, in both
  query builders. ([004](enhancements/2026.10.x/004-query-builder-resizable-split.md))
- Development uses pnpm instead of npm (`pnpm install`, `pnpm dev`,
  `pnpm build`; `pnpm run store` for the store scripts, since `pnpm store` is
  pnpm's own command). `pnpm-lock.yaml` replaces `package-lock.json`, with the
  same dependency versions.

### Fixed

- In Business Central, if a tab had shown the companion's query page and then
  moved on, the query builder still thought the companion was open there. Opened
  again, it stayed on your page and quietly opened the query page in a hidden
  tab, instead of loading it in this tab. The extension now asks the tab whether
  the companion is still there, and forgets it if not.
- Help corrections: the query builder's **Related tables** section is only in
  Business Central, and the Dynamics 365 **Go to** tab's **You** section (your
  user record and mailbox) and **My apps** are now described as the panel shows
  them.
- Tooltips in the query builder appeared behind its window, so you could only see
  the edge of them. On Business Central they also wrapped to one word per line.
- In a narrow results pane, the Export buttons and the row count were cut off.
  They now wrap onto a second line.
- Business Central SQL could return the wrong rows when a query mixed AND and OR
  without brackets, such as `City = 'A' AND Name = 'B' OR Name = 'C'`: it ran as
  if the ORs were bracketed. It now asks for brackets instead of guessing.
- Dynamics 365 SQL now underlines four more things Microsoft's page says won't
  run: OR at the top level of a join's ON, a join condition on the wrong table,
  comparing two fixed values such as `1=1`, and sums such as `500 + 125`. It also
  no longer flags a valid query because a text value happens to be `'ON'`, and it
  warns about `OFFSET … FETCH`, which Dataverse accepts while ignoring the limit.
- Logical-name badges on Dynamics 365 forms sometimes showed part of an ID
  instead of the name, and squeezed field labels to one letter per line.
  ([002](enhancements/2026.10.x/002-ce-form-logical-name-badges.md))
- The query builder didn't open on some pages: Chrome refused to inject its
  script because of certain Unicode characters in it.
- Chrome, the panel and the help page still showed version 2026.9.25 after
  updating. The version now comes from one place, so it's always current.
- Business Central kept opening extra Dynamic Assist Query tabs, and the query
  builder could stop at "Read the list of tables". The page opens as a dialog,
  so Business Central drops its number from the URL, and the extension couldn't
  recognise it. It now goes by the page's own hello: one tab per company, which
  everything waits for and reuses, including through a slow sign-in.
- Features that open the query page in the background could wait two minutes
  and then say the companion was missing: the old dialog page doesn't answer
  from a tab that has never been on screen. With a companion before 2026.11.6.2,
  that tab now shows for a moment, once, and the one you were on comes back.
  From 2026.11.6.2 it answers from the background.
- Esc and Ctrl+Enter did nothing in the query builder until you clicked inside
  it, and keys went to the page underneath. It now keeps the keyboard while
  it's open, and hands it back when you close or minimise it.
- **Logical names** in Dynamics 365 could come back straight after you turned it
  off, and stay until you reloaded, if the page was redrawing at that moment.
- Ctrl+Enter in one of the query builders' pickers chose the first item in its
  list, which could change the table, instead of running the query. It now runs
  the query from there too.
- SQL suggestions in the Dynamics 365 query builder came up empty after an alias
  and a dot, as in `SELECT a.` with `FROM account a` already written after it.
- SQL in the Dynamics 365 query builder could return more rows than `TOP` asked
  for: `TOP 10` gave 20 with Rows set to 20. `TOP` now decides, up to the 5,000
  limit, and a query with `TOP` no longer says more rows match.
- **Clone record** could give a form that wouldn't save, with a "duplicate value"
  error: it copied columns Dataverse sets itself, such as the IDs of an account's
  address rows, and ones that must be unique. It now leaves those out.
- A Dynamics 365 record could open with an empty field list in the panel, until
  you reloaded it: reading the form while it was still loading left it empty.
- **Refresh** on a Dynamics 365 form with unsaved edits spun for 45 seconds and
  then said the page hadn't answered, while Dynamics 365 was waiting for you to
  choose. It now says so straight away.
- The right-click menu's **Microsoft links** had no separators between groups.
- Without the DA QUERY permission set, the query builder could say the companion
  app wasn't installed, instead of that you don't have access.
- **God mode** stayed lit after you moved on to another record that wasn't
  unlocked.
- Help and tooltips corrected: Logical names adds to labels rather than replacing
  them, Copy FetchXML gives the saved view without your changes on the page, and
  Clone record's list of what it leaves out.
- **All fields** in Business Central left out FlowFields, though it says it
  includes them, so a customer's Balance was missing.
- A query page that was still starting could be reloaded by another request
  before it finished.
- Settings couldn't see open companion query pages, so **Close query pages**
  didn't close them.

- A saved query on a table the environment doesn't have opened Customer without
  saying so. It now says the table isn't there, and runs nothing.
- **Field names** in Business Central opened a companion query page even when no
  companion was installed, and kept trying for minutes. It now only reads other
  extensions' names once the query builder has been used in that environment.
- **Copy record link** in Business Central left out the company when the tab's URL
  didn't name it, so the link could open in someone's default company.
- A Business Central page tool could stay busy forever if the page had gone.
- **Copy record link**, **All fields** and **Dynamics 365 record** were available on
  Business Central list pages, acting on whichever row was selected, though they
  say they need a single record. They're now off on lists.
- **Field names** could put a badge on the wrong list, and the right-click menu
  could pick the wrong field, when two lists on a page share a column caption.
- **Clone record** said it had opened a new form even when Dynamics 365 refused.
- **Access** showed "None" when Dataverse didn't answer. It now says "Couldn't
  check", which doesn't mean they have none. System Administrator is recognised in
  any language and when it comes through a team.
- **Suspended flows** counted as Off. They now show as Suspended, and aren't in the
  Off list or its count; All still lists them.
- Choosing a flow in Power Automate no longer forgets the solution you picked.
- In Dynamics 365 SQL, a saved query on another table went back to the builder as
  it opened, and the next switch to SQL overwrote it. It now stays in SQL.
- Dynamics 365 SQL with no `TOP` used the builder's hidden Rows value. Going from
  the builder to SQL now writes it into the query as `TOP n`; otherwise the default
  limit applies. Exports are named after the SQL's own table, and anything other
  than one `SELECT` is refused before it's sent.
- A view or query with no `distinct` setting ran as distinct when opened in the
  Dynamics 365 builder.
- Returning to the Tools tab could search Option sets again for an old right-click.
- The right-click menu could act on your previous right-click if you clicked inside
  a frame in Dynamics 365.
- Saving tables and fields to the cache at the same moment could lose one of them.
- Settings didn't notice query pages being opened or closed while it was open.

### Companion app (2026.11.15)

- **Links to the website**: the Dynamic Assist Query page's Full documentation
  link, and the Help, Website and Privacy links Business Central shows for the
  app, go to the website's companion page, home and privacy page, and the page
  links to the feedback page.

### Companion app (2026.11.6)

- **Dynamic Assist Query is a full page again**, not a dialog: no OK or Cancel
  to close it by accident, and Business Central stays usable around it. It now
  says to keep the tab open, and what happens if you close it.
- The **Dynamic Assist Query** page's Chrome Web Store and Microsoft Edge
  Add-ons buttons now link to the extension's listings instead of showing
  "Coming soon".
- Its README covers installing from the Business Central admin center, which
  Microsoft now recommends, and its security policy, support page and code
  owners are its own instead of the AL-Go template's Microsoft ones.
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
