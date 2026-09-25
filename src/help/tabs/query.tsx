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
              <b>Related tables</b>, <b>Sort</b> and <b>Options</b> (such as the
              row limit). Results are on the right, with the query as text
              beside them. <b>Run</b> with the button or Ctrl+Enter; close with
              Esc. It follows the panel's light or dark theme.
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
              and yes/no values picked from a list, linked tables, sort and a
              row limit. Switch to <b>FetchXML</b> to edit the query by hand and
              back to <b>Builder</b> to keep going. <b>Open this view</b> starts
              from the list you're looking at.
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
              related tables through lookup fields, sort, and set the row limit.
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
              When you open the builder, the panel looks for a tab with the
              Dynamic Assist Query page, and if there isn't one, opens it in the
              background and talks to it through the page.
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
