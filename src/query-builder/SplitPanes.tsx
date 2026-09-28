import * as React from "react"
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type LayoutStorage,
} from "react-resizable-panels"

// The page's own storage, which can be blocked: then the width isn't remembered
const storage: LayoutStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Not remembered
    }
  },
}

/**
 * The query on the left and the results on the right, with a divider to drag
 * between them (or focus and use the arrow keys). The width is remembered per
 * `id` on this site; double-click the divider to reset it.
 */
export function SplitPanes({
  id,
  left,
  right,
}: {
  id: string
  left: React.ReactNode
  right: React.ReactNode
}) {
  const layout = useDefaultLayout({
    id: `dynamic-assist.split.${id}`,
    storage,
  })
  return (
    <Group
      orientation="horizontal"
      className="flex min-h-0 flex-1"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <Panel
        id="query"
        defaultSize={420}
        minSize={280}
        maxSize="75%"
        className="flex min-h-0 flex-col"
      >
        {left}
      </Panel>
      <Separator
        aria-label="Resize the query and results"
        className="group relative w-px shrink-0 bg-border outline-none focus-visible:bg-primary data-[separator=active]:bg-primary data-[separator=hover]:bg-primary/60"
      >
        {/* A wider grab area than the 1px line */}
        <span className="absolute inset-y-0 -right-1.5 -left-1.5" />
        <span className="absolute top-1/2 left-1/2 h-8 w-1 -translate-1/2 rounded-full bg-border group-hover:bg-primary/60" />
      </Separator>
      <Panel
        id="results"
        minSize={320}
        className="flex min-h-0 min-w-0 flex-col"
      >
        {right}
      </Panel>
    </Group>
  )
}
