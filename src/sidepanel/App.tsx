import * as React from "react"
import type { ReactNode } from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import bcLogo from "@/assets/brand/bc.png"
import ceLogo from "@/assets/brand/ce.png"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { useActiveTab } from "@/lib/use-active-tab"
import { BcPanel } from "@/platforms/bc/panel/BcPanel"
import { CePanel } from "@/platforms/ce/panel/CePanel"
import { detectPlatform, type Platform } from "@/shared/detect"

const { name, version } = chrome.runtime.getManifest()
const icon = chrome.runtime.getURL("icons/icon48.png")

const PLATFORMS: Record<Platform, { name: string; logo: string } | null> = {
  bc: { name: "Business Central", logo: bcLogo },
  ce: { name: "Dynamics 365", logo: ceLogo },
  none: null,
}

export function App() {
  const tab = useActiveTab()
  const platform = detectPlatform(tab?.url)

  // The accent colours follow the product in the active tab (index.css).
  React.useEffect(() => {
    document.documentElement.dataset.platform = platform
  }, [platform])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <Header platform={platform} />
      {platform === "bc" && tab ? (
        <BcPanel key={tab.id} tab={tab} />
      ) : platform === "ce" && tab ? (
        <CePanel key={tab.id} tab={tab} />
      ) : (
        <Empty>
          Open Business Central or a Dynamics 365 app in this window, and its
          tools appear here.
        </Empty>
      )}
    </div>
  )
}

function Header({ platform }: { platform: Platform }) {
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const product = PLATFORMS[platform]

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-2.5 border-b bg-linear-to-b from-background to-card px-3">
      <img
        src={product?.logo ?? icon}
        alt=""
        width={26}
        height={26}
        className="size-6.5 shrink-0 object-contain"
      />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight">
          {product?.name ?? name}
        </span>
        <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          {product && (
            <img src={icon} alt="" width={12} height={12} className="size-3" />
          )}
          {product ? name : `v${version}`}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        title={isDark ? "Light mode" : "Dark mode"}
        aria-label={isDark ? "Light mode" : "Dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </Button>
      {/* The product's colours, as a thin line under the header */}
      <span
        aria-hidden
        className="absolute inset-x-0 -bottom-px h-0.5"
        style={{ background: "var(--brand-gradient)" }}
      />
    </header>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="max-w-64 text-center text-sm text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

export default App
