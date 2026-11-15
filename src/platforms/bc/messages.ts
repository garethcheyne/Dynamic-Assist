import type { CompanionProblem } from "./page-error"
import type { BcPageInfo } from "./page-info"
import type { BcOpenRequest } from "./query/BcQueryApp"

/** What one frame of a BC tab reports about itself. */
export type BcFrameState = {
  url: string
  isTop: boolean
  /** The current page, if this frame runs the web client. */
  page: BcPageInfo | null
  /** BC drew a page here that couldn't be read: the web client changed */
  unsupported?: boolean
}

/**
 * Side panel → content script; "bc:get-page" is the worker's (right-click
 * menu), answered with a BcPageAnswer by the frame that has a page.
 */
export type BcRequest = { type: "bc:ping" } | { type: "bc:get-page" }
export type BcPageAnswer = { page: BcPageInfo; dark: boolean }

/** A page tool's answer: what to tell the user, and data for menuTarget */
export type BcToolAnswer = { message?: string; data?: unknown }

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
  /** No bridge (yet); with a problem when Business Central said the page can't open */
  | { ready: false; problem?: CompanionProblem }
  | { ready: true; ok: true; result: unknown }
  | { ready: true; ok: false; error: string }

/**
 * Extension → the top frame of a tab written down as having the query page:
 * is its bridge still there? A record outlives the bridge when you close the
 * page or move on in that tab. Answered with { here: boolean }.
 */
export const BRIDGE_CHECK = "bc:bridge-check"
export type BcBridgeCheck = { type: typeof BRIDGE_CHECK }

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

/** Session storage: tabs with the query page or on their way to it, by tab ID */
export const CHANNELS_KEY = "bc:channels"
export type BcChannel = {
  tenant: string | null
  environment: string | null
  /** The company it's in; null until its bridge says hello, if none was asked for */
  company: string | null
  /** The company it was opened for: null asks BC for your default */
  asked: string | null
  /** When it started loading, or said hello */
  at: number
  /** Its bridge has said hello */
  ready: boolean
  /** Opened in the background, not yet on screen or answering: an older companion's dialog won't until it's been shown */
  neverShown: boolean
}

/**
 * Query builder → service worker: is the companion's query page open for this
 * environment and company? Answered with { open: boolean }.
 */
export const CHANNEL_STATUS = "bc:channel-status"
export type BcChannelStatus = { type: typeof CHANNEL_STATUS; url: string }

/**
 * Query builder → service worker, the first time in a company (no query page
 * open): load the query page in this tab, where the companion answers
 * directly, and open the builder again over it with the same request.
 */
export const SETUP_REQUEST = "bc:setup"
export type BcSetupRequest = {
  type: typeof SETUP_REQUEST
  request: BcOpenRequest
  dark: boolean
}

/**
 * Query builder → service worker: Business Central says the query page can't
 * open in this tab (page-error.ts). It's no channel, and no longer being set
 * up, so nothing waits for it or sends it back to the page.
 */
export const CHANNEL_GONE = "bc:channel-gone"
export type BcChannelGone = { type: typeof CHANNEL_GONE }

/** Session storage: tabs loading the query page for the builder, by tab ID */
export const SETUP_TABS_KEY = "bc:setupTabs"
export type BcSetupTab = {
  request: BcOpenRequest
  /** The page the builder was opened on, to go back to */
  returnUrl: string
  dark: boolean
  at: number
  /** The builder has been opened over the query page */
  opened?: boolean
}
