import type { EndlessDifficulty } from '../types'

const BEST_PERCENT_KEY = 'dopagaki:bestPercentV4'
const PLAY_COUNT_KEY = 'dopagaki:playCountV4'

/**
 * Ver.6 Phase 4: Endlessモードの自己ベスト（連続正解数）は難易度ごとに別々に保存する
 * （初級/中級/上級は別記録。ユーザー指示どおり、記録ロジックは下のgetEndlessBest/
 * updateEndlessBest関数に閉じ、UIからは難易度を渡すだけで扱えるようにしてある
 * ——将来Profile/Ranking/Cloud Saveを実装する際、この2関数の中身だけを差し替えれば
 * 済む構造にするため、UIへ密結合させていない）。
 */
const ENDLESS_BEST_KEY: Record<EndlessDifficulty, string> = {
  beginner: 'dopagaki:endlessBestBeginnerV1',
  intermediate: 'dopagaki:endlessBestIntermediateV1',
  advanced: 'dopagaki:endlessBestAdvancedV1',
}

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export function getBestPercent(): number {
  return readNumber(BEST_PERCENT_KEY) ?? 0
}

/** 自己ベストを更新する。更新されたら true を返す */
export function updateBestPercent(percent: number): boolean {
  try {
    const current = getBestPercent()
    if (percent > current) {
      localStorage.setItem(BEST_PERCENT_KEY, String(percent))
      return true
    }
    return false
  } catch {
    return false
  }
}

export function getPlayCount(): number {
  return readNumber(PLAY_COUNT_KEY) ?? 0
}

export function incrementPlayCount(): number {
  try {
    const next = getPlayCount() + 1
    localStorage.setItem(PLAY_COUNT_KEY, String(next))
    return next
  } catch {
    return getPlayCount()
  }
}

export function getEndlessBest(difficulty: EndlessDifficulty): number {
  return readNumber(ENDLESS_BEST_KEY[difficulty]) ?? 0
}

/** 難易度ごとの自己ベスト（連続正解数）を更新する。更新されたら true を返す。 */
export function updateEndlessBest(difficulty: EndlessDifficulty, score: number): boolean {
  try {
    const current = getEndlessBest(difficulty)
    if (score > current) {
      localStorage.setItem(ENDLESS_BEST_KEY[difficulty], String(score))
      return true
    }
    return false
  } catch {
    return false
  }
}
