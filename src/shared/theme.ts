/**
 * Where the panel's light/dark choice is kept for the rest of the extension:
 * the query builder runs in a BC or Dynamics 365 page, which can't read the
 * panel's localStorage but can read extension storage.
 */
export const THEME_STORAGE_KEY = "ui.theme"

export type ThemeChoice = "light" | "dark" | "system"
