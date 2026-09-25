import type { BcPageInfo } from "./page-info"

/** What one frame of a BC tab reports about itself. */
export type BcFrameState = {
  url: string
  isTop: boolean
  /** The current page, if this frame runs the web client. */
  page: BcPageInfo | null
  /** BC drew a page here that couldn't be read: the web client changed */
  unsupported?: boolean
}

/** Side panel → content script. */
export type BcRequest = { type: "bc:ping" }

/** Side panel → content script: run a page tool; answered with { message } */
export const TOOL_REQUEST = "bc:tool"
export type BcToolRequest = {
  type: typeof TOOL_REQUEST
  command: import("./page-info").BcToolCommand
  on?: boolean
  /** appNames: installed apps by ID */
  data?: unknown
}

/** Content script → side panel. */
export type BcEvent = { type: "bc:state"; state: BcFrameState }

/**
 * Content script → service worker: the companion app's query page has loaded
 * in this tab, so open the query builder over it.
 */
export const BRIDGE_READY = "bc:bridge-ready"
export type BcBridgeReady = { type: typeof BRIDGE_READY; dark: boolean }

/**
 * Side panel → the top frame of a tab on the companion's query page: run one
 * companion method through its bridge. Answered with a CompanionAnswer.
 */
export const COMPANION_REQUEST = "bc:companion"
export type BcCompanionRequest = {
  type: typeof COMPANION_REQUEST
  method: string
  params?: object
}
export type CompanionAnswer =
  | { ready: false }
  | { ready: true; ok: true; result: unknown }
  | { ready: true; ok: false; error: string }

/**
 * Query builder on any BC page → service worker: run one companion method
 * through the query page of this environment and company, opened in the
 * background if need be. Answered with a CompanionRelayAnswer.
 */
export const COMPANION_RELAY = "bc:companion-relay"
export type BcCompanionRelay = {
  type: typeof COMPANION_RELAY
  /** The builder's page URL: environment and company to reach */
  url: string
  method: string
  params?: object
}
export type CompanionRelayAnswer =
  { ok: true; result: unknown } | { ok: false; error: string }

/** Tabs the panel opened on the query page to reach the companion (session storage) */
export const CHANNEL_TABS_KEY = "bc:channelTabs"
