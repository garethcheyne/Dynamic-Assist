/**
 * What to do when an environment doesn't have the Dynamic Assist Companion,
 * or won't let you open its page: shown in the side panel's Tools tab and in
 * the query builder, in the same words. Installing is often someone else's
 * job, so the steps can be copied to send to them.
 */
import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PackageOpenIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { COMPANION_APP } from "@/shared/links"

import type { CompanionStatus } from "./companion-status"
import { companionHeadline, companionStepsText } from "./companion-text"
import type { CompanionProblemKind } from "./page-error"
import { bcAdminCenterUrl, type BcContext } from "./url"

/** Links: the primary colour on a card, underlined in the panel's amber box */
const linkClass = (compact: boolean) =>
  compact
    ? "font-medium underline underline-offset-2"
    : "font-medium text-primary underline-offset-2 hover:underline"

/** The numbered steps. */
export function CompanionSteps({
  kind,
  ctx,
  aadTenantId,
  compact = false,
}: {
  kind: CompanionProblemKind | null
  ctx: BcContext | null
  aadTenantId?: string | null
  compact?: boolean
}) {
  const link = linkClass(compact)
  if (kind === "denied")
    return (
      <ol className="ml-4 flex list-decimal flex-col gap-1">
        <li>
          Ask your Business Central administrator for the <b>DA QUERY</b>{" "}
          permission set (or DA QUERY ADMIN). It grants no business data by
          itself.
        </li>
        <li>Once you have it, choose Check again.</li>
      </ol>
    )
  const admin = ctx ? bcAdminCenterUrl(ctx, aadTenantId) : null
  return (
    <ol className="ml-4 flex list-decimal flex-col gap-1">
      <li>
        Download{" "}
        <a href={COMPANION_APP} target="_blank" rel="noreferrer" className={link}>
          DynamicAssistCompanion.app
        </a>
        , the latest release.
      </li>
      <li>
        Upload the .app file in the{" "}
        {admin ? (
          <a href={admin} target="_blank" rel="noreferrer" className={link}>
            admin center
          </a>
        ) : (
          "admin center"
        )}{" "}
        (the environment, then <b>Apps</b> → <b>Install Extension</b>), or in{" "}
        <b>Extension Management</b> → <b>Manage</b> → <b>Upload Extension</b>.
        That needs the EXTEN. MGT. - ADMIN permission set.
      </li>
      <li>
        Give the people who query the <b>DA QUERY</b> permission set.
      </li>
      <li>Choose Check again.</li>
    </ol>
  )
}

/**
 * The whole explanation: what's wrong, in Business Central's words, the
 * steps, and the actions. `compact` for the side panel.
 */
export function CompanionSetup({
  status,
  ctx,
  aadTenantId,
  onRecheck,
  compact = false,
}: {
  /** null: not known why (it didn't answer in time) */
  status: CompanionStatus | null
  ctx: BcContext | null
  aadTenantId?: string | null
  onRecheck: () => void
  compact?: boolean
}) {
  const kind = status?.kind ?? null
  const env = status?.environment ?? ctx?.environment ?? "this environment"
  const [copied, setCopied] = React.useState(false)
  const copy = () =>
    void navigator.clipboard
      .writeText(companionStepsText(kind, env))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => undefined)
  const Icon = kind === "denied" ? ShieldAlertIcon : PackageOpenIcon

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-2 rounded-lg bg-sandbox p-2.5 text-xs leading-relaxed text-sandbox-foreground"
          : "flex flex-col gap-3 text-xs leading-relaxed"
      }
    >
      <p
        className={
          compact
            ? "flex items-start gap-1.5 font-semibold"
            : "flex flex-col items-center gap-3 text-center"
        }
      >
        <Icon
          className={
            compact ? "mt-px size-3.5 shrink-0" : "size-7 text-primary"
          }
        />
        <span
          className={compact ? "" : "text-sm font-semibold text-foreground"}
        >
          {status
            ? companionHeadline(kind, env)
            : "Querying Business Central needs the companion app"}
        </span>
      </p>
      <p className={compact ? "" : "text-muted-foreground"}>
        {status
          ? kind === "denied"
            ? "The query builder, Query this table, All fields and the Dynamics 365 record lookup work through its page, so they're off here until you can open it."
            : "The query builder, Query this table, All fields and the Dynamics 365 record lookup work through this small read-only app, so they're off here until it's installed. Everything else in the panel works without it."
          : "The query builder talks to a small read-only extension, Dynamic Assist Companion, through its Dynamic Assist Query page. It didn't answer: it may not be installed here, or Business Central is slow to start."}
      </p>
      {status?.message && (
        <p
          className={
            compact
              ? "rounded-md bg-background/60 px-2 py-1 font-mono text-[11px]"
              : "rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground"
          }
        >
          Business Central: {status.message}
        </p>
      )}
      <div className={compact ? "" : "text-muted-foreground"}>
        <CompanionSteps
          kind={kind}
          ctx={ctx}
          aadTenantId={aadTenantId}
          compact={compact}
        />
      </div>
      <div
        className={
          compact
            ? "flex flex-wrap gap-1.5"
            : "flex flex-wrap justify-center gap-2"
        }
      >
        {kind !== "denied" && (
          <Button
            size="sm"
            variant={compact ? "outline" : "default"}
            onClick={() => window.open(COMPANION_APP, "_blank")}
          >
            <DownloadIcon data-icon="inline-start" />
            Download
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          title="Copy these steps, to send to whoever installs Business Central apps"
          onClick={copy}
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy for your admin"}
        </Button>
        <Button size="sm" variant="outline" onClick={onRecheck}>
          <RefreshCwIcon data-icon="inline-start" />
          Check again
        </Button>
      </div>
    </div>
  )
}
