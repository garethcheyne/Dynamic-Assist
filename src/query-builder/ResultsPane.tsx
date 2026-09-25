/**
 * The results side of both query builders: the grid, paging, the query as
 * text (FetchXML, OData, AL…) and export to Excel, CSV or JSON.
 */
import * as React from "react"
import {
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
} from "lucide-react"
import { cn } from "cn"

import { CopyButton } from "@/components/copy-button"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"

import { exportResults, type ExportFormat } from "./export"
import type { Results } from "./results"

export function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold [&_svg]:size-3.5 [&_svg]:text-primary">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

export type QuerySource = {
  label: string
  text: string
  /** Shown instead of the text, which is still what Copy copies */
  view?: React.ReactNode
}

export function ResultsPane({
  sources,
  results,
  error,
  running,
  name,
  hint = "Build a query and press Run (Ctrl+Enter).",
  onLoadMore,
  loadingMore = false,
}: {
  /** Fetches the next page, when the results say more match */
  onLoadMore?: () => void
  loadingMore?: boolean
  /** The query as text: FetchXML, or AL and an API query for Business Central */
  sources: QuerySource[]
  hint?: string
  results: Results | null
  error: string | null
  running: boolean
  name: string
}) {
  // "results", or the index of a source tab
  const [view, setView] = React.useState<"results" | number>("results")
  const source = view === "results" ? null : sources[view]
  const exportAs = (format: ExportFormat) =>
    results && exportResults(format, name, results.columns, results.rows)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-xs">
        <div className="flex rounded-md bg-muted p-0.5">
          {(["results", ...sources.map((_, i) => i)] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded px-2 py-0.5 font-medium",
                view === v
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "results" ? "Results" : sources[v].label}
            </button>
          ))}
        </div>
        {results && view === "results" && (
          <span className="text-muted-foreground">
            {results.rows.length.toLocaleString()} row
            {results.rows.length === 1 ? "" : "s"}
            {results.more ? " (more match)" : ""} · {results.ms} ms
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {source ? (
            <CopyButton value={source.text} what={source.label} />
          ) : (
            <>
              <span className="mr-1 text-muted-foreground">Export</span>
              <Button
                variant="outline"
                size="xs"
                disabled={!results?.rows.length}
                onClick={() => exportAs("xlsx")}
              >
                <FileSpreadsheetIcon data-icon="inline-start" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={!results?.rows.length}
                onClick={() => exportAs("csv")}
              >
                <FileTextIcon data-icon="inline-start" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={!results?.rows.length}
                onClick={() => exportAs("json")}
              >
                <FileJsonIcon data-icon="inline-start" />
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {source ? (
          (source.view ?? (
            <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {source.text}
            </pre>
          ))
        ) : error ? (
          <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : running && !results ? (
          <p className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" /> Running…
          </p>
        ) : !results ? (
          <p className="p-4 text-xs text-muted-foreground">{hint}</p>
        ) : results.rows.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No rows match.</p>
        ) : (
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className="border-b px-2 py-1.5 text-right font-normal text-muted-foreground">
                  #
                </th>
                {results.columns.map((c) => (
                  <Hint label={c.key}>
                    <th
                      key={c.key}
                      className="max-w-72 border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  </Hint>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/60">
                  <td className="border-b px-2 py-1 text-right text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  {results.columns.map((c) => {
                    const cell = row[c.key]
                    const raw =
                      cell?.value === null || cell?.value === undefined
                        ? ""
                        : String(cell.value)
                    return (
                      <Hint label={raw}>
                        <td
                          key={c.key}
                          className="max-w-72 truncate border-b px-2 py-1"
                        >
                          {cell?.formatted ?? raw}
                        </td>
                      </Hint>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view === "results" && results?.more && onLoadMore && (
          <div className="flex justify-center p-3">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore && (
                <Loader2Icon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              )}
              Load more rows
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
