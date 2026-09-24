/** IDs and Power Platform URLs, kept free of assets so any script can import them. */

export const GUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Power Platform pages for an environment (maker portal, admin center, Power Automate). */
export const powerPlatform = {
  maker: (env: string, path = "home") =>
    `https://make.powerapps.com/environments/${env}/${path}`,
  flows: (env: string) =>
    `https://make.powerautomate.com/environments/${env}/flows`,
  adminCenter: (env?: string | null) =>
    env
      ? `https://admin.powerplatform.microsoft.com/environments/${env}/hub`
      : "https://admin.powerplatform.microsoft.com/environments",
}
