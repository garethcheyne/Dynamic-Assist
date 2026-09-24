/** Groups items by a key, keeping first-seen order. */
export function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    map.set(k, [...(map.get(k) ?? []), item])
  }
  return [...map.entries()]
}
