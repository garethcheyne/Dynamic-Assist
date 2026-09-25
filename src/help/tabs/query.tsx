import { DatabaseIcon } from "lucide-react"

import type { HelpTab } from "../types"

export const QUERY: HelpTab = {
  id: "query",
  title: "Query builder",
  icon: <DatabaseIcon />,
  platform: "none",
  intro: (
    <>
      A large query window that opens over the page, in Dynamics 365 and in
      Business Central. Pick a table and columns, add filters and related
      tables, run it as you, and export what you get. It never changes data.
    </>
  ),
  groups: [
    {
      title: "Both products",
      tools: [
        {
          id: "window",
          name: "The window",
          what: (
            <>
              The builder is on the left: <b>Columns</b>, <b>Filters</b>,{" "}
              <b>Related tables</b>, <b>Sort</b> and <b>Options</b> (such as a
              row limit). Results are on the right, with the query as text
              beside them. <b>Run</b> with the button or Ctrl+Enter. With no row
              limit, every matching row loads, page by page: the rows show as
              they arrive, <b>Stop</b> ends it early and <b>Load the rest</b>{" "}
              carries on. Only the rows in view are drawn, so large results
              scroll smoothly. It follows the panel's light or dark theme.
            </>
          ),
          how: (
            <>
              The window is drawn into the page in a sealed-off area of its own
              (a shadow root), so the page's styles and the builder's don't mix.
              Queries run from the page, in your session.
            </>
          ),
        },
        {
          id: "minimise",
          name: "Minimise and come back",
          what: (
            <>
              <b>Minimise</b> (or Esc) shrinks the builder to a tile in the
              bottom-right corner of the page, so you can use the page and come
              back to your query and results as they were. Open another builder
              and it gets its own tile: they stack, one above the other. Click a
              tile to bring it back; × closes it.
            </>
          ),
        },
        {
          id: "saved",
          name: "Saved queries",
          what: (
            <>
              <b>Saved</b> keeps the query you have under a name, and opens the
              ones you saved earlier: in this environment or org, or another
              one. Save with a name you already used to update it. <b>Export</b>{" "}
              writes them all to a file and <b>Import</b> reads one back, to
              move them to another browser or share them with a colleague.
            </>
          ),
          how: (
            <>
              Kept in this browser's extension storage. Dynamics 365 queries are
              saved as FetchXML; Business Central ones as the table and field
              numbers, so they open in any environment with the same tables.
              Fields the other environment doesn't have are left out, and the
              builder says which.
            </>
          ),
        },
        {
          id: "export",
          name: "Export",
          what: (
            <>
              Save the results as <b>Excel</b>, <b>CSV</b> or <b>JSON</b>. The
              file is named after the table and the time, and saved to your
              computer only.
            </>
          ),
        },
      ],
    },
    {
      title: "Dynamics 365",
      tools: [
        {
          id: "ce-builder",
          name: "FetchXML builder",
          where: "Tools tab → Query builder, or Open this view",
          what: (
            <>
              Build a FetchXML query without writing it: columns, filter groups
              (and/or) with operators that suit each column's type, option-set
              and yes/no values picked from a list, linked tables, sort and an
              optional row limit (empty loads every row, 5,000 at a time).
              Switch to <b>FetchXML</b> to edit the query by hand and back to{" "}
              <b>Builder</b> to keep going. <b>Open this view</b> starts from
              the list you're looking at.
            </>
          ),
          how: (
            <>
              Runs the FetchXML against the org's Web API, as you. Column and
              option metadata come from the org's table definitions.
            </>
          ),
        },
      ],
    },
    {
      title: "Business Central",
      intro: (
        <>
          Business Central has no API for reading any table, so its builder
          talks to a small companion app installed in the environment.
        </>
      ),
      tools: [
        {
          id: "bc-builder",
          name: "BC query builder",
          where: "Database icon in the panel, or Query this table",
          what: (
            <>
              Search tables by name or number, pick fields (FlowFields are
              dashed: they're calculated per row, so they slow a query down),
              filter them with simple conditions or in Business Central's own
              filter syntax (<code>{">20000"}</code>,{" "}
              <code>{"10000..20000"}</code>, <code>{"@*bike*"}</code>), join
              related tables through lookup fields, sort, and optionally limit
              the rows (empty loads them all).
            </>
          ),
        },
        {
          id: "al-api",
          name: "AL and API",
          where: "Results side",
          what: (
            <>
              <b>AL</b> turns your query into record code (SetRange, SetFilter,
              FindSet) and an API query object to add to your own extension.{" "}
              <b>API</b> shows the same query as a REST request, choosing the
              best route: an API page that's already installed and covers it,
              the Dynamic Assist endpoint, or your own custom API query.
            </>
          ),
        },
        {
          id: "companion",
          name: "Dynamic Assist Companion",
          what: (
            <>
              A free, open-source Business Central app (publisher ERR403, IDs
              77500–77509). It adds the <b>Dynamic Assist Query</b> page, which
              the builder opens over and talks to, and a <b>Query log</b> of who
              queried what.
              <ul>
                <li>
                  <b>Read-only.</b> It lists tables and fields and reads
                  records. The only thing it writes is its own query log.
                </li>
                <li>
                  <b>Your permissions.</b> It reads as you: a table you can't
                  read gives an error, and security filters apply.
                </li>
                <li>
                  <b>No new endpoints</b> unless an admin publishes its web
                  service. It answers only the browser tab that has its page
                  open.
                </li>
              </ul>
            </>
          ),
          how: (
            <>
              The builder opens over the page you're on. It talks to the
              companion through a tab on the Dynamic Assist Query page of the
              same environment and company: one you have open, or one it opens
              in the background the first time (that takes a minute) and keeps
              using. On the query page itself it talks to it directly.
            </>
          ),
          needs: (
            <>
              The app installed in the environment (Business Central 2024 wave 2
              or later), and the <b>DA QUERY</b> permission set for each user,
              alongside their normal permissions. <b>DA QUERY ADMIN</b> adds the
              query log. The app's source and install steps are in the
              repository's <code>bc-companion</code> folder. The same app powers{" "}
              <b>All fields</b>, the <b>Dynamics 365 record</b> link and app
              names on field badges.
            </>
          ),
        },
      ],
    },
  ],
}
