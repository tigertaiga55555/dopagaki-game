import { beforeEach, describe, expect, it } from 'vitest'
import { RANKING_CATEGORIES, localRankingDataSource } from './rankingRepository'
import { updateBestPercent, updateEndlessBest } from './storage'

function installFakeLocalStorage(): Storage {
  const store = new Map<string, string>()
  const fake: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  globalThis.localStorage = fake
  return fake
}

describe('rankingRepository (Ver.6 Phase 5: Ranking data adapter, local-first)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('Ranking adapterのlocal record取得: 4つの実装済みカテゴリで、あなたの記録を正しく返す', () => {
    updateBestPercent(321)
    updateEndlessBest('beginner', 7)
    updateEndlessBest('intermediate', 8)
    updateEndlessBest('advanced', 9)

    expect(localRankingDataSource.getMyValue('maxDopaPercent')).toBe(321)
    expect(localRankingDataSource.getMyValue('endlessBeginner')).toBe(7)
    expect(localRankingDataSource.getMyValue('endlessIntermediate')).toBe(8)
    expect(localRankingDataSource.getMyValue('endlessAdvanced')).toBe(9)
  })

  it('世界対戦2カテゴリは未実装のためnull（偽の0ではない）を返す', () => {
    expect(localRankingDataSource.getMyValue('worldBattleWins')).toBeNull()
    expect(localRankingDataSource.getMyValue('worldBattleMaxStreak')).toBeNull()
  })

  it('RANKING_CATEGORIESは6種類（Elo/rating/勝率ランキングは含まれない）', () => {
    expect(RANKING_CATEGORIES.length).toBe(6)
    const ids = RANKING_CATEGORIES.map((c) => c.id)
    expect(new Set(ids)).toEqual(
      new Set(['maxDopaPercent', 'endlessBeginner', 'endlessIntermediate', 'endlessAdvanced', 'worldBattleWins', 'worldBattleMaxStreak']),
    )
  })

  it('世界対戦2カテゴリだけがcomingSoon=trueとしてマークされている', () => {
    const comingSoonIds = RANKING_CATEGORIES.filter((c) => c.comingSoon).map((c) => c.id)
    expect(new Set(comingSoonIds)).toEqual(new Set(['worldBattleWins', 'worldBattleMaxStreak']))
  })

  it('何も記録がない新規ユーザーの4カテゴリは0（nullではない、データ自体は存在する）', () => {
    expect(localRankingDataSource.getMyValue('maxDopaPercent')).toBe(0)
    expect(localRankingDataSource.getMyValue('endlessBeginner')).toBe(0)
  })
})
