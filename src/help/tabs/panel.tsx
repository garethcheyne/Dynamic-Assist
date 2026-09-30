import { PanelRightIcon } from "lucide-react"

import type { HelpTab } from "../types"

export const PANEL: HelpTab = {
  id: "panel",
  title: "Header & home",
  icon: <PanelRightIcon />,
  platform: "none",
  intro: (
    <>
      The panel is about the page you're on, but the header gets you anywhere
      else: the rest of this environment, Microsoft's admin centres, and the
      environments you've used before.
    </>
  ),
  groups: [
    {
      title: "Header",
      intro: "Left to right, after the product's logo and the page's name.",
      tools: [
        {
          id: "home",
          name: "Home and back",
          where: "House icon",
          what: (
            <>
              Opens the home page. On the home page the same button shows the
              product's logo: click it to go back to that product's tools.
            </>
          ),
        },
        {
          id: "launcher",
          name: "Go anywhere",
          where: "Grid icon",
          what: (
            <>
              A menu of places to go, each with a line saying what it is:
              <ul>
                <li>
                  <b>This environment</b>: from Business Central, its admin
                  center and, once linked, the Dataverse org it syncs with. From
                  Dynamics 365, the environment in the Power Platform admin
                  center, its solutions and flows, advanced settings, the Web
                  API and the Business Central companies it syncs with. From
                  Power Apps or Power Automate, the admin center, the other one,
                  and the Dynamics 365 app once you have opened it.
                </li>
                <li>
                  <b>Recent</b>: your last few environments.
                </li>
                <li>
                  <b>Admin Centres</b>: Microsoft 365, Power Platform, Business
                  Central, Entra, Azure, Exchange, Teams and Power BI.
                </li>
                <li>
                  <b>Build</b>: Power Apps, Power Automate, Copilot Studio and
                  Azure DevOps.
                </li>
                <li>
                  <b>Status & Docs</b>: Service Health, Message Center, and the
                  Business Central and Power Platform docs.
                </li>
              </ul>
              Ctrl-click opens a link in the background.
            </>
          ),
          how: (
            <>
              Links between a Business Central company and a Dynamics 365 org
              are learned as you use them (for example after opening a coupled
              record) and remembered in this browser.
            </>
          ),
        },
        {
          id: "history-button",
          name: "History",
          where: "Clock icon",
          what: "Every environment, org and company you've opened. See History below.",
        },
        {
          id: "theme",
          name: "Light and dark",
          where: "Sun or moon icon",
          what: (
            <>
              Switches the panel between light and dark. The query builder and
              the help page follow it.
            </>
          ),
        },
        {
          id: "more",
          name: "More",
          where: "⋮ menu",
          what: (
            <>
              <b>Help</b> opens this page at the product you're in.{" "}
              <b>About & credits</b> lists the projects Dynamic Assist builds on
              and how to help.
            </>
          ),
        },
      ],
    },
    {
      title: "Home page",
      tools: [
        {
          id: "home-page",
          name: "Home",
          what: (
            <>
              Shown when the tab isn't one of the four products, or when you
              click the house icon. One tile per product opens the environment
              you used last in it (Ctrl-click for a background tab). Below it
              are your History and the Microsoft admin centres.
            </>
          ),
        },
      ],
    },
    {
      title: "History",
      tools: [
        {
          id: "history",
          name: "History",
          what: (
            <>
              Every Business Central environment and company, Dynamics 365 org
              and Power Platform environment you open, newest first. Click one
              to open it again.
            </>
          ),
          how: (
            <>
              Kept in this browser only. <b>Pin</b> the ones you use to keep
              them at the top and give them a <b>friendly name</b> ("UAT", "Prod
              NZ"). <b>Clear</b> forgets everything except pinned entries.
            </>
          ),
        },
      ],
    },
    {
      title: "Settings and what's new",
      intro: "Both are in the panel's More menu (the three dots).",
      tools: [
        {
          id: "settings",
          name: "Settings",
          where: "More menu",
          what: (
            <>
              Clears what the query builder keeps about each Business Central
              environment (its table list and the fields of tables you've
              opened), one environment or all at once, so it reads them again.
              It also closes open companion query pages, to see the builder's
              first-run steps again.
            </>
          ),
        },
        {
          id: "whats-new",
          name: "What's new",
          where: "More menu",
          what: (
            <>
              What changed in each release, in a browser tab. It&apos;s read
              from GitHub when you open it, so it's current without an update.
              Offline, it shows the copy that came with your version.
            </>
          ),
        },
      ],
    },
    {
      title: "Right-click menu",
      intro: (
        <>
          On Business Central and Dynamics 365 pages, right-click and choose{" "}
          <b>Dynamic Assist</b> for the tools you use most, without opening the
          panel. A short note at the bottom of the page says what happened.
        </>
      ),
      tools: [
        {
          id: "context-menu-ce",
          name: "In Dynamics 365",
          where: "Right-click menu",
          what: (
            <ul>
              <li>
                <b>Copy logical name</b>: of the field, label or column header
                you right-clicked. Logical names don't need to be on.
              </li>
              <li>
                <b>Option set values</b>: opens the panel's Option sets on the
                choice field or column you right-clicked.
              </li>
              <li>
                <b>Logical names on/off</b>, <b>God mode</b> and{" "}
                <b>Blur data on/off</b>, as on the Tools tab.
              </li>
              <li>
                <b>Copy record ID</b>, <b>Copy record link</b>, and{" "}
                <b>Open this view in the query builder</b> on a list.
              </li>
            </ul>
          ),
        },
        {
          id: "context-menu-bc",
          name: "In Business Central",
          where: "Right-click menu",
          what: (
            <ul>
              <li>
                <b>Copy field name</b> and <b>Copy field number</b>: of the
                field (its caption or value) or list column you right-clicked.
                Field names don't need to be on.
              </li>
              <li>
                <b>Field names on/off</b>, <b>Blur data on/off</b> and{" "}
                <b>Expand FastTabs</b>, as on the Tools tab.
              </li>
              <li>
                <b>Copy record link</b>, <b>All fields of this record</b> and{" "}
                <b>Query this table</b> (the last two need the companion app).
              </li>
              <li>
                Select a number, such as 21, and right-click for{" "}
                <b>Open page</b> or <b>Open table</b> in a new tab.
              </li>
            </ul>
          ),
          how: (
            <>
              If a grid or control shows its own menu instead of the
              browser&apos;s, right-click its caption or column header instead.
            </>
          ),
        },
        {
          id: "context-menu-links",
          name: "Microsoft links",
          where: "Right-click menu, and the toolbar icon's",
          what: (
            <>
              The admin centres, build tools, service health and docs from the
              Go anywhere menu, opened in a new tab. They're at the end of the
              right-click menu on Business Central and Dynamics 365 pages, and
              on any page when you right-click the Dynamic Assist toolbar icon.
            </>
          ),
        },
      ],
    },
  ],
}
