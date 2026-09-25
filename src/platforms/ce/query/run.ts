/** Runs FetchXML through the Web API and shapes the rows for the grid and exports. */
import { getJson } from "./metadata"
import type { QueryBuilderField } from "./lib/types"

import { rowLimit } from "@/query-builder/limits"
import type { Results, Row } from "@/query-builder/results"

export type { Results }

const FORMATTED = "@OData.Community.Display.V1.FormattedValue"

async function runFetchXml(
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

/**
 * Runs FetchXML for at most its row limit (the default when it has none,
 * never more than MAX_ROWS). The limit goes as count rather than top, so
 * Dataverse says whether more rows match. Aggregates run as written.
 */
export async function runFetchXmlLimited(
  fetchXml: string,
  entitySetName: string,
  fields: QueryBuilderField[],
  columnOrder: string[]
): Promise<Results> {
  const doc = new DOMParser().parseFromString(
    fetchXml.trim(),
    "application/xml"
  )
  const fetchEl = doc.documentElement
  let xml = fetchXml
  if (
    !doc.querySelector("parsererror") &&
    fetchEl.getAttribute("aggregate") !== "true"
  ) {
    const limit = rowLimit(
      Number(fetchEl.getAttribute("top") || fetchEl.getAttribute("count"))
    )
    fetchEl.removeAttribute("top")
    fetchEl.removeAttribute("paging-cookie")
    fetchEl.setAttribute("count", String(limit))
    fetchEl.setAttribute("page", "1")
    xml = new XMLSerializer().serializeToString(doc)
  }
  return runFetchXml(xml, entitySetName, fields, columnOrder)
}

/** Entity set name for a table (needed for the Web API URL). */
export async function entitySetOf(entityName: string): Promise<string> {
  const md = await getJson(
    `EntityDefinitions(LogicalName='${entityName}')?$select=EntitySetName`
  )
  return md.EntitySetName
}
