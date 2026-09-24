import * as React from "react"
import {
  FileSearchIcon,
  Loader2Icon,
  PanelsTopLeftIcon,
  RefreshCwIcon,
  ServerCogIcon,
  UserRoundIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { recordVisit, visitFromUrl } from "@/lib/history"

import type { BcPageInfo } from "../page-info"
import { bcAdminCenterUrl, parseBcUrl, type BcContext } from "../url"
import { useBcTab } from "../use-bc-tab"
import { PageView } from "./PageView"
import { PartsView } from "./PartsView"
import { SessionView } from "./SessionView"

type Tab = "page" | "parts" | "session"

export function BcPanel({ tab }: { tab: chrome.tabs.Tab }) {
  const ctx = parseBcUrl(tab.url!)
  const { connected, page, refresh } = useBcTab(tab.id)
  const [current, setCurrent] = React.useState<Tab>("page")

  // Name this environment in History once the client has told us about it
  const envName = page?.environment.name
  const envType = page?.environment.type ?? null
  const company = page?.session?.company?.name ?? null
  React.useEffect(() => {
    const visit = tab.url ? visitFromUrl(tab.url) : null
    if (!visit || !envName) return
    // Only name the instance the tab is on: the URL's environment (when it
    // names one) must be the one the client reports
    if (
      ctx.environment &&
      ctx.environment.toLowerCase() !== envName.toLowerCase()
    )
      return
    void recordVisit({
      ...visit,
      title: envName,
      subtitle: company ?? visit.subtitle,
      envType,
      named: true,
    })
  }, [tab.url, ctx.environment, envName, envType, company])

  if (ctx.isAdminCenter) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <ServerCogIcon className="size-6 text-primary" />
        <p className="max-w-64">
          This is the Business Central admin center. Open an environment to use
          the page tools.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EnvironmentBar ctx={ctx} page={page} onRefresh={refresh} />
      <Tabs
        value={current}
        onValueChange={(v) => setCurrent(v as Tab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="px-3 pt-3">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="page" className="text-xs [&_svg]:size-3.5">
              <FileSearchIcon />
              Page
            </TabsTrigger>
            <TabsTrigger value="parts" className="text-xs [&_svg]:size-3.5">
              <PanelsTopLeftIcon />
              Parts
              {page && page.parts.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-[10px] leading-4 text-muted-foreground tabular-nums">
                  {page.parts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="session" className="text-xs [&_svg]:size-3.5">
              <UserRoundIcon />
              Session
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="page" className="min-h-0 overflow-y-auto p-3">
          {page ? (
            <PageView ctx={ctx} form={page.form} />
          ) : (
            <Waiting connected={connected} />
          )}
        </TabsContent>
        <TabsContent value="parts" className="min-h-0 overflow-y-auto p-3">
          {page ? (
            <PartsView ctx={ctx} host={page.form} parts={page.parts} />
          ) : (
            <Waiting connected={connected} />
          )}
        </TabsContent>
        <TabsContent value="session" className="min-h-0 overflow-y-auto p-3">
          <SessionView ctx={ctx} page={page} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Environment, company and a production/sandbox pill: where you are at a glance. */
function EnvironmentBar({
  ctx,
  page,
  onRefresh,
}: {
  ctx: BcContext
  page: BcPageInfo | null
  onRefresh: () => void
}) {
  const type = page?.environment.type
  const company = page?.session?.company?.name ?? ctx.company
  return (
    <div className="flex h-9 items-center gap-2 border-b bg-card px-3 text-xs">
      <span className="truncate font-semibold">
        {page?.environment.name ?? ctx.environment ?? "Business Central"}
      </span>
      {type && (
        <span
          className={cn(
            "rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
            type === "production"
              ? "bg-production text-production-foreground"
              : "bg-sandbox text-sandbox-foreground"
          )}
        >
          {type}
        </span>
      )}
      {company && (
        <span
          className="min-w-0 truncate text-muted-foreground"
          title={company}
        >
          {company}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-auto"
        title="Business Central admin center"
        aria-label="Business Central admin center"
        onClick={() =>
          chrome.tabs.create({
            url: bcAdminCenterUrl(ctx, page?.environment.aadTenantId),
          })
        }
      >
        <ServerCogIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        title="Read the page again"
        aria-label="Read the page again"
        onClick={onRefresh}
      >
        <RefreshCwIcon />
      </Button>
    </div>
  )
}

function Waiting({ connected }: { connected: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
      {connected ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Waiting for Business Central to open a page…
        </>
      ) : (
        "Can't reach this tab yet. Reload the Business Central tab once after installing or updating the extension."
      )}
    </div>
  )
}
