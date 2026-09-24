import { BracesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCopy } from "@/lib/copy"

/** "Copy JSON" for a section header: copies `data` pretty-printed. */
export function CopyJsonButton({
  data,
  what,
}: {
  data: () => unknown
  /** Named in the toast: "Copied 21 fields as JSON" */
  what: string
}) {
  const copy = useCopy()
  return (
    <Button
      variant="ghost"
      size="xs"
      title={`Copy ${what} as a JSON object`}
      onClick={(e) => {
        e.stopPropagation()
        void copy(JSON.stringify(data(), null, 2), `${what} as JSON`)
      }}
    >
      <BracesIcon data-icon="inline-start" />
      Copy JSON
    </Button>
  )
}
