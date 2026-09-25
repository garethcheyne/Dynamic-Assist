/**
 * Tooltips for what the extension adds to BC and Dynamics 365 pages (field
 * badges, copy buttons), styled like the panel's shadcn tooltips instead of
 * the browser's own. One listener on the document shows one tooltip at a time.
 *
 * A tip is plain text, or a small card (title, detail rows, description, a
 * hint), or a loader that fetches the card the first time it's hovered.
 */

export type TipCard = {
  title: string
  /** Label and value pairs, shown as a two-column list */
  rows?: [string, string][]
  description?: string | null
  /** A last line in the accent colour: "Click to copy" */
  hint?: string
}

export type TipContent = string | TipCard
type Loader = () => Promise<TipContent>

const TIP_ID = "dynamic-assist-tip"
const ATTR = "data-da-tip"

/** Per product, matching the panel's --primary (styles/tokens.css) */
let accent = "#0a6f96"

const content = new WeakMap<Element, TipContent>()
const loaders = new WeakMap<Element, Loader>()

let tip: HTMLDivElement | null = null
let current: HTMLElement | null = null

function ensureTip() {
  if (tip?.isConnected) return tip
  tip = document.createElement("div")
  tip.id = TIP_ID
  tip.setAttribute("role", "tooltip")
  tip.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "max-width:320px",
    "padding:8px 11px",
    "border-radius:8px",
    "background:#171717",
    "color:#fafafa",
    'font:400 12px/1.45 "Segoe UI",system-ui,sans-serif',
    "box-shadow:0 6px 20px rgba(0,0,0,.28)",
    "pointer-events:none",
    "opacity:0",
    "transform:translateY(2px)",
    "transition:opacity .12s ease,transform .12s ease",
    "white-space:normal",
  ].join(";")
  const arrow = document.createElement("span")
  arrow.style.cssText =
    "position:absolute;width:8px;height:8px;margin-left:-4px;background:#171717;transform:rotate(45deg);border-radius:1px"
  tip.append(document.createElement("div"), arrow)
  document.documentElement.append(tip)
  return tip
}

const el = (tag: string, css: string, text?: string) => {
  const node = document.createElement(tag)
  node.style.cssText = css
  if (text !== undefined) node.textContent = text
  return node
}

/** Builds the tip's body; text only ever goes in as textContent. */
function render(body: HTMLElement, value: TipContent) {
  body.replaceChildren()
  if (typeof value === "string") {
    body.textContent = value
    return
  }
  body.append(
    el(
      "div",
      `font-weight:600;font-size:12.5px;padding-left:7px;border-left:3px solid ${accent};margin-bottom:${value.rows?.length || value.description ? 6 : 0}px`,
      value.title
    )
  )
  if (value.rows?.length) {
    const grid = el(
      "div",
      "display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:2px 0 0"
    )
    for (const [label, v] of value.rows)
      grid.append(
        el("span", "color:#a3a3a3;white-space:nowrap", label),
        el("span", "word-break:break-word;font-family:inherit", v)
      )
    body.append(grid)
  }
  if (value.description)
    body.append(el("div", "margin-top:6px;color:#d4d4d4", value.description))
  if (value.hint)
    body.append(
      el(
        "div",
        `margin-top:6px;color:${lighten(accent)};font-weight:600;font-size:11px`,
        value.hint
      )
    )
}

/** A lighter tone of the accent that reads on the dark tip */
function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.55)
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`
}

function place(el: HTMLElement) {
  const t = ensureTip()
  const r = el.getBoundingClientRect()
  t.style.left = "0px"
  t.style.top = "0px"
  const w = t.offsetWidth
  const h = t.offsetHeight
  const left = Math.max(
    8,
    Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)
  )
  // Above the element, or below when there's no room
  const above = r.top - h - 8 >= 0
  t.style.left = `${left}px`
  t.style.top = `${above ? r.top - h - 8 : r.bottom + 8}px`
  const arrow = t.lastChild as HTMLSpanElement
  arrow.style.left = `${r.left + r.width / 2 - left}px`
  arrow.style.bottom = above ? "-4px" : ""
  arrow.style.top = above ? "" : "-4px"
}

function show(target: HTMLElement) {
  const value = content.get(target) ?? target.getAttribute(ATTR)
  if (!value) return
  const t = ensureTip()
  render(t.firstChild as HTMLElement, value)
  t.style.opacity = "0"
  place(target)
  t.style.opacity = "1"
  t.style.transform = "translateY(0)"

  // Load the details once, then show them if it's still the one hovered
  const load = loaders.get(target)
  if (load) {
    loaders.delete(target)
    void load()
      .then((loaded) => {
        content.set(target, loaded)
        if (current === target) show(target)
      })
      .catch(() => {})
  }
}

function hide() {
  current = null
  if (tip) {
    tip.style.opacity = "0"
    tip.style.transform = "translateY(2px)"
  }
}

let installed = false

/** Starts showing tooltips in this document (once). */
function installPageTips() {
  if (installed) return
  installed = true
  document.addEventListener(
    "mouseover",
    (e) => {
      const found = (e.target as Element | null)?.closest?.(
        `[${ATTR}]`
      ) as HTMLElement | null
      if (found === current) return
      if (!found) return hide()
      current = found
      show(found)
    },
    true
  )
  document.addEventListener("scroll", hide, true)
  document.addEventListener("mousedown", hide, true)
}

/** The product's colour for tip titles and hints (the panel's --primary). */
export function setPageTipAccent(color: string) {
  accent = color
}

/**
 * Sets an element's tooltip. `value` is shown at once; `load`, when given,
 * fetches fuller details the first time it's hovered and replaces it.
 */
export function setPageTip(
  target: HTMLElement,
  value: TipContent,
  load?: Loader
) {
  const label = typeof value === "string" ? value : value.title
  target.setAttribute(ATTR, label)
  target.setAttribute("aria-label", label)
  target.removeAttribute("title")
  content.set(target, value)
  if (load) loaders.set(target, load)
  else loaders.delete(target)
  installPageTips()
  if (current === target) show(target)
}
