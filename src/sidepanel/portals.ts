/**
 * Where the header's Go-anywhere menu and the home page send you: Microsoft's
 * admin centres, build tools, status and docs, the same from any page.
 */
import {
  BookOpenIcon,
  HeartPulseIcon,
  MegaphoneIcon,
  type LucideIcon,
} from "lucide-react"

import bcLogo from "@/assets/brand/ms/business-central.svg"
import ceLogo from "@/assets/brand/ms/dynamics-365.svg"
import flowLogo from "@/assets/brand/ms/power-automate.svg"
import azureDevOpsLogo from "@/assets/brand/ms/azure-devops.svg"
import azurePortalLogo from "@/assets/brand/ms/azure-portal.svg"
import copilotStudioLogo from "@/assets/brand/ms/copilot-studio.svg"
import entraLogo from "@/assets/brand/ms/entra-id.svg"
import paLogo from "@/assets/brand/ms/power-apps.svg"
import powerBiLogo from "@/assets/brand/ms/power-bi.svg"
import powerPlatformLogo from "@/assets/brand/ms/power-platform.svg"
import exchangeLogo from "@/assets/brand/ms/exchange.svg"
import microsoft365Logo from "@/assets/brand/ms/microsoft-365.svg"
import teamsLogo from "@/assets/brand/ms/teams.svg"
import type { HistoryEntry } from "@/lib/history"
import { PORTAL_LINKS } from "@/shared/portal-links"

export type Link = {
  label: string
  /** The second line: what it is or where it goes */
  detail: string
  url: string
  icon: LucideIcon | string
}

/** Each portal's logo or icon, by its URL */
const PORTAL_ICONS: Record<string, LucideIcon | string> = {
  "https://admin.microsoft.com/": microsoft365Logo,
  "https://admin.powerplatform.microsoft.com/environments": powerPlatformLogo,
  "https://businesscentral.dynamics.com/admin": bcLogo,
  "https://entra.microsoft.com/": entraLogo,
  "https://portal.azure.com/": azurePortalLogo,
  "https://admin.exchange.microsoft.com/": exchangeLogo,
  "https://admin.teams.microsoft.com/": teamsLogo,
  "https://app.powerbi.com/admin-portal": powerBiLogo,
  "https://make.powerapps.com/": paLogo,
  "https://make.powerautomate.com/": flowLogo,
  "https://copilotstudio.microsoft.com/": copilotStudioLogo,
  "https://dev.azure.com/": azureDevOpsLogo,
  "https://admin.microsoft.com/#/servicehealth": HeartPulseIcon,
  "https://admin.microsoft.com/#/MessageCenter": MegaphoneIcon,
  "https://learn.microsoft.com/dynamics365/business-central/": BookOpenIcon,
  "https://learn.microsoft.com/power-platform/": BookOpenIcon,
}

/** Admin centres and portals: the same from any page */
export const PORTALS: { title: string; links: Link[] }[] = PORTAL_LINKS.map(
  (group) => ({
    ...group,
    links: group.links.map((l) => ({ ...l, icon: PORTAL_ICONS[l.url] })),
  })
)

export const PRODUCT_ICON: Record<HistoryEntry["platform"], string> = {
  bc: bcLogo,
  ce: ceLogo,
  maker: paLogo,
  flow: flowLogo,
}

export const PRODUCT_NAME: Record<HistoryEntry["platform"], string> = {
  bc: "Business Central",
  ce: "Dynamics 365",
  maker: "Power Apps",
  flow: "Power Automate",
}
