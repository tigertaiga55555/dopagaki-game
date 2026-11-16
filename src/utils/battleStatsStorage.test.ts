import { beforeEach, describe, expect, it } from 'vitest'
import { getFriendBattlePlayCount, getWorldBattleStats, incrementFriendBattlePlayCount, recordWorldBattleOutcome } from './battleStatsStorage'

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

  it('初期状態は全て0・hasDrawn=false', () => {
    expect(getWorldBattleStats()).toEqual({ wins: 0, currentStreak: 0, maxStreak: 0, totalPlays: 0, hasDrawn: false })
  })

  it('win: wins+1・currentStreak+1・totalPlays+1、必要ならmaxStreak更新', () => {
    recordWorldBattleOutcome('win')
    const stats = recordWorldBattleOutcome('win')
    expect(stats).toEqual({ wins: 2, currentStreak: 2, maxStreak: 2, totalPlays: 2, hasDrawn: false })
  })

  it('lose: currentStreakが0にリセットされる（winsは変化しない）・totalPlaysは+1される', () => {
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('win')
    const stats = recordWorldBattleOutcome('lose')
    expect(stats).toEqual({ wins: 2, currentStreak: 0, maxStreak: 2, totalPlays: 3, hasDrawn: false })
  })

  it('draw: winsもcurrentStreakも変化しない（維持）・totalPlays+1・hasDrawn=trueになる', () => {
    recordWorldBattleOutcome('win')
    const stats = recordWorldBattleOutcome('draw')
    expect(stats).toEqual({ wins: 1, currentStreak: 1, maxStreak: 1, totalPlays: 2, hasDrawn: true })
  })

  it('maxStreakは一度記録した最大値を下回らない', () => {
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('win')
    recordWorldBattleOutcome('lose')
    const stats = recordWorldBattleOutcome('win')
    expect(stats).toEqual({ wins: 4, currentStreak: 1, maxStreak: 3, totalPlays: 5, hasDrawn: false })
  })

  it('一度hasDrawn=trueになったら、その後win/loseが続いてもfalseへは戻らない', () => {
    recordWorldBattleOutcome('draw')
    recordWorldBattleOutcome('win')
    const stats = recordWorldBattleOutcome('lose')
    expect(stats.hasDrawn).toBe(true)
  })
})

describe('フレンド対戦の累計プレイ回数 (Ver.6 Phase 10: 実績拡張ラウンド、勝敗は一切記録しない)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期状態は0', () => {
    expect(getFriendBattlePlayCount()).toBe(0)
  })

  it('incrementFriendBattlePlayCountを呼ぶたびに+1される', () => {
    incrementFriendBattlePlayCount()
    incrementFriendBattlePlayCount()
    expect(incrementFriendBattlePlayCount()).toBe(3)
    expect(getFriendBattlePlayCount()).toBe(3)
  })

  it('世界対戦の戦績（wins等）とは完全に独立している', () => {
    recordWorldBattleOutcome('win')
    incrementFriendBattlePlayCount()
    expect(getWorldBattleStats().wins).toBe(1)
    expect(getFriendBattlePlayCount()).toBe(1)
  })
})
