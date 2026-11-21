import { beforeEach, describe, expect, it } from 'vitest'
import { getChallengeStats, recordChallengeAttemptResult } from './challengeStatsStorage'

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

describe('challengeStatsStorage (Ver.6 Phase 10: 実績拡張ラウンド、挑戦者としてのローカル累計成績)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('初期状態は全て0', () => {
    expect(getChallengeStats()).toEqual({ participatedCount: 0, winCount: 0 })
  })

  it('win: participatedCount・winCountともに+1', () => {
    const stats = recordChallengeAttemptResult('win')
    expect(stats).toEqual({ participatedCount: 1, winCount: 1 })
  })

  it('lose/draw: participatedCountのみ+1、winCountは変化しない', () => {
    recordChallengeAttemptResult('lose')
    const stats = recordChallengeAttemptResult('draw')
    expect(stats).toEqual({ participatedCount: 2, winCount: 0 })
  })

  it('通常Challenge・ENDLESS Challengeを区別せず合算する（呼び出し側がどちらのmodeか意識しない設計）', () => {
    recordChallengeAttemptResult('win')
    recordChallengeAttemptResult('win')
    recordChallengeAttemptResult('lose')
    expect(getChallengeStats()).toEqual({ participatedCount: 3, winCount: 2 })
  })
})
