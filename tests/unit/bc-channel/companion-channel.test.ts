import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  channelTabs,
  companionFor,
  hasChannel,
  markChannelLoading,
  markChannelReady,
} from "@/platforms/bc/companion-channel"
import { parseBcUrl } from "@/platforms/bc/url"

/**
 * How many tabs the side panel and query builder open to reach the companion.
 * Chrome and Business Central are simulated as they were seen to behave on a
 * real sandbox: a loading tab has a pending URL, then the sign-in site (whose
 * URL the extension can't read: undefined), then the query page. The page is a
 * StandardDialog, so BC then replaces the URL with ?company=…&dc=0 for good,
 * and the bridge starts later still. A tab that has never been on screen says
 * hello but holds its answers until it has been, and the bridge gives up after
 * two minutes.
 */
const BASE =
  "https://businesscentral.dynamics.com/00000000-1111-2222-3333-444444444444/SANDBOX/"
const DEFAULT_COMPANY = "CRONUS"
const queryUrl = (company: string | null) =>
  `${BASE}?${company ? `company=${encodeURIComponent(company)}&` : ""}page=77500`
const settledUrl = (company: string) =>
  `${BASE}?company=${encodeURIComponent(company)}&dc=0`
const ctx = (company: string | null = DEFAULT_COMPANY) =>
  parseBcUrl(`${BASE}?${company ? `company=${company}&` : ""}page=31`)

type FakeTab = {
  id: number
  url?: string
  pendingUrl?: string
  status: "loading" | "complete"
  /** The bridge is up in this tab */
  bridge: boolean
  /** Opened before the extension reloaded: nothing answers until it loads again */
  stale?: boolean
  active: boolean
  windowId: number
  /** Has been on screen since it last loaded */
  shown: boolean
  /** Answers waiting for it to be shown */
  held: (() => void)[]
}

let tabs: Map<number, FakeTab>
let created: string[]
let reloads: number[]
/** Tabs messaged, in order */
let checks: number[]
/** Tabs brought to the front, in order */
let activations: number[]
/** How long a tab that can answer takes to */
let answerMs: number
/** It answers without ever being on screen, as the full page does */
let answersHidden: boolean
let nextId: number
/** How long the sign-in site holds a tab */
let signInMs: number
/** The sign-in site waits for you: the tab is "complete" while it's there */
let signInWaits: boolean
/** A later load of the same tab goes through sign-in too */
let reloadSignsIn: boolean
/** From the page's URL settling to the bridge saying hello */
let startMs: number
/** The page keeps page=77500 in its URL, as a Card page would */
let keepsPageInUrl: boolean
/** The companion isn't installed: BC shows its error page instead */
let notInstalled: boolean
/** Tabs closed, in order */
let removed: number[]
const NOT_FOUND = {
  kind: "missing" as const,
  message: "The metadata object Page 77500 was not found.",
}

/** You, or the extension, bring a tab to the front. */
function bringToFront(id: number) {
  for (const t of tabs.values()) t.active = t.id === id
  const tab = tabs.get(id)!
  tab.shown = true
  for (const release of tab.held.splice(0)) release()
}

function load(tab: FakeTab, target: string, signIn: boolean) {
  tab.bridge = false
  tab.shown = tab.active
  tab.status = "loading"
  tab.pendingUrl = target
  setTimeout(() => {
    tab.pendingUrl = undefined
    if (signIn) {
      tab.url = undefined
      if (signInWaits) tab.status = "complete"
    }
    setTimeout(
      () => {
        tab.url = target
        tab.status = "complete"
        setTimeout(() => {
          const company =
            new URL(target).searchParams.get("company") ?? DEFAULT_COMPANY
          if (!keepsPageInUrl) tab.url = settledUrl(company)
          setTimeout(() => {
            if (notInstalled) return
            tab.bridge = true
            // As the service worker does when the bridge's hello arrives
            void markChannelReady(tab.id, tab.url!)
          }, startMs)
        }, 2000)
      },
      signIn ? signInMs : 0
    )
  }, 200)
}

function fakeChrome() {
  const session: Record<string, unknown> = {}
  const local: Record<string, unknown> = {}
  const update = async (
    id: number,
    change: { url?: string; active?: boolean }
  ) => {
    if (change.active) {
      activations.push(id)
      bringToFront(id)
      return
    }
    reloads.push(id)
    const tab = tabs.get(id)!
    tab.stale = false
    load(tab, change.url!, reloadSignsIn)
  }
  return {
    storage: {
      session: {
        get: async (key: string) => ({ [key]: session[key] }),
        set: async (items: Record<string, unknown>) =>
          void Object.assign(session, items),
      },
      local: {
        get: async (key: string) => ({ [key]: local[key] }),
        set: async (items: Record<string, unknown>) =>
          void Object.assign(local, items),
        remove: async (key: string) => void delete local[key],
      },
    },
    tabs: {
      query: async (filter: { active?: boolean; windowId?: number }) =>
        [...tabs.values()]
          .filter((t) =>
            filter.active
              ? t.active && t.windowId === filter.windowId
              : (t.url ?? t.pendingUrl ?? "").startsWith(BASE)
          )
          .map((t) => ({ ...t })),
      get: async (id: number) => {
        const tab = tabs.get(id)
        if (!tab) throw new Error("No tab")
        return { ...tab }
      },
      create: async ({ url }: { url: string }) => {
        created.push(url)
        const tab: FakeTab = {
          id: nextId++,
          status: "loading",
          bridge: false,
          active: false,
          windowId: 1,
          shown: false,
          held: [],
        }
        tabs.set(tab.id, tab)
        load(tab, url, true)
        return { ...tab }
      },
      update,
      remove: async (id: number) => {
        removed.push(id)
        tabs.delete(id)
      },
      reload: (id: number) =>
        update(id, {
          url: tabs.get(id)!.url ?? tabs.get(id)!.pendingUrl ?? "",
        }),
      sendMessage: async (id: number, message: { type: string }) => {
        const tab = tabs.get(id)
        if (!tab?.url || tab.stale)
          throw new Error("Receiving end does not exist")
        checks.push(id)
        if (message.type === "bc:bridge-check") return { here: tab.bridge }
        // BC's error page, read by the content script (page-error.ts)
        if (notInstalled && tab.status === "complete")
          return { ready: false, problem: NOT_FOUND }
        if (!tab.bridge) return { ready: false }
        return new Promise((resolve) => {
          const giveUp = setTimeout(
            () =>
              resolve({
                ready: true,
                ok: false,
                error: "Business Central didn't answer in time.",
              }),
            120_000
          )
          const answer = () =>
            setTimeout(() => {
              clearTimeout(giveUp)
              resolve({ ready: true, ok: true, result: "answer" })
            }, answerMs)
          if (tab.shown || answersHidden) answer()
          else tab.held.push(answer)
        })
      },
    },
  }
}

/** navigator.locks: one holder at a time, in order */
function fakeLocks() {
  let queue: Promise<unknown> = Promise.resolve()
  return {
    request: <T>(_name: string, work: () => Promise<T>) => {
      const next = queue.then(work)
      queue = next.catch(() => undefined)
      return next
    },
  }
}

function addTab(url: string, extra: Partial<FakeTab> = {}) {
  const tab: FakeTab = {
    id: nextId++,
    url,
    status: "complete",
    bridge: true,
    active: false,
    windowId: 1,
    shown: true,
    held: [],
    ...extra,
  }
  tabs.set(tab.id, tab)
  return tab
}

/** A tab with the dialog up, its URL rewritten, its hello received. */
async function addDialogTab(company = DEFAULT_COMPANY) {
  const tab = addTab(settledUrl(company))
  await markChannelReady(tab.id, tab.url!)
  return tab
}

/** Runs time on until the work has had long enough to finish. */
async function settle<T>(work: Promise<T>, ms = 400_000) {
  const caught = work.catch((error: unknown) => error as Error)
  await vi.advanceTimersByTimeAsync(ms)
  return caught
}
const ask = async (context = ctx()) => {
  const call = await companionFor(context)
  return call("info")
}

beforeEach(() => {
  vi.useFakeTimers()
  tabs = new Map()
  created = []
  reloads = []
  checks = []
  activations = []
  answerMs = 0
  answersHidden = false
  nextId = 1
  signInMs = 2500
  signInWaits = false
  reloadSignsIn = true
  startMs = 3000
  keepsPageInUrl = false
  notInstalled = false
  removed = []
  vi.stubGlobal("chrome", fakeChrome())
  vi.stubGlobal("navigator", { locks: fakeLocks() })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("reaching the companion", () => {
  it("uses a dialog that's up, whose URL no longer names the page", async () => {
    await addDialogTab()
    expect(await settle(ask())).toBe("answer")
    expect(created).toEqual([])
    expect(reloads).toEqual([])
  })

  it("uses a dialog opened over another page", async () => {
    const tab = addTab(`${BASE}?company=${DEFAULT_COMPANY}&page=22&dc=0`)
    await markChannelReady(tab.id, tab.url!)
    expect(await settle(ask())).toBe("answer")
    expect(created).toEqual([])
  })

  it("uses a page that keeps its number in the URL, and isn't written down", async () => {
    addTab(queryUrl(DEFAULT_COMPANY))
    expect(await settle(ask())).toBe("answer")
    expect(created).toEqual([])
  })

  it("opens one tab and reuses it when the page keeps its number in the URL", async () => {
    keepsPageInUrl = true
    expect(await settle(ask())).toBe("answer")
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
    expect(reloads).toEqual([])
  })

  it("opens one tab when the page keeps its number and its tab moves on", async () => {
    keepsPageInUrl = true
    const call = await companionFor(ctx())
    expect(await settle(call("info"))).toBe("answer")
    const [tab] = tabs.values()
    tab.bridge = false
    tab.url = `${BASE}?company=${DEFAULT_COMPANY}&page=22`
    expect(await settle(call("info"))).toBe("answer")
    expect(created).toHaveLength(2)
  })

  it("opens one tab when the sign-in is quick", async () => {
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
  })

  it("opens one tab when the sign-in is slow", async () => {
    signInMs = 30_000
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
    expect(reloads).toEqual([])
  })

  it("opens one tab for two callers at once", async () => {
    const both = Promise.all([ask(), ask()])
    expect(await settle(both)).toEqual(["answer", "answer"])
    expect(created).toHaveLength(1)
  })

  it("opens one tab for a caller arriving during the sign-in", async () => {
    const first = ask()
    await vi.advanceTimersByTimeAsync(1000)
    const second = ask()
    expect(await settle(Promise.all([first, second]))).toEqual([
      "answer",
      "answer",
    ])
    expect(created).toHaveLength(1)
  })

  it("opens no more for later callers, as after a worker restart", async () => {
    expect(await settle(ask())).toBe("answer")
    expect(await settle(ask())).toBe("answer")
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
    expect(reloads).toEqual([])
  })

  it("opens one tab when no company was asked for and BC picked one", async () => {
    expect(await settle(ask(ctx(null)))).toBe("answer")
    expect(await settle(ask(ctx(null)))).toBe("answer")
    expect(await settle(ask(ctx(DEFAULT_COMPANY)))).toBe("answer")
    expect(created).toHaveLength(1)
  })

  it("waits for a builder's first-run tab that doesn't know its company yet", async () => {
    const tab = addTab(`${BASE}`, { bridge: false, active: true })
    await markChannelLoading(ctx(null), tab.id)
    load(tab, queryUrl(null), false)
    expect(await settle(ask())).toBe("answer")
    expect(created).toEqual([])
    expect(reloads).toEqual([])
  })

  it("opens one tab for another company, as each has its own", async () => {
    await addDialogTab("CRONUS AU")
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
  })

  it("doesn't answer for a company the tab has since left", async () => {
    const tab = await addDialogTab(DEFAULT_COMPANY)
    tab.url = settledUrl("CRONUS AU")
    await markChannelReady(tab.id, tab.url)
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
  })

  it("opens one tab when you closed the dialog in that tab", async () => {
    const tab = await addDialogTab()
    tab.bridge = false
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
    expect(reloads).toEqual([])
  })

  it("opens one tab when you closed the dialog between two calls", async () => {
    const tab = await addDialogTab()
    const call = await companionFor(ctx())
    expect(await settle(call("info"))).toBe("answer")
    tab.bridge = false
    expect(await settle(call("info"))).toBe("answer")
    expect(created).toHaveLength(1)
  })

  it("opens another when the tab is closed while it loads", async () => {
    const asking = ask()
    await vi.advanceTimersByTimeAsync(1000)
    tabs.clear()
    expect(await settle(asking)).toBe("answer")
    expect(created).toHaveLength(2)
  })

  it("reloads a page left over from before the extension reloaded, in place", async () => {
    keepsPageInUrl = true
    const tab = addTab(queryUrl(DEFAULT_COMPANY), { stale: true })
    expect(await settle(ask())).toBe("answer")
    expect(created).toEqual([])
    expect(reloads).toEqual([tab.id])
  })

  it("stays with that page when loading it again goes through a slow sign-in", async () => {
    addTab(queryUrl(DEFAULT_COMPANY), { stale: true })
    signInMs = 30_000
    expect(await settle(ask())).toBe("answer")
    expect(created).toEqual([])
  })

  it("loads the query page again in a dialog's tab, which a reload would lose", async () => {
    const tab = await addDialogTab()
    tab.stale = true
    expect(await settle(ask())).toBe("answer")
    expect(created).toEqual([])
    expect(reloads).toEqual([tab.id])
  })

  it("doesn't reload a page another caller is still waiting for", async () => {
    startMs = 40_000
    const first = ask()
    await vi.advanceTimersByTimeAsync(5000)
    const second = ask()
    expect(await settle(Promise.all([first, second]))).toEqual([
      "answer",
      "answer",
    ])
    expect(created).toHaveLength(1)
    expect(reloads).toEqual([])
  })

  it("gives up with one tab when the companion isn't installed", async () => {
    startMs = 10_000_000
    const error = await settle(ask())
    expect((error as Error).message).toMatch(/Couldn't reach/)
    expect(created).toHaveLength(1)
    expect(reloads).toHaveLength(1)
  })

  it("stops within seconds, and closes its tab, when Business Central says the page doesn't exist", async () => {
    notInstalled = true
    const started = Date.now()
    const error = await settle(ask(), 60_000)
    expect((error as Error).message).toMatch(/isn't installed in SANDBOX/)
    expect((error as Error).message).toMatch(/was not found/)
    expect(Date.now() - started).toBeLessThanOrEqual(60_000)
    expect(created).toHaveLength(1)
    expect(removed).toEqual([1])
    expect(reloads).toEqual([])
  })

  it("opens no tab once Business Central has said the companion isn't there", async () => {
    notInstalled = true
    await settle(ask(), 60_000)
    const error = await settle(ask(ctx("Another company")), 60_000)
    expect((error as Error).message).toMatch(/isn't installed in SANDBOX/)
    expect(created).toHaveLength(1)
  })

  it("asks again once Check again has forgotten it", async () => {
    notInstalled = true
    await settle(ask(), 60_000)
    notInstalled = false
    await chrome.storage.local.remove(
      "bc:companion:00000000-1111-2222-3333-444444444444/sandbox"
    )
    expect(await settle(ask())).toBe("answer")
  })

  it("gives up with one tab when sign-in never finishes", async () => {
    signInMs = 10_000_000
    signInWaits = true
    const error = await settle(ask())
    expect((error as Error).message).toMatch(/Couldn't reach/)
    expect(created).toHaveLength(1)
    expect(reloads).toHaveLength(1)
  })

  it("counts a tab still signing in as the query page being open", async () => {
    const asking = ask()
    await vi.advanceTimersByTimeAsync(1000)
    expect(await hasChannel(ctx())).toBe(true)
    await settle(asking)
  })

  it("counts a query page that's up, having asked it", async () => {
    const tab = await addDialogTab()
    expect(await hasChannel(ctx())).toBe(true)
    expect(checks).toEqual([tab.id])
  })

  it("doesn't count a tab that has left the query page, and forgets it", async () => {
    const tab = await addDialogTab()
    tab.bridge = false
    tab.url = `${BASE}?company=${DEFAULT_COMPANY}&page=21`
    expect(await hasChannel(ctx())).toBe(false)
    // Forgotten: not asked again
    expect(await hasChannel(ctx())).toBe(false)
    expect(checks).toEqual([tab.id])
    expect(created).toEqual([])
  })

  it("doesn't count a page from before the extension reloaded, which can't answer", async () => {
    addTab(queryUrl(DEFAULT_COMPANY), { stale: true })
    expect(await hasChannel(ctx())).toBe(false)
  })

  it("passes over a tab that has moved on for one that's up", async () => {
    const gone = await addDialogTab()
    gone.bridge = false
    const up = await addDialogTab()
    expect(await hasChannel(ctx())).toBe(true)
    expect(checks).toEqual([gone.id, up.id])
  })

  it("opens a tab of its own once a tab that moved on is forgotten", async () => {
    const tab = await addDialogTab()
    tab.bridge = false
    tab.url = `${BASE}?company=${DEFAULT_COMPANY}&page=21`
    expect(await hasChannel(ctx())).toBe(false)
    expect(await settle(ask())).toBe("answer")
    expect(created).toHaveLength(1)
  })

  it("shows a background tab once so it answers, then goes back to yours", async () => {
    const yours = addTab(`${BASE}?company=${DEFAULT_COMPANY}&page=22`, {
      active: true,
    })
    expect(await settle(ask())).toBe("answer")
    const opened = [...tabs.values()].find((t) => t.id !== yours.id)!
    expect(activations).toEqual([opened.id, yours.id])
    expect(yours.active).toBe(true)
    // Having been on screen, it answers from the background from now on
    expect(await settle(ask())).toBe("answer")
    expect(activations).toHaveLength(2)
    expect(created).toHaveLength(1)
  })

  it("never shows a tab that answers from the background, as the full page does", async () => {
    answersHidden = true
    const yours = addTab(`${BASE}?company=${DEFAULT_COMPANY}&page=22`, {
      active: true,
    })
    expect(await settle(ask())).toBe("answer")
    // Having answered, a later slow query is no reason to show it
    answerMs = 30_000
    expect(await settle(ask())).toBe("answer")
    expect(activations).toEqual([])
    expect(yours.active).toBe(true)
    expect(created).toHaveLength(1)
  })

  it("doesn't show a tab you've already seen, however slow its answer", async () => {
    const yours = addTab(`${BASE}?company=${DEFAULT_COMPANY}&page=22`, {
      active: true,
    })
    await addDialogTab()
    answerMs = 30_000
    expect(await settle(ask())).toBe("answer")
    expect(activations).toEqual([])
    expect(yours.active).toBe(true)
  })

  it("doesn't pull you back if you moved to another tab meanwhile", async () => {
    const yours = addTab(`${BASE}?company=${DEFAULT_COMPANY}&page=22`, {
      active: true,
    })
    const other = addTab(`${BASE}?company=${DEFAULT_COMPANY}&page=21`)
    answerMs = 10_000
    const asking = ask()
    // Past the bridge's hello and the wait before showing it, not its answer
    await vi.advanceTimersByTimeAsync(13_500)
    expect(activations).toHaveLength(1)
    bringToFront(other.id)
    expect(await settle(asking)).toBe("answer")
    expect(other.active).toBe(true)
    expect(yours.active).toBe(false)
    expect(activations).toHaveLength(1)
  })

  it("lists dialog tabs for Settings, though their URLs don't say so", async () => {
    const tab = await addDialogTab()
    addTab(`${BASE}?company=${DEFAULT_COMPANY}&page=22`)
    expect((await channelTabs()).map((t) => t.id)).toEqual([tab.id])
  })
})
