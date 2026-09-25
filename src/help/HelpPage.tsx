import * as React from "react"
import {
  FootprintsIcon,
  MapPinIcon,
  MoonIcon,
  PuzzleIcon,
  SunIcon,
  WrenchIcon,
} from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { HELP_TABS } from "./tabs"
import type { HelpTab, HelpTool } from "./types"

const { version } = chrome.runtime.getManifest()
const icon = chrome.runtime.getURL("icons/icon128.png")
const REPO = "https://github.com/garethcheyne/Dynamic-Assist"

/** #bc or #bc/field-names → the tab and, if given, the tool to scroll to */
function readHash(): { tab: string; tool: string | null } {
  const [tab, tool] = decodeURIComponent(location.hash.slice(1)).split("/")
  return HELP_TABS.some((t) => t.id === tab)
    ? { tab, tool: tool || null }
    : { tab: HELP_TABS[0].id, tool: null }
}

const anchor = (tab: string, tool: string) => `${tab}--${tool}`

/**
 * Help as a page of its own, in a browser tab: one tab per product or topic,
 * describing every tool (what it does, how it works, what it needs). The
 * panel opens it at the product you're in (#bc, #ce, #maker, #flow), and it
 * takes that product's colours.
 */
export function HelpPage() {
  const [tab, setTab] = React.useState(() => readHash().tab)
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  const current = HELP_TABS.find((t) => t.id === tab) ?? HELP_TABS[0]

  // Colours follow the tab (tokens.css [data-platform])
  React.useEffect(() => {
    document.documentElement.dataset.platform = current.platform
    document.title = `${current.title} · Dynamic Assist help`
  }, [current])

  // A link to a tool (#ce/access) opens its tab and scrolls to it, on load
  // and when the hash changes
  React.useEffect(() => {
    const go = () => {
      const { tab, tool } = readHash()
      setTab(tab)
      if (tool)
        requestAnimationFrame(() =>
          document.getElementById(anchor(tab, tool))?.scrollIntoView()
        )
    }
    go()
    addEventListener("hashchange", go)
    return () => removeEventListener("hashchange", go)
  }, [])

  const pick = (next: string) => {
    setTab(next)
    history.replaceState(null, "", `#${next}`)
    scrollTo({ top: 0 })
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => pick(String(v))}
      className="min-h-screen gap-0 bg-background text-foreground"
    >
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
          <img src={icon} alt="" className="size-8 rounded-lg" />
          <div className="leading-tight">
            <p className="font-semibold">Dynamic Assist</p>
            <p className="text-xs text-muted-foreground">
              Help · version {version}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <a
              href={`${REPO}/issues`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Report an issue
            </a>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={isDark ? "Light theme" : "Dark theme"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl [scrollbar-width:none] overflow-x-auto overflow-y-hidden px-4">
          <TabsList variant="line" className="h-10 gap-0">
            {HELP_TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="h-9 flex-none px-3 after:inset-x-2! after:bottom-0! after:h-0.5 after:rounded-full after:bg-primary data-active:after:opacity-100 [&_img]:size-4"
              >
                {t.icon}
                {t.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-0.5"
          style={{ background: "var(--brand-gradient)" }}
        />
      </header>

      {HELP_TABS.map((t) => (
        <TabsContent key={t.id} value={t.id}>
          <TabPage tab={t} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function TabPage({ tab }: { tab: HelpTab }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[210px_1fr]">
      <nav className="hidden md:block" aria-label="On this page">
        <div className="sticky top-36 flex max-h-[calc(100vh-10rem)] [scrollbar-width:thin] flex-col gap-4 overflow-y-auto text-sm">
          {tab.groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {g.title}
              </p>
              <ul className="flex flex-col">
                {g.tools.map((tool) => (
                  <li key={tool.id}>
                    <a
                      href={`#${tab.id}/${tool.id}`}
                      className="block rounded-md border-l-2 border-transparent px-3 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {tool.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <main className="max-w-3xl min-w-0">
        <h1 className="mb-3 flex items-center gap-3 text-3xl font-bold tracking-tight">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary [&_img]:size-6 [&_svg]:size-5">
            {tab.icon}
          </span>
          {tab.title}
        </h1>
        <p className="mb-10 text-base leading-relaxed text-muted-foreground">
          {tab.intro}
        </p>

        <div className="flex flex-col gap-12">
          {tab.groups.map((g) => (
            <section key={g.title} className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {g.title}
                </h2>
                {g.intro && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {g.intro}
                  </p>
                )}
              </div>
              {g.tools.map((tool) => (
                <ToolCard key={tool.id} tab={tab.id} tool={tool} />
              ))}
            </section>
          ))}
        </div>

        <p className="mt-14 text-xs text-muted-foreground">
          Dynamic Assist is independent and not affiliated with Microsoft.
        </p>
      </main>
    </div>
  )
}

function ToolCard({ tab, tool }: { tab: string; tool: HelpTool }) {
  return (
    <article
      id={anchor(tab, tool.id)}
      className="scroll-mt-36 rounded-2xl border bg-card p-5 shadow-xs"
    >
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold">{tool.name}</h3>
        {tool.where && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            <MapPinIcon className="size-3" />
            {tool.where}
          </span>
        )}
      </header>
      <div className="help-body text-sm leading-relaxed text-foreground/90">
        {tool.what}
      </div>
      {(tool.how || tool.needs || tool.steps) && (
        <dl className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm leading-relaxed">
          {tool.how && (
            <Detail icon={<WrenchIcon />} label="How it works">
              {tool.how}
            </Detail>
          )}
          {tool.needs && (
            <Detail icon={<PuzzleIcon />} label="Needs">
              {tool.needs}
            </Detail>
          )}
          {tool.steps && (
            <Detail icon={<FootprintsIcon />} label="Try it">
              <ol className="list-decimal pl-5">
                {tool.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </Detail>
          )}
        </dl>
      )}
    </article>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-3">
      <dt className="flex items-center gap-1.5 font-medium text-primary sm:items-start sm:pt-0.5 [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="help-body text-muted-foreground">{children}</dd>
    </div>
  )
}
