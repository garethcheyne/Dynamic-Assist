import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

const key = (id: string) => `collapsed.${id}`

function readCollapsed(id: string, fallback: boolean) {
  try {
    const stored = localStorage.getItem(key(id))
    return stored === null ? fallback : stored === "1"
  } catch {
    return fallback
  }
}

/**
 * A card whose body folds away under its header, remembered per `id` in this
 * browser. The same shape as ServiceNow Companion's CollapsibleCard.
 */
export function CollapsibleSection({
  id,
  title,
  icon,
  summary,
  actions,
  defaultCollapsed = false,
  className,
  bodyClassName,
  children,
}: {
  id: string
  title: React.ReactNode
  icon?: React.ReactNode
  /** Beside the title even when collapsed: a count, a badge */
  summary?: React.ReactNode
  /** Right-aligned header controls; they don't toggle the section */
  actions?: React.ReactNode
  defaultCollapsed?: boolean
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = React.useState(() =>
    readCollapsed(id, defaultCollapsed)
  )
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(key(id), c ? "0" : "1")
      } catch {
        // Storage blocked: the choice just isn't remembered.
      }
      return !c
    })
  const bodyId = `section-${id}`

  return (
    <section
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-xs",
        className
      )}
    >
      <div className="flex min-h-11 items-center gap-2 px-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-2.5 text-left text-xs font-semibold"
        >
          <ChevronDownIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
          {icon && (
            <span className="text-primary [&_svg]:size-3.5">{icon}</span>
          )}
          <span className="truncate">{title}</span>
          {summary}
        </button>
        {actions}
      </div>
      {!collapsed && (
        <div
          id={bodyId}
          className={cn("flex flex-col gap-2.5 px-3 pb-3", bodyClassName)}
        >
          {children}
        </div>
      )}
    </section>
  )
}

/** The small count after a section title. */
export function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-normal text-muted-foreground tabular-nums">
      {children}
    </span>
  )
}
