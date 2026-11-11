import { describe, expect, it } from 'vitest'
import { compareChallengePerformance, compareDopaPerformance, computeMedian } from './performance'
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

  it('ここまで同率ならmaxComboで決まる', () => {
    const creator = perf()
    const winner = perf({ maxCombo: 25 })
    const loser = perf({ maxCombo: 10 })
    expect(compareChallengePerformance(creator, winner)).toEqual({ result: 'win', decidedBy: 'maxCombo' })
    expect(compareChallengePerformance(creator, loser)).toEqual({ result: 'lose', decidedBy: 'maxCombo' })
  })

  it('ここまで同率ならmedianCorrectReactionMsで決まる（速い=小さい方が勝ち）', () => {
    const creator = perf()
    const winner = perf({ medianCorrectReactionMs: 300 })
    const loser = perf({ medianCorrectReactionMs: 900 })
    expect(compareChallengePerformance(creator, winner)).toEqual({ result: 'win', decidedBy: 'medianCorrectReactionMs' })
    expect(compareChallengePerformance(creator, loser)).toEqual({ result: 'lose', decidedBy: 'medianCorrectReactionMs' })
  })

  it('反応速度もUI表示と同じ0.01秒精度で比較する（10ms未満の差では決着しない）', () => {
    const creator = perf({ medianCorrectReactionMs: 540 })
    const challenger = perf({ medianCorrectReactionMs: 544, maxCombo: 30 })
    // 540msも544msも0.54秒表示で同じため、反応速度では決着せず、それより上位のmaxComboで既に決まっている。
    expect(compareChallengePerformance(creator, challenger)).toEqual({ result: 'win', decidedBy: 'maxCombo' })
  })

  it('medianCorrectReactionMsがnull（比較可能な正解サンプルが無い）は最も遅い扱いになる', () => {
    const creator = perf({ medianCorrectReactionMs: null })
    const challengerWithData = perf({ medianCorrectReactionMs: 100 })
    expect(compareChallengePerformance(creator, challengerWithData)).toEqual({ result: 'win', decidedBy: 'medianCorrectReactionMs' })

    const challengerAlsoNull = perf({ medianCorrectReactionMs: null })
    // 両方nullなら差がつかず、完全同値としてLOSEになる。
    expect(compareChallengePerformance(creator, challengerAlsoNull)).toEqual({ result: 'lose', decidedBy: 'exactTie' })
  })

  it('5項目すべて完全に同値ならchallenger LOSE・decidedBy=exactTie（ホスト防衛）', () => {
    const creator = perf()
    const challenger = perf()
    expect(compareChallengePerformance(creator, challenger)).toEqual({ result: 'lose', decidedBy: 'exactTie' })
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

  it('compareChallengePerformanceはcompareDopaPerformance(creator, challenger)のwinner=bをwin、draw/aをloseへ変換するだけの薄いラッパー', () => {
    const creator = perf()
    const challenger = perf({ finalDopaPercent: 430 })
    const neutral = compareDopaPerformance(creator, challenger)
    const legacy = compareChallengePerformance(creator, challenger)
    expect(neutral.winner).toBe('b')
    expect(legacy).toEqual({ result: 'win', decidedBy: neutral.decidedBy })
  })
})
