/**
 * FetchXML suggestions at the cursor: elements that fit where you are,
 * attributes of the element you're in, and values from the org's metadata
 * (tables, the right table's columns, operators for the column's type,
 * choice values, aliases). Pure: the editor turns these into completions.
 */
import { attr, readXml, type XmlElement } from "@/lib/xml-tree"

import {
  ELEMENTS,
  OPERATOR,
  OPERATORS,
  type AttrSpec,
  type OperatorSpec,
} from "./fetch-schema"
import { aliasesOf, columnTableOf, parentTableOf, tableOf } from "./fetch-scope"
import { findField, operatorTypesOf, typeLabel, type EditorMeta } from "./meta"

export type Suggestion = {
  label: string
  /** Short, shown after the label */
  detail?: string
  /** Longer, shown beside the list */
  info?: string
  /** Text to insert instead of the label */
  apply?: string
  /** Insert as a snippet: ${} marks where the cursor goes */
  snippet?: string
  type:
    | "keyword"
    | "property"
    | "class"
    | "variable"
    | "enum"
    | "constant"
    | "function"
    | "text"
  boost?: number
}

export type Completions = { from: number; options: Suggestion[] }

/** The tables a query needs loaded to suggest for (or check) it. */
export function tablesIn(text: string): string[] {
  const names = new Set<string>()
  for (const el of readXml(text).all)
    if (el.name === "entity" || el.name === "link-entity") {
      const name = attr(el, "name")
      if (name) names.add(name)
    }
  return [...names]
}

export function completeFetchXml(
  text: string,
  pos: number,
  meta: EditorMeta
): Completions | null {
  const { cursor } = readXml(text, pos)
  switch (cursor.kind) {
    case "tag-name":
      return { from: cursor.from, options: elementsFor(cursor.parent, meta) }
    case "close-tag":
      return cursor.parent
        ? {
            from: cursor.from,
            options: [
              {
                label: cursor.parent.name,
                apply: `${cursor.parent.name}>`,
                type: "keyword",
              },
            ],
          }
        : null
    case "attr-name":
      return { from: cursor.from, options: attributesFor(cursor.element) }
    case "attr-value":
      return {
        from: cursor.from,
        options: valuesFor(cursor.element, cursor.attr, text, meta),
      }
    case "text":
      // Inside <value>: the condition's choices
      if (
        cursor.parent?.name === "value" &&
        cursor.parent.parent?.name === "condition"
      ) {
        const options = conditionValues(cursor.parent.parent, text, meta)
        return options.length ? { from: pos, options } : null
      }
      return null
  }
}

function elementsFor(
  parent: XmlElement | null,
  meta: EditorMeta
): Suggestion[] {
  const names = parent ? (ELEMENTS[parent.name]?.children ?? []) : ["fetch"]
  const options: Suggestion[] = names.map((name) => {
    const spec = ELEMENTS[name]
    return {
      label: name,
      info: spec.info,
      type: "keyword",
      snippet: elementSnippet(name),
    }
  })
  // Ready-made joins from the parent table's relationships
  if (parent && names.includes("link-entity")) {
    const table = tableOf(parent)
    for (const r of (table && meta.relationships(table)) || []) {
      const alias = r.table
      options.push({
        label: `link-entity ${r.table} (${r.kind === "many-to-one" ? r.to : r.from})`,
        detail: r.kind === "many-to-one" ? "parent" : "children",
        info: `${r.schemaName}: ${table}.${r.to} = ${r.table}.${r.from}`,
        type: "class",
        snippet: `link-entity name="${r.table}" from="${r.from}" to="${r.to}" link-type="${r.kind === "many-to-one" ? "inner" : "outer"}" alias="${alias}">\n\t<attribute name="\${}" />\n</link-entity>`,
        boost: -1,
      })
    }
  }
  return options
}

/** An element with the attributes it needs, cursor in the first. */
function elementSnippet(name: string): string {
  switch (name) {
    case "fetch":
      return 'fetch top="${50}">\n\t${}\n</fetch>'
    case "entity":
      return 'entity name="${}">\n</entity>'
    case "attribute":
      return 'attribute name="${}" />'
    case "all-attributes":
      return "all-attributes />"
    case "order":
      return 'order attribute="${}" descending="false" />'
    case "filter":
      return 'filter type="and">\n\t${}\n</filter>'
    case "condition":
      return 'condition attribute="${}" operator="eq" value="" />'
    case "link-entity":
      return 'link-entity name="${}" from="" to="" link-type="inner" alias="">\n</link-entity>'
    case "value":
      return "value>${}</value>"
    default:
      return `${name}>\${}</${name}>`
  }
}

function attributesFor(el: XmlElement): Suggestion[] {
  const spec = ELEMENTS[el.name]
  if (!spec) return []
  const present = new Set(el.attrs.map((a) => a.name))
  return spec.attrs
    .filter((a) => !present.has(a.name))
    .map((a) => ({
      label: a.name,
      info: a.info,
      type: "property" as const,
      snippet: `${a.name}="\${}"`,
      boost: a.required ? 1 : a.info.startsWith("Legacy") ? -2 : 0,
    }))
}

function valuesFor(
  el: XmlElement,
  attrName: string,
  text: string,
  meta: EditorMeta
): Suggestion[] {
  const spec: AttrSpec | undefined = ELEMENTS[el.name]?.attrs.find(
    (a) => a.name === attrName
  )
  if (!spec) return []
  const value = spec.value
  switch (value.kind) {
    case "enum":
      return value.values.map((v) => ({ label: v, type: "enum" }))
    case "bool":
      return ["true", "false"].map((v) => ({ label: v, type: "constant" }))
    case "table":
      return tableSuggestions(el, meta)
    case "column": {
      if (el.name === "link-entity") return linkColumns(el, "from", meta)
      const aliases = aliasesOf(readXml(text))
      const table =
        el.name === "attribute" ? tableOf(el) : columnTableOf(el, aliases)
      return columnSuggestions(table, meta)
    }
    case "parent-column":
      return linkColumns(el, "to", meta)
    case "operator":
      return operatorSuggestions(el, text, meta)
    case "condition-value":
      return conditionValues(el, text, meta)
    case "alias":
      return [...aliasesOf(readXml(text))].map(([alias, link]) => ({
        label: alias,
        detail: attr(link, "name") ?? undefined,
        type: "variable",
      }))
    default:
      return []
  }
}

function tableSuggestions(el: XmlElement, meta: EditorMeta): Suggestion[] {
  // For a link-entity, related tables first
  const related = new Map<string, string>()
  if (el.name === "link-entity") {
    const parent = parentTableOf(el)
    for (const r of (parent && meta.relationships(parent)) || [])
      if (!related.has(r.table)) related.set(r.table, r.schemaName)
  }
  return meta.tables.map((t) => ({
    label: t.logicalName,
    detail: t.displayName,
    info: related.has(t.logicalName)
      ? `Related: ${related.get(t.logicalName)}`
      : undefined,
    type: "class",
    boost: related.has(t.logicalName) ? 2 : 0,
  }))
}

function columnSuggestions(
  table: string | null,
  meta: EditorMeta,
  boosted?: Map<string, string>
): Suggestion[] {
  const fields = (table && meta.fields(table)) || []
  return fields.map((f) => ({
    label: f.id,
    detail: f.label,
    info: `${typeLabel(f)}${boosted?.has(f.id) ? ` · joins ${boosted.get(f.id)}` : ""}`,
    type: "property",
    boost: boosted?.has(f.id) ? 2 : 0,
  }))
}

/** A link-entity's from (its own table) or to (the parent's), relationship columns first. */
function linkColumns(
  link: XmlElement,
  side: "from" | "to",
  meta: EditorMeta
): Suggestion[] {
  const linked = attr(link, "name")
  const parent = parentTableOf(link)
  const joins = new Map<string, string>()
  for (const r of (parent && meta.relationships(parent)) || [])
    if (r.table === linked)
      joins.set(side === "from" ? r.from : r.to, r.schemaName)
  return columnSuggestions(side === "from" ? linked : parent, meta, joins)
}

function conditionColumn(
  condition: XmlElement,
  text: string,
  meta: EditorMeta
) {
  const column = attr(condition, "attribute")
  if (!column) return { table: null, field: undefined }
  const table = columnTableOf(condition, aliasesOf(readXml(text)))
  return { table, field: findField(meta, table, column) }
}

function operatorSuggestions(
  condition: XmlElement,
  text: string,
  meta: EditorMeta
): Suggestion[] {
  const { table, field } = conditionColumn(condition, text, meta)
  const fits = (o: OperatorSpec) =>
    !field ||
    !table ||
    o.types.some((t) => operatorTypesOf(field, table).includes(t))
  return OPERATORS.filter(fits).map((o, i) => ({
    label: o.name,
    detail: o.info,
    info:
      o.values === 0
        ? "No value"
        : o.values === 1
          ? "One value"
          : o.values === 2
            ? "Two <value> elements"
            : "One or more <value> elements",
    type: "function",
    // Keep the reference order: common ones first
    boost: -i / 1000,
  }))
}

function conditionValues(
  condition: XmlElement,
  text: string,
  meta: EditorMeta
): Suggestion[] {
  const { field } = conditionColumn(condition, text, meta)
  if (!field?.options?.length) return []
  const operator = OPERATOR.get(attr(condition, "operator") ?? "")
  if (operator && operator.values === 0) return []
  return field.options.map((o) => ({
    label: String(o.value),
    detail: o.label,
    type: "enum",
  }))
}
