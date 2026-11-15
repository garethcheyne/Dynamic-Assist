// The browser tests' tenant, environment and org: from .env at the repository's
// root, which git ignores. The repositories are public, so these never go in code.
import fs from "node:fs"
import path from "node:path"
import { parseEnv } from "node:util"

export const ENV_FILE = path.resolve(import.meta.dirname, "../../../.env")

/** What .env says, or null when there's no .env. */
export function loadConfig(file = ENV_FILE) {
  if (!fs.existsSync(file)) return null
  const env = parseEnv(fs.readFileSync(file, "utf8"))
  return {
    bc: {
      tenant: env.DA_E2E_BC_TENANT,
      environment: env.DA_E2E_BC_ENVIRONMENT,
      company: env.DA_E2E_BC_COMPANY,
      otherCompany: env.DA_E2E_BC_OTHER_COMPANY,
    },
    ce: { org: env.DA_E2E_CE_ORG },
    impersonateUser: env.DA_E2E_IMPERSONATE_USER || null,
    private: (env.DA_PRIVATE_VALUES ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  }
}
