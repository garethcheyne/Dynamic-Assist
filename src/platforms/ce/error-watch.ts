/**
 * Only while "Watch for errors" is on in the panel's Errors tab (off by
 * default: the service worker registers it then, and the panel adds it to the
 * open page). Runs in the Dynamics 365 page's own JS world from the moment it
 * starts to load (document_start), in every same-origin frame, and records what goes
 * wrong for the panel's Errors tab: uncaught errors, unhandled promise
 * rejections, console.error and console.warn, scripts that fail to load, and
 * requests that fail (with Dataverse's own error message).
 *
 * It only observes: every wrapper passes calls through unchanged, and nothing
 * here may throw into the page. The log stays in the page (error-log.ts); the
 * panel reads it on request. The extension's own requests use the original
 * fetch (window.__dynamicAssistFetch), so they don't show up here.
 */
import { CONSOLE_KEY, LOG_MAX, pageLog, type CeLogEntry } from "./error-log"

type Watched = Window & {
  __dynamicAssistWatch?: boolean
  __dynamicAssistConsole?: (on: boolean) => void
  /** Stops watching and puts back what was wrapped (the Errors tab's switch) */
  __dynamicAssistUnwatch?: () => void
  __dynamicAssistFetch?: typeof fetch
}

const w = window as Watched
if (!w.__dynamicAssistWatch) {
  w.__dynamicAssistWatch = true
  try {
    watch()
  } catch {
    // Never break the page over a log
  }
}

function watch() {
  // Everything added here comes off again when watching is switched off
  const listeners = new AbortController()
  const undo: (() => void)[] = []
  const MESSAGE_MAX = 2000
  const STACK_MAX = 4000
  const clip = (s: string, n: number) =>
    s.length > n ? s.slice(0, n) + "…" : s

  // Web resources load from /{org}/%7b…%7d/webresources/…; the platform's
  // own scripts from elsewhere
  const isCustom = (...texts: (string | undefined)[]) =>
    texts.some((t) => !!t && /webresources?\//i.test(t))

  const page = () => {
    const p = new URLSearchParams(location.search)
    return [p.get("pagetype"), p.get("etn")].filter(Boolean).join(" ") || "page"
  }
  const frame = window === window.top ? undefined : location.pathname

  function add(
    entry: Omit<CeLogEntry, "id" | "seq" | "at" | "count" | "page">
  ) {
    try {
      const log = pageLog()
      const message = clip(entry.message || "(no message)", MESSAGE_MAX)
      const last = log.entries[log.entries.length - 1]
      if (
        last &&
        last.message === message &&
        last.kind === entry.kind &&
        last.source === entry.source
      ) {
        // The same again: count it, and move it up so the panel sees it
        last.count += 1
        last.at = Date.now()
        last.seq = ++log.seq
        return
      }
      const seq = ++log.seq
      log.entries.push({
        ...entry,
        message,
        id: seq,
        stack: entry.stack && clip(entry.stack, STACK_MAX),
        seq,
        at: Date.now(),
        count: 1,
        page: page(),
        frame,
      })
      if (log.entries.length > LOG_MAX) log.entries.shift()
    } catch {
      // Ignore: the log is best effort
    }
  }

  const describe = (value: unknown): string => {
    if (value instanceof Error) return `${value.name}: ${value.message}`
    if (typeof value === "string") return value
    try {
      return JSON.stringify(value)?.slice(0, 500) ?? String(value)
    } catch {
      return String(value)
    }
  }
  const stackOf = (values: unknown[]) =>
    values.find((v): v is Error => v instanceof Error)?.stack

  // Uncaught errors, and scripts or stylesheets that fail to load
  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as HTMLElement | null
      if (target && target !== (window as unknown) && "tagName" in target) {
        const tag = target.tagName
        if (tag !== "SCRIPT" && tag !== "LINK") return
        const url =
          (target as HTMLScriptElement).src || (target as HTMLLinkElement).href
        add({
          level: "error",
          kind: "resource",
          message: `Failed to load ${tag === "SCRIPT" ? "script" : "stylesheet"} ${url}`,
          source: url,
          custom: isCustom(url),
        })
        return
      }
      const source = event.filename
        ? `${event.filename}:${event.lineno}:${event.colno}`
        : undefined
      const stack = (event.error as Error | undefined)?.stack
      add({
        level: "error",
        kind: "exception",
        message: event.error ? describe(event.error) : event.message,
        source,
        stack,
        custom: isCustom(source, stack),
      })
    },
    { capture: true, signal: listeners.signal }
  )

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const stack = (event.reason as Error | undefined)?.stack
      add({
        level: "error",
        kind: "rejection",
        message: `Unhandled promise rejection: ${describe(event.reason)}`,
        stack,
        custom: isCustom(stack),
      })
    },
    { signal: listeners.signal }
  )

  // console.error and console.warn, only when switched on in the panel: a
  // wrapped console makes Chrome list every message the page logs as the
  // extension's own (chrome://extensions, Errors)
  const originals = { error: console.error, warn: console.warn }
  const wrapped = {} as Record<"error" | "warn", (...args: unknown[]) => void>
  for (const [method, level] of [
    ["error", "error"],
    ["warn", "warning"],
  ] as const) {
    const original = originals[method]
    wrapped[method] = function (this: Console, ...args: unknown[]) {
      try {
        const stack = stackOf(args) ?? new Error().stack
        const message = args.map(describe).join(" ")
        add({
          level,
          kind: "console",
          message,
          stack: stackOf(args),
          custom: isCustom(message, stack),
        })
      } catch {
        // Keep logging even if describing fails
      }
      return original.apply(this, args)
    }
  }
  const watchConsole = (on: boolean) => {
    for (const method of ["error", "warn"] as const) {
      if (on) console[method] = wrapped[method]
      // Only undo our own wrapper, never someone else's
      else if (console[method] === wrapped[method])
        console[method] = originals[method]
    }
  }
  w.__dynamicAssistConsole = watchConsole
  undo.push(() => watchConsole(false))
  try {
    if (localStorage.getItem(CONSOLE_KEY) === "1") watchConsole(true)
  } catch {
    // No storage (sandboxed frame): off
  }

  // Dataverse errors come back as { error: { code, message } }
  const errorText = (body: string) => {
    try {
      const e = JSON.parse(body)?.error
      if (e?.message) return String(e.message)
    } catch {
      // Not JSON
    }
    return body.replace(/\s+/g, " ").trim().slice(0, 300)
  }
  const network = (method: string, url: string, status: number, body: string) =>
    add({
      level: status >= 400 || status === 0 ? "error" : "warning",
      kind: "network",
      method,
      status,
      message: `${method} ${status || "failed"}${body ? `: ${errorText(body)}` : ""}`,
      source: url,
      custom: isCustom(url),
    })

  // fetch: the same promise goes back; failures are read from a clone
  const originalFetch = window.fetch
  w.__dynamicAssistFetch = originalFetch.bind(window)
  const watchedFetch = function (
    this: typeof globalThis,
    input: RequestInfo | URL,
    init?: RequestInit
  ) {
    const result = originalFetch.call(this, input, init)
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase()
      result.then(
        (res) => {
          if (res.status < 400) return
          res
            .clone()
            .text()
            .then(
              (body) => network(method, url, res.status, body),
              () => network(method, url, res.status, "")
            )
        },
        (error: unknown) => {
          if ((error as Error)?.name === "AbortError") return
          network(method, url, 0, describe(error))
        }
      )
    } catch {
      // Ignore
    }
    return result
  } as typeof fetch
  window.fetch = watchedFetch
  undo.push(() => {
    if (window.fetch === watchedFetch) window.fetch = originalFetch
  })

  // XMLHttpRequest: note the method and URL, look at the answer when it ends
  type Tracked = XMLHttpRequest & { __daMethod?: string; __daUrl?: string }
  const open = XMLHttpRequest.prototype.open
  const watchedOpen = function (
    this: Tracked,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__daMethod = String(method).toUpperCase()
    this.__daUrl = String(url)
    return (open as (...a: unknown[]) => void).call(this, method, url, ...rest)
  } as typeof XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = watchedOpen
  const send = XMLHttpRequest.prototype.send
  const watchedSend = function (
    this: Tracked,
    ...args: Parameters<XMLHttpRequest["send"]>
  ) {
    let aborted = false
    try {
      this.addEventListener("abort", () => (aborted = true))
      this.addEventListener("loadend", () => {
        if (aborted || (this.status > 0 && this.status < 400)) return
        let body = ""
        try {
          if (this.responseType === "" || this.responseType === "text")
            body = this.responseText
          else if (this.responseType === "json")
            body = JSON.stringify(this.response)
        } catch {
          // No readable body
        }
        network(this.__daMethod ?? "GET", this.__daUrl ?? "", this.status, body)
      })
    } catch {
      // Ignore
    }
    return send.apply(this, args)
  }
  XMLHttpRequest.prototype.send = watchedSend
  undo.push(() => {
    const proto = XMLHttpRequest.prototype
    if (proto.open === watchedOpen) proto.open = open
    if (proto.send === watchedSend) proto.send = send
  })

  w.__dynamicAssistUnwatch = () => {
    listeners.abort()
    for (const u of undo) {
      try {
        u()
      } catch {
        // Put back what we can
      }
    }
    w.__dynamicAssistWatch = false
    w.__dynamicAssistUnwatch = undefined
  }
}
