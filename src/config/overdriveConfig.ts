/**
 * DOPA OVERDRIVE（100%突破）の隠し発動条件。
 * ユーザーには一切説明しない。高精度＋高反応＋その他3条件中2つを満たした場合のみ発動する。
 */
export const OVERDRIVE_CONFIG = {
  /** 100%を突破できる最大値 */
  maxPercent: 120,
  /** 「高精度」とみなす正答率の下限 */
  accuracyThreshold: 0.85,
  /** 「高反応」とみなす、反応時間/制限時間比率の上限（小さいほど速い） */
  reactionRatioThreshold: 0.45,
  /** 「高COMBO」とみなす最大COMBOの下限 */
  comboThreshold: 12,
  /** 「せっかち行動」とみなす、ゲーム内の先走りタップ回数の下限 */
  hastyTapThreshold: 4,
  /** 「待てなさ」とみなす、「押すな」失敗回数の下限 */
  impatienceThreshold: 1,
}

export interface OverdriveEligibility {
  eligible: boolean
  hasHighAccuracy: boolean
  hasFastReaction: boolean
  extraConditionsMet: number
}

export function evaluateOverdriveEligibility(stats: {
  accuracy: number
  avgReactionRatio: number
  maxCombo: number
  hastyTapCount: number
  noPressFails: number
}): OverdriveEligibility {
  const hasHighAccuracy = stats.accuracy >= OVERDRIVE_CONFIG.accuracyThreshold
  const hasFastReaction = stats.avgReactionRatio <= OVERDRIVE_CONFIG.reactionRatioThreshold
  const extraConditionsMet = [
    stats.maxCombo >= OVERDRIVE_CONFIG.comboThreshold,
    stats.hastyTapCount >= OVERDRIVE_CONFIG.hastyTapThreshold,
    stats.noPressFails >= OVERDRIVE_CONFIG.impatienceThreshold,
  ].filter(Boolean).length

  return {
    eligible: hasHighAccuracy && hasFastReaction && extraConditionsMet >= 2,
    hasHighAccuracy,
    hasFastReaction,
    extraConditionsMet,
  }
}
