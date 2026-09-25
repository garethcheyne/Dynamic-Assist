import {
  DatabaseIcon,
  ExternalLinkIcon,
  LayoutListIcon,
  TableIcon,
} from "lucide-react"

import { Count, CollapsibleSection } from "@/components/collapsible-section"
import { CopyButton } from "@/components/copy-button"
import { CopyJsonButton } from "@/components/copy-json-button"
import { Detail, DetailGrid } from "@/components/detail-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { fieldsToJson, type BcForm } from "../page-info"
import { buildBcUrl, type BcContext } from "../url"
import { FieldList } from "./FieldList"

/** The current page: what it is, then its fields. */
export function PageView({
  ctx,
  form,
  onQuery,
}: {
  ctx: BcContext
  form: BcForm
  /** Opens the query builder on a table */
  onQuery: (tableId: number) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <PageSummary ctx={ctx} form={form} onQuery={onQuery} />
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
  onQuery,
}: {
  ctx: BcContext
  form: BcForm
  onQuery: (tableId: number) => void
}) {
  const key = form.primaryKey
    .map(
      (no) => form.fields.find((f) => f.fieldNo === no)?.schemaName ?? `#${no}`
    )
    .join(", ")
  const open = (params: Record<string, number>) =>
    chrome.tabs.create({ url: buildBcUrl(ctx, params) })

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-1.5">
        <ObjectBadge kind="Page" id={form.pageId} />
        {form.tableId !== null && (
          <ObjectBadge kind="Table" id={form.tableId} />
        )}
        <Badge variant="secondary">{form.pageType}</Badge>
        <div className="ml-auto flex">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Open this page in a new tab"
            aria-label="Open this page in a new tab"
            onClick={() => open({ page: form.pageId })}
          >
            <ExternalLinkIcon />
          </Button>
          {form.tableId !== null && (
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
          {form.tableId !== null && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Query this table (needs the companion app)"
              aria-label="Query this table"
              onClick={() => onQuery(form.tableId!)}
            >
              <DatabaseIcon />
            </Button>
          )}
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

      <DetailGrid>
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
