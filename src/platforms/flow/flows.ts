/**
 * Solution-aware cloud flows, environment variables and connection references
 * in Dataverse. Cloud flows are workflow rows with category 5; the ID in a
 * Power Automate URL is the row's resourceid. Turning a flow on or off is a
 * state change on that row, made as you, so your roles decide what's allowed.
 */
import { dataverse, dataverseAll, formatted } from "@/lib/dataverse"

export type Flow = {
  workflowid: string
  resourceid: string | null
  name: string
  on: boolean
  /** "Activated", "Draft", "Suspended": the formatted status reason */
  status: string
  modifiedon: string
  owner: string | null
  managed: boolean
}

type Row = Record<string, unknown>

const FLOW_SELECT =
  "workflowid,resourceid,name,statecode,statuscode,modifiedon,_ownerid_value,ismanaged"

const toFlow = (r: Row): Flow => ({
  workflowid: r.workflowid as string,
  resourceid: (r.resourceid as string | null) ?? null,
  name: r.name as string,
  on: r.statecode === 1,
  status: formatted(r, "statuscode") ?? String(r.statuscode),
  modifiedon: r.modifiedon as string,
  owner: formatted(r, "_ownerid_value"),
  managed: r.ismanaged === true,
})

/** IDs of every component in a solution. */
async function solutionObjects(org: string, solutionId: string) {
  const rows = await dataverseAll<{ objectid: string }>(
    org,
    `solutioncomponents?$select=objectid&$filter=_solutionid_value eq ${solutionId}`
  )
  return new Set(rows.map((r) => r.objectid.toLowerCase()))
}

/** Cloud flows, in a solution or the whole environment, by name. */
export async function listFlows(org: string, solutionId?: string | null) {
  const [rows, inSolution] = await Promise.all([
    dataverseAll<Row>(
      org,
      `workflows?$select=${FLOW_SELECT}&$filter=category eq 5 and type eq 1&$orderby=name`
    ),
    solutionId ? solutionObjects(org, solutionId) : Promise.resolve(null),
  ])
  const flows = rows.map(toFlow)
  return inSolution
    ? flows.filter((f) => inSolution.has(f.workflowid.toLowerCase()))
    : flows
}

export type FlowDetail = Flow & {
  description: string | null
  /** The flow's definition, connection references and schema */
  definition: unknown
}

/** One flow by its Power Automate ID (or its workflow ID). */
export async function getFlow(org: string, id: string) {
  const rows = await dataverseAll<Row>(
    org,
    `workflows?$select=${FLOW_SELECT},description,clientdata&$filter=resourceid eq ${id} or workflowid eq ${id}`
  )
  const row = rows[0]
  if (!row) return null
  let definition: unknown
  try {
    definition = JSON.parse((row.clientdata as string) ?? "null")
  } catch {
    definition = row.clientdata
  }
  return {
    ...toFlow(row),
    description: (row.description as string | null) ?? null,
    definition,
  } satisfies FlowDetail
}

/** Turns a flow on (Activated) or off (Draft). */
export function setFlowOn(org: string, workflowId: string, on: boolean) {
  return dataverse(org, `workflows(${workflowId})`, {
    method: "PATCH",
    body: on
      ? { statecode: 1, statuscode: 2 }
      : { statecode: 0, statuscode: 1 },
  })
}

export type FlowRun = {
  id: string
  flow: string | null
  workflowId: string | null
  status: string
  start: string
  end: string | null
  error: string | null
}

/**
 * Recent runs from Dataverse's flowrun table (kept for 28 days by default):
 * failed ones only unless `all`.
 */
export async function listRuns(
  org: string,
  {
    workflowId,
    all = false,
    top = 50,
    solutionId,
  }: {
    workflowId?: string
    all?: boolean
    top?: number
    /** Only runs of this solution's flows */
    solutionId?: string | null
  } = {}
) {
  // A solution's flows as an or-filter; big solutions filter after reading
  const inSolution = solutionId
    ? (await listFlows(org, solutionId)).map((f) => f.workflowid)
    : null
  if (inSolution && !inSolution.length) return []
  const short = inSolution && inSolution.length <= 40
  const filters = [
    all ? null : "status eq 'Failed'",
    workflowId ? `_workflow_value eq ${workflowId}` : null,
    short
      ? `(${inSolution.map((id) => `_workflow_value eq ${id}`).join(" or ")})`
      : null,
  ].filter(Boolean)
  const page = await dataverse<{ value: Row[] }>(
    org,
    `flowruns?$select=name,status,starttime,endtime,errorcode,errormessage,_workflow_value` +
      (filters.length ? `&$filter=${filters.join(" and ")}` : "") +
      `&$orderby=starttime desc&$top=${inSolution && !short ? 500 : top}`
  )
  const wanted = inSolution && !short ? new Set(inSolution) : null
  return page.value
    .filter((r) => !wanted || wanted.has(r._workflow_value as string))
    .slice(0, top)
    .map((r): FlowRun => ({
      id: r.name as string,
      flow: formatted(r, "_workflow_value"),
      workflowId: (r._workflow_value as string | null) ?? null,
      status: r.status as string,
      start: r.starttime as string,
      end: (r.endtime as string | null) ?? null,
      error: runError(r.errorcode, r.errormessage),
    }))
}

/** "ActionFailed: An action failed…": the message out of the JSON Dataverse keeps */
function runError(code: unknown, message: unknown) {
  let text = typeof message === "string" ? message : ""
  try {
    const parsed = JSON.parse(text) as { message?: string }
    if (parsed?.message) text = parsed.message
  } catch {
    // Plain text already
  }
  return [code, text].filter(Boolean).join(": ") || null
}

export type EnvVariable = {
  id: string
  schemaName: string
  displayName: string
  type: string
  defaultValue: string | null
  /** The environment's own value, when it has one */
  value: string | null
}

/** Environment variables and their current values. */
export async function listEnvVariables(
  org: string,
  solutionId?: string | null
) {
  const [rows, inSolution] = await Promise.all([
    dataverseAll<Row>(
      org,
      "environmentvariabledefinitions?$select=environmentvariabledefinitionid,schemaname,displayname,type,defaultvalue" +
        "&$expand=environmentvariabledefinition_environmentvariablevalue($select=value)&$orderby=schemaname"
    ),
    solutionId ? solutionObjects(org, solutionId) : Promise.resolve(null),
  ])
  return rows
    .filter(
      (r) =>
        !inSolution ||
        inSolution.has(
          (r.environmentvariabledefinitionid as string).toLowerCase()
        )
    )
    .map((r): EnvVariable => ({
      id: r.environmentvariabledefinitionid as string,
      schemaName: r.schemaname as string,
      displayName: (r.displayname as string) ?? (r.schemaname as string),
      type: formatted(r, "type") ?? String(r.type),
      defaultValue: (r.defaultvalue as string | null) ?? null,
      value:
        (
          r.environmentvariabledefinition_environmentvariablevalue as
            { value: string | null }[] | undefined
        )?.[0]?.value ?? null,
    }))
}

export type ConnectionReference = {
  id: string
  logicalName: string
  displayName: string
  connector: string
  connectionId: string | null
}

/** Connection references; one without a connection breaks its flows. */
export async function listConnectionReferences(
  org: string,
  solutionId?: string | null
) {
  const [rows, inSolution] = await Promise.all([
    dataverseAll<Row>(
      org,
      "connectionreferences?$select=connectionreferenceid,connectionreferencelogicalname,connectionreferencedisplayname,connectorid,connectionid&$orderby=connectionreferencelogicalname"
    ),
    solutionId ? solutionObjects(org, solutionId) : Promise.resolve(null),
  ])
  return rows
    .filter(
      (r) =>
        !inSolution ||
        inSolution.has((r.connectionreferenceid as string).toLowerCase())
    )
    .map((r): ConnectionReference => ({
      id: r.connectionreferenceid as string,
      logicalName: r.connectionreferencelogicalname as string,
      displayName:
        (r.connectionreferencedisplayname as string) ??
        (r.connectionreferencelogicalname as string),
      connector: ((r.connectorid as string) ?? "").split("/").pop() ?? "",
      connectionId: (r.connectionid as string | null) ?? null,
    }))
}

/**
 * Solutions you can see, for picking one when the URL doesn't name it: your
 * own (unmanaged) first, without the system-wide Default and Active ones.
 */
export async function listSolutions(org: string) {
  const rows = await dataverseAll<Row>(
    org,
    "solutions?$select=solutionid,uniquename,friendlyname,ismanaged&$filter=isvisible eq true&$orderby=friendlyname"
  )
  return rows
    .filter((r) => !["Default", "Active"].includes(r.uniquename as string))
    .sort((a, b) => Number(a.ismanaged) - Number(b.ismanaged))
    .map((r) => ({
      id: r.solutionid as string,
      name: (r.friendlyname as string) ?? (r.uniquename as string),
      uniqueName: r.uniquename as string,
      managed: r.ismanaged === true,
    }))
}
