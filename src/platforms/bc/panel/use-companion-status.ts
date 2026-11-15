import * as React from "react"

import { useStorage } from "@/lib/use-storage"

import {
  clearCompanionProblem,
  companionStatusKey,
  isCurrent,
  type CompanionStatus,
} from "../companion-status"
import type { BcContext } from "../url"

/**
 * What's known to be wrong with the companion in this tab's environment (it
 * follows changes made anywhere), and Check again, which forgets it so the
 * next use asks Business Central again.
 */
export function useCompanionStatus(
  ctx: Pick<BcContext, "tenant" | "environment">
) {
  const [stored] = useStorage<CompanionStatus | null>(
    companionStatusKey(ctx),
    null
  )
  const status = isCurrent(stored) ? stored : null
  const { tenant, environment } = ctx
  const recheck = React.useCallback(
    () => void clearCompanionProblem({ tenant, environment }),
    [tenant, environment]
  )
  return [status, recheck] as const
}

/** The reason a companion tool is off, for its tooltip */
export const COMPANION_OFF =
  "Off here: the Dynamic Assist Companion isn't available in this environment. The Tools tab says what to install."
