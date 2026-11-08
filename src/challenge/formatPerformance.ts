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

const DECIDED_BY_LABEL: Record<ChallengeDecidedBy, string> = {
  finalDopaPercent: '最終DOPA%',
  baseDopaPercent: '通常獲得DOPA%',
  accuracy: '正答率',
  maxCombo: '最大COMBO',
  medianCorrectReactionMs: '反応速度',
  exactTie: '完全同値のためホスト防衛',
  legacyScoreOnly: '記録(DOPA%)',
}

/** 「通常獲得DOPA%でWIN」「正答率でLOSE」「完全同値のためホスト防衛」等の理由文。 */
export function describeDecidedBy(decidedBy: ChallengeDecidedBy, result: 'win' | 'lose'): string {
  if (decidedBy === 'exactTie') return '完全同値のためホスト防衛'
  return `${DECIDED_BY_LABEL[decidedBy]}で${result === 'win' ? 'WIN' : 'LOSE'}`
}
