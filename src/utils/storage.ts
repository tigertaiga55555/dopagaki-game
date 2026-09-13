const FIRST_PERCENT_KEY = 'dopagaki:firstPercent'
const BEST_LOW_PERCENT_KEY = 'dopagaki:bestLowPercent'
const PLAY_COUNT_KEY = 'dopagaki:playCount'

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

/** 初回プレイのドパガキ度（一度だけ保存される） */
export function getFirstPercent(): number | null {
  return readNumber(FIRST_PERCENT_KEY)
}

/** まだ記録が無ければ、初回ドパガキ度として保存する */
export function saveFirstPercentIfAbsent(percent: number): void {
  try {
    if (localStorage.getItem(FIRST_PERCENT_KEY) === null) {
      localStorage.setItem(FIRST_PERCENT_KEY, String(percent))
    }
  } catch {
    // localStorageが使えない環境では何もしない
  }
}

/** 自己最低ドパガキ度（低いほど「良い」記録） */
export function getBestLowPercent(): number {
  return readNumber(BEST_LOW_PERCENT_KEY) ?? Infinity
}

/** 自己最低ドパガキ度を更新する。更新されたら true を返す */
export function updateBestLowPercent(percent: number): boolean {
  try {
    const current = getBestLowPercent()
    if (percent < current) {
      localStorage.setItem(BEST_LOW_PERCENT_KEY, String(percent))
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
