/**
 * Names for the extensions installed in a BC environment, so the field-name
 * badges can say which app added a field. The web client only knows app IDs;
 * the names come from "NAV App Installed App" (2000000153) through the
 * companion app, cached per environment for a day.
 */
import { companionFor } from "./companion-channel"
import type { BcQueryResult } from "./query/bridge"
import type { BcContext } from "./url"

type BcAppName = { name: string; publisher: string; version: string }
export type BcAppNames = Record<string, BcAppName>

const CACHE_MS = 24 * 60 * 60 * 1000
const INSTALLED_APPS = 2000000153
/** App ID, Name, Publisher, Version Major, Minor, Build, Revision */
const FIELDS = [1, 3, 4, 5, 6, 7, 8]

/** Microsoft's core apps, named even without the companion */
export const KNOWN_APPS: BcAppNames = {
  "437dbf0e-84ff-417a-965d-ed2bb9650972": {
    name: "Base Application",
    publisher: "Microsoft",
    version: "",
  },
  "63ca2fa4-4f03-4f2b-a480-172fef340d3f": {
    name: "System Application",
    publisher: "Microsoft",
    version: "",
  },
  "c1335042-3002-4257-bf8a-75c898ccb1b8": {
    name: "Application",
    publisher: "Microsoft",
    version: "",
  },
  "f3552374-a1f2-4356-848e-196002525837": {
    name: "Business Foundation",
    publisher: "Microsoft",
    version: "",
  },
}

const cacheKey = (ctx: BcContext) =>
  `bc:apps:${ctx.tenant ?? ""}/${ctx.environment ?? ""}`.toLowerCase()

const bare = (id: unknown) =>
  String(id ?? "")
    .replace(/[{}]/g, "")
    .toLowerCase()

/**
 * Installed apps by ID: from the cache, else the companion (which may open
 * its query page in the background; `onOpening` says so).
 */
export async function loadAppNames(
  ctx: BcContext,
  onOpening?: () => void
): Promise<BcAppNames> {
  const key = cacheKey(ctx)
  const stored = (await chrome.storage.local.get(key))[key] as
    { at: number; apps: BcAppNames } | undefined
  if (stored && Date.now() - stored.at < CACHE_MS) return stored.apps

  const call = await companionFor(ctx, onOpening)
  const result = await call<BcQueryResult>("query", {
    table: INSTALLED_APPS,
    fields: FIELDS,
    filters: [],
    sort: [],
    descending: false,
    top: 2000,
  })
  const apps: BcAppNames = {}
  for (const [id, name, publisher, ...v] of result.rows)
    apps[bare(id)] = {
      name: String(name ?? ""),
      publisher: String(publisher ?? ""),
      version: v.join("."),
    }
  await chrome.storage.local.set({ [key]: { at: Date.now(), apps } })
  return apps
}
