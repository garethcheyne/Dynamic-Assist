/** Runs FetchXML through the Web API and shapes the rows for the grid and exports. */
import { getJson } from "./metadata"
import type { QueryBuilderField } from "./lib/types"

import type { Results, Row } from "@/query-builder/results"

export type { Results }

const FORMATTED = "@OData.Community.Display.V1.FormattedValue"

/** One page of results, and Dataverse's cookie for the next. */
type Page = Results & { cookie: string | null }

async function runFetchXml(
  fetchXml: string,
  entitySetName: string,
  fields: QueryBuilderField[],
  columnOrder: string[]
): Promise<Page> {
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
    cookie: pagingCookie(body["@Microsoft.Dynamics.CRM.fetchxmlpagingcookie"]),
  }
}

/**
 * The paging cookie for the next page: Dataverse returns it as
 * <cookie pagingcookie="…"/>, the value URL-encoded twice.
 */
function pagingCookie(annotation: unknown): string | null {
  if (typeof annotation !== "string") return null
  const encoded = annotation.match(/pagingcookie="([^"]*)"/)?.[1]
  if (!encoded) return null
  try {
    return decodeURIComponent(decodeURIComponent(encoded))
  } catch {
    return null
  }
}

/** Dataverse's largest page */
const PAGE_SIZE = 5000

/**
 * Runs FetchXML and, when it has no row limit, follows every page (5,000 at
 * a time) until the last, handing each page's rows over as they arrive.
 * A top, or an aggregate, is one request. `stopped` ends it early; the
 * result then says more match.
 */
export async function runFetchXmlAll(
  fetchXml: string,
  entitySetName: string,
  fields: QueryBuilderField[],
  columnOrder: string[],
  onPage: (soFar: Results) => void,
  stopped: () => boolean
): Promise<Results> {
  const doc = new DOMParser().parseFromString(
    fetchXml.trim(),
    "application/xml"
  )
  const fetchEl = doc.documentElement
  const pageable =
    !doc.querySelector("parsererror") &&
    !fetchEl.getAttribute("top") &&
    fetchEl.getAttribute("aggregate") !== "true"
  if (!pageable) {
    const one = await runFetchXml(fetchXml, entitySetName, fields, columnOrder)
    onPage(one)
    return one
  }

  let all: Results | null = null
  let cookie: string | null = null
  // The previous page's first row: a page that starts the same is the
  // server repeating itself, not new rows
  let firstRow = ""
  for (let page = 1; ; page++) {
    fetchEl.setAttribute("count", String(PAGE_SIZE))
    fetchEl.setAttribute("page", String(page))
    if (cookie) fetchEl.setAttribute("paging-cookie", cookie)
    const xml = new XMLSerializer().serializeToString(doc)
    const next = await runFetchXml(xml, entitySetName, fields, columnOrder)
    const first = JSON.stringify(next.rows[0] ?? null)
    if (all && (next.rows.length === 0 || first === firstRow)) {
      const done = { ...all, more: false }
      onPage(done)
      return done
    }
    firstRow = first
    all = all
      ? {
          // A later page can bring a column the first didn't have
          columns: [
            ...all.columns,
            ...next.columns.filter(
              (c) => !all!.columns.some((a) => a.key === c.key)
            ),
          ],
          rows: all.rows.concat(next.rows),
          more: next.more,
          ms: all.ms + next.ms,
        }
      : { columns: next.columns, rows: next.rows, more: next.more, ms: next.ms }
    onPage(all)
    if (!next.more || stopped()) return all
    cookie = next.cookie
  }
}

/** Entity set name for a table (needed for the Web API URL). */
export async function entitySetOf(entityName: string): Promise<string> {
  const md = await getJson(
    `EntityDefinitions(LogicalName='${entityName}')?$select=EntitySetName`
  )
  return md.EntitySetName
}
