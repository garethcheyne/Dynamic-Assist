import * as React from "react"
import {
  AppWindowIcon,
  DatabaseIcon,
  HistoryIcon,
  HouseIcon,
  PackageIcon,
  RefreshCwIcon,
  ServerCogIcon,
  WorkflowIcon,
} from "lucide-react"

import ceLogo from "@/assets/brand/ce.png"
import { ActionTile, TileGrid } from "@/components/action-tile"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Detail, DetailGrid } from "@/components/detail-grid"
import { Button } from "@/components/ui/button"
import {
  HISTORY_KEY,
  recordVisit,
  visitFromUrl,
  type HistoryEntry,
} from "@/lib/history"
import { useStorage } from "@/lib/use-storage"
import { parseMakerUrl } from "@/shared/detect"
import { powerPlatform } from "@/shared/links"

const AREAS: Record<string, string> = {
  home: "Home",
  solutions: "Solutions",
  entities: "Tables",
  tables: "Tables",
  apps: "Apps",
  flows: "Flows",
  history: "Solution history",
  pipelines: "Pipelines",
  connections: "Connections",
}

/**
 * The environment's name from the maker portal's environment picker. The
 * portal has no page API for it; this reads the button's label.
 */
async function readEnvironmentName(tabId: number): Promise<string | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () =>
        document
          .querySelector('[data-test-id="SelectEnvironment"]')
          ?.getAttribute("aria-label")
          ?.replace(/^Environment:\s*/, "") ?? null,
    })
    return (result?.result as string | null) ?? null
  } catch {
    return null
  }
}

/** Power Apps maker portal: which environment, and where to go from here. */
export function MakerPanel({ tab }: { tab: chrome.tabs.Tab }) {
  const m = parseMakerUrl(tab.url!)
  const env = m.environmentId
  const [name, setName] = React.useState<string | null>(null)
  // The picker can still show the previous environment just after a switch,
  // so History only takes a name that two reads in a row agree on
  const [stableName, setStableName] = React.useState<string | null>(null)
  const lastRead = React.useRef<string | null>(null)
  const [history] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])

  const refresh = React.useCallback(() => {
    if (tab.id === undefined) return
    void readEnvironmentName(tab.id).then((next) => {
      if (next && next === lastRead.current) setStableName(next)
      lastRead.current = next
      setName(next)
    })
  }, [tab.id])

  // The picker renders after the page; read it now and again shortly after
  React.useEffect(() => {
    refresh()
    const timer = window.setTimeout(refresh, 2500)
    return () => window.clearTimeout(timer)
  }, [refresh, env])

  React.useEffect(() => {
    const visit = tab.url ? visitFromUrl(tab.url) : null
    if (visit && stableName)
      void recordVisit({ ...visit, title: stableName, named: true })
  }, [tab.url, stableName])

  // The Dynamics 365 org behind this environment, if you've been there
  const org = history.find(
    (e) => e.platform === "ce" && env && e.environmentId === env
  )
  const maker = (path: string) => powerPlatform.maker(env!, path)
  const open = (url: string) => chrome.tabs.create({ url })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 items-center gap-2 border-b bg-card px-3 text-xs">
        <span className="truncate font-semibold">{name ?? "Power Apps"}</span>
        {m.area && (
          <span className="truncate text-muted-foreground">
            {AREAS[m.area] ?? m.area}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          title="Read the page again"
          aria-label="Read the page again"
          onClick={refresh}
        >
          <RefreshCwIcon />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {!env ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            Pick an environment in Power Apps to see its links here.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
              <DetailGrid>
                <Detail
                  label="Environment"
                  value={name ?? "—"}
                  copy={name ?? undefined}
                  wide
                />
                <Detail
                  label="Environment ID"
                  value={env}
                  copy={env}
                  mono
                  wide
                />
                {m.solutionId && (
                  <Detail
                    label="Solution ID"
                    value={m.solutionId}
                    copy={m.solutionId}
                    mono
                    wide
                  />
                )}
              </DetailGrid>
            </section>

            <CollapsibleSection
              id="maker.org"
              title="Dynamics 365"
              icon={<img src={ceLogo} alt="" className="size-3.5" />}
            >
              {org ? (
                <TileGrid>
                  <ActionTile
                    icon={<AppWindowIcon />}
                    title={org.label ?? org.title}
                    description={org.subtitle ?? "Open the org"}
                    onClick={() => open(org.url)}
                  />
                  <ActionTile
                    icon={<DatabaseIcon />}
                    title="Web API"
                    description="This org's service document"
                    onClick={() =>
                      open(`${new URL(org.url).origin}/api/data/v9.2/`)
                    }
                  />
                </TileGrid>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Open this environment's Dynamics 365 app once and it'll be
                  linked here.
                </p>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              id="maker.links"
              title="This environment"
              icon={<PackageIcon />}
            >
              <TileGrid>
                <ActionTile
                  icon={<HouseIcon />}
                  title="Home"
                  description="Maker home"
                  onClick={() => open(maker("home"))}
                />
                <ActionTile
                  icon={<PackageIcon />}
                  title="Solutions"
                  description="All solutions"
                  onClick={() => open(maker("solutions"))}
                />
                <ActionTile
                  icon={<DatabaseIcon />}
                  title="Tables"
                  description="Dataverse tables"
                  onClick={() => open(maker("entities"))}
                />
                <ActionTile
                  icon={<AppWindowIcon />}
                  title="Apps"
                  description="Canvas and model-driven"
                  onClick={() => open(maker("apps"))}
                />
                <ActionTile
                  icon={<WorkflowIcon />}
                  title="Flows"
                  description="In Power Automate"
                  onClick={() => open(powerPlatform.flows(env))}
                />
                <ActionTile
                  icon={<HistoryIcon />}
                  title="Solution history"
                  description="Imports and upgrades"
                  onClick={() => open(maker("history"))}
                />
                <ActionTile
                  icon={<ServerCogIcon />}
                  title="Admin center"
                  description="This environment in Power Platform admin"
                  onClick={() => open(powerPlatform.adminCenter(env))}
                />
              </TileGrid>
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  )
}
