/**
 * Compiles the AL the query builder generates (API query objects and record
 * code) with the real AL compiler, against Base Application symbols. Skipped
 * where the compiler or symbols aren't installed. Point it at them with:
 *   ALC_PATH       alc.exe (default: the VS Code AL extension's)
 *   AL_SYMBOLS     a .alpackages folder with System, System Application,
 *                  Business Foundation, Base Application and Application
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { toAl } from "@/platforms/bc/query/al"
import { toApiQuery } from "@/platforms/bc/query/api"
import type { BcQuery } from "@/platforms/bc/query/bridge"
import {
  customer,
  ctx,
  joinFields,
  paymentTermsJoin,
  query,
  related,
  salespersonJoin,
} from "./fixtures"

/** Runs alc and returns what it printed, whether or not it succeeded. */
function compile(args: string[]): string {
  try {
    return execFileSync(alc!, args, { encoding: "utf8" })
  } catch (e) {
    return String((e as { stdout?: string }).stdout ?? e)
  }
}

function findAlc(): string | null {
  if (process.env.ALC_PATH) return process.env.ALC_PATH
  const root = path.join(os.homedir(), ".vscode", "extensions")
  if (!fs.existsSync(root)) return null
  const ext = fs
    .readdirSync(root)
    .filter((d) => d.startsWith("ms-dynamics-smb.al-"))
    .sort()
    .pop()
  if (!ext) return null
  for (const rel of ["bin/alc.exe", "bin/win32/alc.exe", "bin/linux/alc"]) {
    const p = path.join(root, ext, rel)
    if (fs.existsSync(p)) return p
  }
  return null
}

function findSymbols(): string | null {
  const candidates = [
    process.env.AL_SYMBOLS,
    path.resolve(
      __dirname,
      "../../../../../DYN365_Business_Central/BusinessCentral-Extension-Template/.alpackages"
    ),
  ].filter(Boolean) as string[]
  return (
    candidates.find(
      (dir) =>
        fs.existsSync(dir) &&
        fs
          .readdirSync(dir)
          .some((f) => f.startsWith("Microsoft_Base Application"))
    ) ?? null
  )
}

const alc = findAlc()
const symbols = findSymbols()

const scenarios: Record<string, BcQuery> = {
  plain: query(),
  odataFilters: query({
    fields: [1, 2, 7, 59],
    filters: [
      { field: 1, filter: "10000..30000" },
      { field: 2, filter: "A*" },
      { field: 59, filter: ">0&<1000" },
    ],
  }),
  filtersInQuery: query({
    fields: [1, 2],
    filters: [
      { field: 2, filter: "A*B" },
      { field: 2, filter: "<>''" },
      { field: 7, filter: "O'Br*n" },
      { field: 54, filter: "01-01-25..t" },
      { field: 55, filter: "2025-01-01.." },
      { field: 61, filter: "<>0" },
      { field: 39, filter: "Ship|Invoice" },
    ],
  }),
  everything: query({
    fields: [1, 2, 7, 39, 54, 55, 59, 61, 80, 89, 2000000000, 2000000001],
    sort: [2, 7],
    descending: true,
    top: null,
  }),
  leftJoin: query({ joins: [salespersonJoin({ fields: [2, 3, 5102] })] }),
  innerJoin: query({ joins: [salespersonJoin({ inner: true })] }),
  joinFilters: query({
    joins: [
      salespersonJoin({
        filters: [
          { field: 2, filter: "A*" },
          { field: 3, filter: "(>5)" },
          { field: 5102, filter: "*@contoso.com" },
        ],
      }),
    ],
  }),
  twoJoins: query({
    fields: [1, 2, 59],
    filters: [{ field: 1, filter: ">20000" }],
    sort: [2],
    joins: [
      salespersonJoin({ fields: [2] }),
      paymentTermsJoin({
        fields: [2, 8],
        filters: [{ field: 8, filter: "<>''" }],
      }),
    ],
  }),
}

describe.skipIf(!alc || !symbols)("generated AL compiles", () => {
  it("compiles every scenario as an API query and as record code", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "da-alc-"))
    fs.mkdirSync(path.join(dir, "src"))
    fs.writeFileSync(
      path.join(dir, "app.json"),
      JSON.stringify({
        id: "0f3f2b8e-6b8c-4a57-9b43-3c1f0d7e2a11",
        name: "DA generated AL check",
        publisher: "ERR403",
        version: "1.0.0.0",
        platform: "25.0.0.0",
        application: "25.0.0.0",
        idRanges: [{ from: 50100, to: 50199 }],
        runtime: "14.0",
        features: ["NoImplicitWith"],
      })
    )
    let id = 50100
    for (const [name, q] of Object.entries(scenarios)) {
      const table = { ...customer, name: "Customer" }
      const api = toApiQuery(q, table, joinFields, ctx, related)
        .al.replace("query 50100", `query ${id}`)
        .replace(/"DA Customer API"/, `"DA ${name}"`)
        .replace("EntityName = 'customer'", `EntityName = '${name}'`)
        .replace("EntitySetName = 'customers'", `EntitySetName = '${name}s'`)
      fs.writeFileSync(path.join(dir, "src", `${name}.Query.al`), api)
      const record = toAl(q, table, joinFields, related)
      fs.writeFileSync(
        path.join(dir, "src", `${name}.Codeunit.al`),
        `codeunit ${id} "DA ${name} code"\n{\n    procedure Example()\n${record}\n}\n`
      )
      id++
    }
    const output = compile([
      `/project:${dir}`,
      `/packagecachepath:${symbols}`,
      `/out:${path.join(dir, "out.app")}`,
    ])
    const errors = output.split(/\r?\n/).filter((l) => /error AL\d+/.test(l))
    expect(errors, output).toEqual([])
    expect(fs.existsSync(path.join(dir, "out.app")), output).toBe(true)
    fs.rmSync(dir, { recursive: true, force: true })
  }, 120_000)
})

describe.skipIf(!alc)("the companion app compiles", () => {
  const project = path.resolve(__dirname, "../../../bc-companion")
  const cache = path.join(project, ".alpackages")
  it.skipIf(!fs.existsSync(cache))(
    "builds bc-companion",
    () => {
      const out = path.join(os.tmpdir(), `da-companion-${Date.now()}.app`)
      const output = compile([
        `/project:${project}`,
        `/packagecachepath:${cache}`,
        `/out:${out}`,
      ])
      expect(
        output.split(/\r?\n/).filter((l) => /(error|warning) AL\d+/.test(l)),
        output
      ).toEqual([])
      expect(fs.existsSync(out), output).toBe(true)
      fs.rmSync(out, { force: true })
    },
    120_000
  )
})
