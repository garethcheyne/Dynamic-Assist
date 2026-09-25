/**
 * Instances you've visited: BC environments (per company), CE orgs and Power
 * Apps environments. Kept in chrome.storage.local on this machine only.
 *
 * The service worker is the only writer: it records visits from tab URLs and
 * applies the panel's changes (names, pins, renames), which the panel sends it
 * as messages. One writer with one queue means no two read-modify-writes race.
 */
import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"
import { ceAppUrl } from "@/platforms/ce/urls"
import { detectPlatform, parseMakerUrl } from "@/shared/detect"
import { powerPlatform } from "@/shared/links"

export const HISTORY_KEY = "history"
export const HISTORY_MESSAGE = "history:op"
const MAX_ENTRIES = 50
/** Page moves inside an instance within this window don't count as a new visit. */
const SAME_VISIT_MS = 30 * 60 * 1000

export type HistoryEntry = {
  key: string
  platform: "bc" | "ce" | "maker" | "flow"
  title: string
  subtitle: string | null
  /** Where "open" goes: the environment and company, or the org and app */
  url: string
  /** sandbox / production, when known */
  envType: string | null
  /** Power Platform environment ID, linking a CE org to its maker environment */
  environmentId?: string | null
  lastVisited: number
  visits: number
  /** Kept at the top and never dropped for space or by Clear */
  pinned?: boolean
  /** Your own name for it, shown instead of the title */
  label?: string | null
}

export type Visit = Omit<
  HistoryEntry,
  "lastVisited" | "visits" | "pinned" | "label"
> & {
  /** Names from the panel beat names guessed from the URL */
  named?: boolean
}

export type HistoryOp =
  | { op: "record"; visit: Visit }
  | { op: "remove"; key: string }
  | { op: "pin"; key: string; pinned: boolean }
  | { op: "label"; key: string; label: string }
  | { op: "clear" }

/** What the URL alone says about the instance, or null if it isn't one. */
export function visitFromUrl(url: string): Visit | null {
  const platform = detectPlatform(url)
  if (platform === "bc") {
    const ctx = parseBcUrl(url)
    // The tenant's admin center isn't an environment
    if (ctx.isAdminCenter) return null
    return {
      key: `bc:${ctx.tenant ?? ""}/${ctx.environment ?? "default"}/${ctx.company ?? ""}`,
      platform,
      title: ctx.environment ?? "Business Central",
      subtitle: ctx.company,
      url: buildBcUrl(ctx, {}),
      envType: null,
    }
  }
  if (platform === "ce") {
    const u = new URL(url)
    // Only app pages are an org you worked in (not /api/data, sign-in or error pages)
    if (!u.pathname.toLowerCase().startsWith("/main.aspx")) return null
    return {
      key: `ce:${u.host}`,
      platform,
      title: u.host.split(".")[0],
      subtitle: null,
      url: ceAppUrl(u.origin, u.searchParams.get("appid")),
      envType: null,
    }
  }
  if (platform === "maker") {
    const m = parseMakerUrl(url)
    if (!m.environmentId) return null
    return {
      key: `maker:${m.environmentId}`,
      platform,
      title: m.environmentId,
      subtitle: "Power Apps",
      url: powerPlatform.maker(m.environmentId),
      envType: null,
      environmentId: m.environmentId,
    }
  }
  return null
}

/** The instance key a URL belongs to: panels remount when it changes. */
export const instanceKey = (url: string | undefined) =>
  (url && visitFromUrl(url)?.key) || url || ""

// --- The writer (service worker) ---------------------------------------------

function applyRecord(list: HistoryEntry[], visit: Visit): HistoryEntry[] {
  const now = Date.now()
  const existing = list.find((e) => e.key === visit.key)
  const { named, ...fields } = visit

  const entry: HistoryEntry = existing
    ? {
        ...existing,
        // Keep panel-given names over URL guesses
        title: named ? fields.title : existing.title,
        subtitle: named
          ? fields.subtitle
          : (existing.subtitle ?? fields.subtitle),
        envType: fields.envType ?? existing.envType,
        environmentId: fields.environmentId ?? existing.environmentId,
        url: named ? fields.url : existing.url,
        visits:
          now - existing.lastVisited > SAME_VISIT_MS
            ? existing.visits + 1
            : existing.visits,
        lastVisited: now,
      }
    : { ...fields, lastVisited: now, visits: 1 }

  const sorted = [entry, ...list.filter((e) => e.key !== visit.key)].sort(
    (a, b) => b.lastVisited - a.lastVisited
  )
  // Pinned entries don't count towards the limit
  return [
    ...sorted.filter((e) => e.pinned),
    ...sorted.filter((e) => !e.pinned).slice(0, MAX_ENTRIES),
  ]
}

function apply(list: HistoryEntry[], op: HistoryOp): HistoryEntry[] {
  switch (op.op) {
    case "record":
      return applyRecord(list, op.visit)
    case "remove":
      return list.filter((e) => e.key !== op.key)
    case "pin":
      return list.map((e) =>
        e.key === op.key ? { ...e, pinned: op.pinned } : e
      )
    case "label":
      // An empty name goes back to the instance's own title
      return list.map((e) =>
        e.key === op.key ? { ...e, label: op.label.trim() || null } : e
      )
    case "clear":
      return list.filter((e) => e.pinned)
  }
}

let queue: Promise<void> = Promise.resolve()

/** Applies a change in order. A failed write doesn't block the ones after it. */
export function applyHistoryOp(op: HistoryOp): Promise<void> {
  queue = queue
    .then(async () => {
      const items = await chrome.storage.local.get(HISTORY_KEY)
      const list = (items[HISTORY_KEY] as HistoryEntry[] | undefined) ?? []
      await chrome.storage.local.set({ [HISTORY_KEY]: apply(list, op) })
    })
    .catch((error) => console.warn("History write failed", error))
  return queue
}

// --- Callers (panel or worker) ---------------------------------------------------

const inWorker = typeof window === "undefined"

function send(op: HistoryOp): Promise<void> {
  if (inWorker) return applyHistoryOp(op)
  return chrome.runtime
    .sendMessage({ type: HISTORY_MESSAGE, op })
    .then(() => undefined)
    .catch(() => undefined)
}

export const recordVisit = (visit: Visit) => send({ op: "record", visit })
export const removeVisit = (key: string) => send({ op: "remove", key })
export const setPinned = (key: string, pinned: boolean) =>
  send({ op: "pin", key, pinned })
export const setLabel = (key: string, label: string) =>
  send({ op: "label", key, label })
/** Forgets everything except pinned entries. */
export const clearHistory = () => send({ op: "clear" })
