export type Platform = "bc" | "ce" | "none"

const BC_HOST = "businesscentral.dynamics.com"

/** Which Dynamics platform a tab URL belongs to. */
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
  return "none"
}
