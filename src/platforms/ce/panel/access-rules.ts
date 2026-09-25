/**
 * What a user's levels mean for a form's lookups and subgrids, in the words
 * someone would use to report it ("the lookup is blank"). The Dataverse rules:
 *
 * - Seeing a lookup's value needs Read on the table it points to.
 * - Setting a lookup needs Append on this table and Append To on the target.
 * - A subgrid lists rows the user can Read; "+ New" needs Create on the child.
 * - Adding an existing row to a subgrid sets the child's lookup to this record:
 *   Append on the child and Append To on this table.
 */
import type { CeDepth, CePermissions, CeRelatedAccess } from "../types"

const has = (d: CeDepth | undefined) => !!d && d !== "None"

export type AccessIssue = { text: string; severity: "blocked" | "limited" }

function mainLevel(main: CePermissions, type: "Append" | "AppendTo") {
  return main.privileges.find((p) => p.type === type)?.depth ?? "None"
}

export function relatedIssues(
  rel: CeRelatedAccess,
  main: CePermissions
): AccessIssue[] {
  const issues: AccessIssue[] = []
  if (rel.kind === "lookup") {
    if (!has(rel.read))
      issues.push({
        severity: "blocked",
        text: `Can't read ${rel.tableLabel}: the lookup shows blank or "No name".`,
      })
    if (!has(mainLevel(main, "Append")))
      issues.push({
        severity: "blocked",
        text: `Can't set it: needs Append on ${main.entityName}.`,
      })
    if (!has(rel.appendTo))
      issues.push({
        severity: "blocked",
        text: `Can't set it: needs Append To on ${rel.tableLabel}.`,
      })
  } else {
    if (!has(rel.read))
      issues.push({
        severity: "blocked",
        text: `Can't read ${rel.tableLabel}: the subgrid shows no rows.`,
      })
    if (!has(rel.create))
      issues.push({
        severity: "limited",
        text: `No "+ New": needs Create on ${rel.tableLabel}.`,
      })
    if (!has(rel.append) || !has(mainLevel(main, "AppendTo")))
      issues.push({
        severity: "limited",
        text: `Can't add existing rows: needs Append on ${rel.tableLabel} and Append To on ${main.entityName}.`,
      })
  }
  return issues
}

export const SHORT_DEPTH: Record<CeDepth, string> = {
  None: "None",
  Basic: "User",
  Local: "BU",
  Deep: "BU + child",
  Global: "Org",
}
