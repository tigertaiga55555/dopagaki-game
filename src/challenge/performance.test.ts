import { describe, expect, it } from 'vitest'
import { compareChallengePerformance, compareDopaPerformance, compareEndlessStreak, computeMedian } from './performance'
import type { ChallengePerformance } from './types'

function perf(overrides: Partial<ChallengePerformance> = {}): ChallengePerformance {
  return { finalDopaPercent: 420, baseDopaPercent: 400, accuracy: 0.7, maxCombo: 18, medianCorrectReactionMs: 540, ...overrides }
}

describe('computeMedian (Ver.6 Phase 5.3: Challenge勝敗判定強化)', () => {
  it('空配列はnull', () => {
    expect(computeMedian([])).toBeNull()
  })

  it('奇数件は中央の1件', () => {
    expect(computeMedian([300, 100, 200])).toBe(200)
  })

  it('偶数件は中央2件の平均', () => {
    expect(computeMedian([100, 400, 200, 300])).toBe(250)
  })

  it('1件だけでもその値を返す', () => {
    expect(computeMedian([555])).toBe(555)
  })
})

describe('compareChallengePerformance (Ver.6 Phase 5.3: Challenge勝敗判定強化)', () => {
  it('finalDopaPercentの差で勝敗が決まる（それ以降の項目は見ない）', () => {
    const creator = perf()
    const winner = perf({ finalDopaPercent: 430, baseDopaPercent: 1, accuracy: 0, maxCombo: 0, medianCorrectReactionMs: 99999 })
    const loser = perf({ finalDopaPercent: 410, baseDopaPercent: 1000, accuracy: 1, maxCombo: 1000, medianCorrectReactionMs: 1 })
    expect(compareChallengePerformance(creator, winner)).toEqual({ result: 'win', decidedBy: 'finalDopaPercent' })
    expect(compareChallengePerformance(creator, loser)).toEqual({ result: 'lose', decidedBy: 'finalDopaPercent' })
  })

  it('finalDopaPercentが同率ならbaseDopaPercentで決まる', () => {
    const creator = perf()
    const winner = perf({ baseDopaPercent: 410 })
    const loser = perf({ baseDopaPercent: 390 })
    expect(compareChallengePerformance(creator, winner)).toEqual({ result: 'win', decidedBy: 'baseDopaPercent' })
    expect(compareChallengePerformance(creator, loser)).toEqual({ result: 'lose', decidedBy: 'baseDopaPercent' })
  })

  it('finalDopaPercent・baseDopaPercentが同率ならaccuracyで決まる', () => {
    const creator = perf()
    const winner = perf({ accuracy: 0.8 })
    const loser = perf({ accuracy: 0.6 })
    expect(compareChallengePerformance(creator, winner)).toEqual({ result: 'win', decidedBy: 'accuracy' })
    expect(compareChallengePerformance(creator, loser)).toEqual({ result: 'lose', decidedBy: 'accuracy' })
  })

  it('accuracyはUI表示と同じ%精度で比較する（0.701と0.70は同じ70%として扱い、accuracyでは決着しない）', () => {
    const creator = perf({ accuracy: 0.7 })
    const challenger = perf({ accuracy: 0.701, maxCombo: 30 })
    // 70%同値のためaccuracyでは決着せず、次のmaxComboへ進む。
    expect(compareChallengePerformance(creator, challenger)).toEqual({ result: 'win', decidedBy: 'maxCombo' })
  })

  it('ここまで同率ならmaxComboで決まる（反応速度は一切見ない）', () => {
    const creator = perf()
    const winner = perf({ maxCombo: 25 })
    const loser = perf({ maxCombo: 10 })
    expect(compareChallengePerformance(creator, winner)).toEqual({ result: 'win', decidedBy: 'maxCombo' })
    expect(compareChallengePerformance(creator, loser)).toEqual({ result: 'lose', decidedBy: 'maxCombo' })
  })

  it('Ver.6 Phase 8: maxComboまで完全同値なら反応速度に関わらずDRAW・decidedBy=exactTie（ホスト防衛は廃止）', () => {
    const creator = perf({ medianCorrectReactionMs: 300 })
    // 反応速度だけ大きく違っても、Challengeの比較からは除外されているため一切見られない。
    const challenger = perf({ medianCorrectReactionMs: 9999 })
    expect(compareChallengePerformance(creator, challenger)).toEqual({ result: 'draw', decidedBy: 'exactTie' })
  })

  it('medianCorrectReactionMsがnullでもfinalDopaPercent〜maxComboが同値なら同じくDRAWになる（反応速度は比較に一切関与しない）', () => {
    const creator = perf({ medianCorrectReactionMs: null })
    const challenger = perf({ medianCorrectReactionMs: 100 })
    expect(compareChallengePerformance(creator, challenger)).toEqual({ result: 'draw', decidedBy: 'exactTie' })
  })
})

describe('compareEndlessStreak (Ver.6 Phase 8: ENDLESS Challenge専用の単純なSTREAK比較)', () => {
  it('挑戦者のSTREAKがホストを超えればwin', () => {
    expect(compareEndlessStreak(37, 38)).toBe('win')
  })

  it('挑戦者のSTREAKがホストと同数ならdraw（タイブレークなし）', () => {
    expect(compareEndlessStreak(37, 37)).toBe('draw')
  })

  it('挑戦者のSTREAKがホスト未満ならlose', () => {
    expect(compareEndlessStreak(37, 36)).toBe('lose')
  })

  it('ホスト0・挑戦者0でもdraw（境界値）', () => {
    expect(compareEndlessStreak(0, 0)).toBe('draw')
  })
})

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: compareDopaPerformanceはcompareChallengePerformance
 * と同じ比較ロジックを共有する中立版（a/b/draw）。Battle機能がdraw判定にそのまま使う。
 */
describe('compareDopaPerformance (Ver.6 Phase 6: a/b/draw共有比較ロジック)', () => {
  it('aが優位ならwinner=a、bが優位ならwinner=b', () => {
    const base = perf()
    expect(compareDopaPerformance(base, perf({ finalDopaPercent: 430 }))).toEqual({ winner: 'b', decidedBy: 'finalDopaPercent' })
    expect(compareDopaPerformance(perf({ finalDopaPercent: 430 }), base)).toEqual({ winner: 'a', decidedBy: 'finalDopaPercent' })
  })

  it('5項目すべて完全同値ならwinner=draw・decidedBy=exactTie（Challengeのホスト防衛とは異なり、ここではどちらのLOSEでもない）', () => {
    const a = perf()
    const b = perf()
    expect(compareDopaPerformance(a, b)).toEqual({ winner: 'draw', decidedBy: 'exactTie' })
  })

  it('Ver.6 Phase 8: compareChallengePerformanceはcompareDopaPerformanceから独立している（反応速度だけが異なり他4項目が完全同値なケースで、Battle側はdecidedByがmedianCorrectReactionMsで決着するのに対し、Challenge側は反応速度を見ずにdrawになる）', () => {
    const creator = perf({ medianCorrectReactionMs: 300 })
    const challenger = perf({ medianCorrectReactionMs: 9999 })

    const battleStyle = compareDopaPerformance(creator, challenger)
    expect(battleStyle).toEqual({ winner: 'a', decidedBy: 'medianCorrectReactionMs' })

    const challengeStyle = compareChallengePerformance(creator, challenger)
    expect(challengeStyle).toEqual({ result: 'draw', decidedBy: 'exactTie' })
  })
})
