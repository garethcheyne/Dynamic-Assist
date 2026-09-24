import type { ReactNode } from "react"
import {
  BracesIcon,
  CopyIcon,
  EllipsisIcon,
  HistoryIcon,
  LifeBuoyIcon,
  LockIcon,
  PinIcon,
  RefreshCwIcon,
} from "lucide-react"

import bcLogo from "@/assets/brand/bc.png"
import ceLogo from "@/assets/brand/ce.png"
import paLogo from "@/assets/brand/pa.png"
import { CollapsibleSection } from "@/components/collapsible-section"

function Tip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-2 text-xs leading-relaxed">
      <span className="mt-0.5 shrink-0 text-primary [&_svg]:size-3.5">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}

function Section({
  id,
  title,
  icon,
  children,
}: {
  id: string
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <CollapsibleSection id={`help.${id}`} title={title} icon={icon}>
      <div className="flex flex-col gap-2 text-xs leading-relaxed text-foreground/90 [&_b]:font-semibold [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </CollapsibleSection>
  )
}

const Logo = ({ src }: { src: string }) => (
  <img src={src} alt="" className="size-3.5" />
)

/** How to use the panel, product by product. */
export function HelpView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <Section id="start" title="Getting started" icon={<LifeBuoyIcon />}>
        <p>
          Open Business Central, a Dynamics 365 app or the Power Apps maker
          portal. The panel follows the tab you're on and shows the tools for
          that product. Its colours change to match.
        </p>
        <ul>
          <Tip icon={<RefreshCwIcon />}>
            Just installed or updated? <b>Reload the tab once</b> so the
            extension can read it.
          </Tip>
          <Tip icon={<CopyIcon />}>
            Hover any field for <b>copy name</b> and <b>copy value</b>. Click a
            row for its details.
          </Tip>
          <Tip icon={<EllipsisIcon />}>
            The <b>⋯</b> menu on a field has more formats: AL reference, API and
            OData names, Web API names, FetchXML.
          </Tip>
          <Tip icon={<BracesIcon />}>
            <b>Copy JSON</b> on a field list copies every field as one object.
          </Tip>
        </ul>
      </Section>

      <Section id="bc" title="Business Central" icon={<Logo src={bcLogo} />}>
        <ul>
          <li>
            <b>Page</b>: page and table IDs, type, owning app and version,
            primary key, SystemId and bookmark, with links to open the page or
            the table's data.
          </li>
          <li>
            <b>Fields</b>: every field on the page, grouped by FastTab. Filter
            by value, extension, FlowField or hidden. Schema names are cleaned
            of BC's control suffixes.
          </li>
          <li>
            <b>Parts</b>: each FactBox and subpage with its own page, table and
            fields.
          </li>
          <li>
            <b>Session</b>: you, your role, the company, the environment and
            tenant, and the admin center.
          </li>
        </ul>
        <p className="text-muted-foreground">
          All of this is read from the web client itself, so unlike the page
          inspector it doesn't open a second session. It can't show what only
          the server knows: table names, data types and fields not on the page.
        </p>
      </Section>

      <Section id="ce" title="Dynamics 365" icon={<Logo src={ceLogo} />}>
        <ul>
          <li>
            <b>Record</b>: entity, ID, form and entity set, every form field
            (changed, required, read-only), and <b>All columns</b> from the Web
            API.
          </li>
          <li>
            <b>Tools</b>: God mode, logical names (with copy buttons on the
            form), expand tabs, refresh subgrids, fill required, clone, blur for
            screenshots, list FetchXML, and the form monitor, ribbon and
            performance switches.
          </li>
          <li>
            <b>Go to</b>: search any table by name and open a record, a new form
            or the list; plus admin, maker and developer shortcuts.
          </li>
          <li>
            <b>Session</b>: you, your security roles, the app and the
            environment.
          </li>
        </ul>
      </Section>

      <Section id="maker" title="Power Apps" icon={<Logo src={paLogo} />}>
        <p>
          In the maker portal the panel names the environment, shows its ID (and
          the solution's, when you're in one), and links to its solutions,
          tables, apps, flows, history and admin center. Once you've opened the
          environment's Dynamics 365 app, it links there too.
        </p>
      </Section>

      <Section id="history" title="History" icon={<HistoryIcon />}>
        <ul>
          <Tip icon={<HistoryIcon />}>
            Every environment, org and company you open is listed, newest first.
          </Tip>
          <Tip icon={<PinIcon />}>
            <b>Pin</b> the ones you use and give them a <b>friendly name</b>.
            Pinned entries stay at the top and survive Clear.
          </Tip>
        </ul>
      </Section>

      <Section id="privacy" title="Privacy" icon={<LockIcon />}>
        <p>
          Everything stays in your browser. The extension reads the pages you
          have open and calls their own APIs as you, with your permissions. It
          sends nothing anywhere else, and History lives in this browser only.
        </p>
      </Section>
    </div>
  )
}
