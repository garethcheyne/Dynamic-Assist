import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@/index.css"
import "@/help/help.css"
import { App } from "./App.tsx"
import { CrashBoundary } from "@/components/crash-boundary"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { HelpPage } from "@/help/HelpPage"
import { CopyProvider } from "@/lib/copy.tsx"
import { WhatsNewPage } from "./WhatsNewView"

// One page, three uses: the side panel, and Help and What's new in tabs of
// their own (index.html?page=help, ?page=whatsnew). A second HTML entry would
// split React in two.
const page = new URLSearchParams(location.search).get("page")
const help = page === "help"
const whatsNew = page === "whatsnew"
if (help || whatsNew) document.documentElement.classList.add("help-page")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider delay={300}>
        <CrashBoundary>
          {help ? (
            <HelpPage />
          ) : whatsNew ? (
            <WhatsNewPage />
          ) : (
            <CopyProvider>
              <App />
            </CopyProvider>
          )}
        </CrashBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
