import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"

export type SelectItem = {
  value: string
  label: string
  /** Shown faint on the right: a logical name, a type */
  hint?: string
}

const MAX = 80

/**
 * A searchable select. Its list is position: fixed against the input, not
 * portalled: in the page's shadow root a portal to <body> would lose the modal's
 * styles.
 *
 * With `several`, each item has a tick box: clicking ticks it, ticks are kept
 * as the search changes, and Add hands every ticked value to `onAdd` in the
 * order they were ticked. Enter with nothing ticked adds the highlighted item
 * straight away and leaves the list open; Shift+Enter ticks it. Esc or
 * clicking away closes the list and forgets the ticks. The parent drops what's
 * been added from `items`.
 */
export function SearchSelect({
  items,
  value,
  onChange,
  onAdd,
  placeholder = "Search",
  className,
  loading,
  ariaLabel,
  onSearch,
  selectedLabel,
  several,
}: {
  items: SelectItem[]
  value: string | null
  /** One pick (the list closes) */
  onChange?: (value: string) => void
  /** With `several`: the values added, in the order they were ticked */
  onAdd?: (values: string[]) => void
  placeholder?: string
  className?: string
  loading?: boolean
  ariaLabel: string
  /** Search on the server instead of filtering `items` (lookups) */
  onSearch?: (query: string) => void
  /** Label for a value that isn't among `items` (a lookup's current record) */
  selectedLabel?: string
  /** Tick as many as you like, then Add */
  several?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  /** With `several`: what's ticked, in the order it was ticked */
  const [ticked, setTicked] = React.useState<string[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  const found = items.find((i) => i.value === value)
  const selected =
    found ??
    (value && selectedLabel ? { value, label: selectedLabel } : undefined)
  const q = query.trim().toLowerCase()
  const shown = React.useMemo(() => {
    const list =
      q && !onSearch
        ? items.filter(
            (i) =>
              i.label.toLowerCase().includes(q) ||
              i.value.toLowerCase().includes(q) ||
              i.hint?.toLowerCase().includes(q)
          )
        : items
    // Exact matches first, then starts-with, then the rest
    const rank = (i: SelectItem) => {
      const label = i.label.toLowerCase()
      return label === q ? 0 : label.startsWith(q) ? 1 : 2
    }
    return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, MAX)
  }, [items, q, onSearch])

  const openList = () => {
    setRect(inputRef.current?.getBoundingClientRect() ?? null)
    setQuery("")
    setActive(0)
    setTicked([])
    setOpen(true)
    onSearch?.("")
  }
  const close = () => {
    setOpen(false)
    setTicked([])
    inputRef.current?.blur()
  }
  const toggle = (value: string) =>
    setTicked((t) =>
      t.includes(value) ? t.filter((v) => v !== value) : [...t, value]
    )
  // Ticked items still offered: one added some other way drops out
  const live = ticked.filter((v) => items.some((i) => i.value === v))
  const add = () => {
    if (live.length) onAdd?.(live)
    close()
  }
  const allShownTicked =
    shown.length > 0 && shown.every((i) => live.includes(i.value))
  const tickShown = () =>
    setTicked((t) =>
      allShownTicked
        ? t.filter((v) => !shown.some((i) => i.value === v))
        : [...t, ...shown.map((i) => i.value).filter((v) => !t.includes(v))]
    )
  const choose = (item: SelectItem) => {
    if (several) return toggle(item.value)
    onChange?.(item.value)
    close()
  }

  // The list shrinks as you pick: keep the highlight on it
  const current = Math.min(active, Math.max(shown.length - 1, 0))

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [current])

  // Open upwards when there isn't room below
  const below = rect ? window.innerHeight - rect.bottom : 0
  const upward = rect ? below < 260 && rect.top > below : false

  return (
    <div className={cn("relative min-w-0", className)}>
      <Hint
        label={selected ? `${selected.label} (${selected.value})` : undefined}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className="h-7 w-full rounded-md border border-input bg-background px-2 pr-6 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected?.label ?? value ?? "")}
          onFocus={openList}
          onBlur={() => {
            setOpen(false)
            setTicked([])
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            // Picks can move the input down as their chips wrap. The list stays
            // put while you're clicking in it, and catches up when you type.
            if (several)
              setRect(inputRef.current?.getBoundingClientRect() ?? null)
            onSearch?.(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive(Math.min(current + 1, shown.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive(Math.max(current - 1, 0))
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              // Ctrl+Enter runs the query, wherever the cursor is
              return
            } else if (e.key === "Enter" && several && e.shiftKey) {
              // Shift+Enter ticks the highlighted one
              e.preventDefault()
              if (shown[current]) toggle(shown[current].value)
            } else if (e.key === "Enter" && several && live.length) {
              e.preventDefault()
              add()
            } else if (e.key === "Enter" && several && shown[current]) {
              // Nothing ticked: add the highlighted one now, and stay
              e.preventDefault()
              onAdd?.([shown[current].value])
            } else if (e.key === "Enter" && shown[current]) {
              e.preventDefault()
              choose(shown[current])
            } else if (e.key === "Escape") {
              e.stopPropagation()
              close()
            }
          }}
        />
      </Hint>
      <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" />

      {open && rect && (
        <ul
          ref={listRef}
          role="listbox"
          aria-multiselectable={several || undefined}
          style={{
            position: "fixed",
            left: rect.left,
            width: Math.max(rect.width, 260),
            ...(upward
              ? { bottom: window.innerHeight - rect.top + 4 }
              : { top: rect.bottom + 4 }),
          }}
          className="z-50 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {loading && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Loading…
            </li>
          )}
          {!loading && shown.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Nothing matches.
            </li>
          )}
          {shown.map((item, i) => {
            const on = several
              ? live.includes(item.value)
              : item.value === value
            return (
              <li
                key={item.value}
                role="option"
                aria-selected={on}
                data-index={i}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(item)
                }}
                onMouseMove={() => setActive(i)}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs",
                  i === current && "bg-accent text-accent-foreground",
                  !several && on && "font-semibold"
                )}
              >
                {several && (
                  // A div, not a span: the label stays the item's first span
                  <div
                    aria-hidden
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background"
                    )}
                  >
                    {on && <CheckIcon className="size-3" />}
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && (
                  <span className="max-w-[45%] shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                    {item.hint}
                  </span>
                )}
              </li>
            )
          })}
          {several && (
            <li
              role="presentation"
              className="sticky bottom-0 -mx-1 -mb-1 flex items-center gap-2 border-t bg-popover px-2 py-1.5"
            >
              {/* Buttons act on mousedown, as the items do, so the search keeps focus */}
              <button
                type="button"
                tabIndex={-1}
                disabled={shown.length === 0}
                onMouseDown={(e) => {
                  e.preventDefault()
                  tickShown()
                }}
                className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {/* Only what's shown: ticks from other searches stay */}
                {allShownTicked ? "Untick shown" : "Select all shown"}
              </button>
              <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                {live.length ? "Esc cancels" : "Tick them, then Add"}
              </span>
              <button
                type="button"
                tabIndex={-1}
                data-add-ticked=""
                disabled={live.length === 0}
                onMouseDown={(e) => {
                  e.preventDefault()
                  add()
                }}
                className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Add{live.length ? ` ${live.length}` : ""}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** A native <select>, styled to match. Used where a short fixed list is enough. */
export function PlainSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  ariaLabel: string
  className?: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-7 min-w-0 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
