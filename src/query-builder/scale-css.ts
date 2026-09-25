/**
 * The builder shares the side panel's styles, sized for a narrow panel; over a
 * whole page they read small. And rem follows the page's root font size, which
 * Dynamics 365 sets to 14px. So: rem becomes px at a fixed 16px, and every
 * length grows by SCALE. Scaling the CSS (not `zoom`) keeps popups, which are
 * positioned in px by script, where they belong.
 */
const SCALE = 1.15
const round = (n: number) => Math.round(n * 100) / 100
export function scaleCss(css: string) {
  // Only values in declarations: selectors hold them too (.text-\[11px\]),
  // escaped, and those must stay as they are
  return css.replace(
    /(?<=[\s:(,/*+])(-?\d*\.?\d+)(rem|px)\b/g,
    (match, value: string, unit: string) => {
      const n = Number(value)
      if (!Number.isFinite(n)) return match
      if (unit === "rem") return `${round(n * 16 * SCALE)}px`
      // Hairlines stay hairlines
      return Math.abs(n) <= 1 ? match : `${round(n * SCALE)}px`
    }
  )
}
