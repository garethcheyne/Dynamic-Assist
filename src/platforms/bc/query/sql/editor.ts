/**
 * The SQL editor for Business Central: the same CodeMirror editor as Dynamics
 * 365's, with suggestions and checks from this environment's tables. Its language
 * is for colouring only, so only what compiles to a query gets suggested.
 */
import * as React from "react"
import { MSSQL } from "@codemirror/lang-sql"
import { LanguageSupport } from "@codemirror/language"
import { lintGutter } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"

import {
  lintSource,
  source,
  type Loadable,
} from "@/platforms/ce/query/ui/editors"

import type { BcField, BcTable } from "../bridge"
import { bcSqlTablesIn, completeBcSql } from "./complete"
import { findTable, fromSql, type BcSqlMeta } from "./from-sql"

/** This environment's tables, with fields filled in as queries name tables. */
export function useBcSqlMeta(
  tables: BcTable[],
  fieldsOf: (table: number) => Promise<{ fields: BcField[] }>
): Loadable<BcSqlMeta> {
  const fields = React.useRef<Record<number, BcField[]>>({})
  return React.useMemo(
    () => ({
      get: () => ({ tables, fields: (t) => fields.current[t] ?? null }),
      ensure: async (names) => {
        const known: BcSqlMeta = { tables, fields: () => null }
        await Promise.all(
          names.map(async (name) => {
            const t = findTable(known, name)
            if (!t || fields.current[t.id]) return
            const loaded = await fieldsOf(t.id).catch(() => null)
            if (loaded) fields.current[t.id] = loaded.fields
          })
        )
      },
    }),
    [tables, fieldsOf]
  )
}

export function bcSqlExtensions(meta: Loadable<BcSqlMeta>): Extension {
  return [
    new LanguageSupport(MSSQL.language, [
      MSSQL.language.data.of({
        // Bracketed names can hold spaces and dots
        autocomplete: source(
          meta,
          bcSqlTablesIn,
          completeBcSql,
          /^\[?[\w .]*\]?$/
        ),
      }),
    ]),
    lintSource(meta, bcSqlTablesIn, (text, m) => fromSql(text, m).problems),
    lintGutter(),
  ]
}
