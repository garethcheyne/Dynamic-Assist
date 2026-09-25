import * as React from "react"
import {
  ActivityIcon,
  BellRingIcon,
  BlocksIcon,
  BuildingIcon,
  CircleUserRoundIcon,
  CompassIcon,
  DatabaseIcon,
  DatabaseZapIcon,
  FileClockIcon,
  FlagIcon,
  GaugeIcon,
  GlobeIcon,
  HistoryIcon,
  KeyRoundIcon,
  LayoutTemplateIcon,
  ListTodoIcon,
  MailIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldIcon,
  TimerIcon,
  UsersIcon,
  WandSparklesIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import { ActionTile, TileGrid } from "@/components/action-tile"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import type { BcPageInfo } from "../page-info"
import { buildBcUrl, type BcContext } from "../url"

type ObjectKind = "page" | "table" | "report" | "query"

const KINDS: { value: ObjectKind; label: string }[] = [
  { value: "page", label: "Page" },
  { value: "table", label: "Table" },
  { value: "report", label: "Report" },
  { value: "query", label: "Query" },
]

/**
 * Pages to jump to, checked against Business Central's object list (BC 25+):
 * what Level Up's admin and developer shortcuts are in Dynamics 365.
 */
const SHORTCUTS: {
  id: string
  title: string
  icon: LucideIcon
  links: [LucideIcon, string, string, number][]
}[] = [
  {
    id: "admin",
    title: "Administration",
    icon: SettingsIcon,
    links: [
      [BlocksIcon, "Extensions", "Extension Management", 2500],
      [UsersIcon, "Users", "Users and their permission sets", 9800],
      [ShieldIcon, "Permission sets", "Every permission set", 9802],
      [
        ShieldCheckIcon,
        "Effective permissions",
        "What a user can do, and why",
        9852,
      ],
      [KeyRoundIcon, "Entra applications", "Service-to-service apps", 9860],
      [FlagIcon, "Feature management", "Preview and upcoming features", 2610],
      [BuildingIcon, "Company", "Company Information", 1],
      [MailIcon, "Email accounts", "Email Accounts", 8887],
    ],
  },
  {
    id: "data",
    title: "Data and jobs",
    icon: DatabaseIcon,
    links: [
      [TimerIcon, "Job queue", "Job Queue Entries", 672],
      [HistoryIcon, "Change log", "Change Log Entries", 595],
      [
        DatabaseIcon,
        "Table information",
        "Table sizes and record counts",
        8700,
      ],
      [FileClockIcon, "Retention policies", "Retention Policies", 3903],
      [WrenchIcon, "Data administration", "Clean up and compress data", 9035],
      [
        PackageIcon,
        "Configuration packages",
        "Import and export setup data",
        8615,
      ],
    ],
  },
  {
    id: "dev",
    title: "Developer",
    icon: ActivityIcon,
    links: [
      [
        GaugeIcon,
        "Performance profiler",
        "Record a profile of what's slow",
        24,
      ],
      [BellRingIcon, "Event recorder", "Which events fire, in order", 9845],
      [ListTodoIcon, "Event subscriptions", "Every event subscriber", 9510],
      [
        GlobeIcon,
        "Web services",
        "Published pages, queries and codeunits",
        810,
      ],
      [LayoutTemplateIcon, "Report layouts", "Report Layouts", 9660],
      [ActivityIcon, "Sessions", "Concurrent Session List", 670],
      [CircleUserRoundIcon, "Profiles (roles)", "Profiles (Roles)", 9171],
      [WandSparklesIcon, "Assisted setup", "Assisted Setup", 1801],
    ],
  },
  {
    id: "da",
    title: "Dynamic Assist",
    icon: DatabaseZapIcon,
    links: [
      [
        DatabaseZapIcon,
        "Query page",
        "Dynamic Assist Query (companion app)",
        77500,
      ],
      [ScrollTextIcon, "Query log", "Who queried what (DA QUERY ADMIN)", 77502],
    ],
  },
]

/** Open any object by number, and Business Central's admin and developer pages. */
export function GoToView({
  ctx,
  page,
}: {
  ctx: BcContext
  page: BcPageInfo | null
}) {
  const [kind, setKind] = React.useState<ObjectKind>("page")
  const [id, setId] = React.useState("")
  const open = (params: Record<string, string | number>) =>
    chrome.tabs.create({ url: buildBcUrl(ctx, params) })
  const number = Number(id)
  const valid = Number.isInteger(number) && number > 0
  const userName = page?.session?.userName

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection
        id="bc.goto.object"
        title="Go to"
        icon={<CompassIcon />}
      >
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) void open({ [kind]: number })
          }}
        >
          <select
            aria-label="Object type"
            value={kind}
            onChange={(e) => setKind(e.target.value as ObjectKind)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <Input
            aria-label="Object number"
            inputMode="numeric"
            placeholder="Number, e.g. 22"
            value={id}
            onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
            className="h-8 flex-1 text-xs"
          />
          <Button type="submit" size="sm" disabled={!valid}>
            Open
          </Button>
        </form>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Opens in a new tab, in this environment and company.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        id="bc.goto.me"
        title="You"
        icon={<CircleUserRoundIcon />}
      >
        <TileGrid>
          <ActionTile
            icon={<SettingsIcon />}
            title="My settings"
            description="Role, company, language, region"
            onClick={() => open({ page: 9204 })}
          />
          <ActionTile
            icon={<CircleUserRoundIcon />}
            title="My user"
            description="Your user, its permission sets and groups"
            disabled={!userName}
            onClick={() =>
              userName &&
              open({
                page: 9800,
                filter: `'User Name' IS '${userName.replace(/'/g, "''")}'`,
              })
            }
          />
        </TileGrid>
      </CollapsibleSection>

      {SHORTCUTS.map((group) => {
        const Icon = group.icon
        return (
          <CollapsibleSection
            key={group.id}
            id={`bc.goto.${group.id}`}
            title={group.title}
            icon={<Icon />}
          >
            <TileGrid>
              {group.links.map(([LinkIcon, title, description, pageId]) => (
                <ActionTile
                  key={pageId}
                  icon={<LinkIcon />}
                  title={title}
                  description={`${description} (page ${pageId})`}
                  onClick={() => open({ page: pageId })}
                />
              ))}
            </TileGrid>
          </CollapsibleSection>
        )
      })}
    </div>
  )
}
