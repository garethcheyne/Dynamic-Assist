import type { ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { cn } from "cn"

/** A grid of tiles, two across in the panel. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5">{children}</div>
}

/**
 * One action: icon, name and a line on what it does. `on` makes it a toggle
 * (teal when on); `busy` shows a spinner while the page works.
 */
export function ActionTile({
  icon,
  title,
  description,
  onClick,
  on,
  busy,
  disabled,
}: {
  icon: ReactNode
  title: string
  description?: string
  onClick: () => void
  on?: boolean
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-pressed={on}
      title={description}
      className={cn(
        "group flex min-w-0 items-start gap-2 rounded-lg border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on
          ? "border-primary/40 bg-accent text-accent-foreground"
          : "bg-background hover:border-primary/30 hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "mt-px flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5",
          on
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-primary group-hover:bg-background"
        )}
      >
        {busy ? <Loader2Icon className="animate-spin" /> : icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">{title}</span>
        {description && (
          <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </button>
  )
}
