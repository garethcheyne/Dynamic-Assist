import type { ReactNode } from "react"
import { cn } from "cn"

/**
 * One toggle in a filter row. Any combination can be on, so these are chips
 * rather than a segmented switch.
 */
export function FilterChip({
  label,
  icon,
  count,
  on,
  tip,
  onToggle,
}: {
  label: string
  icon?: ReactNode
  count?: number
  on: boolean
  tip: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      title={tip}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors [&_svg]:size-3",
        on
          ? "border-primary/40 bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className="text-muted-foreground tabular-nums">{count}</span>
      )}
    </button>
  )
}
