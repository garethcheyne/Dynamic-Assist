/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { CheckIcon, CircleAlertIcon } from "lucide-react"
import { cn } from "cn"

type Copy = (value: string, what: string) => Promise<void>
type Notify = (text: string, tone?: "ok" | "error") => void

const ToastContext = React.createContext<{ copy: Copy; notify: Notify } | null>(
  null
)

/** One toast for the whole panel: "Copied schema name", "Expanded 6 tabs". */
export function CopyProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<{
    id: number
    text: string
    tone: "ok" | "error"
  } | null>(null)

  const notify = React.useCallback<Notify>((text, tone = "ok") => {
    setToast({ id: Date.now(), text, tone })
  }, [])

  const copy = React.useCallback<Copy>(
    async (value, what) => {
      try {
        await navigator.clipboard.writeText(value)
        notify(`Copied ${what}`)
      } catch {
        notify("Couldn't copy. Click the panel first.", "error")
      }
    },
    [notify]
  )

  React.useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(
      () => setToast(null),
      toast.tone === "error" ? 4000 : 1800
    )
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = React.useMemo(() => ({ copy, notify }), [copy, notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center"
      >
        {toast && (
          <div
            key={toast.id}
            className={cn(
              "flex max-w-[90%] animate-in items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg duration-150 fade-in-0 slide-in-from-bottom-2",
              toast.tone === "error"
                ? "bg-destructive text-white"
                : "bg-foreground text-background"
            )}
          >
            {toast.tone === "error" ? (
              <CircleAlertIcon className="size-3.5 shrink-0" />
            ) : (
              <CheckIcon className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{toast.text}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("Use inside a CopyProvider")
  return ctx
}

export const useCopy = (): Copy => useToast().copy
export const useNotify = (): Notify => useToast().notify
