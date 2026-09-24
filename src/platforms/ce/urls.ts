import type { CeState } from "./types"

/** Links into the org, the maker portal and the admin center, as Level Up had them. */
export function ceUrls(s: CeState) {
  const base = s.environment.clientUrl
  const appId = s.app?.id
  const main = (params: Record<string, string>) =>
    `${base}/main.aspx?${new URLSearchParams({ ...(appId ? { appid: appId } : {}), ...params })}`
  const env = s.environment.environmentId

  return {
    record: (entityName: string, id: string) =>
      main({ pagetype: "entityrecord", etn: entityName, id }),
    newRecord: (entityName: string) =>
      main({ pagetype: "entityrecord", etn: entityName }),
    list: (entityName: string) =>
      main({ pagetype: "entitylist", etn: entityName }),
    webApiRecord: (entitySet: string, id: string) =>
      `${base}/api/data/v9.2/${entitySet}(${id})`,
    webApiView: (entitySet: string, viewId: string, userView: boolean) =>
      `${base}/api/data/v9.2/${entitySet}?${userView ? "userQuery" : "savedQuery"}=${viewId}`,
    entityMetadata: (entityName: string) =>
      `${base}/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')?$expand=Attributes($select=LogicalName,SchemaName,AttributeType,DisplayName)`,
    webApi: `${base}/api/data/v9.2/`,
    advancedFind: main({ pagetype: "advancedfind" }),
    settings: `${base}/main.aspx?settingsonly=true`,
    security: `${base}/tools/AdminSecurity/adminsecurity_area.aspx`,
    systemJobs: main({ pagetype: "entitylist", etn: "asyncoperation" }),
    processes: main({ pagetype: "entitylist", etn: "workflow" }),
    mailboxes: main({ pagetype: "entitylist", etn: "mailbox" }),
    myUser: main({
      pagetype: "entityrecord",
      etn: "systemuser",
      id: s.user.id,
    }),
    diagnostics: `${base}/tools/diagnostics/diag.aspx/GetMetrics`,
    instancePicker: `https://port${new URL(base).host.slice(new URL(base).host.indexOf("."))}/G/Instances/InstancePicker.aspx?redirect=False`,
    maker: env ? `https://make.powerapps.com/environments/${env}/home` : null,
    solutions: env
      ? `https://make.powerapps.com/environments/${env}/solutions`
      : null,
    solutionHistory: env
      ? `https://make.powerapps.com/environments/${env}/history`
      : null,
    adminCenter: env
      ? `https://admin.powerplatform.microsoft.com/environments/${env}/hub`
      : "https://admin.powerplatform.microsoft.com/environments",
  }
}

/** The current URL with a debug switch added (form monitor, ribbon debug, perf). */
export function withFlag(url: string, flag: string) {
  const u = new URL(url)
  u.searchParams.set(flag, "true")
  return u.toString()
}

export const FORM_TYPES: Record<number, string> = {
  0: "Undefined",
  1: "Create",
  2: "Update",
  3: "Read only",
  4: "Disabled",
  6: "Bulk edit",
}
