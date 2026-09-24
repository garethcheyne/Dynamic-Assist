import { AppWindowIcon, ServerIcon, UserRoundIcon } from "lucide-react"

import { CollapsibleSection, Count } from "@/components/collapsible-section"
import { Detail, DetailGrid } from "@/components/detail-grid"

import type { CeState } from "../types"

const offset = (minutes: number | null) => {
  if (minutes === null) return "—"
  const sign = minutes >= 0 ? "+" : "-"
  const m = Math.abs(minutes)
  return `UTC${sign}${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** You, the app and the environment. */
export function CeSessionView({ state }: { state: CeState }) {
  const { user, environment: env, app } = state
  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection
        id="ce.session.user"
        title="You"
        icon={<UserRoundIcon />}
      >
        <DetailGrid>
          <Detail label="Name" value={user.name} copy={user.name} wide />
          <Detail label="User ID" value={user.id} copy={user.id} mono wide />
          <Detail
            label="Language"
            value={user.languageId ? String(user.languageId) : "—"}
          />
          <Detail
            label="Time zone"
            value={offset(user.timeZoneOffsetMinutes)}
          />
        </DetailGrid>
      </CollapsibleSection>

      <CollapsibleSection
        id="ce.session.roles"
        title="Security roles"
        icon={<UserRoundIcon />}
        summary={<Count>{user.roles.length}</Count>}
        defaultCollapsed
      >
        <div className="flex flex-wrap gap-1">
          {[...user.roles].sort().map((r, i) => (
            <span
              key={`${r}-${i}`}
              className="rounded-md border bg-background px-1.5 py-0.5 text-[11px]"
            >
              {r}
            </span>
          ))}
        </div>
      </CollapsibleSection>

      {app && (
        <CollapsibleSection
          id="ce.session.app"
          title="App"
          icon={<AppWindowIcon />}
        >
          <DetailGrid>
            <Detail
              label="Name"
              value={app.displayName}
              copy={app.displayName}
            />
            <Detail
              label="Unique name"
              value={app.uniqueName}
              copy={app.uniqueName}
              mono
            />
            <Detail label="App ID" value={app.id} copy={app.id} mono wide />
          </DetailGrid>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        id="ce.session.env"
        title="Environment"
        icon={<ServerIcon />}
      >
        <DetailGrid>
          <Detail
            label="Name"
            value={env.friendlyName ?? env.orgUniqueName}
            copy={env.friendlyName ?? undefined}
            wide
          />
          <Detail label="URL" value={env.clientUrl} copy={env.clientUrl} wide />
          {env.environmentId && (
            <Detail
              label="Environment ID"
              value={env.environmentId}
              copy={env.environmentId}
              mono
              wide
            />
          )}
          <Detail
            label="Org unique name"
            value={env.orgUniqueName}
            copy={env.orgUniqueName}
            mono
            wide
          />
          <Detail label="Org ID" value={env.orgId} copy={env.orgId} mono wide />
          <Detail label="Version" value={env.version} copy={env.version} mono />
          <Detail label="Geo" value={env.geo ?? "—"} />
          {env.tenantId && (
            <Detail
              label="Tenant"
              value={env.tenantId}
              copy={env.tenantId}
              mono
              wide
            />
          )}
        </DetailGrid>
      </CollapsibleSection>
    </div>
  )
}
