import * as React from "react"

/**
 * How field lists name fields: by their label (caption) or their logical
 * (schema) name. One setting for every list in both products, remembered.
 * Rows read it from one shared store rather than each watching storage.
 */
export type FieldNaming = "label" | "name"

const KEY = "ui.fieldNaming"
let current: FieldNaming = "label"
const listeners = new Set<() => void>()
const set = (value: FieldNaming) => {
  if (value === current) return
  current = value
  for (const l of listeners) l()
}

let started = false
function start() {
  if (started || typeof chrome === "undefined" || !chrome.storage) return
  started = true
  void chrome.storage.local.get(KEY).then((items) => {
    if (items[KEY] === "name" || items[KEY] === "label") set(items[KEY])
  })
  chrome.storage.onChanged.addListener((changes, area) => {
    const v = changes[KEY]?.newValue
    if (area === "local" && (v === "name" || v === "label")) set(v)
  })
}

const subscribe = (listener: () => void) => {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFieldNaming() {
  return React.useSyncExternalStore(subscribe, () => current)
}

export function setFieldNaming(value: FieldNaming) {
  set(value)
  void chrome.storage?.local.set({ [KEY]: value })
}
