import * as React from "react"
import {
  BookmarkIcon,
  DownloadIcon,
  SaveIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  deleteQuery,
  exportQueries,
  importQueries,
  saveQuery,
  useSavedQueries,
  type NewSavedQuery,
  type OmitEach,
  type SavedQuery,
} from "./saved"

const when = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" })

/**
 * The builder header's "Saved" button: save the query you have, and open one
 * saved earlier (here or in another environment). Its own panel rather than a
 * menu, so it stays inside the builder's shadow root and styles.
 */
export function SavedQueries({
  platform,
  current,
  onLoad,
}: {
  platform: SavedQuery["platform"]
  /** The query as it stands, without a name; null when there's nothing to save */
  current: () => OmitEach<NewSavedQuery, "name"> | null
  onLoad: (query: SavedQuery) => void
}) {
  const saved = useSavedQueries(platform)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState<string | null>(null)
  const box = React.useRef<HTMLDivElement>(null)
  const file = React.useRef<HTMLInputElement>(null)

  // Close on a click elsewhere in the builder, or Escape
  React.useEffect(() => {
    if (!open) return
    const root = box.current?.getRootNode() as Document | ShadowRoot | undefined
    const onDown = (e: Event) => {
      if (!box.current?.contains(e.composedPath()[0] as Node)) setOpen(false)
    }
    const onKey = (e: Event) => {
      if ((e as KeyboardEvent).key === "Escape") {
        e.stopPropagation()
        setOpen(false)
      }
    }
    root?.addEventListener("pointerdown", onDown)
    root?.addEventListener("keydown", onKey, true)
    return () => {
      root?.removeEventListener("pointerdown", onDown)
      root?.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  const save = async () => {
    const query = current()
    const trimmed = name.trim()
    if (!query || !trimmed) return
    const replaced = saved.some(
      (q) => q.name.toLowerCase() === trimmed.toLowerCase()
    )
    try {
      await saveQuery({ ...query, name: trimmed })
      setName("")
      setMessage(replaced ? `Updated “${trimmed}”` : `Saved “${trimmed}”`)
    } catch (e) {
      setMessage(`Couldn't save: ${e instanceof Error ? e.message : e}`)
    }
  }

  const download = async () => {
    const blob = new Blob([await exportQueries()], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "dynamic-assist-queries.json"
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const upload = async (f: File | undefined) => {
    if (!f) return
    try {
      const n = await importQueries(await f.text())
      setMessage(`Imported ${n} ${n === 1 ? "query" : "queries"}`)
    } catch (e) {
      setMessage(
        `Couldn't import: ${e instanceof Error ? e.message : "not a queries file"}`
      )
    }
  }

  const canSave = open && current() !== null

  return (
    <div ref={box} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          setMessage(null)
          setConfirm(null)
        }}
        title="Save this query, or open one you saved"
      >
        <BookmarkIcon data-icon="inline-start" />
        Saved
        {saved.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
            {saved.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 flex w-96 flex-col gap-2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={canSave ? "Name this query" : "Nothing to save yet"}
              disabled={!canSave}
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" disabled={!canSave || !name.trim()}>
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
          </form>
          {message && (
            <p className="px-1 text-xs text-muted-foreground">{message}</p>
          )}

          <div className="max-h-80 overflow-y-auto">
            {saved.length === 0 ? (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                No saved queries yet. They're kept in this browser, and open in
                any {platform === "ce" ? "org" : "environment"}.
              </p>
            ) : (
              <ul className="flex flex-col">
                {saved.map((q) => (
                  <li
                    key={q.id}
                    className="group flex items-center gap-1 rounded-md hover:bg-muted"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-2 py-1.5 text-left"
                      onClick={() => {
                        onLoad(q)
                        setOpen(false)
                      }}
                    >
                      <span className="block truncate text-xs font-medium">
                        {q.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {q.table} · {q.where} · {when(q.savedAt)}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={
                        confirm === q.id
                          ? `Delete ${q.name}`
                          : `Delete ${q.name}?`
                      }
                      title={
                        confirm === q.id ? "Click again to delete" : "Delete"
                      }
                      className={cn(
                        "mr-1 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                        confirm === q.id && "text-destructive opacity-100"
                      )}
                      onClick={() => {
                        if (confirm !== q.id) return setConfirm(q.id)
                        setConfirm(null)
                        void deleteQuery(q.id)
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-1 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void download()}
              disabled={saved.length === 0}
              title="Download every saved query (both products) as a file"
            >
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => file.current?.click()}
              title="Add queries from an exported file"
            >
              <UploadIcon data-icon="inline-start" />
              Import
            </Button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void upload(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
