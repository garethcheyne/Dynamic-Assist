import { environmentOf, orgFromTab } from "@/lib/dataverse"
import { HISTORY_KEY, type HistoryEntry } from "@/lib/history"
import { useLoad } from "@/lib/use-load"
import { useStorage } from "@/lib/use-storage"

export const flowUrl = (env: string, flowId: string) =>
  `https://make.powerautomate.com/environments/${env}/flows/${flowId}/details`

/**
 * The Dataverse org for an environment: read from the tab (the portal calls
 * it), checked against the environment, else a Dynamics 365 org from History.
 */
export function useOrg(tabId: number | undefined, env: string | null) {
  const [history] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])
  const remembered = history.find(
    (e) => e.platform === "ce" && env && e.environmentId === env
  )
  const fallback = remembered ? new URL(remembered.url).origin : null
  const load = useLoad(
    tabId === undefined || !env
      ? null
      : async () => {
          const found = await orgFromTab(tabId)
          if (found) {
            const foundEnv = await environmentOf(found).catch(() => null)
            if (!foundEnv || foundEnv === env.toLowerCase()) return found
          }
          return null
        },
    [tabId, env]
  )
  return {
    org: load.data ?? (load.loading ? null : fallback),
    loading: load.loading,
    retry: load.reload,
  }
}
