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

/**
 * 次フェーズ（item 154-156、ENDLESS中級・上級の難易度再設計）: 「streak（連続正解数）が
 * 伸びるほど重みの重心が連続的にシフトする」という要件を、1箇所の汎用ロジックとして
 * 実装する（中級/上級それぞれに個別の階段関数を書くと、境界で不自然な段差が出たり
 * 実装が重複したりするため）。
 *
 * curveは { streak, weights } の制御点を昇順で並べたもの。streakがある制御点の間に
 * あれば、両端の重みを線形補間する（各キーごとに独立に補間するため、重みの合計が
 * 制御点間で厳密に100である必要はない——weightedPick側で正規化される）。streakが
 * 最初の制御点より小さい、または最後の制御点より大きい場合は、それぞれ最初/最後の
 * 重みのまま変化しない（既存のisEndlessMilestone等と同じ「範囲外はクランプ」方針）。
 */
export interface WeightCurvePoint<K extends string> {
  streak: number
  weights: Record<K, number>
}

export function interpolateWeightCurve<K extends string>(streak: number, curve: readonly WeightCurvePoint<K>[]): Record<K, number> {
  const first = curve[0]
  if (streak <= first.streak) return first.weights
  const last = curve[curve.length - 1]
  if (streak >= last.streak) return last.weights
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i]
    const b = curve[i + 1]
    if (streak >= a.streak && streak <= b.streak) {
      const t = (streak - a.streak) / (b.streak - a.streak)
      const keys = Object.keys(a.weights) as K[]
      const out = {} as Record<K, number>
      for (const k of keys) out[k] = a.weights[k] + (b.weights[k] - a.weights[k]) * t
      return out
    }
  }
  return last.weights
}
