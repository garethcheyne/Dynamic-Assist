import { cn } from "cn"

import { MS_ICONS, type MsProduct } from "@/assets/brand/ms"

/**
 * A Microsoft product's official icon, sized like the lucide icons it sits
 * among (3.5 in tiles, 4 in menus). Decorative: the label beside it names it.
 */
export function ProductIcon({
  product,
  className,
}: {
  product: MsProduct
  className?: string
}) {
  return (
    <img
      src={MS_ICONS[product]}
      alt=""
      className={cn("size-3.5 shrink-0 object-contain", className)}
    />
  )
}
