import { TIMING_SAFETY } from '../config/timingConfig'
import { QUESTION_MODULES } from '../questions'
import { pickExcluding } from './random'
import type { DifficultyPhase } from '../config/difficultyConfig'
import type { QuestionSpec, QuestionTypeId } from '../types'

let counter = 0

export function generateNextQuestion(phase: DifficultyPhase, lastType: QuestionTypeId | null): QuestionSpec {
  const type = pickExcluding(phase.pool, lastType ?? undefined)
  const module = QUESTION_MODULES[type]
  const data = module.generate()

  const scaledBase = module.baseTargetTimeMs * phase.speedMultiplier
  const minRequired = Math.max(TIMING_SAFETY.absoluteFloorMs, module.computeMinTargetTimeMs?.(data) ?? 0)
  const targetTimeMs = Math.round(Math.max(scaledBase, minRequired))

  counter += 1
  return { instanceId: `q${counter}`, type, targetTimeMs, data }
}
