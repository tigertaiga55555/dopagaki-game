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
  result: 'win' | 'lose' | 'draw'
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

export interface DopaComparisonResult {
  winner: 'a' | 'b' | 'draw'
  decidedBy: ChallengeDecidedBy
}

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: a/b対称のDOPA%比較。ユーザー指示の優先順位
 * （finalDopaPercent→baseDopaPercent→accuracy→maxCombo→medianCorrectReactionMs→
 * 完全同値）で必ず比較し、途中の項目で差が出た時点で確定する。medianCorrectReactionMsが
 * null（比較可能な正解サンプルが無い）の場合は「最も遅い」扱いにする（Infinity扱い）。
 *
 * Challenge（compareChallengePerformance）・Battle（compareDopaPerformance経由）の
 * どちらも、この1つの比較ロジックだけを共有する（同じ概念を2回実装しない）。
 * 完全同値時の意味づけ（Challengeはホスト防衛=challenger lose、Battleはdraw）は
 * 呼び出し側でだけ分岐させ、この関数自体は「どちらが勝っているか／完全同値か」
 * という中立な事実だけを返す。
 */
export function compareDopaPerformance(a: ChallengePerformance, b: ChallengePerformance): DopaComparisonResult {
  if (a.finalDopaPercent !== b.finalDopaPercent) {
    return { winner: a.finalDopaPercent > b.finalDopaPercent ? 'a' : 'b', decidedBy: 'finalDopaPercent' }
  }
  if (a.baseDopaPercent !== b.baseDopaPercent) {
    return { winner: a.baseDopaPercent > b.baseDopaPercent ? 'a' : 'b', decidedBy: 'baseDopaPercent' }
  }

  const aAccuracyPct = roundedAccuracyPercent(a.accuracy)
  const bAccuracyPct = roundedAccuracyPercent(b.accuracy)
  if (aAccuracyPct !== bAccuracyPct) {
    return { winner: aAccuracyPct > bAccuracyPct ? 'a' : 'b', decidedBy: 'accuracy' }
  }

  if (a.maxCombo !== b.maxCombo) {
    return { winner: a.maxCombo > b.maxCombo ? 'a' : 'b', decidedBy: 'maxCombo' }
  }

  const aReactionMs = a.medianCorrectReactionMs === null ? Infinity : roundedReactionMs(a.medianCorrectReactionMs)
  const bReactionMs = b.medianCorrectReactionMs === null ? Infinity : roundedReactionMs(b.medianCorrectReactionMs)
  if (aReactionMs !== bReactionMs) {
    // 反応速度は小さい方が速い＝勝ち。
    return { winner: aReactionMs < bReactionMs ? 'a' : 'b', decidedBy: 'medianCorrectReactionMs' }
  }

  return { winner: 'draw', decidedBy: 'exactTie' }
}

/**
 * Ver.6 Phase 8（通常Challengeの勝敗ルール更新）: challenger視点でのWIN/LOSE/DRAW判定。
 * 以前はcompareDopaPerformance（Battleと共有の5項目比較＋完全同値=ホスト防衛=lose）を
 * そのまま流用していたが、今回のユーザー指示で通常Challengeだけ仕様を変更した：
 *   1. 反応速度中央値（medianCorrectReactionMs）をタイブレークから除外する
 *      （finalDopaPercent→baseDopaPercent→accuracy→maxComboの4項目までで必ず決着する）。
 *   2. ここまで全て完全同値の場合、以前の「ホスト防衛＝challenger LOSE」をやめ、
 *      両者DRAWへ変更する。
 * Battle（compareDopaPerformance／compareDopaPerformanceを直接呼ぶbattleRoomEngine.ts）は
 * 一切変更していない——このファイル内のcompareDopaPerformance自体は1バイトも変えておらず、
 * 世界対戦は引き続き反応速度込みの5項目比較＋完全同値DRAWのまま動作する。
 * そのため、この関数はcompareDopaPerformanceに委譲せず、4項目だけの独立した比較を行う。
 */
export function compareChallengePerformance(
  creator: ChallengePerformance,
  challenger: ChallengePerformance,
): ChallengeComparisonResult {
  if (creator.finalDopaPercent !== challenger.finalDopaPercent) {
    return { result: challenger.finalDopaPercent > creator.finalDopaPercent ? 'win' : 'lose', decidedBy: 'finalDopaPercent' }
  }
  if (creator.baseDopaPercent !== challenger.baseDopaPercent) {
    return { result: challenger.baseDopaPercent > creator.baseDopaPercent ? 'win' : 'lose', decidedBy: 'baseDopaPercent' }
  }

  const creatorAccuracyPct = roundedAccuracyPercent(creator.accuracy)
  const challengerAccuracyPct = roundedAccuracyPercent(challenger.accuracy)
  if (creatorAccuracyPct !== challengerAccuracyPct) {
    return { result: challengerAccuracyPct > creatorAccuracyPct ? 'win' : 'lose', decidedBy: 'accuracy' }
  }

  if (creator.maxCombo !== challenger.maxCombo) {
    return { result: challenger.maxCombo > creator.maxCombo ? 'win' : 'lose', decidedBy: 'maxCombo' }
  }

  return { result: 'draw', decidedBy: 'exactTie' }
}

/**
 * Ver.6 Phase 8（ENDLESS Challenge）: ホストのSTREAK数と挑戦者のSTREAK数を比較するだけの
 * 純粋関数。DOPA%・正答率・COMBO・反応速度のいずれも関与しない——ENDLESS Challengeの
 * 目的は「ホストの連続正解数を超えること」だけであるため、タイブレークという概念自体が
 * 存在しない（同数なら無条件でDRAW）。
 */
export function compareEndlessStreak(hostStreak: number, challengerStreak: number): 'win' | 'lose' | 'draw' {
  if (challengerStreak > hostStreak) return 'win'
  if (challengerStreak === hostStreak) return 'draw'
  return 'lose'
}
