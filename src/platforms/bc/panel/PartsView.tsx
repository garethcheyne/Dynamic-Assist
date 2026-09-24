import { PanelsTopLeftIcon, PuzzleIcon } from "lucide-react"

import { CollapsibleSection, Count } from "@/components/collapsible-section"
import { CopyJsonButton } from "@/components/copy-json-button"

import { fieldsToJson, type BcForm } from "../page-info"
import { buildBcUrl, type BcContext } from "../url"
import { FieldList } from "./FieldList"
import { ObjectBadge } from "./PageView"

/** FactBoxes and subpages, each folded down to its header until opened. */
export function PartsView({
  ctx,
  host,
  parts,
}: {
  ctx: BcContext
  host: BcForm
  parts: BcForm[]
}) {
  if (parts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
        This page has no parts.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, i) => {
        const extension = part.app && part.app.id !== host.app?.id
        return (
          <CollapsibleSection
            key={`${part.pageId}-${i}`}
            // Remembered per part page, so a FactBox stays open across records
            id={`bc.part.${part.pageId}`}
            defaultCollapsed
            title={part.caption?.trim() || part.name}
            icon={extension ? <PuzzleIcon /> : <PanelsTopLeftIcon />}
            summary={<Count>{part.fields.length}</Count>}
            actions={
              <>
                {part.fields.length > 0 && (
                  <CopyJsonButton
                    data={() => fieldsToJson(part.fields)}
                    what={`${part.caption?.trim() || part.name} fields`}
                  />
                )}
                <ObjectBadge kind="Page" id={part.pageId} />
              </>
            }
          >
            <p className="-mt-1 truncate text-[11px] text-muted-foreground">
              {part.name} · {part.pageType}
              {part.tableId !== null && ` · Table ${part.tableId}`}
              {part.app && ` · ${part.app.name}`}
            </p>
            <FieldList fields={part.fields} />
            <OpenPart ctx={ctx} pageId={part.pageId} />
          </CollapsibleSection>
        )
      })}
    </div>
  )
}

function OpenPart({ ctx, pageId }: { ctx: BcContext; pageId: number }) {
  return (
    <button
      type="button"
      className="self-start text-[11px] text-primary hover:underline"
      onClick={() =>
        chrome.tabs.create({ url: buildBcUrl(ctx, { page: pageId }) })
      }
    >
      Open page {pageId} on its own
    </button>
  )
}
