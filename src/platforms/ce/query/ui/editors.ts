/**
 * The FetchXML and SQL editors' language, suggestions and checks, fed by the
 * org's metadata. Suggestions and checks load the columns and relationships of
 * the tables a query mentions first, so they're accurate once loaded.
 */
import * as React from "react"
import {
  snippet,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete"
import { xml, xmlLanguage } from "@codemirror/lang-xml"
import { MSSQL } from "@codemirror/lang-sql"
import { LanguageSupport } from "@codemirror/language"
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"

import {
  completeFetchXml,
  tablesIn,
  type Completions,
  type Suggestion,
} from "../editor/fetch-complete"
import { lintFetchXml, type Problem } from "../editor/fetch-lint"
import { staticMeta, type EditorMeta } from "../editor/meta"
import { completeSql, sqlTablesIn } from "../editor/sql-complete"
import { lintSql } from "../editor/sql-lint"
import type { QueryBuilderField } from "../lib/types"
import {
  loadFields,
  loadRelationships,
  type Relationship,
  type TableInfo,
} from "../metadata"

export type MetaSource = {
  get: () => EditorMeta
  /** Load the columns and relationships of these tables (known ones only) */
  ensure: (tables: string[]) => Promise<void>
}

/** Metadata for the editors, filled in as queries mention tables. */
export function useEditorMeta(tables: TableInfo[]): MetaSource {
  const fields = React.useRef<Record<string, QueryBuilderField[]>>({})
  const relationships = React.useRef<Record<string, Relationship[]>>({})
  return React.useMemo(() => {
    const known = new Set(tables.map((t) => t.logicalName))
    return {
      get: () => staticMeta(tables, fields.current, relationships.current),
      ensure: async (names) => {
        await Promise.all(
          names
            .filter((n) => known.has(n))
            .flatMap((n) => [
              fields.current[n]
                ? null
                : loadFields(n).then(
                    (f) => void (fields.current[n] = f),
                    () => {}
                  ),
              relationships.current[n]
                ? null
                : loadRelationships(n).then(
                    (r) => void (relationships.current[n] = r),
                    () => {}
                  ),
            ])
        )
      },
    }
  }, [tables])
}

function toCompletion(s: Suggestion): Completion {
  return {
    label: s.label,
    detail: s.detail,
    info: s.info,
    type: s.type,
    boost: s.boost,
    apply: s.snippet ? snippet(s.snippet) : s.apply,
  }
}

/** A completion source from a pure suggester, loading the query's tables first. */
function source(
  meta: MetaSource,
  tablesOf: (text: string) => string[],
  complete: (text: string, pos: number, meta: EditorMeta) => Completions | null,
  validFor: RegExp
): CompletionSource {
  return async (ctx) => {
    const text = ctx.state.doc.toString()
    await meta.ensure(tablesOf(text))
    if (ctx.aborted) return null
    const result = complete(text, ctx.pos, meta.get())
    if (!result || (!result.options.length && !ctx.explicit)) return null
    return {
      from: result.from,
      options: result.options.map(toCompletion),
      validFor,
    }
  }
}

function lintSource(
  meta: MetaSource,
  tablesOf: (text: string) => string[],
  check: (text: string, meta: EditorMeta | null) => Problem[]
) {
  return linter(
    async (view): Promise<Diagnostic[]> => {
      const text = view.state.doc.toString()
      await meta.ensure(tablesOf(text))
      const length = view.state.doc.length
      return check(text, meta.get()).map((p) => {
        const from = Math.min(p.from, length)
        return {
          from,
          to: Math.min(Math.max(p.to, from), length),
          severity: p.severity,
          message: p.message,
          renderMessage: p.link
            ? () => {
                const el = document.createElement("span")
                el.textContent = p.message
                const a = document.createElement("a")
                a.href = p.link!
                a.target = "_blank"
                a.rel = "noreferrer"
                a.textContent = "Learn more"
                el.append(a)
                return el
              }
            : undefined,
        }
      })
    },
    { delay: 350 }
  )
}

export function fetchXmlExtensions(meta: MetaSource): Extension {
  return [
    xml({ autoCloseTags: true }),
    xmlLanguage.data.of({
      autocomplete: source(meta, tablesIn, completeFetchXml, /^[\w\-. ]*$/),
    }),
    lintSource(meta, tablesIn, lintFetchXml),
    lintGutter(),
  ]
}

export function sqlExtensions(meta: MetaSource): Extension {
  // The SQL language for colouring only: suggestions are ours, so only what
  // Dataverse SQL supports is offered
  return [
    new LanguageSupport(MSSQL.language, [
      MSSQL.language.data.of({
        autocomplete: source(meta, sqlTablesIn, completeSql, /^[\w.]*$/),
      }),
    ]),
    lintSource(meta, sqlTablesIn, lintSql),
    lintGutter(),
  ]
}
