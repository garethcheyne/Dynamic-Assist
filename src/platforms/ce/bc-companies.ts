import type { HistoryEntry } from "@/lib/history"
import { bcCompanyKey, type BcOrgLinks } from "@/lib/product-links"
import { buildBcUrl, parseBcUrl } from "@/platforms/bc/url"
import { GUID } from "@/shared/links"

import type { CeBcSource } from "./types"

const BC_ORIGIN = "https://businesscentral.dynamics.com"
const lower = (s: string | null | undefined) => (s ?? "").toLowerCase()

/** What the org and the extension know about which companies sync with it */
export type BcOrgKnowledge = {
  /** The org's origin ("https://contoso.crm.dynamics.com") */
  origin: string
  /** Company names connected to the org (its business units, cdm_company) */
  companies: string[]
  /** Companies the companion has said sync with an org, and which */
  links: BcOrgLinks
}

/**
 * The BC companies to offer, newest first, one per company: History can hold
 * the same one twice (with and without the tenant in its URL, or in another
 * case). With the org's environment known, only companies in it, and the
 * org's default company if History doesn't have it. With what the org and
 * Business Central say (`org`), only companies connected to this org, when
 * any is known to be: usually just one, so there's nothing to pick.
 */
export function bcCompanies(
  history: HistoryEntry[],
  source: CeBcSource | null,
  tenantId: string | null,
  org?: BcOrgKnowledge
): HistoryEntry[] {
  const offered = offer(history, source, tenantId)
  if (!org) return offered
  const origin = lower(org.origin)
  const names = new Set(org.companies.map(lower))
  const linked = (e: HistoryEntry) => {
    const ctx = parseBcUrl(e.url)
    return lower(org.links[bcCompanyKey(ctx)])
  }
  // Business Central said it syncs with another org: never this one's
  const here = offered.filter((e) => !linked(e) || linked(e) === origin)
  const connected = here.filter((e) => {
    const company = lower(parseBcUrl(e.url).company)
    return (
      linked(e) === origin ||
      e.key.startsWith("setup:") ||
      (!!company && names.has(company))
    )
  })
  return connected.length ? connected : here
}

function offer(
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
