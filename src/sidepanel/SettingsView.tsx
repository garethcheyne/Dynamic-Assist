import * as React from "react"
import { DatabaseIcon, PanelTopIcon, Trash2Icon } from "lucide-react"

import bcLogo from "@/assets/brand/ms/business-central.svg"
import { CollapsibleSection, Count } from "@/components/collapsible-section"
import { Button } from "@/components/ui/button"
import { useNotify } from "@/lib/copy"
import { ago } from "@/lib/time"
import { CHANNEL_TABS_KEY } from "@/platforms/bc/messages"
import { BRIDGE_PAGE_ID } from "@/platforms/bc/query/bridge"
import {
  clearMeta,
  listMeta,
  type BcMetaSummary,
} from "@/platforms/bc/query/meta-cache"
import { parseBcUrl } from "@/platforms/bc/url"

/** The installed apps' names cached per environment (app-names.ts) */
const APP_NAMES_PREFIX = "bc:apps:"

async function listAppNameCaches(): Promise<string[]> {
  const all = await chrome.storage.local.get(null)
  return Object.keys(all).filter((k) => k.startsWith(APP_NAMES_PREFIX))
}

/** Tabs showing the companion's query page (page 77500), in any company */
async function queryPageTabs() {
  const tabs = await chrome.tabs.query({
    url: "https://businesscentral.dynamics.com/*",
  })
  return tabs.filter((t) => t.url && parseBcUrl(t.url).page === BRIDGE_PAGE_ID)
}

/**
 * What Dynamic Assist keeps in this browser that you may want to reset:
 * Business Central metadata the query builder cached, and the companion's
 * query pages it opened, so the first-run steps can be tried again.
 */
export function SettingsView() {
  const notify = useNotify()
  const [meta, setMeta] = React.useState<BcMetaSummary[] | null>(null)
  const [appCaches, setAppCaches] = React.useState<string[]>([])
  const [pages, setPages] = React.useState<chrome.tabs.Tab[]>([])

  // Bumped to read everything again: after a change here, or in storage
  const [version, setVersion] = React.useState(0)
  const reload = React.useCallback(() => setVersion((v) => v + 1), [])
  React.useEffect(() => {
    let live = true
    void Promise.all([listMeta(), listAppNameCaches(), queryPageTabs()]).then(
      ([m, a, p]) => {
        if (!live) return
        setMeta(m)
        setAppCaches(a)
        setPages(p)
      }
    )
    return () => {
      live = false
    }
  }, [version])
  React.useEffect(() => {
    // Other views (the builder) change the cache while this is open
    const onChange = (_: unknown, area: string) => {
      if (area === "local") reload()
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [reload])

  const clear = async (keys: string[], what: string) => {
    await clearMeta(keys)
    notify(`Cleared ${what}`)
    reload()
  }

  const closePages = async () => {
    const ids = pages.map((t) => t.id!).filter((id) => id !== undefined)
    await chrome.tabs.remove(ids).catch(() => {})
    await chrome.storage.session.remove(CHANNEL_TABS_KEY)
    notify(`Closed ${ids.length} query page${ids.length === 1 ? "" : "s"}`)
    reload()
  }

  const total = (meta?.length ?? 0) + appCaches.length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <CollapsibleSection
        id="settings.bcMeta"
        title="Business Central metadata"
        icon={<img src={bcLogo} alt="" className="size-3.5" />}
        summary={meta && <Count>{meta.length}</Count>}
      >
        <p className="text-xs text-muted-foreground">
          The query builder keeps each environment&apos;s table list and the
          fields of tables you&apos;ve opened, so it opens quickly next time.
          Clear it to read everything again, for example after installing an
          extension, or to try the first run again.
        </p>
        {meta === null ? null : meta.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing cached.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border text-xs">
            {meta.map((m) => (
              <li key={m.key} className="flex items-center gap-2 px-2 py-1.5">
                <DatabaseIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {m.tables} tables · fields of {m.fieldTables} ·{" "}
                    {m.at ? `read ${ago(m.at)}` : "fields only"}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={`Clear ${m.name}`}
                  aria-label={`Clear ${m.name}`}
                  onClick={() => void clear([m.key], m.name)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {appCaches.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Also kept: the names of installed apps for {appCaches.length}{" "}
            environment{appCaches.length === 1 ? "" : "s"}, for the field
            badges.
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={total === 0}
          onClick={() =>
            void clear(
              [...(meta ?? []).map((m) => m.key), ...appCaches],
              "all Business Central metadata"
            )
          }
        >
          <Trash2Icon data-icon="inline-start" />
          Clear all
        </Button>
      </CollapsibleSection>

      <CollapsibleSection
        id="settings.queryPages"
        title="Companion query pages"
        icon={<PanelTopIcon />}
        summary={<Count>{pages.length}</Count>}
      >
        <p className="text-xs text-muted-foreground">
          The query builder reaches the companion app through its Dynamic Assist
          Query page (page {BRIDGE_PAGE_ID}). While one is open for a company,
          the builder opens straight away there. Close them to see the first-run
          steps again.
        </p>
        {pages.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {pages.map((t) => {
              const ctx = parseBcUrl(t.url!)
              return (
                <li key={t.id} className="truncate">
                  {[ctx.environment, ctx.company].filter(Boolean).join(" · ") ||
                    t.title}
                </li>
              )
            })}
          </ul>
        )}
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={pages.length === 0}
          onClick={() => void closePages()}
        >
          Close {pages.length || ""} query page{pages.length === 1 ? "" : "s"}
        </Button>
      </CollapsibleSection>
    </div>
  )
}
