/**
 * A table's choice columns and their options, from the Web API's attribute
 * metadata. Options can't be expanded from the base Attributes collection, so
 * each attribute type is its own request; this file builds those paths and
 * reads the answers, and main-world.ts does the fetching.
 */
import type { CeOptionSetColumn } from "./types"

type Label = { UserLocalizedLabel?: { Label?: string } | null }
type OptionMetadata = { Value?: number | null; Label?: Label }
type OptionSetMetadata = {
  Name?: string
  IsGlobal?: boolean
  Options?: OptionMetadata[]
  TrueOption?: OptionMetadata
  FalseOption?: OptionMetadata
}
type AttributeMetadata = {
  LogicalName: string
  DisplayName?: Label
  OptionSet?: OptionSetMetadata | null
  GlobalOptionSet?: OptionSetMetadata | null
}

/** Each attribute type with options, what the panel calls it, and what its option set holds. */
export const OPTION_SET_CASTS = [
  { cast: "PicklistAttributeMetadata", kind: "Choice", select: "Options" },
  {
    cast: "MultiSelectPicklistAttributeMetadata",
    kind: "Choices",
    select: "Options",
  },
  { cast: "StateAttributeMetadata", kind: "Status", select: "Options" },
  { cast: "StatusAttributeMetadata", kind: "Status reason", select: "Options" },
  {
    cast: "BooleanAttributeMetadata",
    kind: "Yes/No",
    select: "TrueOption,FalseOption",
  },
] as const

export type OptionSetCast = (typeof OPTION_SET_CASTS)[number]

/**
 * Web API paths for one attribute type, widest first: a column bound to a
 * global option set only answers under GlobalOptionSet, and a type that
 * rejects the wider expand gets the narrower one.
 */
export function optionSetPaths(entity: string, c: OptionSetCast): string[] {
  const base = `EntityDefinitions(LogicalName='${entity}')/Attributes/Microsoft.Dynamics.CRM.${c.cast}?$select=LogicalName,DisplayName&$expand=`
  const local = `OptionSet($select=Name,IsGlobal,${c.select})`
  return [
    `${base}${local},GlobalOptionSet($select=Name,IsGlobal,${c.select})`,
    `${base}${local}`,
  ]
}

const label = (l?: Label) => l?.UserLocalizedLabel?.Label || null

/** One attribute type's answer as panel rows. */
export function readOptionSetColumns(
  c: OptionSetCast,
  body: { value?: AttributeMetadata[] } | null
): CeOptionSetColumn[] {
  return (body?.value ?? []).map((a) => {
    const set = a.OptionSet ?? a.GlobalOptionSet ?? null
    const options =
      c.kind === "Yes/No"
        ? [
            { value: 1, text: label(set?.TrueOption?.Label) ?? "Yes" },
            { value: 0, text: label(set?.FalseOption?.Label) ?? "No" },
          ]
        : (set?.Options ?? [])
            .filter((o) => typeof o.Value === "number")
            .map((o) => ({
              value: o.Value as number,
              text: label(o.Label) ?? String(o.Value),
            }))
    return {
      logicalName: a.LogicalName,
      label: label(a.DisplayName),
      kind: c.kind,
      optionSet: set?.Name ?? null,
      global: set?.IsGlobal === true,
      options,
    }
  })
}

/** The option values the field holds now: a number, a list of them, or true/false. */
export function selectedValues(raw: string): Set<number> {
  try {
    const v: unknown = JSON.parse(raw)
    const all = Array.isArray(v) ? v : [v]
    return new Set(
      all.flatMap((x) =>
        typeof x === "number" ? [x] : typeof x === "boolean" ? [x ? 1 : 0] : []
      )
    )
  } catch {
    return new Set()
  }
}
