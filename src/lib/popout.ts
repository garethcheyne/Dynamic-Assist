/**
 * The panel in a window of its own: the same page (index.html?popout=1) in a
 * popup window you can move and size, instead of the browser's side panel.
 * It follows the tab you're working in, in the browser window you last used
 * (use-active-tab.ts), and docks back into the side panel from its menu.
 */

/** This page is the popped-out panel */
export const isPopout =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("popout")

/**
 * The browser window the pop-out is following, kept up to date by
 * use-active-tab.ts. Dock to side panel needs it at once: Chrome opens a side
 * panel only straight from a click, before anything is awaited.
 */
let followedWindow: number | undefined
export const followWindow = (id: number | undefined) => {
  followedWindow = id
}

/** The pop-out's window, while it's open, so a second Pop out brings it forward */
const WINDOW_KEY = "panel:popoutWindow"

const POPOUT_URL = () =>
  chrome.runtime.getURL("src/sidepanel/index.html?popout=1")

/** Opens the panel in its own window (or brings it forward), then closes the side panel */
export async function popOut() {
  const saved = (await chrome.storage.session.get(WINDOW_KEY))[WINDOW_KEY] as
    number | undefined
  const existing =
    saved === undefined
      ? null
      : await chrome.windows.get(saved).catch(() => null)
  if (existing?.id !== undefined) {
    await chrome.windows.update(existing.id, { focused: true })
  } else {
    const height = Math.min(
      900,
      Math.max(560, (screen.availHeight || 900) - 80)
    )
    const created = await chrome.windows.create({
      url: POPOUT_URL(),
      type: "popup",
      width: 440,
      height,
      focused: true,
    })
    if (created?.id !== undefined)
      await chrome.storage.session.set({ [WINDOW_KEY]: created.id })
  }
  // A side panel closes itself this way; it's back the next time it's opened
  window.close()
}

/** Back into the side panel of the browser window you were using, and closes this window */
export function dockBack() {
  const opening =
    followedWindow === undefined
      ? Promise.resolve()
      : chrome.sidePanel
          .open({ windowId: followedWindow })
          .catch(() => undefined)
  void opening
    .then(() => chrome.storage.session.remove(WINDOW_KEY))
    .finally(() => window.close())
}
