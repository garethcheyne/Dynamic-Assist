import * as React from "react"
import {
  CheckIcon,
  HistoryIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { CollapsibleSection, Count } from "@/components/collapsible-section"
import { SearchBox } from "@/components/search-box"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  clearHistory,
  HISTORY_KEY,
  removeVisit,
  setLabel,
  setPinned,
  type HistoryEntry,
} from "@/lib/history"
import { useStorage } from "@/lib/use-storage"
import { PRODUCTS } from "@/shared/products"

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
function ago(time: number) {
  const minutes = Math.round((time - Date.now()) / 60000)
  if (minutes > -1) return "just now"
  if (minutes > -60) return rtf.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours > -24) return rtf.format(hours, "hour")
  return rtf.format(Math.round(hours / 24), "day")
}

/** Pinned instances first, then everything you've visited by product. */
export function HistoryView() {
  const [entries] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()
  const shown = entries.filter(
    (e) =>
      !q ||
      `${e.label ?? ""} ${e.title} ${e.subtitle ?? ""} ${e.url}`
        .toLowerCase()
        .includes(q)
  )
  const pinned = shown.filter((e) => e.pinned)
  const unpinned = entries.filter((e) => !e.pinned).length

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <HistoryIcon className="size-6 text-primary" />
        <p className="max-w-64">
          No history yet. Business Central environments, Dynamics 365 orgs and
          Power Apps environments you open will be listed here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search names, environments, companies"
          />
        </div>
        <Button
          variant="ghost"
          size="xs"
          title="Forget everything except pinned"
          disabled={unpinned === 0}
          onClick={() => void clearHistory()}
        >
          <Trash2Icon data-icon="inline-start" />
          Clear
        </Button>
      </div>

      {pinned.length > 0 && (
        <CollapsibleSection
          id="history.pinned"
          title="Pinned"
          icon={<PinIcon />}
          summary={<Count>{pinned.length}</Count>}
          bodyClassName="gap-0 px-1.5"
        >
          {pinned.map((e) => (
            <HistoryRow key={e.key} entry={e} showProduct />
          ))}
        </CollapsibleSection>
      )}

      {(Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]).map((platform) => {
        const items = shown.filter((e) => e.platform === platform && !e.pinned)
        if (items.length === 0) return null
        const product = PRODUCTS[platform]
        return (
          <CollapsibleSection
            key={platform}
            id={`history.${platform}`}
            title={product.name}
            icon={<img src={product.logo} alt="" className="size-3.5" />}
            summary={<Count>{items.length}</Count>}
            bodyClassName="gap-0 px-1.5"
          >
            {items.map((e) => (
              <HistoryRow key={e.key} entry={e} />
            ))}
          </CollapsibleSection>
        )
      })}

      {shown.length === 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      )}
      <p className="text-center text-[11px] text-muted-foreground">
        Kept in this browser only. Pin one to keep it.
      </p>
    </div>
  )
}

function HistoryRow({
  entry: e,
  showProduct,
}: {
  entry: HistoryEntry
  showProduct?: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const name = e.label || e.title
  // With a friendly name, the real title moves to the second line
  const detail = [e.label ? e.title : null, e.subtitle, ago(e.lastVisited)]
    .filter(Boolean)
    .join(" · ")

  if (editing) {
    return (
      <RenameRow
        entry={e}
        onDone={() => setEditing(false)}
        logo={showProduct ? PRODUCTS[e.platform].logo : undefined}
      />
    )
  }

  return (
    <div className="group/history flex items-center gap-0.5 rounded-md hover:bg-muted/60">
      <button
        type="button"
        title={`Open ${e.url}`}
        onClick={() => chrome.tabs.create({ url: e.url })}
        className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left"
      >
        {showProduct && (
          <img
            src={PRODUCTS[e.platform].logo}
            alt={PRODUCTS[e.platform].name}
            className="size-4 shrink-0"
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-medium">{name}</span>
            {e.envType && (
              <span
                className={cn(
                  "rounded px-1 text-[9px] font-semibold tracking-wide uppercase",
                  e.envType === "production"
                    ? "bg-production text-production-foreground"
                    : "bg-sandbox text-sandbox-foreground"
                )}
              >
                {e.envType}
              </span>
            )}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {detail}
          </span>
        </span>
      </button>
      <RowButton
        label={e.pinned ? "Unpin" : "Pin"}
        visible={e.pinned}
        onClick={() => void setPinned(e.key, !e.pinned)}
      >
        {e.pinned ? <PinOffIcon /> : <PinIcon />}
      </RowButton>
      <RowButton label="Rename" onClick={() => setEditing(true)}>
        <PencilIcon />
      </RowButton>
      <RowButton label="Remove" onClick={() => void removeVisit(e.key)}>
        <XIcon />
      </RowButton>
    </div>
  )
}

function RenameRow({
  entry: e,
  logo,
  onDone,
}: {
  entry: HistoryEntry
  logo?: string
  onDone: () => void
}) {
  const [value, setValue] = React.useState(e.label ?? "")
  const save = () => {
    void setLabel(e.key, value)
    onDone()
  }
  return (
    <form
      className="flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-1"
      onSubmit={(ev) => {
        ev.preventDefault()
        save()
      }}
    >
      {logo && <img src={logo} alt="" className="size-4 shrink-0" />}
      <Input
        autoFocus
        className="h-7 flex-1 text-xs"
        placeholder={e.title}
        aria-label={`Name for ${e.title}`}
        value={value}
        onChange={(ev) => setValue(ev.target.value)}
        onKeyDown={(ev) => ev.key === "Escape" && onDone()}
      />
      <Button type="submit" variant="ghost" size="icon-xs" title="Save name">
        <CheckIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Cancel"
        onClick={onDone}
      >
        <XIcon />
      </Button>
    </form>
  )
}

function RowButton({
  label,
  visible,
  onClick,
  children,
}: {
  label: string
  /** Show even when the row isn't hovered (e.g. the pin on pinned rows) */
  visible?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn(
        "group-hover/history:opacity-100 focus-visible:opacity-100",
        visible ? "text-primary opacity-100" : "opacity-0"
      )}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
