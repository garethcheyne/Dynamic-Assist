/**
 * The query builder's entry point: injected into a Dynamics 365 page on demand
 * (chrome.scripting.executeScript from the panel), it mounts the modal in a
 * shadow root and opens it for each "query:open" message.
 *
 * It runs as an isolated-world content script, so its fetches use the page's
 * origin and session: relative /api/data URLs just work.
 */
import { StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { THEME_STORAGE_KEY as THEME_KEY } from "@/shared/theme"
import { CopyProvider } from "@/lib/copy"
import { BcQueryApp, type BcOpenRequest } from "@/platforms/bc/query/BcQueryApp"

import { QUERY_OPEN, type QueryOpenMessage } from "./messages"
import { ErrorBoundary } from "./ErrorBoundary"
import { QueryTiles } from "./QueryTiles"
import { scaleCss } from "./scale-css"
import { QueryApp, type OpenRequest } from "@/platforms/ce/query/ui/QueryApp"

declare global {
  interface Window {
    __dynamicAssistQuery?: boolean
  }
}

// executeScript runs this file again on every open; mount once per page
if (!window.__dynamicAssistQuery) {
  window.__dynamicAssistQuery = true
  mount()
}

/**
 * Tailwind v4 declares its internal variables (--tw-border-style, --tw-shadow…)
 * with @property, which browsers ignore inside a shadow root: without them
 * borders, rings and shadows don't draw. @property is global, so register the
 * same rules on the page. They only define --tw-* variables.
 */
async function registerProperties(href: string) {
  if (document.getElementById("dynamic-assist-query-properties")) return
  try {
    const css = await (await fetch(href)).text()
    const rules = css.match(/@property\s+--tw-[\w-]+\s*\{[^}]*\}/g) ?? []
    const style = document.createElement("style")
    style.id = "dynamic-assist-query-properties"
    style.textContent = rules.join("\n")
    document.head.appendChild(style)
  } catch {
    // Without them the modal still works, just with fewer borders
  }
}

function mount() {
  const host = document.createElement("div")
  host.id = "dynamic-assist-query"
  host.style.cssText = "position:relative;z-index:2147483000"
  const shadow = host.attachShadow({ mode: "open" })
  const container = document.createElement("div")
  shadow.append(container)
  // The stylesheet's URL arrives with the first open; render once it's loaded
  let styles: Promise<void> | null = null
  const loadStyles = (href: string) =>
    (styles ??= Promise.all([
      fetch(href)
        .then((r) => r.text())
        .then((css) => {
          const style = document.createElement("style")
          style.textContent = scaleCss(css)
          shadow.prepend(style)
        })
        .catch(() => {
          // Unscaled is better than unstyled
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = href
          shadow.prepend(link)
        }),
      registerProperties(href),
    ]).then(() => undefined))
  document.documentElement.appendChild(host)

  // Keys typed in the modal mustn't reach the app's own shortcuts
  for (const type of ["keydown", "keyup", "keypress"]) {
    host.addEventListener(type, (e) => e.stopPropagation())
  }

  const root: Root = createRoot(container)
  let seq = 0

  // Light or dark as chosen in the panel ("system" follows this page's
  // system setting), kept up to date while the builder is open
  type Theme = "light" | "dark" | "system"
  let theme: Theme | null = null
  let darkFallback = false
  const system = matchMedia("(prefers-color-scheme: dark)")
  const isDark = () =>
    theme === null
      ? darkFallback
      : theme === "dark" || (theme === "system" && system.matches)
  const readTheme = () =>
    chrome.storage.local
      .get(THEME_KEY)
      .then((items) => {
        const value = items[THEME_KEY]
        theme =
          value === "light" || value === "dark" || value === "system"
            ? value
            : null
      })
      .catch(() => {})
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(THEME_KEY in changes)) return
    void readTheme().then(render)
  })
  system.addEventListener("change", () => theme === "system" && render())

  /**
   * Every builder opened on this page. One is shown at a time; the others are
   * minimised to tiles, still mounted, so their queries and results wait as
   * they were. Each one's callbacks are made once, so they're stable.
   */
  type Instance = {
    seq: number
    request: (OpenRequest | BcOpenRequest) & { seq: number }
    minimized: boolean
    title: string
    close: () => void
    minimize: () => void
    setTitle: (title: string) => void
  }
  let instances: Instance[] = []
  const show = (seq: number | null) => {
    instances = instances.map((i) => ({ ...i, minimized: i.seq !== seq }))
    render()
  }
  const open = (request: OpenRequest | BcOpenRequest) => {
    // The same request again (the Query builder button twice) brings back the
    // builder it opened; anything else opens another one
    const key = JSON.stringify(request)
    const same = instances.find(
      (i) => JSON.stringify({ ...i.request, seq: undefined }) === key
    )
    if (same) return show(same.seq)
    seq += 1
    const id = seq
    const isBc = "app" in request && request.app === "bc"
    instances.push({
      seq: id,
      request: { ...request, seq: id },
      minimized: false,
      title: isBc ? "Business Central" : "Dynamics 365",
      close: () => {
        instances = instances.filter((i) => i.seq !== id)
        render()
      },
      minimize: () => show(null),
      setTitle: (title) => {
        const instance = instances.find((i) => i.seq === id)
        if (!instance || instance.title === title) return
        instance.title = title
        render()
      },
    })
    show(id)
  }

  function render() {
    const dark = isDark()
    root.render(
      <StrictMode>
        <TooltipProvider delay={300}>
          <CopyProvider>
            {instances.map((i) => (
              // display:none keeps a minimised builder's state
              <div
                key={i.seq}
                style={i.minimized ? { display: "none" } : undefined}
              >
                <ErrorBoundary onClose={i.close}>
                  {"app" in i.request && i.request.app === "bc" ? (
                    <BcQueryApp
                      request={i.request}
                      dark={dark}
                      onClose={i.close}
                      onMinimize={i.minimize}
                      onTitle={i.setTitle}
                    />
                  ) : (
                    <QueryApp
                      request={i.request}
                      dark={dark}
                      onClose={i.close}
                      onMinimize={i.minimize}
                      onTitle={i.setTitle}
                    />
                  )}
                </ErrorBoundary>
              </div>
            ))}
            <QueryTiles
              tiles={instances
                .filter((i) => i.minimized)
                .map((i) => ({
                  seq: i.seq,
                  title: i.title,
                  platform:
                    "app" in i.request && i.request.app === "bc" ? "bc" : "ce",
                }))}
              dark={dark}
              onRestore={show}
              onClose={(id) => instances.find((i) => i.seq === id)?.close()}
            />
          </CopyProvider>
        </TooltipProvider>
      </StrictMode>
    )
  }

  chrome.runtime.onMessage.addListener(
    (message: QueryOpenMessage, _sender, respond) => {
      if (message?.type !== QUERY_OPEN) return false
      darkFallback = message.dark ?? false
      void Promise.all([loadStyles(message.cssUrl), readTheme()]).then(() =>
        open(message.request)
      )
      respond(true)
      return false
    }
  )
}
