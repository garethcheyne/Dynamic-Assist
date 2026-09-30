import * as React from "react"
import { ExternalLinkIcon, Loader2Icon, MoonIcon, SunIcon } from "lucide-react"
import { cn } from "cn"

// The copy this version shipped with, for offline and until GitHub has one
import bundled from "../../CHANGELOG.md?raw"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { parseMarkdown, type Block, type Span } from "@/lib/mini-markdown"
import { CHANGELOG } from "@/shared/links"

const { version } = chrome.runtime.getManifest()

/** Full URLs for the changelog's links: its relative ones point into the repository */
function resolve(href: string): string | null {
  if (/^https:\/\//i.test(href)) return href
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return null
  return CHANGELOG.files + href.replace(/^\.\//, "")
}

type Source = "loading" | "github" | "bundled"

/**
 * What's changed in Dynamic Assist: CHANGELOG.md from GitHub, fetched when
 * you open this page, so it's current without an update. Offline, or while
 * GitHub doesn't have it, the copy this version shipped with.
 */
export function WhatsNewView({ page = false }: { page?: boolean }) {
  const [text, setText] = React.useState(bundled)
  const [source, setSource] = React.useState<Source>("loading")

  React.useEffect(() => {
    let live = true
    fetch(CHANGELOG.raw, { cache: "no-cache" })
      .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
      .then(
        (remote) => {
          if (!live) return
          setText(remote)
          setSource("github")
        },
        () => live && setSource("bundled")
      )
    return () => {
      live = false
    }
  }, [])

  const blocks = React.useMemo(() => parseMarkdown(text, resolve), [text])

  return (
    <div
      className={cn("flex flex-col", !page && "min-h-0 flex-1 overflow-y-auto")}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b py-1.5 text-muted-foreground",
          page ? "text-xs" : "px-3 text-[11px]"
        )}
      >
        {source === "loading" ? (
          <>
            <Loader2Icon className="size-3 animate-spin" />
            Checking GitHub for the latest…
          </>
        ) : source === "github" ? (
          <span>Latest, from GitHub. You have version {version}.</span>
        ) : (
          <span>
            The copy shipped with version {version} (GitHub couldn&apos;t be
            reached).
          </span>
        )}
        <a
          href={CHANGELOG.page}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-medium text-primary hover:underline"
        >
          On GitHub
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>
      <article
        className={cn(
          "flex flex-col gap-2 leading-relaxed",
          page ? "py-4 text-sm" : "p-3 text-xs"
        )}
      >
        {blocks.map((block, i) => (
          <MarkdownBlock key={i} block={block} />
        ))}
      </article>
    </div>
  )
}

const brandIcon = chrome.runtime.getURL("icons/icon48.png")

/** What's new in a browser tab of its own (index.html?page=whatsnew). */
export function WhatsNewPage() {
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  React.useEffect(() => {
    document.title = "What's new · Dynamic Assist"
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src={brandIcon} alt="" className="size-8 rounded-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight">
              What&apos;s new in Dynamic Assist
            </h1>
            <p className="text-xs text-muted-foreground">
              Version {version} is installed
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDark ? "Light mode" : "Dark mode"}
            aria-label={isDark ? "Light mode" : "Dark mode"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-12">
        <WhatsNewView page />
      </main>
    </div>
  )
}

function MarkdownBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading":
      // The document's own title repeats the page's
      if (block.level === 1) return null
      return block.level === 2 ? (
        <h2 className="mt-3 border-b pb-1 text-sm font-semibold first:mt-0">
          <Spans spans={block.spans} />
        </h2>
      ) : (
        <h3 className="mt-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Spans spans={block.spans} />
        </h3>
      )
    case "paragraph":
      return (
        <p className="text-muted-foreground">
          <Spans spans={block.spans} />
        </p>
      )
    case "list":
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-4 marker:text-muted-foreground">
          {block.items.map((item, i) => (
            <li key={i}>
              <Spans spans={item} />
            </li>
          ))}
        </ul>
      )
  }
}

function Spans({ spans }: { spans: Span[] }) {
  return spans.map((span, i) => {
    switch (span.kind) {
      case "text":
        return <React.Fragment key={i}>{span.text}</React.Fragment>
      case "bold":
        return (
          <strong key={i} className="font-semibold">
            {span.text}
          </strong>
        )
      case "code":
        return (
          <code
            key={i}
            className="rounded bg-muted px-1 py-px font-mono text-[11px]"
          >
            {span.text}
          </code>
        )
      case "link":
        return (
          <a
            key={i}
            href={span.href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {span.text}
          </a>
        )
    }
  })
}
