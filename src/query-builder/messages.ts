import type { BcOpenRequest } from "@/platforms/bc/query/BcQueryApp"

import type { OpenRequest } from "@/platforms/ce/query/ui/QueryApp"

export const QUERY_OPEN = "query:open"

export type QueryOpenMessage = {
  type: typeof QUERY_OPEN
  /** Dynamics 365 (FetchXML), or Business Central through the companion app */
  request: OpenRequest | BcOpenRequest
  dark: boolean
  /** The built stylesheet (query.css), linked inside the shadow root */
  cssUrl: string
}
