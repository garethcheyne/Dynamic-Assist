import * as React from "react"
import {
  CircleAlertIcon,
  ExternalLinkIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react"

import bcLogo from "@/assets/brand/ms/business-central.svg"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HISTORY_KEY, type HistoryEntry } from "@/lib/history"
import { rememberBcOrg } from "@/lib/product-links"
import { useStorage } from "@/lib/use-storage"
import { companionFor } from "@/platforms/bc/companion-channel"
import { findBcRecords } from "@/platforms/bc/coupling"
import { buildBcUrl, parseBcUrl, type BcContext } from "@/platforms/bc/url"
import { BC_VIRTUAL_TABLES, COMPANION_LATEST } from "@/shared/links"

import { bcCompanies } from "../bc-companies"
import type { CeBcCoupling, CeBcCouplings, CeBcSource } from "../types"
import type { useCeTab } from "../use-ce-tab"

type Run = ReturnType<typeof useCeTab>["run"]

type Found =
  | { state: "idle" }
  | { state: "busy"; note?: string }
  | { state: "done"; records: CeBcCoupling[]; connectedTo: string | null }
  | { state: "error"; message: string }

/** Through the virtual table: undefined while reading */
type ViaDataverse =
  | undefined
  | { state: "done"; result: CeBcCouplings }
  /** No couplings virtual table in the org */
  | { state: "missing"; configAppId: string | null }
  | { state: "error"; message: string }

const BC_ORIGIN = "https://businesscentral.dynamics.com"
const lower = (s: string | null | undefined) => (s ?? "").toLowerCase()

/**
 * The Business Central records coupled to this one. BC holds the couplings
 * (CRM Integration Record). With the companion's couplings API visible as a
 * virtual table, they're read through Dataverse as soon as the record opens.
 * Otherwise this asks the companion app in a BC company: only the org's own
 * environment's companies when the Business Central Virtual Table app names
 * it, else every company from History; the companion checks the company is
 * connected to this org.
 */
export function CoupledBcSection({
  clientUrl,
  tenantId,
  recordId,
  run,
}: {
  clientUrl: string
  /** The org's Entra tenant: the BC environment is in the same one */
  tenantId: string | null
  recordId: string
  run: Run
}) {
  const orgHost = new URL(clientUrl).host
  const [history] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])
  const [chosen, setChosen] = useStorage<string | null>(
    `ce.bcCompany.${orgHost}`,
    null
  )
  // undefined while it's being read
  const [source, setSource] = React.useState<CeBcSource | null | undefined>()
  const [via, setVia] = React.useState<ViaDataverse>()
  React.useEffect(() => {
    let live = true
    run("bcSource").then(
      (s) => live && setSource(s),
      () => live && setSource(null)
    )
    run("bcCouplings", { crmId: recordId }).then(
      (result) =>
        live &&
        setVia(
          "missing" in result
            ? { state: "missing", configAppId: result.configAppId }
            : { state: "done", result }
        ),
      (error: unknown) =>
        live &&
        setVia({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        })
    )
    return () => {
      live = false
    }
  }, [run, recordId])

  const companies = bcCompanies(history, source ?? null, tenantId)
  const entry =
    companies.find((e) => e.key === chosen) ??
    companies.find(
      (e) =>
        !!source?.company &&
        lower(parseBcUrl(e.url).company) === lower(source.company)
    ) ??
    companies[0]
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
      setFound({
        state: "done",
        connectedTo: result.connectedTo,
        // The companion's lookup only returns records it could read
        records: result.records.map((r) => ({
          ...r,
          exists: true,
          skipped: false,
        })),
      })
    } catch (error) {
      setFound({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Through Dataverse: the environment from the org's setup, the company
  // the virtual table read
  const viaCompany =
    via?.state === "done" ? (via.result.company ?? source?.company) : null
  const viaCtx: BcContext | null =
    source && tenantId && viaCompany
      ? {
          origin: BC_ORIGIN,
          tenant: tenantId,
          environment: source.environment,
          company: viaCompany,
          page: null,
          bookmark: null,
          isAdminCenter: false,
        }
      : null

  return (
    <CollapsibleSection
      id="ce.coupled"
      title="Business Central"
      icon={<img src={bcLogo} alt="" className="size-3.5" />}
    >
      {source && (
        <p className="mb-2 text-xs text-muted-foreground">
          This org is set up with Business Central environment{" "}
          <b className="text-foreground">{source.environment}</b>
          {(viaCompany ?? source.company) && (
            <>
              , company{" "}
              <b className="text-foreground">{viaCompany ?? source.company}</b>
            </>
          )}
          .
        </p>
      )}

      {via === undefined ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          Looking for coupled records…
        </p>
      ) : via?.state === "done" ? (
        via.result.records.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Not coupled to anything in{" "}
            {viaCompany ? `company ${viaCompany}` : "your default company"}.
          </p>
        ) : (
          <CoupledList records={via.result.records} ctx={viaCtx} />
        )
      ) : (
        <>
          {via?.state === "missing" && (
            <CouplingsSetup
              clientUrl={clientUrl}
              source={source ?? null}
              configAppId={via.configAppId}
            />
          )}
          {via?.state === "error" && (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-destructive">
              <CircleAlertIcon className="mt-px size-3.5 shrink-0" />
              <span>
                Couldn&apos;t read the couplings through Dataverse:{" "}
                {via.message}
              </span>
            </p>
          )}
          <CompanionFind
            companies={companies}
            entry={entry}
            source={source ?? null}
            found={found}
            orgHost={orgHost}
            onChoose={(key) => {
              setChosen(key)
              setFound({ state: "idle" })
            }}
            onFind={() => void find()}
          />
        </>
      )}
    </CollapsibleSection>
  )
}

/**
 * No couplings virtual table in the org: what to install and where to make
 * it visible. Without the Business Central Virtual Table app at all (the org
 * names no BC environment), that comes first.
 */
function CouplingsSetup({
  clientUrl,
  source,
  configAppId,
}: {
  clientUrl: string
  source: CeBcSource | null
  configAppId: string | null
}) {
  // The Business Central Configuration app, else the setup table itself
  const configUrl = configAppId
    ? `${clientUrl}/main.aspx?appid=${configAppId}`
    : `${clientUrl}/main.aspx?pagetype=entitylist&etn=msdyn_businesscentralvirtualentity`
  const link = "font-medium underline underline-offset-2"

  return (
    <div className="mb-3 flex flex-col gap-1.5 rounded-lg bg-sandbox p-2.5 text-xs text-sandbox-foreground">
      <p className="flex items-start gap-1.5 font-semibold">
        <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
        {source
          ? "The Dynamic Assist couplings table isn't in this org yet"
          : "Business Central virtual tables aren't set up in this org"}
      </p>
      <p>
        To see coupled records here straight away, without opening Business
        Central:
      </p>
      <ol className="ml-4 flex list-decimal flex-col gap-1">
        {!source && (
          <li>
            Install Microsoft&apos;s{" "}
            <a
              href={BC_VIRTUAL_TABLES.app}
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              Business Central Virtual Table
            </a>{" "}
            app in this environment and connect it to Business Central (
            <a
              href={BC_VIRTUAL_TABLES.docs}
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              how
            </a>
            ).
          </li>
        )}
        <li>
          Install the latest{" "}
          <a
            href={COMPANION_LATEST}
            target="_blank"
            rel="noreferrer"
            className={link}
          >
            Dynamic Assist Companion
          </a>{" "}
          app in Business Central
          {source ? ` (${source.environment})` : ""}. It adds the couplings API.
        </li>
        <li>
          In{" "}
          <a href={configUrl} target="_blank" rel="noreferrer" className={link}>
            Business Central Configuration
          </a>
          , open <b>Available Tables</b>, find <b>Dynamics 365 Couplings</b> and
          tick <b>Visible</b>.
        </li>
      </ol>
      <p>Until then, find it through a Business Central company below.</p>
    </div>
  )
}

/** The companion route: pick a BC company, then ask its companion app. */
function CompanionFind({
  companies,
  entry,
  source,
  found,
  orgHost,
  onChoose,
  onFind,
}: {
  companies: HistoryEntry[]
  entry: HistoryEntry | undefined
  source: CeBcSource | null
  found: Found
  orgHost: string
  onChoose: (key: string) => void
  onFind: () => void
}) {
  if (!entry)
    return (
      <p className="text-xs text-muted-foreground">
        {source
          ? `Open a company in ${source.environment} once, and it can find the coupled record here`
          : "Open the Business Central company that syncs with this org once, and it can find the coupled record here"}{" "}
        (needs the Dynamic Assist Companion app there).
      </p>
    )

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-1.5">
        <select
          aria-label="Business Central company"
          value={entry.key}
          onChange={(e) => onChoose(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs"
        >
          {companies.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label ?? c.title}
              {c.subtitle ? ` · ${c.subtitle}` : ""}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={found.state === "busy"} onClick={onFind}>
          {found.state === "busy" && <Loader2Icon className="animate-spin" />}
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
          <CoupledList records={found.records} ctx={parseBcUrl(entry.url)} />
        ))}
    </div>
  )
}

/** The coupled records, each opening its page in Business Central. */
function CoupledList({
  records,
  ctx,
}: {
  records: CeBcCoupling[]
  ctx: BcContext | null
}) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border text-xs">
      {records.map((r) => {
        const url =
          ctx && r.pageId && r.exists
            ? buildBcUrl(ctx, { page: r.pageId, filter: r.filter })
            : null
        return (
          <li key={`${r.tableId}:${r.key}`}>
            <button
              type="button"
              disabled={!url}
              onClick={() => url && chrome.tabs.create({ url })}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium">
                  {r.tableCaption}
                  {!r.exists && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      Record not found
                    </Badge>
                  )}
                  {r.skipped && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      Skipped
                    </Badge>
                  )}
                </span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {r.key || "—"}
                </span>
              </span>
              <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
