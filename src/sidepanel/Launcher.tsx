import * as React from "react"
import { AppWindowIcon, LayoutGridIcon } from "lucide-react"

import bcLogo from "@/assets/brand/ms/business-central.svg"
import ceLogo from "@/assets/brand/ms/dynamics-365.svg"
import flowLogo from "@/assets/brand/ms/power-automate.svg"
import dataverseLogo from "@/assets/brand/ms/dataverse.svg"
import paLogo from "@/assets/brand/ms/power-apps.svg"
import powerPlatformLogo from "@/assets/brand/ms/power-platform.svg"
import { Hint } from "@/components/hint"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HISTORY_KEY, type HistoryEntry } from "@/lib/history"
import { BC_ORG_KEY, bcCompanyKey, type BcOrgLinks } from "@/lib/product-links"
import { useStorage } from "@/lib/use-storage"
import { bcAdminCenterUrl, parseBcUrl } from "@/platforms/bc/url"
import { parseMakerUrl, type Platform } from "@/shared/detect"
import { powerPlatform } from "@/shared/links"

import { PORTALS, PRODUCT_ICON, PRODUCT_NAME, type Link } from "./portals"

const originOf = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Links for the environment in this tab, and the products it's linked to:
 * a BC company's Dataverse org (learned from coupled records), an org's
 * Power Platform environment (read on its pages) and back.
 */
function contextLinks(
  platform: Platform,
  url: string | undefined,
  history: HistoryEntry[],
  bcOrgs: BcOrgLinks
): { title: string; links: Link[] } | null {
  if (!url || platform === "none") return null
  const links: Link[] = []
  const orgEntry = (origin: string | null) =>
    origin
      ? history.find((e) => e.platform === "ce" && originOf(e.url) === origin)
      : undefined
  const bcFor = (origin: string | null) =>
    history.filter(
      (e) =>
        e.platform === "bc" &&
        origin &&
        bcOrgs[bcCompanyKey(parseBcUrl(e.url))] === origin
    )
  const envLinks = (env: string | null | undefined) => {
    if (!env) return
    links.push(
      {
        label: "Power Platform Admin",
        detail: "This environment: settings, capacity, security",
        url: powerPlatform.adminCenter(env),
        icon: powerPlatformLogo,
      },
      {
        label: "Solutions",
        detail: "Power Apps",
        url: powerPlatform.maker(env, "solutions"),
        icon: paLogo,
      },
      {
        label: "Cloud Flows",
        detail: "Power Automate",
        url: powerPlatform.flows(env),
        icon: flowLogo,
      }
    )
  }
  const orgLinks = (origin: string, entry?: HistoryEntry) =>
    links.push(
      {
        label:
          entry?.label ?? entry?.title ?? new URL(origin).host.split(".")[0],
        detail: "Dynamics 365",
        url: entry?.url ?? `${origin}/main.aspx`,
        icon: ceLogo,
      },
      {
        label: "Advanced Settings",
        detail: "Dynamics 365",
        url: `${origin}/main.aspx?settingsonly=true`,
        icon: ceLogo,
      },
      {
        label: "Web API",
        detail: "Service document",
        url: `${origin}/api/data/v9.2/`,
        icon: dataverseLogo,
      }
    )
  const bcLinks = (entries: HistoryEntry[]) =>
    entries.forEach((e) =>
      links.push({
        label: e.label ?? e.title,
        detail: e.subtitle
          ? `Business Central · ${e.subtitle}`
          : "Business Central",
        url: e.url,
        icon: bcLogo,
      })
    )

  if (platform === "bc") {
    const ctx = parseBcUrl(url)
    links.push({
      label: "Business Central Admin",
      detail: "This tenant",
      url: bcAdminCenterUrl(ctx),
      icon: bcLogo,
    })
    const org = bcOrgs[bcCompanyKey(ctx)] ?? null
    if (org) {
      const entry = orgEntry(org)
      orgLinks(org, entry)
      envLinks(entry?.environmentId)
    }
    return {
      title: org ? "This Company and Its Dataverse Org" : "This Environment",
      links,
    }
  }

  if (platform === "ce") {
    const origin = originOf(url)
    const entry = orgEntry(origin)
    envLinks(entry?.environmentId)
    if (origin) {
      links.push(
        {
          label: "Advanced Settings",
          detail: "Dynamics 365 settings",
          url: `${origin}/main.aspx?settingsonly=true`,
          icon: ceLogo,
        },
        {
          label: "Web API",
          detail: "Service document",
          url: `${origin}/api/data/v9.2/`,
          icon: dataverseLogo,
        }
      )
      bcLinks(bcFor(origin))
    }
    return links.length ? { title: "This Environment", links } : null
  }

  // Power Apps or Power Automate
  const env = parseMakerUrl(url).environmentId
  if (!env) return null
  links.push(
    {
      label: "Power Platform Admin",
      detail: "This environment: settings, capacity, security",
      url: powerPlatform.adminCenter(env),
      icon: powerPlatformLogo,
    },
    platform === "flow"
      ? {
          label: "Solutions",
          detail: "Power Apps",
          url: powerPlatform.maker(env, "solutions"),
          icon: paLogo,
        }
      : {
          label: "Cloud Flows",
          detail: "Power Automate",
          url: powerPlatform.flows(env),
          icon: flowLogo,
        }
  )
  const org = history.find(
    (e) => e.platform === "ce" && e.environmentId === env
  )
  const origin = org ? originOf(org.url) : null
  if (origin) {
    orgLinks(origin, org)
    bcLinks(bcFor(origin))
  }
  return { title: "This Environment", links }
}

function Icon({ icon }: { icon: Link["icon"] }) {
  if (typeof icon === "string")
    return <img src={icon} alt="" className="size-4 object-contain" />
  const C = icon
  return <C className="text-primary" />
}

function Item({ link }: { link: Link }) {
  return (
    <DropdownMenuItem
      onClick={(e) =>
        chrome.tabs.create({
          url: link.url,
          // Ctrl/Cmd-click: open behind, stay where you are
          active: !(e.ctrlKey || e.metaKey),
        })
      }
      className="gap-2.5"
    >
      <Icon icon={link.icon} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{link.label}</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {link.detail}
        </span>
      </span>
    </DropdownMenuItem>
  )
}

/**
 * The header's "Go anywhere" menu: the panel is about your page; this gets you
 * to everything around it (the environment's other products, admin centres,
 * portals and recent environments) from any page.
 */
export function Launcher({
  platform,
  url,
}: {
  platform: Platform
  url: string | undefined
}) {
  const [history] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])
  const [bcOrgs] = useStorage<BcOrgLinks>(BC_ORG_KEY, {})
  const here = contextLinks(platform, url, history, bcOrgs)
  const recent = [...history]
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) || b.lastVisited - a.lastVisited
    )
    .slice(0, 6)

  return (
    <DropdownMenu>
      <Hint label="Go anywhere: this environment's other products, admin centres and recent environments">
        <DropdownMenuTrigger
          aria-label="Go anywhere"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <LayoutGridIcon />
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent
        align="end"
        className="max-h-[75vh] w-72 overflow-y-auto"
      >
        {here && here.links.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{here.title}</DropdownMenuLabel>
              {here.links.map((l) => (
                <Item key={l.url + l.label} link={l} />
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        {recent.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Recent</DropdownMenuLabel>
              {recent.map((e) => (
                <Item
                  key={e.key}
                  link={{
                    label: e.label ?? e.title,
                    detail:
                      [e.subtitle, e.envType].filter(Boolean).join(" · ") ||
                      PRODUCT_NAME[e.platform],
                    url: e.url,
                    icon: PRODUCT_ICON[e.platform] ?? AppWindowIcon,
                  }}
                />
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        {PORTALS.map((group, i) => (
          <React.Fragment key={group.title}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
              {group.links.map((l) => (
                <Item key={l.url} link={l} />
              ))}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
