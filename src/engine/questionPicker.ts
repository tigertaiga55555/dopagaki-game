import { QUESTION_MODULES } from '../questions'
import { pickExcluding } from './random'
import type { DifficultyPhase } from '../config/difficultyConfig'
import type { QuestionSpec, QuestionTypeId } from '../types'

let counter = 0

export function generateNextQuestion(phase: DifficultyPhase, lastType: QuestionTypeId | null): QuestionSpec {
  const type = pickExcluding(phase.pool, lastType ?? undefined)
  const module = QUESTION_MODULES[type]
  const targetTimeMs = Math.round(module.baseTargetTimeMs * phase.speedMultiplier)
  const data = module.generate()
  counter += 1
  return { instanceId: `q${counter}`, type, targetTimeMs, data }
}
