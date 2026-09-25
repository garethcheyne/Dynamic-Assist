/** The query as AL a developer can paste into a codeunit. */
import {
  alName,
  type BcField,
  type BcJoin,
  type BcQuery,
  type BcTable,
} from "./bridge"

/** Related tables a query joins, by table number: name and fields */
export type RelatedTables = Record<
  number,
  { name: string; caption: string; fields: BcField[] }
>

/** Quotes an AL identifier when it isn't a plain one: "No.", "Sell-to Customer No." */
export const ident = (field: string) => {
  const name = alName(field)
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    ? name
    : `"${name.replace(/"/g, '""')}"`
}

export const literal = (text: string) => `'${text.replace(/'/g, "''")}'`

/** A variable name from a table name: "Salesperson/Purchaser" → SalespersonPurchaser */
export function pascal(name: string) {
  const joined = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("")
  return /^[A-Za-z]/.test(joined) ? joined : `T${joined}`
}

/** Joins with what's needed to write them, in order; ones we can't describe are skipped */
export function describeJoins(
  query: BcQuery,
  fields: BcField[],
  related: RelatedTables
) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  return (query.joins ?? []).flatMap((join: BcJoin) => {
    const table = related[join.table]
    const from = byNo.get(join.field)
    const key = table?.fields.find((f) => f.no === join.key)
    if (!table || !from || !key) return []
    const relatedByNo = new Map(table.fields.map((f) => [f.no, f]))
    const columns = join.fields
      .map((no) => relatedByNo.get(no))
      .filter(Boolean) as BcField[]
    const filters = join.filters
      .filter((f) => (f.filter ?? "").trim() && relatedByNo.has(f.field))
      .map((f) => ({
        field: relatedByNo.get(f.field)!,
        filter: (f.filter ?? "").trim(),
      }))
    return [{ join, table, from, key, columns, filters }]
  })
}

export function toAl(
  query: BcQuery,
  table: BcTable,
  fields: BcField[],
  related: RelatedTables = {}
) {
  const byNo = new Map(fields.map((f) => [f.no, f]))
  const name = (no: number) => ident(byNo.get(no)?.name ?? `Field${no}`)
  const columns = query.fields
    .map((no) => byNo.get(no))
    .filter(Boolean) as BcField[]
  const loadable = columns.filter((f) => f.class === "Normal")
  const flowFields = columns.filter((f) => f.class === "FlowField")
  const filters = query.filters.filter((f) => (f.filter ?? "").trim())

  // One record variable per join, named after its table
  const used = new Set(["Rec"])
  const joins = describeJoins(query, fields, related).map((j) => {
    let variable = pascal(j.table.name)
    for (let i = 2; used.has(variable); i++)
      variable = `${pascal(j.table.name)}${i}`
    used.add(variable)
    return { ...j, variable }
  })

  const lines = [
    "var",
    `    Rec: Record ${ident(table.name)};`,
    ...joins.map((j) => `    ${j.variable}: Record ${ident(j.table.name)};`),
    "begin",
  ]
  if (loadable.length)
    lines.push(
      `    Rec.SetLoadFields(${loadable.map((f) => ident(f.name)).join(", ")});`
    )
  if (query.sort.length)
    lines.push(`    Rec.SetCurrentKey(${query.sort.map(name).join(", ")});`)
  if (query.descending) lines.push("    Rec.Ascending(false);")
  for (const f of filters)
    lines.push(
      `    Rec.SetFilter(${name(f.field)}, ${literal((f.filter ?? "").trim())});`
    )
  for (const j of joins) {
    const load = j.columns.filter((f) => f.class === "Normal")
    if (load.length)
      lines.push(
        `    ${j.variable}.SetLoadFields(${load.map((f) => ident(f.name)).join(", ")});`
      )
    for (const f of j.filters)
      lines.push(
        `    ${j.variable}.SetFilter(${ident(f.field.name)}, ${literal(f.filter)});`
      )
  }
  lines.push("    if Rec.FindSet() then", "        repeat")
  if (flowFields.length)
    lines.push(
      `            Rec.CalcFields(${flowFields.map((f) => ident(f.name)).join(", ")});`
    )
  for (const j of joins) {
    const flow = j.columns.filter((f) => f.class === "FlowField")
    const restricts = j.join.inner || j.filters.length > 0
    lines.push(
      `            ${j.variable}.SetRange(${ident(j.key.name)}, Rec.${ident(j.from.name)});`
    )
    if (restricts) {
      lines.push(
        `            if ${j.variable}.FindFirst() then begin`,
        ...(flow.length
          ? [
              `                ${j.variable}.CalcFields(${flow.map((f) => ident(f.name)).join(", ")});`,
            ]
          : []),
        "                // Only rows with a match get here",
        "            end;"
      )
    } else {
      lines.push(
        `            if not ${j.variable}.FindFirst() then`,
        `                ${j.variable}.Init();`
      )
      if (flow.length)
        lines.push(
          `            ${j.variable}.CalcFields(${flow.map((f) => ident(f.name)).join(", ")});`
        )
    }
  }
  lines.push("            // ...", "        until Rec.Next() = 0;", "end;")
  return lines.join("\n")
}
