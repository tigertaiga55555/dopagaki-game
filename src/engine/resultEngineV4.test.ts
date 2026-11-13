import { beforeEach, describe, expect, it } from 'vitest'
import { computeChallenge500Result, computeFinalResult, computeFinalTrialResult } from './resultEngineV4'
import { createStats } from './useRushGame'
import type { Challenge500State } from './challenge500Engine'
import type { Challenge500PerformanceStats } from './useChallenge500'
import type { FinalResultV4 } from '../types'

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

/**
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: 「通常獲得DOPA%」の算出（ボーナスタイム分の
 * 除外）・ChallengePerformanceの構築が、各モードの実際の計算式と一致することを検証する。
 * resultEngineV4.ts側はlocalStorage（utils/storage.ts・achievementStorage.ts経由）を
 * 読み書きするため、他のテストと同じ軽量フェイクを使う。
 */
describe('computeFinalResult: 通常プレイ（0〜120%）のChallengePerformance (Ver.6 Phase 5.3)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('ボーナスタイムで加算が無かった場合、通常獲得DOPA%＝最終DOPA%になる', () => {
    const stats = createStats()
    stats.correctCount = 40
    stats.totalAnswered = 50
    stats.maxCombo = 20
    const result = computeFinalResult({ rawPercent: 76, finalPercent: 76, overdriveActive: false, stats })
    expect(result.challengePerformance?.finalDopaPercent).toBe(76)
    expect(result.challengePerformance?.baseDopaPercent).toBe(76)
  })

  it('ユーザー指示の例どおり: 最終76%・ボーナス8%なら通常獲得DOPA%は68%になる', () => {
    const stats = createStats()
    stats.bonusGainRaw = 8
    const result = computeFinalResult({ rawPercent: 76, finalPercent: 76, overdriveActive: false, stats })
    expect(result.challengePerformance?.finalDopaPercent).toBe(76)
    expect(result.challengePerformance?.baseDopaPercent).toBe(68)
  })

  it('accuracyはstats.correctCount/stats.totalAnsweredと一致する', () => {
    const stats = createStats()
    stats.correctCount = 18
    stats.totalAnswered = 24
    const result = computeFinalResult({ rawPercent: 50, finalPercent: 50, overdriveActive: false, stats })
    expect(result.challengePerformance?.accuracy).toBeCloseTo(18 / 24)
  })

  it('maxComboはstats.maxComboと一致する', () => {
    const stats = createStats()
    stats.maxCombo = 33
    const result = computeFinalResult({ rawPercent: 50, finalPercent: 50, overdriveActive: false, stats })
    expect(result.challengePerformance?.maxCombo).toBe(33)
  })

  it('medianCorrectReactionMsはstats.reactionSamplesの中央値（既存の最速反応と同じ集合を使う）', () => {
    const stats = createStats()
    stats.reactionSamples = [
      { type: 'color', reactionMs: 500, targetTimeMs: 1000, correct: true },
      { type: 'color', reactionMs: 300, targetTimeMs: 1000, correct: true },
      { type: 'color', reactionMs: 700, targetTimeMs: 1000, correct: true },
    ]
    const result = computeFinalResult({ rawPercent: 50, finalPercent: 50, overdriveActive: false, stats })
    expect(result.challengePerformance?.medianCorrectReactionMs).toBe(500)
  })

  it('正解した問題が無ければmedianCorrectReactionMsはnull', () => {
    const stats = createStats()
    const result = computeFinalResult({ rawPercent: 0, finalPercent: 0, overdriveActive: false, stats })
    expect(result.challengePerformance?.medianCorrectReactionMs).toBeNull()
  })

  it('OVERDRIVE中・一度もMISSしていない場合のcapは120%', () => {
    const stats = createStats()
    stats.bonusGainRaw = 5
    const result = computeFinalResult({ rawPercent: 130, finalPercent: 120, overdriveActive: true, stats })
    // 130 - 5(bonus) = 125 だが、cap(120)でクランプされる。
    expect(result.challengePerformance?.baseDopaPercent).toBe(120)
  })

  it('OVERDRIVE中・一度でもMISSした場合のcapは119%', () => {
    const stats = createStats()
    stats.missCount = 1
    const result = computeFinalResult({ rawPercent: 130, finalPercent: 119, overdriveActive: true, stats })
    expect(result.challengePerformance?.baseDopaPercent).toBe(119)
  })
})

describe('computeFinalTrialResult: FINAL DOPA TRIALのChallengePerformance (Ver.6 Phase 5.3)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('FINAL DOPA TRIALにはボーナス機構が無いため、通常獲得DOPA%＝最終DOPA%になる', () => {
    const stats = createStats()
    const result = computeFinalTrialResult(
      { finalPercent: 165, trialsCleared: 9, cleared200: false, trialPerformance: { maxCombo: 9, accuracy: 0.9, reactionMsList: [] } },
      stats,
      undefined,
    )
    expect(result.challengePerformance?.finalDopaPercent).toBe(165)
    expect(result.challengePerformance?.baseDopaPercent).toBe(165)
  })

  it('medianCorrectReactionMsはtrialPerformance.reactionMsListの中央値になる', () => {
    const stats = createStats()
    const payload = {
      finalPercent: 145,
      trialsCleared: 5,
      cleared200: false,
      trialPerformance: { maxCombo: 5, accuracy: 5 / 6, reactionMsList: [200, 400, 600] },
    }
    const result = computeFinalTrialResult(payload, stats, undefined)
    expect(result.challengePerformance?.medianCorrectReactionMs).toBe(400)
    expect(result.challengePerformance?.accuracy).toBeCloseTo(5 / 6)
    expect(result.challengePerformance?.maxCombo).toBe(5)
  })
})

describe('computeChallenge500Result: 限界突破チャレンジのChallengePerformance (Ver.6 Phase 5.3)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  function baseResultFixture(): FinalResultV4 {
    return {
      percent: 200,
      rawPercent: 200,
      overdriveActive: true,
      type: { id: 'test', name: 'テスト' },
      comment: '',
      crimeRecords: [],
      maxCombo: 0,
      fastestReactionMs: null,
      accuracy: 0,
      isFirstPlay: false,
      isNewBest: false,
      bestPercent: 200,
      playCount: 1,
    }
  }

  function challengeState(percent: number): Challenge500State {
    return { percent, floor: 200, ended: true, cleared: false, reached490: false }
  }

  it('performanceStatsがあれば、通常獲得DOPA%＝最終DOPA%、accuracy/maxCombo/medianはperformanceStatsから算出される', () => {
    const performanceStats: Challenge500PerformanceStats = { totalAnswered: 10, correctCount: 7, maxCombo: 6, reactionMsList: [1000, 2000, 3000] }
    const result = computeChallenge500Result(challengeState(350), baseResultFixture(), false, undefined, performanceStats)
    expect(result.challengePerformance).toEqual({
      finalDopaPercent: 350,
      baseDopaPercent: 350,
      accuracy: 0.7,
      maxCombo: 6,
      medianCorrectReactionMs: 2000,
    })
  })

  it('performanceStatsが無い場合は、baseResultのchallengePerformanceをそのまま引き継ぐ（推測値で埋めない）', () => {
    const inherited = { finalDopaPercent: 200, baseDopaPercent: 180, accuracy: 0.9, maxCombo: 20, medianCorrectReactionMs: 300 }
    const result = computeChallenge500Result(challengeState(350), { ...baseResultFixture(), challengePerformance: inherited }, false)
    expect(result.challengePerformance).toEqual(inherited)
  })

  it('totalAnswered=0ならaccuracyは0になる（0除算を避ける）', () => {
    const performanceStats: Challenge500PerformanceStats = { totalAnswered: 0, correctCount: 0, maxCombo: 0, reactionMsList: [] }
    const result = computeChallenge500Result(challengeState(200), baseResultFixture(), false, undefined, performanceStats)
    expect(result.challengePerformance?.accuracy).toBe(0)
    expect(result.challengePerformance?.medianCorrectReactionMs).toBeNull()
  })
})
