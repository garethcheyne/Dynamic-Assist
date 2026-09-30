/**
 * Business Central metadata the query builder reads through the companion,
 * kept per environment so the next open is quick: the table list, and the
 * fields of tables you've opened. Tables and fields belong to the environment
 * (its apps), not the company. Kept in chrome.storage.local on this machine
 * only; the side panel's Settings clears it.
 *
 * The builder uses what's here straight away and reads it again in the
 * background, so a new extension's tables turn up on the next open.
 */
import type { BcTable, BcTableFields } from "./bridge"

const PREFIX = "bc:meta:"
/** Older than this, cached metadata is read again before it's used */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
/** Fields of at most this many tables per environment, newest kept */
const MAX_TABLES = 150

export type BcMetaEntry = {
  at: number
  tables: BcTable[]
  /** Fields by table number, each with when it was read */
  fields: Record<string, { at: number; data: BcTableFields }>
}

/** The cache key for a tenant and environment. */
export const metaKey = (tenant: string | null, environment: string | null) =>
  `${PREFIX}${tenant ?? ""}/${environment ?? "default"}`.toLowerCase()

export const isMetaKey = (key: string) => key.startsWith(PREFIX)

async function read(key: string): Promise<BcMetaEntry | null> {
  try {
    return ((await chrome.storage.local.get(key))[key] as BcMetaEntry) ?? null
  } catch {
    return null
  }
}

const fresh = (at: number) => Date.now() - at < MAX_AGE_MS

/** The cached table list, if it's recent enough to use. */
export async function cachedTables(key: string): Promise<BcTable[] | null> {
  const entry = await read(key)
  return entry && fresh(entry.at) && entry.tables.length ? entry.tables : null
}

export async function saveTables(key: string, tables: BcTable[]) {
  const entry = await read(key)
  await chrome.storage.local
    .set({ [key]: { at: Date.now(), tables, fields: entry?.fields ?? {} } })
    .catch(() => {})
}

/** A table's cached fields, if recent enough to use. */
export async function cachedFields(
  key: string,
  table: number
): Promise<BcTableFields | null> {
  const hit = (await read(key))?.fields[table]
  return hit && fresh(hit.at) ? hit.data : null
}

export async function saveFields(key: string, data: BcTableFields) {
  const entry = await read(key)
  const fields: BcMetaEntry["fields"] = {
    ...(entry?.fields ?? {}),
    [data.table]: { at: Date.now(), data },
  }
  // Keep the most recently read tables only
  const kept = Object.entries(fields)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, MAX_TABLES)
  await chrome.storage.local
    .set({
      [key]: {
        at: entry?.at ?? 0,
        tables: entry?.tables ?? [],
        fields: Object.fromEntries(kept),
      },
    })
    .catch(() => {})
}

/** A cached environment, for Settings. */
export type BcMetaSummary = {
  key: string
  /** "tenant/environment" as cached */
  name: string
  at: number
  tables: number
  fieldTables: number
}

export async function listMeta(): Promise<BcMetaSummary[]> {
  const all = await chrome.storage.local.get(null)
  return Object.entries(all)
    .filter(([key]) => isMetaKey(key))
    .map(([key, value]) => {
      const entry = value as BcMetaEntry
      return {
        key,
        name: key.slice(PREFIX.length),
        at: entry.at,
        tables: entry.tables?.length ?? 0,
        fieldTables: Object.keys(entry.fields ?? {}).length,
      }
    })
    .sort((a, b) => b.at - a.at)
}

export const clearMeta = (keys: string[]) => chrome.storage.local.remove(keys)
