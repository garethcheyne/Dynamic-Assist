/**
 * What a column is, for the logical-name tooltips on forms and grids: its
 * metadata from the Web API (same origin, the user's own session), fetched the
 * first time it's hovered and cached per table and column.
 */
import type { TipCard } from "@/shared/page-tip"

type Label = { UserLocalizedLabel?: { Label?: string } | null }
type AttributeMetadata = {
  LogicalName: string
  SchemaName: string
  DisplayName?: Label
  Description?: Label
  AttributeTypeName?: { Value?: string }
  RequiredLevel?: { Value?: string }
  IsCustomAttribute?: boolean
  IsManaged?: boolean
  IsPrimaryName?: boolean
  IsPrimaryId?: boolean
  AttributeOf?: string | null
}

const REQUIRED: Record<string, string> = {
  None: "Optional",
  Recommended: "Business recommended",
  ApplicationRequired: "Business required",
  SystemRequired: "System required",
}

const cache = new Map<string, Promise<TipCard>>()

const label = (l?: Label) => l?.UserLocalizedLabel?.Label || null

async function getJson<T>(base: string, path: string): Promise<T | null> {
  const res = await fetch(`${base}/api/data/v9.2/${path}`, {
    headers: { Accept: "application/json" },
  }).catch(() => null)
  return res?.ok ? ((await res.json()) as T) : null
}

/** A tooltip card for one column of a table. */
export function columnCard(
  clientUrl: string,
  entity: string,
  column: string,
  extra: [string, string][] = []
): Promise<TipCard> {
  const key = `${entity}.${column}`
  let card = cache.get(key)
  if (!card) {
    card = load(clientUrl, entity, column, extra)
    cache.set(key, card)
    // A failed lookup can be retried on the next hover
    card.catch(() => cache.delete(key))
  }
  return card
}

async function load(
  base: string,
  entity: string,
  column: string,
  extra: [string, string][]
): Promise<TipCard> {
  const path = `EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${column}')`
  const a = await getJson<AttributeMetadata>(
    base,
    `${path}?$select=LogicalName,SchemaName,DisplayName,Description,AttributeTypeName,RequiredLevel,IsCustomAttribute,IsManaged,IsPrimaryName,IsPrimaryId,AttributeOf`
  )
  if (!a)
    return {
      title: column,
      rows: [["Table", entity], ...extra],
      description: "Couldn't read this column's metadata.",
      hint: "Click to copy the logical name",
    }

  const type = (a.AttributeTypeName?.Value ?? "").replace(/Type$/, "")
  const rows: [string, string][] = [
    ["Logical name", a.LogicalName],
    ["Schema name", a.SchemaName],
    ["Table", entity],
    ["Type", type || "?"],
  ]

  // A detail or two that depends on the type
  if (type === "String" || type === "Memo") {
    const s = await getJson<{
      MaxLength?: number
      FormatName?: { Value?: string }
    }>(
      base,
      `${path}/Microsoft.Dynamics.CRM.${type}AttributeMetadata?$select=MaxLength${type === "String" ? ",FormatName" : ""}`
    )
    if (s?.MaxLength) rows.push(["Max length", String(s.MaxLength)])
    const format = s?.FormatName?.Value
    if (format && format !== "Text") rows.push(["Format", format])
  } else if (type === "Lookup" || type === "Customer" || type === "Owner") {
    const l = await getJson<{ Targets?: string[] }>(
      base,
      `${path}/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`
    )
    if (l?.Targets?.length) rows.push(["Points to", l.Targets.join(", ")])
  } else if (
    type === "Picklist" ||
    type === "State" ||
    type === "Status" ||
    type === "MultiSelectPicklist"
  ) {
    const cast =
      type === "MultiSelectPicklist"
        ? "MultiSelectPicklist"
        : type === "Picklist"
          ? "Picklist"
          : type
    const o = await getJson<{ OptionSet?: { Options?: unknown[] } }>(
      base,
      `${path}/Microsoft.Dynamics.CRM.${cast}AttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`
    )
    const count = o?.OptionSet?.Options?.length
    if (count) rows.push(["Choices", String(count)])
  }

  rows.push([
    "Required",
    REQUIRED[a.RequiredLevel?.Value ?? ""] ?? a.RequiredLevel?.Value ?? "?",
  ])
  rows.push([
    "Origin",
    a.IsCustomAttribute
      ? a.IsManaged
        ? "Custom (managed)"
        : "Custom (unmanaged)"
      : "System",
  ])
  if (a.IsPrimaryName) rows.push(["Role", "Primary name column"])
  if (a.IsPrimaryId) rows.push(["Role", "Primary key"])
  if (a.AttributeOf) rows.push(["Belongs to", a.AttributeOf])
  rows.push(...extra)

  return {
    title: label(a.DisplayName) ?? a.LogicalName,
    rows,
    description: label(a.Description),
    hint: "Click to copy the logical name",
  }
}

/** A list view's linked-table aliases → table names, from its FetchXML. */
export async function viewAliases(
  base: string,
  viewId: string,
  userView: boolean
): Promise<Map<string, string>> {
  const set = userView ? "userqueries" : "savedqueries"
  const view = await getJson<{ fetchxml?: string }>(
    base,
    `${set}(${viewId})?$select=fetchxml`
  )
  const map = new Map<string, string>()
  if (!view?.fetchxml) return map
  const xml = new DOMParser().parseFromString(view.fetchxml, "text/xml")
  for (const link of xml.querySelectorAll("link-entity[alias]"))
    map.set(link.getAttribute("alias")!, link.getAttribute("name")!)
  return map
}
