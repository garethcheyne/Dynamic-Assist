import type { OpenRequest } from "./ui/QueryApp"

export const QUERY_OPEN = "query:open"

export type QueryOpenMessage = {
  type: typeof QUERY_OPEN
  request: OpenRequest
  dark: boolean
  /** The built stylesheet (query.css), linked inside the shadow root */
  cssUrl: string
}
