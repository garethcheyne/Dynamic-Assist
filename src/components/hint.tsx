import type { ReactElement, ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * A shadcn tooltip on any one element, in place of the browser's own title
 * tooltip. `label` can be text or a small block: a name and what it does.
 */
export function Hint({
  label,
  side = "top",
  children,
}: {
  label?: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  children: ReactElement
}) {
  if (label === undefined || label === null || label === "") return children
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** A tooltip with a bold name over a longer explanation. */
export function HintBody({
  title,
  children,
}: {
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <span className="flex flex-col gap-0.5 py-0.5">
      <span className="font-semibold">{title}</span>
      {children && <span className="opacity-85">{children}</span>}
    </span>
  )
}
