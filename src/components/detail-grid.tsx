import type { ReactNode } from "react"
import { cn } from "cn"

import { CopyButton } from "@/components/copy-button"
import { Hint } from "@/components/hint"

/** Label-over-value pairs in two columns, as on a BC card or an incident. */
export function DetailGrid({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2.5", className)}>
      {children}
    </dl>
  )
}

export function Detail({
  label,
  value,
  copy,
  mono,
  wide,
  title,
}: {
  label: string
  value: ReactNode
  /** Copies this and shows a copy button on hover */
  copy?: string
  mono?: boolean
  /** Spans both columns */
  wide?: boolean
  title?: string
}) {
  return (
    <div className={cn("group/detail min-w-0", wide && "col-span-2")}>
      <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-1">
        <Hint label={title ?? (typeof value === "string" ? value : undefined)}>
          <span className={cn("truncate", mono && "font-mono text-xs")}>
            {value}
          </span>
        </Hint>
        {copy && (
          <CopyButton
            value={copy}
            what={label.toLowerCase()}
            className="size-5 opacity-0 group-hover/detail:opacity-100 focus-visible:opacity-100"
          />
        )}
      </dd>
    </div>
  )
}
