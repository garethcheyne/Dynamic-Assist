/** A query's results, as both builders (Dynamics 365 and Business Central) show and export them. */
export type Cell = { value: unknown; formatted: string | null }
export type Row = Record<string, Cell>
export type Column = { key: string; label: string }

export type Results = {
  columns: Column[]
  rows: Row[]
  /** More rows matched than came back (top or page size) */
  more: boolean
  ms: number
}
