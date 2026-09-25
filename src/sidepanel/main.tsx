import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@/index.css"
import "@/help/help.css"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { HelpPage } from "@/help/HelpPage"
import { CopyProvider } from "@/lib/copy.tsx"

// One page, two uses: the side panel, and Help in a tab of its own
// (index.html?page=help). A second HTML entry would split React in two.
const help = new URLSearchParams(location.search).get("page") === "help"
if (help) document.documentElement.classList.add("help-page")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider delay={300}>
        {help ? (
          <HelpPage />
        ) : (
          <CopyProvider>
            <App />
          </CopyProvider>
        )}
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
