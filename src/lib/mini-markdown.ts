/**
 * Just enough Markdown for CHANGELOG.md: headings, paragraphs, bullet lists
 * (with wrapped lines), **bold**, `code` and [links](url). It never produces
 * HTML: the panel renders these blocks and spans as React elements, so text
 * from the network can't inject markup.
 */

export type Span =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string }

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; spans: Span[] }
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "list"; items: Span[][] }

/** Link reference definitions: "[2026.9.25]: https://…" */
const REFERENCE = /^\[[^\]]+\]:\s*\S+\s*$/
const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g

/**
 * Inline spans. `resolve` turns a link target into a full URL (relative ones
 * point into the repository); a target it rejects stays plain text.
 */
export function parseInline(
  text: string,
  resolve: (href: string) => string | null = (h) => h
): Span[] {
  const spans: Span[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last)
      spans.push({ kind: "text", text: text.slice(last, m.index) })
    if (m[1] !== undefined) spans.push({ kind: "bold", text: m[1] })
    else if (m[2] !== undefined) spans.push({ kind: "code", text: m[2] })
    else {
      const href = resolve(m[4])
      spans.push(
        href ? { kind: "link", text: m[3], href } : { kind: "text", text: m[3] }
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) })
  return spans
}

/** Blocks of a Markdown document, in order. */
export function parseMarkdown(
  source: string,
  resolve?: (href: string) => string | null
): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let items: string[] = []

  const flush = () => {
    if (paragraph.length)
      blocks.push({
        kind: "paragraph",
        spans: parseInline(paragraph.join(" "), resolve),
      })
    if (items.length)
      blocks.push({
        kind: "list",
        items: items.map((i) => parseInline(i, resolve)),
      })
    paragraph = []
    items = []
  }

  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd()
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flush()
      // "## [2026.9.25] — …": the reference link is just the version
      const text = heading[2].replace(/^\[([^\]]+)\](?!\()/, "$1")
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        spans: parseInline(text, resolve),
      })
    } else if (!line.trim() || REFERENCE.test(line)) {
      flush()
    } else if (/^[-*]\s+/.test(line)) {
      if (paragraph.length) flush()
      items.push(line.replace(/^[-*]\s+/, ""))
    } else if (items.length && /^\s+/.test(raw)) {
      // A bullet's wrapped line
      items[items.length - 1] += ` ${line.trim()}`
    } else {
      if (items.length) flush()
      paragraph.push(line.trim())
    }
  }
  flush()
  return blocks
}
