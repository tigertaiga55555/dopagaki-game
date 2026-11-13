import { beforeEach, describe, expect, it } from 'vitest'
import { getWorldBattleStats, recordWorldBattleOutcome } from './battleStatsStorage'

function installFakeLocalStorage(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
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
}

describe('battleStatsStorage (Ver.6 Phase 6: 世界対戦の自分の累計勝利数・最大連勝)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期状態は全て0', () => {
    expect(getWorldBattleStats()).toEqual({ wins: 0, currentStreak: 0, maxStreak: 0 })
  })

  it('win: wins+1・currentStreak+1、必要ならmaxStreak更新', () => {
    recordWorldBattleOutcome('win')
    const stats = recordWorldBattleOutcome('win')
    expect(stats).toEqual({ wins: 2, currentStreak: 2, maxStreak: 2 })
  })

  it('lose: currentStreakが0にリセットされる（winsは変化しない）', () => {
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('win')
    const stats = recordWorldBattleOutcome('lose')
    expect(stats).toEqual({ wins: 2, currentStreak: 0, maxStreak: 2 })
  })

  it('draw: winsもcurrentStreakも変化しない（維持）', () => {
    recordWorldBattleOutcome('win')
    const stats = recordWorldBattleOutcome('draw')
    expect(stats).toEqual({ wins: 1, currentStreak: 1, maxStreak: 1 })
  })

  it('maxStreakは一度記録した最大値を下回らない', () => {
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('lose')
    const stats = recordWorldBattleOutcome('win')
    expect(stats).toEqual({ wins: 4, currentStreak: 1, maxStreak: 3 })
  })
})
