import type { ReactNode } from "react"
import {
  ExternalLinkIcon,
  HeartIcon,
  PackageIcon,
  SparklesIcon,
} from "lucide-react"

import bcLogo from "@/assets/brand/ms/business-central.svg"
import ceLogo from "@/assets/brand/ms/dynamics-365.svg"
import paLogo from "@/assets/brand/ms/power-apps.svg"
import flowLogo from "@/assets/brand/ms/power-automate.svg"
import { CollapsibleSection } from "@/components/collapsible-section"

const { version } = chrome.runtime.getManifest()
const icon = chrome.runtime.getURL("icons/icon128.png")
const REPO = "https://github.com/garethcheyne/Dynamic-Assist"

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
    >
      {children}
      <ExternalLinkIcon className="size-3" />
    </a>
  )
}

function Credit({
  name,
  href,
  by,
  children,
}: {
  name: string
  href: string
  by?: string
  children: ReactNode
}) {
  return (
    <li className="flex flex-col gap-0.5">
      <span className="text-xs">
        <Link href={href}>{name}</Link>
        {by && <span className="text-muted-foreground"> by {by}</span>}
      </span>
      <span className="text-[11px] leading-snug text-muted-foreground">
        {children}
      </span>
    </li>
  )
}

const LIBRARIES: [string, string][] = [
  ["React", "https://react.dev"],
  ["Vite", "https://vite.dev"],
  ["CRXJS", "https://crxjs.dev"],
  ["Tailwind CSS", "https://tailwindcss.com"],
  ["shadcn/ui", "https://ui.shadcn.com"],
  ["Base UI", "https://base-ui.com"],
  ["Lucide", "https://lucide.dev"],
  ["Geist", "https://vercel.com/font"],
]

/** What this is, who made it, and whose work it stands on. */
export function CreditsView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <section className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-xs">
        <img src={icon} alt="" className="size-14" />
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Dynamic Assist
          </h2>
          <p className="text-[11px] text-muted-foreground">Version {version}</p>
        </div>
        <p className="text-sm font-medium">One extension to rule them all.</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Admins and developers working across Microsoft's business apps end up
          with a toolbar full of extensions, one per product. Dynamic Assist
          brings that tooling together in one side panel, with the same look and
          the same habits wherever you are:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <img src={bcLogo} alt="" className="size-3.5" />
            Business Central
          </span>
          <span className="flex items-center gap-1">
            <img src={ceLogo} alt="" className="size-3.5" />
            Dynamics 365
          </span>
          <span className="flex items-center gap-1">
            <img src={paLogo} alt="" className="size-3.5" />
            Power Apps
          </span>
          <span className="flex items-center gap-1">
            <img src={flowLogo} alt="" className="size-3.5" />
            Power Automate
          </span>
        </div>
        <p className="text-xs">
          By Gareth Cheyne · <Link href={REPO}>Source on GitHub</Link>
        </p>
      </section>

      <CollapsibleSection
        id="credits.shoulders"
        title="Built on the work of"
        icon={<HeartIcon />}
      >
        <ul className="flex flex-col gap-2.5">
          <Credit
            name="Level up for Dynamics 365/Power Apps"
            href="https://github.com/rajyraman/Levelup-for-Dynamics-CRM"
            by="Natraj Yegnaraman"
          >
            The Dynamics 365 tools here are a rebuild of Level Up's: god mode,
            logical names, all fields, clone, the admin shortcuts and more.
            Level Up has helped Dynamics people for years (MIT licence).
          </Credit>
          <Credit
            name="ServiceNow Companion"
            href="https://github.com/garethcheyne"
            by="Gareth Cheyne"
          >
            The side panel design: cards, filter chips, collapsible sections.
          </Credit>
        </ul>
      </CollapsibleSection>

      <CollapsibleSection
        id="credits.libraries"
        title="Open source"
        icon={<PackageIcon />}
        defaultCollapsed
      >
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {LIBRARIES.map(([name, href]) => (
            <Link key={name} href={href}>
              {name}
            </Link>
          ))}
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        id="credits.contribute"
        title="Help build it"
        icon={<SparklesIcon />}
        defaultCollapsed
      >
        <p className="text-xs leading-relaxed">
          Ideas, bugs and pull requests are welcome on{" "}
          <Link href={`${REPO}/issues`}>GitHub</Link>. Tools for other Microsoft
          business apps especially.
        </p>
      </CollapsibleSection>

      <p className="px-2 text-center text-[10px] leading-snug text-muted-foreground">
        Microsoft, Dynamics 365, Business Central, Power Platform, Power Apps,
        Power Automate, Dataverse, Power BI, Copilot Studio, Azure, Azure DevOps
        and Microsoft Entra, and their icons, are trademarks of the Microsoft
        group of companies. The icons are Microsoft's own, unmodified, and only
        show which product a link or page belongs to. Dynamic Assist is an
        independent project, not affiliated with or endorsed by Microsoft.
      </p>
    </div>
  )
}
