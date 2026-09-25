/**
 * A stand-in for the chrome.* APIs (and the Dataverse Web API) so the real,
 * built side panel renders with made-up demo data: CRONUS, Contoso, Adventure
 * Works and invented flows. Nothing here talks to a real service.
 *
 * mockScript(scenario) returns source to run before the page's own scripts.
 */
import fs from "node:fs"

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"))

const HOUR = 3600_000

/** History entries: fictitious environments only */
const history = (now) => [
  { key: "bc:1", platform: "bc", title: "Production", subtitle: "CRONUS NZ", label: "CRONUS live", pinned: true, url: "https://businesscentral.dynamics.com/contoso.onmicrosoft.com/Production/?company=CRONUS%20NZ", envType: "production", lastVisited: now - 0.2 * HOUR, visits: 42 },
  { key: "ce:contoso.crm.dynamics.com", platform: "ce", title: "Contoso Sales (Sandbox)", subtitle: "Sales Hub", pinned: true, url: "https://contoso.crm.dynamics.com/main.aspx", envType: null, environmentId: "7d3c1f0a-2b4e-4c8d-9a61-3f5e8b2c7d10", lastVisited: now - 2 * HOUR, visits: 18 },
  { key: "bc:2", platform: "bc", title: "Sandbox", subtitle: "CRONUS NZ", url: "https://businesscentral.dynamics.com/contoso.onmicrosoft.com/Sandbox/?company=CRONUS%20NZ", envType: "sandbox", lastVisited: now - 0.05 * HOUR, visits: 9 },
  { key: "bc:3", platform: "bc", title: "UAT", subtitle: "CRONUS AU", url: "https://businesscentral.dynamics.com/contoso.onmicrosoft.com/UAT/?company=CRONUS%20AU", envType: "sandbox", lastVisited: now - 26 * HOUR, visits: 3 },
  { key: "maker:1", platform: "maker", title: "Contoso Sales (Sandbox)", subtitle: "Power Apps", url: "https://make.powerapps.com/environments/7d3c1f0a-2b4e-4c8d-9a61-3f5e8b2c7d10/home", envType: null, environmentId: "7d3c1f0a-2b4e-4c8d-9a61-3f5e8b2c7d10", lastVisited: now - 72 * HOUR, visits: 4 },
]

/** Dataverse rows for the Power Automate panel, as the Web API returns them */
function dataverse(flow) {
  const guid = (n, kind) =>
    `${kind}${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`
  const F = "@OData.Community.Display.V1.FormattedValue"
  const now = Date.now()
  const workflows = flow.flows.map(([name, on], i) => ({
    workflowid: guid(i + 1, "a"),
    resourceid: guid(i + 1, "b"),
    name,
    statecode: on ? 1 : 0,
    statuscode: on ? 2 : 1,
    [`statuscode${F}`]: on ? "Activated" : "Draft",
    modifiedon: new Date(now - (i + 1) * 5 * HOUR).toISOString(),
    _ownerid_value: "c0000001-0000-4000-8000-000000000001",
    [`_ownerid_value${F}`]: i % 3 ? "Alex Wilber" : "Megan Bowen",
    ismanaged: false,
    description: null,
    clientdata: JSON.stringify({ properties: { definition: { triggers: {}, actions: {} } } }),
  }))
  const refs = flow.connectionReferences.map(([display, connector, ok], i) => ({
    connectionreferenceid: guid(i + 1, "c"),
    connectionreferencelogicalname: `contoso_${connector}_${i}`,
    connectionreferencedisplayname: display,
    connectorid: `/providers/Microsoft.PowerApps/apis/${connector}`,
    connectionid: ok ? `${connector}-${guid(i + 1, "d").slice(0, 8)}` : null,
  }))
  const vars = flow.envVariables.map(([display, schema, type, def, value], i) => ({
    environmentvariabledefinitionid: guid(i + 1, "e"),
    schemaname: schema,
    displayname: display,
    type: type === "Number" ? 100000001 : 100000000,
    [`type${F}`]: type,
    defaultvalue: def,
    environmentvariabledefinition_environmentvariablevalue: value === null ? [] : [{ value }],
  }))
  const runs = flow.runs.map(([name, status, error, minutesAgo], i) => {
    const wf = workflows.find((w) => w.name === name)
    const [code, ...rest] = error.split(": ")
    return {
      name: `0858${String(i).padStart(10, "7")}CU${i}`,
      status,
      starttime: new Date(now - minutesAgo * 60_000).toISOString(),
      endtime: new Date(now - minutesAgo * 60_000 + 4000).toISOString(),
      errorcode: code,
      errormessage: JSON.stringify({ code, message: rest.join(": ") }),
      _workflow_value: wf?.workflowid,
      [`_workflow_value${F}`]: name,
    }
  })
  const components = [...workflows.map((w) => w.workflowid), ...refs.map((r) => r.connectionreferenceid), ...vars.map((v) => v.environmentvariabledefinitionid)]
  return { workflows, refs, vars, runs, components }
}

export function mockScript(scenario) {
  const now = Date.now()
  const bc = read("bc")
  const ce = read("ce")
  const flow = read("flow")
  const dv = dataverse(flow)
  const url = scenario === "bc" ? bc.url : scenario === "ce" ? ce.url : scenario === "flow" ? flow.url : "https://example.com/"

  return `(() => {
  const SCENARIO = ${JSON.stringify(scenario)}
  const URL_ = ${JSON.stringify(url)}
  const BC = ${JSON.stringify(bc)}
  const CE = ${JSON.stringify(ce)}
  const FLOW = ${JSON.stringify({ org: flow.org, environmentId: flow.environmentId })}
  const DV = ${JSON.stringify(dv)}
  const store = { local: { history: ${JSON.stringify(history(now))}, "links.bcOrg": { "contoso.onmicrosoft.com/production/cronus nz": "https://contoso.crm.dynamics.com" } }, session: {}, sync: {} }
  const changed = []
  const listeners = []
  const noop = { addListener() {}, removeListener() {}, hasListener: () => false }
  try { localStorage.setItem("theme", ${JSON.stringify(process.env.THEME ?? "light")}) } catch {}

  const area = (name) => ({
    get: async (keys) => {
      const all = store[name]
      if (keys == null) return { ...all }
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys)
      return Object.fromEntries(list.filter((k) => k in all).map((k) => [k, all[k]]))
    },
    set: async (items) => {
      Object.assign(store[name], items)
      const changes = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { newValue: v }]))
      changed.forEach((f) => f(changes, name))
    },
    remove: async () => {},
  })

  const emitState = () => setTimeout(() => {
    if (SCENARIO === "bc")
      listeners.forEach((f) => f({ type: "bc:state", state: { url: URL_, isTop: false, page: BC.page } }, { tab: { id: 1 }, frameId: 5 }))
    if (SCENARIO === "ce")
      listeners.forEach((f) => f({ type: "ce:state", state: CE.state }, { tab: { id: 1 }, frameId: 0 }))
  }, 30)

  window.chrome = {
    runtime: {
      id: "dynamic-assist-demo",
      getManifest: () => ({ name: "Dynamic Assist", version: "2026.9.24" }),
      getURL: (p) => "/" + p,
      sendMessage: async () => undefined,
      onMessage: { addListener: (f) => listeners.push(f), removeListener() {} },
    },
    tabs: {
      query: async () => [{ id: 1, windowId: 1, active: true, url: URL_, title: "Demo" }],
      onActivated: noop,
      onUpdated: noop,
      onRemoved: noop,
      create: async () => ({ id: 2 }),
      sendMessage: async (_id, msg) => {
        if (msg?.type === "ce:command") {
          if (msg.command === "permissions") return { ok: true, result: { user: msg.args?.userId === "u2" ? { id: "u2", name: "Megan Bowen" } : { id: "u1", name: "Alex Wilber" }, entityName: "account", privileges: [["Create","Global"],["Read","Global"],["Write","Deep"],["Delete","Local"],["Append","Global"],["AppendTo","Global"],["Assign","Basic"],["Share","None"]].map(([type, depth]) => ({ type, depth, name: "prv" + type + "Account" })), recordAccess: ["ReadAccess","WriteAccess","AppendAccess","AppendToAccess","CreateAccess","DeleteAccess"] } }
          if (msg.command === "accessDetail") return { ok: true, result: {"user":{"id":"u1","name":"Alex Wilber"},"related":[{"kind":"lookup","control":"primarycontactid","label":"Primary Contact","table":"contact","tableLabel":"Contact","read":"Global","create":"Global","append":"Global","appendTo":"Global"},{"kind":"lookup","control":"parentaccountid","label":"Parent Account","table":"account","tableLabel":"Account","read":"Global","create":"Global","append":"Global","appendTo":"Global"},{"kind":"lookup","control":"transactioncurrencyid","label":"Currency","table":"transactioncurrency","tableLabel":"Currency","read":"Global","create":"None","append":"None","appendTo":"None"},{"kind":"subgrid","control":"Contacts","label":"Contacts","table":"contact","tableLabel":"Contact","read":"Global","create":"Global","append":"Global","appendTo":"Global"},{"kind":"subgrid","control":"Opportunities","label":"Opportunities","table":"opportunity","tableLabel":"Opportunity","read":"Local","create":"None","append":"Basic","appendTo":"Basic"}],"secured":[{"column":"creditlimit","label":"Credit Limit","read":true,"update":false,"create":false},{"column":"creditonhold","label":"Credit Hold","read":true,"update":true,"create":true}],"systemAdministrator":false,"record":{"owner":{"name":"Megan Bowen","kind":"user","isUser":false,"isUsersTeam":false},"shares":[{"principal":"Sales Leads","kind":"team","rights":["ReadAccess","WriteAccess"]}],"userBusinessUnit":"Contoso","recordBusinessUnit":"Contoso Sales","sameBusinessUnit":false}} }
          if (msg.command === "userRoles") { const megan = msg.args?.userId === "u2"; return { ok: true, result: { user: megan ? { id: "u2", name: "Megan Bowen", businessUnit: "Contoso Sales" } : { id: "u1", name: "Alex Wilber", businessUnit: "Contoso" }, direct: megan ? ["Basic User", "Salesperson"] : ["Basic User", "Salesperson", "System Customizer"], viaTeams: megan ? [{ role: "Sales Manager", team: "Sales Leads" }] : [{ role: "Marketing Professional", team: "Marketing" }] } } }
          if (msg.command === "searchUsers") return { ok: true, result: [{ id: "u2", name: "Megan Bowen", domainName: "megan@contoso.com" }, { id: "u3", name: "Nestor Wilke", domainName: "nestor@contoso.com" }].filter((u) => (u.name + u.domainName).toLowerCase().includes(String(msg.args?.query ?? "").toLowerCase())) }
          return { ok: true, result: null }
        }
        if (msg?.type === "bc:tool") return { message: "Done" }
        emitState()
        return undefined
      },
    },
    scripting: {
      // The org the portal called (lib/dataverse orgFromTab), or the environment's name
      executeScript: async () => [{ result: SCENARIO === "flow" ? FLOW.org : "Contoso Sales (Sandbox)" }],
    },
    storage: {
      local: area("local"),
      session: area("session"),
      sync: area("sync"),
      onChanged: { addListener: (f) => changed.push(f), removeListener() {} },
    },
    sidePanel: { setPanelBehavior: async () => {} },
  }

  // The Dataverse Web API, for the Power Automate panel
  const realFetch = window.fetch.bind(window)
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
  window.fetch = async (input, init) => {
    const href = typeof input === "string" ? input : input.url
    const at = href.indexOf("/api/data/v9.2/")
    if (at < 0) return realFetch(input, init)
    const path = decodeURIComponent(href.slice(at + 15))
    if ((init?.method ?? "GET") !== "GET") return new Response(null, { status: 204 })
    if (path.startsWith("RetrieveCurrentOrganization")) return json({ Detail: { EnvironmentId: FLOW.environmentId } })
    if (path.startsWith("solutioncomponents")) return json({ value: DV.components.map((objectid) => ({ objectid })) })
    if (path.startsWith("workflows")) {
      const one = /resourceid eq ([0-9a-f-]+)/.exec(path)?.[1]
      return json({ value: one ? DV.workflows.filter((w) => w.resourceid === one || w.workflowid === one) : DV.workflows })
    }
    if (path.startsWith("flowruns")) return json({ value: path.includes("Failed") ? DV.runs.filter((r) => r.status === "Failed") : DV.runs })
    if (path.startsWith("connectionreferences")) return json({ value: DV.refs })
    if (path.startsWith("environmentvariabledefinitions")) return json({ value: DV.vars })
    if (path.startsWith("solutions")) return json({ value: [{ solutionid: "5a8e2c14-9b7d-4f3a-8e21-6c4d0b9f1a37", uniquename: "ContosoSales", friendlyname: "Contoso Sales", ismanaged: false }] })
    return json({ value: [] })
  }
})();`
}
