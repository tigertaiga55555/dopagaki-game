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

export function generateNextQuestion(phase: DifficultyPhase, recentTypes: QuestionTypeId[]): QuestionSpec {
  const lastType = recentTypes[0]
  const withoutImmediateRepeat = lastType !== undefined ? phase.pool.filter((t) => t !== lastType) : phase.pool
  const candidatePool = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : phase.pool
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
