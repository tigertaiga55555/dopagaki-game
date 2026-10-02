import { NumberPickEndlessModule } from './NumberPickQuestion'
import { ShapeCountPickEndlessModule } from './ShapeCountPickQuestion'
import { SwipeDirectionEndlessModule } from './SwipeDirectionQuestion'
import type { EndlessQuestionModule, EndlessQuestionSpec, EndlessTier } from './types'

export const ENDLESS_QUESTION_MODULES: EndlessQuestionModule[] = [
  NumberPickEndlessModule,
  ShapeCountPickEndlessModule,
  SwipeDirectionEndlessModule,
]

/** スワイプの性質上、1回のジェスチャーで完結するtier1専用（tier2/3の複合反転には使わない）。 */
const TIER1_ONLY = new Set([SwipeDirectionEndlessModule.id])

export function eligibleModulesForTier(tier: EndlessTier): EndlessQuestionModule[] {
  if (tier === 1) return ENDLESS_QUESTION_MODULES
  return ENDLESS_QUESTION_MODULES.filter((m) => !TIER1_ONLY.has(m.id))
}

/** 200〜299%=tier1（1箇所反転）、300〜399%=tier2（2箇所反転）、400%以上=tier3（通常条件＋反転）。 */
export function tierForPercent(percent: number): EndlessTier {
  if (percent < 300) return 1
  if (percent < 400) return 2
  return 3
}

/** 直前と同じ問題タイプが連続しないようにする（既存のquestionPicker/finalQuestionPickerと同じ考え方）。 */
export function pickEndlessQuestion(percent: number, recentType: string | null): EndlessQuestionSpec {
  const tier = tierForPercent(percent)
  const candidates = eligibleModulesForTier(tier)
  const pool = candidates.length > 1 ? candidates.filter((m) => m.id !== recentType) : candidates
  const module = pool[Math.floor(Math.random() * pool.length)]
  return {
    instanceId: `endless-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: module.id,
    data: module.generate(tier),
  }
}
