/** Rows a query returns when it doesn't say */
export const DEFAULT_ROWS = 500
/** The most rows one query returns (Dataverse's largest page) */
export const MAX_ROWS = 5000

/** A query's row limit: its own, within 1 and MAX_ROWS, or the default. */
export const rowLimit = (top: number | null | undefined) =>
  top && top > 0 ? Math.min(Math.floor(top), MAX_ROWS) : DEFAULT_ROWS

/** The Rows box's text as a limit: empty means the default. */
export const parseRows = (text: string) => {
  const n = Number(text)
  return text && n > 0 ? Math.min(Math.floor(n), MAX_ROWS) : null
}
