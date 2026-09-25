/**
 * Page tools for the Business Central web client, run in its own world next to
 * main-world.ts: field names beside every caption and column header, blurred
 * values for screenshots, and every FastTab opened.
 *
 * The client's model links to the page: a control's `_id` is its element's id
 * (the caption is `<id>lbl`), and a list column's caption is its header's
 * `abbr`. Found by probing BC 28; none of it is a public API, so every step is
 * defensive and does nothing when the shape changes.
 */
import { setPageTip, setPageTipAccent, type TipCard } from "@/shared/page-tip"

import {
  FIELD_CLASSES,
  dataTypeOf,
  schemaNameOf,
  type BcToolCommand,
  type BcToolModes,
} from "./page-info"

/* eslint-disable @typescript-eslint/no-explicit-any -- BC's client model is untyped */
type Control = any

declare const DN: any

const STYLE_ID = "dynamic-assist-bc-tools"
const BADGE = "da-fieldname"

const modes: BcToolModes = { fieldNames: false, blur: false }

type AppName = { name: string; publisher: string; version: string }
/** Installed apps by ID, sent by the panel (app-names.ts) */
let appNames: Record<string, AppName> = {}

/** "Base Application · Microsoft · 26.3.1.0", or the ID when it isn't known */
function appLabel(id: string, form: Control): string {
  const key = id.replace(/[{}]/g, "").toLowerCase()
  const known = appNames[key]
  if (known)
    return [known.name, known.publisher, known.version]
      .filter(Boolean)
      .join(" · ")
  // The page's own app names itself
  if (read(() => String(form.appId).toLowerCase()) === key)
    return [
      read(() => form.appName),
      read(() => form.appPublisher),
      read(() => form.appVersion),
    ]
      .filter(Boolean)
      .join(" · ")
  return `Unknown app (${key})`
}

/** The page or part a control sits on: up its parents to a logical form. */
function ownerForm(control: Control): Control | null {
  let c = control
  for (let i = 0; c && i < 60; i++) {
    if (read(() => c.metadata) && read(() => c.appId)) return c
    c = read(() => c.parent)
  }
  return currentForm()
}
export const toolModes = (): BcToolModes => ({ ...modes })

function read<T>(fn: () => T): T | null {
  try {
    return fn() ?? null
  } catch {
    return null
  }
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .${BADGE} {
      display: inline-block; flex: none; align-self: center; margin: 0 6px 0 4px; padding: 0 4px;
      font: 600 10px/16px Consolas, "Cascadia Mono", monospace; letter-spacing: 0;
      color: #075777; background: #e1f3f8; border: 1px solid #9ccfe2; border-radius: 3px;
      cursor: copy; white-space: nowrap; vertical-align: middle; user-select: none;
    }
    .${BADGE}:hover { background: #c8e8f2; border-color: #0a6f96; }
    .${BADGE}[data-copied] { background: #dff6dd; border-color: #9fd89f; color: #0e5c0e; }
    html.da-blur .edit-container, html.da-blur [role="gridcell"], html.da-blur td,
    html.da-blur input, html.da-blur textarea, html.da-blur .ms-nav-cardpart-value,
    html.da-blur [class*="cue"] [class*="value"] {
      filter: blur(5px) !important;
    }
  `
  document.head.appendChild(style)
}

const currentForm = (): Control | null =>
  typeof DN === "undefined"
    ? null
    : read(() => DN.App.context.currentPage.entry.formAdapter.logicalControl)

/** Every control on the page, parts (FactBoxes, subpages) included. */
function eachControl(form: Control, visit: (c: Control) => void) {
  const walk = (c: Control, depth: number) => {
    if (!c || depth > 60) return
    visit(c)
    for (const k of read(() => c.children.items) ?? []) walk(k, depth + 1)
  }
  walk(form, 0)
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {
    const area = document.createElement("textarea")
    area.value = text
    area.style.cssText = "position:fixed;opacity:0"
    document.body.appendChild(area)
    area.select()
    document.execCommand("copy")
    area.remove()
  })
}

/**
 * What the badge's tooltip says. `typed` is the control that knows the data
 * type: the field itself on a card, the selected row's cell for a list column.
 */
function fieldCard(
  name: string,
  fieldNo: number,
  control: Control,
  typed: Control = control
): TipCard {
  const caption = read(() => control.caption) as string | null
  const fieldClass =
    FIELD_CLASSES[read(() => control.fieldClass) ?? 0] ?? "Normal"
  const rows: [string, string][] = [
    ["Field", `${name} (${fieldNo})`],
    ["Type", dataTypeOf(typed)],
  ]
  if (fieldClass !== "Normal")
    rows.push([
      "Class",
      fieldClass === "FlowField" ? "FlowField (calculated)" : fieldClass,
    ])
  rows.push(["Editable", read(() => typed.editable) === true ? "Yes" : "No"])
  // Which extension put the field on the page, and whether it's the page's own
  // No sourceAppId: it's the page's (or part's) own field
  const form = ownerForm(control)
  const appId =
    (read(() => control.sourceAppId) as string | null) ??
    (form ? (read(() => form.appId) as string | null) : null)
  if (appId && form) {
    const own =
      read(() => String(form.appId).toLowerCase()) ===
      appId.replace(/[{}]/g, "").toLowerCase()
    rows.push([own ? "App" : "Added by", appLabel(appId, form)])
  }
  if (fieldNo >= 50000 && fieldNo < 2000000000)
    rows.push(["Table field", "From an extension (number 50000+)"])
  const control_ = read(() => control.designName) as string | null
  // Page control name, when it's more than the field name plus BC's number
  if (control_ && !control_.replace(/\d+$/, "").startsWith(name))
    rows.push(["Control", control_])
  return {
    title: caption || name,
    rows,
    description: (read(() => control.toolTip) as string | null) || null,
    hint: "Click to copy the field name",
  }
}

function badge(
  name: string,
  fieldNo: number,
  control?: Control,
  typed?: Control
) {
  const el = document.createElement("span")
  el.className = BADGE
  el.textContent = `${name} · ${fieldNo}`
  setPageTip(
    el,
    control
      ? fieldCard(name, fieldNo, control, typed)
      : `Table field "${name}", number ${fieldNo}. Click to copy the name for filters, AL or the query builder.`
  )
  el.addEventListener(
    "click",
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      copyText(name)
      el.setAttribute("data-copied", "")
      setTimeout(() => el.removeAttribute("data-copied"), 900)
    },
    true
  )
  el.addEventListener("mousedown", (e) => e.stopPropagation(), true)
  return el
}

/** Adds a badge to every bound caption and column header that lacks one. */
function applyFieldNames() {
  const form = currentForm()
  if (!form) return
  ensureStyle()
  setPageTipAccent("#0a6f96")
  eachControl(form, (c) => {
    if (c.typeName === "RepeaterControl") {
      const cells: Control[] = read(() => c.currentRow.children.items) ?? []
      const columns: Control[] = read(() => c.columns.items) ?? []
      for (const [i, col] of columns.entries()) {
        const no = read(() => col.tableFieldNo)
        const caption = read(() => col.caption)
        if (typeof no !== "number" || no < 0 || !caption) continue
        const name = schemaNameOf(
          read(() => col.designName),
          caption
        )
        for (const th of document.querySelectorAll("th[abbr]")) {
          if (
            th.getAttribute("abbr") !== caption ||
            th.querySelector(`.${BADGE}`)
          )
            continue
          const host = th.querySelector("a, span, div") ?? th
          host.appendChild(badge(name, no, col, cells[i]))
        }
      }
      return
    }
    const no = read(() => c.tableFieldNo)
    const id = read(() => c._id)
    if (typeof no !== "number" || no < 0 || !id) return
    const label =
      document.getElementById(`${id}lbl`) ??
      document.getElementById(id)?.querySelector(".ms-nav-edit-control-caption")
    // Beside the caption, not in it: BC clips long captions with "…"
    if (!label || label.nextElementSibling?.classList.contains(BADGE)) return
    label.insertAdjacentElement(
      "afterend",
      badge(
        schemaNameOf(
          read(() => c.designName),
          read(() => c.caption)
        ),
        no,
        c
      )
    )
  })
}

const removeFieldNames = () =>
  document.querySelectorAll(`.${BADGE}`).forEach((el) => el.remove())

/** Re-applies what's on after the client redraws (called on page changes). */
export function reapplyTools() {
  if (modes.fieldNames) applyFieldNames()
}

/** Runs a command from the panel; returns what to tell the user. */
export function runTool(
  command: BcToolCommand,
  on?: boolean,
  data?: unknown
): string {
  switch (command) {
    case "appNames":
      appNames = { ...appNames, ...((data as Record<string, AppName>) ?? {}) }
      // Redraw the badges so their hover cards name the apps
      if (modes.fieldNames) {
        removeFieldNames()
        applyFieldNames()
      }
      return `Named ${Object.keys(appNames).length} apps`
    case "fieldNames":
      modes.fieldNames = on ?? !modes.fieldNames
      if (modes.fieldNames) {
        applyFieldNames()
        return `Field names on (${document.querySelectorAll(`.${BADGE}`).length} shown): click one to copy it`
      }
      removeFieldNames()
      return "Field names off"
    case "blur":
      modes.blur = on ?? !modes.blur
      ensureStyle()
      document.documentElement.classList.toggle("da-blur", modes.blur)
      return modes.blur ? "Values blurred" : "Values shown"
    case "expandTabs": {
      const closed = [
        ...document.querySelectorAll(
          'span.ms-nav-columns-caption[aria-expanded="false"]'
        ),
      ] as HTMLElement[]
      closed.forEach((el) => el.click())
      return closed.length
        ? `Opened ${closed.length} FastTab${closed.length === 1 ? "" : "s"}`
        : "Every FastTab is already open"
    }
  }
}
