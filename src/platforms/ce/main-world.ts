/**
 * Runs in the Dynamics 365 (model-driven app) page's own JS world, top frame
 * only, so it can use `Xrm`. It reports the current page to the content script
 * and runs the panel's commands: Level Up for Dynamics 365's form tools, rebuilt
 * on the supported Client API instead of the classic DOM.
 *
 * Everything here is defensive: a missing API reports nothing rather than
 * throwing into the page.
 */
import {
  CE_COMMAND,
  CE_RESULT,
  CE_STATE,
  CE_STATE_REQUEST,
  type CeApp,
  type CeColumn,
  type CeCommand,
  type CeCommandMessage,
  type CeCommands,
  type CeEntity,
  type CeEnvironment,
  type CeField,
  type CeForm,
  type CeModes,
  type CePage,
  type CeState,
} from "./types"

/* eslint-disable @typescript-eslint/no-explicit-any -- Xrm has no types here */
declare const Xrm: any

function read<T>(fn: () => T): T | null {
  try {
    return fn() ?? null
  } catch {
    return null
  }
}

const hasXrm = () =>
  typeof Xrm !== "undefined" && !!read(() => Xrm.Utility.getGlobalContext())

const global = () => Xrm.Utility.getGlobalContext()
const clientUrl = () => global().getClientUrl() as string
const formContext = (): any =>
  read(() => (Xrm.Page?.data?.entity ? Xrm.Page : null))
const trimId = (id: string | null) =>
  id ? id.replace(/[{}]/g, "").toLowerCase() : null

const modes: CeModes = { godMode: false, logicalNames: false, blurred: false }

// --- Things that need a request, fetched once --------------------------------

let environment: CeEnvironment | null = null
let app: CeApp | null = null

async function loadEnvironment() {
  const g = global()
  const base: CeEnvironment = {
    clientUrl: clientUrl(),
    orgUniqueName: g.organizationSettings.uniqueName,
    orgId: trimId(g.organizationSettings.organizationId) ?? "",
    version: g.getVersion(),
    environmentId: null,
    friendlyName: null,
    geo: null,
    tenantId: null,
  }
  environment = base
  try {
    const res = await fetch(
      `${base.clientUrl}/api/data/v9.2/RetrieveCurrentOrganization(AccessType=Microsoft.Dynamics.CRM.EndpointAccessType'Default')`,
      { headers: { Accept: "application/json" } }
    )
    const d = (await res.json()).Detail
    environment = {
      ...base,
      environmentId: d?.EnvironmentId ?? null,
      friendlyName: d?.FriendlyName ?? null,
      geo: d?.Geo ?? null,
      tenantId: d?.TenantId ?? null,
    }
  } catch {
    // On-premises or no access: the basics are enough.
  }
  try {
    const p = await g.getCurrentAppProperties()
    app = { id: p.appId, displayName: p.displayName, uniqueName: p.uniqueName }
  } catch {
    app = null
  }
  post(true)
}

const metadata = new Map<string, any>()
async function entityMetadata(entityName: string) {
  if (!metadata.has(entityName)) {
    metadata.set(entityName, await Xrm.Utility.getEntityMetadata(entityName))
    post(true)
  }
  return metadata.get(entityName)
}

// --- Reading the page ---------------------------------------------------------

function readPage(): CePage {
  const input = read(() => Xrm.Utility.getPageContext().input) ?? {}
  return {
    pageType: input.pageType ?? null,
    entityName: input.entityName ?? null,
    entityId: trimId(input.entityId ?? null),
    viewId: trimId(input.viewId ?? null),
    viewType: input.viewType ?? null,
  }
}

function display(attribute: any, type: string): string {
  const value = attribute.getValue()
  if (value === null || value === undefined) return ""
  switch (type) {
    case "optionset":
    case "multiselectoptionset": {
      const text = read(() => attribute.getText())
      return Array.isArray(text) ? text.join(", ") : (text ?? String(value))
    }
    case "boolean": {
      const text = read(() => attribute.getText())
      return text ?? (value ? "Yes" : "No")
    }
    case "lookup":
      return (value as any[]).map((l) => l.name ?? l.id).join(", ")
    case "datetime":
      return value instanceof Date ? value.toLocaleString() : String(value)
    case "money":
    case "decimal":
    case "double":
    case "integer":
      return typeof value === "number" ? value.toLocaleString() : String(value)
    default:
      return String(value)
  }
}

function readField(attribute: any): CeField {
  const type: string = read(() => attribute.getAttributeType()) ?? "unknown"
  const control = read(() => attribute.controls.get(0))
  const section = read(() => control.getParent())
  const tab = read(() => section.getParent())
  const value = read(() => attribute.getValue())
  const logicalName: string = attribute.getName()
  return {
    logicalName,
    label: read(() => control.getLabel()) ?? logicalName,
    type,
    format: read(() => attribute.getFormat()),
    display: read(() => display(attribute, type)) ?? "",
    raw: read(() => JSON.stringify(value)) ?? "",
    lookups:
      type === "lookup" && Array.isArray(value)
        ? value.map((l: any) => ({
            id: trimId(l.id) ?? "",
            name: l.name ?? null,
            entityType: l.entityType,
          }))
        : null,
    requiredLevel: read(() => attribute.getRequiredLevel()) ?? "none",
    dirty: read(() => attribute.getIsDirty()) === true,
    visible: read(() => control.getVisible()) !== false,
    disabled: read(() => control.getDisabled()) === true,
    tab: read(() => tab.getLabel()),
    section: read(() => section.getLabel()),
  }
}

function readForm(): CeForm | null {
  const fc = formContext()
  if (!fc) return null
  const entity = fc.data.entity
  const entityName: string = entity.getEntityName()
  const md = metadata.get(entityName)
  if (!md) void entityMetadata(entityName).catch(() => {})
  const formItem = read(() => fc.ui.formSelector.getCurrentItem())
  return {
    entityName,
    entityDisplayName: md?.DisplayName ?? null,
    entitySetName: md?.EntitySetName ?? null,
    primaryIdAttribute: md?.PrimaryIdAttribute ?? null,
    objectTypeCode: md?.ObjectTypeCode ?? null,
    id: trimId(read(() => entity.getId()) || null),
    primaryName: read(() => entity.getPrimaryAttributeValue()),
    formId: trimId(read(() => formItem.getId())),
    formName: read(() => formItem.getLabel()),
    formType: read(() => fc.ui.getFormType()) ?? 0,
    isDirty: read(() => entity.getIsDirty()) === true,
    tabs:
      read(() =>
        fc.ui.tabs.get().map((t: any) => ({
          name: t.getName(),
          label: t.getLabel(),
          visible: t.getVisible(),
          expanded: t.getDisplayState() === "expanded",
        }))
      ) ?? [],
    fields: read(() => entity.attributes.get().map(readField)) ?? [],
  }
}

function readState(): CeState | null {
  if (!hasXrm() || !environment) return null
  const g = global()
  return {
    environment,
    user: {
      name: g.userSettings.userName,
      id: trimId(g.userSettings.userId) ?? "",
      roles:
        read(() => g.userSettings.roles.getAll().map((r: any) => r.name)) ?? [],
      languageId: read(() => g.userSettings.languageId),
      timeZoneOffsetMinutes: read(() =>
        g.userSettings.getTimeZoneOffsetMinutes()
      ),
    },
    app,
    page: readPage(),
    form: readForm(),
    modes: { ...modes },
  }
}

// --- Commands -------------------------------------------------------------------

type Handler<C extends CeCommand> = (
  args: CeCommands[C]["args"]
) => CeCommands[C]["result"] | Promise<CeCommands[C]["result"]>

const requireForm = () => {
  const fc = formContext()
  if (!fc) throw new Error("Open a record form first.")
  return fc
}

const originalLabels = new Map<any, string>()

function setLabels(on: boolean) {
  const fc = requireForm()
  const label = (item: any, name: string) => {
    if (on) {
      if (!originalLabels.has(item)) originalLabels.set(item, item.getLabel())
      item.setLabel(name)
    } else if (originalLabels.has(item)) {
      item.setLabel(originalLabels.get(item))
    }
  }
  fc.ui.controls.forEach((c: any) => {
    const name =
      read(() => c.getAttribute()?.getName()) ?? read(() => c.getName())
    if (name && c.setLabel) read(() => label(c, name))
  })
  fc.ui.tabs.forEach((t: any) => {
    read(() => label(t, t.getName()))
    t.sections.forEach((s: any) => read(() => label(s, s.getName())))
  })
  if (!on) originalLabels.clear()
}

// While logical names are on, each field on the form gets a tinted background
// and a copy button beside its label. UCI re-renders fields (and only renders
// expanded tabs), so an observer re-adds buttons as they appear.
// Field containers carry data-control-name; the label is the <label> inside.
// Only controls bound to an attribute are marked (not subgrids, timelines…).
const MARK_STYLE_ID = "dynamic-assist-logical-names"
const COPY_CLASS = "dynamic-assist-copy"
const COPY_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
const FIELD_ATTR = "data-dynamic-assist-field"
const MARK_CSS = `
  [${FIELD_ATTR}] {
    background: rgba(0, 118, 124, 0.07) !important;
    box-shadow: inset 0 0 0 1px rgba(0, 118, 124, 0.35);
    border-radius: 6px;
  }
  .${COPY_CLASS} {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; margin-left: 4px; flex-shrink: 0;
    border: 0; border-radius: 4px; padding: 0; cursor: pointer;
    background: transparent; color: #00767c;
  }
  .${COPY_CLASS}:hover { background: rgba(0, 118, 124, 0.15); }
  .${COPY_CLASS}:focus-visible { outline: 2px solid #00767c; outline-offset: 1px; }
`

let markObserver: MutationObserver | null = null

/** Attribute logical name behind a form control (header_x controls map to x); null if unbound. */
function logicalNameOf(controlName: string): string | null {
  return read(() => Xrm.Page.getControl(controlName).getAttribute().getName())
}

function addCopyButtons() {
  for (const container of document.querySelectorAll<HTMLElement>(
    "[data-control-name]"
  )) {
    const label = container.querySelector("label")
    if (!label || label.parentElement?.querySelector(`.${COPY_CLASS}`)) continue
    const name = logicalNameOf(container.getAttribute("data-control-name")!)
    if (!name) continue
    container.setAttribute(FIELD_ATTR, name)
    const button = document.createElement("button")
    button.type = "button"
    button.className = COPY_CLASS
    button.title = `Copy ${name}`
    button.setAttribute("aria-label", `Copy logical name ${name}`)
    button.innerHTML = COPY_ICON
    button.addEventListener("click", async (event) => {
      // Don't let the form treat it as a click on the field
      event.preventDefault()
      event.stopPropagation()
      try {
        await navigator.clipboard.writeText(name)
        button.innerHTML = CHECK_ICON
        window.setTimeout(() => (button.innerHTML = COPY_ICON), 1200)
      } catch {
        button.title = "Couldn't copy"
      }
    })
    label.insertAdjacentElement("afterend", button)
  }
}

function markFields(on: boolean) {
  document.getElementById(MARK_STYLE_ID)?.remove()
  markObserver?.disconnect()
  markObserver = null
  document.querySelectorAll(`.${COPY_CLASS}`).forEach((b) => b.remove())
  document
    .querySelectorAll(`[${FIELD_ATTR}]`)
    .forEach((el) => el.removeAttribute(FIELD_ATTR))
  if (!on) return

  const style = document.createElement("style")
  style.id = MARK_STYLE_ID
  style.textContent = MARK_CSS
  document.head.appendChild(style)
  addCopyButtons()

  let timer: number | undefined
  markObserver = new MutationObserver(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(addCopyButtons, 150)
  })
  markObserver.observe(document.body, { subtree: true, childList: true })
}

const BLUR_STYLE_ID = "dynamic-assist-blur"

// Table list for the panel's Open box, fetched once per page load.
let entityList: Promise<CeEntity[]> | null = null

const handlers: { [C in CeCommand]: Handler<C> } = {
  godMode() {
    const fc = requireForm()
    let controls = 0
    fc.data.entity.attributes.forEach((a: any) =>
      read(() => a.setRequiredLevel("none"))
    )
    fc.ui.controls.forEach((c: any) => {
      read(() => c.setVisible(true))
      read(() => c.setDisabled?.(false))
      read(() => c.clearNotification?.())
      controls++
    })
    fc.ui.tabs.forEach((t: any) => {
      read(() => t.setVisible(true))
      read(() => t.setDisplayState("expanded"))
      t.sections.forEach((s: any) => read(() => s.setVisible(true)))
    })
    modes.godMode = true
    return { controls }
  },

  logicalNames({ on }) {
    setLabels(on)
    markFields(on)
    modes.logicalNames = on
  },

  expandTabs() {
    const fc = requireForm()
    let tabs = 0
    fc.ui.tabs.forEach((t: any) => {
      read(() => t.setDisplayState("expanded"))
      tabs++
    })
    return { tabs }
  },

  refreshSubgrids() {
    const fc = requireForm()
    let grids = 0
    fc.ui.controls.forEach((c: any) => {
      if (read(() => c.getControlType()) === "subgrid") {
        read(() => c.refresh())
        grids++
      }
    })
    return { grids }
  },

  fillRequired() {
    const fc = requireForm()
    const filled: string[] = []
    const skipped: string[] = []
    fc.data.entity.attributes.forEach((a: any) => {
      if (a.getRequiredLevel() !== "required" || a.getValue() !== null) return
      const name = a.getName()
      const type = a.getAttributeType()
      let value: unknown = undefined
      switch (type) {
        case "string":
        case "memo":
          value = "-"
          break
        case "integer":
        case "decimal":
        case "double":
        case "money":
          value = Math.max(0, read(() => a.getMin()) ?? 0)
          break
        case "boolean":
          value = false
          break
        case "datetime":
          value = new Date()
          break
        case "optionset":
          value = read(() => a.getOptions()[0].value)
          break
        case "multiselectoptionset":
          value = read(() => [a.getOptions()[0].value])
          break
      }
      if (value === undefined || value === null) {
        skipped.push(name)
        return
      }
      a.setValue(value)
      filled.push(name)
    })
    return { filled, skipped }
  },

  clone() {
    const fc = requireForm()
    const entity = fc.data.entity
    const skip = new Set([
      "statecode",
      "statuscode",
      "ownerid",
      entity.getEntityName() + "id",
    ])
    const params: Record<string, unknown> = {}
    let fields = 0
    entity.attributes.forEach((a: any) => {
      const name = a.getName()
      const value = a.getValue()
      if (value === null || skip.has(name)) return
      const type = a.getAttributeType()
      if (type === "lookup") {
        const l = value[0]
        if (!l || value.length > 1) return
        params[name] = trimId(l.id)
        params[`${name}name`] = l.name
        params[`${name}type`] = l.entityType
      } else if (type === "datetime") {
        params[name] = (value as Date).toISOString()
      } else if (type === "multiselectoptionset") {
        params[name] = `[${value.join(",")}]`
      } else if (
        [
          "string",
          "memo",
          "boolean",
          "optionset",
          "integer",
          "decimal",
          "double",
          "money",
        ].includes(type)
      ) {
        params[name] = value
      } else {
        return
      }
      fields++
    })
    void Xrm.Navigation.openForm(
      { entityName: entity.getEntityName(), openInNewWindow: false },
      params
    )
    return { fields }
  },

  async refresh() {
    await requireForm().data.refresh(false)
  },

  async save() {
    await requireForm().data.save()
  },

  blur({ on }) {
    document.getElementById(BLUR_STYLE_ID)?.remove()
    if (on) {
      const style = document.createElement("style")
      style.id = BLUR_STYLE_ID
      style.textContent = `
        input, textarea, select, [role="gridcell"], [data-id*="LookupResultsDropdown"],
        [data-id$="_selected_tag_text"], [data-id*="header_"] [data-id$=".fieldControl-text-box-text"],
        [data-id="header_title"], [data-id="entity_name_span"] { filter: blur(5px) !important; }`
      document.head.appendChild(style)
    }
    modes.blurred = on
  },

  async allColumns() {
    const fc = requireForm()
    const entityName = fc.data.entity.getEntityName()
    const md = await entityMetadata(entityName)
    const id = trimId(fc.data.entity.getId())
    if (!id) throw new Error("Save the record first.")
    const res = await fetch(
      `${clientUrl()}/api/data/v9.2/${md.EntitySetName}(${id})`,
      {
        headers: {
          Accept: "application/json",
          Prefer:
            'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        },
      }
    )
    if (!res.ok) throw new Error(`Web API ${res.status}`)
    const row = await res.json()
    const columns: CeColumn[] = []
    for (const [name, value] of Object.entries(row)) {
      if (name.includes("@")) continue
      columns.push({
        name,
        value:
          value === null
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value),
        formatted:
          (row[`${name}@OData.Community.Display.V1.FormattedValue`] as
            string | undefined) ?? null,
      })
    }
    return columns.sort((a, b) => a.name.localeCompare(b.name))
  },

  async viewFetchXml() {
    const page = readPage()
    if (page.pageType !== "entitylist" || !page.viewId)
      throw new Error("Open a list view first.")
    const set = page.viewType === "4230" ? "userqueries" : "savedqueries"
    const res = await fetch(
      `${clientUrl()}/api/data/v9.2/${set}(${page.viewId})?$select=name,fetchxml`,
      { headers: { Accept: "application/json" } }
    )
    if (!res.ok) throw new Error(`Web API ${res.status}`)
    const view = await res.json()
    const md = await entityMetadata(page.entityName!)
    return {
      name: view.name,
      fetchXml: view.fetchxml,
      entitySetName: md.EntitySetName,
    }
  },

  async entities() {
    entityList ??= (async () => {
      const res = await fetch(
        `${clientUrl()}/api/data/v9.2/EntityDefinitions?$select=LogicalName,DisplayName,EntitySetName,ObjectTypeCode,IsCustomEntity&$filter=IsIntersect eq false`,
        { headers: { Accept: "application/json" } }
      )
      if (!res.ok) throw new Error(`Web API ${res.status}`)
      const rows: any[] = (await res.json()).value
      return rows
        .map((r) => ({
          logicalName: r.LogicalName as string,
          displayName:
            (r.DisplayName?.UserLocalizedLabel?.Label as string | undefined) ??
            null,
          entitySetName: (r.EntitySetName as string | null) ?? null,
          objectTypeCode: (r.ObjectTypeCode as number | null) ?? null,
          custom: r.IsCustomEntity === true,
        }))
        .sort((a, b) =>
          (a.displayName ?? a.logicalName).localeCompare(
            b.displayName ?? b.logicalName
          )
        )
    })().catch((error) => {
      entityList = null
      throw error
    })
    return entityList
  },

  async myMailbox() {
    const userId = trimId(global().userSettings.userId)
    const r = await Xrm.WebApi.retrieveMultipleRecords(
      "mailbox",
      `?$select=mailboxid&$filter=_regardingobjectid_value eq ${userId}&$top=1`
    )
    return { id: r.entities[0]?.mailboxid ?? null }
  },
}

// --- Messaging --------------------------------------------------------------------

let last = ""

function post(force = false) {
  const state = read(readState)
  const json = JSON.stringify(state)
  if (!force && json === last) return
  last = json
  window.postMessage({ type: CE_STATE, state }, location.origin)
}

window.addEventListener("message", async (event) => {
  if (event.source !== window) return
  const data = event.data
  if (data?.type === CE_STATE_REQUEST) {
    post(true)
    return
  }
  if (data?.type !== CE_COMMAND) return
  const message = data as CeCommandMessage
  try {
    const handler = handlers[message.command] as Handler<CeCommand>
    if (!handler) throw new Error(`Unknown command ${message.command}`)
    if (!hasXrm()) throw new Error("This page isn't a Dynamics 365 app page.")
    const result = await handler(message.args as never)
    window.postMessage(
      { type: CE_RESULT, id: message.id, ok: true, result },
      location.origin
    )
  } catch (error) {
    window.postMessage(
      {
        type: CE_RESULT,
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      location.origin
    )
  }
  post(true)
})

// Xrm loads after the page; wait for it, then watch for changes.
const start = window.setInterval(() => {
  if (!hasXrm()) return
  window.clearInterval(start)
  void loadEnvironment()
  let timer: number | undefined
  new MutationObserver(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => post(), 400)
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  })
  // Field edits don't always touch the DOM right away; poll lightly too.
  window.setInterval(() => post(), 2000)
}, 500)
