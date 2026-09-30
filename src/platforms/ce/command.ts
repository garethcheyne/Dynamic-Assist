import type {
  CeCommand,
  CeCommandResponse,
  CeCommands,
  CeRequest,
  CeStateAnswer,
} from "./types"

/**
 * Runs a command in a Dynamics 365 tab's page (main-world.ts, through
 * ce-content.ts in the top frame), from the side panel or the service worker.
 */
export async function runCe<C extends CeCommand>(
  tabId: number,
  command: C,
  ...args: CeCommands[C]["args"] extends void ? [] : [CeCommands[C]["args"]]
): Promise<CeCommands[C]["result"]> {
  const request: CeRequest = { type: "ce:command", command, args: args[0] }
  const response = (await chrome.tabs.sendMessage(tabId, request, {
    frameId: 0,
  })) as CeCommandResponse | undefined
  if (!response) throw new Error("The page didn't answer. Reload it.")
  if (!response.ok) throw new Error(response.error ?? "Failed.")
  return response.result as CeCommands[C]["result"]
}

/** The page's state as its content script last heard it, for the worker. */
export async function ceStateOf(tabId: number): Promise<CeStateAnswer> {
  const request: CeRequest = { type: "ce:get-state" }
  const answer = (await chrome.tabs
    .sendMessage(tabId, request, { frameId: 0 })
    .catch(() => null)) as CeStateAnswer | null
  return answer ?? { state: null, dark: false }
}
