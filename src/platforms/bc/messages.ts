import type { BcPageInfo } from "./page-info"

/** What one frame of a BC tab reports about itself. */
export type BcFrameState = {
  url: string
  isTop: boolean
  /** The current page, if this frame runs the web client. */
  page: BcPageInfo | null
}

/** Side panel → content script. */
export type BcRequest = { type: "bc:ping" }

/** Content script → side panel. */
export type BcEvent = { type: "bc:state"; state: BcFrameState }
