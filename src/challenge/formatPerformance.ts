import type { ChallengeDecidedBy } from './types'

/**
 * Ver.6 Phase 5.3（Challenge勝敗判定強化）: ChallengePerformance表示用の純粋な整形関数。
 * 複数の画面（ChallengeSentScreen/ChallengeResultScreen/ChallengeHistoryScreen）で
 * 同じ表記ルールを使うための共通化（画面ごとに書式がズレないようにする）。
 */

/** 0.71秒のような秒表記（小数2桁）。nullは「比較可能な正解サンプルが無い」ことを示す—。 */
export function formatReactionSeconds(ms: number | null): string {
  if (ms === null) return '—'
  return `${(ms / 1000).toFixed(2)}秒`
}

/** 54%のような整数%表記。 */
export function formatAccuracyPercent(accuracy: number): string {
  return `${Math.round(accuracy * 100)}%`
}

/**
 * Ver.6 Phase 5.4（実機QA最終修正）: D1のchallenge_attempts.resultは常に挑戦者視点で
 * 保存されている（DB上の値そのものは書き換えない——ユーザー指示の重要事項）。
 * ホスト（Challenge作成者）が自分の視点で見る場合だけ、表示直前にこの関数で反転する。
 *
 * 挑戦者WIN → ホストLOSE / 挑戦者LOSE → ホストWIN。
 */
export type ChallengeViewerPerspective = 'challenger' | 'host'

export function resultForViewer(challengerResult: 'win' | 'lose', perspective: ChallengeViewerPerspective): 'win' | 'lose' {
  if (perspective === 'challenger') return challengerResult
  return challengerResult === 'win' ? 'lose' : 'win'
}

const DECIDED_BY_LABEL: Record<ChallengeDecidedBy, string> = {
  finalDopaPercent: '最終DOPA%',
  baseDopaPercent: '通常獲得DOPA%',
  accuracy: '正答率',
  maxCombo: '最大COMBO',
  medianCorrectReactionMs: '反応速度',
  exactTie: '完全同値',
  legacyScoreOnly: '記録(DOPA%)',
}

/**
 * 「通常獲得DOPA%でWIN」「正答率でLOSE」等の理由文。decidedByが示す比較項目そのものは
 * 視点によって変わらない（事実は1つ）が、WIN/LOSEの表記はperspectiveに応じて反転する。
 * exactTieだけは視点ごとに自然な言い回しへ特別に差し替える
 * （挑戦者:「完全同値のためLOSE」／ホスト:「完全同値で防衛成功」）。
 */
export function describeDecidedBy(
  decidedBy: ChallengeDecidedBy,
  challengerResult: 'win' | 'lose',
  perspective: ChallengeViewerPerspective,
): string {
  if (decidedBy === 'exactTie') {
    return perspective === 'challenger' ? '完全同値のためLOSE' : '完全同値で防衛成功'
  }
  const viewerResult = resultForViewer(challengerResult, perspective)
  return `${DECIDED_BY_LABEL[decidedBy]}で${viewerResult === 'win' ? 'WIN' : 'LOSE'}`
}

/**
 * Challenge専用画面でだけ使う、「通常獲得DOPA%」の意味を示す薄い補足文。
 * 比較表の可読性を優先し、呼び出し側では必ず小さく・薄い色で表示する。
 */
export const BASE_DOPA_PERCENT_NOTE = '※通常獲得DOPA%は、ボーナス加算分を除いた値です'
