import { beforeEach, describe, expect, it } from 'vitest'
import { computeChallenge500Result, computeFinalResult, computeFinalTrialResult } from './resultEngineV4'
import { createStats } from './useRushGame'
import { isAchievementUnlocked } from '../utils/achievementStorage'
import { getBestPercent, getOfficialPlayCount, getPlayCount } from '../utils/storage'
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

describe('official フラグ（Ver.6 Phase 10実績拡張ラウンド）: Challenge/Battleリプレイが公式記録を汚染しないことの検証', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })

  it('computeFinalResult: official=false（既定undefined=trueとの比較）ではplayCount加算・自己ベスト更新・DOPA%実績解除を一切行わない', () => {
    const stats = createStats()
    stats.totalAnswered = 10
    stats.correctCount = 10
    const result = computeFinalResult({ rawPercent: 100, finalPercent: 100, overdriveActive: false, stats }, undefined, false)
    expect(getPlayCount()).toBe(0)
    expect(getBestPercent()).toBe(0)
    expect(getOfficialPlayCount()).toBe(0) // Ver.6 Phase 10: Grind専用カウンタも加算されない
    expect(result.newlyUnlockedAchievements).toEqual([])
    expect(result.isNewBest).toBe(false)
    expect(isAchievementUnlocked('dopa100')).toBe(false)
  })

  it('computeFinalResult: official=true（既定値、単機プレイ）ではplayCount加算・自己ベスト更新・DOPA%実績解除が従来通り発生する', () => {
    const stats = createStats()
    const result = computeFinalResult({ rawPercent: 100, finalPercent: 100, overdriveActive: false, stats })
    expect(getPlayCount()).toBe(1)
    expect(getBestPercent()).toBe(100)
    expect(getOfficialPlayCount()).toBe(1)
    expect(result.newlyUnlockedAchievements).toEqual(['dopa50', 'dopa100'])
    expect(isAchievementUnlocked('dopa100')).toBe(true)
  })

  it('computeFinalResult: official=true・正答率100%・100%到達でノーミスも一緒に解除される', () => {
    const stats = createStats()
    stats.totalAnswered = 20
    stats.correctCount = 20
    const result = computeFinalResult({ rawPercent: 100, finalPercent: 100, overdriveActive: false, stats })
    expect(result.newlyUnlockedAchievements).toEqual(['dopa50', 'dopa100', 'noMiss100'])
    expect(isAchievementUnlocked('noMiss100')).toBe(true)
    expect(isAchievementUnlocked('noMiss200')).toBe(false)
  })

  it('computeFinalTrialResult: official=falseではplayCount加算・自己ベスト更新・DOPA%実績解除を一切行わない', () => {
    const stats = createStats()
    const payload = { finalPercent: 150, trialsCleared: 10, cleared200: false, trialPerformance: { maxCombo: 1, accuracy: 1, reactionMsList: [] } }
    const result = computeFinalTrialResult(payload, stats, undefined, false)
    expect(getPlayCount()).toBe(0)
    expect(getBestPercent()).toBe(0)
    expect(getOfficialPlayCount()).toBe(0)
    expect(result.newlyUnlockedAchievements).toEqual([])
    expect(isAchievementUnlocked('dopa150')).toBe(false)
  })

  it('computeFinalTrialResult: official=true・正答率100%・200%到達で完全体も一緒に解除される', () => {
    const stats = createStats()
    stats.totalAnswered = 15
    stats.correctCount = 15
    const payload = { finalPercent: 200, trialsCleared: 15, cleared200: true, trialPerformance: { maxCombo: 15, accuracy: 1, reactionMsList: [] } }
    const result = computeFinalTrialResult(payload, stats, undefined, true)
    expect(getOfficialPlayCount()).toBe(1)
    expect(result.newlyUnlockedAchievements).toContain('noMiss100')
    expect(result.newlyUnlockedAchievements).toContain('noMiss200')
  })

  it('Grind不正防止統合テスト: Challengeリプレイ相当のofficial=false呼び出しを何度繰り返してもGrind実績カウントに一切反映されない（ChallengePlayScreen.tsxの呼び方の再現）', () => {
    const stats = createStats()
    // ChallengePlayScreen.tsxがPlayScreen/FinalTrialScreenへ渡すのと同じ official=false を、
    // 挑戦状への何度ものリプレイを模して9回繰り返す。
    for (let i = 0; i < 9; i++) {
      computeFinalResult({ rawPercent: 100, finalPercent: 100, overdriveActive: false, stats: createStats() }, undefined, false)
    }
    expect(getOfficialPlayCount()).toBe(0)
    expect(isAchievementUnlocked('grindPlay10')).toBe(false)

    // 公式プレイ（official=true）を1回だけ行うと、Grindは「1回だけ」増える。
    const result = computeFinalResult({ rawPercent: 100, finalPercent: 100, overdriveActive: false, stats }, undefined, true)
    expect(getOfficialPlayCount()).toBe(1)
    expect(result.newlyUnlockedAchievements).not.toContain('grindPlay10')
    expect(isAchievementUnlocked('grindPlay10')).toBe(false) // 1回ではまだ10回に届かない
  })

  it('computeChallenge500Result: 第3引数（official/persist）がfalseなら自己ベスト更新・DOPA%実績・FINAL QUESTION実績を一切行わない（ChallengePlayScreen.tsxのリプレイ経路と同じ呼び方）', () => {
    const base: FinalResultV4 = {
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
    const state: Challenge500State = { percent: 500, floor: 490, ended: true, cleared: true, reached490: true }
    const result = computeChallenge500Result(state, base, false)
    expect(getBestPercent()).toBe(0)
    expect(result.newlyUnlockedAchievements).toEqual([])
    expect(isAchievementUnlocked('dopa500')).toBe(false)
    expect(isAchievementUnlocked('dopa490')).toBe(false)
  })
})
