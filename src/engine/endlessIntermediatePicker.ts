import { ENDLESS_INTERMEDIATE_POOL_TIERS } from '../config/endlessConfig'
import { interpolateWeightCurve, weightedPick, type WeightCurvePoint } from './random'
import type { FinalPoolTier } from '../types'

/** 中級が実際に使う2tierだけの型（reversal/twoConditionのみ）。 */
export type EndlessIntermediateTier = Extract<FinalPoolTier, 'reversal' | 'twoCondition'>

// ENDLESS_INTERMEDIATE_POOL_TIERSと完全に同じ2値であることを起動時に保証する（片方だけ
// 変更して食い違うことを防ぐ、既存のCHALLENGE500_TIER_REPRESENTATIVE_PERCENT assertと同じ考え方）。
for (const tier of ENDLESS_INTERMEDIATE_POOL_TIERS) {
  if (tier !== 'reversal' && tier !== 'twoCondition') {
    throw new Error(`endlessIntermediatePicker: unexpected tier in ENDLESS_INTERMEDIATE_POOL_TIERS: ${tier}`)
  }
}

/**
 * 次フェーズ（item 154-156、ENDLESS中級・上級の難易度再設計）: 中級のSTREAK連動重み。
 *
 * ラダー節目（Ver.6 AchievementScreen等で使う中級のmilestone: 5/15/30/50/75/100
 * 「無我の境地」LEGENDARY）を制御点に採用し、streakが伸びるほどreversal（実質120〜140%
 * 未満、4tier中もっとも易しい）からtwoCondition（140〜160%未満、複数条件が絡む分
 * 難しい）へ重心が連続的に移る。100を超えた長期streakでも打ち止めにせず、reversalを
 * 常に10%残す——Challenge500のCHALLENGE500_INVERSION_WEIGHTSが各tierで「反転なし」を
 * 必ず一定割合残しているのと同じ考え方（極端な長期streakでtwoConditionだけに単調化
 * して問題プールの多様性が失われることを防ぐ）。
 */
export const INTERMEDIATE_TIER_CURVE: WeightCurvePoint<EndlessIntermediateTier>[] = [
  { streak: 1, weights: { reversal: 75, twoCondition: 25 } },
  { streak: 5, weights: { reversal: 60, twoCondition: 40 } },
  { streak: 15, weights: { reversal: 45, twoCondition: 55 } },
  { streak: 30, weights: { reversal: 30, twoCondition: 70 } },
  { streak: 50, weights: { reversal: 20, twoCondition: 80 } },
  { streak: 75, weights: { reversal: 15, twoCondition: 85 } },
  { streak: 100, weights: { reversal: 10, twoCondition: 90 } },
]

export function intermediateTierWeightsAtStreak(streak: number): Record<EndlessIntermediateTier, number> {
  return interpolateWeightCurve(streak, INTERMEDIATE_TIER_CURVE)
}

/**
 * 直近2問が同じtierだった場合は強制的にもう一方へ切り替える（questionPicker.ts・
 * endlessAdvancedPicker.tsの既存の3連続回避ヒューリスティクスと同じ方針）。
 * それ以外はstreak連動の重みでweightedPickする。
 */
export function pickEndlessIntermediateTier(streak: number, recentTiers: EndlessIntermediateTier[]): EndlessIntermediateTier {
  if (recentTiers.length >= 2 && recentTiers[0] === recentTiers[1]) {
    return recentTiers[0] === 'reversal' ? 'twoCondition' : 'reversal'
  }
  return weightedPick(intermediateTierWeightsAtStreak(streak))
}
