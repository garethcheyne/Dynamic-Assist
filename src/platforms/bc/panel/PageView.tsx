import {
  DatabaseIcon,
  ExternalLinkIcon,
  LayoutListIcon,
  LinkIcon,
  TableIcon,
} from "lucide-react"

import { Count, CollapsibleSection } from "@/components/collapsible-section"
import { CopyButton } from "@/components/copy-button"
import { CopyJsonButton } from "@/components/copy-json-button"
import { Detail, DetailGrid } from "@/components/detail-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/lib/copy"

import { fieldsToJson, type BcForm, type BcPageInfo } from "../page-info"
import { bcRecordLink, buildBcUrl, type BcContext } from "../url"
import { FieldList } from "./FieldList"
import { COMPANION_OFF } from "./use-companion-status"

/** The current page: what it is, then its fields. */
export function PageView({
  ctx,
  form,
  session,
  onQuery,
  queryOff = false,
}: {
  ctx: BcContext
  form: BcForm
  session: BcPageInfo["session"]
  /** Opens the query builder on a table */
  onQuery: (tableId: number) => void
  /** The companion isn't available here: the query button only explains */
  queryOff?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <PageSummary
        ctx={ctx}
        form={form}
        session={session}
        onQuery={onQuery}
        queryOff={queryOff}
      />
      <CollapsibleSection
        id="bc.fields"
        title="Fields"
        icon={<LayoutListIcon />}
        summary={<Count>{form.fields.length}</Count>}
        actions={
          <CopyJsonButton
            data={() => fieldsToJson(form.fields)}
            what={`${form.fields.length} fields`}
          />
        }
      >
        <FieldList fields={form.fields} />
      </CollapsibleSection>
    </div>
  )
}

function PageSummary({
  ctx,
  form,
  session,
  onQuery,
  queryOff,
}: {
  ctx: BcContext
  form: BcForm
  session: BcPageInfo["session"]
  onQuery: (tableId: number) => void
  queryOff: boolean
}) {
  const copy = useCopy()
  const recordLink = bcRecordLink(ctx, form, session)
  const key = form.primaryKey
    .map(
      (no) => form.fields.find((f) => f.fieldNo === no)?.schemaName ?? `#${no}`
    )
    .join(", ")
  const open = (params: Record<string, number>) =>
    chrome.tabs.create({ url: buildBcUrl(ctx, params) })

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <ObjectBadge kind="Page" id={form.pageId} />
        {/* Pages with no source table can report 0 */}
        {!!form.tableId && <ObjectBadge kind="Table" id={form.tableId} />}
        <Badge variant="secondary">{form.pageType}</Badge>
        {/* The same buttons in the same order as Dynamics 365's Record tab */}
        <div className="ml-auto flex">
          {recordLink && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Copy record link"
              aria-label="Copy record link"
              onClick={() => copy(recordLink, "record link")}
            >
              <LinkIcon />
            </Button>
          )}
          {!!form.tableId && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={
                queryOff
                  ? `Query this table: ${COMPANION_OFF}`
                  : "Query this table (needs the companion app)"
              }
              aria-label="Query this table"
              aria-disabled={queryOff || undefined}
              className={queryOff ? "opacity-50" : undefined}
              onClick={() => onQuery(form.tableId!)}
            >
              <DatabaseIcon />
            </Button>
          )}
          {!!form.tableId && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Open the table's data in a new tab"
              aria-label="Open the table's data in a new tab"
              onClick={() => open({ table: form.tableId! })}
            >
              <TableIcon />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Open this page in a new tab"
            aria-label="Open this page in a new tab"
            onClick={() => open({ page: form.pageId })}
          >
            <ExternalLinkIcon />
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="truncate text-base leading-tight font-semibold">
          {form.caption?.trim() || form.name}
        </h2>
        {form.caption?.trim() && form.caption !== form.name && (
          <p className="truncate text-xs text-muted-foreground">{form.name}</p>
        )}
      </div>

      {/* The record first, then what shows it, then its key: as Dynamics 365 */}
      <DetailGrid>
        {form.systemId && (
          <Detail
            label="SystemId"
            value={form.systemId}
            copy={form.systemId}
            mono
            wide
          />
        )}
        {form.bookmark && (
          <Detail
            label="Bookmark"
            value={form.bookmark}
            copy={form.bookmark}
            mono
            wide
          />
        )}
        {form.app && (
          <Detail
            label="App"
            value={form.app.name}
            title={`${form.app.name} ${form.app.version} · ${form.app.publisher}\n${form.app.id}`}
            copy={form.app.id}
          />
        )}
        {form.app && <Detail label="Version" value={form.app.version} mono />}
        {key && <Detail label="Primary key" value={key} copy={key} wide />}
      </DetailGrid>
    </section>
  )
}

/** "Page 31" with the number copyable, BC teal for the kind. */
export function ObjectBadge({ kind, id }: { kind: string; id: number }) {
  return (
    <span className="group/obj inline-flex h-6 items-center gap-1 rounded-md border bg-background pr-0.5 pl-1.5 text-xs">
      <span className="font-medium text-primary">{kind}</span>
      <span className="font-mono">{id}</span>
      <CopyButton
        value={String(id)}
        what={`${kind.toLowerCase()} ID ${id}`}
        className="size-5 [&_svg]:size-3"
      />
    </span>
  )
}
