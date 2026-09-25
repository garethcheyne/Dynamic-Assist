/** Shapes shared by the CE page-world script, its content script relay and the side panel. */

/** window.postMessage types between main-world.ts and ce-content.ts (top frame only). */
export const CE_STATE = "dynamic-assist:ce-state"
export const CE_STATE_REQUEST = "dynamic-assist:ce-state-request"
export const CE_COMMAND = "dynamic-assist:ce-command"
export const CE_RESULT = "dynamic-assist:ce-result"

type CeFieldType =
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

type CeLookup = { id: string; name: string | null; entityType: string }

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

type CeTab = {
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

type CeUser = {
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

/** Privilege levels, from none to the whole organisation. */
export type CeDepth = "None" | "Basic" | "Local" | "Deep" | "Global"

export type CePrivilegeType =
  | "Create"
  | "Read"
  | "Write"
  | "Delete"
  | "Append"
  | "AppendTo"
  | "Assign"
  | "Share"

/** What a user can do with a table, and with one record of it. */
export type CePermissions = {
  user: { id: string; name: string }
  entityName: string
  /** Highest level any of the user's roles grants, per privilege */
  privileges: { type: CePrivilegeType; name: string; depth: CeDepth }[]
  /** Rights on the open record (RetrievePrincipalAccess), when there is one */
  recordAccess: string[] | null
}

/** Levels on a related table, for the form's lookups and subgrids */
export type CeRelatedAccess = {
  /** The form control: a lookup or a subgrid */
  kind: "lookup" | "subgrid"
  control: string
  label: string
  table: string
  tableLabel: string
  read: CeDepth
  create: CeDepth
  append: CeDepth
  appendTo: CeDepth
}

/** A column-security field and what the user may do with it */
export type CeSecuredColumn = {
  column: string
  label: string
  read: boolean
  update: boolean
  create: boolean
}

/** Where a user's access to a record comes from, besides their roles' levels */
export type CeRecordReasons = {
  owner: {
    name: string
    kind: "user" | "team"
    isUser: boolean
    isUsersTeam: boolean
  }
  /** Shares that reach the user: to them, a team they are in, or everyone */
  shares:
    | {
        principal: string
        kind: "user" | "team" | "organization"
        rights: string[]
      }[]
    | null
  userBusinessUnit: string | null
  recordBusinessUnit: string | null
  sameBusinessUnit: boolean
}

/** Access beyond the table: the form's related tables, secured columns, the record */
export type CeAccessDetail = {
  user: { id: string; name: string }
  related: CeRelatedAccess[]
  /** null when the org wouldn't say (no permission to read field security) */
  secured: CeSecuredColumn[] | null
  /** The user has System Administrator, which sees every secured column */
  systemAdministrator: boolean
  record: CeRecordReasons | null
}

/** A user's security roles: their own, and those they get from teams */
export type CeUserRoles = {
  user: { id: string; name: string; businessUnit: string | null }
  direct: string[]
  /** Role name and the team it comes from */
  viaTeams: { role: string; team: string }[]
}

export type CeUserSummary = {
  id: string
  name: string
  domainName: string | null
}

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
  permissions: {
    args: {
      entityName: string
      recordId?: string | null
      userId?: string | null
    }
    result: CePermissions
  }
  searchUsers: { args: { query: string }; result: CeUserSummary[] }
  userRoles: { args: { userId?: string | null }; result: CeUserRoles }
  accessDetail: {
    args: {
      entityName: string
      recordId?: string | null
      userId?: string | null
    }
    result: CeAccessDetail
  }
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
