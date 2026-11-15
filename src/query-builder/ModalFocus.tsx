import * as React from "react"

/**
 * The visible builder keeps the keyboard, as a modal should. Without this,
 * keys go to the page underneath it (in Business Central, the web client's own
 * frame), so Esc and Ctrl+Enter do nothing until you click inside.
 *
 * It takes focus when it opens or comes back from a tile, takes it back if it
 * falls out (closing a picker's list, clicking the backdrop) or the page grabs
 * it (BC focuses its frame as it finishes loading), and hands it back to the
 * page when it closes or minimises.
 */
export function ModalFocus({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!active || !ref.current) return
    const wrapper = ref.current
    const root = wrapper.getRootNode() as ShadowRoot
    const before = document.activeElement as HTMLElement | null
    const hold = () =>
      wrapper
        .querySelector<HTMLElement>("[role=dialog]")
        ?.focus({ preventScroll: true })

    const hasFocus = () => !!root.activeElement
    if (!hasFocus()) hold()

    // Focus left for nowhere: nothing in here is focused now
    const onFocusOut = (e: FocusEvent) => {
      if (!e.relatedTarget) queueMicrotask(() => !hasFocus() && hold())
    }
    // A frame of the page took it. Not when you've left the browser window:
    // then the page's active element hasn't changed to a frame.
    const onWindowBlur = () => {
      setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") hold()
      })
    }
    wrapper.addEventListener("focusout", onFocusOut)
    window.addEventListener("blur", onWindowBlur)
    return () => {
      wrapper.removeEventListener("focusout", onFocusOut)
      window.removeEventListener("blur", onWindowBlur)
      if (before?.isConnected && before !== document.body) before.focus?.()
    }
  }, [active])

  return <div ref={ref}>{children}</div>
}
