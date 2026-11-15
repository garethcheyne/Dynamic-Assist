/**
 * Whether the home page's welcome card is hidden. Kept in the panel's
 * localStorage, like folded sections, so it's known before the first paint
 * and a hidden card never flashes in.
 */
const KEY = "home.introHidden"

export function introHidden() {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setIntroHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(KEY, "1")
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the card just shows again next time
  }
}
