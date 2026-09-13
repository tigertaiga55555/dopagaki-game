const FIRST_DOPAGAKI_KEY = 'dopagaki:firstDopagaki'
const LOWEST_DOPAGAKI_KEY = 'dopagaki:lowestDopagaki'
const HIGH_SCORE_KEY = 'dopagaki:gameHighScore'
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
export function getFirstDopagaki(): number | null {
  return readNumber(FIRST_DOPAGAKI_KEY)
}

export function saveFirstDopagakiIfAbsent(percent: number): void {
  try {
    if (localStorage.getItem(FIRST_DOPAGAKI_KEY) === null) {
      localStorage.setItem(FIRST_DOPAGAKI_KEY, String(percent))
    }
  } catch {
    // localStorageが使えない環境では何もしない
  }
}

/** 自己最低ドパガキ度（低いほど「良い」記録） */
export function getLowestDopagaki(): number {
  return readNumber(LOWEST_DOPAGAKI_KEY) ?? Infinity
}

export function updateLowestDopagaki(percent: number): boolean {
  try {
    const current = getLowestDopagaki()
    if (percent < current) {
      localStorage.setItem(LOWEST_DOPAGAKI_KEY, String(percent))
      return true
    }
    return false
  } catch {
    return false
  }
}

export function getBestGameScore(): number {
  return readNumber(HIGH_SCORE_KEY) ?? 0
}

export function updateBestGameScore(score: number): boolean {
  try {
    const current = getBestGameScore()
    if (score > current) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score))
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
