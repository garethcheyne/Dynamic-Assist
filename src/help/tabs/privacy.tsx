import { LockIcon } from "lucide-react"

import { SITE_LINKS } from "@/shared/links"

import type { HelpTab } from "../types"

export const PRIVACY: HelpTab = {
  id: "privacy",
  title: "Privacy",
  icon: <LockIcon />,
  platform: "none",
  intro: (
    <>
      Dynamic Assist has no server, no account and no tracking. Everything it
      shows comes from the page you're on or that service's own API, as you.
    </>
  ),
  groups: [
    {
      title: "What it does with your data",
      tools: [
        {
          id: "reads",
          name: "What it reads",
          what: (
            <>
              The page you have open (records, fields, IDs, the signed-in user,
              company and environment) on Business Central, Dynamics 365, the
              Power Apps maker portal and Power Automate only. It does nothing
              on other sites. If you switch on the Errors tab, it also watches
              Dynamics 365 pages for errors, which stay in the page. What it
              asks the service's API for is listed with each tool on the other
              tabs.
            </>
          ),
        },
        {
          id: "sign-in-data",
          name: "Your sign-in",
          what: (
            <>
              Never read, stored or sent. Requests go out with the session your
              browser already has, the same way the page's own requests do, so
              they have exactly your permissions.
            </>
          ),
        },
        {
          id: "changes",
          name: "What it changes",
          what: (
            <>
              Only what you click to change: turning flows on or off, and the
              Dynamics 365 form tools that act on a record (Save, and anything
              you then save after God mode, Fill required or Clone). The query
              builder and the companion app are read-only.
            </>
          ),
        },
        {
          id: "stores",
          name: "What it keeps",
          what: (
            <>
              In this browser only: your History, pins and names; your saved
              queries; which Business Central company goes with which Dynamics
              365 org; the names of a Business Central environment's installed
              apps, for a day; and preferences like the theme and collapsed
              sections. Record data is shown, never kept, unless you export it
              to a file. Uninstalling the extension removes everything.
            </>
          ),
        },
        {
          id: "shares",
          name: "What it shares",
          what: "Nothing. No analytics, no error reporting, no third parties.",
        },
      ],
    },
    {
      title: "The policies",
      tools: [
        {
          id: "policy",
          name: "The privacy policy",
          what: (
            <>
              The policy the stores link to covers every err403 browser
              extension:{" "}
              <a
                href={SITE_LINKS.policy}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                err403.com/privacy-policy/chrome-extensions
              </a>
              . The website's{" "}
              <a
                href={SITE_LINKS.privacy}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                privacy page
              </a>{" "}
              says exactly what Dynamic Assist reads, keeps and changes, tool
              by tool. The website itself counts visits and keeps the feedback
              you send; that's in its{" "}
              <a
                href={SITE_LINKS.websitePrivacy}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                own policy
              </a>
              .
            </>
          ),
        },
        {
          id: "website",
          name: "The website is different",
          what: (
            <>
              dynamicassist.err403.com counts visits (no cookies, nothing for
              browsers that send Do Not Track) and keeps the feedback you send
              it. The extension itself does neither.
            </>
          ),
        },
      ],
    },
  ],
}
