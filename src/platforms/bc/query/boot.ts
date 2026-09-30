/** The builder's start-up, one step at a time */
export type BootStepId = "page" | "companion" | "tables" | "fields"

export type BootStep = {
  id: BootStepId
  label: string
  /** What's happening, shown while the step runs */
  hint?: string
}

export type Boot = {
  steps: BootStep[]
  current: BootStepId | null
  started: Partial<Record<BootStepId, number>>
  ended: Partial<Record<BootStepId, number>>
  /** Said after a step once it's done: "from this browser's cache" */
  notes: Partial<Record<BootStepId, string>>
  failed?: { step: BootStepId; message: string }
}

export const emptyBoot = (steps: BootStep[]): Boot => ({
  steps,
  current: null,
  started: {},
  ended: {},
  notes: {},
})

/** Moves to a step: the one before it is done. */
export function enterStep(boot: Boot, id: BootStepId, at = Date.now()): Boot {
  const ended = { ...boot.ended }
  if (boot.current && boot.current !== id) ended[boot.current] ??= at
  return {
    ...boot,
    current: id,
    started: { ...boot.started, [id]: boot.started[id] ?? at },
    ended,
  }
}

/** Every step so far is done. */
export function finishBoot(boot: Boot): Boot {
  const ended = { ...boot.ended }
  if (boot.current) ended[boot.current] ??= Date.now()
  return { ...boot, current: null, ended }
}
