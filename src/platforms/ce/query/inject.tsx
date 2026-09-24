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

import { CopyProvider } from "@/lib/copy"

import { QUERY_OPEN, type QueryOpenMessage } from "./messages"
import { QueryApp, type OpenRequest } from "./ui/QueryApp"

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
      new Promise<void>((resolve) => {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = href
        link.onload = link.onerror = () => resolve()
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

  const render = (
    request: (OpenRequest & { seq: number }) | null,
    dark = false
  ) =>
    root.render(
      <StrictMode>
        {request && (
          <CopyProvider>
            <QueryApp
              key={request.seq}
              request={request}
              dark={dark}
              onClose={() => render(null)}
            />
          </CopyProvider>
        )}
      </StrictMode>
    )

  chrome.runtime.onMessage.addListener(
    (message: QueryOpenMessage, _sender, respond) => {
      if (message?.type !== QUERY_OPEN) return false
      seq += 1
      const request = { ...message.request, seq }
      void loadStyles(message.cssUrl).then(() => render(request, message.dark))
      respond(true)
      return false
    }
  )
}
