import { cn } from "cn"

import { Hint } from "@/components/hint"
import {
  setFieldNaming,
  useFieldNaming,
  type FieldNaming,
} from "@/lib/field-naming"

/** The Label | Name switch above a field list. */
export function FieldNamingToggle({ className }: { className?: string }) {
  const naming = useFieldNaming()
  const options: [FieldNaming, string, string][] = [
    ["label", "Label", "Show each field's label, as on the page"],
    ["name", "Name", "Show each field's logical (schema) name"],
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Show fields by"
      className={cn("flex rounded-md bg-muted p-0.5", className)}
    >
      {options.map(([value, label, tip]) => (
        <Hint key={value} label={tip}>
          <button
            type="button"
            role="radio"
            aria-checked={naming === value}
            onClick={() => setFieldNaming(value)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-medium",
              naming === value
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        </Hint>
      ))}
    </div>
  )
}
