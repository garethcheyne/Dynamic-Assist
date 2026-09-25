import { LifeBuoyIcon } from "lucide-react"

import type { HelpTab } from "../types"

export const START: HelpTab = {
  id: "start",
  title: "Getting started",
  icon: <LifeBuoyIcon />,
  platform: "none",
  intro: (
    <>
      Dynamic Assist is a side panel of admin and developer tools for Business
      Central, Dynamics 365 apps, the Power Apps maker portal and Power
      Automate. It reads the page you're on and shows what's behind it, and it
      takes you to the admin and developer pages that go with it.
    </>
  ),
  groups: [
    {
      title: "First steps",
      tools: [
        {
          id: "open",
          name: "Open the panel",
          what: (
            <>
              Click the <b>Dynamic Assist</b> icon in the browser toolbar (pin
              it from the puzzle-piece menu so it's always there). The panel
              opens beside the page and stays open as you move between tabs.
            </>
          ),
          how: (
            <>
              The panel follows the active tab. On Business Central it shows the
              Business Central tools, on a Dynamics 365 app the Dynamics 365
              tools, and so on, in that product's colours. On any other site it
              shows the home page.
            </>
          ),
          steps: [
            "Open Business Central, a Dynamics 365 app, make.powerapps.com or make.powerautomate.com.",
            "Click the toolbar icon.",
            "Just installed or updated? Reload the tab once so the extension can read it.",
          ],
        },
        {
          id: "sign-in",
          name: "Your sign-in and your permissions",
          what: (
            <>
              There's nothing to sign in to. Everything runs as you, in the
              session you already have, with the permissions you already have.
            </>
          ),
          how: (
            <>
              The panel reads the page itself, and calls that service's own API
              from your browser, the same way the page does. It never sees your
              password or sign-in tokens. If you can't read a table in Business
              Central or Dataverse, Dynamic Assist can't either.
            </>
          ),
        },
      ],
    },
    {
      title: "Everyday actions",
      intro: "These work the same way on every product.",
      tools: [
        {
          id: "copy",
          name: "Copy a name or a value",
          what: (
            <>
              Hover a field in any field list for <b>copy name</b> (the{" "}
              <b>{"{}"}</b> icon) and <b>copy value</b>. The <b>⋯</b> menu has
              more formats: an AL reference, API and OData names in Business
              Central; Web API names and FetchXML in Dynamics 365.
            </>
          ),
        },
        {
          id: "copy-json",
          name: "Copy JSON",
          what: (
            <>
              On a field list, <b>Copy JSON</b> copies every field shown, as one
              object of name and value. Filters apply, so filter first to copy
              only what you need.
            </>
          ),
        },
        {
          id: "filters",
          name: "Search and filter",
          what: (
            <>
              Field lists have a search box and filter chips: has a value,
              changed, required, added by an extension, FlowFields, hidden. The
              chips combine.
            </>
          ),
        },
        {
          id: "label-or-name",
          name: "Labels or logical names",
          what: (
            <>
              The <b>Label | Name</b> switch above a field list shows each field
              by its label, as on the page, or by its logical (schema) name; the
              other one is on hover. It applies to every list in both products
              and is remembered.
            </>
          ),
        },
        {
          id: "hints",
          name: "Hover for more",
          what: (
            <>
              Hover a button, badge or label for what it does and where the
              value comes from. On the page itself, the field-name and
              logical-name badges show the field's type and details.
            </>
          ),
        },
        {
          id: "sections",
          name: "Collapse what you don't use",
          what: (
            <>
              Click a section's title to fold it away. The panel remembers which
              ones you've collapsed.
            </>
          ),
        },
      ],
    },
  ],
}
