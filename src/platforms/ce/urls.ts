import { powerPlatform } from "@/shared/links"

import type { CeState } from "./types"

/** A model-driven app in an org, or the org's default app. */
export function ceAppUrl(clientUrl: string, appId?: string | null) {
  return `${clientUrl}/main.aspx${appId ? `?appid=${appId}` : ""}`
}

/**
 * Microsoft's "My apps" page lists apps across all your environments. It
 * replaced the old port.crm*.dynamics.com instance picker, which now returns 404.
 */
const MY_APPS_URL = "https://home.dynamics.com/"

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
    instancePicker: MY_APPS_URL,
    maker: env ? powerPlatform.maker(env) : null,
    solutions: env ? powerPlatform.maker(env, "solutions") : null,
    solutionHistory: env ? powerPlatform.maker(env, "history") : null,
    adminCenter: powerPlatform.adminCenter(env),
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
