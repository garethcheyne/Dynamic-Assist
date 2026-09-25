/**
 * chrome.runtime.sendMessage from a content script, never throwing: it fails
 * (a closed panel) as a rejected promise, but once the extension has been
 * updated or reloaded it throws at once ("Extension context invalidated"),
 * and an old page's script mustn't put that in the page's errors.
 */
export function sendToExtension(message: unknown) {
  try {
    if (!chrome.runtime?.id) return
    chrome.runtime.sendMessage(message).catch(() => {})
  } catch {
    // The extension was updated or reloaded: this page's copy is retired
  }
}
