/** What the panel shows about the current BC page, read from the web client's own form model. */

/** window.postMessage types between main-world.ts and bc-content.ts (same frame). */
export const PAGE_MESSAGE = "dynamic-assist:bc-page"
export const REQUEST_MESSAGE = "dynamic-assist:bc-page-request"
/** Content script → page world: run a page tool ({ id, command, on }) */
export const TOOL_MESSAGE = "dynamic-assist:bc-tool"
/** Page world → content script: what the tool did ({ id, message }) */
export const TOOL_RESULT_MESSAGE = "dynamic-assist:bc-tool-result"

/** The page tools (page-tools.ts) */
export type BcToolCommand = "fieldNames" | "blur" | "expandTabs" | "appNames"
/** Which toggles are on in the page */
export type BcToolModes = { fieldNames: boolean; blur: boolean }

export type FieldClass = "Normal" | "FlowField" | "FlowFilter"

export type BcField = {
  fieldNo: number
  /** Table field name as best the client knows it (see schemaNameOf). */
  schemaName: string
  /** Page control name. */
  controlName: string | null
  caption: string | null
  value: string | null
  /** Data type as far as the control shows it: "Text/Code[20]", "Decimal", "Option/Enum"… */
  dataType: string
  fieldClass: FieldClass
  editable: boolean
  visible: boolean
  promoted: boolean
  /** FastTab (or first captioned group) the field sits in. */
  group: string | null
  /** The app that added the control, when it isn't the page's own app. */
  appId: string | null
  appName: string | null
}

type BcApp = {
  id: string
  name: string
  publisher: string
  version: string
}

export type BcForm = {
  pageId: number
  name: string
  caption: string | null
  pageType: string
  tableId: number | null
  primaryKey: number[]
  bookmark: string | null
  systemId: string | null
  app: BcApp | null
  fields: BcField[]
}

export type BcSession = {
  userName: string | null
  displayName: string | null
  upn: string | null
  userSecurityId: string | null
  isTenantAdmin: boolean | null
  profile: { id: string; caption: string } | null
  company: { name: string; id: string | null; indicator: string | null } | null
  language: string | null
  timeZone: string | null
}

export type BcPageInfo = {
  environment: {
    name: string | null
    type: string | null
    platform: string | null
    /** Entra tenant ID, from the session (the URL may not carry it) */
    aadTenantId: string | null
  }
  session: BcSession | null
  /** The page tools that are on */
  tools?: BcToolModes
  form: BcForm
  parts: BcForm[]
}

// AL PageType order; matches the numbers the client uses (List = 1, CardPart = 3, ListPart = 4).
const PAGE_TYPES = [
  "Card",
  "List",
  "RoleCenter",
  "CardPart",
  "ListPart",
  "Document",
  "Worksheet",
  "ListPlus",
  "ConfirmationDialog",
  "NavigatePage",
  "StandardDialog",
  "API",
  "HeadlinePart",
  "PromptDialog",
  "UserControlHost",
]

export function pageTypeName(value: number): string {
  return PAGE_TYPES[value] ?? `Type ${value}`
}

export const FIELD_CLASSES: FieldClass[] = ["Normal", "FlowField", "FlowFilter"]

/**
 * The client only knows the page control's name. It usually is the table field's
 * name, but BC appends a number when two controls would share one
 * ("Global Dimension 2 Code37442"), so a run of 4+ digits stuck to the end is dropped.
 */
export function schemaNameOf(
  controlName: string | null,
  caption: string | null
): string {
  if (!controlName) return caption ?? ""
  return controlName.replace(/(?<=[^\d\s])\d{4,}$/, "")
}

/** Rec."Field Name", quoted the way AL needs it. */
export function alReference(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? `Rec.${name}` : `Rec."${name}"`
}

/** camelCase, the way BC's API pages name fields ("Global Dimension 2 Code" → globalDimension2Code). */
export function apiName(name: string): string {
  const words = name
    .replace(/%/g, " Pct ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  return words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("")
}

/** OData web service element names: non-alphanumerics become underscores ("No." → No). */
export function odataName(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

/** Fields as { "Schema Name": "value" }, for the Copy JSON buttons. */
export function fieldsToJson(fields: BcField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.schemaName, f.value ?? ""]))
}

// Control type → the data type it implies. Strings can't tell Code from Text.
const DATA_TYPES: Record<string, string> = {
  StringControl: "Text/Code",
  DecimalControl: "Decimal",
  IntegerControl: "Integer",
  BigIntegerControl: "BigInteger",
  BooleanControl: "Boolean",
  SelectionControl: "Option/Enum",
  DateControl: "Date",
  DateTimeControl: "DateTime",
  TimeControl: "Time",
  DurationControl: "Duration",
  GuidControl: "Guid",
  MediaControl: "Media",
  MediaSetControl: "MediaSet",
  BlobControl: "Blob",
}

/** The data type a BC control implies, e.g. "Text/Code[20]". Never throws. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- BC's client model is untyped
export function dataTypeOf(control: any): string {
  const read = <T>(fn: () => T): T | null => {
    try {
      return fn() ?? null
    } catch {
      return null
    }
  }
  const type: string = read(() => control.typeName) ?? ""
  const base = DATA_TYPES[type] ?? type.replace(/Control$/, "")
  const max = read(() => control.maximumStringLength)
  return type === "StringControl" && typeof max === "number" && max > 0
    ? `${base}[${max}]`
    : base
}
