import { GUID } from "./links"

export type Platform = "bc" | "ce" | "maker" | "flow" | "none"

const BC_HOST = "businesscentral.dynamics.com"
const MAKER_HOSTS = ["make.powerapps.com", "make.preview.powerapps.com"]
const FLOW_HOSTS = [
  "make.powerautomate.com",
  "make.preview.powerautomate.com",
  "flow.microsoft.com",
]

/** Which product a tab URL belongs to. */
export function detectPlatform(url: string | undefined): Platform {
  if (!url) return "none"

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return "none"
  }

  if (host === BC_HOST) return "bc"
  // Org hosts; port.crm*.dynamics.com was the retired instance picker, not an org
  if (/\.crm\d*\.dynamics\.com$/.test(host) && !host.startsWith("port."))
    return "ce"
  if (MAKER_HOSTS.includes(host)) return "maker"
  if (FLOW_HOSTS.includes(host)) return "flow"
  return "none"
}

/**
 * Power Apps and Power Automate URLs: /environments/{id}/{area}/…, with a
 * solution (solutions/{id}) or a flow (flows/{id}, cloudflows/{id}) in them.
 */
export type MakerContext = {
  origin: string
  environmentId: string | null
  area: string | null
  solutionId: string | null
  flowId: string | null
}

export function parseMakerUrl(url: string): MakerContext {
  const u = new URL(url)
  const parts = u.pathname.split("/").filter(Boolean)
  const envAt = parts.indexOf("environments")
  const environmentId = envAt >= 0 ? (parts[envAt + 1] ?? null) : null
  const area = envAt >= 0 ? (parts[envAt + 2] ?? null) : null
  const after = (name: string) => {
    const at = parts.lastIndexOf(name)
    const next = at >= 0 ? parts[at + 1] : undefined
    return next && GUID.test(next) ? next.toLowerCase() : null
  }
  return {
    origin: u.origin,
    environmentId,
    area,
    solutionId: after("solutions"),
    flowId: after("flows") ?? after("cloudflows"),
  }
}
