/**
 * FetchXML's elements, attributes, allowed values and condition operators, as
 * Microsoft Learn documents them:
 * https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/reference/
 * Drives the editor's structural suggestions and checks.
 */

const REF =
  "https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/reference/"

/** What an attribute's value is: a fixed list, or something from metadata. */
export type AttrKind =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "bool" }
  | { kind: "number" }
  | { kind: "table" } // a table's logical name
  | { kind: "column" } // a column of the element's table
  | { kind: "parent-column" } // a column of the parent entity or link-entity
  | { kind: "operator" }
  | { kind: "condition-value" } // depends on the condition's column
  | { kind: "alias" } // a link-entity alias defined in the query
  | { kind: "new-alias" } // a new name
  | { kind: "text" }

export type AttrSpec = {
  name: string
  info: string
  value: AttrKind
  required?: boolean
}

export type ElementSpec = {
  name: string
  info: string
  link: string
  attrs: AttrSpec[]
  children: string[]
  /** Holds a value as text (<value>) */
  text?: boolean
}

const bool: AttrKind = { kind: "bool" }
const num: AttrKind = { kind: "number" }
const text: AttrKind = { kind: "text" }

export const AGGREGATES = [
  "avg",
  "count",
  "countcolumn",
  "max",
  "min",
  "sum",
] as const
export const DATE_GROUPINGS = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
  "fiscal-period",
  "fiscal-year",
] as const
export const LINK_TYPES = [
  "inner",
  "outer",
  "any",
  "not any",
  "all",
  "not all",
  "exists",
  "in",
  "matchfirstrowusingcrossapply",
] as const
/** Link types that filter the parent rather than join: only inside a <filter> */
export const FILTER_LINK_TYPES = ["any", "not any", "all", "not all"]

export const ELEMENTS: Record<string, ElementSpec> = {
  fetch: {
    name: "fetch",
    info: "The root of a query",
    link: `${REF}fetch`,
    children: ["entity"],
    attrs: [
      {
        name: "top",
        info: "Return at most this many rows (up to 5,000); can't be used with page or count",
        value: num,
      },
      { name: "count", info: "Rows per page (up to 5,000)", value: num },
      { name: "page", info: "The page to return, from 1", value: num },
      {
        name: "paging-cookie",
        info: "From the previous page's results",
        value: text,
      },
      {
        name: "aggregate",
        info: "Group and summarise rows (every attribute needs aggregate or groupby)",
        value: bool,
      },
      {
        name: "aggregatelimit",
        info: "A lower limit on the rows an aggregate reads (up to 50,000)",
        value: num,
      },
      { name: "distinct", info: "Leave out duplicate rows", value: bool },
      { name: "no-lock", info: "Legacy; ignored", value: bool },
      {
        name: "latematerialize",
        info: "Fetch linked rows after the main rows; can help queries with many joins",
        value: bool,
      },
      {
        name: "returntotalrecordcount",
        info: "Return the total number of matching rows (up to 5,000)",
        value: bool,
      },
      {
        name: "useraworderby",
        info: "Sort choice columns by value instead of label",
        value: bool,
      },
      {
        name: "datasource",
        info: "retained: query long-term retention data instead of live data",
        value: { kind: "enum", values: ["retained"] },
      },
      {
        name: "options",
        info: "SQL Server query hints, e.g. OptimizeForUnknown, ForceOrder, DisableRowGoal",
        value: text,
      },
      {
        name: "mapping",
        info: "Legacy; always logical",
        value: { kind: "enum", values: ["logical"] },
      },
      { name: "version", info: "Legacy; ignored", value: text },
      { name: "output-format", info: "Legacy; ignored", value: text },
      { name: "utc-offset", info: "Legacy; ignored", value: text },
    ],
  },
  entity: {
    name: "entity",
    info: "The table the query returns rows from; only one per query",
    link: `${REF}entity`,
    children: ["all-attributes", "attribute", "order", "filter", "link-entity"],
    attrs: [
      {
        name: "name",
        info: "The table's logical name",
        value: { kind: "table" },
        required: true,
      },
      {
        name: "enableprefiltering",
        info: "Reports only: let the report be prefiltered",
        value: bool,
      },
      {
        name: "prefilterparametername",
        info: "Reports only: the prefilter parameter",
        value: text,
      },
    ],
  },
  "link-entity": {
    name: "link-entity",
    info: "Joins a related table, to return its columns or filter on them",
    link: `${REF}link-entity`,
    children: ["all-attributes", "attribute", "order", "filter", "link-entity"],
    attrs: [
      {
        name: "name",
        info: "The related table's logical name",
        value: { kind: "table" },
        required: true,
      },
      {
        name: "from",
        info: "The column on this (related) table to match",
        value: { kind: "column" },
      },
      {
        name: "to",
        info: "The column on the parent table to match",
        value: { kind: "parent-column" },
      },
      {
        name: "alias",
        info: "A name for this table in results and conditions",
        value: { kind: "new-alias" },
      },
      {
        name: "link-type",
        info: "inner (default) or outer to join; any, not any, all, not all only inside a filter",
        value: { kind: "enum", values: LINK_TYPES },
      },
      {
        name: "intersect",
        info: "Marks a many-to-many intersect table; no effect on results",
        value: bool,
      },
      { name: "visible", info: "Legacy; ignored", value: bool },
      { name: "enableprefiltering", info: "Reports only", value: bool },
      { name: "prefilterparametername", info: "Reports only", value: text },
    ],
  },
  attribute: {
    name: "attribute",
    info: "A column to return",
    link: `${REF}attribute`,
    children: [],
    attrs: [
      {
        name: "name",
        info: "The column's logical name",
        value: { kind: "column" },
        required: true,
      },
      {
        name: "alias",
        info: "A name for the column in the results; required for aggregates",
        value: { kind: "new-alias" },
      },
      {
        name: "aggregate",
        info: "Aggregate queries: how to summarise the column",
        value: { kind: "enum", values: AGGREGATES },
      },
      {
        name: "groupby",
        info: "Aggregate queries: group by this column",
        value: bool,
      },
      {
        name: "dategrouping",
        info: "Aggregate queries: group dates by this period",
        value: { kind: "enum", values: DATE_GROUPINGS },
      },
      {
        name: "distinct",
        info: "Aggregate countcolumn: count distinct values only",
        value: bool,
      },
      {
        name: "usertimezone",
        info: "Aggregate date grouping: use the user's time zone (default) or UTC",
        value: bool,
      },
      {
        name: "rowaggregate",
        info: "CountChildren: count child rows in a hierarchy",
        value: { kind: "enum", values: ["CountChildren"] },
      },
      { name: "added", info: "Legacy; ignored", value: text },
      { name: "build", info: "Legacy; ignored", value: text },
    ],
  },
  "all-attributes": {
    name: "all-attributes",
    info: "Every column (not recommended: slow and wide)",
    link: `${REF}all-attributes`,
    children: [],
    attrs: [],
  },
  order: {
    name: "order",
    info: "Sorts the rows",
    link: `${REF}order`,
    children: [],
    attrs: [
      {
        name: "attribute",
        info: "The column to sort by (not in aggregate queries: use alias)",
        value: { kind: "column" },
      },
      {
        name: "alias",
        info: "Aggregate queries: the alias of the column to sort by",
        value: { kind: "text" },
      },
      { name: "descending", info: "Sort from highest to lowest", value: bool },
      {
        name: "entityname",
        info: "Sort by a linked table's column: its link-entity alias",
        value: { kind: "alias" },
      },
    ],
  },
  filter: {
    name: "filter",
    info: "Conditions rows must meet, combined with and (default) or or",
    link: `${REF}filter`,
    children: ["condition", "filter", "link-entity"],
    attrs: [
      {
        name: "type",
        info: "and (default): every condition; or: any condition",
        value: { kind: "enum", values: ["and", "or"] },
      },
      {
        name: "hint",
        info: "union: may help an or filter across tables run faster",
        value: { kind: "enum", values: ["union"] },
      },
      { name: "isquickfindfields", info: "Quick find views only", value: bool },
      {
        name: "overridequickfindrecordlimitenabled",
        info: "Quick find views only",
        value: bool,
      },
      {
        name: "overridequickfindrecordlimitdisabled",
        info: "Quick find views only",
        value: bool,
      },
    ],
  },
  condition: {
    name: "condition",
    info: "One test a column's value must pass",
    link: `${REF}condition`,
    children: ["value"],
    attrs: [
      {
        name: "attribute",
        info: "The column to test",
        value: { kind: "column" },
        required: true,
      },
      {
        name: "operator",
        info: "How to test it",
        value: { kind: "operator" },
        required: true,
      },
      {
        name: "value",
        info: "The value to test against (use <value> elements for several)",
        value: { kind: "condition-value" },
      },
      {
        name: "valueof",
        info: "Compare with another column instead of a value",
        value: { kind: "column" },
      },
      {
        name: "entityname",
        info: "Test a linked table's column: its link-entity alias",
        value: { kind: "alias" },
      },
      {
        name: "uiname",
        info: "Display name of a lookup value, for views",
        value: text,
      },
      {
        name: "uitype",
        info: "Table of a lookup value, for views",
        value: { kind: "table" },
      },
      { name: "uihidden", info: "Hide the condition in views", value: bool },
    ],
  },
  value: {
    name: "value",
    info: "One of several values for in, between and similar operators",
    link: `${REF}value`,
    children: [],
    attrs: [
      {
        name: "uiname",
        info: "Display name of a lookup value, for views",
        value: text,
      },
      {
        name: "uitype",
        info: "Table of a lookup value, for views",
        value: { kind: "table" },
      },
    ],
    text: true,
  },
}

/** Which kinds of column an operator applies to (Microsoft Learn's grouping). */
export type OperatorType =
  "choice" | "datetime" | "hierarchy" | "number" | "owner" | "string" | "id"

/** How many values an operator takes: none, one (value=), two or many (<value>) */
export type OperatorValues = 0 | 1 | 2 | "many"

export type OperatorSpec = {
  name: string
  info: string
  types: OperatorType[]
  values: OperatorValues
}

const op = (
  name: string,
  info: string,
  types: OperatorType[],
  values: OperatorValues
): OperatorSpec => ({ name, info, types, values })

const ALL_TYPES: OperatorType[] = [
  "choice",
  "datetime",
  "hierarchy",
  "number",
  "owner",
  "string",
  "id",
]
const DT: OperatorType[] = ["datetime"]

export const OPERATORS: OperatorSpec[] = [
  op("eq", "Equals", ALL_TYPES, 1),
  op("ne", "Doesn't equal", ALL_TYPES, 1),
  op("gt", "Greater than", ["number", "datetime", "string"], 1),
  op("ge", "Greater than or equal", ["number", "datetime", "string"], 1),
  op("lt", "Less than", ["number", "datetime", "string"], 1),
  op("le", "Less than or equal", ["number", "datetime", "string"], 1),
  op("null", "Has no value", ALL_TYPES, 0),
  op("not-null", "Has a value", ALL_TYPES, 0),
  op("like", "Matches a pattern (% and _ wildcards)", ["string"], 1),
  op("not-like", "Doesn't match a pattern", ["string"], 1),
  op("begins-with", "Starts with", ["string"], 1),
  op("not-begin-with", "Doesn't start with", ["string"], 1),
  op("ends-with", "Ends with", ["string"], 1),
  op("not-end-with", "Doesn't end with", ["string"], 1),
  op(
    "in",
    "Is one of the values",
    ["choice", "number", "owner", "string", "id"],
    "many"
  ),
  op(
    "not-in",
    "Is none of the values",
    ["number", "choice", "string", "id"],
    "many"
  ),
  op("between", "Between two values", ["number", "datetime"], 2),
  op("not-between", "Not between two values", ["number", "datetime"], 2),
  op(
    "contain-values",
    "Multi-select choice has any of the values",
    ["choice"],
    "many"
  ),
  op(
    "not-contain-values",
    "Multi-select choice has none of the values",
    ["choice"],
    "many"
  ),
  op("on", "On the date", DT, 1),
  op("on-or-after", "On or after the date", DT, 1),
  op("on-or-before", "On or before the date", DT, 1),
  op("today", "Today", DT, 0),
  op("yesterday", "Yesterday", DT, 0),
  op("tomorrow", "Tomorrow", DT, 0),
  op("this-week", "This week", DT, 0),
  op("last-week", "Last week", DT, 0),
  op("next-week", "Next week", DT, 0),
  op("this-month", "This month", DT, 0),
  op("last-month", "Last month", DT, 0),
  op("next-month", "Next month", DT, 0),
  op("this-year", "This year", DT, 0),
  op("last-year", "Last year", DT, 0),
  op("next-year", "Next year", DT, 0),
  op("last-seven-days", "The last seven days, including today", DT, 0),
  op("next-seven-days", "The next seven days", DT, 0),
  op("last-x-hours", "The last X hours", DT, 1),
  op("next-x-hours", "The next X hours", DT, 1),
  op("last-x-days", "The last X days", DT, 1),
  op("next-x-days", "The next X days", DT, 1),
  op("last-x-weeks", "The last X weeks", DT, 1),
  op("next-x-weeks", "The next X weeks", DT, 1),
  op("last-x-months", "The last X months", DT, 1),
  op("next-x-months", "The next X months", DT, 1),
  op("last-x-years", "The last X years", DT, 1),
  op("next-x-years", "The next X years", DT, 1),
  op("olderthan-x-minutes", "Older than X minutes", DT, 1),
  op("olderthan-x-hours", "Older than X hours", DT, 1),
  op("olderthan-x-days", "Older than X days", DT, 1),
  op("olderthan-x-weeks", "Older than X weeks", DT, 1),
  op("olderthan-x-months", "Older than X months", DT, 1),
  op("olderthan-x-years", "Older than X years", DT, 1),
  op("this-fiscal-year", "This fiscal year", DT, 0),
  op("this-fiscal-period", "This fiscal period", DT, 0),
  op("last-fiscal-year", "Last fiscal year", DT, 0),
  op("last-fiscal-period", "Last fiscal period", DT, 0),
  op("next-fiscal-year", "Next fiscal year", DT, 0),
  op("next-fiscal-period", "Next fiscal period", DT, 0),
  op("last-x-fiscal-years", "The last X fiscal years", DT, 1),
  op("last-x-fiscal-periods", "The last X fiscal periods", DT, 1),
  op("next-x-fiscal-years", "The next X fiscal years", DT, 1),
  op("next-x-fiscal-periods", "The next X fiscal periods", DT, 1),
  op("in-fiscal-year", "In the fiscal year", DT, 1),
  op("in-fiscal-period", "In the fiscal period (any year)", DT, 1),
  op("in-fiscal-period-and-year", "In the fiscal period and year", DT, 2),
  op(
    "in-or-before-fiscal-period-and-year",
    "In or before the fiscal period and year",
    DT,
    2
  ),
  op(
    "in-or-after-fiscal-period-and-year",
    "In or after the fiscal period and year",
    DT,
    2
  ),
  op("eq-userid", "Is the current user", ["id", "owner"], 0),
  op("ne-userid", "Isn't the current user", ["id", "owner"], 0),
  op("eq-userteams", "Owned by the current user's teams", ["owner"], 0),
  op(
    "eq-useroruserteams",
    "Owned by the current user or their teams",
    ["owner"],
    0
  ),
  op(
    "eq-useroruserhierarchy",
    "The current user or their reporting hierarchy",
    ["hierarchy"],
    0
  ),
  op(
    "eq-useroruserhierarchyandteams",
    "The current user, their hierarchy and teams",
    ["hierarchy"],
    0
  ),
  op("eq-businessid", "Is the current user's business unit", ["id"], 0),
  op("ne-businessid", "Isn't the current user's business unit", ["id"], 0),
  op("eq-userlanguage", "Is the current user's language", ["number"], 0),
  op("above", "Above the record in its hierarchy", ["hierarchy"], 1),
  op(
    "eq-or-above",
    "The record or above it in its hierarchy",
    ["hierarchy"],
    1
  ),
  op("under", "Under the record in its hierarchy", ["hierarchy"], 1),
  op(
    "eq-or-under",
    "The record or under it in its hierarchy",
    ["hierarchy"],
    1
  ),
  op("not-under", "Not under the record in its hierarchy", ["hierarchy"], 1),
]

export const OPERATOR = new Map(OPERATORS.map((o) => [o.name, o]))
/** Deprecated spellings Dataverse still accepts */
export const LEGACY_OPERATORS: Record<string, string> = { neq: "ne" }

export const DOCS = {
  aggregate:
    "https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/aggregate-data",
  aggregateOrder:
    "https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/aggregate-data#order-by",
  filterLinks:
    "https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/filter-rows#filter-on-values-in-related-records",
  linkOrder:
    "https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/order-rows#process-link-entity-orders-first",
  retained:
    "https://learn.microsoft.com/power-apps/maker/data-platform/data-retention-view#limitations-for-retrieval-of-retained-data",
  paging:
    "https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/page-results",
  operators: `${REF}operators`,
  wildcards:
    "https://learn.microsoft.com/power-apps/developer/data-platform/wildcard-characters",
  antipatterns:
    "https://learn.microsoft.com/power-apps/developer/data-platform/query-antipatterns",
}
