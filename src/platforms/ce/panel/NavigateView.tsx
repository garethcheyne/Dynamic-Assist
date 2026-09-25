import * as React from "react"
import {
  BlocksIcon,
  CircleUserRoundIcon,
  CodeXmlIcon,
  CompassIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  FilterIcon,
  HistoryIcon,
  InboxIcon,
  LayersIcon,
  ListIcon,
  MailIcon,
  PackageIcon,
  SettingsIcon,
  ShieldIcon,
  StethoscopeIcon,
  TimerIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react"

import { ActionTile, TileGrid } from "@/components/action-tile"
import type { MsProduct } from "@/assets/brand/ms"
import { ProductIcon } from "@/components/product-icon"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HISTORY_KEY, type HistoryEntry } from "@/lib/history"
import type { Act } from "@/lib/use-action"
import { useStorage } from "@/lib/use-storage"

import type { CeState } from "../types"
import { ceUrls } from "../urls"
import { TablePicker } from "./TablePicker"
import type { useCeTab } from "../use-ce-tab"
import { Hint } from "@/components/hint"

type Run = ReturnType<typeof useCeTab>["run"]

const open = (url: string) => chrome.tabs.create({ url })

/** Open records by name and id, and Level Up's admin and maker shortcuts. */
export function NavigateView({
  state,
  run,
  act,
  busy,
}: {
  state: CeState
  run: Run
  act: Act
  busy: string | null
}) {
  const urls = ceUrls(state)
  const link = (
    icon: LucideIcon | MsProduct,
    title: string,
    description: string,
    url: string | null
  ) => {
    const Icon = icon
    return (
      <ActionTile
        key={title}
        icon={
          typeof Icon === "string" ? <ProductIcon product={Icon} /> : <Icon />
        }
        title={title}
        description={
          url ? description : "Needs the environment ID (online only)"
        }
        disabled={!url}
        onClick={() => url && open(url)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <QuickOpen state={state} run={run} />
      <OtherOrgs current={state.environment.clientUrl} />

      <CollapsibleSection
        id="ce.nav.me"
        title="Me"
        icon={<CircleUserRoundIcon />}
      >
        <TileGrid>
          {link(
            CircleUserRoundIcon,
            "My user record",
            "Your systemuser record",
            urls.myUser
          )}
          <ActionTile
            icon={<MailIcon />}
            title="My mailbox"
            description="Your mailbox record"
            busy={busy === "myMailbox"}
            onClick={() =>
              act("myMailbox", async () => {
                const r = await run("myMailbox")
                if (!r.id) return "You have no mailbox"
                await open(urls.record("mailbox", r.id))
              })
            }
          />
        </TileGrid>
      </CollapsibleSection>

      <CollapsibleSection
        id="ce.nav.admin"
        title="Administration"
        icon={<SettingsIcon />}
      >
        <TileGrid>
          {link(
            "powerPlatform",
            "Admin center",
            "This environment in Power Platform admin",
            urls.adminCenter
          )}
          {link(
            SettingsIcon,
            "Classic settings",
            "Advanced settings area",
            urls.settings
          )}
          {link(ShieldIcon, "Security", "Users, teams, roles", urls.security)}
          {link(TimerIcon, "System jobs", "Async operations", urls.systemJobs)}
          {link(
            WorkflowIcon,
            "Processes",
            "Workflows, actions, flows",
            urls.processes
          )}
          {link(InboxIcon, "Mailboxes", "All mailboxes", urls.mailboxes)}
          {link(
            LayersIcon,
            "My apps",
            "Every app in every environment",
            urls.instancePicker
          )}
          {link(
            StethoscopeIcon,
            "Diagnostics",
            "Connection and latency",
            urls.diagnostics
          )}
        </TileGrid>
      </CollapsibleSection>

      <CollapsibleSection
        id="ce.nav.maker"
        title="Customise"
        icon={<BlocksIcon />}
      >
        <TileGrid>
          {link(
            PackageIcon,
            "Solutions",
            "In the maker portal",
            urls.solutions
          )}
          {link(
            HistoryIcon,
            "Solution history",
            "Imports and upgrades",
            urls.solutionHistory
          )}
          {link("powerApps", "Maker portal", "make.powerapps.com", urls.maker)}
          {link(
            FilterIcon,
            "Advanced find",
            "Classic Advanced Find",
            urls.advancedFind
          )}
        </TileGrid>
      </CollapsibleSection>

      <CollapsibleSection
        id="ce.nav.dev"
        title="Developer"
        icon={<CodeXmlIcon />}
      >
        <TileGrid>
          {link("dataverse", "Web API", "Service document", urls.webApi)}
          {state.page.entityName &&
            link(
              CodeXmlIcon,
              "Entity metadata",
              `${state.page.entityName} in the Web API`,
              urls.entityMetadata(state.page.entityName)
            )}
        </TileGrid>
      </CollapsibleSection>
    </div>
  )
}

/** Table (searched by name) + optional id: open the record, a new one, or the list. */
function QuickOpen({ state, run }: { state: CeState; run: Run }) {
  const urls = ceUrls(state)
  const loadEntities = React.useCallback(() => run("entities"), [run])
  const [entity, setEntity] = React.useState(state.page.entityName ?? "")
  const [id, setId] = React.useState("")
  const e = entity.trim().toLowerCase()
  const guid = id.trim().replace(/[{}]/g, "")

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <CompassIcon className="size-3.5 text-primary" />
        Open
      </div>
      <div className="flex flex-col gap-1.5">
        <TablePicker value={e} onChange={setEntity} load={loadEntities} />
        <Input
          className="h-7 font-mono text-xs"
          placeholder="Record ID (optional)"
          aria-label="Record ID"
          value={id}
          onChange={(ev) => setId(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && e && guid) void open(urls.record(e, guid))
          }}
        />
      </div>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          disabled={!e || !guid}
          onClick={() => open(urls.record(e, guid))}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          Record
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!e}
          onClick={() => open(urls.newRecord(e))}
        >
          <FilePlus2Icon data-icon="inline-start" />
          New
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!e}
          onClick={() => open(urls.list(e))}
        >
          <ListIcon data-icon="inline-start" />
          List
        </Button>
      </div>
    </section>
  )
}

/**
 * The orgs you've been to, to jump between: the old port.crm instance picker
 * is gone, and listing every org would need a Global Discovery token.
 */
function OtherOrgs({ current }: { current: string }) {
  const [history] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])
  const host = new URL(current).host
  const orgs = history.filter(
    (e) => e.platform === "ce" && new URL(e.url).host !== host
  )
  if (orgs.length === 0) return null

  return (
    <CollapsibleSection
      id="ce.nav.orgs"
      title="Other orgs"
      icon={<LayersIcon />}
      summary={
        <span className="font-normal text-muted-foreground">{orgs.length}</span>
      }
    >
      <div className="-mx-1.5 flex flex-col">
        {orgs.map((e) => (
          <Hint label={e.url}>
            <button
              key={e.key}
              type="button"
              onClick={() => open(e.url)}
              className="flex min-w-0 flex-col rounded-md px-1.5 py-1.5 text-left hover:bg-muted/60"
            >
              <span className="truncate text-xs font-medium">
                {e.label || e.title}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {[e.subtitle, new URL(e.url).host].filter(Boolean).join(" · ")}
              </span>
            </button>
          </Hint>
        ))}
      </div>
    </CollapsibleSection>
  )
}
