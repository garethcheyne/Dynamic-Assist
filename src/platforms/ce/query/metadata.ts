/**
 * Table and column metadata for the query builder, read with the page's own
 * session (this runs as a content script on the org, so relative /api URLs and
 * cookies just work). Adapted from fluentui-extended's QueryBuilder loader.
 */
import { enrichOptionsetFields } from "./lib/enrichment"
import type { QueryBuilderField } from "./lib/types"
import {
  attributeTypeFromAttribute,
  buildFieldOptions,
  dataTypeFromAttribute,
} from "./lib/utils"

const API = "/api/data/v9.2/"
const HEADERS = {
  Accept: "application/json",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
}

/* eslint-disable @typescript-eslint/no-explicit-any -- raw OData metadata */

export async function getJson(path: string): Promise<any> {
  const res = await fetch(API + path, { headers: HEADERS })
  if (!res.ok) {
    let message = `Web API ${res.status}`
    try {
      message = (await res.json())?.error?.message ?? message
    } catch {
      // Not JSON: keep the status
    }
    throw new Error(message)
  }
  return res.json()
}

export type TableInfo = {
  logicalName: string
  displayName: string
  entitySetName: string
  primaryIdAttribute: string
  primaryNameAttribute: string | null
}

const label = (d: any, fallback: string) =>
  d?.UserLocalizedLabel?.Label ?? fallback

let tables: Promise<TableInfo[]> | null = null

/** Every table you can query, by display name. Cached for the page's life. */
export function loadTables(): Promise<TableInfo[]> {
  tables ??= getJson(
    "EntityDefinitions?$select=LogicalName,DisplayName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute&$filter=IsIntersect eq false"
  )
    .then((r) =>
      (r.value as any[])
        .filter((e) => e.EntitySetName)
        .map((e): TableInfo => ({
          logicalName: e.LogicalName,
          displayName: label(e.DisplayName, e.LogicalName),
          entitySetName: e.EntitySetName,
          primaryIdAttribute: e.PrimaryIdAttribute,
          primaryNameAttribute: e.PrimaryNameAttribute ?? null,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
    )
    .catch((error) => {
      tables = null
      throw error
    })
  return tables
}

const fieldCache = new Map<string, Promise<QueryBuilderField[]>>()

/** A table's columns as query builder fields: types, options and lookup targets. */
export function loadFields(entityName: string): Promise<QueryBuilderField[]> {
  let cached = fieldCache.get(entityName)
  if (!cached) {
    cached = fetchFields(entityName).catch((error) => {
      fieldCache.delete(entityName)
      throw error
    })
    fieldCache.set(entityName, cached)
  }
  return cached
}

async function fetchFields(entityName: string): Promise<QueryBuilderField[]> {
  const base = `EntityDefinitions(LogicalName='${entityName}')/Attributes`
  const [attributes, lookups, all] = await Promise.all([
    getJson(
      `${base}?$select=LogicalName,SchemaName,DisplayName,AttributeType,AttributeTypeName,IsValidForAdvancedFind,AttributeOf`
    ),
    getJson(
      `${base}/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,Targets`
    ).catch(() => ({ value: [] })),
    loadTables().catch(() => [] as TableInfo[]),
  ])

  const targetsOf = new Map<string, string[]>(
    (lookups.value as any[]).map((l) => [l.LogicalName, l.Targets ?? []])
  )
  const tableOf = new Map(all.map((t) => [t.logicalName, t]))

  const fields: (QueryBuilderField & { _raw?: any })[] = (
    attributes.value as any[]
  )
    // Name/yomi shadow columns (AttributeOf) and non-queryable ones are noise
    .filter(
      (a) =>
        a.LogicalName &&
        !a.AttributeOf &&
        a.IsValidForAdvancedFind?.Value !== false &&
        a.IsValidForAdvancedFind !== false
    )
    .map((a) => {
      const raw = { ...a, Targets: targetsOf.get(a.LogicalName) }
      const dataType = dataTypeFromAttribute(raw)
      return {
        id: a.LogicalName,
        label: label(a.DisplayName, a.SchemaName ?? a.LogicalName),
        schemaName: a.SchemaName,
        dataType,
        attributeType: attributeTypeFromAttribute(raw),
        options: buildFieldOptions(raw, dataType),
        targets:
          dataType === "lookup"
            ? (raw.Targets ?? []).map((t: string) => {
                const table = tableOf.get(t)
                return {
                  entityLogicalName: t,
                  entitySetName: table?.entitySetName,
                  displayName: table?.displayName,
                  primaryNameAttribute:
                    table?.primaryNameAttribute ?? undefined,
                  primaryIdAttribute: table?.primaryIdAttribute,
                }
              })
            : undefined,
        _raw: raw,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  // Choices and Yes/No labels come from a separate cast per attribute type
  return enrichOptionsetFields(fields, entityName)
}
