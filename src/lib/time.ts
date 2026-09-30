const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

/** "just now", "5 minutes ago", "yesterday", "3 days ago" */
export function ago(time: number) {
  const minutes = Math.round((time - Date.now()) / 60000)
  if (minutes > -1) return "just now"
  if (minutes > -60) return rtf.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours > -24) return rtf.format(hours, "hour")
  return rtf.format(Math.round(hours / 24), "day")
}
