import * as React from "react"
import { cn } from "cn"

import { xmlTokens } from "@/lib/xml-tokens"

/** Coloured spans for XML; colours come from the da-xml-* classes in query.css. */
function Highlighted({ text }: { text: string }) {
  const tokens = React.useMemo(() => xmlTokens(text), [text])
  return tokens.map((t, i) =>
    t.kind === "text" ? (
      t.text
    ) : (
      <span key={i} className={`da-xml-${t.kind}`}>
        {t.text}
      </span>
    )
  )
}

/** Read-only, coloured XML. */
export function XmlCode({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <pre
      className={cn(
        "p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap",
        className
      )}
    >
      <Highlighted text={text} />
    </pre>
  )
}

// The textarea and the coloured copy under it must lay text out identically
const LAYER =
  "col-start-1 row-start-1 m-0 min-h-full p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"

/**
 * Editable, coloured XML: a transparent textarea over a coloured copy of its
 * text. The box grows with its text and its parent scrolls, so the two layers
 * never scroll apart.
 */
export function XmlEditor({
  value,
  onChange,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
}) {
  return (
    <div className={cn("min-h-0 overflow-auto bg-muted/30", className)}>
      <div className="grid min-h-full">
        <pre aria-hidden className={cn(LAYER, "pointer-events-none")}>
          <Highlighted text={value} />
          {/* A trailing newline needs a character after it to take up a line */}
          {"​"}
        </pre>
        <textarea
          aria-label={label}
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            LAYER,
            "resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/25"
          )}
        />
      </div>
    </div>
  )
}
