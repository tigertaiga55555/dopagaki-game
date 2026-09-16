import { TIMING_SAFETY } from '../config/timingConfig'
import { QUESTION_MODULES } from '../questions'
import { pick, pickExcluding } from './random'
import type { DifficultyPhase } from '../config/difficultyConfig'
import type { QuestionSpec, QuestionTypeId } from '../types'

let counter = 0

/**
 * 直近2問と同じカテゴリが3連続にならないよう、候補プールから該当カテゴリを除外する。
 * 除外した結果プールが空になる場合は元のプールをそのまま使う（フェーズのプールが
 * 単一カテゴリしかない序盤などで出題不能になるのを防ぐ）。
 */
function filterByCategoryStreak(pool: QuestionTypeId[], recentTypes: QuestionTypeId[]): QuestionTypeId[] {
  if (recentTypes.length < 2) return pool
  const [prev1, prev2] = recentTypes
  const cat1 = QUESTION_MODULES[prev1].category
  const cat2 = QUESTION_MODULES[prev2].category
  if (cat1 !== cat2) return pool
  const filtered = pool.filter((type) => QUESTION_MODULES[type].category !== cat1)
  return filtered.length > 0 ? filtered : pool
}

/**
 * Ver.4.5: 直前1問だけでなく、直近数問のタイプもゆるく避ける（完全禁止ではなく、
 * 候補が尽きたら通常のプールへフォールバックする程度の抑制）。単調な繰り返しを防ぐのが目的。
 */
function filterByRecentTypes(pool: QuestionTypeId[], recentTypes: QuestionTypeId[]): QuestionTypeId[] {
  if (recentTypes.length === 0) return pool
  const recentSet = new Set(recentTypes)
  const filtered = pool.filter((t) => !recentSet.has(t))
  return filtered.length > 0 ? filtered : pool
}

/**
 * Ver.4.8: phase.weightedTypesに挙げられたタイプをプール内で複製し、抽選での出現率を上げる。
 * 個々の問題のtargetTimeMs（人間の最低時間保証）には一切影響しない、出現頻度だけの重み付け。
 */
function applyWeighting(pool: QuestionTypeId[], weightedTypes?: Partial<Record<QuestionTypeId, number>>): QuestionTypeId[] {
  if (!weightedTypes) return pool
  const weighted: QuestionTypeId[] = []
  for (const type of pool) {
    const weight = weightedTypes[type] ?? 1
    for (let i = 0; i < weight; i++) weighted.push(type)
  }
  return weighted
}

export function generateNextQuestion(phase: DifficultyPhase, recentTypes: QuestionTypeId[]): QuestionSpec {
  const lastType = recentTypes[0]
  const weightedPool = applyWeighting(phase.pool, phase.weightedTypes)
  const candidatePool = filterByRecentTypes(weightedPool, recentTypes)
  const finalPool = filterByCategoryStreak(candidatePool, recentTypes)

  const type = finalPool.length > 0 ? pick(finalPool) : pickExcluding(phase.pool, lastType)
  const module = QUESTION_MODULES[type]
  const data = module.generate()

  const scaledBase = module.baseTargetTimeMs * phase.speedMultiplier
  const minRequired = Math.max(TIMING_SAFETY.absoluteFloorMs, module.computeMinTargetTimeMs?.(data) ?? 0)
  const targetTimeMs = Math.round(Math.max(scaledBase, minRequired))

  counter += 1
  return { instanceId: `q${counter}`, type, targetTimeMs, data }
}
