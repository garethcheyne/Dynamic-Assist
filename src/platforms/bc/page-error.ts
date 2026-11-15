/**
 * Business Central's full-page error, for telling at once that a page can't
 * open: the companion isn't installed, or you can't run its page. Opening a
 * page number that doesn't exist, the web client frame shows, within seconds
 * of starting (seen in BC 28):
 *
 *   <div role="alertdialog" class="error-page">
 *     Something went wrong. Cannot build the page 77500. The metadata object
 *     Page 77500 was not found. Date and time: … Operation: … Go back home
 *
 * The wording follows the user's language; the page number doesn't, so the
 * error is matched on the number and only sorted by its words.
 *
 * The error is in the web client's frame, and whoever needs to know is in
 * the top frame (the query builder, the companion relay), so the top frame
 * asks every frame, as it pings for the bridge, and the content script in
 * the frame with the error answers.
 */

/** postMessage tag for asking frames about an error page, and their answers */
export const PAGE_ERROR_TAG = "dynamic-assist:page-error"

export type PageErrorAsk = {
  tag: typeof PAGE_ERROR_TAG
  type: "ask"
  page: number
}
export type PageErrorAnswer = {
  tag: typeof PAGE_ERROR_TAG
  type: "answer"
  page: number
  text: string
}

/**
 * Why the companion's page can't be used: it isn't installed, you can't run
 * it, or Business Central said something these words don't cover.
 */
export type CompanionProblemKind = "missing" | "denied" | "error"
export type CompanionProblem = {
  kind: CompanionProblemKind
  /** What Business Central said, the sentences that name the page */
  message: string
}

/**
 * The sentences of Business Central's error page in this document that name
 * this page, or null when there's no such error.
 */
export function pageErrorText(doc: Document, pageId: number): string | null {
  const named = new RegExp(`(^|\\D)${pageId}(\\D|$)`)
  for (const el of doc.querySelectorAll<HTMLElement>(".error-page")) {
    const text = (el.innerText || el.textContent || "").trim()
    const sentences = text
      .split(/\n+|(?<=\.)\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const naming = sentences.filter((s) => named.test(s))
    if (naming.length) return naming.join(" ").slice(0, 300)
  }
  return null
}

/** What an error about the companion's page means, from its (English) words. */
export function classifyPageError(text: string): CompanionProblemKind {
  if (
    /not found|does not exist|doesn't exist|isn't installed|not installed/i.test(
      text
    )
  )
    return "missing"
  if (/permission|not allowed|access/i.test(text)) return "denied"
  return "error"
}

/** In each frame: answer the top frame's question with this frame's error page. */
export function answerPageErrorAsks() {
  window.addEventListener("message", (event: MessageEvent<PageErrorAsk>) => {
    const ask = event.data
    if (
      event.origin !== location.origin ||
      ask?.tag !== PAGE_ERROR_TAG ||
      ask.type !== "ask" ||
      typeof ask.page !== "number" ||
      !event.source
    )
      return
    const text = pageErrorText(document, ask.page)
    if (!text) return
    const answer: PageErrorAnswer = {
      tag: PAGE_ERROR_TAG,
      type: "answer",
      page: ask.page,
      text,
    }
    ;(event.source as Window).postMessage(answer, location.origin)
  })
}
