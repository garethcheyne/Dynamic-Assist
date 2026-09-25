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
import { ceRecordUrl, findCeRecord } from "../coupling"
import { TOOL_REQUEST, type BcToolRequest } from "../messages"
import type { BcPageInfo, BcToolCommand } from "../page-info"
import { openBcQuery } from "../query/pending"
import { buildBcUrl, type BcContext } from "../url"

/** SystemId's field number, on every table */
const SYSTEM_ID = 2000000000

/**
 * Page, record and query tools: Business Central's side of Level Up's form
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
}: {
  tab: chrome.tabs.Tab
  ctx: BcContext
  page: BcPageInfo | null
  act: Act
  busy: string | null
  onRefresh: () => void
}) {
  const copy = useCopy()
  const notify = useNotify()
  const form = page?.form
  const hasPage = !!form
  const tableId = form?.tableId ?? null
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
      await sendApps(apps)
    } catch {
      // No companion: fields still show app IDs, and Microsoft's apps by name
    }
  }

  const recordLink =
    form && form.bookmark
      ? buildBcUrl(ctx, { page: form.pageId, bookmark: form.bookmark })
      : null

  return (
    <div className="flex flex-col gap-3">
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
            detail="Shows each field's table name and number next to its caption on cards, and in each column header on lists. Click a badge to copy the name, ready for filters, AL or the query builder. Numbers are exact; names come from the page controls, so a renamed control can differ from the table field."
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
            icon={<img src={ceLogo} alt="" className="size-3.5" />}
            title="Dynamics 365 record"
            description="Open the Dataverse record this one is coupled to (companion app)"
            detail="Looks up this record's coupling in Business Central's Dataverse integration (CRM Integration Record) and opens the coupled row in Dynamics 365, in your integration's app. Needs the Dynamic Assist Companion app; if its query page isn't open, one opens in a background tab."
            unavailable="Open a single record on a table that syncs with Dataverse."
            disabled={!tableId || !form?.systemId}
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
          <ActionTile
            icon={<ListChecksIcon />}
            title="All fields"
            description="Every field of this record, including ones the page doesn't show (companion app)"
            detail="Opens the query builder on this one record with every field of its table, including fields the page hides, FlowFields and system fields such as SystemId and SystemModifiedAt. Read-only, with your permissions. Needs the Dynamic Assist Companion app."
            unavailable="Open a single record first."
            disabled={!tableId || !form?.systemId}
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
        </TileGrid>
      </CollapsibleSection>

      <CollapsibleSection
        id="bc.tools.query"
        title="Query"
        icon={<DatabaseZapIcon />}
      >
        <TileGrid>
          <ActionTile
            icon={<DatabaseIcon />}
            title="Query builder"
            description="Query any table you can read (companion app)"
            detail="Opens the query builder over this page, on this page's table if it has one; pick any other table from there. Filter, join related tables, sort, and export to Excel, CSV or JSON, or turn the query into AL or an API. Needs the Dynamic Assist Companion app."
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
            unavailable="Open a page that has a source table."
            disabled={!tableId}
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
            void act(q.id, () =>
              openBcQuery(tab, {
                app: "bc",
                tableId: q.query.table,
                query: q.query,
                run: true,
              })
            )
          }}
        />
      </CollapsibleSection>
    </div>
  )
}
