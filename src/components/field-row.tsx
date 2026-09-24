import * as React from "react"
import {
  BracesIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisIcon,
} from "lucide-react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCopy } from "@/lib/copy"

export type CopyFormat = { label: string; value: string }
export type DetailRow = { label: string; value: string; long?: boolean }

/**
 * One field as a single line: caption, then value. Hover shows copy-name,
 * copy-value and a menu of other formats; clicking opens the details.
 * Shared by the BC and CE field lists so both read the same way.
 */
export function FieldRow({
  label,
  value,
  name,
  nameWhat = "name",
  markers,
  formats,
  details,
  dimmed,
  highlight,
}: {
  label: string
  value: string
  /** What the {} button copies: schema name in BC, logical name in CE */
  name: string
  nameWhat?: string
  /** Small icons after the caption (FlowField, extension, required…) */
  markers?: React.ReactNode
  formats: CopyFormat[]
  details: DetailRow[]
  dimmed?: boolean
  /** Tints the row, e.g. for changed fields */
  highlight?: boolean
}) {
  const copy = useCopy()
  const [open, setOpen] = React.useState(false)

  return (
    <div
      className={cn(
        "group/row rounded-md",
        open ? "bg-muted/60" : "hover:bg-muted/60",
        highlight && !open && "bg-accent/60",
        dimmed && "opacity-60"
      )}
    >
      <div className="relative flex h-7 items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex max-w-[55%] min-w-0 shrink-0 items-center gap-1">
            <span
              className="truncate text-xs text-muted-foreground"
              title={`${label} · ${name}`}
            >
              {label}
            </span>
            {markers}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-right text-xs",
              value ? "font-medium" : "text-muted-foreground/60"
            )}
            title={value || undefined}
          >
            {value || "—"}
          </span>
        </button>

        <div className="absolute inset-y-0 right-0 hidden items-center gap-0.5 rounded-r-md bg-muted pl-2 group-focus-within/row:flex group-hover/row:flex">
          <RowAction
            label={`Copy ${nameWhat}`}
            onClick={() => copy(name, `${nameWhat}: ${name}`)}
          >
            <BracesIcon />
          </RowAction>
          <RowAction
            label="Copy value"
            disabled={!value}
            onClick={() => copy(value, `value of ${label}`)}
          >
            <CopyIcon />
          </RowAction>
          <FormatsMenu label={label} formats={formats} />
        </div>
      </div>

      {open && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-2 pt-0.5 pb-2 text-[11px]">
          {details.map((d) => (
            <React.Fragment key={d.label}>
              <dt className="text-muted-foreground">{d.label}</dt>
              <dd
                className={cn(
                  "font-mono",
                  d.long ? "break-all whitespace-pre-wrap" : "truncate"
                )}
                title={d.value}
              >
                {d.value}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

function RowAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-xs" }),
        "hover:bg-background"
      )}
    >
      {children}
    </button>
  )
}

function FormatsMenu({
  label,
  formats,
}: {
  label: string
  formats: CopyFormat[]
}) {
  const copy = useCopy()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="More ways to copy"
        aria-label="More ways to copy"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-xs" }),
          "hover:bg-background"
        )}
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate">Copy {label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.map((f) => (
          <DropdownMenuItem
            key={f.label}
            onClick={() => copy(f.value, f.label.toLowerCase())}
            className="flex-col items-start gap-0"
          >
            <span className="text-xs">{f.label}</span>
            <span className="w-full truncate font-mono text-[11px] text-muted-foreground">
              {f.value || "—"}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A FastTab / form tab heading that folds its rows. */
export function FieldGroup({
  name,
  count,
  children,
}: {
  name: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(true)
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-1 flex items-center gap-1 rounded-md px-1 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-muted"
      >
        <ChevronRightIcon
          className={cn(
            "size-3 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="truncate">{name}</span>
        <span className="font-normal text-muted-foreground tabular-nums">
          {count}
        </span>
      </button>
      {open && children}
    </div>
  )
}
