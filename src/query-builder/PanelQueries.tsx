import * as React from "react"
import { BookmarkIcon, Loader2Icon, SparklesIcon } from "lucide-react"

import { EXAMPLE_QUERIES, useShowExamples } from "./examples"
import { useSavedQueries, type SavedQuery } from "./saved"

const when = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" })

/**
 * The panel's Query section: your saved queries and the examples (unless
 * they're switched off in the menu), each opened and run in the builder with
 * one click. Saving, deleting and import/export stay in the builder.
 */
export function PanelQueries({
  platform,
  busy,
  onOpen,
}: {
  platform: SavedQuery["platform"]
  /** The id of the query being opened, for its spinner */
  busy: string | null
  onOpen: (query: SavedQuery) => void
}) {
  const saved = useSavedQueries(platform)
  const [showExamples] = useShowExamples()
  const examples = showExamples ? EXAMPLE_QUERIES[platform] : []

  return (
    <div className="flex flex-col gap-2">
      <Group icon={<BookmarkIcon />} title="Saved queries" count={saved.length}>
        {saved.length === 0 ? (
          <p className="px-1.5 py-1 text-[11px] text-muted-foreground">
            None yet. In the query builder, Saved keeps the query you have; it's
            listed here to run again in any{" "}
            {platform === "ce" ? "org" : "environment"}.
          </p>
        ) : (
          saved.map((q) => (
            <Row
              key={q.id}
              name={q.name}
              detail={`${q.table} · ${q.where} · ${when(q.savedAt)}`}
              busy={busy === q.id}
              onClick={() => onOpen(q)}
            />
          ))
        )}
      </Group>
      {examples.length > 0 && (
        <Group icon={<SparklesIcon />} title="Examples">
          {examples.map((q) => (
            <Row
              key={q.id}
              name={q.name}
              detail={q.description}
              busy={busy === q.id}
              onClick={() => onOpen(q)}
            />
          ))}
        </Group>
      )}
    </div>
  )
}

function Group({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground [&_svg]:size-3">
        {icon}
        {title}
        {count !== undefined && count > 0 && (
          <span className="tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Row({
  name,
  detail,
  busy,
  onClick,
}: {
  name: string
  detail: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={`Open and run “${name}” in the query builder`}
      className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-muted/60 disabled:opacity-60"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium">{name}</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {detail}
        </span>
      </span>
      {busy && (
        <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      )}
    </button>
  )
}
