import * as React from "react"
import { CircleAlertIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react"

import bcLogo from "@/assets/brand/ms/business-central.svg"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Button } from "@/components/ui/button"
import { HISTORY_KEY, type HistoryEntry } from "@/lib/history"
import { rememberBcOrg } from "@/lib/product-links"
import { useStorage } from "@/lib/use-storage"
import { companionFor } from "@/platforms/bc/companion-channel"
import { findBcRecords, type BcTarget } from "@/platforms/bc/coupling"
import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"

type Found =
  | { state: "idle" }
  | { state: "busy"; note?: string }
  | { state: "done"; records: BcTarget[]; connectedTo: string | null }
  | { state: "error"; message: string }

/**
 * The Business Central records coupled to this one. BC holds the couplings,
 * so this asks the companion app in a BC company from History (the one you
 * last used for this org), which also checks it's connected to this org.
 */
export function CoupledBcSection({
  clientUrl,
  recordId,
}: {
  clientUrl: string
  recordId: string
}) {
  const orgHost = new URL(clientUrl).host
  const [history] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])
  const [chosen, setChosen] = useStorage<string | null>(
    `ce.bcCompany.${orgHost}`,
    null
  )
  const companies = history
    .filter((e) => e.platform === "bc")
    .sort((a, b) => b.lastVisited - a.lastVisited)
  const entry = companies.find((e) => e.key === chosen) ?? companies[0]
  const [found, setFound] = React.useState<Found>({ state: "idle" })

  const find = async () => {
    if (!entry) return
    setFound({ state: "busy" })
    try {
      const call = await companionFor(parseBcUrl(entry.url), () =>
        setFound({
          state: "busy",
          note: "Opening the companion's query page in the background…",
        })
      )
      const result = await findBcRecords(call, recordId, orgHost)
      if (result.connectedTo)
        void rememberBcOrg(
          parseBcUrl(entry.url),
          `https://${result.connectedTo}`
        )
      setFound({ state: "done", ...result })
    } catch (error) {
      setFound({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const ctx = entry ? parseBcUrl(entry.url) : null

  return (
    <CollapsibleSection
      id="ce.coupled"
      title="Business Central"
      icon={<img src={bcLogo} alt="" className="size-3.5" />}
    >
      {!entry ? (
        <p className="text-xs text-muted-foreground">
          Open the Business Central company that syncs with this org once, and
          it can find the coupled record here (needs the Dynamic Assist
          Companion app there).
        </p>
      ) : (
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Business Central company"
              value={entry.key}
              onChange={(e) => {
                setChosen(e.target.value)
                setFound({ state: "idle" })
              }}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs"
            >
              {companies.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label ?? c.title}
                  {c.subtitle ? ` · ${c.subtitle}` : ""}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={found.state === "busy"}
              onClick={() => void find()}
            >
              {found.state === "busy" && (
                <Loader2Icon className="animate-spin" />
              )}
              Find coupled
            </Button>
          </div>

          {found.state === "busy" && found.note && (
            <p className="text-muted-foreground">{found.note}</p>
          )}
          {found.state === "error" && (
            <p className="flex items-start gap-1.5 text-destructive">
              <CircleAlertIcon className="mt-px size-3.5 shrink-0" />
              {found.message}
            </p>
          )}
          {found.state === "done" &&
            (found.connectedTo !== orgHost.toLowerCase() ? (
              <p className="text-muted-foreground">
                That company is{" "}
                {found.connectedTo
                  ? `connected to ${found.connectedTo}, not this org`
                  : "not connected to Dataverse"}
                . Pick the one that syncs with {orgHost}.
              </p>
            ) : found.records.length === 0 ? (
              <p className="text-muted-foreground">
                Not coupled to anything in that company.
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {found.records.map((r) => (
                  <li key={`${r.tableId}:${r.key}`}>
                    <button
                      type="button"
                      disabled={!r.pageId || !ctx}
                      onClick={() =>
                        ctx &&
                        r.pageId &&
                        chrome.tabs.create({
                          url: buildBcUrl(ctx, {
                            page: r.pageId,
                            filter: r.filter,
                          }),
                        })
                      }
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {r.tableCaption}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">
                          {r.key}
                        </span>
                      </span>
                      <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
