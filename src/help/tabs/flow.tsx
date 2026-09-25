import flowLogo from "@/assets/brand/ms/power-automate.svg"

import type { HelpTab } from "../types"

export const FLOW: HelpTab = {
  id: "flow",
  title: "Power Automate",
  icon: <img src={flowLogo} alt="" />,
  platform: "flow",
  intro: (
    <>
      On make.powerautomate.com the panel works on <b>solution-aware</b> cloud
      flows, through the environment's Dataverse org, as you. Pick a solution at
      the top to narrow everything to it.
    </>
  ),
  groups: [
    {
      title: "Many flows at once",
      tools: [
        {
          id: "bulk",
          name: "Turn flows on or off in bulk",
          where: "Cloud flows",
          what: (
            <>
              Lists the environment's (or the solution's) cloud flows. It starts
              with the ones that are off, the usual state after an import;
              switch to <b>All</b> to see every flow. Tick as many as you like,
              or tick all shown, and click <b>Turn on</b> (or <b>Turn off</b>).
              Each flow that fails says why, for example a connection reference
              without a connection.
            </>
          ),
          how: (
            <>
              Each flow's state is set in Dataverse, a few at a time, as you.
              Your security roles decide which flows you can change.
            </>
          ),
          steps: [
            "Open Power Automate in the environment, or a solution in the maker portal.",
            "In Cloud flows, filter by name and tick the flows.",
            "Click Turn on and wait for each to report back.",
          ],
        },
        {
          id: "failed-runs",
          name: "Failed runs",
          where: "Failed runs",
          what: (
            <>
              Recent failed runs of the environment's (or the solution's) flows,
              newest first, with a link to the environment's run monitor in
              Power Automate.
            </>
          ),
          how: "Read from Dataverse's flow run table, which keeps runs for 28 days by default.",
        },
        {
          id: "flow-refs",
          name: "Connection references and environment variables",
          what: (
            <>
              The same checks as in the maker portal: connection references with
              no connection, and environment variables with no value.
            </>
          ),
        },
      ],
    },
    {
      title: "The flow you're on",
      tools: [
        {
          id: "this-flow",
          name: "This flow",
          where: "This flow",
          what: (
            <>
              Its state with a switch to turn it on or off, owner, last
              modified, whether it's managed, and its IDs (the flow ID and the
              Dataverse workflow ID). Its <b>definition</b> as JSON, to show,
              copy or download, and its <b>recent runs</b> with their status.
            </>
          ),
          how: (
            <>
              The flow is found in Dataverse by the ID in the address. Flows
              that aren't in a solution (My flows) aren't stored there, so the
              panel can't show them.
            </>
          ),
        },
      ],
    },
  ],
}
