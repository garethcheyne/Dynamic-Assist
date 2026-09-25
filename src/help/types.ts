import type { ReactNode } from "react"

/**
 * One tool, as the help page describes it: what it does, how it works
 * underneath, and anything it needs (an app, a privilege, a page).
 */
export type HelpTool = {
  /** Anchor, unique within its tab: #bc/field-names */
  id: string
  name: string
  /** Where to find it in the panel: "Tools tab", "Header" */
  where?: string
  what: ReactNode
  how?: ReactNode
  needs?: ReactNode
  /** Try it: short steps, in order */
  steps?: ReactNode[]
}

export type HelpGroup = {
  title: string
  intro?: ReactNode
  tools: HelpTool[]
}

export type HelpTab = {
  /** Also the page's hash: #bc, #ce, #maker, #flow */
  id: string
  title: string
  /** Logo (image URL) or icon */
  icon: ReactNode
  /** Colours the page takes on this tab (tokens.css [data-platform]) */
  platform: "bc" | "ce" | "maker" | "flow" | "none"
  intro: ReactNode
  groups: HelpGroup[]
}
