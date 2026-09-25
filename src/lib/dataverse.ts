/**
 * The Dataverse Web API from the side panel, signed in as you: requests carry
 * the org's session cookies (`credentials: "include"`), the same session the
 * browser already has. No tokens are read or stored, and every call runs with
 * your own security roles.
 */

class DataverseError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const HEADERS = {
  Accept: "application/json",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
  Prefer:
    'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
}

/** One Web API call; `path` is relative to /api/data/v9.2/. */
export async function dataverse<T = unknown>(
  org: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${org}/api/data/v9.2/${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers:
        init.body === undefined
          ? HEADERS
          : { ...HEADERS, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new DataverseError(
      `Couldn't reach ${new URL(org).host}. Open the org once in this browser to sign in.`,
      0
    )
  }
  if (response.status === 204) return undefined as T
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      json?.error?.message ??
      (response.status === 401
        ? `Not signed in to ${new URL(org).host}. Open the org once in this browser.`
        : `${response.status} ${response.statusText}`)
    throw new DataverseError(message, response.status)
  }
  return json as T
}

/** Every row of a query, following @odata.nextLink. */
export async function dataverseAll<T>(org: string, path: string) {
  const rows: T[] = []
  let next: string | undefined = path
  while (next) {
    const page: { value: T[]; "@odata.nextLink"?: string } = await dataverse(
      org,
      next
    )
    rows.push(...page.value)
    const link = page["@odata.nextLink"]
    next = link ? link.slice(link.indexOf("/api/data/v9.2/") + 15) : undefined
  }
  return rows
}

/** A row's formatted value (option labels, lookup names, local dates). */
export const formatted = (row: Record<string, unknown>, field: string) =>
  (row[`${field}@OData.Community.Display.V1.FormattedValue`] as
    string | undefined) ?? null

/**
 * The Dataverse org behind a Power Apps or Power Automate tab: the portal
 * calls its Web API, and the browser lists the addresses it requested (only
 * addresses: no headers or tokens). `org.api.crm6.dynamics.com` becomes
 * `https://org.crm6.dynamics.com`.
 */
export async function orgFromTab(tabId: number): Promise<string | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Newest first: after an environment switch the old org is listed too
        for (const entry of performance
          .getEntriesByType("resource")
          .reverse()) {
          const host =
            /^https:\/\/([^/]+\.crm\d*\.dynamics\.com)\/api\/data\//i.exec(
              entry.name
            )?.[1]
          if (host) return `https://${host.replace(".api.", ".")}`
        }
        return null
      },
    })
    return (result?.result as string | null) ?? null
  } catch {
    return null
  }
}

/** The Power Platform environment an org belongs to. */
export async function environmentOf(org: string) {
  const answer = await dataverse<{ Detail?: { EnvironmentId?: string } }>(
    org,
    "RetrieveCurrentOrganization(AccessType=Microsoft.Dynamics.CRM.EndpointAccessType'Default')"
  )
  return answer.Detail?.EnvironmentId?.toLowerCase() ?? null
}
