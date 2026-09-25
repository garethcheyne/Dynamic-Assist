import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"

const ISSUES = "https://github.com/garethcheyne/Dynamic-Assist/issues"

/**
 * Keeps a crash in one part of the panel (or the help page) from leaving it
 * blank: says what broke and offers a way back.
 */
export class CrashBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error("Dynamic Assist:", error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        role="alert"
        className="m-3 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-card p-4 text-sm"
      >
        <p className="flex items-center gap-2 font-semibold">
          <TriangleAlertIcon className="size-4 text-destructive" />
          Something went wrong
        </p>
        <p className="font-mono text-[11px] break-words text-muted-foreground">
          {error.message}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => location.reload()}>
            Reload
          </Button>
          <a
            href={ISSUES}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            Report it
          </a>
        </div>
      </div>
    )
  }
}
