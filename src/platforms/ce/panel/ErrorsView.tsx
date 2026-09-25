import * as React from "react"
import {
  BugIcon,
  CircleXIcon,
  CodeXmlIcon,
  CopyIcon,
  MessageSquareIcon,
  FileWarningIcon,
  GlobeIcon,
  Trash2Icon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react"
import { cn } from "cn"

import { CopyButton } from "@/components/copy-button"
import { FilterChip } from "@/components/filter-chip"
import { Hint } from "@/components/hint"
import { SearchBox } from "@/components/search-box"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/lib/copy"

import type { CeLogEntry } from "../error-log"

const KIND: Record<CeLogEntry["kind"], string> = {
  exception: "Uncaught error",
  rejection: "Unhandled promise",
  console: "Console",
  network: "Request failed",
  resource: "Failed to load",
}

/**
 * Dynamics writes routine status lines ([storage], [crmServerDataSource]…) as
 * console warnings: hidden unless asked for. Your scripts' warnings still show.
 */
const isChatter = (e: CeLogEntry) =>
  e.kind === "console" && e.level === "warning" && !e.custom

const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

/** file.js:12:5 from a long URL; a request's path without the query */
function shortSource(e: CeLogEntry) {
  if (!e.source) return null
  try {
    const u = new URL(e.source.replace(/:\d+:\d+$/, ""), location.href)
    const file = decodeURIComponent(u.pathname.split("/").pop() || u.host)
    const pos = e.source.match(/:\d+:\d+$/)?.[0] ?? ""
    return e.kind === "network"
      ? decodeURIComponent(u.pathname).replace(/^\/api\/data\/v[\d.]+\//, "")
      : file + pos
  } catch {
    return e.source
  }
}

const asText = (e: CeLogEntry) =>
  [
    `[${new Date(e.at).toISOString()}] ${e.level.toUpperCase()} ${KIND[e.kind]}${e.count > 1 ? ` ×${e.count}` : ""} (${e.page})`,
    e.message,
    e.source && `at ${e.source}`,
    e.stack,
  ]
    .filter(Boolean)
    .join("\n")

/**
 * What's going wrong on the page: uncaught errors and rejections, console
 * errors and warnings, scripts that didn't load and requests that failed,
 * newest first. Collected from the moment the page started loading.
 */
export function ErrorsView({
  entries,
  onClear,
  consoleOn,
  onConsole,
  watching,
  onWatch,
}: {
  entries: CeLogEntry[]
  onClear: () => void
  /** Watching for errors (off by default) */
  watching: boolean
  onWatch: (on: boolean) => void
  /** Console messages are captured too (per org) */
  consoleOn: boolean
  onConsole: (on: boolean) => void
}) {
  const copy = useCopy()
  const [query, setQuery] = React.useState("")
  const [only, setOnly] = React.useState({
    custom: false,
    errors: false,
    network: false,
    chatter: false,
  })
  const toggle = (k: keyof typeof only) =>
    setOnly((o) => ({ ...o, [k]: !o[k] }))

  if (!watching)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
        <BugIcon className="size-6 text-primary" />
        <p className="leading-relaxed">
          Catch what goes wrong on Dynamics 365 pages: script errors (your form
          scripts and web resources too), promises no one caught, scripts that
          don't load and requests that fail, with Dataverse's own message.
        </p>
        <p className="leading-relaxed">
          Off until you turn it on. It watches every Dynamics 365 page from the
          moment it starts to load, only observes, and keeps the log in the
          page.
        </p>
        <Button size="sm" onClick={() => onWatch(true)}>
          <BugIcon data-icon="inline-start" />
          Watch for errors
        </Button>
        <p className="text-[11px]">
          It starts on this page now; reload it to catch errors while it loads.
        </p>
      </div>
    )

  const q = query.trim().toLowerCase()
  const shown = entries
    .filter(
      (e) =>
        (only.chatter || !isChatter(e)) &&
        (!only.custom || e.custom) &&
        (!only.errors || e.level === "error") &&
        (!only.network || e.kind === "network") &&
        (!q ||
          e.message.toLowerCase().includes(q) ||
          (e.source ?? "").toLowerCase().includes(q))
    )
    .reverse()
  const count = (pred: (e: CeLogEntry) => boolean) =>
    entries.filter(pred).length

  return (
    <div className="flex flex-col gap-2">
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search messages and sources"
      />
      <div className="flex flex-wrap items-center gap-1">
        <FilterChip
          label="Web resources"
          icon={<CodeXmlIcon />}
          count={count((e) => e.custom)}
          on={only.custom}
          tip="Only your own scripts: form scripts and HTML web resources"
          onToggle={() => toggle("custom")}
        />
        <FilterChip
          label="Errors"
          icon={<CircleXIcon />}
          count={count((e) => e.level === "error")}
          on={only.errors}
          tip="Only errors, not warnings"
          onToggle={() => toggle("errors")}
        />
        <FilterChip
          label="Network"
          icon={<GlobeIcon />}
          count={count((e) => e.kind === "network")}
          on={only.network}
          tip="Only requests that failed"
          onToggle={() => toggle("network")}
        />
        {entries.some(isChatter) && (
          <FilterChip
            label="Platform warnings"
            icon={<MessageSquareIcon />}
            count={count(isChatter)}
            on={only.chatter}
            tip="Routine warnings Dynamics itself writes to the console. Hidden unless you turn them on"
            onToggle={() => toggle("chatter")}
          />
        )}
        <div className="ml-auto flex gap-0.5">
          <Hint label="Copy what's shown, for a ticket or a chat">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Copy all shown"
              disabled={!shown.length}
              onClick={() =>
                copy(
                  shown.map(asText).join("\n\n"),
                  `${shown.length} ${shown.length === 1 ? "entry" : "entries"}`
                )
              }
            >
              <CopyIcon />
            </Button>
          </Hint>
          <Hint label="Clear the log (the page keeps running)">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear"
              disabled={!entries.length}
              onClick={onClear}
            >
              <Trash2Icon />
            </Button>
          </Hint>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={watching}
            onChange={(e) => onWatch(e.target.checked)}
            className="size-3.5 accent-(--primary)"
          />
          Watch for errors
        </label>
        <Hint
          label={
            consoleOn
              ? "Capturing console.error and console.warn on this org. While on, Chrome's extension error list (developer mode) shows the page's console messages under Dynamic Assist."
              : "Also capture console.error and console.warn from every script. Off by default: while on, Chrome's extension error list shows the page's console messages under Dynamic Assist."
          }
        >
          <label className="flex cursor-pointer items-center gap-2 self-start rounded-md px-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={consoleOn}
              onChange={(e) => onConsole(e.target.checked)}
              className="size-3.5 accent-(--primary)"
            />
            Console messages
          </label>
        </Hint>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs leading-relaxed text-muted-foreground">
          {entries.length
            ? "Nothing matches."
            : "No errors or warnings on this page. Scripts are watched from the moment the page starts loading: if you just installed or updated the extension, reload the page once."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map((e) => (
            <Entry key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Entry({ entry: e }: { entry: CeLogEntry }) {
  const [open, setOpen] = React.useState(false)
  const Icon =
    e.kind === "network"
      ? GlobeIcon
      : e.kind === "resource"
        ? FileWarningIcon
        : e.kind === "rejection"
          ? ZapIcon
          : e.level === "error"
            ? CircleXIcon
            : TriangleAlertIcon
  const source = shortSource(e)
  return (
    <li
      className={cn(
        "rounded-lg border bg-card text-xs",
        e.level === "error"
          ? "border-l-2 border-l-destructive"
          : "border-l-2 border-l-amber-500"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full gap-2 p-2 text-left"
      >
        <Icon
          className={cn(
            "mt-0.5 size-3.5 shrink-0",
            e.level === "error"
              ? "text-destructive"
              : "text-amber-600 dark:text-amber-400"
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block leading-snug break-words",
              !open && "line-clamp-3"
            )}
          >
            {e.message}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{time(e.at)}</span>
            <span>{KIND[e.kind]}</span>
            {e.count > 1 && (
              <span className="rounded bg-muted px-1 font-medium text-foreground">
                ×{e.count}
              </span>
            )}
            {e.custom && (
              <span className="rounded bg-accent px-1 font-medium text-accent-foreground">
                Web resource
              </span>
            )}
            {source && <span className="truncate font-mono">{source}</span>}
          </span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 border-t px-2 pt-1.5 pb-2 text-[11px]">
          <p className="text-muted-foreground">
            On <b className="text-foreground">{e.page}</b>
            {e.frame && (
              <>
                {" "}
                in frame <span className="font-mono">{e.frame}</span>
              </>
            )}
          </p>
          {e.source && (
            <p className="font-mono break-all text-muted-foreground">
              {e.method && `${e.method} `}
              {e.source}
            </p>
          )}
          {e.stack && (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-[10.5px] leading-snug whitespace-pre-wrap">
              {e.stack}
            </pre>
          )}
          <CopyButton value={asText(e)} what="entry" className="self-start" />
        </div>
      )}
    </li>
  )
}
