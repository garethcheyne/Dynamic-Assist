import bcLogo from "@/assets/brand/bc.png"
import ceLogo from "@/assets/brand/ce.png"
import paLogo from "@/assets/brand/pa.png"

/** Each product the panel supports: its name and logo. */
export const PRODUCTS = {
  bc: { name: "Business Central", logo: bcLogo },
  ce: { name: "Dynamics 365", logo: ceLogo },
  maker: { name: "Power Apps", logo: paLogo },
} as const

export type Product = keyof typeof PRODUCTS
