/**
 * The right-click menu on Dynamics 365 and Business Central pages: the page
 * tools you flip often (logical names, field names, blur), and the things only
 * a right-click can aim at, such as copying the name of the field under the
 * pointer. Everything else stays in the side panel, where it can explain
 * itself. Chrome groups the items under "Dynamic Assist".
 *
 * Items run the same page commands the panel does, and report back with a
 * short note on the page (shared/page-note.ts), since the panel may be closed.
 *
 * Microsoft's admin centres, build tools and docs (the panel's Go-anywhere
 * links) are in a submenu there too, and on the toolbar icon's own
 * right-click menu, which works on any page.
 */
import { setPanelIntent } from "@/lib/panel-intent"
import { cachedAppNames, KNOWN_APPS } from "@/platforms/bc/app-names"
import {
  TOOL_REQUEST,
  type BcPageAnswer,
  type BcRequest,
  type BcToolAnswer,
  type BcToolRequest,
} from "@/platforms/bc/messages"
import type { BcMenuTarget, BcToolCommand } from "@/platforms/bc/page-info"
import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"
import { ceStateOf, runCe } from "@/platforms/ce/command"
import { ceUrls } from "@/platforms/ce/urls"
import { openQueryBuilder } from "@/query-builder/open"
import { PAGE_NOTE, type PageNote } from "@/shared/page-note"
import { PORTAL_LINKS } from "@/shared/portal-links"

/** The contexts this menu uses; Chrome wants at least one */
type Contexts = [ContextName, ...ContextName[]]
type ContextName =
  "page" | "frame" | "editable" | "link" | "image" | "selection" | "action"

// Org hosts are <org>.crm<n>.dynamics.com, one number per region. Business
// Central (businesscentral.dynamics.com) must not match, so no *.dynamics.com.
const CE_PAGES = [
  "crm",
  ...Array.from({ length: 29 }, (_, i) => `crm${i + 2}`),
].map((region) => `https://*.${region}.dynamics.com/*`)
const BC_PAGES = ["https://businesscentral.dynamics.com/*"]

/** Wherever you right-click on the page: labels, fields, links, a selection */
const ON_PAGE: Contexts = [
  "page",
  "frame",
  "editable",
  "link",
  "image",
  "selection",
]

type Item =
  | { id: string; title: string; contexts?: Contexts }
  | { id: string; separator: true }

const CE_ITEMS: Item[] = [
  { id: "ce-copy-name", title: "Copy logical name" },
  { id: "ce-option-set", title: "Option set values" },
  { id: "ce-sep-1", separator: true },
  { id: "ce-logical-names", title: "Logical names on/off" },
  { id: "ce-god-mode", title: "God mode" },
  { id: "ce-blur", title: "Blur data on/off" },
  { id: "ce-sep-2", separator: true },
  { id: "ce-record-id", title: "Copy record ID" },
  { id: "ce-record-link", title: "Copy record link" },
  { id: "ce-open-view", title: "Open this view in the query builder" },
]

const BC_ITEMS: Item[] = [
  { id: "bc-copy-name", title: "Copy field name" },
  { id: "bc-copy-number", title: "Copy field number" },
  { id: "bc-sep-1", separator: true },
  { id: "bc-field-names", title: "Field names on/off" },
  { id: "bc-blur", title: "Blur data on/off" },
  { id: "bc-expand", title: "Expand FastTabs" },
  { id: "bc-sep-2", separator: true },
  { id: "bc-record-link", title: "Copy record link" },
  { id: "bc-all-fields", title: "All fields of this record" },
  { id: "bc-query-table", title: "Query this table" },
  { id: "bc-sep-3", separator: true },
  { id: "bc-open-page", title: "Open page %s", contexts: ["selection"] },
  { id: "bc-open-table", title: "Open table %s", contexts: ["selection"] },
]

/** A Microsoft link's item ID: where it's shown, then the URL to open */
const LINK = "link|"
const linkId = (where: string, url: string) => `${LINK}${where}|${url}`
const linkUrl = (id: string) => id.split("|").slice(2).join("|")

type Create = Parameters<typeof chrome.contextMenus.create>[0]
const create = (props: Create) =>
  chrome.contextMenus.create(props, () => void chrome.runtime.lastError)

/** Every Microsoft link under one parent, a separator between groups */
function addLinks(
  where: string,
  parentId: string,
  contexts: Contexts,
  documentUrlPatterns?: string[]
) {
  PORTAL_LINKS.forEach((group, i) => {
    if (i)
      create({
        id: `${where}-sep-${i}`,
        type: "separator",
        parentId,
        contexts,
        documentUrlPatterns,
      })
    for (const link of group.links)
      create({
        id: linkId(where, link.url),
        title: link.label,
        parentId,
        contexts,
        documentUrlPatterns,
      })
  })
}

/** Creates the menu. Items persist, so once per install or update is enough. */
export function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    const add = (
      prefix: string,
      items: Item[],
      documentUrlPatterns: string[]
    ) => {
      for (const item of items)
        create(
          "separator" in item
            ? {
                id: item.id,
                type: "separator",
                contexts: ON_PAGE,
                documentUrlPatterns,
              }
            : {
                id: item.id,
                title: item.title,
                contexts: item.contexts ?? ON_PAGE,
                documentUrlPatterns,
              }
        )
      // Last: Microsoft's portals, in a submenu
      create({
        id: `${prefix}-sep-links`,
        type: "separator",
        contexts: ON_PAGE,
        documentUrlPatterns,
      })
      create({
        id: `${prefix}-links`,
        title: "Microsoft links",
        contexts: ON_PAGE,
        documentUrlPatterns,
      })
      addLinks(prefix, `${prefix}-links`, ON_PAGE, documentUrlPatterns)
    }
    add("ce", CE_ITEMS, CE_PAGES)
    add("bc", BC_ITEMS, BC_PAGES)

    // The toolbar icon's menu, on any page: one submenu per group (Chrome
    // allows 6 top-level items there)
    PORTAL_LINKS.forEach((group, i) => {
      const parentId = `action-${i}`
      create({ id: parentId, title: group.title, contexts: ["action"] })
      for (const link of group.links)
        create({
          id: linkId("action", link.url),
          title: link.label,
          parentId,
          contexts: ["action"],
        })
    })
  })
}

// --- Reporting back on the page -------------------------------------------------

type Note = Omit<PageNote, "type">

/**
 * Shows a note in the frame that was right-clicked (it has focus, so it can
 * copy), else in the top frame (Dynamics 365's script is only there).
 */
async function note(tabId: number, frameId: number, n: Note) {
  const message: PageNote = { type: PAGE_NOTE, ...n }
  try {
    await chrome.tabs.sendMessage(tabId, message, { frameId })
  } catch {
    if (frameId !== 0)
      await chrome.tabs
        .sendMessage(tabId, message, { frameId: 0 })
        .catch(() => {})
  }
}

/** A failure the user can act on: shown on the page, not logged as an error */
class Refusal extends Error {}
const refuse = (message: string): never => {
  throw new Refusal(message)
}

const NOT_READY =
  "The page isn't ready. Reload it once after installing or updating Dynamic Assist."

// --- Dynamics 365 -----------------------------------------------------------------

async function ceItem(id: string, tab: chrome.tabs.Tab): Promise<Note | void> {
  const tabId = tab.id!
  const { state, dark } = await ceStateOf(tabId)
  if (!state) return refuse(NOT_READY)
  const recordId = state.form?.id ?? state.page.entityId
  const table = state.form?.entityName ?? state.page.entityName
  const isList = state.page.pageType === "entitylist" && !!state.page.viewId

  switch (id) {
    case "ce-copy-name": {
      const target = await runCe(tabId, "menuTarget")
      if (!target)
        return refuse("Right-click a field, its label or a column header first")
      return { text: `Copied ${target.name}`, copy: target.name }
    }
    case "ce-option-set": {
      const target = await runCe(tabId, "menuTarget")
      if (!target || target.kind === "tab" || target.kind === "section")
        return refuse("Right-click a choice field or column first")
      if (target.choice === false)
        return refuse(`${target.name} isn't a choice column`)
      await setPanelIntent({ tabId, optionSet: target.name })
      return
    }
    case "ce-logical-names": {
      if (!state.form && !isList)
        return refuse("Open a record form or a list view first")
      const on = !state.modes.logicalNames
      await runCe(tabId, "logicalNames", { on })
      return { text: on ? "Showing logical names" : "Labels restored" }
    }
    case "ce-god-mode": {
      const r = await runCe(tabId, "godMode")
      return { text: `God mode: unlocked ${r.controls} controls` }
    }
    case "ce-blur": {
      const on = !state.modes.blurred
      await runCe(tabId, "blur", { on })
      return { text: on ? "Values blurred" : "Blur removed" }
    }
    case "ce-record-id":
      if (!recordId) return refuse("Open a saved record first")
      return { text: `Copied the ${table} ID`, copy: recordId }
    case "ce-record-link":
      if (!recordId || !table) return refuse("Open a saved record first")
      return {
        text: `Copied the link to this ${table}`,
        copy: ceUrls(state).record(table, recordId),
      }
    case "ce-open-view": {
      if (!isList) return refuse("Open a list view first")
      const view = await runCe(tabId, "viewFetchXml")
      await openQueryBuilder(tabId, { fetchXml: view.fetchXml }, dark)
      return
    }
  }
}

// --- Business Central -------------------------------------------------------------

/** Runs a page tool: in one frame (the right-clicked one), or whichever has a page */
async function bcTool(
  tabId: number,
  command: BcToolCommand,
  opts: { frameId?: number; on?: boolean; data?: unknown } = {}
): Promise<BcToolAnswer> {
  const request: BcToolRequest = {
    type: TOOL_REQUEST,
    command,
    on: opts.on,
    data: opts.data,
  }
  const answer = (await chrome.tabs
    .sendMessage(
      tabId,
      request,
      opts.frameId === undefined ? undefined : { frameId: opts.frameId }
    )
    .catch(() => null)) as BcToolAnswer | null
  return answer ?? refuse("Open a Business Central page first")
}

async function bcItem(
  id: string,
  tab: chrome.tabs.Tab,
  frameId: number,
  selection: string | undefined
): Promise<Note | void> {
  const tabId = tab.id!
  const ctx = parseBcUrl(tab.url!)

  // Opening an object by number needs no page, only the environment
  if (id === "bc-open-page" || id === "bc-open-table") {
    const n = selection?.trim().replace(/[.,\s]/g, "") ?? ""
    if (!/^\d{1,10}$/.test(n))
      return refuse(`Select an object number, not "${selection?.trim()}"`)
    await chrome.tabs.create({
      url: buildBcUrl(ctx, id === "bc-open-page" ? { page: n } : { table: n }),
      index: tab.index + 1,
    })
    return
  }

  const request: BcRequest = { type: "bc:get-page" }
  const answer = (await chrome.tabs
    .sendMessage(tabId, request)
    .catch(() => null)) as BcPageAnswer | null
  const page = answer?.page
  if (!page) return refuse(NOT_READY)
  const form = page.form

  switch (id) {
    case "bc-copy-name":
    case "bc-copy-number": {
      const { data } = await bcTool(tabId, "menuTarget", { frameId })
      const target = data as BcMenuTarget | null
      if (!target)
        return refuse(
          "Right-click a field's caption or value, or a list column, first"
        )
      return id === "bc-copy-name"
        ? { text: `Copied ${target.name}`, copy: target.name }
        : {
            text: `Copied ${target.fieldNo} (${target.name})`,
            copy: String(target.fieldNo),
          }
    }
    case "bc-field-names": {
      const on = !page.tools?.fieldNames
      const r = await bcTool(tabId, "fieldNames", { on })
      // Name the apps behind each field: Microsoft's, and any the panel has
      // already read through the companion (never opens it from here)
      if (on) {
        const apps = { ...KNOWN_APPS, ...((await cachedAppNames(ctx)) ?? {}) }
        await bcTool(tabId, "appNames", { data: apps }).catch(() => {})
      }
      return { text: r.message ?? (on ? "Field names on" : "Field names off") }
    }
    case "bc-blur": {
      const r = await bcTool(tabId, "blur", { on: !page.tools?.blur })
      return { text: r.message ?? "Done" }
    }
    case "bc-expand": {
      const r = await bcTool(tabId, "expandTabs")
      return { text: r.message ?? "Done" }
    }
    case "bc-record-link":
      if (!form.bookmark)
        return refuse("Open a single record (a card or document) first")
      return {
        text: "Copied the record link",
        copy: buildBcUrl(ctx, { page: form.pageId, bookmark: form.bookmark }),
      }
    case "bc-all-fields":
      if (!form.tableId || !form.systemId)
        return refuse("Open a single record first")
      await openQueryBuilder(
        tabId,
        {
          app: "bc",
          tableId: form.tableId,
          fields: "all",
          // SystemId, on every table
          filters: [{ field: 2000000000, filter: form.systemId }],
          run: true,
        },
        answer.dark
      )
      return
    case "bc-query-table":
      if (!form.tableId) return refuse("Open a page that has a source table")
      await openQueryBuilder(
        tabId,
        { app: "bc", tableId: form.tableId, run: true },
        answer.dark
      )
      return
  }
}

// --- Clicks -------------------------------------------------------------------------

export function onContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) {
  const id = String(info.menuItemId)
  // A Microsoft link: a new tab beside this one (from the toolbar icon, the
  // tab can be any page, even one without a URL we may read)
  if (id.startsWith(LINK)) {
    void chrome.tabs.create({
      url: linkUrl(id),
      ...(tab ? { index: tab.index + 1, windowId: tab.windowId } : {}),
    })
    return
  }
  if (tab?.id === undefined || !tab.url) return
  // Chrome only lets the panel open during the click itself, before any await
  if (id === "ce-option-set")
    chrome.sidePanel
      .open({ windowId: tab.windowId })
      .catch((error) => console.warn("Couldn't open the side panel", error))

  const frameId = info.frameId ?? 0
  const run = id.startsWith("ce-")
    ? ceItem(id, tab)
    : bcItem(id, tab, frameId, info.selectionText)
  void run
    .then((n) => n && note(tab.id!, frameId, n))
    .catch((error: unknown) => {
      if (!(error instanceof Refusal))
        console.warn(`Menu item ${id} failed`, error)
      return note(tab.id!, frameId, {
        text: error instanceof Error ? error.message : String(error),
        tone: "error",
      })
    })
}
