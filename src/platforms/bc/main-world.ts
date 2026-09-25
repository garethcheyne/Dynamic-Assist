/**
 * Runs in the web client's own JavaScript world (manifest `world: "MAIN"`), so it
 * can read `DN`, the global BC's client.js defines. The client keeps a model of
 * every open form; this reads the top-most one instead of opening BC's page
 * inspector, which starts a second client session to render page 9631.
 *
 * Path (BC 28, found by probing a live client):
 *   DN.App.context.currentPage.entry.formAdapter.logicalControl  → LogicalForm
 *   form.metadata            { id, sourceTableId, primaryKeyIds }
 *   form.children.items      controls; nested LogicalForms are parts (FactBoxes, subpages)
 *   control.tableFieldNo     the bound table field, -1 when unbound
 *   repeater.currentRow.children.items   the selected row's cells, aligned with repeater.columns.items
 *   DN.ExecutionContext.Instance         EnvName, EnvType
 *
 * More in investigations/bc-client/README.md.
 *
 * None of this is a public API, so every read is defensive and the whole thing
 * reports nothing rather than throwing when the shape changes.
 */
import {
  FIELD_CLASSES,
  dataTypeOf,
  PAGE_MESSAGE,
  REQUEST_MESSAGE,
  TOOL_MESSAGE,
  TOOL_RESULT_MESSAGE,
  pageTypeName,
  schemaNameOf,
  type BcField,
  type BcForm,
  type BcPageInfo,
  type BcSession,
} from "./page-info"
import { reapplyTools, runTool, toolModes } from "./page-tools"

/* eslint-disable @typescript-eslint/no-explicit-any -- BC's client model is untyped */
type Control = any

declare const DN: any

function read<T>(fn: () => T): T | null {
  try {
    return fn() ?? null
  } catch {
    return null
  }
}

const kids = (c: Control): Control[] => read(() => c.children.items) ?? []

function currentForm(): Control | null {
  if (typeof DN === "undefined") return null
  return read(() => DN.App.context.currentPage.entry.formAdapter.logicalControl)
}

function toField(
  control: Control,
  group: string | null,
  caption?: string | null
): BcField {
  const controlName = read(() => control.designName)
  const fieldCaption = caption ?? read(() => control.caption)
  return {
    fieldNo: control.tableFieldNo,
    schemaName: schemaNameOf(controlName, fieldCaption),
    controlName,
    caption: fieldCaption,
    value: read(() => String(control.stringValue ?? "")),
    dataType: dataTypeOf(control),
    fieldClass: FIELD_CLASSES[read(() => control.fieldClass) ?? 0] ?? "Normal",
    editable: read(() => control.editable) === true,
    visible: read(() => control.visible) !== false,
    // AL Importance: 0 Standard, 1 Additional, 2 Promoted
    promoted: read(() => control.importance) === 2,
    group,
    appId: read(() => control.sourceAppId),
    appName: null,
  }
}

/** Fields bound on this form, not descending into parts. */
function collectFields(form: Control): { fields: BcField[]; parts: Control[] } {
  const fields: BcField[] = []
  const parts: Control[] = []
  const seen = new Set<number>()
  const add = (field: BcField) => {
    if (field.fieldNo < 0 || seen.has(field.fieldNo)) return
    seen.add(field.fieldNo)
    fields.push(field)
  }

  const walk = (c: Control, depth: number, group: string | null) => {
    if (!c || depth > 40) return
    if (depth > 0 && c.typeName === "LogicalForm") {
      parts.push(c)
      return
    }
    if (c.typeName === "RepeaterControl") {
      const columns: Control[] = read(() => c.columns.items) ?? []
      const cells = kids(read(() => c.currentRow))
      const rowGroup = group ?? read(() => c.caption) ?? null
      cells.forEach((cell, i) =>
        add(
          toField(
            cell,
            rowGroup,
            read(() => columns[i].caption)
          )
        )
      )
      return
    }
    // The outermost captioned group is the FastTab.
    let next = group
    if (!next && c.typeName === "GroupControl") {
      next = read(() => c.caption)?.trim() || null
    }
    if (typeof c.tableFieldNo === "number" && c.tableFieldNo >= 0)
      add(toField(c, group))
    for (const k of kids(c)) walk(k, depth + 1, next)
  }

  walk(form, 0, null)
  return { fields, parts }
}

function readSession(): BcSession | null {
  const s = read(() => DN.BrowserPageSession.instance)
  if (!s) return null
  const profile = read(() => s.profileDescription)
  const company = read(() => s.companyInformation)
  return {
    userName: read(() => s.userName),
    displayName: read(() => s.userDisplayName),
    upn: read(() => s.userUpn),
    userSecurityId: read(() => s.userInfo.userGuid),
    isTenantAdmin: read(() => s.$isTenantAdmin),
    profile: profile?.Id
      ? { id: profile.Id, caption: profile.Caption ?? profile.Id }
      : null,
    company: company?.name
      ? {
          name: read(() => company.displayName) ?? company.name,
          id: read(() => company.id),
          indicator: read(() => company.systemIndicatorText),
        }
      : null,
    language: read(() => s.languageInfo.name),
    timeZone: read(() => s.timeZone),
  }
}

function toForm(form: Control): { form: BcForm; parts: Control[] } {
  const { fields, parts } = collectFields(form)
  const appId = read(() => form.appId)
  return {
    parts,
    form: {
      pageId: read(() => form.metadata.id) ?? -1,
      name: read(() => form.name) ?? "",
      caption: read(() => form.caption),
      pageType: pageTypeName(read(() => form.pageType) ?? -1),
      tableId: read(() => form.metadata.sourceTableId),
      primaryKey: read(() => [...form.metadata.primaryKeyIds]) ?? [],
      bookmark: read(() => form.bookmark),
      systemId: read(() => form.systemId),
      app: appId
        ? {
            id: appId,
            name: read(() => form.appName) ?? "",
            publisher: read(() => form.appPublisher) ?? "",
            version: read(() => form.appVersion) ?? "",
          }
        : null,
      fields,
    },
  }
}

function readPageInfo(): BcPageInfo | null {
  const root = currentForm()
  if (!root) return null

  const main = toForm(root)
  const parts: BcForm[] = []
  const queue = [...main.parts]
  while (queue.length) {
    const next = toForm(queue.shift())
    parts.push(next.form)
    queue.push(...next.parts)
  }

  // Name the apps behind extension fields from the forms that declare them.
  const apps = new Map<string, string>()
  for (const f of [main.form, ...parts])
    if (f.app) apps.set(f.app.id, f.app.name)
  for (const f of [main.form, ...parts]) {
    for (const field of f.fields) {
      if (field.appId === f.app?.id) field.appId = null
      field.appName = field.appId ? (apps.get(field.appId) ?? null) : null
    }
  }

  return {
    environment: {
      name: read(() => DN.ExecutionContext.Instance.EnvName),
      type: read(() => DN.ExecutionContext.Instance.EnvType),
      platform: read(() => DN.ClientConfiguration.settings.PlatformVersion),
      aadTenantId: read(() => DN.ExecutionContext.Instance.AadTenantId),
    },
    session: readSession(),
    tools: toolModes(),
    form: main.form,
    parts,
  }
}

// --- Reporting to the content script -----------------------------------------

let last = ""

/**
 * True when Business Central has drawn a page here but its model isn't where
 * this reads it: the web client changed (a monthly update can), and the page
 * tools need an update. Said out loud rather than leaving the panel waiting.
 */
function unreadable(page: BcPageInfo | null) {
  return (
    !page &&
    typeof DN !== "undefined" &&
    !!document.querySelector("form.ms-nav-root-form")
  )
}

function post(force = false) {
  const page = read(readPageInfo)
  const unsupported = unreadable(page)
  const json = JSON.stringify(page) + unsupported
  if (!force && json === last) return
  last = json
  window.postMessage({ type: PAGE_MESSAGE, page, unsupported }, location.origin)
}

// Only the frame running the client (?runinframe=1, or a top-level client) has a form model.
let timer: number | undefined
new MutationObserver(() => {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    // The client redraws as you move around: put field names back
    read(reapplyTools)
    post()
  }, 300)
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
})

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data?.type === REQUEST_MESSAGE) post(true)
  if (event.data?.type === TOOL_MESSAGE && currentForm()) {
    const message = read(() =>
      runTool(event.data.command, event.data.on, event.data.data)
    )
    window.postMessage(
      {
        type: TOOL_RESULT_MESSAGE,
        id: event.data.id,
        message: message ?? "That didn't work on this page",
      },
      location.origin
    )
    post(true)
  }
})
