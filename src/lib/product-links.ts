/**
 * Which Dataverse org a Business Central company syncs with, remembered when
 * the extension learns it (the companion reads BC's Dataverse connection setup
 * for coupled records), so the header's launcher can link across products.
 * Kept in chrome.storage.local on this machine only.
 */
import type { BcContext } from "@/platforms/bc/url"

export const BC_ORG_KEY = "links.bcOrg"

/** BC company → org origin ("https://contoso.crm.dynamics.com") */
export type BcOrgLinks = Record<string, string>

export const bcCompanyKey = (
  ctx: Pick<BcContext, "tenant" | "environment" | "company">
) =>
  [ctx.tenant ?? "", ctx.environment ?? "", ctx.company ?? ""]
    .join("/")
    .toLowerCase()

export async function rememberBcOrg(ctx: BcContext, orgUrl: string | null) {
  if (!orgUrl) return
  let origin: string
  try {
    origin = new URL(orgUrl).origin
  } catch {
    return
  }
  const stored = await chrome.storage.local.get(BC_ORG_KEY)
  const links = (stored[BC_ORG_KEY] as BcOrgLinks | undefined) ?? {}
  const key = bcCompanyKey(ctx)
  if (links[key] === origin) return
  await chrome.storage.local.set({ [BC_ORG_KEY]: { ...links, [key]: origin } })
}
