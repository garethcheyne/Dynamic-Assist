export type Platform = "bc" | "ce" | "maker" | "none"

const BC_HOST = "businesscentral.dynamics.com"
const MAKER_HOSTS = ["make.powerapps.com", "make.preview.powerapps.com"]

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
  if (/\.crm\d*\.dynamics\.com$/.test(host)) return "ce"
  if (MAKER_HOSTS.includes(host)) return "maker"
  return "none"
}

/** Power Apps maker URLs: /environments/{id}/{area}/{solution id?}/… */
export type MakerContext = {
  origin: string
  environmentId: string | null
  area: string | null
  solutionId: string | null
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseMakerUrl(url: string): MakerContext {
  const u = new URL(url)
  const parts = u.pathname.split("/").filter(Boolean)
  const envAt = parts.indexOf("environments")
  const environmentId = envAt >= 0 ? (parts[envAt + 1] ?? null) : null
  const area = envAt >= 0 ? (parts[envAt + 2] ?? null) : null
  const next = envAt >= 0 ? parts[envAt + 3] : undefined
  return {
    origin: u.origin,
    environmentId,
    area,
    solutionId: area === "solutions" && next && GUID.test(next) ? next : null,
  }
}
