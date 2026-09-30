/**
 * Microsoft's admin centres, build tools, status and docs: where the panel's
 * Go-anywhere menu, the home page and the right-click menu send you. Plain
 * data, free of assets, so the service worker can import it too
 * (sidepanel/portals.ts adds the icons).
 */

export type PortalLink = {
  label: string
  /** The second line: what it is or where it goes */
  detail: string
  url: string
}

/** Admin centres and portals: the same from any page */
export const PORTAL_LINKS: { title: string; links: PortalLink[] }[] = [
  {
    title: "Admin Centres",
    links: [
      {
        label: "Microsoft 365 Admin",
        detail: "Users, licences, billing",
        url: "https://admin.microsoft.com/",
      },
      {
        label: "Power Platform Admin",
        detail: "Environments, capacity, policies",
        url: "https://admin.powerplatform.microsoft.com/environments",
      },
      {
        label: "Business Central Admin",
        detail: "Environments, apps, sessions",
        url: "https://businesscentral.dynamics.com/admin",
      },
      {
        label: "Entra Admin",
        detail: "Users, groups, app registrations",
        url: "https://entra.microsoft.com/",
      },
      {
        label: "Azure Portal",
        detail: "Subscriptions and resources",
        url: "https://portal.azure.com/",
      },
      {
        label: "Exchange Admin",
        detail: "Mailboxes, mail flow",
        url: "https://admin.exchange.microsoft.com/",
      },
      {
        label: "Teams Admin",
        detail: "Teams, policies, meetings",
        url: "https://admin.teams.microsoft.com/",
      },
      {
        label: "Power BI Admin",
        detail: "Tenant settings, workspaces",
        url: "https://app.powerbi.com/admin-portal",
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
      },
      {
        label: "Power Automate",
        detail: "Cloud and desktop flows",
        url: "https://make.powerautomate.com/",
      },
      {
        label: "Copilot Studio",
        detail: "Agents and copilots",
        url: "https://copilotstudio.microsoft.com/",
      },
      {
        label: "Azure DevOps",
        detail: "Repos, pipelines, boards",
        url: "https://dev.azure.com/",
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
      },
      {
        label: "Message Center",
        detail: "Upcoming changes",
        url: "https://admin.microsoft.com/#/MessageCenter",
      },
      {
        label: "Business Central Docs",
        detail: "Microsoft Learn",
        url: "https://learn.microsoft.com/dynamics365/business-central/",
      },
      {
        label: "Power Platform Docs",
        detail: "Microsoft Learn",
        url: "https://learn.microsoft.com/power-platform/",
      },
    ],
  },
]
