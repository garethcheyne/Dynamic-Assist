/**
 * The page's error log for the panel's Errors tab: uncaught errors, unhandled
 * promise rejections, console errors and warnings, failed scripts and failed
 * requests, as error-watch.ts records them. It lives on the top window so
 * same-origin frames (HTML web resources) add to the same log.
 */

export type CeLogEntry = {
  /** Stays the same when the entry repeats (seq moves on) */
  id: number
  seq: number
  /** ms since the epoch */
  at: number
  level: "error" | "warning"
  kind: "exception" | "rejection" | "console" | "network" | "resource"
  message: string
  /** Where it came from: file:line:col, or the request's URL */
  source?: string
  stack?: string
  /** From your own scripts (a web resource), not the platform's */
  custom: boolean
  /** Network: the HTTP method and status */
  method?: string
  status?: number
  /** The page when it happened: "entityrecord account", "dashboard"… */
  page: string
  /** How many times in a row it happened */
  count: number
  /** A frame other than the top one (web resource) */
  frame?: string
}

export type CeLog = {
  /** Changes on every page load, so the panel knows to start over */
  session: string
  seq: number
  entries: CeLogEntry[]
}

export type CeLogSlice = {
  session: string
  /** Console messages are captured (the Errors tab's switch) */
  console: boolean
  entries: CeLogEntry[]
  /** Entries dropped because the log is full */
  dropped: number
}

export const LOG_KEY = "__dynamicAssistLog"
/** chrome.storage.local: watch Dynamics 365 pages for errors (off by default) */
export const ERROR_WATCH_KEY = "ce.errorWatch"
export const ERROR_WATCH_SCRIPT = "scripts/ce-error-watch.js"
/** localStorage, per org: capture console messages too */
export const CONSOLE_KEY = "dynamicAssist.captureConsole"

const consoleOn = () => {
  try {
    return localStorage.getItem(CONSOLE_KEY) === "1"
  } catch {
    return false
  }
}

/** Turns console capture on or off, now (every frame) and for later loads. */
export function setConsoleCapture(on: boolean) {
  try {
    if (on) localStorage.setItem(CONSOLE_KEY, "1")
    else localStorage.removeItem(CONSOLE_KEY)
  } catch {
    // No storage: this page only
  }
  const frames: Window[] = [window]
  for (let i = 0; i < window.frames.length; i++) frames.push(window.frames[i])
  for (const f of frames) {
    try {
      ;(
        f as Window & { __dynamicAssistConsole?: (on: boolean) => void }
      ).__dynamicAssistConsole?.(on)
    } catch {
      // Another origin
    }
  }
}
export const LOG_MAX = 500

/** The log on this page's top window (or this window, if the top's another origin). */
export function pageLog(): CeLog {
  let host: Window
  try {
    // Reading a property throws if the top window is another origin
    void window.top?.location.href
    host = window.top ?? window
  } catch {
    host = window
  }
  const w = host as Window & { [LOG_KEY]?: CeLog }
  w[LOG_KEY] ??= {
    session: Math.random().toString(36).slice(2),
    seq: 0,
    entries: [],
  }
  return w[LOG_KEY]
}

/** Entries after `since` (a seq), for the panel. */
export function readLog(since = 0): CeLogSlice {
  const log = pageLog()
  const first = log.entries[0]?.seq ?? log.seq + 1
  return {
    session: log.session,
    console: consoleOn(),
    entries: log.entries.filter((e) => e.seq > since),
    dropped: Math.max(0, first - since - 1),
  }
}

export function clearLog() {
  pageLog().entries = []
}

/**
 * The page's fetch from before error-watch.ts wrapped it, for the extension's
 * own requests: they aren't the page's, so they stay out of its log.
 */
export const quietFetch: typeof fetch = (input, init) =>
  (
    (window as Window & { __dynamicAssistFetch?: typeof fetch })
      .__dynamicAssistFetch ?? window.fetch.bind(window)
  )(input, init)
