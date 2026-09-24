/** Runs FetchXML through the Web API and shapes the rows for the grid and exports. */
import { getJson } from "./metadata"
import type { QueryBuilderField } from "./lib/types"

export type Cell = { value: unknown; formatted: string | null }
export type Row = Record<string, Cell>
export type Column = { key: string; label: string }

export type Results = {
  columns: Column[]
  rows: Row[]
  /** More rows matched than came back (top or page size) */
  more: boolean
  ms: number
}

const FORMATTED = "@OData.Community.Display.V1.FormattedValue"

export async function runFetchXml(
  fetchXml: string,
  entitySetName: string,
  fields: QueryBuilderField[],
  columnOrder: string[]
): Promise<Results> {
  const started = performance.now()
  const res = await fetch(
    `/api/data/v9.2/${entitySetName}?fetchXml=${encodeURIComponent(fetchXml)}`,
    {
      headers: {
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Prefer: 'odata.include-annotations="*"',
      },
    }
  )
  if (!res.ok) {
    let message = `Web API ${res.status}`
    try {
      message = (await res.json())?.error?.message ?? message
    } catch {
      // keep the status
    }
    throw new Error(message)
  }
  const body = await res.json()
  const raw = (body.value ?? []) as Record<string, unknown>[]

  // Lookups come back as _name_value; show them under the column's name
  const columnKey = (key: string) => key.match(/^_(.+)_value$/)?.[1] ?? key
  const labelOf = new Map(fields.map((f) => [f.id, f.label]))

  const keys = new Set<string>()
  const rows: Row[] = raw.map((r) => {
    const row: Row = {}
    for (const [key, value] of Object.entries(r)) {
      if (key.includes("@") || key === "@odata.etag") continue
      const name = columnKey(key)
      keys.add(name)
      row[name] = {
        value,
        formatted: (r[`${key}${FORMATTED}`] as string | undefined) ?? null,
      }
    }
    return row
  })

  const ordered = [
    ...columnOrder.filter((c) => keys.has(c)),
    ...[...keys]
      .filter((k) => !columnOrder.includes(k))
      .sort((a, b) => (labelOf.get(a) ?? a).localeCompare(labelOf.get(b) ?? b)),
  ]

  return {
    columns: ordered.map((key) => ({ key, label: labelOf.get(key) ?? key })),
    rows,
    more: body["@Microsoft.Dynamics.CRM.morerecords"] === true,
    ms: Math.round(performance.now() - started),
  }
}

/** Entity set name for a table (needed for the Web API URL). */
export async function entitySetOf(entityName: string): Promise<string> {
  const md = await getJson(
    `EntityDefinitions(LogicalName='${entityName}')?$select=EntitySetName`
  )
  return md.EntitySetName
}
