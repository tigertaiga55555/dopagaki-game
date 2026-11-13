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

/**
 * Ver.6 Phase 8（通常Challengeの勝敗ルール更新）: 'draw'を追加。挑戦者WIN→ホストLOSE、
 * 挑戦者LOSE→ホストWINの反転は従来どおりだが、DRAWはどちらの視点でもDRAWのまま
 * （「ホスト防衛」という意味づけ自体を廃止したため、視点による特別扱いが不要になった）。
 */
export function resultForViewer(
  challengerResult: 'win' | 'lose' | 'draw',
  perspective: ChallengeViewerPerspective,
): 'win' | 'lose' | 'draw' {
  if (challengerResult === 'draw') return 'draw'
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
  streak: '連続正解数',
}

/**
 * Ver.6 Phase 8: 「通常獲得DOPA%でWIN」「正答率でLOSE」等の理由文。decidedByが示す
 * 比較項目そのものは視点によって変わらない（事実は1つ）が、WIN/LOSEの表記はperspectiveに
 * 応じて反転する。DRAW（exactTie、またはENDLESS Challengeの同STREAK数=streak）は
 * どちらの視点でも同じ「DRAW」表記になる（以前の「ホスト防衛」表現は廃止した）。
 */
export function describeDecidedBy(
  decidedBy: ChallengeDecidedBy,
  challengerResult: 'win' | 'lose' | 'draw',
  perspective: ChallengeViewerPerspective,
): string {
  const viewerResult = resultForViewer(challengerResult, perspective)
  if (viewerResult === 'draw') {
    return decidedBy === 'exactTie' ? '完全同値のためDRAW' : `${DECIDED_BY_LABEL[decidedBy]}が同数のためDRAW`
  }
  return `${DECIDED_BY_LABEL[decidedBy]}で${viewerResult === 'win' ? 'WIN' : 'LOSE'}`
}

/**
 * Challenge専用画面でだけ使う、「通常獲得DOPA%」の意味を示す薄い補足文。
 * 比較表の可読性を優先し、呼び出し側では必ず小さく・薄い色で表示する。
 */
export const BASE_DOPA_PERCENT_NOTE = '※通常獲得DOPA%は、ボーナス加算分を除いた値です'

/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: Battle（WIN/LOSE/DRAWの3択）向けの理由文。
 * decidedByの語彙（DECIDED_BY_LABEL）はChallengeと完全に共有し、Battle専用に
 * 別の名称を作らない。exactTie（全項目完全同値）はChallengeの「ホスト防衛」ではなく
 * 中立な「DRAW」として扱う。
 */
export function describeBattleDecidedBy(decidedBy: ChallengeDecidedBy, outcome: 'win' | 'lose' | 'draw'): string {
  if (decidedBy === 'exactTie') return '全項目同値のためDRAW'
  if (outcome === 'draw') return `${DECIDED_BY_LABEL[decidedBy]}は同値`
  return `${DECIDED_BY_LABEL[decidedBy]}で${outcome === 'win' ? 'WIN' : 'LOSE'}`
}
