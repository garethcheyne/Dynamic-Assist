/**
 * Runs in the Dynamics 365 (model-driven app) page's own JS world, top frame
 * only, so it can use `Xrm`. It reports the current page to the content script
 * and runs the panel's commands: Level Up for Dynamics 365's form tools, rebuilt
 * on the supported Client API instead of the classic DOM.
 *
 * Everything here is defensive: a missing API reports nothing rather than
 * throwing into the page.
 */
import { setPageTip, setPageTipAccent } from "@/shared/page-tip"

import { columnCard, viewAliases } from "./column-info"
import {
  clearLog,
  quietFetch as fetch,
  readLog,
  setConsoleCapture,
} from "./error-log"
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
  type CeDepth,
  type CeEntity,
  type CePermissions,
  type CeUserRoles,
  type CeAccessDetail,
  type CeRelatedAccess,
  type CeSecuredColumn,
  type CeRecordReasons,
  type CePrivilegeType,
  type CeUserSummary,
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

// While logical names are on, each field label, tab, section and grid column
// gets a badge with its logical name, as Business Central's field names do:
// hover for the column's details, click to copy. UCI re-renders fields (and
// only renders expanded tabs), so an observer adds badges as they appear.
const MARK_STYLE_ID = "dynamic-assist-logical-names"
const GRID_BADGE = "dynamic-assist-grid-name"
const MARK_CSS = `
  .${GRID_BADGE} {
    display: inline-block; flex: none; align-self: center; margin-left: 6px; padding: 0 4px;
    font: 600 10px/16px Consolas, "Cascadia Mono", monospace; letter-spacing: 0;
    color: #3d33a8; background: #eeecfd; border: 1px solid #c3bdf4; border-radius: 3px;
    cursor: copy; white-space: nowrap; user-select: none; max-width: 180px;
    overflow: hidden; text-overflow: ellipsis; vertical-align: middle;
    text-transform: none; font-style: normal;
  }
  .${GRID_BADGE}:hover { background: #ddd9fb; border-color: #4f46c9; }
  .${GRID_BADGE}[data-copied] { background: #dff6dd; border-color: #9fd89f; color: #0e5c0e; }
`

type TipCard = Parameters<typeof setPageTip>[1]

/** A logical-name badge: hover for its card, click to copy, never passes clicks on. */
function makeBadge(
  name: string,
  tip: TipCard,
  details?: () => Promise<TipCard>
) {
  const badge = document.createElement("span")
  badge.className = GRID_BADGE
  badge.textContent = name
  setPageTip(badge, tip, details as never)
  // Don't sort a column, switch a tab or focus a field
  for (const type of ["mousedown", "pointerdown", "keydown"])
    badge.addEventListener(type, (e) => e.stopPropagation(), true)
  badge.addEventListener(
    "click",
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      void navigator.clipboard.writeText(name).then(
        () => {
          badge.setAttribute("data-copied", "")
          window.setTimeout(() => badge.removeAttribute("data-copied"), 900)
        },
        () =>
          setPageTip(
            badge,
            "Couldn't copy: click the page first, then try again"
          )
      )
    },
    true
  )
  return badge
}

let markObserver: MutationObserver | null = null

// Grids (list views and subgrids) are Power Apps' grid control: each column
// header has col-id = the column's logical name, or alias.column for a
// linked table's column. Internal columns (__row_status…) start with "__".

// A list view's linked-table aliases, fetched once per view
const aliasMaps = new Map<string, Promise<Map<string, string>>>()

/** The table a grid column belongs to: a subgrid's, the list's, or a linked table's. */
async function gridTable(header: HTMLElement, alias: string | null) {
  const holder = header
    .closest("[data-control-name]")
    ?.getAttribute("data-control-name")
  const subgridTable = holder
    ? (read(() => Xrm.Page.getControl(holder)?.getEntityName?.()) as
        string | null)
    : null
  const page = readPage()
  if (!alias) return subgridTable ?? page.entityName
  // Linked columns: only a list view's FetchXML says which table an alias is
  if (subgridTable || page.pageType !== "entitylist" || !page.viewId)
    return null
  let map = aliasMaps.get(page.viewId)
  if (!map) {
    map = viewAliases(clientUrl(), page.viewId, page.viewType === "4230").catch(
      () => new Map()
    )
    aliasMaps.set(page.viewId, map)
  }
  return (await map).get(alias) ?? null
}

function addGridBadges() {
  for (const header of document.querySelectorAll<HTMLElement>(
    ".ag-header-cell[col-id]"
  )) {
    const colId = header.getAttribute("col-id")!
    if (colId.startsWith("__") || header.querySelector(`.${GRID_BADGE}`))
      continue
    const dot = colId.lastIndexOf(".")
    const name = dot >= 0 ? colId.slice(dot + 1) : colId
    const alias = dot >= 0 ? colId.slice(0, dot) : null
    const host =
      header.querySelector(".ag-header-cell-label") ??
      header.querySelector(".ag-header-cell-text")?.parentElement ??
      header
    const badge = makeBadge(
      name,
      {
        title: name,
        rows: alias ? [["Linked table", alias]] : undefined,
        hint: "Click to copy the logical name",
      },
      async () => {
        const table = await gridTable(header, alias)
        if (!table)
          return {
            title: name,
            rows: alias ? [["Linked table", alias]] : [],
            hint: "Click to copy the logical name",
          }
        return columnCard(
          clientUrl(),
          table,
          name,
          alias ? [["Linked via", alias]] : []
        )
      }
    )
    host.appendChild(badge)
  }
}

/** Attribute logical name behind a form control (header_x controls map to x); null if unbound. */
function logicalNameOf(controlName: string): string | null {
  return read(() => Xrm.Page.getControl(controlName).getAttribute().getName())
}

// Field labels are <label id="id-…-12-name-field-label">: the control's name
// sits between the counter and "-field-label" (header_x for header fields)
const LABEL_ID = /-\d+-(.+)-field-label$/

function addFormBadges() {
  const entity = read(() => formContext()?.data.entity.getEntityName()) as
    string | null
  const hint = "Click to copy the logical name"
  for (const label of document.querySelectorAll<HTMLElement>(
    'label[id$="-field-label"]'
  )) {
    if (label.parentElement?.querySelector(`.${GRID_BADGE}`)) continue
    const control = label.id.match(LABEL_ID)?.[1]
    if (!control) continue
    const name = logicalNameOf(control) ?? control
    label.insertAdjacentElement(
      "afterend",
      makeBadge(
        name,
        { title: name, hint },
        entity ? () => columnCard(clientUrl(), entity, name) : undefined
      )
    )
  }
  for (const tab of document.querySelectorAll<HTMLElement>(
    '[role=tablist] [role=tab][data-id^="tablist-"]'
  )) {
    if (tab.querySelector(`.${GRID_BADGE}`)) continue
    const name = tab.getAttribute("data-id")!.slice("tablist-".length)
    tab.appendChild(
      makeBadge(name, { title: name, rows: [["Kind", "Tab"]], hint })
    )
  }
  for (const section of document.querySelectorAll<HTMLElement>(
    "section[data-id]"
  )) {
    const heading = section.querySelector(":scope h2")
    if (!heading || heading.querySelector(`.${GRID_BADGE}`)) continue
    const name = section.getAttribute("data-id")!
    heading.appendChild(
      makeBadge(name, { title: name, rows: [["Kind", "Section"]], hint })
    )
  }
}

function markFields(on: boolean) {
  document.getElementById(MARK_STYLE_ID)?.remove()
  markObserver?.disconnect()
  markObserver = null
  document.querySelectorAll(`.${GRID_BADGE}`).forEach((b) => b.remove())
  if (!on) return

  setPageTipAccent("#4f46c9")
  const style = document.createElement("style")
  style.id = MARK_STYLE_ID
  style.textContent = MARK_CSS
  document.head.appendChild(style)
  addFormBadges()
  addGridBadges()

  let timer: number | undefined
  markObserver = new MutationObserver(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      addFormBadges()
      addGridBadges()
    }, 150)
  })
  markObserver.observe(document.body, { subtree: true, childList: true })
}

const BLUR_STYLE_ID = "dynamic-assist-blur"

// Table list for the panel's Open box, fetched once per page load.
let entityList: Promise<CeEntity[]> | null = null

/**
 * Runs something that expands tabs, then goes back to the tab you were on:
 * in the unified interface expanding a tab also selects it.
 */
function keepingTab<T>(fc: any, work: () => T): T {
  const selected =
    document
      .querySelector('[role=tablist] [role=tab][aria-selected="true"]')
      ?.getAttribute("data-id")
      ?.replace(/^tablist-/, "") ??
    read(() =>
      fc.ui.tabs.get().find((t: any) => t.getDisplayState() === "expanded")
    )?.getName()
  const result = work()
  if (selected) read(() => fc.ui.tabs.get(selected)?.setFocus())
  return result
}

const handlers: { [C in CeCommand]: Handler<C> } = {
  errors: ({ since }) => readLog(since),
  clearErrors: () => clearLog(),
  errorsConsole: ({ on }) => setConsoleCapture(on),
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
    keepingTab(fc, () =>
      fc.ui.tabs.forEach((t: any) => {
        read(() => t.setVisible(true))
        read(() => t.setDisplayState("expanded"))
        t.sections.forEach((s: any) => read(() => s.setVisible(true)))
      })
    )
    modes.godMode = true
    return { controls }
  },

  logicalNames({ on }) {
    // Badges on the form's fields, tabs and sections, and on every grid's
    // columns (lists, subgrids); the labels themselves stay as they are
    markFields(on)
    modes.logicalNames = on
  },

  expandTabs() {
    const fc = requireForm()
    let tabs = 0
    keepingTab(fc, () =>
      fc.ui.tabs.forEach((t: any) => {
        read(() => t.setDisplayState("expanded"))
        tabs++
      })
    )
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

  async permissions({ entityName, recordId, userId }) {
    const g = global()
    const uid = trimId(userId ?? g.userSettings.userId)!
    const api = `${clientUrl()}/api/data/v9.2/`
    const get = async (path: string) => {
      const res = await fetch(api + path, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) throw new Error(`Web API ${res.status}`)
      return res.json()
    }
    const [md, user] = await Promise.all([
      get(
        `EntityDefinitions(LogicalName='${entityName}')?$select=LogicalName,EntitySetName,Privileges`
      ),
      get(`systemusers(${uid})?$select=fullname`),
    ])
    const rank: CeDepth[] = ["None", "Basic", "Local", "Deep", "Global"]
    const privileges = await Promise.all(
      (md.Privileges as { Name: string; PrivilegeType: CePrivilegeType }[]).map(
        async (p) => {
          const r = await get(
            `systemusers(${uid})/Microsoft.Dynamics.CRM.RetrieveUserPrivilegeByPrivilegeName(PrivilegeName='${p.Name}')`
          ).catch(() => ({ RolePrivileges: [] }))
          // Several roles can grant it; the widest level wins
          const depth = (
            r.RolePrivileges as { Depth: CeDepth }[]
          ).reduce<CeDepth>(
            (best, rp) =>
              rank.indexOf(rp.Depth) > rank.indexOf(best) ? rp.Depth : best,
            "None"
          )
          return { type: p.PrivilegeType, name: p.Name, depth }
        }
      )
    )
    let recordAccess: string[] | null = null
    const rid = trimId(recordId ?? null)
    if (rid && md.EntitySetName) {
      const target = encodeURIComponent(
        JSON.stringify({ "@odata.id": `${md.EntitySetName}(${rid})` })
      )
      const r = await get(
        `systemusers(${uid})/Microsoft.Dynamics.CRM.RetrievePrincipalAccess(Target=@tid)?@tid=${target}`
      ).catch(() => null)
      recordAccess = r?.AccessRights
        ? String(r.AccessRights)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : null
    }
    const order: CePrivilegeType[] = [
      "Create",
      "Read",
      "Write",
      "Delete",
      "Append",
      "AppendTo",
      "Assign",
      "Share",
    ]
    privileges.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    const result: CePermissions = {
      user: { id: uid, name: user.fullname },
      entityName,
      privileges,
      recordAccess,
    }
    return result
  },

  async accessDetail({ entityName, recordId, userId }) {
    const g = global()
    const uid = trimId(userId ?? g.userSettings.userId)!
    const api = `${clientUrl()}/api/data/v9.2/`
    const F = "@OData.Community.Display.V1.FormattedValue"
    const get = async (path: string) => {
      const res = await fetch(api + path, {
        headers: {
          Accept: "application/json",
          Prefer: 'odata.include-annotations="*"',
        },
      })
      if (!res.ok) throw new Error(`Web API ${res.status}`)
      return res.json()
    }
    const rank: CeDepth[] = ["None", "Basic", "Local", "Deep", "Global"]

    // The user, their business unit, teams and roles (for System Administrator)
    const user = await get(
      `systemusers(${uid})?$select=fullname,_businessunitid_value&$expand=teammembership_association($select=name,teamid),systemuserroles_association($select=name,roleid)`
    )
    const teamIds = new Set(
      (user.teammembership_association as { teamid: string }[]).map((t) =>
        t.teamid.toLowerCase()
      )
    )
    const systemAdministrator = (
      user.systemuserroles_association as { name: string }[]
    ).some((r) => r.name === "System Administrator")

    // Levels on one table, as the widest any of the user's roles grants
    const tableLevels = async (table: string) => {
      const md = await get(
        `EntityDefinitions(LogicalName='${table}')?$select=LogicalName,DisplayName,Privileges`
      )
      const levels: Partial<Record<CePrivilegeType, CeDepth>> = {}
      await Promise.all(
        (md.Privileges as { Name: string; PrivilegeType: CePrivilegeType }[])
          .filter((p) =>
            ["Read", "Create", "Append", "AppendTo"].includes(p.PrivilegeType)
          )
          .map(async (p) => {
            const r = await get(
              `systemusers(${uid})/Microsoft.Dynamics.CRM.RetrieveUserPrivilegeByPrivilegeName(PrivilegeName='${p.Name}')`
            ).catch(() => ({ RolePrivileges: [] }))
            levels[p.PrivilegeType] = (
              r.RolePrivileges as { Depth: CeDepth }[]
            ).reduce<CeDepth>(
              (best, rp) =>
                rank.indexOf(rp.Depth) > rank.indexOf(best) ? rp.Depth : best,
              "None"
            )
          })
      )
      return {
        label: md.DisplayName?.UserLocalizedLabel?.Label ?? table,
        levels,
      }
    }

    // The form's lookups and subgrids, and the tables behind them
    const fc = formContext()
    const controls: {
      kind: "lookup" | "subgrid"
      control: string
      label: string
      tables: string[]
    }[] = []
    // A column on the form twice (header and body) is checked once
    const seen = new Set<string>()
    if (fc) {
      fc.ui.controls.forEach((c: any) => {
        const type = read(() => c.getControlType()) as string | null
        const name = read(() => c.getName()) as string
        const label = (read(() => c.getLabel()) as string | null) ?? name
        if (type === "lookup") {
          const tables =
            (read(() => c.getEntityTypes()) as string[] | null) ?? []
          const column =
            (read(() => c.getAttribute()?.getName()) as string | null) ?? name
          if (!tables.length || seen.has(column)) return
          seen.add(column)
          controls.push({ kind: "lookup", control: name, label, tables })
        } else if (type === "subgrid") {
          const table = read(() => c.getEntityName()) as string | null
          if (table)
            controls.push({
              kind: "subgrid",
              control: name,
              label,
              tables: [table],
            })
        }
      })
    }
    const tables = [...new Set(controls.flatMap((c) => c.tables))]
    const levelsByTable = new Map(
      await Promise.all(
        tables.map(
          async (t) => [t, await tableLevels(t).catch(() => null)] as const
        )
      )
    )
    const related: CeRelatedAccess[] = controls.flatMap((c) =>
      c.tables.flatMap((t) => {
        const found = levelsByTable.get(t)
        if (!found) return []
        const l = found.levels
        return [
          {
            kind: c.kind,
            control: c.control,
            // A subgrid nobody labelled keeps the designer's "New SG control
            // 1789…": name it by its table instead
            label: /^New SG control \d+$/.test(c.label) ? found.label : c.label,
            table: t,
            tableLabel: found.label,
            read: l.Read ?? "None",
            create: l.Create ?? "None",
            append: l.Append ?? "None",
            appendTo: l.AppendTo ?? "None",
          },
        ]
      })
    )

    // Column security: the table's secured columns and the user's rights on each
    let secured: CeSecuredColumn[] | null
    try {
      const attrs = await get(
        `EntityDefinitions(LogicalName='${entityName}')/Attributes?$select=LogicalName,MetadataId,DisplayName&$filter=IsSecured eq true`
      )
      const list = attrs.value as {
        LogicalName: string
        MetadataId: string
        DisplayName?: any
      }[]
      if (!list.length) secured = []
      else {
        const privs = await get(
          `systemusers(${uid})/Microsoft.Dynamics.CRM.RetrievePrincipalAttributePrivileges()`
        )
        const byId = new Map(
          (
            (privs.AttributePrivileges ?? []) as {
              AttributeId: string
              CanRead: number
              CanUpdate: number
              CanCreate: number
            }[]
          ).map((p) => [p.AttributeId.toLowerCase(), p])
        )
        // 4 is "allowed" in field permissions; System Administrator sees everything
        const yes = (v: number | undefined) => systemAdministrator || v === 4
        secured = list.map((a) => {
          const p = byId.get(a.MetadataId.toLowerCase())
          return {
            column: a.LogicalName,
            label: a.DisplayName?.UserLocalizedLabel?.Label ?? a.LogicalName,
            read: yes(p?.CanRead),
            update: yes(p?.CanUpdate),
            create: yes(p?.CanCreate),
          }
        })
      }
    } catch {
      secured = null
    }

    // The record: its owner, who it's shared with, and whose business unit it's in
    let record: CeAccessDetail["record"] = null
    const rid = trimId(recordId ?? null)
    if (rid) {
      const md = await get(
        `EntityDefinitions(LogicalName='${entityName}')?$select=EntitySetName,OwnershipType`
      )
      const set = md.EntitySetName as string
      const row = await get(
        `${set}(${rid})?$select=_ownerid_value,_owningbusinessunit_value`
      ).catch(() => null)
      if (row?._ownerid_value) {
        const ownerId = String(row._ownerid_value).toLowerCase()
        const ownerKind =
          row["_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname"] ===
          "team"
            ? "team"
            : "user"
        let shares: CeRecordReasons["shares"]
        try {
          const target = encodeURIComponent(
            JSON.stringify({ "@odata.id": `${set}(${rid})` })
          )
          const r = await get(
            `RetrieveSharedPrincipalsAndAccess(Target=@t)?@t=${target}`
          )
          shares = (
            r.PrincipalAccesses as { AccessMask: string; Principal: any }[]
          )
            .map((pa) => {
              const p = pa.Principal ?? {}
              // "#Microsoft.Dynamics.CRM.systemuser", "…team", "…organization"
              const type = String(p["@odata.type"] ?? "")
                .split(".")
                .pop()
              const kind =
                type === "team"
                  ? ("team" as const)
                  : type === "organization"
                    ? ("organization" as const)
                    : ("user" as const)
              const id = String(
                p.teamid ?? p.systemuserid ?? p.organizationid ?? ""
              ).toLowerCase()
              return {
                id,
                kind,
                rights: String(pa.AccessMask)
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              }
            })
            // Shares that reach this user: to them, a team they're in, or everyone
            .filter((s) =>
              s.kind === "team"
                ? teamIds.has(s.id)
                : s.kind === "user"
                  ? s.id === uid
                  : true
            )
            .map((s) => ({
              principal:
                s.kind === "team"
                  ? ((
                      user.teammembership_association as {
                        teamid: string
                        name: string
                      }[]
                    ).find((t) => t.teamid.toLowerCase() === s.id)?.name ??
                    "A team")
                  : s.kind === "organization"
                    ? "Everyone in the organisation"
                    : user.fullname,
              kind: s.kind,
              rights: s.rights,
            }))
        } catch {
          shares = null
        }
        const userBu = user._businessunitid_value
          ? String(user._businessunitid_value).toLowerCase()
          : null
        const recordBu = row._owningbusinessunit_value
          ? String(row._owningbusinessunit_value).toLowerCase()
          : null
        record = {
          owner: {
            name: row[`_ownerid_value${F}`] ?? ownerId,
            kind: ownerKind,
            isUser: ownerKind === "user" && ownerId === uid,
            isUsersTeam: ownerKind === "team" && teamIds.has(ownerId),
          },
          shares,
          userBusinessUnit: user[`_businessunitid_value${F}`] ?? null,
          recordBusinessUnit: row[`_owningbusinessunit_value${F}`] ?? null,
          sameBusinessUnit: !!userBu && userBu === recordBu,
        }
      }
    }

    const result: CeAccessDetail = {
      user: { id: uid, name: user.fullname },
      related,
      secured,
      systemAdministrator,
      record,
    }
    return result
  },

  async userRoles({ userId }) {
    const g = global()
    const uid = trimId(userId ?? g.userSettings.userId)!
    const api = `${clientUrl()}/api/data/v9.2/`
    const get = async (path: string) => {
      const res = await fetch(api + path, {
        headers: {
          Accept: "application/json",
          Prefer:
            'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        },
      })
      if (!res.ok) throw new Error(`Web API ${res.status}`)
      return res.json()
    }
    const [user, teams] = await Promise.all([
      get(
        `systemusers(${uid})?$select=fullname,_businessunitid_value&$expand=systemuserroles_association($select=name)`
      ),
      get(
        `systemusers(${uid})/teammembership_association?$select=name&$expand=teamroles_association($select=name)`
      ).catch(() => ({ value: [] })),
    ])
    const result: CeUserRoles = {
      user: {
        id: uid,
        name: user.fullname,
        businessUnit:
          user[
            "_businessunitid_value@OData.Community.Display.V1.FormattedValue"
          ] ?? null,
      },
      direct: (user.systemuserroles_association as { name: string }[])
        .map((r) => r.name)
        .sort((a, b) => a.localeCompare(b)),
      viaTeams: (
        teams.value as {
          name: string
          teamroles_association?: { name: string }[]
        }[]
      )
        .flatMap((t) =>
          (t.teamroles_association ?? []).map((r) => ({
            role: r.name,
            team: t.name,
          }))
        )
        .sort((a, b) => a.role.localeCompare(b.role)),
    }
    return result
  },

  async searchUsers({ query }) {
    const q = query.trim().replace(/'/g, "''")
    const filter = [
      "isdisabled eq false",
      // Interactive users only: not application, support or integration users
      "accessmode eq 0",
      q ? `(contains(fullname,'${q}') or contains(domainname,'${q}'))` : null,
    ]
      .filter(Boolean)
      .join(" and ")
    const r = await Xrm.WebApi.retrieveMultipleRecords(
      "systemuser",
      `?$select=fullname,domainname&$filter=${filter}&$orderby=fullname&$top=20`
    )
    return r.entities.map((u: any): CeUserSummary => ({
      id: u.systemuserid,
      name: u.fullname,
      domainName: u.domainname ?? null,
    }))
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

const NO_XRM = new Set<CeCommand>(["errors", "clearErrors", "errorsConsole"])

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
    // The error log works on any page, even one whose app failed to load
    if (!hasXrm() && !NO_XRM.has(message.command))
      throw new Error("This page isn't a Dynamics 365 app page.")
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
