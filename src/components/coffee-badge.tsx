import { CoffeeIcon } from "lucide-react"
import { cn } from "cn"

import { BUY_ME_A_COFFEE } from "@/shared/links"

/**
 * Buy Me a Coffee's yellow badge, drawn here in their colours (#FFDD00, black
 * text) rather than loading their image: nothing reaches buymeacoffee.com
 * until it's clicked.
 */
export function CoffeeBadge({ className }: { className?: string }) {
  return (
    <a
      href={BUY_ME_A_COFFEE}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[#FFDD00] px-3 py-1 text-xs font-semibold whitespace-nowrap text-black shadow-[0_1px_0_rgba(0,0,0,0.25)] transition-colors hover:bg-[#FFD000] focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:outline-none",
        className
      )}
    >
      <CoffeeIcon className="size-3.5" />
      Buy me a coffee
    </a>
  )
}
