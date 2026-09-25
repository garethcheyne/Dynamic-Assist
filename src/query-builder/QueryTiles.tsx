import { DatabaseIcon, Maximize2Icon, XIcon } from "lucide-react"
import { cn } from "cn"

export type QueryTile = {
  seq: number
  platform: "ce" | "bc"
  /** "Account · 50 rows" */
  title: string
}

/**
 * Minimised query builders, as tiles stacked in the page's bottom-right
 * corner: click one to bring it back as it was, × to close it.
 */
export function QueryTiles({
  tiles,
  dark,
  onRestore,
  onClose,
}: {
  tiles: QueryTile[]
  dark: boolean
  onRestore: (seq: number) => void
  onClose: (seq: number) => void
}) {
  if (!tiles.length) return null
  return (
    <div className={cn("da-root", dark && "dark")}>
      <div
        role="list"
        aria-label="Minimised query builders"
        className="fixed right-4 bottom-4 z-[2147483002] flex w-72 flex-col-reverse gap-2"
      >
        {tiles.map((t) => (
          <div
            key={t.seq}
            role="listitem"
            data-platform={t.platform}
            className="group flex items-center gap-2 overflow-hidden rounded-lg border bg-background text-foreground shadow-lg"
          >
            <span
              aria-hidden
              className="w-1 self-stretch"
              style={{ background: "var(--brand-gradient)" }}
            />
            <button
              type="button"
              onClick={() => onRestore(t.seq)}
              title="Bring it back"
              className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
            >
              <DatabaseIcon className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-muted-foreground">
                  Query builder
                </span>
                <span className="block truncate text-xs font-medium">
                  {t.title}
                </span>
              </span>
              <Maximize2Icon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </button>
            <button
              type="button"
              onClick={() => onClose(t.seq)}
              aria-label={`Close ${t.title}`}
              title="Close"
              className="mr-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
