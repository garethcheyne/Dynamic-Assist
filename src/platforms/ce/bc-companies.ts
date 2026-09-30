import type { HistoryEntry } from "@/lib/history"
import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"
import { GUID } from "@/shared/links"

import type { CeBcSource } from "./types"

const BC_ORIGIN = "https://businesscentral.dynamics.com"
const lower = (s: string | null | undefined) => (s ?? "").toLowerCase()

/**
 * The BC companies to offer, newest first, one per company: History can hold
 * the same one twice (with and without the tenant in its URL, or in another
 * case). With the org's environment known, only companies in it, and the
 * org's default company if History doesn't have it.
 */
export function bcCompanies(
  history: HistoryEntry[],
  source: CeBcSource | null,
  tenantId: string | null
): HistoryEntry[] {
  const seen = new Set<string>()
  const companies = history
    .filter((e) => e.platform === "bc")
    .sort((a, b) => b.lastVisited - a.lastVisited)
    .filter((e) => {
      const ctx = parseBcUrl(e.url)
      if (source) {
        if (lower(ctx.environment) !== lower(source.environment)) return false
        // A tenant GUID must be the org's; a domain can't be checked
        if (
          ctx.tenant &&
          tenantId &&
          GUID.test(ctx.tenant) &&
          lower(ctx.tenant) !== lower(tenantId)
        )
          return false
      }
      const key = [
        source ? "" : lower(ctx.tenant),
        lower(ctx.environment),
        lower(ctx.company),
      ].join("/")
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  if (
    source?.company &&
    tenantId &&
    !companies.some(
      (e) => lower(parseBcUrl(e.url).company) === lower(source.company)
    )
  ) {
    const url = buildBcUrl(
      {
        origin: BC_ORIGIN,
        tenant: tenantId,
        environment: source.environment,
        company: source.company,
        page: null,
        bookmark: null,
        isAdminCenter: false,
      },
      {}
    )
    companies.push({
      key: `setup:${lower(source.environment)}/${lower(source.company)}`,
      platform: "bc",
      title: source.environment,
      subtitle: `${source.company} (the org's default company)`,
      url,
      envType: null,
      lastVisited: 0,
      visits: 0,
    })
  }
  return companies
}
