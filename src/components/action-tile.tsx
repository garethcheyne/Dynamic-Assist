import type { ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { cn } from "cn"

import { Hint, HintBody } from "@/components/hint"

/** A grid of tiles, two across in the panel. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5">{children}</div>
}

/**
 * One action: icon, name and a line on what it does. `on` makes it a toggle
 * (teal when on); `busy` shows a spinner while the page works. Hovering shows
 * the name and the whole explanation (`detail`, else the description), and
 * why it's unavailable when it is.
 */
export function ActionTile({
  icon,
  title,
  description,
  detail,
  unavailable,
  onClick,
  on,
  busy,
  disabled,
}: {
  icon: ReactNode
  title: string
  description?: string
  /** A longer explanation for the tooltip */
  detail?: ReactNode
  /** Why it's disabled, shown in the tooltip */
  unavailable?: string
  onClick: () => void
  on?: boolean
  busy?: boolean
  disabled?: boolean
}) {
  const off = disabled || busy
  return (
    <Hint
      label={
        <HintBody
          title={on === undefined ? title : `${title} · ${on ? "on" : "off"}`}
        >
          {detail ?? description}
          {disabled && (
            <span className="mt-1 block italic">
              {unavailable ?? "Not available on this page."}
            </span>
          )}
        </HintBody>
      }
    >
      {/* aria-disabled, not disabled: a disabled button gets no hover, so no tooltip */}
      <button
        type="button"
        onClick={() => !off && onClick()}
        aria-disabled={off || undefined}
        aria-pressed={on}
        className={cn(
          "group flex min-w-0 items-start gap-2 rounded-lg border p-2 text-left transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          on
            ? "border-primary/40 bg-accent text-accent-foreground"
            : "bg-background hover:border-primary/30 hover:bg-muted aria-disabled:hover:border-border aria-disabled:hover:bg-background"
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
    </Hint>
  )
}
