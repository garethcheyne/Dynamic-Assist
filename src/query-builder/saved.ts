/**
 * Saved queries, for both builders: kept in this browser's extension storage,
 * so a query saved in one environment (or org) can be run again in another.
 * Dynamics 365 queries are FetchXML; Business Central ones are the builder's
 * own query (table and field numbers), which carry over between environments
 * with the same tables. Export and import move them between browsers.
 */
import * as React from "react"

import type { BcQuery } from "@/platforms/bc/query/bridge"

export const SAVED_QUERIES_KEY = "savedQueries"

export type SavedQuery = {
  id: string
  name: string
  savedAt: number
  /** Where it was saved, for showing: "contoso.crm.dynamics.com", "Sandbox · CRONUS" */
  where: string
  /** The table's name, for showing */
  table: string
} & ({ platform: "ce"; fetchXml: string } | { platform: "bc"; query: BcQuery })

/** Omit, kept per platform (a plain Omit on a union loses which is which) */
export type OmitEach<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

export type NewSavedQuery = OmitEach<SavedQuery, "id" | "savedAt">

async function read(): Promise<SavedQuery[]> {
  const items = await chrome.storage.local.get(SAVED_QUERIES_KEY)
  const list = items[SAVED_QUERIES_KEY]
  return Array.isArray(list) ? (list as SavedQuery[]) : []
}

const write = (list: SavedQuery[]) =>
  chrome.storage.local.set({ [SAVED_QUERIES_KEY]: list })

/** Saves a query; one with the same name and platform is replaced. */
export async function saveQuery(query: NewSavedQuery): Promise<SavedQuery> {
  const list = await read()
  const existing = list.find(
    (q) =>
      q.platform === query.platform &&
      q.name.toLowerCase() === query.name.toLowerCase()
  )
  const saved = {
    ...query,
    id: existing?.id ?? crypto.randomUUID(),
    savedAt: Date.now(),
  } as SavedQuery
  await write([saved, ...list.filter((q) => q.id !== saved.id)])
  return saved
}

export async function deleteQuery(id: string) {
  await write((await read()).filter((q) => q.id !== id))
}

/** The saved queries as a JSON file's text, to share or move. */
export async function exportQueries() {
  return JSON.stringify(
    { type: "dynamic-assist-queries", version: 1, queries: await read() },
    null,
    2
  )
}

const valid = (q: unknown): q is SavedQuery => {
  const v = q as Partial<SavedQuery> | null
  if (!v || typeof v.name !== "string" || typeof v.table !== "string")
    return false
  if (v.platform === "ce") return typeof v.fetchXml === "string"
  if (v.platform === "bc")
    return typeof v.query === "object" && typeof v.query?.table === "number"
  return false
}

/**
 * Adds the queries in an exported file; ones with the same name and platform
 * are replaced. Returns how many were imported.
 */
export async function importQueries(text: string): Promise<number> {
  const parsed = JSON.parse(text) as { queries?: unknown }
  const incoming = (
    Array.isArray(parsed?.queries) ? parsed.queries : []
  ).filter(valid)
  if (!incoming.length) throw new Error("No saved queries in that file.")
  let list = await read()
  for (const q of incoming) {
    list = list.filter(
      (x) =>
        !(
          x.platform === q.platform &&
          x.name.toLowerCase() === q.name.toLowerCase()
        )
    )
    list.unshift({
      ...q,
      id: crypto.randomUUID(),
      savedAt: q.savedAt ?? Date.now(),
    })
  }
  await write(list)
  return incoming.length
}

/** This platform's saved queries, newest first, kept up to date. */
export function useSavedQueries(platform: SavedQuery["platform"]) {
  const [list, setList] = React.useState<SavedQuery[]>([])
  React.useEffect(() => {
    const load = () =>
      void read()
        .then((all) => setList(all.filter((q) => q.platform === platform)))
        .catch(() => setList([]))
    load()
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "local" && SAVED_QUERIES_KEY in changes) load()
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [platform])
  return list
}
