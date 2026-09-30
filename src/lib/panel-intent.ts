/**
 * Where the right-click menu wants the side panel to go, after opening it:
 * "Option set values" opens Tools → Option sets on one column. Kept in
 * session storage, since the panel may not have loaded yet when it's written.
 */
export const PANEL_INTENT_KEY = "panel:intent"
/** Older than this, an intent is spent: don't replay it on a later open */
export const PANEL_INTENT_FRESH_MS = 15_000

export type PanelIntent = {
  tabId: number
  /** Tools → Option sets, searched for this column */
  optionSet: string
  /** When it was asked for; tells one request from the next */
  seq: number
}

export function setPanelIntent(intent: Omit<PanelIntent, "seq">) {
  const value: PanelIntent = { ...intent, seq: Date.now() }
  return chrome.storage.session.set({ [PANEL_INTENT_KEY]: value })
}
