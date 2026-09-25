import * as React from "react"
import { ChevronsUpDownIcon } from "lucide-react"
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
 * A searchable single select. Its list is position: fixed against the input,
 * not portalled: in the page's shadow root a portal to <body> would lose the
 * modal's styles.
 */
export function SearchSelect({
  items,
  value,
  onChange,
  placeholder = "Search",
  className,
  loading,
  ariaLabel,
  onSearch,
  selectedLabel,
}: {
  items: SelectItem[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  loading?: boolean
  ariaLabel: string
  /** Search on the server instead of filtering `items` (lookups) */
  onSearch?: (query: string) => void
  /** Label for a value that isn't among `items` (a lookup's current record) */
  selectedLabel?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
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
    setOpen(true)
    onSearch?.("")
  }
  const choose = (item: SelectItem) => {
    onChange(item.value)
    setOpen(false)
    inputRef.current?.blur()
  }

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

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
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            onSearch?.(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, shown.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === "Enter" && shown[active]) {
              e.preventDefault()
              choose(shown[active])
            } else if (e.key === "Escape") {
              e.stopPropagation()
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
        />
      </Hint>
      <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" />

      {open && rect && (
        <ul
          ref={listRef}
          role="listbox"
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
          {shown.map((item, i) => (
            <li
              key={item.value}
              role="option"
              aria-selected={item.value === value}
              data-index={i}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(item)
              }}
              onMouseMove={() => setActive(i)}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs",
                i === active && "bg-accent text-accent-foreground",
                item.value === value && "font-semibold"
              )}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && (
                <span className="max-w-[45%] shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                  {item.hint}
                </span>
              )}
            </li>
          ))}
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
