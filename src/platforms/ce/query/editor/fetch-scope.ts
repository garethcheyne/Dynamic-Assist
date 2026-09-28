/** Which table each part of a FetchXML query refers to: entities, link-entities and their aliases. */
import { attr, type XmlElement, type XmlTree } from "@/lib/xml-tree"

const isTableElement = (el: XmlElement) =>
  el.name === "entity" || el.name === "link-entity"

/** The entity or link-entity an element belongs to (itself, if it is one). */
export function scopeOf(el: XmlElement | null): XmlElement | null {
  for (let e = el; e; e = e.parent) if (isTableElement(e)) return e
  return null
}

/** The table an element's columns come from: its own entity or link-entity's. */
export const tableOf = (el: XmlElement | null) => {
  const scope = scopeOf(el)
  return scope ? attr(scope, "name") : null
}

/** A link-entity's parent table (what its `to` column is on). */
export const parentTableOf = (link: XmlElement) => tableOf(link.parent)

/** Link-entity aliases in the query, to their elements. */
export function aliasesOf(tree: Pick<XmlTree, "all">): Map<string, XmlElement> {
  const map = new Map<string, XmlElement>()
  for (const el of tree.all) {
    const alias = el.name === "link-entity" ? attr(el, "alias") : null
    if (alias) map.set(alias, el)
  }
  return map
}

/**
 * The table a condition or order's column is on: the link-entity its
 * entityname names, or the one it sits in.
 */
export function columnTableOf(
  el: XmlElement,
  aliases: Map<string, XmlElement>
): string | null {
  const entityname = attr(el, "entityname")
  if (entityname) {
    const link = aliases.get(entityname)
    return link ? attr(link, "name") : null
  }
  return tableOf(el)
}

export const isAggregate = (tree: Pick<XmlTree, "roots">) =>
  tree.roots[0]?.name === "fetch" && attr(tree.roots[0], "aggregate") === "true"
