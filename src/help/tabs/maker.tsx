import paLogo from "@/assets/brand/ms/power-apps.svg"

import type { HelpTab } from "../types"

export const MAKER: HelpTab = {
  id: "maker",
  title: "Power Apps",
  icon: <img src={paLogo} alt="" />,
  platform: "maker",
  intro: (
    <>
      On make.powerapps.com the panel works out which environment (and which
      solution) you're in and gives you everything that goes with it.
    </>
  ),
  groups: [
    {
      title: "This environment",
      tools: [
        {
          id: "environment",
          name: "Environment and solution",
          what: (
            <>
              The environment's name and ID, and the solution's ID when you're
              inside one, ready to copy.
            </>
          ),
          how: "Read from the address and the portal's environment picker.",
        },
        {
          id: "maker-links",
          name: "Go to",
          what: (
            <>
              The environment's solutions, tables, apps, flows (in Power
              Automate), solution history, maker home, its page in the Power
              Platform admin center, and its Web API service document. Once
              you've opened the environment's Dynamics 365 app, a link to that
              too.
            </>
          ),
        },
      ],
    },
    {
      title: "Inside a solution",
      intro:
        "Open a solution and the panel lists what in it most often needs attention after an import.",
      tools: [
        {
          id: "solution-flows",
          name: "Cloud flows",
          what: (
            <>
              The solution's cloud flows, with the same bulk on and off as in
              Power Automate (see the Power Automate tab).
            </>
          ),
        },
        {
          id: "connection-references",
          name: "Connection references",
          what: (
            <>
              Each connection reference in the solution, flagged when it has no
              connection yet: the usual reason imported flows won't turn on.
            </>
          ),
        },
        {
          id: "env-variables",
          name: "Environment variables",
          what: (
            <>
              Each environment variable with its value (or its default, marked
              as such), flagged when it has neither.
            </>
          ),
        },
      ],
    },
    {
      title: "How it reaches Dataverse",
      tools: [
        {
          id: "maker-org",
          name: "The environment's Dataverse org",
          what: (
            <>
              Flows, connection references and environment variables live in the
              environment's Dataverse org. The panel finds its address from the
              calls the portal itself has already made, checks it, and then
              reads from it with the session you already have.
            </>
          ),
          needs: (
            <>
              If it can't find the org yet, open a solution or a flow in the tab
              (the portal loads it then), or open the environment's Dynamics 365
              app once, and click <b>Try again</b>.
            </>
          ),
        },
      ],
    },
  ],
}
