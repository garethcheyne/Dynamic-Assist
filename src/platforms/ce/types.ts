/** Shapes shared by the CE page-world script, its content script relay and the side panel. */

/** window.postMessage types between main-world.ts and ce-content.ts (top frame only). */
export const CE_STATE = "dynamic-assist:ce-state"
export const CE_STATE_REQUEST = "dynamic-assist:ce-state-request"
export const CE_COMMAND = "dynamic-assist:ce-command"
export const CE_RESULT = "dynamic-assist:ce-result"

export type CeFieldType =
  | "string"
  | "memo"
  | "boolean"
  | "datetime"
  | "decimal"
  | "double"
  | "integer"
  | "money"
  | "lookup"
  | "optionset"
  | "multiselectoptionset"
  | (string & {})

export type CeLookup = { id: string; name: string | null; entityType: string }

export type CeField = {
  logicalName: string
  label: string
  type: CeFieldType
  format: string | null
  /** What the form shows: option text, lookup names, formatted numbers and dates. */
  display: string
  /** The underlying value as JSON (option numbers, lookup ids, ISO dates). */
  raw: string
  lookups: CeLookup[] | null
  requiredLevel: "none" | "required" | "recommended"
  dirty: boolean
  visible: boolean
  disabled: boolean
  tab: string | null
  section: string | null
}

export type CeTab = {
  name: string
  label: string
  visible: boolean
  expanded: boolean
}

export type CeForm = {
  entityName: string
  entityDisplayName: string | null
  entitySetName: string | null
  primaryIdAttribute: string | null
  objectTypeCode: number | null
  id: string | null
  primaryName: string | null
  formId: string | null
  formName: string | null
  /** Xrm form type: 1 Create, 2 Update, 3 Read only, 4 Disabled, 6 Bulk edit */
  formType: number
  isDirty: boolean
  tabs: CeTab[]
  fields: CeField[]
}

export type CePage = {
  pageType: string | null
  entityName: string | null
  entityId: string | null
  viewId: string | null
  viewType: string | null
}

export type CeEnvironment = {
  clientUrl: string
  orgUniqueName: string
  orgId: string
  version: string
  environmentId: string | null
  friendlyName: string | null
  geo: string | null
  tenantId: string | null
}

export type CeUser = {
  name: string
  id: string
  roles: string[]
  languageId: number | null
  timeZoneOffsetMinutes: number | null
}

export type CeApp = {
  id: string
  displayName: string
  uniqueName: string
}

/** Page-side toggles the panel shows as on/off. */
export type CeModes = {
  godMode: boolean
  logicalNames: boolean
  blurred: boolean
}

export type CeState = {
  environment: CeEnvironment
  user: CeUser
  app: CeApp | null
  page: CePage
  form: CeForm | null
  modes: CeModes
}

/** A table from the metadata API, for searching by name. */
export type CeEntity = {
  logicalName: string
  displayName: string | null
  entitySetName: string | null
  objectTypeCode: number | null
  custom: boolean
}

export type CeColumn = { name: string; value: string; formatted: string | null }

/** Commands the panel can run in the page, with their arguments and results. */
export type CeCommands = {
  godMode: { args: void; result: { controls: number } }
  logicalNames: { args: { on: boolean }; result: void }
  expandTabs: { args: void; result: { tabs: number } }
  refreshSubgrids: { args: void; result: { grids: number } }
  fillRequired: { args: void; result: { filled: string[]; skipped: string[] } }
  clone: { args: void; result: { fields: number } }
  refresh: { args: void; result: void }
  save: { args: void; result: void }
  blur: { args: { on: boolean }; result: void }
  allColumns: { args: void; result: CeColumn[] }
  viewFetchXml: {
    args: void
    result: { name: string; fetchXml: string; entitySetName: string }
  }
  entities: { args: void; result: CeEntity[] }
  myMailbox: { args: void; result: { id: string | null } }
}

export type CeCommand = keyof CeCommands

export type CeCommandMessage = {
  type: typeof CE_COMMAND
  id: number
  command: CeCommand
  args: unknown
}

export type CeResultMessage = {
  type: typeof CE_RESULT
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

/** Side panel ↔ content script. */
export type CeRequest =
  | { type: "ce:ping" }
  | { type: "ce:command"; command: CeCommand; args: unknown }

export type CeEvent = { type: "ce:state"; state: CeState | null }

export type CeCommandResponse = {
  ok: boolean
  result?: unknown
  error?: string
}
