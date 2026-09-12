const BEST_KEY = 'dopagaki:bestPoint'
const PLAY_COUNT_KEY = 'dopagaki:playCount'

export function getBestPoint(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? Number(raw) || 0 : 0
  } catch {
    return 0
  }
}

/** 自己ベストを更新する。更新されたら true を返す */
export function updateBestPoint(point: number): boolean {
  try {
    const current = getBestPoint()
    if (point > current) {
      localStorage.setItem(BEST_KEY, String(point))
      return true
    }
    return false
  } catch {
    return false
  }
}

export function getPlayCount(): number {
  try {
    const raw = localStorage.getItem(PLAY_COUNT_KEY)
    return raw ? Number(raw) || 0 : 0
  } catch {
    return 0
  }
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
