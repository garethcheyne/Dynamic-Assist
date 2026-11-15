/**
 * Environments where Business Central said the Dynamic Assist Companion's
 * page can't open (page-error.ts): not installed, or not yours to run.
 * Written down per environment, since apps are installed per environment,
 * so the panel's companion tools are off with the reason and what to install,
 * and the query builder says so at once instead of waiting for a page that
 * will never answer.
 *
 * It's forgotten when the companion answers, when you choose Check again,
 * and after a day, in case it has been installed since. Kept in
 * chrome.storage.local on this machine only; Settings clears it with the
 * rest of the Business Central cache.
 */
import type { CompanionProblem } from "./page-error"
import type { BcContext } from "./url"

export const COMPANION_STATUS_PREFIX = "bc:companion:"
const PREFIX = COMPANION_STATUS_PREFIX
/** After this, it's checked again the next time it's needed */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export type CompanionStatus = CompanionProblem & {
  at: number
  /** The environment, as its URL names it, for saying where */
  environment: string | null
}

type Where = Pick<BcContext, "tenant" | "environment">

/** The storage key for a tenant and environment. */
export const companionStatusKey = (ctx: Where) =>
  `${PREFIX}${ctx.tenant ?? ""}/${ctx.environment ?? "default"}`.toLowerCase()

export const isCompanionStatusKey = (key: string) => key.startsWith(PREFIX)

/** Still worth believing: written down within the day. */
export const isCurrent = (
  status: CompanionStatus | null | undefined
): status is CompanionStatus => !!status && Date.now() - status.at < MAX_AGE_MS

/** What's known to be wrong with the companion here, or null. */
export async function companionStatus(
  ctx: Where
): Promise<CompanionStatus | null> {
  const key = companionStatusKey(ctx)
  try {
    const status = (await chrome.storage.local.get(key))[key] as
      CompanionStatus | undefined
    return isCurrent(status) ? status : null
  } catch {
    return null
  }
}

export async function markCompanionProblem(
  ctx: Where,
  problem: CompanionProblem
) {
  const status: CompanionStatus = {
    ...problem,
    at: Date.now(),
    environment: ctx.environment,
  }
  await chrome.storage.local
    .set({ [companionStatusKey(ctx)]: status })
    .catch(() => undefined)
}

/** It answered, or you asked to check again. */
export async function clearCompanionProblem(ctx: Where) {
  await chrome.storage.local
    .remove(companionStatusKey(ctx))
    .catch(() => undefined)
}

/** One line for an error message: what's wrong, where, in Business Central's words. */
export function companionProblemText(problem: CompanionProblem, where: Where) {
  const env = where.environment ?? "this environment"
  const said = `Business Central says: "${problem.message}"`
  if (problem.kind === "missing")
    return `The Dynamic Assist Companion app isn't installed in ${env}. ${said}`
  if (problem.kind === "denied")
    return `You can't open the Dynamic Assist Companion's page in ${env}. ${said}`
  return `Business Central couldn't open the Dynamic Assist Companion's page in ${env}. ${said}`
}

/** An error that carries the problem, so callers can tell it from a slow page. */
export class CompanionProblemError extends Error {
  readonly problem: CompanionProblem
  constructor(problem: CompanionProblem, where: Where) {
    super(companionProblemText(problem, where))
    this.name = "CompanionProblemError"
    this.problem = problem
  }
}
