import type { ChallengeDecidedBy, ChallengePerformance } from './types'

/**
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: 純粋関数のみ（DOM・Workersランタイム・
 * localStorageに一切依存しない）。クライアント（performance計測）・Worker
 * （勝敗の最終判定）の両方から同じロジックをimportして使うことで、「クライアントと
 * サーバーで勝敗ルールがズレる」事態を構造的に防ぐ。ただし実際にWIN/LOSEを
 * 確定させるのは必ずWorker側の呼び出しだけで、クライアント側はこれを表示用の
 * 事前計算（将来使うなら）以外に使わない。
 */

/** 偶数件の場合は中央2件の平均。空配列はnull（比較可能なサンプルが無い）。 */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

export interface ChallengeComparisonResult {
  result: 'win' | 'lose'
  decidedBy: ChallengeDecidedBy
}

/** UI表示と同じ精度（%整数）に丸めてから比較する。生のaccuracy（例: 0.5432 vs 0.5401）の違いだけで勝敗が割れ、画面上は同じ「54%」なのに結果が食い違う、という事態を防ぐ。 */
function roundedAccuracyPercent(accuracy: number): number {
  return Math.round(accuracy * 100)
}

/** UI表示（0.01秒単位）と同じ精度に丸める。10ms未満の差だけで勝敗が割れることを防ぐ。 */
function roundedReactionMs(ms: number): number {
  return Math.round(ms / 10) * 10
}

/**
 * challenger視点でのWIN/LOSE判定。ユーザー指示の優先順位
 * （finalDopaPercent→baseDopaPercent→accuracy→maxCombo→medianCorrectReactionMs→
 * 完全同値=challenger LOSE）で必ず比較し、途中の項目で差が出た時点で確定する。
 * medianCorrectReactionMsがnull（比較可能な正解サンプルが無い）の場合は
 * 「最も遅い」扱いにする（Infinity扱い）——反応速度で勝ちを主張するにはデータが必要、
 * というルール。
 */
export function compareChallengePerformance(
  creator: ChallengePerformance,
  challenger: ChallengePerformance,
): ChallengeComparisonResult {
  if (challenger.finalDopaPercent !== creator.finalDopaPercent) {
    return { result: challenger.finalDopaPercent > creator.finalDopaPercent ? 'win' : 'lose', decidedBy: 'finalDopaPercent' }
  }
  if (challenger.baseDopaPercent !== creator.baseDopaPercent) {
    return { result: challenger.baseDopaPercent > creator.baseDopaPercent ? 'win' : 'lose', decidedBy: 'baseDopaPercent' }
  }

  const creatorAccuracyPct = roundedAccuracyPercent(creator.accuracy)
  const challengerAccuracyPct = roundedAccuracyPercent(challenger.accuracy)
  if (challengerAccuracyPct !== creatorAccuracyPct) {
    return { result: challengerAccuracyPct > creatorAccuracyPct ? 'win' : 'lose', decidedBy: 'accuracy' }
  }

  if (challenger.maxCombo !== creator.maxCombo) {
    return { result: challenger.maxCombo > creator.maxCombo ? 'win' : 'lose', decidedBy: 'maxCombo' }
  }

  const creatorReactionMs = creator.medianCorrectReactionMs === null ? Infinity : roundedReactionMs(creator.medianCorrectReactionMs)
  const challengerReactionMs = challenger.medianCorrectReactionMs === null ? Infinity : roundedReactionMs(challenger.medianCorrectReactionMs)
  if (challengerReactionMs !== creatorReactionMs) {
    // 反応速度は小さい方が速い＝勝ち。
    return { result: challengerReactionMs < creatorReactionMs ? 'win' : 'lose', decidedBy: 'medianCorrectReactionMs' }
  }

  return { result: 'lose', decidedBy: 'exactTie' }
}
