import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@/index.css"
import { App } from "./App.tsx"
import { CrashBoundary } from "@/components/crash-boundary"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { SITE_LINKS } from "@/shared/links"
import { CopyProvider } from "@/lib/copy.tsx"

// Help and What's new are the website's docs and changelog now; an old link
// to either page (index.html?page=help, ?page=whatsnew) goes there
const page = new URLSearchParams(location.search).get("page")
if (page === "help") location.replace(SITE_LINKS.docs)
if (page === "whatsnew") location.replace(SITE_LINKS.changelog)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider delay={300}>
        <CrashBoundary>
          <CopyProvider>
            <App />
          </CopyProvider>
        </CrashBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
