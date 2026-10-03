import { tierForPercent } from '../../config/challenge500Config'
import { ExcludePickChallenge500Module } from './ExcludePickQuestion'
import { InsideOutsideCountPickChallenge500Module } from './InsideOutsideCountPickQuestion'
import { LengthPickChallenge500Module } from './LengthPickQuestion'
import { NumberPickChallenge500Module } from './NumberPickQuestion'
import { PositionPickChallenge500Module } from './PositionPickQuestion'
import { RpsCompoundChallenge500Module } from './RpsCompoundQuestion'
import { SecondRankPickChallenge500Module } from './SecondRankPickQuestion'
import { ShapeCountPickChallenge500Module } from './ShapeCountPickQuestion'
import { SwipeDirectionChallenge500Module } from './SwipeDirectionQuestion'
import type { Challenge500QuestionModule, Challenge500QuestionSpec, Challenge500Tier } from './types'

export { tierForPercent }

export const CHALLENGE500_QUESTION_MODULES: Challenge500QuestionModule[] = [
  NumberPickChallenge500Module,
  ShapeCountPickChallenge500Module,
  SwipeDirectionChallenge500Module,
  PositionPickChallenge500Module,
  InsideOutsideCountPickChallenge500Module,
  LengthPickChallenge500Module,
  ExcludePickChallenge500Module,
  SecondRankPickChallenge500Module,
  RpsCompoundChallenge500Module,
]

/** スワイプの性質上、1回のジェスチャーで完結するtier1専用（tier2/3の複合反転には使わない）。 */
const TIER1_ONLY = new Set([SwipeDirectionChallenge500Module.id])

export function eligibleModulesForTier(tier: Challenge500Tier): Challenge500QuestionModule[] {
  if (tier === 1) return CHALLENGE500_QUESTION_MODULES
  return CHALLENGE500_QUESTION_MODULES.filter((m) => !TIER1_ONLY.has(m.id))
}

/** 直前と同じ問題タイプが連続しないようにする（既存のquestionPicker/finalQuestionPickerと同じ考え方）。 */
export function pickChallenge500Question(percent: number, recentType: string | null): Challenge500QuestionSpec {
  const tier = tierForPercent(percent)
  const candidates = eligibleModulesForTier(tier)
  const pool = candidates.length > 1 ? candidates.filter((m) => m.id !== recentType) : candidates
  const module = pool[Math.floor(Math.random() * pool.length)]
  return {
    instanceId: `challenge500-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: module.id,
    data: module.generate(tier),
  }
}
