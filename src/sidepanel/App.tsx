import * as React from "react"
import {
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  HeartIcon,
  HistoryIcon,
  HouseIcon,
  LifeBuoyIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { cn } from "cn"

import { useTheme } from "@/components/theme-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { instanceKey } from "@/lib/history"
import { useActiveTab } from "@/lib/use-active-tab"
import { BcPanel } from "@/platforms/bc/panel/BcPanel"
import { CePanel } from "@/platforms/ce/panel/CePanel"
import { MakerPanel } from "@/platforms/maker/MakerPanel"
import { FlowPanel } from "@/platforms/flow/FlowPanel"
import { detectPlatform, type Platform } from "@/shared/detect"
import { PRODUCTS } from "@/shared/products"

import { CreditsView } from "./CreditsView"
import { Launcher } from "./Launcher"
import { HistoryView } from "./HistoryView"
import { HomeView } from "./HomeView"
import { Hint } from "@/components/hint"

type View = "tools" | "home" | "history" | "credits"

const VIEWS: Record<
  Exclude<View, "tools" | "home">,
  { title: string; icon: React.ReactNode }
> = {
  history: { title: "History", icon: <HistoryIcon /> },
  credits: { title: "About", icon: <HeartIcon /> },
}

/** Help in a tab of its own, opened at the product you're in */
function openHelp(platform: Platform) {
  void chrome.tabs.create({
    url: chrome.runtime.getURL(
      `src/sidepanel/index.html?page=help${platform === "none" ? "" : `#${platform}`}`
    ),
  })
}

const brandIcon = chrome.runtime.getURL("icons/icon32.png")

export function App() {
  const tab = useActiveTab()
  const platform = detectPlatform(tab?.url)
  const [chosen, setChosen] = React.useState<View>("tools")
  // Off the products there are no page tools: the home page instead
  const home: View = "tools"
  const view = chosen === "tools" ? home : chosen
  // One panel per tab and instance: moving to another environment, company or
  // org in the same tab starts fresh instead of mixing the two
  const panelKey = `${tab?.id}:${instanceKey(tab?.url)}`
  const go = (next: View) => setChosen((v) => (v === next ? "tools" : next))

  // The accent colours follow the product in the active tab (index.css).
  React.useEffect(() => {
    document.documentElement.dataset.platform = platform
  }, [platform])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <Header
        platform={platform}
        url={tab?.url}
        view={view}
        onBack={
          view !== home && view !== "home"
            ? () => setChosen("tools")
            : undefined
        }
        onGo={go}
      />
      {view === "home" ? (
        <HomeView onHelp={() => openHelp(platform)} />
      ) : view === "history" ? (
        <HistoryView />
      ) : view === "credits" ? (
        <CreditsView />
      ) : platform === "bc" && tab ? (
        <BcPanel key={panelKey} tab={tab} />
      ) : platform === "ce" && tab ? (
        <CePanel key={panelKey} tab={tab} />
      ) : platform === "maker" && tab ? (
        <MakerPanel key={panelKey} tab={tab} />
      ) : platform === "flow" && tab ? (
        <FlowPanel key={panelKey} tab={tab} />
      ) : (
        <HomeView onHelp={() => openHelp(platform)} />
      )}
    </div>
  )
}

/**
 * The browser already titles the panel "Dynamic Assist", so the header names
 * the product you're in, or the page you're on, and holds the menu.
 */
function Header({
  platform,
  url,
  view,
  onBack,
  onGo,
}: {
  platform: Platform
  url: string | undefined
  view: View
  onBack?: () => void
  onGo: (view: View) => void
}) {
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const product = platform === "none" ? null : PRODUCTS[platform]
  const page = view === "tools" || view === "home" ? null : VIEWS[view]
  const onHome = view === "home" || (platform === "none" && view === "tools")

  return (
    <header className="relative flex h-11 shrink-0 items-center gap-2 border-b bg-linear-to-b from-background to-card px-3">
      {onBack && (
        <HeaderButton label="Back" onClick={onBack} className="-ml-1.5">
          <ArrowLeftIcon />
        </HeaderButton>
      )}
      {page ? (
        <span className="shrink-0 text-primary [&_svg]:size-4.5">
          {page.icon}
        </span>
      ) : (
        <img
          src={onHome ? brandIcon : (product?.logo ?? brandIcon)}
          alt=""
          width={22}
          height={22}
          className="size-5.5 shrink-0 rounded-md object-contain"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
        {page?.title ?? (onHome ? "Dynamic Assist" : product?.name)}
      </span>

      {product && (
        <HeaderButton
          label={view === "home" ? `Back to ${product.name} tools` : "Home"}
          active={view === "home"}
          onClick={() => onGo("home")}
        >
          {view === "home" ? (
            <img src={product.logo} alt="" className="size-4 object-contain" />
          ) : (
            <HouseIcon />
          )}
        </HeaderButton>
      )}
      <Launcher platform={platform} url={url} />
      {(platform !== "none" || view !== "tools") && (
        <HeaderButton
          label="History"
          active={view === "history"}
          onClick={() => onGo("history")}
        >
          <HistoryIcon />
        </HeaderButton>
      )}
      <HeaderButton
        label={isDark ? "Light mode" : "Dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </HeaderButton>
      <DropdownMenu>
        <Hint label="More">
          <DropdownMenuTrigger
            aria-label="More"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => openHelp(platform)}>
            <LifeBuoyIcon />
            Help
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onGo("credits")}>
            <HeartIcon />
            About &amp; credits
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* The product's colours, as a thin line under the header */}
      <span
        aria-hidden
        className="absolute inset-x-0 -bottom-px h-0.5"
        style={{ background: "var(--brand-gradient)" }}
      />
    </header>
  )
}

function HeaderButton({
  label,
  active,
  className,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  className?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        active &&
          "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {children}
    </Button>
  )
}
