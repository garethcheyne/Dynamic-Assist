# 008 — Right-click menu

**Requested:** 2026-09-30
**Target release:** 2026.10.x
**Platform:** Business Central, Dynamics 365 / Dataverse (CE)

## Request

Make the most-used tools available from the right-click menu, such as showing
field labels (logical names / field names), so you don't have to open the side
panel.

## Change

A "Dynamic Assist" group in the right-click menu, only on BC and CE pages.
There are two kinds of item: tools you often turn on and off, and actions
that only make sense from a right-click because they work on the field under
the pointer. Anything that changes data, reloads the page or needs a picker
(fill required, clone, save, refresh, debug switches, impersonation) stays in
the panel, where it's explained.

| Dynamics 365 | Business Central |
| --- | --- |
| Copy logical name (field, label or column right-clicked) | Copy field name / Copy field number (field or column right-clicked) |
| Option set values (opens the panel on that column) | |
| Logical names on/off, God mode, Blur data on/off | Field names on/off, Blur data on/off, Expand FastTabs |
| Copy record ID, Copy record link, Open this view in the query builder | Copy record link, All fields of this record, Query this table |
| | On a selected number: Open page %s, Open table %s |
| Microsoft links (submenu) | Microsoft links (submenu) |

**Microsoft links** are the panel's Go-anywhere links (admin centres, build
tools, service health, docs), opened in a new tab. They're in a submenu at the
end of both page menus. The toolbar icon's own right-click menu has them too,
as Admin Centres, Build and Status & Docs submenus, so they work from any
page. The link list moved to `src/shared/portal-links.ts`, which has no
assets, so the service worker can import it. `sidepanel/portals.ts` adds the
icons.

How it works:

- **Which pages.** `documentUrlPatterns`: `*.crm<n>.dynamics.com` for CE and
  `businesscentral.dynamics.com` for BC. `*.dynamics.com` isn't used because it
  would also match BC.
- **The right-clicked element.** Each page-world script records the target
  of the last `contextmenu` event (capture phase). CE resolves it with
  `menu-target.ts` (grid `col-id`, field label ids, `data-id` of field
  containers and controls, tabs, sections), then asks Xrm for the column. BC
  matches the element to a control by `_id` (or `<id>lbl` for captions), and a
  list header or cell to its column caption.
- **Frames.** BC's client runs in an iframe, so the worker sends the item to
  the frame Chrome reports for the click (`info.frameId`).
- **Feedback.** The panel may be closed, so the result is shown as a short
  note on the page (`shared/page-note.ts`). Copying happens in the
  right-clicked frame because it has focus.
- **Option set values.** The side panel is opened during the click itself
  (Chrome requires this), then a session-storage intent tells the panel to go
  to Tools → Option sets, searched for that column.
- **BC field names from the menu.** Apps are named from Microsoft's list and
  the cache only. The companion's query page is never opened in the
  background from a right-click.
- **Permission.** `contextMenus` shows no install warning, so existing users
  aren't asked to approve it again.

## To test

- CE form: right-click a label, a field value, a header field and a subgrid
  column; Copy logical name should give the column each time.
- CE list: right-click a column header and a cell, including a linked-table
  column.
- CE and BC: check whether any grid shows its own right-click menu instead of
  Chrome's (the help page tells users to right-click the header in that
  case).
- BC card and list: Copy field name and number from a caption, a value and a
  column header, and from a FactBox part.
- The on/off items with the panel open: its tiles should follow the change.

Files: `src/background/context-menu.ts`, `src/shared/page-note.ts`,
`src/lib/panel-intent.ts`, `src/shared/portal-links.ts`, `src/lib/use-panel-intent.ts`,
`src/platforms/ce/menu-target.ts`, `src/platforms/ce/command.ts`,
`src/platforms/ce/main-world.ts`, `src/platforms/bc/page-tools.ts`, the two
content scripts, `manifest.json`, `store/privacy/permissions.md`,
`src/help/tabs/panel.tsx`. Tests: `tests/unit/ce/menu-target.test.ts`.
