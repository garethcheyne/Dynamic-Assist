import {
  ActivityIcon,
  ClipboardCopyIcon,
  CopyPlusIcon,
  DatabaseIcon,
  EyeOffIcon,
  FoldVerticalIcon,
  GaugeIcon,
  ListRestartIcon,
  RefreshCwIcon,
  RibbonIcon,
  SaveIcon,
  TagsIcon,
  UnlockIcon,
  WandSparklesIcon,
  WrenchIcon,
  ListIcon,
  BugIcon,
  DatabaseZapIcon,
  ListFilterIcon,
} from "lucide-react"

import { ActionTile, TileGrid } from "@/components/action-tile"
import { CollapsibleSection } from "@/components/collapsible-section"
import { useCopy } from "@/lib/copy"
import type { Act } from "@/lib/use-action"

import { openQueryBuilder } from "@/query-builder/open"
import { PanelQueries } from "@/query-builder/PanelQueries"
import type { CeState } from "../types"
import { ceUrls, withFlag } from "../urls"
import type { useCeTab } from "../use-ce-tab"

type Run = ReturnType<typeof useCeTab>["run"]

/** Level Up's form, list and debug tools. */
export function ToolsView({
  state,
  tab,
  run,
  act,
  busy,
}: {
  state: CeState
  tab: chrome.tabs.Tab
  run: Run
  act: Act
  busy: string | null
}) {
  const copy = useCopy()
  const hasForm = !!state.form
  const isList = state.page.pageType === "entitylist" && !!state.page.viewId
  const urls = ceUrls(state)
  const reloadWith = (flag: string) =>
    act(flag, async () => {
      await chrome.tabs.update(tab.id!, { url: withFlag(tab.url!, flag) })
      return "Reloading with " + flag
    })

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection
        id="ce.tools.query"
        title="Query"
        icon={<DatabaseZapIcon />}
      >
        <TileGrid>
          <ActionTile
            icon={<DatabaseZapIcon />}
            title="Query builder"
            description="Build and run a query, export to Excel, CSV or JSON"
            detail="Opens the FetchXML query builder over this page: pick a table and columns, add filters and linked tables, run it with your permissions and export to Excel, CSV or JSON."
            busy={busy === "query"}
            onClick={() =>
              act("query", async () => {
                await openQueryBuilder(tab.id!, {
                  entityName: state.page.entityName ?? state.form?.entityName,
                })
              })
            }
          />
          <ActionTile
            icon={<ListFilterIcon />}
            title="Open this view"
            description="The current list view in the query builder"
            detail="Opens the list view you're looking at in the query builder, with its columns, filters and sort, so you can change and export it."
            disabled={!isList}
            busy={busy === "queryView"}
            onClick={() =>
              act("queryView", async () => {
                const view = await run("viewFetchXml")
                await openQueryBuilder(tab.id!, { fetchXml: view.fetchXml })
              })
            }
          />
        </TileGrid>
        <PanelQueries
          platform="ce"
          busy={busy}
          onOpen={(q) => {
            if (q.platform !== "ce") return
            void act(q.id, () =>
              openQueryBuilder(tab.id!, { fetchXml: q.fetchXml, run: true })
            )
          }}
        />
      </CollapsibleSection>

      <CollapsibleSection id="ce.tools.form" title="Form" icon={<WrenchIcon />}>
        {!hasForm && (
          <p className="text-xs text-muted-foreground">
            Open a record form to use these. Logical names also works on list
            views.
          </p>
        )}
        <TileGrid>
          <ActionTile
            icon={<UnlockIcon />}
            title="God mode"
            description="Show every field, tab and section; unlock and un-require all"
            detail="Shows every hidden field, tab and section, unlocks read-only fields and makes required fields optional, on this form only and until you reload. Nothing is saved unless you save the record, and server-side rules and security still apply."
            disabled={!hasForm}
            on={state.modes.godMode}
            busy={busy === "godMode"}
            onClick={() =>
              act("godMode", async () => {
                const r = await run("godMode")
                return `Unlocked ${r.controls} controls`
              })
            }
          />
          <ActionTile
            icon={<TagsIcon />}
            title="Logical names"
            description="On form fields and list columns, with copy buttons"
            detail="On a form, replaces each field's label with its logical (schema) name and adds a copy button. On list views and subgrids, adds each column's logical name to its header (linked columns show the column; the tooltip names the link). Click any to copy it for FetchXML, the Web API or plug-ins. Turn it off or reload to go back."
            unavailable="Open a record form or a list view."
            disabled={!hasForm && !isList}
            on={state.modes.logicalNames}
            busy={busy === "logicalNames"}
            onClick={() =>
              act("logicalNames", async () => {
                const on = !state.modes.logicalNames
                await run("logicalNames", { on })
                return on ? "Showing logical names" : "Labels restored"
              })
            }
          />
          <ActionTile
            icon={<FoldVerticalIcon />}
            title="Expand tabs"
            description="Open every tab on the form"
            detail="Opens every collapsed tab on the form so all its sections load and are searchable."
            disabled={!hasForm}
            busy={busy === "expandTabs"}
            onClick={() =>
              act("expandTabs", async () => {
                const r = await run("expandTabs")
                return `Expanded ${r.tabs} tabs`
              })
            }
          />
          <ActionTile
            icon={<ListRestartIcon />}
            title="Refresh subgrids"
            description="Reload every subgrid on the form"
            detail="Reloads every subgrid on the form without refreshing the whole page, for example after a plug-in or flow has created related rows."
            disabled={!hasForm}
            busy={busy === "refreshSubgrids"}
            onClick={() =>
              act("refreshSubgrids", async () => {
                const r = await run("refreshSubgrids")
                return `Refreshed ${r.grids} subgrids`
              })
            }
          />
          <ActionTile
            icon={<WandSparklesIcon />}
            title="Fill required"
            description="Put placeholder values in empty required fields"
            detail="Puts placeholder values into empty required fields (text, numbers, dates, the first option) so you can save a test record quickly. Check the values before saving: they are real data once saved."
            disabled={!hasForm}
            busy={busy === "fillRequired"}
            onClick={() =>
              act("fillRequired", async () => {
                const r = await run("fillRequired")
                return (
                  `Filled ${r.filled.length}` +
                  (r.skipped.length ? `, skipped ${r.skipped.join(", ")}` : "")
                )
              })
            }
          />
          <ActionTile
            icon={<CopyPlusIcon />}
            title="Clone record"
            description="Open a new form with this record's values"
            detail="Opens a new form pre-filled with this record's field values (not its ID, owner or system fields). Nothing is created until you save the new form."
            disabled={!hasForm}
            busy={busy === "clone"}
            onClick={() =>
              act("clone", async () => {
                const r = await run("clone")
                return `New form with ${r.fields} values`
              })
            }
          />
          <ActionTile
            icon={<RefreshCwIcon />}
            title="Refresh"
            description="Reload the form's data without saving"
            detail="Reloads the form's data from the server without saving. Unsaved changes on the form are lost."
            disabled={!hasForm}
            busy={busy === "refresh"}
            onClick={() =>
              act("refresh", async () => {
                await run("refresh")
                return "Refreshed"
              })
            }
          />
          <ActionTile
            icon={<SaveIcon />}
            title="Save"
            description="Save the record"
            detail="Saves the record, the same as Ctrl+S, running the form's save events, business rules and plug-ins."
            disabled={!hasForm || !state.form?.isDirty}
            busy={busy === "save"}
            onClick={() =>
              act("save", async () => {
                await run("save")
                return "Saved"
              })
            }
          />
          <ActionTile
            icon={<EyeOffIcon />}
            title="Blur data"
            description="Blur values for screenshots"
            detail="Blurs field values on the form and in grids for screenshots and screen sharing. Labels stay readable."
            on={state.modes.blurred}
            busy={busy === "blur"}
            onClick={() =>
              act("blur", async () => {
                const on = !state.modes.blurred
                await run("blur", { on })
                return on ? "Values blurred" : "Blur removed"
              })
            }
          />
        </TileGrid>
      </CollapsibleSection>

      <CollapsibleSection
        id="ce.tools.view"
        title="List view"
        icon={<ListIcon />}
      >
        {!isList && (
          <p className="text-xs text-muted-foreground">
            Open a list view to use these.
          </p>
        )}
        <TileGrid>
          <ActionTile
            icon={<ClipboardCopyIcon />}
            title="Copy FetchXML"
            description="The current view's query"
            detail="Copies the FetchXML of the list view you're looking at, including your current filters and sort, ready for XrmToolBox, the query builder or code."
            disabled={!isList}
            busy={busy === "viewFetchXml"}
            onClick={() =>
              act("viewFetchXml", async () => {
                const r = await run("viewFetchXml")
                await copy(r.fetchXml, `FetchXML of ${r.name}`)
              })
            }
          />
          <ActionTile
            icon={<DatabaseIcon />}
            title="View in Web API"
            description="The view's rows as JSON"
            detail="Opens the view's rows as raw JSON from the Web API in a new tab: every column with formatted values, useful for checking what integrations actually receive."
            disabled={!isList}
            onClick={() =>
              act("webApiView", async () => {
                const r = await run("viewFetchXml")
                await chrome.tabs.create({
                  url: urls.webApiView(
                    r.entitySetName,
                    state.page.viewId!,
                    state.page.viewType === "4230"
                  ),
                })
              })
            }
          />
        </TileGrid>
      </CollapsibleSection>

      <CollapsibleSection id="ce.tools.debug" title="Debug" icon={<BugIcon />}>
        <p className="-mt-1 text-[11px] text-muted-foreground">
          These reload the page with a switch on.
        </p>
        <TileGrid>
          <ActionTile
            icon={<ActivityIcon />}
            title="Form monitor"
            description="Monitor form events and network"
            detail="Opens Power Apps Monitor for this form, which records form events, scripts and network calls as they happen."
            onClick={() => reloadWith("monitor")}
          />
          <ActionTile
            icon={<RibbonIcon />}
            title="Ribbon debug"
            description="Show command checker"
            detail="Reloads the page with the Command Checker on: an extra button in every command bar that explains why each button is shown or hidden."
            onClick={() => reloadWith("ribbondebug")}
          />
          <ActionTile
            icon={<GaugeIcon />}
            title="Performance"
            description="Show the performance panel"
            detail="Reloads the page with the performance panel on, showing how long the form and its parts took to load."
            onClick={() => reloadWith("perf")}
          />
        </TileGrid>
      </CollapsibleSection>
    </div>
  )
}
