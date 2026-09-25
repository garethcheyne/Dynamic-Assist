import * as React from "react"

/**
 * Keeps a crash in the query builder from making it vanish: shows what broke
 * and a way out, over the page, instead of an empty screen.
 */
export class ErrorBoundary extends React.Component<
  { onClose: () => void; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error("Dynamic Assist query builder:", error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="da-root">
        <div className="fixed inset-0 z-[2147483000] bg-black/40" />
        <div
          role="alertdialog"
          className="fixed top-1/3 left-1/2 z-[2147483001] flex w-[420px] -translate-x-1/2 flex-col gap-3 rounded-xl border bg-background p-5 text-foreground shadow-2xl"
        >
          <h2 className="text-sm font-semibold">
            The query builder hit a problem
          </h2>
          <p className="font-mono text-[11px] break-words text-muted-foreground">
            {this.state.error.message}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-xs font-medium"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-1 text-xs text-muted-foreground"
              onClick={this.props.onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
}
