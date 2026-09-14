const BEST_PERCENT_KEY = 'dopagaki:bestPercentV4'
const PLAY_COUNT_KEY = 'dopagaki:playCountV4'

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
