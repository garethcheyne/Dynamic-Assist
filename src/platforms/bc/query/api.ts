/**
 * The query as REST requests: against an API page that's already installed
 * for the table, or against a custom API query (an AL `query` object of type
 * API, generated here, that someone adds to their own extension).
 *
 * Filters go into the URL as $filter where OData can say the same thing; in
 * the custom query the rest are set with SetFilter in OnBeforeOpen, which
 * takes Business Central's filter text as it is, so it returns the same rows
 * as the query builder. Joins become nested data items (DataItemLink).
 */
import { describeJoins, ident, literal, type RelatedTables } from "./al"
import { alName, type BcField, type BcQuery, type BcTable } from "./bridge"
import { toODataFilter } from "./odata"

export type { RelatedTables } from "./al"

const API_PUBLISHER = "dynamicAssist"
const API_GROUP = "queries"
const API_VERSION = "v1.0"

/** Field types a query column can't hold */
const NOT_A_COLUMN = new Set(["BLOB", "Media", "MediaSet"])

export type ApiContext = {
  tenant: string | null
  environment: string | null
  companyId: string | null
}

/** API names are camelCase letters and digits: "Balance (LCY)" → balanceLCY */
export function camel(name: string) {
  const words = alName(name)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  const joined = words
    .map((w, i) =>
      i === 0
        ? w === w.toUpperCase() && w.length > 1
          ? w.toLowerCase()
          : w[0].toLowerCase() + w.slice(1)
        : w[0].toUpperCase() + w.slice(1)
    )
    .join("")
  return /^[A-Za-z]/.test(joined) ? joined : `f${joined}`
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

function plural(word: string) {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`
  return `${word}s`
}

const apiBase = (ctx: ApiContext) =>
  `https://api.businesscentral.dynamics.com/v2.0/${ctx.tenant ?? "{tenantId}"}/${ctx.environment ?? "{environment}"}`

function withOptions(
  endpoint: string,
  options: [string, string][],
  encode: (v: string) => string
) {
  return options.length
    ? `${endpoint}?${options.map(([k, v]) => `${k}=${encode(v)}`).join("&")}`
    : endpoint
}

/** $select, $filter and $top, leaving out empty ones */
function queryOptions(select: string[], filters: string[], top: number | null) {
  return (
    [
      ["$select", select.join(",")],
      [
        "$filter",
        filters.length > 1
          ? filters.map((f) => `(${f})`).join(" and ")
          : (filters[0] ?? ""),
      ],
      ["$top", top ? String(top) : ""],
    ] as [string, string][]
  ).filter(([, v]) => v)
}

/** Several filters on one field must all hold */
const combine = (texts: string[]) =>
  texts.length === 1 ? texts[0] : texts.map((t) => `(${t})`).join("&")

function groupFilters(filters: { field: number; filter: string }[]) {
  const byField = new Map<number, string[]>()
  for (const f of filters) {
    const text = (f.filter ?? "").trim()
    if (text) byField.set(f.field, [...(byField.get(f.field) ?? []), text])
  }
  return byField
}

export function toApiQuery(
  query: BcQuery,
  table: BcTable,
  fields: BcField[],
  ctx: ApiContext,
  related: RelatedTables = {}
) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const entityName = camel(table.name)
  const entitySetName = plural(entityName)
  const used = new Set<string>([entityName])
  const uniqueName = (base: string) => {
    let name = base
    for (let i = 2; used.has(name); i++) name = `${base}${i}`
    used.add(name)
    return name
  }
  const canBeColumn = (f: BcField) =>
    f.class !== "FlowFilter" && !NOT_A_COLUMN.has(f.type)

  /** What goes into one data item: its columns, filter elements and filters */
  type Item = {
    columns: { field: BcField; name: string }[]
    filterElements: { field: BcField; name: string }[]
  }
  const select: string[] = []
  const odataFilters: string[] = []
  const setFilters: string[] = []
  /** Filters OData can't express, kept in the query object */
  const inQuery: string[] = []
  const skipped: string[] = []

  /**
   * Builds a data item's columns (the picked fields, plus sort and filter
   * fields, since $filter only works on columns) and routes its filters.
   */
  function buildItem(
    picked: number[],
    extra: number[],
    filters: { field: number; filter: string }[],
    itemFields: Map<number, BcField>,
    prefix: string,
    label: string
  ): Item {
    const item: Item = { columns: [], filterElements: [] }
    const columnName = new Map<number, string>()
    const filtered = filters
      .filter((f) => (f.filter ?? "").trim())
      .map((f) => f.field)
    for (const no of new Set([...picked, ...extra, ...filtered])) {
      const f = itemFields.get(no)
      if (!f) continue
      if (!canBeColumn(f)) {
        if (picked.includes(no)) skipped.push(`${label}${f.name}`)
        continue
      }
      const name = uniqueName(
        prefix ? `${prefix}${capital(camel(f.name))}` : camel(f.name)
      )
      item.columns.push({ field: f, name })
      columnName.set(no, name)
      if (picked.includes(no)) select.push(name)
    }
    for (const [no, texts] of groupFilters(filters)) {
      const field = itemFields.get(no)
      if (!field) continue
      const column = columnName.get(no)
      const odata = column
        ? texts.map((t) => toODataFilter(field, column, t))
        : []
      if (column && odata.every(Boolean)) {
        odataFilters.push(...(odata as string[]))
        continue
      }
      let name = column
      if (!name) {
        name = uniqueName(
          `${prefix ? `${prefix}${capital(camel(field.name))}` : camel(field.name)}Filter`
        )
        item.filterElements.push({ field, name })
      }
      setFilters.push(
        `        CurrQuery.SetFilter(${name}, ${literal(combine(texts))});`
      )
      inQuery.push(`${label}${field.name}: ${combine(texts)}`)
    }
    return item
  }

  const picked = query.fields.length
    ? query.fields
    : fields.filter((f) => f.pk).map((f) => f.no)
  const main = buildItem(picked, query.sort, query.filters, byNo, "", "")
  const mainColumn = new Map(main.columns.map((c) => [c.field.no, c.name]))

  const joins = describeJoins(query, fields, related).map((j) => {
    const alias = uniqueName(camel(j.table.name))
    const item = buildItem(
      j.join.fields,
      [],
      j.join.filters,
      new Map(j.table.fields.map((f) => [f.no, f])),
      alias,
      `${j.table.name}.`
    )
    return { ...j, alias, item }
  })

  const direction = query.descending ? "descending" : "ascending"
  const order = query.sort
    .map((no) => mainColumn.get(no))
    .filter(Boolean)
    .map((c) => `${direction}(${c})`)

  const lines = [
    "// Add to your own extension, choose an ID in its range and publish it.",
    `query 50100 ${ident(`DA ${table.name} API`.slice(0, 30))}`,
    "{",
    "    QueryType = API;",
    `    APIPublisher = '${API_PUBLISHER}';`,
    `    APIGroup = '${API_GROUP}';`,
    `    APIVersion = '${API_VERSION}';`,
    `    EntityName = '${entityName}';`,
    `    EntitySetName = '${entitySetName}';`,
    "    DataAccessIntent = ReadOnly;",
  ]
  if (order.length) lines.push(`    OrderBy = ${order.join(", ")};`)
  lines.push("", "    elements", "    {")

  const pad = (depth: number) => "    ".repeat(depth)
  const writeItem = (item: Item, depth: number) => {
    for (const c of item.columns)
      lines.push(
        `${pad(depth)}column(${c.name}; ${ident(c.field.name)})`,
        `${pad(depth)}{`,
        `${pad(depth)}}`
      )
    for (const f of item.filterElements)
      lines.push(
        `${pad(depth)}filter(${f.name}; ${ident(f.field.name)})`,
        `${pad(depth)}{`,
        `${pad(depth)}}`
      )
  }
  // A query's data items form a chain: each join nests in the one before,
  // and links back to the main table's lookup field
  lines.push(
    `${pad(2)}dataitem(${entityName}; ${ident(table.name)})`,
    `${pad(2)}{`
  )
  writeItem(main, 3)
  joins.forEach((j, i) => {
    const d = 3 + i
    const restricts = j.join.inner || j.filters.length > 0
    lines.push(
      `${pad(d)}dataitem(${j.alias}; ${ident(j.table.name)})`,
      `${pad(d)}{`,
      `${pad(d + 1)}DataItemLink = ${ident(j.key.name)} = ${entityName}.${ident(j.from.name)};`,
      `${pad(d + 1)}SqlJoinType = ${restricts ? "InnerJoin" : "LeftOuterJoin"};`
    )
    writeItem(j.item, d + 1)
  })
  for (let i = joins.length - 1; i >= 0; i--) lines.push(`${pad(3 + i)}}`)
  lines.push(`${pad(2)}}`, "    }")
  if (setFilters.length)
    lines.push(
      "",
      "    trigger OnBeforeOpen()",
      "    begin",
      ...setFilters,
      "    end;"
    )
  lines.push("}")
  if (skipped.length)
    lines.push(
      "",
      `// Left out (a query can't return them): ${skipped.join(", ")}`
    )

  const base = apiBase(ctx)
  const endpoint =
    `${base}/api/${API_PUBLISHER}/${API_GROUP}/${API_VERSION}` +
    `/companies(${ctx.companyId ?? "{companyId}"})/${entitySetName}`
  const options = queryOptions(select, odataFilters, query.top)

  return {
    al: lines.join("\n"),
    url: withOptions(endpoint, options, (v) => v),
    encodedUrl: withOptions(endpoint, options, encodeURIComponent),
    endpoint,
    options,
    inQuery,
    /** Where to look up the company's ID when the companion didn't send it */
    companiesUrl: ctx.companyId ? null : `${base}/api/v2.0/companies`,
    entitySetName,
  }
}

/** An API page already installed for the table (companion 2026.9.24.2+) */
export type BcApi = {
  page: number
  name: string
  publisher: string
  group: string
  version: string
  entityName: string
  entitySetName: string
  /** The page's SourceTableView: it only returns rows that match it */
  view: string
  fields: { no: number; name: string }[]
}

/** One way to run the query over REST: an installed API, or the custom query */
export type RequestPlan = {
  key: string
  kind: "standard" | "companion" | "custom"
  /** GET unless said otherwise */
  method?: "GET" | "POST"
  /** POST body, as sent */
  body?: string
  /** The companion endpoint's request object, for showing */
  request?: Record<string, unknown>
  /** "Microsoft customers v2.0", "Custom API query" */
  label: string
  url: string
  encodedUrl: string
  options: [string, string][]
  /** Picked fields the API doesn't have (left out of $select) */
  missing: string[]
  /** Filters it can't apply ("Name: A*B"); a standard API with any can't be used as is */
  unfiltered: string[]
  /** The API's own filter on the table */
  view: string | null
  /** Runs the query as built, without deploying anything */
  ready: boolean
  /** Only for the custom plan: filters its AL object applies itself */
  inQuery?: string[]
}

const latestVersion = (versions: string) =>
  versions
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .pop() ?? "v1.0"

/** Microsoft's standard APIs live at /api/v2.0; everyone else's at /api/publisher/group/version */
function apiPath(api: BcApi, version: string) {
  const standard =
    !api.publisher || (api.publisher === "microsoft" && api.group === "api")
  return standard
    ? `/api/${version}`
    : `/api/${api.publisher}/${api.group}/${version}`
}

/**
 * The query against an installed API page, with its field names. An API page
 * returns one table, so joined columns and filters count as missing.
 */
export function standardRequest(
  query: BcQuery,
  fields: BcField[],
  api: BcApi,
  ctx: ApiContext,
  related: RelatedTables = {}
): RequestPlan {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const nameOf = new Map(api.fields.map((f) => [f.no, f.name]))
  const picked = query.fields.length
    ? query.fields
    : fields.filter((f) => f.pk).map((f) => f.no)
  const missing = picked
    .filter((no) => !nameOf.has(no))
    .map((no) => byNo.get(no)?.name ?? String(no))

  const unfiltered: string[] = []
  const filters: string[] = []
  for (const f of query.filters) {
    const text = (f.filter ?? "").trim()
    const field = byNo.get(f.field)
    if (!text || !field) continue
    const name = nameOf.get(f.field)
    const odata = name ? toODataFilter(field, name, text) : null
    if (odata) filters.push(odata)
    else unfiltered.push(`${field.name}: ${text}`)
  }
  for (const j of describeJoins(query, fields, related)) {
    missing.push(...j.columns.map((c) => `${j.table.name}.${c.name}`))
    unfiltered.push(
      ...j.filters.map((f) => `${j.table.name}.${f.field.name}: ${f.filter}`)
    )
    if (j.join.inner && !j.filters.length)
      unfiltered.push(`only rows with a ${j.table.name}`)
  }

  const version = latestVersion(api.version)
  const endpoint = `${apiBase(ctx)}${apiPath(api, version)}/companies(${ctx.companyId ?? "{companyId}"})/${api.entitySetName}`
  const options = queryOptions(
    picked.map((no) => nameOf.get(no)).filter(Boolean) as string[],
    filters,
    query.top
  )

  // "Microsoft customers v2.0" for the standard APIs; publisher/group for
  // the rest ("microsoft/analytics customers v1.0", "contoso/crm …")
  const standard =
    !api.publisher || (api.publisher === "microsoft" && api.group === "api")
  const owner = standard ? "Microsoft" : `${api.publisher}/${api.group}`
  return {
    key: `page:${api.page}`,
    kind: "standard",
    label: `${owner} ${api.entitySetName} ${version}`,
    url: withOptions(endpoint, options, (v) => v),
    encodedUrl: withOptions(endpoint, options, encodeURIComponent),
    options,
    missing,
    unfiltered,
    view: api.view.trim() || null,
    ready: !missing.length && !unfiltered.length && !api.view.trim(),
  }
}

/**
 * Every way to run the query over REST, best first: installed APIs that cover
 * it exactly (Microsoft's first, newest version), then the companion's
 * endpoint (any query, one request), then the other APIs, then the custom API
 * query, which always works once deployed.
 */
export function requestPlans(
  query: BcQuery,
  table: BcTable,
  fields: BcField[],
  apis: BcApi[],
  ctx: ApiContext,
  related: RelatedTables = {},
  company: string | null = null
): RequestPlan[] {
  const custom = toApiQuery(query, table, fields, ctx, related)
  const standard = apis
    .filter((a) => a.entitySetName && a.fields.length)
    .map((a) => standardRequest(query, fields, a, ctx, related))
    .sort(
      (a, b) =>
        Number(b.ready) - Number(a.ready) ||
        a.unfiltered.length - b.unfiltered.length ||
        a.missing.length - b.missing.length ||
        Number(b.label.startsWith("Microsoft")) -
          Number(a.label.startsWith("Microsoft")) ||
        b.label.localeCompare(a.label, undefined, { numeric: true })
    )
  return [
    ...standard.filter((p) => p.ready),
    ...[companionGetRequest(query, table, fields, ctx, related)].filter(
      (p): p is RequestPlan => p !== null
    ),
    companionRequest(query, table, fields, ctx, company, related),
    ...standard.filter((p) => !p.ready),
    {
      key: "custom",
      kind: "custom",
      label: "Custom API query",
      url: custom.url,
      encodedUrl: custom.encodedUrl,
      options: custom.options,
      missing: [],
      unfiltered: [],
      view: null,
      ready: false,
      inQuery: custom.inQuery,
    },
  ]
}

/** The companion's query web service (bc-companion/src/DAQueryApi.Codeunit.al) */
const COMPANION_SERVICE = "DAQuery"

/**
 * The query as a request object for the companion's web service, with tables
 * and fields by name, so people can read and edit it.
 */
export function companionQuery(
  query: BcQuery,
  table: BcTable,
  fields: BcField[],
  related: RelatedTables = {}
) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const nameOf = (no: number) => alName(byNo.get(no)?.name ?? String(no))
  const filters = (
    list: { field: number; filter: string }[],
    of: (no: number) => string
  ) =>
    list
      .filter((f) => (f.filter ?? "").trim())
      .map((f) => ({ field: of(f.field), filter: (f.filter ?? "").trim() }))
  const request: Record<string, unknown> = {
    table: table.name,
    fields: query.fields.map(nameOf),
  }
  const main = filters(query.filters, nameOf)
  if (main.length) request.filters = main
  if (query.sort.length) request.sort = query.sort.map(nameOf)
  if (query.descending) request.descending = true
  if (query.top) request.top = query.top
  const joins = describeJoins(query, fields, related).map((j) => {
    const relatedName = (no: number) =>
      alName(j.table.fields.find((f) => f.no === no)?.name ?? String(no))
    const join: Record<string, unknown> = {
      field: alName(j.from.name),
      table: j.table.name,
      key: alName(j.key.name),
      fields: j.join.fields.map(relatedName),
    }
    const jf = filters(j.join.filters, relatedName)
    if (jf.length) join.filters = jf
    if (j.join.inner) join.inner = true
    return join
  })
  if (joins.length) request.joins = joins
  return request
}

/** The query through the companion's web service: one POST, any table, exact. */
export function companionRequest(
  query: BcQuery,
  table: BcTable,
  fields: BcField[],
  ctx: ApiContext,
  company: string | null,
  related: RelatedTables = {}
): RequestPlan {
  const request = companionQuery(query, table, fields, related)
  const endpoint = `${apiBase(ctx)}/ODataV4/${COMPANION_SERVICE}_Run`
  const url = `${endpoint}?company=${company ?? "{company}"}`
  return {
    key: "companion",
    kind: "companion",
    label: "Dynamic Assist POST",
    method: "POST",
    url,
    encodedUrl: `${endpoint}?company=${company ? encodeURIComponent(company) : "{company}"}`,
    options: [],
    request,
    body: JSON.stringify({ request: JSON.stringify(request) }),
    missing: [],
    unfiltered: [],
    view: null,
    ready: false,
  }
}

/** The companion's GET endpoint (page "DA Query Rows API") */
const COMPANION_GET_PATH = "/api/err403/dynamicAssist/v1.0"
/** The request filter is a Text[2048] field */
const COMPANION_GET_MAX = 2048

/**
 * The query through the companion's API page, as a GET: the query goes in
 * $filter=request eq '…', one entity comes back per row. Null when the query
 * is too long for the request field (use POST then).
 */
export function companionGetRequest(
  query: BcQuery,
  table: BcTable,
  fields: BcField[],
  ctx: ApiContext,
  related: RelatedTables = {}
): RequestPlan | null {
  const request = companionQuery(query, table, fields, related)
  const json = JSON.stringify(request)
  if (json.length > COMPANION_GET_MAX) return null
  const endpoint = `${apiBase(ctx)}${COMPANION_GET_PATH}/companies(${ctx.companyId ?? "{companyId}"})/queryRows`
  const options: [string, string][] = [
    ["$filter", `request eq '${json.replace(/'/g, "''")}'`],
    ["$select", "rowNo,data"],
  ]
  return {
    key: "companion-get",
    kind: "companion",
    label: "Dynamic Assist GET",
    method: "GET",
    url: withOptions(endpoint, options, (v) => v),
    encodedUrl: withOptions(endpoint, options, encodeURIComponent),
    options,
    request,
    missing: [],
    unfiltered: [],
    view: null,
    ready: false,
  }
}
