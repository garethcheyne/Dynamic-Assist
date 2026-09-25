/**
 * A whole query: table, columns, filters, sort and options. The filters are the
 * fluentui-extended QueryBuilder state; this adds what an ad hoc query needs
 * around them and turns the lot into FetchXML (and back).
 */
import { operatorRequiresValue } from "./lib/operators"
import { parseFetchXmlToState } from "./lib/parser"
import {
  buildFetchAttributes,
  escapeXml,
  prettyPrintXml,
  serializeQueryBuilderState,
} from "./lib/serializer"
import type {
  QueryBuilderCondition,
  QueryBuilderField,
  QueryBuilderState,
} from "./lib/types"

type SortOrder = { attribute: string; descending: boolean }

export type Query = {
  entityName: string
  /** Empty means all columns */
  columns: string[]
  orders: SortOrder[]
  top: number | null
  distinct: boolean
  filters: QueryBuilderState
}

const emptyFilters = (): QueryBuilderState => ({ groups: [] })

export function newQuery(entityName: string): Query {
  return {
    entityName,
    columns: [],
    orders: [],
    // No limit: every row, page by page (run.ts)
    top: null,
    distinct: true,
    filters: emptyFilters(),
  }
}

const isEmpty = (v: QueryBuilderCondition["value"]) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0)

/** A condition still being filled in: its operator needs a value it doesn't have. */
const isIncomplete = (c: QueryBuilderCondition) =>
  c.kind !== "relatedEntity" &&
  operatorRequiresValue(c.operator) &&
  isEmpty(c.value)

/** Filters without half-written conditions (or groups left empty by them). */
function completeFilters(state: QueryBuilderState): QueryBuilderState {
  return {
    ...state,
    groups: state.groups
      .map((g) => ({
        ...g,
        conditions: g.conditions.filter((c) => !isIncomplete(c)),
      }))
      .filter((g) => g.conditions.length > 0),
  }
}

/** The query as pretty-printed FetchXML; unfinished conditions are left out. */
export function toFetchXml(query: Query, fields: QueryBuilderField[]): string {
  // The ported serializer writes filters and link-entities; lift them out of its
  // <entity> and add the columns and order around them
  const serialized = serializeQueryBuilderState(
    completeFilters(query.filters),
    fields,
    query.entityName
  ).fetchXml
  const inner = serialized
    .replace(/^<fetch[^>]*><entity[^>]*>/, "")
    .replace(/<\/entity><\/fetch>$/, "")
    .replace('<filter type="and"></filter>', "")

  const columns =
    query.columns.length === 0
      ? "<all-attributes />"
      : query.columns
          .map((c) => `<attribute name="${escapeXml(c)}" />`)
          .join("")
  const orders = query.orders
    .map(
      (o) =>
        `<order attribute="${escapeXml(o.attribute)}" descending="${o.descending}" />`
    )
    .join("")

  const attributes = buildFetchAttributes({
    top: query.top ?? undefined,
    distinct: query.distinct,
  })
  return prettyPrintXml(
    `<fetch ${attributes}><entity name="${escapeXml(query.entityName)}">${columns}${orders}${inner}</entity></fetch>`
  )
}

export type ParsedQuery = {
  query: Query | null
  error: string | null
  /** Parts the builder can't show (kept only in the FetchXML text) */
  warnings: string[]
}

/** Reads FetchXML back into a query: table, columns, order, top and filters. */
export function fromFetchXml(
  xml: string,
  fields: QueryBuilderField[]
): ParsedQuery {
  const doc = new DOMParser().parseFromString(xml.trim(), "application/xml")
  if (doc.querySelector("parsererror")) {
    return { query: null, error: "That isn't valid XML.", warnings: [] }
  }
  const fetchEl = doc.documentElement
  const entity = fetchEl.querySelector(":scope > entity")
  if (fetchEl.nodeName !== "fetch" || !entity) {
    return {
      query: null,
      error: "Expected <fetch><entity name=…>.",
      warnings: [],
    }
  }

  const direct = (name: string) =>
    [...entity.children].filter((c) => c.nodeName === name)
  const warnings: string[] = []
  if (fetchEl.getAttribute("aggregate") === "true")
    warnings.push("Aggregates run from the FetchXML tab only.")
  if (direct("link-entity").some((l) => l.querySelector("attribute")))
    warnings.push("Columns from linked tables run from the FetchXML tab only.")

  const parsed = parseFetchXmlToState(xml, fields)
  const top = Number(
    fetchEl.getAttribute("top") || fetchEl.getAttribute("count")
  )

  return {
    query: {
      entityName: entity.getAttribute("name") ?? "",
      columns: direct("all-attributes").length
        ? []
        : direct("attribute")
            .map((a) => a.getAttribute("name") ?? "")
            .filter(Boolean),
      orders: direct("order").map((o) => ({
        attribute: o.getAttribute("attribute") ?? "",
        descending: o.getAttribute("descending") === "true",
      })),
      top: Number.isFinite(top) && top > 0 ? top : null,
      distinct: fetchEl.getAttribute("distinct") !== "false",
      filters: parsed.state ?? emptyFilters(),
    },
    // A query without filters is fine: the parser only has something to say
    // when there were filters it couldn't read
    error: entity.querySelector("filter, condition")
      ? (parsed.error ?? null)
      : null,
    warnings,
  }
}

/** Just the table name, before its fields are loaded. */
export function entityOf(xml: string): string | null {
  const doc = new DOMParser().parseFromString(xml.trim(), "application/xml")
  return doc.querySelector("fetch > entity")?.getAttribute("name") ?? null
}
