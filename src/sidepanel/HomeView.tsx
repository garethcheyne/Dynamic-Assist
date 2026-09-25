import {
  ArrowUpRightIcon,
  HeartIcon,
  HistoryIcon,
  LifeBuoyIcon,
  ServerCogIcon,
} from "lucide-react"

import { MS_ICONS } from "@/assets/brand/ms"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Hint, HintBody } from "@/components/hint"
import { HISTORY_KEY, type HistoryEntry } from "@/lib/history"
import { useStorage } from "@/lib/use-storage"

import { HistoryView } from "./HistoryView"
import { PORTALS, type Link } from "./portals"

const { version } = chrome.runtime.getManifest()
const icon = chrome.runtime.getURL("icons/icon128.png")

type Product = {
  platform: HistoryEntry["platform"]
  name: string
  logo: string
  /** Where to go when you've never opened this product */
  home: string
  /** What it covers, for the card's tooltip */
  about: string
}

const PRODUCTS: Product[] = [
  {
    platform: "bc",
    name: "Business Central",
    logo: MS_ICONS.businessCentral,
    home: "https://businesscentral.dynamics.com/",
    about:
      "Page and field inspector, field names on every page, the query builder, coupled Dynamics 365 records and admin shortcuts.",
  },
  {
    platform: "ce",
    name: "Dynamics 365",
    logo: MS_ICONS.dynamics365,
    home: "https://www.microsoft365.com/apps",
    about:
      "Record inspector, logical names on forms and lists, god mode, FetchXML query builder, impersonation and the coupled BC records.",
  },
  {
    platform: "maker",
    name: "Power Apps",
    logo: MS_ICONS.powerApps,
    home: "https://make.powerapps.com/",
    about:
      "Environment and solution IDs, and a solution's flows, connection references and environment variables.",
  },
  {
    platform: "flow",
    name: "Power Automate",
    logo: MS_ICONS.powerAutomate,
    home: "https://make.powerautomate.com/",
    about:
      "Turn many flows on at once, a flow's definition as JSON, failed runs, connection references and environment variables.",
  },
]

const open = (url: string, background = false) =>
  chrome.tabs.create({ url, active: !background })

/**
 * The panel when the tab isn't a product it knows: what Dynamic Assist is,
 * the four products with the environment you last used in each, your
 * history, and Microsoft's admin centres.
 */
export function HomeView({ onHelp }: { onHelp: () => void }) {
  const [history] = useStorage<HistoryEntry[]>(HISTORY_KEY, [])
  const lastUsed = (p: Product["platform"]) =>
    [...history]
      .filter((e) => e.platform === p)
      .sort((a, b) => b.lastVisited - a.lastVisited)[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [&>*]:shrink-0">
      {/* Brand */}
      <section
        className="relative overflow-hidden rounded-2xl p-4 text-white shadow-sm"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, #1fb5b0 0%, transparent 55%), radial-gradient(120% 140% at 100% 100%, #c44fa8 0%, transparent 55%), linear-gradient(135deg, #0f6f86, #4d4fc0 55%, #8a3fa6)",
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src={icon}
            alt=""
            className="size-12 rounded-xl shadow-lg ring-1 ring-white/30"
          />
          <div className="min-w-0">
            <h1 className="text-lg leading-tight font-semibold tracking-tight">
              Dynamic Assist
            </h1>
            <p className="text-xs text-white/80">Version {version}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-snug text-white/90">
          Admin and developer tools for Microsoft&apos;s business apps, in one
          side panel. Open one of them and the panel shows its tools.
        </p>
      </section>

      {/* Products */}
      <div className="grid grid-cols-2 gap-2">
        {PRODUCTS.map((p) => {
          const last = lastUsed(p.platform)
          const where = last ? (last.label ?? last.title) : null
          return (
            <Hint
              key={p.platform}
              label={
                <HintBody title={p.name}>
                  {p.about}
                  <span className="mt-1 block italic">
                    {where
                      ? `Opens ${where}, the one you used last. Ctrl-click opens it in the background.`
                      : `Opens ${p.name}.`}
                  </span>
                </HintBody>
              }
            >
              <button
                type="button"
                onClick={(e) =>
                  open(last?.url ?? p.home, e.ctrlKey || e.metaKey)
                }
                className="group flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <span className="flex items-center justify-between">
                  <img src={p.logo} alt="" className="size-7 object-contain" />
                  <ArrowUpRightIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">
                    {p.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {where ?? "Open"}
                  </span>
                </span>
              </button>
            </Hint>
          )
        })}
      </div>

      {/* History */}
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <HistoryIcon className="size-3.5 text-primary" />
          History
        </h2>
        <HistoryView embedded />
      </div>

      {/* Admin centres */}
      <CollapsibleSection
        id="home.admin"
        title={PORTALS[0].title}
        icon={<ServerCogIcon />}
        defaultCollapsed
      >
        <div className="grid grid-cols-2 gap-1.5">
          {PORTALS[0].links.map((l) => (
            <PortalTile key={l.url} link={l} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          More in the grid menu at the top, from any page.
        </p>
      </CollapsibleSection>

      <div className="flex items-center justify-center gap-4 pt-1 pb-2 text-xs">
        <button
          type="button"
          onClick={onHelp}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <LifeBuoyIcon className="size-3.5" />
          Help
        </button>
        <a
          href="https://github.com/garethcheyne/Dynamic-Assist/issues"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <HeartIcon className="size-3.5" />
          Feedback
        </a>
      </div>
    </div>
  )
}

function PortalTile({ link }: { link: Link }) {
  const Icon = link.icon
  return (
    <Hint label={<HintBody title={link.label}>{link.detail}</HintBody>}>
      <button
        type="button"
        onClick={(e) => open(link.url, e.ctrlKey || e.metaKey)}
        className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2 text-left transition-colors hover:border-primary/30 hover:bg-muted"
      >
        {typeof Icon === "string" ? (
          <img src={Icon} alt="" className="size-4 shrink-0 object-contain" />
        ) : (
          <Icon className="size-4 shrink-0 text-primary" />
        )}
        <span className="truncate text-xs font-medium">{link.label}</span>
      </button>
    </Hint>
  )
}
