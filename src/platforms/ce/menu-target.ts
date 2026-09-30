import { controlNameFromLabelId } from "./form-labels"

/**
 * What a right-click landed on in a model-driven app, from the DOM alone:
 * main-world.ts then asks Xrm for the column behind a form control.
 *
 * - Grid headers and cells (Power Apps grid control) carry col-id: the
 *   column's logical name, or alias.column for a linked table's column.
 * - Form fields: the label's id (form-labels.ts), the field's container
 *   (data-id "<control>-FieldSectionItemContainer") or the control inside it
 *   (data-id "<control>.fieldControl-…").
 * - Tabs (data-id "tablist-<name>") and sections (<section data-id="<name>">).
 */
export type DomMenuTarget =
  | { kind: "column"; name: string; alias: string | null }
  | { kind: "control"; control: string }
  | { kind: "tab"; name: string }
  | { kind: "section"; name: string }

/** The parts of an element the match needs, so tests can pass plain objects. */
type ElementLike = {
  tagName: string
  id: string
  getAttribute(name: string): string | null
  parentElement: ElementLike | null
}

const CONTROL_DATA_ID =
  /^([A-Za-z0-9_]+)(?:\.fieldControl|-FieldSectionItemContainer$)/

/** What this one element is, if it's anything the menu can name. */
export function matchMenuElement(el: ElementLike): DomMenuTarget | null {
  const colId = el.getAttribute("col-id")
  if (colId && !colId.startsWith("__")) {
    const dot = colId.lastIndexOf(".")
    return dot >= 0
      ? {
          kind: "column",
          name: colId.slice(dot + 1),
          alias: colId.slice(0, dot),
        }
      : { kind: "column", name: colId, alias: null }
  }
  if (el.tagName === "LABEL" && el.id) {
    const control = controlNameFromLabelId(el.id)
    if (control) return { kind: "control", control }
  }
  const dataId = el.getAttribute("data-id")
  if (!dataId) return null
  if (el.getAttribute("role") === "tab" && dataId.startsWith("tablist-"))
    return { kind: "tab", name: dataId.slice("tablist-".length) }
  if (el.tagName === "SECTION") return { kind: "section", name: dataId }
  const control = dataId.match(CONTROL_DATA_ID)?.[1]
  return control ? { kind: "control", control } : null
}

/** The nearest thing the menu can name, from the clicked element up. */
export function findMenuTarget(
  el: ElementLike | null
): { target: DomMenuTarget; element: ElementLike } | null {
  for (let e = el, depth = 0; e && depth < 40; e = e.parentElement, depth++) {
    const target = matchMenuElement(e)
    if (target) return { target, element: e }
  }
  return null
}
