/**
 * Checks FetchXML as you type, in layers: well-formed XML, FetchXML's structure,
 * the org's metadata, and Microsoft's documented rules (aggregates, paging,
 * filter links, retention data). Each rule is written from the Microsoft Learn
 * page its message links to. Pure: the editor shows these as squiggles.
 */
import { attr, attrOf, readXml, type XmlElement } from "@/lib/xml-tree"

import {
  DOCS,
  ELEMENTS,
  FILTER_LINK_TYPES,
  LEGACY_OPERATORS,
  OPERATOR,
} from "./fetch-schema"
import {
  aliasesOf,
  columnTableOf,
  isAggregate,
  parentTableOf,
  tableOf,
} from "./fetch-scope"
import { findField, operatorTypesOf, type EditorMeta } from "./meta"

export type Severity = "error" | "warning" | "info"

export type Problem = {
  from: number
  to: number
  severity: Severity
  message: string
  /** Microsoft Learn page explaining the rule */
  link?: string
}

const ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/

export function lintFetchXml(text: string, meta: EditorMeta | null): Problem[] {
  if (!text.trim()) return []
  const tree = readXml(text)
  const problems: Problem[] = tree.problems.map((p) => ({
    ...p,
    severity: "error",
  }))
  const add = (
    el: XmlElement | { from: number; to: number },
    severity: Severity,
    message: string,
    link?: string
  ) => {
    const range = "nameFrom" in el ? { from: el.nameFrom, to: el.nameTo } : el
    problems.push({ ...range, severity, message, link })
  }
  const valueRange = (el: XmlElement, name: string) => {
    const a = attrOf(el, name)
    return a ? { from: a.valueFrom, to: Math.max(a.valueTo, a.valueFrom) } : el
  }
  const on = (el: XmlElement, name: string) =>
    attrOf(el, name)
      ? { from: attrOf(el, name)!.from, to: attrOf(el, name)!.valueTo + 1 }
      : el

  const root = tree.roots[0]
  if (!root) return problems
  if (root.name !== "fetch") {
    add(root, "error", "A query starts with <fetch>")
    return problems
  }

  // --- Structure ------------------------------------------------------------
  for (const el of tree.all) {
    const spec = ELEMENTS[el.name]
    if (!spec) {
      add(el, "error", `<${el.name}> isn't a FetchXML element`)
      continue
    }
    const parentSpec = el.parent && ELEMENTS[el.parent.name]
    if (parentSpec && !parentSpec.children.includes(el.name))
      add(
        el,
        "error",
        `<${el.name}> can't go inside <${el.parent!.name}>`,
        spec.link
      )

    for (const a of el.attrs) {
      const aSpec = spec.attrs.find((s) => s.name === a.name)
      if (!aSpec) {
        add(
          { from: a.from, to: a.nameTo },
          "error",
          `<${el.name}> has no ${a.name} attribute`,
          spec.link
        )
        continue
      }
      const v = a.value ?? ""
      const range = {
        from: a.valueFrom,
        to: Math.max(a.valueTo, a.valueFrom + 1),
      }
      if (aSpec.value.kind === "enum" && v && !aSpec.value.values.includes(v))
        add(
          range,
          "error",
          `${a.name} must be one of: ${aSpec.value.values.join(", ")}`,
          spec.link
        )
      if (
        aSpec.value.kind === "bool" &&
        v &&
        v !== "true" &&
        v !== "false" &&
        v !== "1" &&
        v !== "0"
      )
        add(range, "error", `${a.name} must be true or false`, spec.link)
      if (aSpec.value.kind === "number" && v && !/^\d+$/.test(v))
        add(range, "error", `${a.name} must be a whole number`, spec.link)
    }
    for (const a of spec.attrs)
      if (a.required && !attr(el, a.name))
        add(el, "error", `<${el.name}> needs ${a.name}="…"`, spec.link)
  }

  const entities = root.children.filter((c) => c.name === "entity")
  if (entities.length === 0)
    add(root, "error", "<fetch> needs an <entity>", `${ELEMENTS.fetch.link}`)
  for (const extra of entities.slice(1))
    add(extra, "error", "Only one <entity> per query")

  // --- Metadata --------------------------------------------------------------
  const aliases = aliasesOf(tree)
  const seenAliases = new Set<string>()
  for (const el of tree.all) {
    if (el.name === "link-entity") {
      const alias = attr(el, "alias")
      if (alias && seenAliases.has(alias))
        add(
          valueRange(el, "alias"),
          "error",
          `The alias ${alias} is used twice`
        )
      if (alias) seenAliases.add(alias)
    }
  }

  const tableKnown = (name: string) =>
    !meta || meta.tables.length === 0 || !!meta.table(name)
  const checkColumn = (
    el: XmlElement,
    attrName: string,
    table: string | null
  ) => {
    const column = attr(el, attrName)
    if (!meta || !column || !table) return
    const fields = meta.fields(table)
    if (fields && !fields.some((f) => f.id === column))
      add(valueRange(el, attrName), "error", `${table} has no column ${column}`)
  }

  for (const el of tree.all) {
    switch (el.name) {
      case "entity":
      case "link-entity": {
        const name = attr(el, "name")
        if (name && !tableKnown(name))
          add(valueRange(el, "name"), "error", `There's no table ${name}`)
        if (el.name === "link-entity") {
          checkColumn(el, "from", name)
          checkColumn(el, "to", parentTableOf(el))
        }
        break
      }
      case "attribute":
        checkColumn(el, "name", tableOf(el))
        break
      case "order":
        if (!attr(el, "alias"))
          checkColumn(el, "attribute", columnTableOf(el, aliases))
        break
      case "condition": {
        const entityname = attr(el, "entityname")
        if (entityname && !aliases.has(entityname)) {
          add(
            valueRange(el, "entityname"),
            "error",
            `No link-entity has the alias ${entityname}`
          )
          break
        }
        const table = columnTableOf(el, aliases)
        checkColumn(el, "attribute", table)
        checkColumn(el, "valueof", table)
        checkCondition(el, table)
        break
      }
    }
  }

  function checkCondition(el: XmlElement, table: string | null) {
    const opName = attr(el, "operator")
    if (!opName) return
    const legacy = LEGACY_OPERATORS[opName]
    if (legacy) {
      add(
        valueRange(el, "operator"),
        "info",
        `${opName} is deprecated: use ${legacy}`,
        DOCS.operators
      )
      return
    }
    const op = OPERATOR.get(opName)
    if (!op) {
      add(
        valueRange(el, "operator"),
        "error",
        `${opName} isn't a FetchXML operator`,
        DOCS.operators
      )
      return
    }
    const values = el.children.filter((c) => c.name === "value")
    const hasValue = attr(el, "value") !== null || attr(el, "valueof") !== null
    if (op.values === 0 && (hasValue || values.length))
      add(el, "warning", `${opName} doesn't take a value`, DOCS.operators)
    if (op.values === 1 && !hasValue && values.length === 0)
      add(el, "error", `${opName} needs value="…"`, DOCS.operators)
    if (op.values === 2 && values.length !== 2)
      add(el, "error", `${opName} needs two <value> elements`, DOCS.operators)
    if (op.values === "many" && !hasValue && values.length === 0)
      add(
        el,
        "error",
        `${opName} needs one or more <value> elements`,
        DOCS.operators
      )

    const column = attr(el, "attribute")
    const field = column && meta ? findField(meta, table, column) : undefined
    if (!field || !table) return
    const types = operatorTypesOf(field, table)
    if (!op.types.some((t) => types.includes(t)))
      add(
        valueRange(el, "operator"),
        "warning",
        `${opName} doesn't apply to ${column} (${field.dataType})`,
        DOCS.operators
      )

    // Choice values must be the option's number, not its label
    if (field.options?.length && op.values !== 0) {
      const allowed = new Set(field.options.map((o) => String(o.value)))
      const given = [
        ...(attr(el, "value") !== null
          ? [{ v: attr(el, "value")!, range: valueRange(el, "value") }]
          : []),
        ...values.map((v) => ({
          v: v.text[0]?.value ?? "",
          range: v.text[0] ?? v,
        })),
      ]
      for (const { v, range } of given) {
        if (!v || allowed.has(v)) continue
        const byLabel = field.options.find(
          (o) => o.label.toLowerCase() === v.toLowerCase()
        )
        add(
          range,
          "warning",
          byLabel
            ? `Use the value ${byLabel.value}, not the label "${v}"`
            : `${v} isn't one of ${column}'s values`
        )
      }
    }
  }

  // --- Documented rules ---------------------------------------------------------
  const aggregate = isAggregate(tree)
  const retained = attr(root, "datasource") === "retained"
  const top = attr(root, "top")
  if (top && (attr(root, "page") || attr(root, "count")))
    add(
      on(root, "top"),
      "error",
      "top can't be used with page or count",
      DOCS.paging
    )
  if (top && Number(top) > 5000)
    add(
      valueRange(root, "top"),
      "error",
      "top can be at most 5,000",
      DOCS.paging
    )

  for (const el of tree.all) {
    const inFilter = el.parent?.name === "filter"
    switch (el.name) {
      case "attribute": {
        if (el.parent?.name === "filter") break
        if (aggregate) {
          if (!attr(el, "alias"))
            add(
              el,
              "warning",
              "In an aggregate query, give every attribute an alias",
              DOCS.aggregate
            )
          if (!attr(el, "aggregate") && attr(el, "groupby") !== "true")
            add(
              el,
              "error",
              'In an aggregate query, every attribute needs aggregate="…" or groupby="true"',
              DOCS.aggregate
            )
        } else if (attr(el, "aggregate") || attr(el, "groupby"))
          add(
            el,
            "error",
            'aggregate and groupby need <fetch aggregate="true">',
            DOCS.aggregate
          )
        const alias = attr(el, "alias")
        if (alias && !ALIAS.test(alias))
          add(
            valueRange(el, "alias"),
            "error",
            "An alias uses letters, digits and _, and doesn't start with a digit"
          )
        break
      }
      case "all-attributes":
        if (aggregate)
          add(
            el,
            "error",
            "Aggregate queries can't use <all-attributes>",
            DOCS.aggregate
          )
        break
      case "order":
        if (aggregate && attr(el, "attribute"))
          add(
            el,
            "error",
            'In an aggregate query, sort by alias="…", not attribute',
            DOCS.aggregateOrder
          )
        if (!aggregate && !attr(el, "attribute"))
          add(el, "error", '<order> needs attribute="…"')
        if (el.parent?.name === "link-entity")
          add(
            el,
            "info",
            "Sorting on a link-entity makes Dataverse use slower legacy paging",
            DOCS.linkOrder
          )
        break
      case "filter":
        if (el.children.length === 0) add(el, "info", "This filter is empty")
        break
      case "link-entity": {
        const type = attr(el, "link-type") ?? "inner"
        const alias = attr(el, "alias")
        if (alias && !ALIAS.test(alias))
          add(
            valueRange(el, "alias"),
            "error",
            "An alias uses letters, digits and _, and doesn't start with a digit"
          )
        if (retained)
          add(
            el,
            "error",
            "Long-term retention queries can't use link-entity",
            DOCS.retained
          )
        if (FILTER_LINK_TYPES.includes(type) && !inFilter)
          add(
            valueRange(el, "link-type"),
            "error",
            `link-type="${type}" only works inside a <filter>`,
            DOCS.filterLinks
          )
        if (inFilter) {
          if (!FILTER_LINK_TYPES.includes(type))
            add(
              el,
              "error",
              'A link-entity inside a filter needs link-type any, "not any", all or "not all"',
              DOCS.filterLinks
            )
          if (
            el.children.some(
              (c) => c.name === "attribute" || c.name === "all-attributes"
            )
          )
            add(
              el,
              "warning",
              "A link-entity inside a filter can't return columns",
              DOCS.filterLinks
            )
        }
        if (!attr(el, "from") || !attr(el, "to"))
          add(
            el,
            "warning",
            'Give the link-entity from="…" and to="…"',
            ELEMENTS["link-entity"].link
          )
        break
      }
    }
  }
  if (retained && aggregate)
    add(
      on(root, "datasource"),
      "error",
      "Long-term retention queries can't be aggregates",
      DOCS.retained
    )

  // A leading wildcard scans the whole table
  for (const el of tree.all) {
    if (el.name !== "condition") continue
    const op = attr(el, "operator")
    const v = attr(el, "value")
    if ((op === "like" || op === "not-like") && v?.startsWith("%"))
      add(
        valueRange(el, "value"),
        "info",
        "A leading % can't use an index and scans the whole table",
        DOCS.antipatterns
      )
  }

  return problems.sort((a, b) => a.from - b.from)
}
