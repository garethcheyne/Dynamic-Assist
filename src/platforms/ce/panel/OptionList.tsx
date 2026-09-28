import { cn } from "cn"

import { useCopy } from "@/lib/copy"

import type { CeOption } from "../types"

/** A choice column's options, value then label; click one to copy its value. */
export function OptionList({
  options,
  selected,
}: {
  options: CeOption[]
  /** Values to mark as the record's current choice */
  selected?: Set<number>
}) {
  const copy = useCopy()
  return (
    <div className="px-2 pb-2">
      <p className="pb-0.5 text-[11px] text-muted-foreground">
        Options ({options.length})
      </p>
      <ul className="flex flex-col rounded-md border bg-background/60 text-[11px]">
        {options.map((o) => {
          const on = !!selected?.has(o.value)
          return (
            <li key={o.value}>
              <button
                type="button"
                onClick={() =>
                  copy(String(o.value), `value of ${o.text || o.value}`)
                }
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-0.5 text-left hover:bg-muted",
                  on && "bg-accent font-medium"
                )}
              >
                <span className="w-20 shrink-0 truncate font-mono text-muted-foreground tabular-nums">
                  {o.value}
                </span>
                <span className="min-w-0 flex-1 truncate">{o.text || "—"}</span>
                {on && (
                  <span className="shrink-0 text-[10px] text-primary">
                    current
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
