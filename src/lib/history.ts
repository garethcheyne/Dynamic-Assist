/**
 * Instances you've visited: BC environments (per company) and CE orgs. Kept in
 * chrome.storage.local on this machine only. The service worker records every
 * visit from the tab's URL; the side panel adds friendly names when it has them.
 */
import { detectPlatform, parseMakerUrl } from "@/shared/detect"
import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"

export const HISTORY_KEY = "history"
const MAX_ENTRIES = 50
/** Page moves inside an instance within this window don't count as a new visit. */
const SAME_VISIT_MS = 30 * 60 * 1000

export type HistoryEntry = {
  key: string
  platform: "bc" | "ce" | "maker"
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

type Visit = Omit<
  HistoryEntry,
  "lastVisited" | "visits" | "pinned" | "label"
> & {
  /** Names from the panel beat names guessed from the URL */
  named?: boolean
}

/** What the URL alone says about the instance, or null if it isn't one. */
export function visitFromUrl(url: string): Visit | null {
  const platform = detectPlatform(url)
  if (platform === "bc") {
    const ctx = parseBcUrl(url)
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
    const appId = u.searchParams.get("appid")
    return {
      key: `ce:${u.host}`,
      platform,
      title: u.host.split(".")[0],
      subtitle: null,
      url: `${u.origin}/main.aspx${appId ? `?appid=${appId}` : ""}`,
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
      url: `${m.origin}/environments/${m.environmentId}/home`,
      envType: null,
      environmentId: m.environmentId,
    }
  }
  return null
}

let queue: Promise<void> = Promise.resolve()

/** Adds or refreshes an instance. Writes are queued so visits don't overwrite each other. */
export function recordVisit(visit: Visit) {
  queue = queue.then(async () => {
    const items = await chrome.storage.local.get(HISTORY_KEY)
    const list = (items[HISTORY_KEY] as HistoryEntry[] | undefined) ?? []
    const now = Date.now()
    const existing = list.find((e) => e.key === visit.key)
    const { named, ...fields } = visit

    let entry: HistoryEntry
    if (existing) {
      entry = {
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
    } else {
      entry = { ...fields, lastVisited: now, visits: 1 }
    }

    const others = list.filter((e) => e.key !== visit.key)
    const sorted = [entry, ...others].sort(
      (a, b) => b.lastVisited - a.lastVisited
    )
    // Pinned entries don't count towards the limit
    const pinned = sorted.filter((e) => e.pinned)
    const recent = sorted.filter((e) => !e.pinned).slice(0, MAX_ENTRIES)
    await chrome.storage.local.set({ [HISTORY_KEY]: [...pinned, ...recent] })
  })
  return queue.catch(() => {})
}

async function update(fn: (list: HistoryEntry[]) => HistoryEntry[]) {
  queue = queue.then(async () => {
    const items = await chrome.storage.local.get(HISTORY_KEY)
    const list = (items[HISTORY_KEY] as HistoryEntry[] | undefined) ?? []
    await chrome.storage.local.set({ [HISTORY_KEY]: fn(list) })
  })
  return queue.catch(() => {})
}

export const removeVisit = (key: string) =>
  update((list) => list.filter((e) => e.key !== key))

export const setPinned = (key: string, pinned: boolean) =>
  update((list) => list.map((e) => (e.key === key ? { ...e, pinned } : e)))

/** An empty name goes back to the instance's own title. */
export const setLabel = (key: string, label: string) =>
  update((list) =>
    list.map((e) => (e.key === key ? { ...e, label: label.trim() || null } : e))
  )

/** Forgets everything except pinned entries. */
export const clearHistory = () => update((list) => list.filter((e) => e.pinned))
