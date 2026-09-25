import * as React from "react"
import { PackageIcon, WorkflowIcon } from "lucide-react"

import { ActionTile, TileGrid } from "@/components/action-tile"
import { ProductIcon } from "@/components/product-icon"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Detail, DetailGrid } from "@/components/detail-grid"
import { parseMakerUrl } from "@/shared/detect"
import { powerPlatform } from "@/shared/links"

import {
  ConnectionReferences,
  EnvVariables,
  FailedRuns,
  FlowDetails,
  FlowsManager,
  OrgMissing,
  SolutionPicker,
} from "./FlowTools"
import { useOrg } from "./use-org"

/** Power Automate URL areas, as the portal names them */
const AREAS: Record<string, string> = {
  flows: "My flows",
  solutions: "Solutions",
  approvals: "Approvals",
  monitor: "Monitor",
  connections: "Connections",
  templates: "Templates",
  home: "Home",
}

/**
 * Power Automate: the flow on screen (state, definition JSON, runs), and the
 * environment's or solution's flows to turn on in bulk. Everything goes
 * through the environment's Dataverse org with your own session.
 */
export function FlowPanel({ tab }: { tab: chrome.tabs.Tab }) {
  const m = parseMakerUrl(tab.url!)
  const env = m.environmentId
  const { org, loading, retry } = useOrg(tab.id, env)
  // The URL's solution, or one picked here when the page isn't in one
  const [picked, setPicked] = React.useState<string | null>(null)
  const solutionId = m.solutionId ?? picked
  const open = (url: string) => chrome.tabs.create({ url })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 items-center gap-2 border-b bg-card px-3 text-xs">
        <span className="truncate font-semibold">
          {org ? new URL(org).host.split(".")[0] : "Power Automate"}
        </span>
        {m.area && (
          <span className="truncate text-muted-foreground">
            {AREAS[m.area] ?? m.area}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {!env ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            Pick an environment in Power Automate to use the flow tools.
          </p>
        ) : (
          <>
            <section className="rounded-xl border bg-card p-3 shadow-xs">
              <DetailGrid>
                <Detail
                  label="Environment ID"
                  value={env}
                  copy={env}
                  mono
                  wide
                />
                {org && (
                  <Detail
                    label="Dataverse org"
                    value={org}
                    copy={org}
                    mono
                    wide
                  />
                )}
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

            {!org ? (
              <OrgMissing loading={loading} onRetry={retry} />
            ) : (
              <>
                {!m.solutionId && (
                  <SolutionPicker
                    org={org}
                    value={picked}
                    onChange={setPicked}
                  />
                )}
                {m.flowId && (
                  <FlowDetails org={org} env={env} flowId={m.flowId} />
                )}
                <FlowsManager org={org} env={env} solutionId={solutionId} />
                <FailedRuns org={org} env={env} solutionId={solutionId} />
                <ConnectionReferences org={org} solutionId={solutionId} />
                <EnvVariables org={org} solutionId={solutionId} />
              </>
            )}

            <CollapsibleSection
              id="flow.links"
              title="Go to"
              icon={<WorkflowIcon />}
              defaultCollapsed
            >
              <TileGrid>
                <ActionTile
                  icon={<ProductIcon product="powerAutomate" />}
                  title="My flows"
                  description="Power Automate"
                  onClick={() => open(powerPlatform.flows(env))}
                />
                <ActionTile
                  icon={<PackageIcon />}
                  title="Solutions"
                  description="In Power Apps"
                  onClick={() => open(powerPlatform.maker(env, "solutions"))}
                />
                <ActionTile
                  icon={<ProductIcon product="powerApps" />}
                  title="Power Apps"
                  description="Maker home"
                  onClick={() => open(powerPlatform.maker(env))}
                />
                <ActionTile
                  icon={<ProductIcon product="powerPlatform" />}
                  title="Admin center"
                  description="This environment"
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
