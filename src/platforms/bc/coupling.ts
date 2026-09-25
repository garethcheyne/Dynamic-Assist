/**
 * Business Central ↔ Dynamics 365 couplings, read through the companion app.
 * BC keeps them in its own tables (the Dataverse side stores nothing about BC):
 *
 *   5331 CRM Integration Record    CRM ID ↔ Integration ID (the BC SystemId), per table
 *   5335 Integration Table Mapping BC table → proxy table, and BC's record page
 *   5330 CRM Connection Setup      the org's address and app
 *   2000000136 Table Metadata      a proxy table's Dataverse name (ExternalName), a table's pages
 *   2000000138 Page Metadata       a list page's card (CardPageID)
 *
 * Field numbers are the base app's, unchanged since the integration shipped.
 */
import type { BcFilter, BcQuery, BcQueryResult } from "./query/bridge"

/** Calls one companion method (the bridge's `request`). */
export type CompanionCall = <T>(method: string, params?: object) => Promise<T>

const T = {
  integrationRecord: 5331,
  tableMapping: 5335,
  connectionSetup: 5330,
  tableMetadata: 2000000136,
  pageMetadata: 2000000138,
}
const F = {
  crmId: 2,
  integrationId: 3,
  couplingTable: 6,
  mappingTable: 2,
  mappingIntegrationTable: 3,
  mappingBcPage: 23,
  serverAddress: 2,
  appModuleId: 65,
  metaId: 1,
  metaCaption: 3,
  metaLookupPage: 5,
  metaDrillDownPage: 6,
  pageId: 1,
  pageCard: 6,
  metaExternalName: 12,
  systemId: 2000000000,
}

const bare = (guid: string) => guid.replace(/[{}]/g, "").toLowerCase()

function query(
  call: CompanionCall,
  table: number,
  fields: number[],
  filters: BcFilter[],
  top = 50
) {
  const q: BcQuery = {
    table,
    fields,
    filters,
    sort: [],
    descending: false,
    top,
  }
  return call<BcQueryResult>("query", q)
}

async function connectionSetup(call: CompanionCall) {
  const setup = await query(
    call,
    T.connectionSetup,
    [F.serverAddress, F.appModuleId],
    [],
    1
  )
  const [server, appId] = (setup.rows[0] ?? []) as (string | null)[]
  return {
    server: server ? server.replace(/\/+$/, "") : null,
    appId: appId || null,
  }
}

export type CeTarget = {
  crmId: string
  /** Dataverse table; several when the BC table maps to more than one */
  entities: string[]
  server: string | null
  appId: string | null
}

/** The Dataverse record a BC record is coupled to, or null when it isn't. */
export async function findCeRecord(
  call: CompanionCall,
  tableId: number,
  systemId: string
): Promise<CeTarget | null> {
  const coupling = await query(
    call,
    T.integrationRecord,
    [F.crmId],
    [
      { field: F.integrationId, filter: bare(systemId) },
      { field: F.couplingTable, filter: String(tableId) },
    ],
    1
  )
  const crmId = coupling.rows[0]?.[0] as string | undefined
  if (!crmId) return null

  const mappings = await query(
    call,
    T.tableMapping,
    [F.mappingIntegrationTable],
    [{ field: F.mappingTable, filter: String(tableId) }]
  )
  const proxies = [...new Set(mappings.rows.map((r) => Number(r[0])))].filter(
    (n) => n > 0
  )
  const names = proxies.length
    ? await query(
        call,
        T.tableMetadata,
        [F.metaExternalName],
        [{ field: F.metaId, filter: proxies.join("|") }]
      )
    : { rows: [] as unknown[][] }
  const entities = [
    ...new Set(names.rows.map((r) => String(r[0] ?? "")).filter(Boolean)),
  ]
  return { crmId: bare(crmId), entities, ...(await connectionSetup(call)) }
}

export function ceRecordUrl(target: CeTarget, entity: string) {
  if (!target.server) return null
  const u = new URL(`${target.server}/main.aspx`)
  if (target.appId) u.searchParams.set("appid", target.appId)
  u.searchParams.set("pagetype", "entityrecord")
  u.searchParams.set("etn", entity)
  u.searchParams.set("id", target.crmId)
  return u.toString()
}

export type BcTarget = {
  tableId: number
  tableCaption: string
  /** The page to open it on: the mapping's record page, else the table's card */
  pageId: number | null
  /** A web client URL filter on the record's primary key */
  filter: string
  /** The key values, for showing ("10000", "Order · 1001") */
  key: string
}

/** Quotes a value for a web client URL filter: 'It''s'. */
const quote = (value: unknown) =>
  `'${String(value ?? "")
    .trim()
    .replace(/'/g, "''")}'`

/**
 * The card for a table, from its list pages' CardPageID; else the first list
 * page (the mapping's "BC Rec Page Id" is often left at 0).
 */
async function cardPage(call: CompanionCall, listPages: unknown[]) {
  const pages = listPages.map(Number).filter((p) => p > 0)
  if (!pages.length) return 0
  const meta = await query(
    call,
    T.pageMetadata,
    [F.pageId, F.pageCard],
    [{ field: F.pageId, filter: pages.join("|") }],
    pages.length
  ).catch(() => null)
  const card = meta?.rows.map((r) => Number(r[1] ?? 0)).find((p) => p > 0)
  return card || pages[0]
}

/**
 * The BC records coupled to a Dataverse record: usually one, but an account
 * can be coupled to a customer and a vendor. `orgHost` checks that this BC
 * company is connected to that org.
 */
export async function findBcRecords(
  call: CompanionCall,
  crmId: string,
  orgHost: string
): Promise<{ records: BcTarget[]; connectedTo: string | null }> {
  const { server } = await connectionSetup(call)
  const connectedTo = server ? new URL(server).host.toLowerCase() : null
  if (connectedTo !== orgHost.toLowerCase()) return { records: [], connectedTo }

  const couplings = await query(
    call,
    T.integrationRecord,
    [F.integrationId, F.couplingTable],
    [{ field: F.crmId, filter: bare(crmId) }],
    10
  )
  const records: BcTarget[] = []
  for (const [integrationId, table] of couplings.rows) {
    const tableId = Number(table)
    const [row, mapping, meta] = await Promise.all([
      // Fields [] is the primary key
      query(
        call,
        tableId,
        [],
        [{ field: F.systemId, filter: bare(String(integrationId)) }],
        1
      ).catch(() => null),
      query(
        call,
        T.tableMapping,
        [F.mappingBcPage],
        [{ field: F.mappingTable, filter: String(tableId) }],
        1
      ),
      query(
        call,
        T.tableMetadata,
        [F.metaCaption, F.metaLookupPage, F.metaDrillDownPage],
        [{ field: F.metaId, filter: String(tableId) }],
        1
      ),
    ])
    const values = row?.rows[0]
    // Coupled, but the BC record is gone (or you can't read it)
    if (!row || !values) continue
    const mappedPage = Number(mapping.rows[0]?.[0] ?? 0)
    const [caption, lookupPage, drillDownPage] = meta.rows[0] ?? []
    records.push({
      tableId,
      tableCaption: String(caption ?? `Table ${tableId}`),
      pageId:
        mappedPage ||
        (await cardPage(call, [drillDownPage, lookupPage])) ||
        null,
      filter: row.columns
        .map((c, i) => `${quote(c.name)} IS ${quote(values[i])}`)
        .join(" AND "),
      key: values.map((v) => String(v ?? "")).join(" · "),
    })
  }
  return { records, connectedTo }
}
