import { beforeEach, describe, expect, it } from 'vitest'
import { checkDopaPercentAchievements } from './achievementStorage'
import { recordWorldBattleOutcome } from './battleStatsStorage'
import { localPlayerStatsRepository } from './playerStatsRepository'
import { updateEndlessBest } from './storage'
import { updateBestPercent } from './storage'

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

describe('playerStatsRepository (Ver.6 Phase 5: 既存storageを二重管理しない読み取りビュー)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('最高DOPA%取得: 既存のbestPercentV4をそのまま反映する（二重管理していない）', () => {
    updateBestPercent(247)
    expect(localPlayerStatsRepository.getPlayerStats().maxDopaPercent).toBe(247)
  })

  it('Endless3難易度BEST取得: 既存の難易度別BESTをそのまま反映する', () => {
    updateEndlessBest('beginner', 12)
    updateEndlessBest('intermediate', 34)
    updateEndlessBest('advanced', 56)
    const stats = localPlayerStatsRepository.getPlayerStats()
    expect(stats.endlessBeginnerBest).toBe(12)
    expect(stats.endlessIntermediateBest).toBe(34)
    expect(stats.endlessAdvancedBest).toBe(56)
  })

  it('achievementCountが実際の解除数と一致する', () => {
    checkDopaPercentAchievements(250) // dopa50/100/120/150/200/250の6個
    expect(localPlayerStatsRepository.getPlayerStats().achievementCount).toBe(6)
  })

  it('Ver.6 Phase 6（リアルタイム対戦実装後）: worldBattleWins/worldBattleMaxStreakはbattleStatsStorageの値を反映する', () => {
    expect(localPlayerStatsRepository.getPlayerStats().worldBattleWins).toBe(0)
    expect(localPlayerStatsRepository.getPlayerStats().worldBattleMaxStreak).toBe(0)

    recordWorldBattleOutcome('win')
    const stats = localPlayerStatsRepository.getPlayerStats()
    expect(stats.worldBattleWins).toBe(1)
    expect(stats.worldBattleMaxStreak).toBe(1)
  })

  it('何も記録がない新規ユーザーはすべて0（未実装の世界対戦フィールドを除く）', () => {
    const stats = localPlayerStatsRepository.getPlayerStats()
    expect(stats.maxDopaPercent).toBe(0)
    expect(stats.endlessBeginnerBest).toBe(0)
    expect(stats.endlessIntermediateBest).toBe(0)
    expect(stats.endlessAdvancedBest).toBe(0)
    expect(stats.achievementCount).toBe(0)
  })
})
