/**
 * Microsoft's official product icons (see SOURCE.md for where each comes
 * from). Import from here so every screen uses the same, current icon.
 */
import azureDevOps from "./azure-devops.svg"
import azurePortal from "./azure-portal.svg"
import businessCentral from "./business-central.svg"
import copilotStudio from "./copilot-studio.svg"
import dataverse from "./dataverse.svg"
import dynamics365 from "./dynamics-365.svg"
import entraId from "./entra-id.svg"
import exchange from "./exchange.svg"
import microsoft365 from "./microsoft-365.svg"
import powerApps from "./power-apps.svg"
import powerAutomate from "./power-automate.svg"
import powerBi from "./power-bi.svg"
import powerPlatform from "./power-platform.svg"
import teams from "./teams.svg"

export const MS_ICONS = {
  azureDevOps,
  azurePortal,
  businessCentral,
  copilotStudio,
  dataverse,
  dynamics365,
  entraId,
  exchange,
  microsoft365,
  powerApps,
  powerAutomate,
  powerBi,
  powerPlatform,
  teams,
} as const

export type MsProduct = keyof typeof MS_ICONS
