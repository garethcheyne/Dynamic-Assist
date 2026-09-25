import { describe, expect, it } from "vitest"

import {
  ceRecordUrl,
  findBcRecords,
  findCeRecord,
  type CompanionCall,
} from "@/platforms/bc/coupling"
import type { BcQuery } from "@/platforms/bc/query/bridge"

const CUSTOMER_SYSID = "4471839b-045e-f011-8eed-002248105286"
const VENDOR_SYSID = "11111111-2222-3333-4444-555555555555"
const ACCOUNT = "33748780-4b59-eb11-a812-000d3a6abeb9"
const ORG = "https://contoso.crm6.dynamics.com"

/** A fake companion over a few rows per table; filters are exact or a|b. */
function fakeCompanion(server = ORG + "/", vendorCard = 26) {
  const tables: Record<
    number,
    { cols: Record<number, string>; rows: Record<number, unknown>[] }
  > = {
    5331: {
      cols: { 2: "CRM ID", 3: "Integration ID", 6: "Table ID" },
      rows: [
        {
          2: `{${ACCOUNT.toUpperCase()}}`,
          3: `{${CUSTOMER_SYSID.toUpperCase()}}`,
          6: 18,
        },
        {
          2: `{${ACCOUNT.toUpperCase()}}`,
          3: `{${VENDOR_SYSID.toUpperCase()}}`,
          6: 23,
        },
      ],
    },
    5335: {
      cols: {
        1: "Name",
        2: "Table ID",
        3: "Integration Table ID",
        23: "BC Rec Page Id",
      },
      rows: [
        { 1: "CUSTOMER", 2: 18, 3: 5341, 23: 21 },
        { 1: "VENDOR", 2: 23, 3: 5341, 23: 0 },
      ],
    },
    5330: {
      cols: { 2: "Server Address", 65: "Newest UI AppModuleId" },
      rows: [{ 2: server, 65: "app-1" }],
    },
    2000000136: {
      cols: {
        1: "ID",
        3: "Caption",
        5: "LookupPageID",
        6: "DrillDownPageId",
        12: "ExternalName",
      },
      rows: [
        { 1: 5341, 3: "CRM Account", 5: 0, 6: 0, 12: "account" },
        { 1: 18, 3: "Customer", 5: 33, 6: 22, 12: "" },
        { 1: 23, 3: "Vendor", 5: 27, 6: 27, 12: "" },
      ],
    },
    2000000138: {
      cols: { 1: "ID", 6: "CardPageID" },
      rows: [
        { 1: 22, 6: 21 },
        { 1: 27, 6: vendorCard },
      ],
    },
    18: {
      cols: { 1: "No.", 2000000000: "SystemId" },
      rows: [{ 1: "C'1", 2000000000: CUSTOMER_SYSID }],
    },
    23: {
      cols: { 1: "No.", 2000000000: "SystemId" },
      rows: [{ 1: "V1", 2000000000: VENDOR_SYSID }],
    },
  }
  const norm = (v: unknown) => String(v).replace(/[{}]/g, "").toLowerCase()
  const calls: BcQuery[] = []
  const call = (async (method: string, params: BcQuery) => {
    if (method !== "query") throw new Error(method)
    calls.push(params)
    const t = tables[params.table]
    const fields = params.fields.length ? params.fields : [1]
    const rows = t.rows
      .filter((r) =>
        params.filters.every((f) =>
          f.filter.split("|").map(norm).includes(norm(r[f.field]))
        )
      )
      .slice(0, params.top ?? undefined)
    return {
      table: params.table,
      columns: fields.map((no) => ({ no, name: t.cols[no] })),
      rows: rows.map((r) => fields.map((no) => r[no] ?? null)),
    }
  }) as unknown as CompanionCall
  return { call, calls }
}

describe("findCeRecord", () => {
  it("finds the coupled account and builds its URL", async () => {
    const { call } = fakeCompanion()
    const target = await findCeRecord(call, 18, `{${CUSTOMER_SYSID}}`)
    expect(target).toEqual({
      crmId: ACCOUNT,
      entities: ["account"],
      server: ORG,
      appId: "app-1",
    })
    expect(ceRecordUrl(target!, "account")).toBe(
      `${ORG}/main.aspx?appid=app-1&pagetype=entityrecord&etn=account&id=${ACCOUNT}`
    )
  })

  it("returns null when not coupled", async () => {
    const { call } = fakeCompanion()
    expect(await findCeRecord(call, 27, CUSTOMER_SYSID)).toBeNull()
  })
})

describe("findBcRecords", () => {
  it("finds every coupled BC record with a key filter and page", async () => {
    const { call } = fakeCompanion()
    const { records, connectedTo } = await findBcRecords(
      call,
      ACCOUNT,
      "contoso.crm6.dynamics.com"
    )
    expect(connectedTo).toBe("contoso.crm6.dynamics.com")
    expect(records).toEqual([
      {
        tableId: 18,
        tableCaption: "Customer",
        pageId: 21,
        filter: "'No.' IS 'C''1'",
        key: "C'1",
      },
      // No record page in the mapping: the card of the table's list page
      {
        tableId: 23,
        tableCaption: "Vendor",
        pageId: 26,
        filter: "'No.' IS 'V1'",
        key: "V1",
      },
    ])
  })

  it("falls back to the list page when it has no card", async () => {
    const { call } = fakeCompanion(ORG + "/", 0)
    const { records } = await findBcRecords(
      call,
      ACCOUNT,
      "contoso.crm6.dynamics.com"
    )
    expect(records.find((r) => r.tableId === 23)?.pageId).toBe(27)
  })

  it("stops when the company is connected to another org", async () => {
    const { call, calls } = fakeCompanion("https://other.crm.dynamics.com")
    const result = await findBcRecords(
      call,
      ACCOUNT,
      "contoso.crm6.dynamics.com"
    )
    expect(result).toEqual({
      records: [],
      connectedTo: "other.crm.dynamics.com",
    })
    expect(calls).toHaveLength(1)
  })
})
