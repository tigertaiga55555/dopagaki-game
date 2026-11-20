import { beforeEach, describe, expect, it } from 'vitest'
import { canWatchRewardedAd, getRewardedAdViewsRemainingToday, recordRewardedAdViewed } from './rewardedAdStorage'
import { qaSetHeartCount } from './heartRepository'

function installFakeLocalStorage(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0)

describe('rewardedAdStorage (DOPA PASS基盤ラウンド)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期状態は3回視聴可能', () => {
    expect(getRewardedAdViewsRemainingToday(T0)).toBe(3)
    expect(canWatchRewardedAd(T0)).toBe(true)
  })

  it('3回視聴すると残り0・canWatchRewardedAd=false', () => {
    qaSetHeartCount(0, T0)
    recordRewardedAdViewed(T0)
    recordRewardedAdViewed(T0)
    recordRewardedAdViewed(T0)
    expect(getRewardedAdViewsRemainingToday(T0)).toBe(0)
    expect(canWatchRewardedAd(T0)).toBe(false)
  })

  it('視聴すると即+1 Heart', () => {
    qaSetHeartCount(2, T0)
    const result = recordRewardedAdViewed(T0)
    expect(result).toBe(3)
  })

  it('日付が変わると視聴回数は0へリセットされる', () => {
    qaSetHeartCount(0, T0)
    recordRewardedAdViewed(T0)
    recordRewardedAdViewed(T0)
    recordRewardedAdViewed(T0)
    const nextDay = T0 + 24 * 60 * 60 * 1000
    expect(getRewardedAdViewsRemainingToday(nextDay)).toBe(3)
  })
})
