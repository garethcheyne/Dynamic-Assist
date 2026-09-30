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

/** The Dynamic Assist Companion app for Business Central: its repository and latest release */
export const COMPANION_REPO =
  "https://github.com/garethcheyne/Dynamic-Assist_BusinessCentralAddon"
export const COMPANION_LATEST = `${COMPANION_REPO}/releases/latest`

/** Microsoft's Business Central Virtual Table app for Dataverse, and its setup docs */
export const BC_VIRTUAL_TABLES = {
  app: "https://appsource.microsoft.com/product/dynamics-365/microsoftdynsmb.businesscentral_virtualentity",
  docs: "https://learn.microsoft.com/dynamics365/business-central/dev-itpro/powerplatform/powerplat-admin-reference",
}

const REPO = "https://github.com/garethcheyne/Dynamic-Assist"

/** CHANGELOG.md on the main branch: raw for reading, and the repo's files for its relative links */
export const CHANGELOG = {
  raw: "https://raw.githubusercontent.com/garethcheyne/Dynamic-Assist/main/CHANGELOG.md",
  page: `${REPO}/blob/main/CHANGELOG.md`,
  files: `${REPO}/blob/main/`,
}
