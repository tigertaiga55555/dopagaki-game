/**
 * Ver.5.0: FINAL DOPA TRIAL（120%到達後、16問連続正解チャレンジ）の設定。
 *
 * 「120%はFINAL DOPA TRIALへの入口」という仕様に基づき、rawScore式は一切使わない
 * （通常0〜100%のTIER_GAIN/MISS_PENALTY/COMBO_LOSS/Momentum/DIMINISHING_RETURNSは
 * ここでは完全に無関係）。1問正解＝必ず+5%、MISS＝即座にその時点のスコアで終了、
 * 減点は一切しない。
 */
export const FINAL_TRIAL_CONFIG = {
  /** FINAL DOPA TRIAL突入時の開始スコア（100%OVERDRIVEを経て120%へ到達した瞬間の値） */
  startPercent: 120,
  /** 1問正解ごとに必ず加算する固定値（浮動小数の影響を受けない整数演算にする） */
  percentPerCorrect: 5,
  /** 全問題数（Q1〜Q15の通常問題＋Q16のFINAL QUESTION） */
  totalQuestions: 16,
  /** Q16（FINAL QUESTION）正解時の最終スコア＝120 + 5*16 */
  clearPercent: 200,
}

/** 1-based の問題番号（1〜16）から、Q1〜Q15がどのプール階層に属するかを返す。Q16はnull（専用固定問題）。 */
export function tierForQuestionNumber(questionNumber: number): 'reversal' | 'twoCondition' | 'memory' | 'mixed' | null {
  if (questionNumber >= 1 && questionNumber <= 4) return 'reversal'
  if (questionNumber >= 5 && questionNumber <= 8) return 'twoCondition'
  if (questionNumber >= 9 && questionNumber <= 12) return 'memory'
  if (questionNumber >= 13 && questionNumber <= 15) return 'mixed'
  return null
}
