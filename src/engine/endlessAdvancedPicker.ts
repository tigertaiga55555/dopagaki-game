import { FINAL_QUESTION_POOLS } from '../questions/final'
import { CHALLENGE500_QUESTION_MODULES } from '../questions/challenge500'
import { tierForPercent } from '../config/challenge500Config'
import { weightedPick } from './random'
import type { Challenge500Tier } from '../questions/challenge500/types'

/**
 * Ver.6 Phase 4.2: Endless上級（120〜500%相当の「全部乗せ」）が、1問ごとに
 * FINAL DOPA TRIAL系とChallenge500（200〜500% LIMIT BREAK）系のどちらから出題するかを
 * 決める、純粋ロジック（Reactに依存しないためvitestで直接検証できる）。
 */
export type EndlessAdvancedOrigin = 'final' | 'challenge500'

const FINAL_MODULE_COUNT = Object.values(FINAL_QUESTION_POOLS).reduce((sum, pool) => sum + pool.length, 0)
const CHALLENGE500_MODULE_COUNT = CHALLENGE500_QUESTION_MODULES.length

/**
 * 出題元の重み＝既存の問題モジュール数そのもの（FINAL DOPA TRIAL 38種 vs Challenge500 11種、
 * 2026-11時点）。「新しい恣意的な比率を作らない」ため、ユーザー指示の単純50:50固定も避けつつ、
 * 既に実装済みの問題プールの規模を唯一の根拠にする。プール数が将来変わってもこの重みは
 * 自動的に追従する（ハードコードした比率ではなく、インポートした配列から都度計算するため）。
 */
export const ENDLESS_ADVANCED_ORIGIN_WEIGHTS: Record<EndlessAdvancedOrigin, number> = {
  final: FINAL_MODULE_COUNT,
  challenge500: CHALLENGE500_MODULE_COUNT,
}

/**
 * Challenge500系を抽選した際、どのtier（1/2/3）の問題プール・反転比率
 * （CHALLENGE500_INVERSION_WEIGHTS）を使うかを表す代表％。Endlessの連続正解数で
 * DOPA%を進行させるわけではない（ユーザー指示どおり、Endless内でDOPA%は一切存在しない）ため、
 * 1問ごとに3tierから均等にランダム選択する。tier1のみ反転「2」が出ない
 * （CHALLENGE500_CONFIG.CHALLENGE500_INVERSION_WEIGHTS参照）ため、tier2/3を含めて
 * 均等に回すことで0/1/2反転と全11タイプを実際に全て出現させる。
 */
export const CHALLENGE500_ENDLESS_TIERS: Challenge500Tier[] = [1, 2, 3]
export const CHALLENGE500_TIER_REPRESENTATIVE_PERCENT: Record<Challenge500Tier, number> = {
  1: 250,
  2: 350,
  3: 450,
}

// 代表％が意図したtierへ実際に解決されることを起動時に前提として保証しておく（テストでも確認する）。
for (const tier of CHALLENGE500_ENDLESS_TIERS) {
  if (tierForPercent(CHALLENGE500_TIER_REPRESENTATIVE_PERCENT[tier]) !== tier) {
    throw new Error(`endlessAdvancedPicker: representative percent for tier ${tier} does not resolve back to tier ${tier}`)
  }
}

/**
 * 直近2問が同じ出題元だった場合は、questionPicker.filterByCategoryStreakと同じ考え方で
 * 3連続を避ける（候補が1つしかない場合も強制的にもう一方へ切り替える、既存パターンの踏襲）。
 * それ以外は既存の問題数ベースの重みでweightedPickする。
 */
export function pickEndlessAdvancedOrigin(recentOrigins: EndlessAdvancedOrigin[]): EndlessAdvancedOrigin {
  if (recentOrigins.length >= 2 && recentOrigins[0] === recentOrigins[1]) {
    return recentOrigins[0] === 'final' ? 'challenge500' : 'final'
  }
  return weightedPick(ENDLESS_ADVANCED_ORIGIN_WEIGHTS)
}
