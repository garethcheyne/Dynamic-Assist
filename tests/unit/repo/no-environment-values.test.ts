// The repositories are public: your tenant, environments and orgs stay out of
// them. .env (git-ignored) says what they are, and this fails if any of them is
// in a file git would commit. It can't name them itself, so it does nothing on a
// machine without that file.
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { parseEnv } from "node:util"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const ENV = path.join(ROOT, ".env")
const SIBLING = path.resolve(ROOT, "../Dynamic-Assist_BusinessCentralAddon")
const MAX_BYTES = 5_000_000

function privateValues(env: Record<string, string | undefined>) {
  const org = env.DA_E2E_CE_ORG
  const orgHost = org ? new URL(org).hostname : null
  return [
    env.DA_E2E_BC_TENANT,
    env.DA_E2E_BC_ENVIRONMENT,
    env.DA_E2E_BC_COMPANY,
    orgHost,
    orgHost?.split(".")[0],
    env.DA_E2E_IMPERSONATE_USER,
    ...(env.DA_PRIVATE_VALUES ?? "").split(",").map((v) => v.trim()),
  ].filter((v): v is string => !!v && v.length >= 4)
}

function committable(repo: string) {
  return execSync("git ls-files --cached --others --exclude-standard", {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64_000_000,
  })
    .split("\n")
    .filter(Boolean)
}

function offenders(repo: string, values: string[]) {
  const lowered = values.map((v) => v.toLowerCase())
  const found: string[] = []
  for (const file of committable(repo)) {
    const full = path.join(repo, file)
    if (!fs.existsSync(full)) continue
    if (fs.statSync(full).size > MAX_BYTES) continue
    const text = fs.readFileSync(full, "utf8").toLowerCase()
    // Which value it was stays out of the test's output: that's often a CI log
    if (lowered.some((v) => text.includes(v))) found.push(file)
  }
  return found
}

describe("no environment values in the repositories", () => {
  const hasConfig = fs.existsSync(ENV)
  const values = hasConfig
    ? privateValues(parseEnv(fs.readFileSync(ENV, "utf8")))
    : []

  it("git ignores .env, and keeps its example", () => {
    const ignored = (file: string) => {
      try {
        execSync(`git check-ignore -q ${file}`, { cwd: ROOT })
        return true
      } catch {
        return false
      }
    }
    expect(ignored(".env")).toBe(true)
    expect(ignored(".env.example")).toBe(false)
  })

  it.runIf(hasConfig)("this repository", () => {
    expect(offenders(ROOT, values)).toEqual([])
  })

  it.runIf(hasConfig && fs.existsSync(SIBLING))(
    "the companion repository",
    () => {
      expect(offenders(SIBLING, values)).toEqual([])
    }
  )
})
