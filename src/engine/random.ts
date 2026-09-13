export function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1))
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function pickExcluding<T>(items: readonly T[], exclude: T | undefined): T {
  if (items.length <= 1 || exclude === undefined) return pick(items)
  const filtered = items.filter((item) => item !== exclude)
  return filtered.length > 0 ? pick(filtered) : pick(items)
}

/** Fisher-Yatesで配列をシャッフルした新しい配列を返す（元の配列は変更しない） */
export function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 重み付き抽選。weights は { key: weight } の形。 */
export function weightedPick<K extends string>(weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = Math.random() * total
  for (const [key, weight] of entries) {
    roll -= weight
    if (roll <= 0) return key
  }
  return entries[entries.length - 1][0]
}
