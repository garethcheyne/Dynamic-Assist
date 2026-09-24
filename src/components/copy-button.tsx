import { CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCopy } from "@/lib/copy"

/** Icon button that copies `value`; the toast names it as `what`. */
export function CopyButton({
  value,
  what,
  className,
}: {
  value: string
  what: string
  className?: string
}) {
  const copy = useCopy()
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={className}
      title={`Copy ${what}`}
      aria-label={`Copy ${what}`}
      onClick={(e) => {
        e.stopPropagation()
        void copy(value, what)
      }}
    >
      <CopyIcon />
    </Button>
  )
}
