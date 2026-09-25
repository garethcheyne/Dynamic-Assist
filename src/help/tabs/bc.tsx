import bcLogo from "@/assets/brand/ms/business-central.svg"

import type { HelpTab } from "../types"

const COMPANION = (
  <>
    The free <b>Dynamic Assist Companion</b> app installed in the environment,
    and the <b>DA QUERY</b> permission set. See the Query builder tab.
  </>
)

export const BC: HelpTab = {
  id: "bc",
  title: "Business Central",
  icon: <img src={bcLogo} alt="" />,
  platform: "bc",
  intro: (
    <>
      On businesscentral.dynamics.com the panel reads the page you have open
      from the web client itself. Unlike the page inspector it doesn't start a
      second session, so it's instant and doesn't disturb the page. It has five
      tabs: <b>Page</b>, <b>Parts</b>, <b>Tools</b>, <b>Go to</b> and{" "}
      <b>Session</b>.
    </>
  ),
  groups: [
    {
      title: "Page tab",
      tools: [
        {
          id: "page",
          name: "Page details",
          where: "Page tab",
          what: (
            <>
              The page and table IDs and names, the page type, the app and
              version that own the page, and for a record its primary key,
              SystemId and bookmark. Buttons open the page in a new tab, open
              the table's data (Business Central's own table view) and query the
              table in the query builder.
            </>
          ),
          how: (
            <>
              A script in the page reads the web client's own model of the form:
              the same objects the client uses to draw it. Nothing is asked of
              the server, so the numbers are exactly what the page is showing.
            </>
          ),
        },
        {
          id: "fields",
          name: "Fields",
          where: "Page tab",
          what: (
            <>
              Every field on the page with its value, grouped by FastTab. Filter
              to fields with a value, fields added by an extension, FlowFields
              and FlowFilters, or include fields hidden on the page. Copy a
              field's schema name or value, or from the <b>⋯</b> menu as an AL
              reference (<code>Rec."No."</code>), API name or OData name.
            </>
          ),
          how: (
            <>
              Names come from the page's controls and are cleaned of the
              suffixes Business Central adds to control names. Each field's app
              comes from the control itself, so a field added by a pageextension
              is marked with the extension it came from.
            </>
          ),
        },
      ],
    },
    {
      title: "Parts tab",
      tools: [
        {
          id: "parts",
          name: "FactBoxes and subpages",
          where: "Parts tab",
          what: (
            <>
              Each FactBox and subpage (lines, for example) with its own page
              and table IDs and its own field list. The subpage's fields are
              those of its current line.
            </>
          ),
        },
      ],
    },
    {
      title: "Tools tab",
      intro: "Tools that act on the page. Click one again to turn it off.",
      tools: [
        {
          id: "field-names",
          name: "Field names",
          where: "Tools tab",
          what: (
            <>
              Puts the table field name and number beside every caption on the
              page and on every list column header. Click a badge to copy the
              name. Hover it for the field's number, type and class (normal,
              FlowField, FlowFilter), whether it's editable, and the{" "}
              <b>app that added it</b>, with a note when its number is in an
              extension's range.
            </>
          ),
          how: (
            <>
              The badges are drawn into the page in Business Central's colours
              and follow it as it scrolls and changes records. App names come
              from Business Central's list of installed apps (through the
              companion app, kept for a day); without the companion, Microsoft's
              own apps are still named and others show their app ID.
            </>
          ),
        },
        {
          id: "blur",
          name: "Blur data",
          where: "Tools tab",
          what: (
            <>
              Blurs every value on the page, leaving captions readable, for
              screenshots and screen sharing. Turn it off to see the values
              again.
            </>
          ),
        },
        {
          id: "expand",
          name: "Expand FastTabs",
          where: "Tools tab",
          what: "Opens every collapsed FastTab on the page at once.",
        },
        {
          id: "record-link",
          name: "Copy record link",
          where: "Tools tab",
          what: (
            <>
              Copies a link that opens this page on this record, with the
              company and bookmark, to paste into a ticket or a chat.
            </>
          ),
        },
        {
          id: "all-fields",
          name: "All fields",
          where: "Tools tab",
          what: (
            <>
              Every field of the record, including the ones the page doesn't
              show, with their values.
            </>
          ),
          how: "The companion app reads the record by its SystemId, as you.",
          needs: COMPANION,
        },
        {
          id: "coupled",
          name: "Dynamics 365 record",
          where: "Tools tab",
          what: (
            <>
              When the record is coupled to Dataverse (a customer to an account,
              an item to a product), opens the Dynamics 365 record it's coupled
              to in one click.
            </>
          ),
          how: (
            <>
              Business Central keeps the couplings in its own tables (CRM
              Integration Record, Integration Table Mapping and CRM Connection
              Setup). The companion reads them to find the Dataverse table, ID
              and org. The panel remembers which org goes with this company, so
              the header's grid menu links the two from then on.
            </>
          ),
          needs: (
            <>
              {COMPANION} The Dataverse connection set up in Business Central.
            </>
          ),
        },
        {
          id: "query-builder",
          name: "Query builder",
          where: "Tools tab, or the database icon",
          what: (
            <>
              Opens the query builder over the page you're on, on its table when
              it has one; pick any other table from there. Always available, on
              any page.
            </>
          ),
          needs: COMPANION,
        },
        {
          id: "query-table",
          name: "Query this table",
          where: "Tools tab, Page tab",
          what: (
            <>
              Opens the query builder on this page's table, ready to add filters
              and run.
            </>
          ),
          needs: COMPANION,
        },
      ],
    },
    {
      title: "Go to tab",
      tools: [
        {
          id: "go-to",
          name: "Open any object",
          where: "Go to tab",
          what: (
            <>
              Pick page, table, report or query, type its number and press
              Enter: it opens in a new tab in this company. Tables open in the
              table view.
            </>
          ),
        },
        {
          id: "shortcuts",
          name: "Admin and developer pages",
          where: "Go to tab",
          what: (
            <>
              <b>Administration</b>: extensions, users, permission sets,
              effective permissions, Entra applications, feature management,
              company information, email accounts.
              <br />
              <b>Data and jobs</b>: job queue, change log, table information
              (sizes and record counts), retention policies, data
              administration, configuration packages.
              <br />
              <b>Developer</b>: performance profiler, event recorder, event
              subscriptions, web services, report layouts, sessions, profiles,
              assisted setup.
              <br />
              <b>Dynamic Assist</b>: the companion's query page and query log.
              <br />
              <b>You</b>: My settings and your user card.
            </>
          ),
        },
      ],
    },
    {
      title: "Session tab",
      tools: [
        {
          id: "session",
          name: "Session",
          where: "Session tab",
          what: (
            <>
              Your user name, security ID and email, role, company, language,
              region and time zone; the environment, tenant and platform
              version; and links to the Business Central admin center and the
              tenant's admin pages.
            </>
          ),
        },
      ],
    },
  ],
}
