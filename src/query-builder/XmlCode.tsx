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
