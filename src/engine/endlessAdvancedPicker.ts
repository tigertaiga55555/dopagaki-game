import { tierForPercent } from '../config/challenge500Config'
import { interpolateWeightCurve, weightedPick, type WeightCurvePoint } from './random'
import type { Challenge500Tier } from '../questions/challenge500/types'

/**
 * Ver.6 Phase 4.2 → 次フェーズ（item 154-156、ENDLESS中級・上級の難易度再設計）で全面改訂:
 * Endless上級（160〜500%相当の「全部乗せ」）が、1問ごとにFINAL DOPA TRIAL後半2tier
 * （memory/mixed）とChallenge500（200〜500% LIMIT BREAK）の3tierのどちらから・どのtierで
 * 出題するかを決める、純粋ロジック（Reactに依存しないためvitestで直接検証できる）。
 *
 * 旧仕様（final/challenge500の2値、問題モジュール数に基づく静的な重み）はstreakを
 * 一切見ておらず、「streakが伸びるほど難しくなる」という今回のユーザー要望を満たせない。
 * 5カテゴリ（final-memory/final-mixed/challenge500-tier1/tier2/tier3）に細分化し、
 * streak連動の連続的な重みへ置き換えた。
 */
export type EndlessAdvancedCategory = 'final-memory' | 'final-mixed' | 'challenge500-tier1' | 'challenge500-tier2' | 'challenge500-tier3'

/**
 * Challenge500系カテゴリを抽選した際、どのtier（1/2/3）の問題プール・反転比率
 * （CHALLENGE500_INVERSION_WEIGHTS）を使うかを表す代表％。Endlessの連続正解数で
 * DOPA%を進行させるわけではない（ユーザー指示どおり、Endless内でDOPA%は一切存在しない）ため、
 * カテゴリ自体がtierを一意に決め、この代表％はそのtierのプール・反転比率を解決するためだけに使う。
 */
export const CHALLENGE500_TIER_REPRESENTATIVE_PERCENT: Record<Challenge500Tier, number> = {
  1: 250,
  2: 350,
  3: 450,
}

// 代表％が意図したtierへ実際に解決されることを起動時に前提として保証しておく（テストでも確認する）。
for (const tier of [1, 2, 3] as const) {
  if (tierForPercent(CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]) !== tier) {
    throw new Error(`endlessAdvancedPicker: representative percent for tier ${tier} does not resolve back to tier ${tier}`)
  }
}

/**
 * 次フェーズ（item 154-156）: 上級のSTREAK連動重み。
 *
 * ラダー節目（上級のmilestone: 3/10/20/30/50「人間卒業」MYTHIC/100「人外認定」SECRET）を
 * 制御点に採用し、streakが伸びるほど
 *   final-memory（実質160〜180%未満、5カテゴリ中もっとも易しい）
 *   → final-mixed（180〜200%未満）
 *   → challenge500-tier1（200〜299%）
 *   → challenge500-tier2（300〜399%）
 *   → challenge500-tier3（400〜499%、1 MISSで即終了の最難関）
 * の順に重心が連続的に移る、カスケード状の重みカーブにした（各カテゴリは「立ち上がって
 * 山を描き、次のカテゴリに主役を譲って下がっていく」——final-memoryとchallenge500-tier3の
 * 両端だけが単調、中間3カテゴリは一度増えてから減る、という自然な遷移。tierが1つ進むごとに
 * 一段階難しくなる、というChallenge500本家のcheckpoint設計と同じ考え方を踏襲した）。
 * streak100超の長期streakでも最も易しいfinal-memoryを完全に0にはしない（中級と同じ、
 * 問題プールの多様性維持のための下限）。
 */
export const ADVANCED_CATEGORY_CURVE: WeightCurvePoint<EndlessAdvancedCategory>[] = [
  { streak: 1, weights: { 'final-memory': 55, 'final-mixed': 30, 'challenge500-tier1': 11, 'challenge500-tier2': 3, 'challenge500-tier3': 1 } },
  { streak: 3, weights: { 'final-memory': 48, 'final-mixed': 32, 'challenge500-tier1': 14, 'challenge500-tier2': 4, 'challenge500-tier3': 2 } },
  { streak: 10, weights: { 'final-memory': 32, 'final-mixed': 33, 'challenge500-tier1': 22, 'challenge500-tier2': 9, 'challenge500-tier3': 4 } },
  { streak: 20, weights: { 'final-memory': 22, 'final-mixed': 28, 'challenge500-tier1': 26, 'challenge500-tier2': 16, 'challenge500-tier3': 8 } },
  { streak: 30, weights: { 'final-memory': 16, 'final-mixed': 23, 'challenge500-tier1': 25, 'challenge500-tier2': 21, 'challenge500-tier3': 15 } },
  { streak: 50, weights: { 'final-memory': 11, 'final-mixed': 17, 'challenge500-tier1': 22, 'challenge500-tier2': 25, 'challenge500-tier3': 25 } },
  { streak: 100, weights: { 'final-memory': 8, 'final-mixed': 12, 'challenge500-tier1': 16, 'challenge500-tier2': 24, 'challenge500-tier3': 40 } },
]

export function advancedCategoryWeightsAtStreak(streak: number): Record<EndlessAdvancedCategory, number> {
  return interpolateWeightCurve(streak, ADVANCED_CATEGORY_CURVE)
}

/**
 * 5カテゴリのうち「どのくらい難しいか」を表すスカラー値（テスト・妥当性確認専用。
 * 出題選択ロジック自体はこの値を使わない）。streakが伸びるほど、この値で重み付けた
 * 期待値（advancedExpectedDifficultyAtStreak）が単調に増えることを検証する。
 */
export const ADVANCED_CATEGORY_DIFFICULTY_SCORE: Record<EndlessAdvancedCategory, number> = {
  'final-memory': 1,
  'final-mixed': 2,
  'challenge500-tier1': 3,
  'challenge500-tier2': 4,
  'challenge500-tier3': 5,
}

export function advancedExpectedDifficultyAtStreak(streak: number): number {
  const weights = advancedCategoryWeightsAtStreak(streak)
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0)
  return (Object.entries(weights) as [EndlessAdvancedCategory, number][]).reduce(
    (sum, [category, weight]) => sum + (weight / total) * ADVANCED_CATEGORY_DIFFICULTY_SCORE[category],
    0,
  )
}

/**
 * 直近2問が同じカテゴリだった場合は、そのカテゴリを除いた残り4カテゴリの重みから
 * weightedPickする（questionPicker.filterByCategoryStreakと同じ3連続回避の考え方。
 * 2値だった旧仕様の「強制的に逆を選ぶ」より、5カテゴリでは「そのカテゴリ以外からstreak
 * 連動の重みで選ぶ」方が、難易度の連続性を保ったまま多様性を確保できる）。
 */
export function pickEndlessAdvancedCategory(streak: number, recentCategories: EndlessAdvancedCategory[]): EndlessAdvancedCategory {
  const weights = advancedCategoryWeightsAtStreak(streak)
  if (recentCategories.length >= 2 && recentCategories[0] === recentCategories[1]) {
    const repeated = recentCategories[0]
    const rest = Object.fromEntries(Object.entries(weights).filter(([key]) => key !== repeated)) as Record<EndlessAdvancedCategory, number>
    if (Object.keys(rest).length > 0) return weightedPick(rest)
  }
  return weightedPick(weights)
}

export function endlessAdvancedCategoryToChallenge500Tier(category: EndlessAdvancedCategory): Challenge500Tier | null {
  if (category === 'challenge500-tier1') return 1
  if (category === 'challenge500-tier2') return 2
  if (category === 'challenge500-tier3') return 3
  return null
}

export function endlessAdvancedCategoryToFinalTier(category: EndlessAdvancedCategory): 'memory' | 'mixed' | null {
  if (category === 'final-memory') return 'memory'
  if (category === 'final-mixed') return 'mixed'
  return null
}
