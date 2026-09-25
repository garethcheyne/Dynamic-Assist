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

export type Link = {
  label: string
  /** The second line: what it is or where it goes */
  detail: string
  url: string
  icon: LucideIcon | string
}

/** Admin centres and portals: the same from any page */
export const PORTALS: { title: string; links: Link[] }[] = [
  {
    title: "Admin Centres",
    links: [
      {
        label: "Microsoft 365 Admin",
        detail: "Users, licences, billing",
        url: "https://admin.microsoft.com/",
        icon: microsoft365Logo,
      },
      {
        label: "Power Platform Admin",
        detail: "Environments, capacity, policies",
        url: "https://admin.powerplatform.microsoft.com/environments",
        icon: powerPlatformLogo,
      },
      {
        label: "Business Central Admin",
        detail: "Environments, apps, sessions",
        url: "https://businesscentral.dynamics.com/admin",
        icon: bcLogo,
      },
      {
        label: "Entra Admin",
        detail: "Users, groups, app registrations",
        url: "https://entra.microsoft.com/",
        icon: entraLogo,
      },
      {
        label: "Azure Portal",
        detail: "Subscriptions and resources",
        url: "https://portal.azure.com/",
        icon: azurePortalLogo,
      },
      {
        label: "Exchange Admin",
        detail: "Mailboxes, mail flow",
        url: "https://admin.exchange.microsoft.com/",
        icon: exchangeLogo,
      },
      {
        label: "Teams Admin",
        detail: "Teams, policies, meetings",
        url: "https://admin.teams.microsoft.com/",
        icon: teamsLogo,
      },
      {
        label: "Power BI Admin",
        detail: "Tenant settings, workspaces",
        url: "https://app.powerbi.com/admin-portal",
        icon: powerBiLogo,
      },
    ],
  },
  {
    title: "Build",
    links: [
      {
        label: "Power Apps",
        detail: "Apps, tables, solutions",
        url: "https://make.powerapps.com/",
        icon: paLogo,
      },
      {
        label: "Power Automate",
        detail: "Cloud and desktop flows",
        url: "https://make.powerautomate.com/",
        icon: flowLogo,
      },
      {
        label: "Copilot Studio",
        detail: "Agents and copilots",
        url: "https://copilotstudio.microsoft.com/",
        icon: copilotStudioLogo,
      },
      {
        label: "Azure DevOps",
        detail: "Repos, pipelines, boards",
        url: "https://dev.azure.com/",
        icon: azureDevOpsLogo,
      },
    ],
  },
  {
    title: "Status & Docs",
    links: [
      {
        label: "Service Health",
        detail: "Incidents and advisories",
        url: "https://admin.microsoft.com/#/servicehealth",
        icon: HeartPulseIcon,
      },
      {
        label: "Message Center",
        detail: "Upcoming changes",
        url: "https://admin.microsoft.com/#/MessageCenter",
        icon: MegaphoneIcon,
      },
      {
        label: "Business Central Docs",
        detail: "Microsoft Learn",
        url: "https://learn.microsoft.com/dynamics365/business-central/",
        icon: BookOpenIcon,
      },
      {
        label: "Power Platform Docs",
        detail: "Microsoft Learn",
        url: "https://learn.microsoft.com/power-platform/",
        icon: BookOpenIcon,
      },
    ],
  },
]

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
