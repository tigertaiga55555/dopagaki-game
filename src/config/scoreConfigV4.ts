/**
 * Ver.4.1のスコア設定。
 *
 * Ver.4では「正解するたびに加点し続ける累積スコア」だったため、正答率が低くても
 * 出題数（＝プレイ時間×速度）が多ければraw scoreが積み上がり、ドパガキ度が
 * 簡単に90%台へ到達してしまっていた（正答率60%でドパガキ度90〜95%になるバグ）。
 *
 * Ver.4.1では「1問ごとの質スコア（0〜100、MISSは0）の平均」に変更する。
 * 平均である以上、出題数を稼いでも数値は積み上がらず、正答率の影響がそのまま
 * ドパガキ度に反映される。COMBOボーナスだけは平均後にわずかな上振れを許容し、
 * OVERDRIVE時の100%超えの原資にする。
 */
export const SCORE_CONFIG = {
  /**
   * 判定ごとの質スコア（0〜100）。MISSは0点。
   * GOOD/GREAT/PERFECTの差を小さめにしているのは、正答率（＝MISSで0点になる比率）を
   * ドパガキ度の主要因にするため。判定の速さはあくまで上振れの副次要素として効かせる。
   * この比率はNode.jsシミュレーションで検証済み（スコアシミュレーション結果を参照）。
   */
  qualityByTier: {
    PERFECT: 100,
    GREAT: 90,
    GOOD: 85,
    MISS: 0,
  },
  /** COMBO1につき質スコアに加算するボーナス（comboBonusCapCountで頭打ち）。MISSでは0。 */
  comboBonusPerStack: 0.2,
  comboBonusCapCount: 24,
  /** ドパガキ度の表示を滑らかに増減させる時間（ms）。MISSでも急激に落ちて見えないようにする。 */
  percentTweenMs: 420,
}

/**
 * 正答率によるドパガキ度の上限（OVERDRIVE非対象時のみ適用）。
 * 「速いだけ／適当に押しまくるだけ」で100%へ到達するのを防ぐための蓋。
 * 上から順に評価し、最初に条件を満たした行のcapを採用する。
 */
export const ACCURACY_CAPS: { minAccuracy: number; cap: number }[] = [
  { minAccuracy: 0.95, cap: 100 },
  { minAccuracy: 0.9, cap: 99 },
  { minAccuracy: 0.8, cap: 94 },
  { minAccuracy: 0.7, cap: 85 },
  { minAccuracy: 0, cap: 75 },
]

export function getAccuracyCap(accuracy: number): number {
  for (const tier of ACCURACY_CAPS) {
    if (accuracy >= tier.minAccuracy) return tier.cap
  }
  return ACCURACY_CAPS[ACCURACY_CAPS.length - 1].cap
}

/** 反応時間 / 制限時間 の比率で判定する閾値 */
export const JUDGE_CONFIG = {
  perfectRatio: 0.35,
  greatRatio: 0.6,
  goodRatio: 1.0,
}

export function judgeByRatio(reactionMs: number, targetTimeMs: number): 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS' {
  if (targetTimeMs <= 0) return 'GOOD'
  const ratio = reactionMs / targetTimeMs
  if (ratio <= JUDGE_CONFIG.perfectRatio) return 'PERFECT'
  if (ratio <= JUDGE_CONFIG.greatRatio) return 'GREAT'
  if (ratio <= JUDGE_CONFIG.goodRatio) return 'GOOD'
  return 'MISS'
}
