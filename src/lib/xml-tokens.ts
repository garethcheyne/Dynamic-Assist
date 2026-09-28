/**
 * Splits XML (FetchXML, mostly) into coloured pieces for display. Forgiving:
 * half-typed markup still comes out as pieces, and joining every piece's text
 * gives back the input exactly, so an editor can lay it under a textarea.
 */
export type XmlTokenKind =
  | "punct" // < </ > /> = and the XML declaration's ?
  | "tag" // element name
  | "attr" // attribute name
  | "value" // attribute value, with its quotes
  | "comment"
  | "text"

export type XmlToken = { kind: XmlTokenKind; text: string }

export function xmlTokens(xml: string): XmlToken[] {
  const out: XmlToken[] = []
  const push = (kind: XmlTokenKind, text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last?.kind === kind) last.text += text
    else out.push({ kind, text })
  }

  let i = 0
  while (i < xml.length) {
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4)
      const stop = end < 0 ? xml.length : end + 3
      push("comment", xml.slice(i, stop))
      i = stop
      continue
    }
    if (xml[i] !== "<") {
      const next = xml.indexOf("<", i)
      const stop = next < 0 ? xml.length : next
      push("text", xml.slice(i, stop))
      i = stop
      continue
    }

    // A tag: <name, </name or <?xml, then attributes, then > or />
    const open = xml.startsWith("</", i) || xml.startsWith("<?", i) ? 2 : 1
    push("punct", xml.slice(i, i + open))
    i += open
    const name = /^[^\s/>=?]+/.exec(xml.slice(i))?.[0] ?? ""
    push("tag", name)
    i += name.length

    while (i < xml.length && xml[i] !== "<") {
      const c = xml[i]
      if (c === ">") {
        push("punct", ">")
        i++
        break
      }
      if (xml.startsWith("/>", i) || xml.startsWith("?>", i)) {
        push("punct", xml.slice(i, i + 2))
        i += 2
        break
      }
      if (/\s/.test(c)) {
        const ws = /^\s+/.exec(xml.slice(i))![0]
        push("text", ws)
        i += ws.length
      } else if (c === "=") {
        push("punct", "=")
        i++
      } else if (c === '"' || c === "'") {
        const end = xml.indexOf(c, i + 1)
        // An unclosed value runs to the end of the line, not the file
        const eol = xml.indexOf("\n", i + 1)
        const stop =
          end >= 0 && (eol < 0 || end < eol)
            ? end + 1
            : eol >= 0
              ? eol
              : xml.length
        push("value", xml.slice(i, stop))
        i = stop
      } else {
        const attr = /^[^\s/>=<"']+/.exec(xml.slice(i))?.[0] ?? c
        push("attr", attr)
        i += attr.length
      }
    }
  }
  return out
}
