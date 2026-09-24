import { Building2Icon, ServerIcon, UserRoundIcon } from "lucide-react"

import { CollapsibleSection } from "@/components/collapsible-section"
import { Detail, DetailGrid } from "@/components/detail-grid"

import type { BcPageInfo } from "../page-info"
import type { BcContext } from "../url"

/** Who you are and where: user, company, environment. */
export function SessionView({
  ctx,
  page,
}: {
  ctx: BcContext
  page: BcPageInfo | null
}) {
  const s = page?.session
  const env = page?.environment

  return (
    <div className="flex flex-col gap-3">
      {s && (
        <CollapsibleSection
          id="bc.session.user"
          title="You"
          icon={<UserRoundIcon />}
        >
          <DetailGrid>
            <Detail
              label="Name"
              value={s.displayName ?? "—"}
              copy={s.displayName ?? undefined}
            />
            <Detail
              label="User name"
              value={s.userName ?? "—"}
              copy={s.userName ?? undefined}
            />
            <Detail
              label="Email"
              value={s.upn ?? "—"}
              copy={s.upn ?? undefined}
              wide
            />
            <Detail
              label="User security ID"
              value={s.userSecurityId ?? "—"}
              copy={s.userSecurityId ?? undefined}
              mono
              wide
            />
            <Detail
              label="Role"
              value={s.profile?.caption ?? "—"}
              copy={s.profile?.id}
              title={s.profile?.id}
            />
            <Detail
              label="Tenant admin"
              value={s.isTenantAdmin ? "Yes" : "No"}
            />
            <Detail label="Language" value={s.language ?? "—"} />
            <Detail label="Time zone" value={s.timeZone ?? "—"} />
          </DetailGrid>
        </CollapsibleSection>
      )}

      {s?.company && (
        <CollapsibleSection
          id="bc.session.company"
          title="Company"
          icon={<Building2Icon />}
        >
          <DetailGrid>
            <Detail label="Name" value={s.company.name} copy={s.company.name} />
            <Detail label="Indicator" value={s.company.indicator || "—"} />
            {s.company.id && (
              <Detail
                label="ID"
                value={s.company.id}
                copy={s.company.id}
                mono
                wide
              />
            )}
          </DetailGrid>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        id="bc.session.environment"
        title="Environment"
        icon={<ServerIcon />}
      >
        <DetailGrid>
          <Detail
            label="Name"
            value={env?.name ?? ctx.environment ?? "(default)"}
            copy={env?.name ?? ctx.environment ?? undefined}
          />
          <Detail label="Type" value={env?.type ?? "—"} />
          {ctx.tenant && (
            <Detail
              label="Tenant"
              value={ctx.tenant}
              copy={ctx.tenant}
              mono
              wide
            />
          )}
          <Detail label="Platform" value={env?.platform ?? "—"} mono />
        </DetailGrid>
      </CollapsibleSection>

      {!s && (
        <p className="text-center text-xs text-muted-foreground">
          User details appear once a Business Central page has loaded.
        </p>
      )}
    </div>
  )
}
