/** The words for a missing companion, shared by the side panel and the query builder. */
import { COMPANION_LATEST, SITE_LINKS } from "@/shared/links"

import type { CompanionProblemKind } from "./page-error"

/** The companion's install guide, on the website */
export const COMPANION_INSTALL_URL = `${SITE_LINKS.companionDocs}#install-it`

export function companionHeadline(
  kind: CompanionProblemKind | null,
  env: string
) {
  if (kind === "denied") return `You can't open the companion's page in ${env}`
  if (kind === "error")
    return `Business Central couldn't open the companion's page in ${env}`
  return `The Dynamic Assist Companion isn't installed in ${env}`
}

/** The steps as plain text, to send to whoever installs apps. */
export function companionStepsText(
  kind: CompanionProblemKind | null,
  env: string
) {
  if (kind === "denied")
    return [
      `Please give me the DA QUERY permission set in the Business Central environment ${env}.`,
      "It belongs to the Dynamic Assist Companion app and lets me use the Dynamic Assist query builder. It grants no business data by itself: I still only see the tables I can already read.",
      `About the app: ${COMPANION_INSTALL_URL}`,
    ].join("\n")
  return [
    `Please install the Dynamic Assist Companion app in the Business Central environment ${env}:`,
    "",
    `1. Download the Apps zip from the latest release and unzip it: ${COMPANION_LATEST}`,
    "2. Upload the .app file in the Business Central admin center (the environment > Apps > Install Extension), or in Extension Management > Manage > Upload Extension, which needs the EXTEN. MGT. - ADMIN permission set.",
    "3. Give the people who use Dynamic Assist the DA QUERY permission set.",
    "",
    `It's a small read-only app: it lets the Dynamic Assist browser extension query tables as the signed-in user, with their permissions. Full instructions: ${COMPANION_INSTALL_URL}`,
  ].join("\n")
}
