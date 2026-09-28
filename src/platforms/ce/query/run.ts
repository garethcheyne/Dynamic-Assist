/** Runs FetchXML through the Web API and shapes the rows for the grid and exports. */
import { getJson } from "./metadata"
import type { QueryBuilderField } from "./lib/types"

import { rowLimit } from "@/query-builder/limits"
import type { Results, Row } from "@/query-builder/results"

export type { Results }

const FORMATTED = "@OData.Community.Display.V1.FormattedValue"
const ATTRIBUTE_NAME = "@OData.Community.Display.V1.AttributeName"

const HEADERS = {
  Accept: "application/json",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
}

async function getPage(url: string, prefer: string) {
  const res = await fetch(url, { headers: { ...HEADERS, Prefer: prefer } })
  if (!res.ok) {
    let message = `Web API ${res.status}`
    try {
      message = (await res.json())?.error?.message ?? message
    } catch {
      // keep the status
    }
    throw new Error(message)
  }
  return res.json()
}

/**
 * Web API rows as grid rows. Columns come in columnOrder, then the rest: by
 * label, or (keepOrder) as the response has them, which is a SQL query's
 * SELECT order.
 */
function shape(
  raw: Record<string, unknown>[],
  fields: QueryBuilderField[],
  columnOrder: string[],
  keepOrder = false
): Pick<Results, "columns" | "rows"> {
  // Lookups come back as _name_value; show them under the column's name
  const columnKey = (key: string) => key.match(/^_(.+)_value$/)?.[1] ?? key
  const labelOf = new Map(fields.map((f) => [f.id, f.label]))

  const keys = new Set<string>()
  // A SQL alias names the column it came from
  const sourceOf = new Map<string, string>()
  const rows: Row[] = raw.map((r) => {
    const row: Row = {}
    for (const [key, value] of Object.entries(r)) {
      if (key.includes("@") || key === "@odata.etag") continue
      const name = columnKey(key)
      keys.add(name)
      const source = r[`${key}${ATTRIBUTE_NAME}`]
      if (typeof source === "string") sourceOf.set(name, source)
      row[name] = {
        value,
        formatted: (r[`${key}${FORMATTED}`] as string | undefined) ?? null,
      }
    }
    return row
  })

  const rest = [...keys].filter((k) => !columnOrder.includes(k))
  if (!keepOrder)
    rest.sort((a, b) =>
      (labelOf.get(a) ?? a).localeCompare(labelOf.get(b) ?? b)
    )
  const ordered = [...columnOrder.filter((c) => keys.has(c)), ...rest]

  return {
    columns: ordered.map((key) => ({
      key,
      label: sourceOf.has(key)
        ? `${key} (${labelOf.get(sourceOf.get(key)!) ?? sourceOf.get(key)})`
        : (labelOf.get(key) ?? key),
    })),
    rows,
  }
}

async function runFetchXml(
  fetchXml: string,
  entitySetName: string,
  fields: QueryBuilderField[],
  columnOrder: string[]
): Promise<Results> {
  const started = performance.now()
  const body = await getPage(
    `/api/data/v9.2/${entitySetName}?fetchXml=${encodeURIComponent(fetchXml)}`,
    'odata.include-annotations="*"'
  )
  return {
    ...shape(
      (body.value ?? []) as Record<string, unknown>[],
      fields,
      columnOrder
    ),
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

/**
 * Runs a SQL query through the Web API's sql option, on the entity set of its
 * FROM table, following pages up to the row limit (default 500, at most
 * 5,000). Paging uses odata.maxpagesize: the docs say TOP and OFFSET aren't
 * reliable here.
 * https://learn.microsoft.com/power-apps/developer/data-platform/webapi/query/sql
 */
export async function runSql(
  sql: string,
  entitySetName: string,
  fields: QueryBuilderField[],
  limit = rowLimit(null)
): Promise<Results> {
  const started = performance.now()
  const prefer = `odata.include-annotations="*",odata.maxpagesize=${Math.min(limit, 5000)}`
  let url: string | undefined =
    `/api/data/v9.2/${entitySetName}?sql=${encodeURIComponent(sql)}`
  const raw: Record<string, unknown>[] = []
  let more = false
  while (url) {
    const body = await getPage(url, prefer)
    raw.push(...((body.value ?? []) as Record<string, unknown>[]))
    const next = body["@odata.nextLink"] as string | undefined
    if (raw.length >= limit) {
      more = !!next || raw.length > limit
      break
    }
    url = next
  }
  return {
    ...shape(raw.slice(0, limit), fields, [], true),
    more,
    ms: Math.round(performance.now() - started),
  }
}

/**
 * Asks Dataverse whether it can read the FetchXML, without running it
 * (FetchXmlToQueryExpression). Null when it's fine; otherwise its message.
 */
export async function checkFetchXml(fetchXml: string): Promise<string | null> {
  const param = encodeURIComponent(`'${fetchXml.replace(/'/g, "''")}'`)
  try {
    await getPage(
      `/api/data/v9.2/FetchXmlToQueryExpression(FetchXml=@p)?@p=${param}`,
      "return=minimal"
    )
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
