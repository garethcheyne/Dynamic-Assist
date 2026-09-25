import { GUID } from "@/shared/links"

/**
 * Business Central web client URLs:
 *   https://businesscentral.dynamics.com/{tenant?}/{environment?}/?company=…&page=…&bookmark=…
 * The tenant is a GUID or a domain and can be left out; so can the environment,
 * in which case BC opens the default one.
 */
export type BcContext = {
  origin: string
  tenant: string | null
  environment: string | null
  company: string | null
  page: number | null
  bookmark: string | null
  /** The tenant's admin center (/{tenant}/admin), not the web client */
  isAdminCenter: boolean
}

export function parseBcUrl(url: string): BcContext {
  const u = new URL(url)
  const segments = u.pathname.split("/").filter(Boolean)

  let tenant: string | null = null
  if (segments[0] && (GUID.test(segments[0]) || segments[0].includes("."))) {
    tenant = segments.shift()!
  }
  const environment = segments[0] ?? null
  const isAdminCenter = environment?.toLowerCase() === "admin"

  const page = Number(u.searchParams.get("page"))

  return {
    origin: u.origin,
    tenant,
    environment: isAdminCenter ? null : environment,
    isAdminCenter,
    company: u.searchParams.get("company"),
    page: Number.isInteger(page) && page > 0 ? page : null,
    bookmark: u.searchParams.get("bookmark"),
  }
}

/** A URL in the same tenant, environment and company, with the given object parameters. */
export function buildBcUrl(
  ctx: BcContext,
  params: Record<string, string | number>
): string {
  const path = [ctx.tenant, ctx.environment].filter(Boolean).join("/")
  // Encoded by hand: URLSearchParams writes a space as "+", which Business
  // Central reads literally ("Contoso+Trading+East does not exist")
  const query = [
    ...(ctx.company ? [["company", ctx.company] as const] : []),
    ...Object.entries(params),
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&")
  return `${ctx.origin}/${path}${path ? "/" : ""}${query ? `?${query}` : ""}`
}

/**
 * The Business Central admin center for a tenant. The tenant comes from the
 * session when the page has loaded, else from the URL; without either BC picks
 * your home tenant.
 */
export function bcAdminCenterUrl(ctx: BcContext, aadTenantId?: string | null) {
  const tenant = aadTenantId ?? ctx.tenant
  return `${ctx.origin}/${tenant ? `${tenant}/` : ""}admin`
}
