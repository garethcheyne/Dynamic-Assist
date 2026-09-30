import * as React from "react"
import {
  CheckIcon,
  CircleAlertIcon,
  CircleIcon,
  Loader2Icon,
} from "lucide-react"
import { cn } from "cn"

import type { Boot } from "./boot"

const seconds = (ms: number) =>
  ms < 1000 ? "<1 s" : `${Math.round(ms / 1000)} s`

/**
 * The start-up steps with where each stands: done (and how long it took),
 * running (and for how long), failed, or still to come.
 */
export function BootSteps({ boot, intro }: { boot: Boot; intro?: string }) {
  // The time now, every second while a step runs, so its time counts up
  const [now, setNow] = React.useState(() => Date.now())
  const running = boot.current
  React.useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  return (
    <div className="flex flex-col gap-3 p-6 text-xs">
      {intro && <p className="max-w-xl text-muted-foreground">{intro}</p>}
      <ol className="flex max-w-xl flex-col gap-2.5">
        {boot.steps.map((step) => {
          const started = boot.started[step.id]
          const ended = boot.ended[step.id]
          const failed = boot.failed?.step === step.id
          const active = boot.current === step.id && !failed
          const done = !!ended && !active && !failed
          return (
            <li key={step.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full",
                  done && "bg-primary text-primary-foreground",
                  active && "text-primary",
                  failed && "text-destructive",
                  !done && !active && !failed && "text-muted-foreground/60"
                )}
              >
                {failed ? (
                  <CircleAlertIcon className="size-4" />
                ) : done ? (
                  <CheckIcon className="size-3" />
                ) : active ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <CircleIcon className="size-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-medium",
                      !done && !active && !failed && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  {started !== undefined && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {seconds((ended ?? now) - started)}
                    </span>
                  )}
                </span>
                {active && step.hint && (
                  <span className="block text-muted-foreground">
                    {step.hint}
                  </span>
                )}
                {done && boot.notes[step.id] && (
                  <span className="block text-muted-foreground">
                    {boot.notes[step.id]}
                  </span>
                )}
                {failed && (
                  <span className="block text-destructive">
                    {boot.failed!.message}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
