import * as React from "react"
import {
  CompassIcon,
  FileSearchIcon,
  Loader2Icon,
  RefreshCwIcon,
  UserRoundCogIcon,
  UserRoundIcon,
  WrenchIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { recordVisit, visitFromUrl } from "@/lib/history"
import { useAction } from "@/lib/use-action"
import { stopImpersonation, useImpersonation } from "../impersonation"
import { ceAppUrl } from "../urls"

import type { CeState } from "../types"
import { useCeTab } from "../use-ce-tab"
import { CeSessionView } from "./CeSessionView"
import { ImpersonateSection } from "./ImpersonateSection"
import { NavigateView } from "./NavigateView"
import { RecordView } from "./RecordView"
import { ToolsView } from "./ToolsView"
import { Hint } from "@/components/hint"

type Tab = "record" | "tools" | "navigate" | "session"

const TRIGGER = "text-xs [&_svg]:size-3.5"

export function CePanel({ tab }: { tab: chrome.tabs.Tab }) {
  const { connected, state, refresh, run } = useCeTab(tab.id)
  const { busy, act } = useAction()
  const host = tab.url ? new URL(tab.url).host : ""
  const impersonation = useImpersonation(tab.id, host)
  const [current, setCurrent] = React.useState<Tab>("record")

  // Name this org (and the app you were in) in History
  const orgName = state?.environment.friendlyName ?? null
  const clientUrl = state?.environment.clientUrl
  const appId = state?.app?.id ?? null
  const appName = state?.app?.displayName ?? null
  const environmentId = state?.environment.environmentId ?? null
  React.useEffect(() => {
    const visit = tab.url ? visitFromUrl(tab.url) : null
    if (!visit || !clientUrl) return
    // Only name the org the tab is on, never one a previous page reported
    if (tab.url && new URL(clientUrl).host !== new URL(tab.url).host) return
    void recordVisit({
      ...visit,
      title: orgName ?? visit.title,
      subtitle: appName,
      environmentId,
      url: ceAppUrl(clientUrl, appId),
      named: true,
    })
  }, [tab.url, orgName, clientUrl, appId, appName, environmentId])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EnvironmentBar state={state} onRefresh={refresh} />
      {impersonation && (
        <div className="flex items-center gap-2 border-b bg-sandbox px-3 py-1.5 text-xs text-sandbox-foreground">
          <UserRoundCogIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Running as <b>{impersonation.user.name}</b>
          </span>
          <Button
            size="xs"
            variant="outline"
            className="h-6 bg-background/60"
            onClick={() =>
              act("stopImpersonation", async () => {
                await stopImpersonation(tab.id!)
                return "Stopped impersonating"
              })
            }
          >
            Stop
          </Button>
        </div>
      )}
      {!state ? (
        <div className="p-3">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            {connected ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Waiting for the app to load…
              </>
            ) : (
              "Can't reach this tab yet. Reload it once after installing or updating the extension."
            )}
          </div>
        </div>
      ) : (
        <Tabs
          value={current}
          onValueChange={(v) => setCurrent(v as Tab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="px-3 pt-3">
            <TabsList className="h-8 w-full">
              <TabsTrigger value="record" className={TRIGGER}>
                <FileSearchIcon />
                Record
              </TabsTrigger>
              <TabsTrigger value="tools" className={TRIGGER}>
                <WrenchIcon />
                Tools
              </TabsTrigger>
              <TabsTrigger value="navigate" className={TRIGGER}>
                <CompassIcon />
                Go to
              </TabsTrigger>
              <TabsTrigger value="session" className={TRIGGER}>
                <UserRoundIcon />
                Session
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="record" className="min-h-0 overflow-y-auto p-3">
            <RecordView
              state={state}
              run={run}
              act={act}
              actingAs={impersonation?.user.id ?? null}
            />
          </TabsContent>
          <TabsContent value="tools" className="min-h-0 overflow-y-auto p-3">
            <ToolsView
              state={state}
              tab={tab}
              run={run}
              act={act}
              busy={busy}
            />
          </TabsContent>
          <TabsContent value="navigate" className="min-h-0 overflow-y-auto p-3">
            <NavigateView state={state} run={run} act={act} busy={busy} />
          </TabsContent>
          <TabsContent value="session" className="min-h-0 overflow-y-auto p-3">
            <CeSessionView
              state={state}
              impersonate={
                <ImpersonateSection
                  tab={tab}
                  host={host}
                  run={run}
                  act={act}
                  active={impersonation}
                />
              }
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function EnvironmentBar({
  state,
  onRefresh,
}: {
  state: CeState | null
  onRefresh: () => void
}) {
  const env = state?.environment
  return (
    <div className="flex h-9 items-center gap-2 border-b bg-card px-3 text-xs">
      <Hint label={env?.clientUrl}>
        <span className="truncate font-semibold">
          {env?.friendlyName ?? env?.orgUniqueName ?? "Dynamics 365"}
        </span>
      </Hint>
      {state?.app && (
        <Hint label={state.app.uniqueName}>
          <span className="min-w-0 truncate text-muted-foreground">
            {state.app.displayName}
          </span>
        </Hint>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-auto"
        title="Read the page again"
        aria-label="Read the page again"
        onClick={onRefresh}
      >
        <RefreshCwIcon />
      </Button>
    </div>
  )
}
