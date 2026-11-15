import {
  DatabaseIcon,
  DatabaseZapIcon,
  EyeOffIcon,
  FoldVerticalIcon,
  LinkIcon,
  ListChecksIcon,
  TableIcon,
  TagsIcon,
  WrenchIcon,
} from "lucide-react"

import ceLogo from "@/assets/brand/ms/dynamics-365.svg"
import { ActionTile, TileGrid } from "@/components/action-tile"
import { CollapsibleSection } from "@/components/collapsible-section"
import { useCopy, useNotify } from "@/lib/copy"
import { rememberBcOrg } from "@/lib/product-links"
import type { Act } from "@/lib/use-action"
import { PanelQueries } from "@/query-builder/PanelQueries"

import { KNOWN_APPS, loadAppNames } from "../app-names"
import { companionFor } from "../companion-channel"
import type { CompanionStatus } from "../companion-status"
import { CompanionSetup } from "../CompanionSetup"
import { ceRecordUrl, findCeRecord } from "../coupling"
import { TOOL_REQUEST, type BcToolRequest } from "../messages"
import {
  showsOneRecord,
  type BcPageInfo,
  type BcToolCommand,
} from "../page-info"
import { openBcQuery } from "../query/pending"
import { bcRecordLink, buildBcUrl, type BcContext } from "../url"
import { COMPANION_OFF } from "./use-companion-status"

/** SystemId's field number, on every table */
const SYSTEM_ID = 2000000000

/**
 * Query, page and record tools, in the same order and with the same first
 * tiles as Dynamics 365's Tools tab: Business Central's side of Level Up's form
 * tools (field names for logical names, blur, expand), plus the record's link
 * and all its fields.
 */
export function ToolsView({
  tab,
  ctx,
  page,
  act,
  busy,
  onRefresh,
  companion,
  onRecheckCompanion,
}: {
  tab: chrome.tabs.Tab
  ctx: BcContext
  page: BcPageInfo | null
  act: Act
  busy: string | null
  onRefresh: () => void
  /** Why the companion's page can't open here, when Business Central said so */
  companion: CompanionStatus | null
  onRecheckCompanion: () => void
}) {
  const off = !!companion
  const copy = useCopy()
  const notify = useNotify()
  const form = page?.form
  const hasPage = !!form
  const tableId = form?.tableId ?? null
  const oneRecord = !!form && showsOneRecord(form.pageType)
  const tool = (command: BcToolCommand, on?: boolean) =>
    act(command, async () => {
      const request: BcToolRequest = { type: TOOL_REQUEST, command, on }
      const answer = (await chrome.tabs
        .sendMessage(tab.id!, request)
        .catch(() => null)) as { message?: string } | null
      onRefresh()
      return answer?.message ?? "Open a Business Central page first"
    })
  // Which extension added each field, for the badges' hover cards: Microsoft's
  // core apps at once, then everything installed via the companion (cached)
  const sendApps = (data: unknown) =>
    chrome.tabs
      .sendMessage(tab.id!, {
        type: TOOL_REQUEST,
        command: "appNames",
        data,
      } satisfies BcToolRequest)
      .catch(() => null)
  const nameApps = async () => {
    await sendApps(KNOWN_APPS)
    try {
      const apps = await loadAppNames(ctx, () =>
        notify("Reading extension names through the companion app…")
      )
      if (apps) await sendApps(apps)
    } catch {
      // No companion: fields still show app IDs, and Microsoft's apps by name
    }
  }

  const recordLink = form ? bcRecordLink(ctx, form, page.session) : null

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection
        id="bc.tools.query"
        title="Query"
        icon={<DatabaseZapIcon />}
      >
        {companion && (
          <div className="mb-2">
            <CompanionSetup
              compact
              status={companion}
              ctx={ctx}
              aadTenantId={page?.environment.aadTenantId}
              onRecheck={onRecheckCompanion}
            />
          </div>
        )}
        <TileGrid>
          <ActionTile
            icon={<DatabaseIcon />}
            title="Query builder"
            description="Query any table you can read (companion app)"
            detail="Opens the query builder over this page, on this page's table if it has one; pick any other table from there. Filter, join related tables, sort, and export to Excel, CSV or JSON, or turn the query into AL or an API. Needs the Dynamic Assist Companion app."
            unavailable={COMPANION_OFF}
            disabled={off}
            busy={busy === "queryBuilder"}
            onClick={() =>
              act("queryBuilder", () =>
                openBcQuery(tab, { app: "bc", tableId: tableId ?? undefined })
              )
            }
          />
          <ActionTile
            icon={<DatabaseZapIcon />}
            title="Query this table"
            description="This page's table in the query builder (companion app)"
            detail="Opens this page's source table in the query builder and runs it: filter, join related tables, sort, up to 5,000 rows at a time, and export to Excel, CSV or JSON, or turn the query into AL or an API. Needs the Dynamic Assist Companion app."
            unavailable={
              off ? COMPANION_OFF : "Open a page that has a source table."
            }
            disabled={off || !tableId}
            busy={busy === "queryTable"}
            onClick={() =>
              act("queryTable", () =>
                openBcQuery(tab, { app: "bc", tableId, run: true })
              )
            }
          />
          <ActionTile
            icon={<TableIcon />}
            title="Table data"
            description="The table's records in Business Central's own table view"
            detail="Opens the table in Business Central's own read-only table view (?table=), with every column. Handy for a quick look without the companion app."
            unavailable="Open a page that has a source table."
            disabled={!tableId}
            onClick={() =>
              tableId &&
              chrome.tabs.create({ url: buildBcUrl(ctx, { table: tableId }) })
            }
          />
        </TileGrid>
        <PanelQueries
          platform="bc"
          busy={busy}
          onOpen={(q) => {
            if (q.platform !== "bc") return
            if (off) {
              notify(COMPANION_OFF, "error")
              return
            }
            void act(q.id, () =>
              openBcQuery(tab, {
                app: "bc",
                tableId: q.query.table,
                query: q.query,
                sql: q.sql,
                run: true,
              })
            )
          }}
        />
      </CollapsibleSection>

      <CollapsibleSection id="bc.tools.page" title="Page" icon={<WrenchIcon />}>
        {!hasPage && (
          <p className="text-xs text-muted-foreground">
            Open a Business Central page to use these.
          </p>
        )}
        <TileGrid>
          <ActionTile
            icon={<TagsIcon />}
            title="Field names"
            description="The table field name and number beside every caption and column; click one to copy it"
            detail="Shows each field's table name and number next to its caption on cards, and in each column header on lists. Click a badge to copy the name, ready for filters, AL or the query builder. Numbers are exact; names come from the page controls, so a renamed control can differ from the table field. Hover a badge for the app that added the field: extensions other than Microsoft's are named once the query builder has been used in this environment."
            unavailable="Open a Business Central page first."
            disabled={!hasPage}
            on={page?.tools?.fieldNames}
            busy={busy === "fieldNames"}
            onClick={() => {
              const on = !page?.tools?.fieldNames
              tool("fieldNames", on)
              if (on) void nameApps()
            }}
          />
          <ActionTile
            icon={<EyeOffIcon />}
            title="Blur data"
            description="Blur values for screenshots and screen sharing"
            detail="Blurs field values, list cells and cues on this page so you can take screenshots or share your screen without showing customer data. Captions stay readable. Click again to show the values."
            unavailable="Open a Business Central page first."
            disabled={!hasPage}
            on={page?.tools?.blur}
            busy={busy === "blur"}
            onClick={() => tool("blur", !page?.tools?.blur)}
          />
          <ActionTile
            icon={<FoldVerticalIcon />}
            title="Expand FastTabs"
            description="Open every collapsed FastTab on the page"
            detail="Opens every collapsed FastTab on the current card at once, so all its fields are visible and searchable with Ctrl+F."
            unavailable="Open a Business Central page first."
            disabled={!hasPage}
            busy={busy === "expandTabs"}
            onClick={() => tool("expandTabs")}
          />
        </TileGrid>
      </CollapsibleSection>

      <CollapsibleSection
        id="bc.tools.record"
        title="Record"
        icon={<ListChecksIcon />}
      >
        <TileGrid>
          <ActionTile
            icon={<LinkIcon />}
            title="Copy record link"
            description="A link that opens this page on this record"
            detail="Copies a URL that opens this page on this exact record (using its bookmark), in this environment and company. Anyone opening it still needs permission to see the record."
            unavailable="Open a single record (a card or document) to get its link."
            disabled={!recordLink}
            onClick={() => recordLink && copy(recordLink, "Record link")}
          />
          <ActionTile
            icon={<ListChecksIcon />}
            title="All fields"
            description="Every field of this record, including ones the page doesn't show (companion app)"
            detail="Opens the query builder on this one record with every field of its table, including fields the page hides, FlowFields and system fields such as SystemId and SystemModifiedAt. Read-only, with your permissions. Needs the Dynamic Assist Companion app."
            unavailable={off ? COMPANION_OFF : "Open a single record first."}
            disabled={off || !oneRecord || !tableId || !form?.systemId}
            busy={busy === "allFields"}
            onClick={() =>
              act("allFields", () =>
                openBcQuery(tab, {
                  app: "bc",
                  tableId,
                  fields: "all",
                  filters: [{ field: SYSTEM_ID, filter: form!.systemId! }],
                  run: true,
                })
              )
            }
          />
          <ActionTile
            icon={<img src={ceLogo} alt="" className="size-3.5" />}
            title="Dynamics 365 record"
            description="Open the Dataverse record this one is coupled to (companion app)"
            detail="Looks up this record's coupling in Business Central's Dataverse integration (CRM Integration Record) and opens the coupled row in Dynamics 365, in your integration's app. Needs the Dynamic Assist Companion app; if its query page isn't open, one opens in a background tab."
            unavailable={
              off
                ? COMPANION_OFF
                : "Open a single record on a table that syncs with Dataverse."
            }
            disabled={off || !oneRecord || !tableId || !form?.systemId}
            busy={busy === "coupled"}
            onClick={() =>
              act("coupled", async () => {
                const call = await companionFor(ctx, () =>
                  notify(
                    "Opening the companion's query page in the background…"
                  )
                )
                const target = await findCeRecord(
                  call,
                  tableId!,
                  form!.systemId!
                )
                void rememberBcOrg(ctx, target?.server ?? null)
                if (!target) return "This record isn't coupled to Dynamics 365"
                const entity = target.entities[0]
                const url = entity ? ceRecordUrl(target, entity) : null
                if (!url)
                  throw new Error(
                    "Coupled, but this company has no Dataverse connection set up to open it in"
                  )
                await chrome.tabs.create({ url })
                return `Opened the coupled ${entity}`
              })
            }
          />
        </TileGrid>
      </CollapsibleSection>
    </div>
  )
}
