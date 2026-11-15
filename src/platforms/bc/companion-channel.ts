/**
 * The companion app from the side panel. Its bridge only lives on its query
 * page (77500), so requests go to a tab showing that page in the same
 * environment and company; with none open, one opens in the background (and
 * stays, for next time). Everything runs as you, read-only, like the builder.
 *
 * A tab's URL can't be relied on to say whether it's that page. Companions
 * before 2026.11.6.2 have it as a StandardDialog: BC opens that over the role
 * center and within seconds drops page=77500 from the URL, and a dialog can be
 * open over any page. A tab loading it also passes through sign-in, where the
 * extension can't read its URL at all. So channels are written down: when a
 * tab starts loading the page, and when its bridge says hello. Whether the bridge is still there (you may
 * have closed the dialog) only the tab can say, when asked. Only one caller at
 * a time may decide to open a tab.
 */
import {
  clearCompanionProblem,
  companionStatus,
  CompanionProblemError,
  markCompanionProblem,
} from "./companion-status"
import type { CompanionCall } from "./coupling"
import {
  BRIDGE_CHECK,
  CHANNEL_TABS_KEY,
  CHANNELS_KEY,
  COMPANION_REQUEST,
  type BcBridgeCheck,
  type BcChannel,
  type BcCompanionRequest,
  type CompanionAnswer,
} from "./messages"
import { BRIDGE_PAGE_ID } from "./query/bridge"
import { buildBcUrl, parseBcUrl, type BcContext } from "./url"

const BC_ORIGIN = "https://businesscentral.dynamics.com"

/** How long a freshly opened query page gets to load BC and the bridge */
const OPEN_WAIT_MS = 90_000
/** How long a tab that has never been on screen gets to answer before it's shown */
const SHOW_AFTER_MS = 4000
/** The longest it's left on screen, if it's slow to answer */
const SHOW_AT_MOST_MS = 3000

/** A tab to talk to, and when it was (re)loaded: 0 when it should be up */
type Found = { tabId: number; loadedAt: number }

type Channels = Record<string, BcChannel>

const same = (a: string | null, b: string | null) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase()

const sameEnvironment = (
  a: Pick<BcContext, "tenant" | "environment">,
  b: Pick<BcContext, "tenant" | "environment">
) =>
  same(a.environment, b.environment) &&
  (!a.tenant || !b.tenant || same(a.tenant, b.tenant))

/**
 * Whether a written-down tab is for this company: the one it's in, or the one
 * it was opened for. Asked for with no company, BC picks your default; until
 * the bridge says hello the company isn't known, and it could be any.
 */
const servesCompany = (channel: BcChannel, ctx: BcContext) =>
  !channel.company ||
  same(ctx.company, channel.company) ||
  same(ctx.company, channel.asked)

const urlOf = (tab: chrome.tabs.Tab) => tab.pendingUrl || tab.url

/** Says it's the query page. Saying nothing doesn't mean it isn't one. */
function urlSaysQueryPage(tab: chrome.tabs.Tab) {
  const url = urlOf(tab)
  return (
    !!url?.startsWith(`${BC_ORIGIN}/`) &&
    parseBcUrl(url).page === BRIDGE_PAGE_ID
  )
}

/** The panel and the worker both open tabs: one at a time, across the two. */
const locked = <T>(work: () => Promise<T>): Promise<T> =>
  navigator.locks.request("dynamic-assist:bc-channel", work) as Promise<T>

/** Written-down tabs, without those that were loading and have had their time. */
async function readChannels(): Promise<Channels> {
  const stored = await chrome.storage.session.get(CHANNELS_KEY)
  const channels = (stored[CHANNELS_KEY] as Channels | undefined) ?? {}
  return Object.fromEntries(
    Object.entries(channels).filter(
      ([, c]) => c.ready || Date.now() - c.at < OPEN_WAIT_MS
    )
  )
}

const writeChannels = (channels: Channels) =>
  chrome.storage.session.set({ [CHANNELS_KEY]: channels })

/** Only call this inside locked() */
async function recordLoading(
  ctx: BcContext,
  tabId: number,
  neverShown = false
) {
  const at = Date.now()
  const channels = await readChannels()
  channels[tabId] = {
    tenant: ctx.tenant,
    environment: ctx.environment,
    company: ctx.company,
    asked: ctx.company,
    at,
    ready: false,
    neverShown,
  }
  await writeChannels(channels)
  return at
}

/** A tab is about to load the query page (the builder's first run does this). */
export function markChannelLoading(
  ctx: BcContext,
  tabId: number,
  neverShown = false
) {
  return locked(() => recordLoading(ctx, tabId, neverShown))
}

/** You've looked at this tab: from now on it answers from the background. */
export function markChannelShown(tabId: number) {
  return locked(async () => {
    const channels = await readChannels()
    const channel = channels[tabId]
    if (!channel?.neverShown) return false
    channel.neverShown = false
    await writeChannels(channels)
    return true
  })
}

/**
 * On companions before 2026.11.6.2, a query page that has never been on screen
 * says hello, then doesn't answer: BC holds back a dialog's calls to AL until
 * the tab has been visible once. So a tab that's taking its time is shown, until
 * it answers or for a few seconds, and the tab you were on comes back. It stays
 * able to answer after that. The full page answers from the background at once.
 */
async function showUntilAnswered(tabId: number, answered: Promise<unknown>) {
  if (!(await markChannelShown(tabId))) return
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (!tab || tab.active) return
  const [yours] = await chrome.tabs.query({
    active: true,
    windowId: tab.windowId,
  })
  await chrome.tabs.update(tabId, { active: true })
  await Promise.race([answered, wait(SHOW_AT_MOST_MS)])
  // Unless you've since moved on yourself
  const now = await chrome.tabs.get(tabId).catch(() => null)
  if (now?.active && yours?.id !== undefined)
    await chrome.tabs.update(yours.id, { active: true }).catch(() => undefined)
}

/** The bridge in this tab said hello; the URL is the tab's now. */
export function markChannelReady(tabId: number, url: string) {
  return locked(async () => {
    const ctx = parseBcUrl(url)
    const channels = await readChannels()
    const before = channels[tabId]
    // What it was opened for still holds, unless it has since changed company
    const keepAsked =
      before && (!before.ready || same(before.company, ctx.company))
    channels[tabId] = {
      tenant: ctx.tenant,
      environment: ctx.environment,
      company: ctx.company,
      asked: keepAsked ? before.asked : ctx.company,
      at: Date.now(),
      ready: true,
      neverShown: before?.neverShown ?? false,
    }
    await writeChannels(channels)
  })
}

/** The tab is closed, or its bridge has gone. */
export function forgetChannel(tabId: number) {
  return locked(async () => {
    const channels = await readChannels()
    if (!(tabId in channels)) return
    delete channels[tabId]
    await writeChannels(channels)
  })
}

const bcTabs = () => chrome.tabs.query({ url: `${BC_ORIGIN}/*` })

/** Every tab known or seen to be on the query page, in any company. */
export async function channelTabs() {
  const channels = await readChannels()
  const tabs = await bcTabs()
  return tabs.filter(
    (t) => (t.id !== undefined && t.id in channels) || urlSaysQueryPage(t)
  )
}

/** A tab with the query page for this environment and company, or on its way. */
async function findChannel(
  ctx: BcContext,
  skip: ReadonlySet<number> = new Set()
): Promise<Found | null> {
  const channels = Object.entries(await readChannels())
    .filter(([id]) => !skip.has(Number(id)))
    .filter(([, c]) => sameEnvironment(c, ctx) && servesCompany(c, ctx))
    // One that's up before one on its way
    .sort(([, a], [, b]) => Number(b.ready) - Number(a.ready))
  for (const [id, channel] of channels) {
    // Signing in, a tab isn't found by searching on its URL: ask for it by ID
    const tab = await chrome.tabs.get(Number(id)).catch(() => null)
    if (tab) return { tabId: tab.id!, loadedAt: channel.ready ? 0 : channel.at }
  }
  // Not written down, for one opened before the extension last reloaded
  const open = (await bcTabs()).find((t) => {
    if (t.id === undefined || skip.has(t.id) || !urlSaysQueryPage(t))
      return false
    const c = parseBcUrl(urlOf(t)!)
    return sameEnvironment(c, ctx) && same(c.company, ctx.company)
  })
  return open ? { tabId: open.id!, loadedAt: 0 } : null
}

/** Asks a tab whether its bridge is there. No answer (no page script) is no. */
async function bridgeHere(tabId: number) {
  const check: BcBridgeCheck = { type: BRIDGE_CHECK }
  const answer = (await chrome.tabs
    .sendMessage(tabId, check, { frameId: 0 })
    .catch(() => null)) as { here?: boolean } | null
  return answer?.here === true
}

/**
 * Whether a tab has the query page for this environment and company, or is on
 * its way to it. One written down as up is asked: the record stays when you
 * close the page or go elsewhere in that tab, and believing it would keep the
 * builder's first run from loading the page. One that doesn't answer is
 * forgotten.
 */
export async function hasChannel(ctx: BcContext) {
  const asked = new Set<number>()
  for (;;) {
    const found = await findChannel(ctx, asked)
    if (!found) return false
    // Still loading: it gets its time (see OPEN_WAIT_MS)
    if (found.loadedAt) return true
    if (await bridgeHere(found.tabId)) return true
    asked.add(found.tabId)
    await forgetChannel(found.tabId)
  }
}

/** Only call this inside locked() */
async function openChannel(ctx: BcContext): Promise<Found> {
  const tab = await chrome.tabs.create({
    url: buildBcUrl(ctx, { page: BRIDGE_PAGE_ID }),
    active: false,
  })
  // So the service worker doesn't open the query builder over it
  const stored = await chrome.storage.session.get(CHANNEL_TABS_KEY)
  const ids = (stored[CHANNEL_TABS_KEY] as number[] | undefined) ?? []
  await chrome.storage.session.set({ [CHANNEL_TABS_KEY]: [...ids, tab.id] })
  return { tabId: tab.id!, loadedAt: await recordLoading(ctx, tab.id!, true) }
}

/** Closes a query page tab the extension opened in the background, not one of yours. */
async function closeOpenedTab(tabId: number) {
  const stored = await chrome.storage.session.get(CHANNEL_TABS_KEY)
  const ids = (stored[CHANNEL_TABS_KEY] as number[] | undefined) ?? []
  if (!ids.includes(tabId)) return
  await chrome.storage.session.set({
    [CHANNEL_TABS_KEY]: ids.filter((id) => id !== tabId),
  })
  await chrome.tabs.remove(tabId).catch(() => undefined)
}

const findOrOpen = (ctx: BcContext) =>
  locked(async () => (await findChannel(ctx)) ?? (await openChannel(ctx)))

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * A caller for the companion in this environment and company. `onOpening`
 * says when it has to wait for the query page (the first call then takes a
 * while).
 */
export async function companionFor(
  ctx: BcContext,
  onOpening?: () => void
): Promise<CompanionCall> {
  // Business Central has said it isn't there: no tab for a page that can't open
  const known = await companionStatus(ctx)
  if (known) throw new CompanionProblemError(known, ctx)
  let { tabId, loadedAt } = await findOrOpen(ctx)
  if (loadedAt) onOpening?.()

  return async <T>(method: string, params?: object) => {
    const request: BcCompanionRequest = {
      type: COMPANION_REQUEST,
      method,
      params,
    }
    // A query page opened before the extension was updated or reloaded has no
    // content script to answer; loading it again once brings the bridge back
    let reloaded = false
    const started = Date.now()

    /** That tab is no use: another that's open or on its way, or a new one. */
    const moveOn = async () => {
      onOpening?.()
      ;({ tabId, loadedAt } = await findOrOpen(ctx))
      reloaded = false
    }

    for (;;) {
      const current = await chrome.tabs.get(tabId).catch(() => null)
      if (!current) {
        await moveOn()
        continue
      }
      const asking = chrome.tabs
        .sendMessage(tabId, request, { frameId: 0 })
        .catch(() => null) as Promise<CompanionAnswer | null>
      const showing = setTimeout(
        () =>
          void showUntilAnswered(current.id!, asking).catch(() => undefined),
        SHOW_AFTER_MS
      )
      const answer = await asking
      clearTimeout(showing)
      if (answer && !answer.ready && answer.problem) {
        // Business Central says the page can't open: not installed, or not
        // yours to run. Written down, so nothing waits for it again
        await markCompanionProblem(ctx, answer.problem)
        await forgetChannel(tabId)
        await closeOpenedTab(tabId)
        throw new CompanionProblemError(answer.problem, ctx)
      }
      if (answer?.ready) {
        // It's up: from here on, not finding the bridge means it's gone. And
        // it answers from the background, so a slow query needn't show it
        loadedAt = 0
        void markChannelShown(tabId).catch(() => undefined)
        void clearCompanionProblem(ctx)
        if (answer.ok) return answer.result as T
        throw new Error(answer.error)
      }
      // Reloaded since we last talked to it: it needs its time again
      if (!loadedAt && current.status === "loading") loadedAt = Date.now()
      // The tab answered, without a bridge. We thought it was up, so you closed
      // the dialog or went elsewhere, unless its URL says it's just starting
      if (answer && !loadedAt) {
        if (!urlSaysQueryPage(current)) {
          await forgetChannel(tabId)
          await moveOn()
          continue
        }
        loadedAt = Date.now()
      }
      // A few seconds for a page that's up; longer for one still loading
      const deadline = Math.max(started + 5000, loadedAt + OPEN_WAIT_MS)
      if (Date.now() > deadline && !reloaded) {
        reloaded = true
        onOpening?.()
        loadedAt = await markChannelLoading(ctx, tabId, !current.active)
        await (
          urlSaysQueryPage(current)
            ? chrome.tabs.reload(tabId)
            : chrome.tabs.update(tabId, {
                url: buildBcUrl(ctx, { page: BRIDGE_PAGE_ID }),
              })
        ).catch(() => undefined)
        continue
      }
      if (Date.now() > deadline && reloaded)
        throw new Error(
          "Couldn't reach the Dynamic Assist Companion. Is it installed in this environment, and can you open its Dynamic Assist Query page (77500)?"
        )
      await wait(1000)
    }
  }
}
