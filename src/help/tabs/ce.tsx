import ceLogo from "@/assets/brand/ms/dynamics-365.svg"

import type { HelpTab } from "../types"

export const CE: HelpTab = {
  id: "ce",
  title: "Dynamics 365",
  icon: <img src={ceLogo} alt="" />,
  platform: "ce",
  intro: (
    <>
      On any model-driven app (Sales, Customer Service, Field Service or your
      own) the panel reads the form or view through the app's own client API,
      and asks the organisation's Web API for anything the page doesn't hold.
      Both run as you. It has four tabs: <b>Record</b>, <b>Tools</b>,{" "}
      <b>Go to</b> and <b>Session</b>.
    </>
  ),
  groups: [
    {
      title: "Record tab",
      tools: [
        {
          id: "record",
          name: "Record details",
          where: "Record tab",
          what: (
            <>
              The table's logical name, the record ID, the form, the entity set
              (the Web API's name for the table), the primary key and the object
              type code. Buttons copy a link to the record, open it in the Web
              API as JSON, open it in a new tab and refresh the form's data.
            </>
          ),
        },
        {
          id: "form-fields",
          name: "Form fields",
          where: "Record tab",
          what: (
            <>
              Every field on the form with its logical name, value, required
              level and whether it's read-only. Filter to fields with a value,
              fields changed since the form loaded, required fields, or include
              hidden ones. Copy names as Web API names or for FetchXML from the{" "}
              <b>⋯</b> menu.
            </>
          ),
          how: "Read live from the form (Xrm), so unsaved changes show as changed.",
        },
        {
          id: "all-columns",
          name: "All columns",
          where: "Record tab",
          what: (
            <>
              Every column of the record from the Web API, including those the
              form doesn't show, with formatted values beside raw ones (option
              labels, lookup names).
            </>
          ),
          how: "One Web API read of the record when you click Load columns.",
        },
        {
          id: "access",
          name: "Access",
          where: "Record tab",
          what: (
            <>
              What a user can do with this table and this record. By default
              it's you; pick anyone else in the org to check them instead.
              <ul>
                <li>
                  <b>Table privileges</b>: Create, Read, Write, Delete, Append,
                  Append To, Assign and Share, each with its level: User, BU
                  (business unit), BU + child, or Org.
                </li>
                <li>
                  <b>This record</b>: which of those rights they actually have
                  on the open record.
                </li>
                <li>
                  <b>Lookups and subgrids</b> on the form: whether they can see
                  each one, set it, add new or existing rows, and what's missing
                  when they can't (for example "Can't read Contact: the lookup
                  shows blank").
                </li>
                <li>
                  <b>Secured columns</b>: the table's column-security
                  (field-level security) columns and whether they can read,
                  update or create each. Unreadable ones show as ••••• to them.
                </li>
                <li>
                  <b>Why they can reach this record</b>: whether they or their
                  team own it, whether it's in their business unit (which
                  decides if User and BU levels reach it), and who it's shared
                  with.
                </li>
              </ul>
            </>
          ),
          how: (
            <>
              Uses Dataverse's own security functions (RetrievePrincipalAccess,
              RetrieveUserPrivilegeByPrivilegeName,
              RetrievePrincipalAttributePrivileges,
              RetrieveSharedPrincipalsAndAccess) and the user's roles, direct
              and through teams. Not checked: hierarchy security, business rules
              and scripts that hide or lock fields, and which apps their roles
              can open.
            </>
          ),
          needs: (
            <>
              Checking someone else needs read access to users and security
              roles, which most admins and customisers have. Dataverse decides:
              you only see what you're allowed to.
            </>
          ),
          steps: [
            "Open a record and go to the Record tab's Access section.",
            "Pick a user from the search box (or leave it on you).",
            "Read the table rights, then the lookups and subgrids below them.",
          ],
        },
        {
          id: "compare",
          name: "Compare two users",
          where: "Record tab, Access",
          what: (
            <>
              Puts two users side by side for this table: the privileges and
              levels that differ, the security roles only one of them has (and
              the ones they share), and their differences on lookups, subgrids
              and secured columns. The fastest answer to "it works for me but
              not for them".
            </>
          ),
          how: (
            <>
              A role held only through a team is shown dashed; hover a role to
              see where it comes from.
            </>
          ),
        },
        {
          id: "coupled-bc",
          name: "Business Central",
          where: "Record tab",
          what: (
            <>
              Finds the Business Central records coupled to this one (an account
              to a customer, a product to an item) and opens them.
            </>
          ),
          how: (
            <>
              Business Central holds the couplings, so the panel asks the
              companion app in a Business Central company you've opened before,
              the one you last used for this org, and checks that company syncs
              with this org.
            </>
          ),
          needs: (
            <>
              The Business Central company opened once in this browser, with the
              Dynamic Assist Companion app installed there.
            </>
          ),
        },
      ],
    },
    {
      title: "Tools tab: form",
      intro:
        "These act on the open form, in this tab only. Nothing is saved unless you save the record.",
      tools: [
        {
          id: "god-mode",
          name: "God mode",
          where: "Tools tab",
          what: (
            <>
              Shows every hidden field, tab and section, unlocks read-only
              fields and makes required fields optional, until you reload.
              Server-side rules and security still apply when you save.
            </>
          ),
        },
        {
          id: "logical-names",
          name: "Logical names",
          where: "Tools tab",
          what: (
            <>
              On a form, replaces each label with the field's logical name and
              adds a copy button. On list views and subgrids, adds the column's
              logical name to each header, in Dynamics 365 colours. Hover a
              badge for the column's display name, type, table and (for linked
              columns) the relationship it comes through.
            </>
          ),
          how: "Turn it off or reload to go back.",
        },
        {
          id: "expand-tabs",
          name: "Expand tabs",
          where: "Tools tab",
          what: "Opens every tab on the form so all its sections load and are searchable.",
        },
        {
          id: "refresh-subgrids",
          name: "Refresh subgrids",
          where: "Tools tab",
          what: "Reloads every subgrid without refreshing the page, for example after a flow or plug-in created related rows.",
        },
        {
          id: "fill-required",
          name: "Fill required",
          where: "Tools tab",
          what: (
            <>
              Puts placeholder values into empty required fields (text, numbers,
              dates, the first option) to save a test record quickly. They're
              real data once you save.
            </>
          ),
        },
        {
          id: "clone",
          name: "Clone record",
          where: "Tools tab",
          what: (
            <>
              Opens a new form filled with this record's values, but not its ID,
              owner or system fields. Nothing is created until you save.
            </>
          ),
        },
        {
          id: "refresh-save",
          name: "Refresh and Save",
          where: "Tools tab",
          what: (
            <>
              <b>Refresh</b> reloads the form's data without saving (unsaved
              changes are lost). <b>Save</b> is the same as Ctrl+S, with the
              form's events, business rules and plug-ins.
            </>
          ),
        },
        {
          id: "blur",
          name: "Blur data",
          where: "Tools tab",
          what: "Blurs values on the form and in grids for screenshots and screen sharing; labels stay readable.",
        },
      ],
    },
    {
      title: "Tools tab: lists and debugging",
      tools: [
        {
          id: "fetchxml",
          name: "Copy FetchXML",
          where: "Tools tab, List view",
          what: (
            <>
              Copies the FetchXML of the list you're looking at, with your
              current filters and sort, ready for XrmToolBox, the query builder
              or code.
            </>
          ),
        },
        {
          id: "view-web-api",
          name: "View in Web API",
          where: "Tools tab, List view",
          what: (
            <>
              Opens the view's rows as raw JSON from the Web API, with formatted
              values: what an integration would actually receive.
            </>
          ),
        },
        {
          id: "open-view",
          name: "Query builder and Open this view",
          where: "Tools tab, Query",
          what: (
            <>
              Opens the query builder over the page, either empty or with the
              current view's columns, filters and sort. See the Query builder
              tab.
            </>
          ),
        },
        {
          id: "debug",
          name: "Form monitor, Ribbon debug, Performance",
          where: "Tools tab, Debug",
          what: (
            <>
              <b>Form monitor</b> opens Power Apps Monitor for this form
              (events, scripts and network calls). <b>Ribbon debug</b> reloads
              with the Command Checker, which explains why each command bar
              button is shown or hidden. <b>Performance</b> reloads with the
              performance panel.
            </>
          ),
        },
      ],
    },
    {
      title: "Go to tab",
      tools: [
        {
          id: "tables",
          name: "Any table",
          where: "Go to tab",
          what: (
            <>
              Search tables by display or logical name, then open its list, a
              new form, or a record by ID.
            </>
          ),
          how: "The table list comes from the org's metadata, read the first time you search.",
        },
        {
          id: "nav-shortcuts",
          name: "Admin, customise and developer shortcuts",
          where: "Go to tab",
          what: (
            <>
              <b>Administration</b>: this environment in the Power Platform
              admin center, classic settings, security, system jobs, processes,
              mailboxes, diagnostics. <b>Customise</b>: solutions in the maker
              portal, solution history, classic Advanced Find. <b>Developer</b>:
              the Web API, its service document and entity metadata.{" "}
              <b>Other orgs</b>: the other Dynamics 365 orgs in your History.{" "}
              <b>Me</b>: your mailbox record.
            </>
          ),
        },
      ],
    },
    {
      title: "Session tab",
      tools: [
        {
          id: "ce-session",
          name: "You, the app and the environment",
          where: "Session tab",
          what: (
            <>
              Your name, user ID, language and time zone; your security roles;
              the app you're in (name, unique name, ID); and the environment:
              its name, URL, org ID and unique name, version, tenant and Power
              Platform environment ID.
            </>
          ),
        },
        {
          id: "impersonate",
          name: "Impersonate",
          where: "Session tab",
          what: (
            <>
              Runs this tab as another user, so you see the forms, records and
              buttons they see. The tab reloads as them until you click{" "}
              <b>Stop impersonating</b>.
            </>
          ),
          how: (
            <>
              Adds Dataverse's MSCRMCallerID header to this tab's requests to
              this org only. It's removed when you stop, close the tab or
              restart the browser.
            </>
          ),
          needs: (
            <>
              The <b>Act on Behalf of Another User</b> privilege (System
              Administrators have it). Without it the app's requests fail until
              you stop.
            </>
          ),
        },
      ],
    },
  ],
}
