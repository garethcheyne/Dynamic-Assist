/**
 * A forgiving XML reader for editors: it keeps every element's and attribute's
 * position, carries on past mistakes (reporting them as problems), and can say
 * what the cursor is in when the text stops half-way through a tag. Enough XML
 * for FetchXML: elements, attributes, text, comments and the <?xml?> line; no
 * DTDs or CDATA.
 */

export type XmlAttr = {
  name: string
  /** Without its quotes; null when the attribute has no value yet */
  value: string | null
  from: number
  /** End of the name */
  nameTo: number
  /** Inside the quotes; equal to nameTo when there's no value */
  valueFrom: number
  valueTo: number
}

export type XmlElement = {
  name: string
  attrs: XmlAttr[]
  /** The "<" */
  from: number
  nameFrom: number
  nameTo: number
  /** After the open tag's ">" or "/>" */
  openTo: number
  /** After the closing tag (or the open tag when self-closing or never closed) */
  to: number
  selfClosing: boolean
  children: XmlElement[]
  /** Text directly inside, trimmed, with where it sits */
  text: { value: string; from: number; to: number }[]
  parent: XmlElement | null
}

export type XmlProblem = { from: number; to: number; message: string }

/** Where the text ends, when it ends inside a tag (what a completion needs). */
export type XmlCursor =
  | { kind: "text"; parent: XmlElement | null }
  /** Typing an element name after "<" */
  | { kind: "tag-name"; parent: XmlElement | null; typed: string; from: number }
  /** Typing a closing tag's name after "</" */
  | {
      kind: "close-tag"
      parent: XmlElement | null
      typed: string
      from: number
    }
  /** Inside a tag, typing an attribute name (or about to) */
  | { kind: "attr-name"; element: XmlElement; typed: string; from: number }
  /** Inside an attribute's quotes */
  | {
      kind: "attr-value"
      element: XmlElement
      attr: string
      typed: string
      from: number
      quote: string
    }

export type XmlTree = {
  roots: XmlElement[]
  problems: XmlProblem[]
  /** Every element, in document order */
  all: XmlElement[]
  cursor: XmlCursor
}

const NAME = /[A-Za-z_:][\w.:-]*/y
const SPACE = /\s+/y

function match(re: RegExp, text: string, at: number): string | null {
  re.lastIndex = at
  return re.exec(text)?.[0] ?? null
}

/**
 * Reads XML. Given a cursor, reads only up to it, to learn what's being typed
 * there (and doesn't complain about what the rest of the text would close).
 */
export function readXml(text: string, cursorAt?: number): XmlTree {
  const whole = cursorAt === undefined
  const src = whole ? text : text.slice(0, cursorAt)
  const problems: XmlProblem[] = []
  const roots: XmlElement[] = []
  const all: XmlElement[] = []
  const stack: XmlElement[] = []
  const top = () => stack[stack.length - 1] ?? null
  let cursor: XmlCursor = { kind: "text", parent: null }
  let i = 0

  const addText = (from: number, to: number) => {
    const raw = src.slice(from, to)
    const value = raw.trim()
    if (!value) return
    const start = from + raw.indexOf(value)
    const parent = top()
    if (parent)
      parent.text.push({ value, from: start, to: start + value.length })
    else
      problems.push({
        from: start,
        to: start + value.length,
        message: "Text outside the root element",
      })
  }

  while (i < src.length) {
    const lt = src.indexOf("<", i)
    if (lt < 0) {
      addText(i, src.length)
      break
    }
    addText(i, lt)
    i = lt

    // Comments and the declaration
    if (src.startsWith("<!--", i)) {
      const close = src.indexOf("-->", i + 4)
      if (close < 0) {
        if (whole)
          problems.push({
            from: i,
            to: i + 4,
            message: "Comment is never closed",
          })
        break
      }
      i = close + 3
      continue
    }
    if (src.startsWith("<?", i)) {
      const close = src.indexOf("?>", i + 2)
      i = close < 0 ? src.length : close + 2
      continue
    }

    // Closing tag
    if (src.startsWith("</", i)) {
      const nameFrom = i + 2
      const name = match(NAME, src, nameFrom) ?? ""
      let j = nameFrom + name.length
      j += match(SPACE, src, j)?.length ?? 0
      if (j >= src.length) {
        cursor = {
          kind: "close-tag",
          parent: top(),
          typed: name,
          from: nameFrom,
        }
        break
      }
      if (src[j] !== ">") {
        problems.push({
          from: i,
          to: j,
          message: `Expected ">" to close </${name}>`,
        })
      } else j++
      const at = stack.map((e) => e.name).lastIndexOf(name)
      if (at < 0) {
        problems.push({
          from: i,
          to: j,
          message: name
            ? `</${name}> has no matching <${name}>`
            : "Empty closing tag",
        })
      } else {
        // Anything opened after it and not closed is a mistake
        for (const open of stack.splice(at + 1)) {
          problems.push({
            from: open.from,
            to: open.nameTo,
            message: `<${open.name}> is never closed`,
          })
          open.to = i
        }
        stack.pop()!.to = j
      }
      i = j
      continue
    }

    // Opening tag
    const nameFrom = i + 1
    const name = match(NAME, src, nameFrom) ?? ""
    if (!name) {
      if (nameFrom >= src.length) {
        cursor = { kind: "tag-name", parent: top(), typed: "", from: nameFrom }
        break
      }
      problems.push({ from: i, to: i + 1, message: 'A "<" must start a tag' })
      i++
      continue
    }
    const el: XmlElement = {
      name,
      attrs: [],
      from: i,
      nameFrom,
      nameTo: nameFrom + name.length,
      openTo: nameFrom + name.length,
      to: nameFrom + name.length,
      selfClosing: false,
      children: [],
      text: [],
      parent: top(),
    }
    let j = el.nameTo
    if (j >= src.length) {
      cursor = { kind: "tag-name", parent: top(), typed: name, from: nameFrom }
      break
    }

    // Attributes, up to > or />
    let closed = false
    while (j < src.length) {
      j += match(SPACE, src, j)?.length ?? 0
      if (j >= src.length) break
      if (src[j] === ">") {
        j++
        closed = true
        break
      }
      if (src.startsWith("/>", j)) {
        j += 2
        el.selfClosing = true
        closed = true
        break
      }
      if (src[j] === "<") break
      const attrName = match(NAME, src, j)
      if (!attrName) {
        problems.push({
          from: j,
          to: j + 1,
          message: `Unexpected "${src[j]}" in <${name}>`,
        })
        j++
        continue
      }
      const attr: XmlAttr = {
        name: attrName,
        value: null,
        from: j,
        nameTo: j + attrName.length,
        valueFrom: j + attrName.length,
        valueTo: j + attrName.length,
      }
      j = attr.nameTo
      if (j >= src.length) {
        cursor = {
          kind: "attr-name",
          element: el,
          typed: attrName,
          from: attr.from,
        }
        break
      }
      let k = j + (match(SPACE, src, j)?.length ?? 0)
      if (src[k] === "=") {
        k++
        k += match(SPACE, src, k)?.length ?? 0
        const quote = src[k]
        if (quote === '"' || quote === "'") {
          const close = src.indexOf(quote, k + 1)
          // A value doesn't run past its line: a missing quote shouldn't swallow the rest
          const eol = src.indexOf("\n", k + 1)
          if (close < 0 || (eol >= 0 && eol < close)) {
            if (close < 0 && eol < 0) {
              cursor = {
                kind: "attr-value",
                element: el,
                attr: attrName,
                typed: src.slice(k + 1),
                from: k + 1,
                quote,
              }
              attr.value = src.slice(k + 1)
              attr.valueFrom = k + 1
              attr.valueTo = src.length
              el.attrs.push(attr)
              j = src.length
              break
            }
            problems.push({
              from: attr.from,
              to: eol,
              message: `The value of ${attrName} is missing its closing quote`,
            })
            attr.value = src.slice(k + 1, eol)
            attr.valueFrom = k + 1
            attr.valueTo = eol
            j = eol
          } else {
            attr.value = src.slice(k + 1, close)
            attr.valueFrom = k + 1
            attr.valueTo = close
            j = close + 1
          }
        } else if (k >= src.length) {
          j = k
        } else {
          const bare = /[^\s>/]*/y
          bare.lastIndex = k
          const value = bare.exec(src)?.[0] ?? ""
          problems.push({
            from: k,
            to: k + value.length,
            message: `Put the value of ${attrName} in quotes`,
          })
          attr.value = value
          attr.valueFrom = k
          attr.valueTo = k + value.length
          j = k + value.length
        }
      } else {
        problems.push({
          from: attr.from,
          to: attr.nameTo,
          message: `${attrName} needs a value (${attrName}="…")`,
        })
      }
      if (el.attrs.some((a) => a.name === attrName))
        problems.push({
          from: attr.from,
          to: attr.nameTo,
          message: `${attrName} appears twice on <${name}>`,
        })
      el.attrs.push(attr)
    }

    if (!closed && j >= src.length && cursor.kind === "text") {
      // Stopped inside the tag, between attributes
      cursor = { kind: "attr-name", element: el, typed: "", from: src.length }
    } else if (!closed && cursor.kind === "text") {
      problems.push({
        from: el.from,
        to: el.nameTo,
        message: `<${name}> is missing its ">"`,
      })
    }

    el.openTo = j
    el.to = j
    all.push(el)
    if (el.parent) el.parent.children.push(el)
    else roots.push(el)
    if (!el.selfClosing && (closed || cursor.kind !== "text")) stack.push(el)
    i = j
    if (cursor.kind !== "text") break
  }

  if (cursor.kind === "text") cursor = { kind: "text", parent: top() }
  // Unclosed elements, when reading the whole text
  if (whole) {
    for (const open of stack)
      problems.push({
        from: open.from,
        to: open.nameTo,
        message: `<${open.name}> is never closed`,
      })
  }
  if (whole && roots.length > 1)
    for (const extra of roots.slice(1))
      problems.push({
        from: extra.from,
        to: extra.nameTo,
        message: "Only one root element is allowed",
      })

  return { roots, problems, all, cursor }
}

/** An attribute's value, or null. */
export const attr = (el: XmlElement, name: string) =>
  el.attrs.find((a) => a.name === name)?.value ?? null

/** The attribute itself, or undefined. */
export const attrOf = (el: XmlElement, name: string) =>
  el.attrs.find((a) => a.name === name)
