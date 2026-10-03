import { CHALLENGE500_INVERSION_WEIGHTS, type Challenge500Tier } from '../../config/challenge500Config'

/**
 * tierごとの「下線反転の個数」出現比率（CHALLENGE500_INVERSION_WEIGHTS）から0/1/2を
 * 重み付き抽選し、そのテンプレートが構造的に対応できる最大反転数（maxSlots）でclampする。
 *
 * 毎問必ず反転すると「どうせ反対」と構えられてしまうため、反転なし（0）を必ず一定割合で
 * 混在させるのがこの関数の目的（ユーザー指示の訂正事項）。clampにより、maxSlots未満の
 * テンプレート（例: tier2/3でも1箇所しか反転できない問題）では「2」が選ばれた場合に
 * そのまま「1」へ縮退する——各tierの比率設定はこの縮退を踏まえて調整すること。
 */
export function pickInversionCount(tier: Challenge500Tier, maxSlots: 0 | 1 | 2): 0 | 1 | 2 {
  const weights = CHALLENGE500_INVERSION_WEIGHTS[tier]
  const total = weights[0] + weights[1] + weights[2]
  const r = Math.random() * total
  let picked: 0 | 1 | 2
  if (r < weights[0]) picked = 0
  else if (r < weights[0] + weights[1]) picked = 1
  else picked = 2
  return Math.min(picked, maxSlots) as 0 | 1 | 2
}
