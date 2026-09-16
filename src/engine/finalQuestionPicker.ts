import { FINAL_QUESTION_POOLS } from '../questions/final'
import { pick } from './random'
import type { FinalPoolTier, FinalQuestionSpec, FinalQuestionTag } from '../types'

let counter = 0

/**
 * Ver.5.0: FINAL DOPA TRIALのanti-clustering。同一typeの連続を禁止し、
 * 可能なら直前問題とタグが1つも重ならない候補を優先する（同じ認知カテゴリの連続も避ける）。
 * どちらのフィルタも候補が尽きたら緩めて元のプールへフォールバックする
 * （tier内のモジュール数が少ない場合でも出題不能にならないようにする）。
 */
export function pickFinalQuestion(tier: FinalPoolTier, recentTypes: string[], recentTags: FinalQuestionTag[]): FinalQuestionSpec {
  const pool = FINAL_QUESTION_POOLS[tier]
  const lastType = recentTypes[0]

  let candidates = lastType ? pool.filter((m) => m.id !== lastType) : pool
  if (candidates.length === 0) candidates = pool

  if (recentTags.length > 0) {
    const tagFiltered = candidates.filter((m) => !m.tags.some((t) => recentTags.includes(t)))
    if (tagFiltered.length > 0) candidates = tagFiltered
  }

  const module = pick(candidates)
  const data = module.generate()
  const targetTimeMs = module.computeTargetTimeMs(data)

  counter += 1
  return { instanceId: `final-${counter}`, type: module.id, tags: module.tags, targetTimeMs, data }
}
