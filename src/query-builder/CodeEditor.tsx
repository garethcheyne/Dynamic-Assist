import * as React from "react"
import { cn } from "cn"
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete"
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language"
import { lintKeymap } from "@codemirror/lint"
import {
  Compartment,
  EditorState,
  Prec,
  type Extension,
} from "@codemirror/state"
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
} from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

// Colours are the da-xml-* and da-sql-* classes in query.css, light and dark
const highlight = HighlightStyle.define([
  { tag: [t.angleBracket, t.definitionOperator], class: "da-xml-punct" },
  { tag: t.tagName, class: "da-xml-tag" },
  { tag: t.attributeName, class: "da-xml-attr" },
  { tag: t.attributeValue, class: "da-xml-value" },
  { tag: [t.comment, t.lineComment, t.blockComment], class: "da-xml-comment" },
  { tag: t.keyword, class: "da-sql-keyword" },
  { tag: [t.string, t.special(t.string)], class: "da-sql-string" },
  { tag: [t.number, t.bool, t.null], class: "da-sql-number" },
  { tag: [t.operator, t.compareOperator], class: "da-sql-op" },
  { tag: [t.typeName, t.standard(t.name)], class: "da-sql-type" },
  { tag: t.special(t.name), class: "da-sql-ident" },
])

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "12px 0", caretColor: "var(--foreground)" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "color-mix(in srgb, var(--muted-foreground) 60%, transparent)",
    border: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--muted) 45%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    {
      backgroundColor:
        "color-mix(in srgb, var(--primary) 22%, transparent) !important",
    },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
    outline: "none",
  },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
    fontSize: "12.5px",
    maxHeight: "18em",
  },
  ".cm-tooltip-autocomplete > ul > li": { padding: "2px 8px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionDetail": {
    marginLeft: "10px",
    fontStyle: "normal",
    fontFamily: "var(--font-sans)",
    color: "var(--muted-foreground)",
  },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700" },
  ".cm-completionInfo": {
    padding: "6px 10px",
    maxWidth: "320px",
    fontFamily: "var(--font-sans)",
    fontSize: "12.5px",
  },
  ".cm-diagnostic": {
    padding: "4px 10px",
    fontFamily: "var(--font-sans)",
    fontSize: "12.5px",
  },
  ".cm-diagnostic a": {
    color: "var(--primary)",
    marginLeft: "6px",
    textDecoration: "underline",
  },
  ".cm-lintRange-info": {
    backgroundImage: "none",
    borderBottom: "1px dotted var(--muted-foreground)",
  },
  ".cm-snippetField": {
    backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
  },
})

/**
 * A code editor (CodeMirror 6) for the query builders: line numbers, undo,
 * bracket matching, the builder's colours, and whatever language, suggestions
 * and checks `extensions` bring. Mounts in the builder's shadow root.
 */
export function CodeEditor({
  value,
  onChange,
  extensions,
  label,
  placeholder,
  onRun,
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** Language, suggestions, checks; swapped in place when they change */
  extensions: Extension
  label: string
  placeholder?: string
  /** Ctrl+Enter */
  onRun?: () => void
  className?: string
}) {
  const host = React.useRef<HTMLDivElement>(null)
  const view = React.useRef<EditorView | null>(null)
  const language = React.useRef(new Compartment())
  // Latest callbacks, without rebuilding the editor
  const latest = React.useRef({ onChange, onRun })
  React.useEffect(() => {
    latest.current = { onChange, onRun }
  })

  React.useEffect(() => {
    const parent = host.current!
    const root = parent.getRootNode() as ShadowRoot | Document
    const v = new EditorView({
      parent,
      root,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ icons: false, activateOnTypingDelay: 80 }),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": label,
            spellcheck: "false",
          }),
          placeholder ? placeholderText(placeholder) : [],
          Prec.highest(
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  latest.current.onRun?.()
                  return true
                },
              },
            ])
          ),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            ...lintKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) latest.current.onChange(u.state.doc.toString())
          }),
          language.current.of(extensions),
        ],
      }),
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
    // The editor is built once; value and extensions sync below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A value set from outside (a saved query, the builder) replaces the text
  React.useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value)
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: value },
      })
  }, [value])

  React.useEffect(() => {
    view.current?.dispatch({
      effects: language.current.reconfigure(extensions),
    })
  }, [extensions])

  return (
    <div
      ref={host}
      className={cn("min-h-0 overflow-hidden bg-muted/30", className)}
    />
  )
}
