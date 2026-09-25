/**
 * Talks to the Dynamic Assist Companion app's bridge: a control add-in on the
 * "Dynamic Assist Query" page (bc-companion/). The add-in lives in a frame
 * inside the web client's frame; we find it by pinging every frame, then post
 * requests to it. AL answers as the signed-in user, read-only.
 */

export const BRIDGE_TAG = "dynamic-assist"
/** The companion's query page (bc-companion/src/DAQuery.Page.al) */
export const BRIDGE_PAGE_ID = 77500
const BC_ORIGIN = "https://businesscentral.dynamics.com"
const REQUEST_TIMEOUT_MS = 120_000

export type BcTable = {
  id: number
  name: string
  caption: string
  perCompany: boolean
  obsolete: boolean
}

import type { ConditionOp } from "./conditions"
import {
  COMPANION_RELAY,
  type BcCompanionRelay,
  type CompanionRelayAnswer,
} from "../messages"

/**
 * A filter: the BC filter expression that runs, and, when it was built as a
 * condition, the condition (so the builder can show it again as such).
 */
export type BcFilter = {
  field: number
  filter: string
  op?: ConditionOp
  value?: string
  value2?: string
}

export type BcField = {
  no: number
  name: string
  caption: string
  /** Code, Text, Integer, Decimal, Option, Date, … */
  type: string
  /** Normal, FlowField or FlowFilter */
  class: string
  length: number
  enabled: boolean
  obsolete: boolean
  pk: boolean
  relationTable?: number
  /** The related table's field it points to; 0 or missing means its key */
  relationField?: number
  options?: string[]
}

export type BcTableFields = {
  table: number
  name: string
  caption: string
  readable: boolean
  fields: BcField[]
}

export type BcQuery = {
  table: number
  /** Field numbers; empty means the primary key */
  fields: number[]
  /** Business Central filter expressions per field */
  filters: BcFilter[]
  sort: number[]
  descending: boolean
  top: number | null
  /** The "next" cursor of the previous page (companion 2026.9.24.6+) */
  after?: string
  count?: boolean
  /** Related tables, each through a lookup field on the main table */
  joins?: BcJoin[]
}

/**
 * A lookup join: main.field = related.key, adding related columns. Filters
 * on the related table, or inner, keep only rows with a match.
 */
export type BcJoin = {
  /** Unique in the query; tags its result columns */
  id: string
  /** The lookup field on the main table */
  field: number
  table: number
  /** The field on the related table it matches */
  key: number
  fields: number[]
  filters: BcFilter[]
  inner: boolean
}

/** A result column; joined ones say which join and table they come from */
export type BcColumn = Pick<
  BcField,
  "no" | "name" | "caption" | "type" | "class"
> & {
  join?: string
  table?: number
  tableName?: string
  tableCaption?: string
}

export type BcQueryResult = {
  table: number
  name: string
  caption: string
  columns: BcColumn[]
  rows: unknown[][]
  more: boolean
  /** When more match: send the query again with after = next */
  next?: string
  count?: number
  /** The view AL ran, as Record.GetView returns it */
  view: string
  ms: number
}

export type { BcApi } from "./api"
import type { BcApi } from "./api"

export type BcInfo = {
  app: string
  version: string
  company: string
  /** From companion 2026.9.24.1: the company's ID for API URLs */
  companyId?: string
  user: string
  maxRows: number
}

/**
 * The name to use in AL and exports. The Field table calls SystemId
 * "$systemId"; AL code and the APIs call it SystemId.
 */
export const alName = (name: string) =>
  name === "$systemId" ? "SystemId" : name

/** Values as people read them: options without the blank caption's space, GUIDs bare. */
export function cleanValue(type: string, value: unknown) {
  if (typeof value !== "string") return value ?? null
  if (type === "Option") return value.trim()
  if (type === "GUID") return value.replace(/[{}]/g, "").toLowerCase()
  return value
}

type Response = {
  tag: string
  type: "hello" | "response"
  id?: string
  ok?: boolean
  result?: unknown
  error?: string
}

/** Every frame under this window, depth first. Cross-origin frames included. */
function allFrames(root: Window = window): Window[] {
  const found: Window[] = []
  for (let i = 0; i < root.frames.length; i++) {
    const frame = root.frames[i]
    found.push(frame, ...allFrames(frame))
  }
  return found
}

/** One companion call through the service worker (see connect). */
async function relayRequest<T>(method: string, params: object): Promise<T> {
  const message: BcCompanionRelay = {
    type: COMPANION_RELAY,
    url: location.href,
    method,
    params,
  }
  let answer: CompanionRelayAnswer | undefined
  try {
    answer = (await chrome.runtime.sendMessage(message)) as
      CompanionRelayAnswer | undefined
  } catch (error) {
    // The extension was updated or reloaded since this page opened, or its
    // worker restarted mid-request
    throw new Error(
      /context invalidated/i.test(String(error))
        ? "Dynamic Assist was updated or reloaded. Reload this page to keep using the query builder."
        : "The extension stopped answering. Press Run again, or reload the page.",
      { cause: error }
    )
  }
  if (!answer) throw new Error("The extension didn't answer. Reload the page.")
  if (!answer.ok) throw new Error(answer.error)
  return answer.result as T
}

export class BridgeClient {
  private target: Window | null = null
  /** Not on the query page: requests go through the service worker instead */
  private relay = false
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >()
  private seq = 0

  dispose() {
    window.removeEventListener("message", this.onMessage)
    for (const p of this.pending.values()) p.reject(new Error("Closed."))
    this.pending.clear()
  }

  private onMessage = (event: MessageEvent<Response>) => {
    const data = event.data
    if (data?.tag !== BRIDGE_TAG || event.origin !== BC_ORIGIN) return
    if (data.type === "hello" && event.source) {
      this.target = event.source as Window
      this.found?.()
    } else if (data.type === "response" && data.id) {
      const p = this.pending.get(data.id)
      if (!p) return
      this.pending.delete(data.id)
      if (data.ok) p.resolve(data.result)
      else p.reject(new Error(data.error ?? "The request failed."))
    }
  }

  private found: (() => void) | null = null

  /**
   * Finds the companion: the bridge frame on this page (the query page), or,
   * anywhere else in Business Central, the query page of this environment and
   * company through the service worker, which opens it in the background the
   * first time (that can take a minute). False if there's no companion.
   */
  async connect(waitMs = 2500): Promise<boolean> {
    const onQueryPage =
      new URLSearchParams(location.search).get("page") ===
      String(BRIDGE_PAGE_ID)
    if (!onQueryPage && typeof chrome !== "undefined" && chrome.runtime?.id) {
      this.relay = true
      return this.request("info").then(
        () => true,
        () => false
      )
    }
    return this.connectHere(waitMs)
  }

  private async connectHere(waitMs: number): Promise<boolean> {
    // Listening again after dispose() is harmless: the same listener is added once
    window.addEventListener("message", this.onMessage)
    if (this.target && !this.target.closed) return true
    this.target = null
    const done = new Promise<void>((resolve) => (this.found = resolve))
    const deadline = Date.now() + waitMs
    // The add-in may still be loading: keep pinging until it answers
    while (!this.target && Date.now() < deadline) {
      for (const frame of allFrames()) {
        try {
          frame.postMessage({ tag: BRIDGE_TAG, type: "ping" }, BC_ORIGIN)
        } catch {
          // A frame on another origin: it can't be the bridge
        }
      }
      await Promise.race([done, new Promise((r) => setTimeout(r, 300))])
    }
    this.found = null
    return !!this.target
  }

  request<T>(method: string, params: object = {}): Promise<T> {
    if (this.relay) return relayRequest<T>(method, params)
    const target = this.target
    if (!target) return Promise.reject(new Error("Not connected."))
    const id = `${Date.now()}-${++this.seq}`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error("Business Central didn't answer in time."))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer)
          resolve(v as T)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      })
      target.postMessage(
        { tag: BRIDGE_TAG, type: "request", id, method, params },
        BC_ORIGIN
      )
    })
  }

  info = () => this.request<BcInfo>("info")
  tables = () => this.request<BcTable[]>("tables")
  fields = (table: number) => this.request<BcTableFields>("fields", { table })
  /** Installed API pages for a table; none from companions before 2026.9.24.2 */
  apis = (table: number) =>
    this.request<BcApi[]>("apis", { table }).catch(() => [] as BcApi[])
  query = (q: BcQuery) => this.request<BcQueryResult>("query", q)
}
