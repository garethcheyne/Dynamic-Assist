import bcLogo from "@/assets/brand/ms/business-central.svg"
import ceLogo from "@/assets/brand/ms/dynamics-365.svg"
import flowLogo from "@/assets/brand/ms/power-automate.svg"
import paLogo from "@/assets/brand/ms/power-apps.svg"

/** Each product the panel supports: its name and logo. */
export const PRODUCTS = {
  bc: { name: "Business Central", logo: bcLogo },
  ce: { name: "Dynamics 365", logo: ceLogo },
  maker: { name: "Power Apps", logo: paLogo },
  flow: { name: "Power Automate", logo: flowLogo },
} as const

export type Product = keyof typeof PRODUCTS
