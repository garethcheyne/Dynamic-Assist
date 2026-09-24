import * as React from "react"
import { ChevronsUpDownIcon, Loader2Icon } from "lucide-react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"

import type { CeEntity } from "../types"

const MAX_RESULTS = 60

/** Best matches first: exact logical name, then prefix, then anywhere. */
function rank(e: CeEntity, q: string): number {
  const logical = e.logicalName
  const name = (e.displayName ?? "").toLowerCase()
  if (logical === q) return 0
  if (name === q) return 1
  if (name.startsWith(q)) return 2
  if (logical.startsWith(q)) return 3
  if (name.includes(q)) return 4
  if (logical.includes(q)) return 5
  return -1
}

/**
 * Searchable table list from the metadata API: display name and logical name
 * on each row. Loads the list the first time it opens.
 */
export function TablePicker({
  value,
  onChange,
  load,
}: {
  /** Selected logical name */
  value: string
  onChange: (logicalName: string) => void
  load: () => Promise<CeEntity[]>
}) {
  const [entities, setEntities] = React.useState<CeEntity[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState<string | null>(null)
  const [active, setActive] = React.useState(0)
  const listRef = React.useRef<HTMLUListElement>(null)
  const listId = React.useId()

  const ensureLoaded = () => {
    if (entities || error) return
    load()
      .then(setEntities)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  const selected = entities?.find((e) => e.logicalName === value)
  // While not typing, the box shows the chosen table's name
  const text = query ?? (selected?.displayName || value)

  const q = (query ?? "").trim().toLowerCase()
  const results = React.useMemo(() => {
    if (!entities) return []
    if (!q) return entities.slice(0, MAX_RESULTS)
    return entities
      .map((e) => [e, rank(e, q)] as const)
      .filter(([, r]) => r >= 0)
      .sort((a, b) => a[1] - b[1])
      .slice(0, MAX_RESULTS)
      .map(([e]) => e)
  }, [entities, q])

  const choose = (e: CeEntity) => {
    onChange(e.logicalName)
    setQuery(null)
    setOpen(false)
  }

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false)
          setQuery(null)
        }
      }}
    >
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Table"
        className="h-7 pr-24 text-xs"
        placeholder={
          selected?.displayName
            ? `${selected.displayName} · search tables`
            : "Search tables"
        }
        value={text}
        onFocus={() => {
          // Start a fresh search; the current table stays as the placeholder
          ensureLoaded()
          setQuery("")
          setActive(0)
          setOpen(true)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === "Enter" && open && results[active]) {
            e.preventDefault()
            choose(results[active])
          } else if (e.key === "Escape") {
            setOpen(false)
            setQuery(null)
          }
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        {query === null && value && selected?.displayName && (
          <span className="max-w-20 truncate font-mono">{value}</span>
        )}
        <ChevronsUpDownIcon className="size-3.5" />
      </span>

      {open && (
        <div className="absolute inset-x-0 top-8 z-40 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {!entities && !error && (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              Loading tables…
            </div>
          )}
          {error && (
            <div className="p-3 text-xs text-destructive">
              Couldn't load tables: {error}
            </div>
          )}
          {entities && results.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              No table matches “{query}”.
            </div>
          )}
          {results.length > 0 && (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="max-h-72 overflow-y-auto p-1"
            >
              {results.map((e, i) => (
                <li
                  key={e.logicalName}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  // mousedown so the input's blur doesn't close the list first
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    choose(e)
                  }}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5",
                    i === active && "bg-accent text-accent-foreground",
                    e.logicalName === value && "font-semibold"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {e.displayName ?? (
                      <span className="text-muted-foreground italic">
                        No display name
                      </span>
                    )}
                  </span>
                  {e.custom && (
                    <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                      custom
                    </span>
                  )}
                  <span className="max-w-[45%] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                    {e.logicalName}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {entities && (
            <div className="border-t px-2 py-1 text-[10px] text-muted-foreground">
              {q
                ? `${results.length}${results.length === MAX_RESULTS ? "+" : ""} of ${entities.length} tables`
                : `${entities.length} tables · type to search`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
