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
/** The companion's latest .app, ready to install: GitHub won't host .app files, so the website unzips the release */
export const COMPANION_APP =
  "https://dynamicassist.err403.com/download/DynamicAssistCompanion.app"

/** Microsoft's Business Central Virtual Table app for Dataverse, and its setup docs */
export const BC_VIRTUAL_TABLES = {
  app: "https://appsource.microsoft.com/product/dynamics-365/microsoftdynsmb.businesscentral_virtualentity",
  docs: "https://learn.microsoft.com/dynamics365/business-central/dev-itpro/powerplatform/powerplat-admin-reference",
}

/** Buy Me a Coffee, for anyone who'd like to say thanks: a plain link, nothing loaded until it's clicked */
export const BUY_ME_A_COFFEE = "https://buymeacoffee.com/acejvszkeo"

/** The website: docs, the changelog, feedback and the privacy pages */
export const SITE = "https://dynamicassist.err403.com"
export const SITE_LINKS = {
  home: `${SITE}/`,
  docs: `${SITE}/docs/`,
  /** What the extension and the companion read, keep and change */
  privacy: `${SITE}/privacy/`,
  /** What the website itself keeps: visit counts and feedback */
  websitePrivacy: `${SITE}/privacy/website/`,
  changelog: `${SITE}/changelog/`,
  /** The docs page Help opens for each product, starting where its panel starts */
  help: {
    bc: `${SITE}/docs/bc-page-and-parts/`,
    ce: `${SITE}/docs/d365-record/`,
    maker: `${SITE}/docs/power-apps/`,
    flow: `${SITE}/docs/power-automate/`,
    none: `${SITE}/docs/getting-started/`,
  } as Record<string, string>,
  feedback: `${SITE}/feedback/`,
  /** The companion app's page: what it is, installing it, a missing companion */
  companionDocs: `${SITE}/docs/companion-app/`,
  /** The privacy policy for every err403 browser extension, the one the stores link to */
  policy: "https://www.err403.com/privacy-policy/chrome-extensions",
}

/**
 * The website's feedback page with what we already know filled in: the kind,
 * the product, this version and, after a crash, the message. The extension
 * sends nothing home, so this is how problems and ideas reach us.
 */
export function feedbackUrl(
  opts: { kind?: "feature" | "issue"; product?: string; details?: string } = {}
) {
  const params = new URLSearchParams()
  if (opts.kind) params.set("kind", opts.kind)
  if (opts.product) params.set("product", opts.product)
  // Not in a page's main world, where chrome.runtime doesn't exist
  const version =
    typeof chrome !== "undefined"
      ? chrome.runtime?.getManifest?.().version
      : undefined
  if (version) params.set("version", version)
  if (opts.details) params.set("details", opts.details.slice(0, 500))
  return `${SITE_LINKS.feedback}?${params}`
}

/**
 * The website's changelog at a version's release: its sections link as
 * #2026-11-15 for 2026.11.15. A version not released yet just opens the top.
 */
export const whatsNewUrl = (version: string) =>
  `${SITE_LINKS.changelog}#${version.replace(/\./g, "-")}`
