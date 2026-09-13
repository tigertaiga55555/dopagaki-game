import { CATEGORY_TYPES, HERMIT_TYPE, RATIONAL_TYPE, getResultComments } from '../config/messagesV2'
import { pick } from './random'
import {
  getBestLowPercent,
  getPlayCount,
  incrementPlayCount,
  saveFirstPercentIfAbsent,
  updateBestLowPercent,
} from '../utils/storage'
import type { DopagakiResult, EventCategory, EventOutcome } from '../types'

/** プレイ中に登場したカテゴリーごとの平均スコアを計算する */
function computeCategoryAverages(outcomes: EventOutcome[]): Partial<Record<EventCategory, number>> {
  const sums = new Map<EventCategory, { total: number; count: number }>()
  for (const outcome of outcomes) {
    const entry = sums.get(outcome.category) ?? { total: 0, count: 0 }
    entry.total += outcome.score
    entry.count += 1
    sums.set(outcome.category, entry)
  }
  const averages: Partial<Record<EventCategory, number>> = {}
  for (const [category, { total, count }] of sums) {
    averages[category] = total / count
  }
  return averages
}

function determineType(percent: number, categoryAverages: Partial<Record<EventCategory, number>>) {
  if (percent <= 15) return HERMIT_TYPE
  if (percent <= 34) return RATIONAL_TYPE

  let topCategory: EventCategory | null = null
  let topScore = -Infinity
  for (const [category, score] of Object.entries(categoryAverages) as [EventCategory, number][]) {
    if (score > topScore) {
      topScore = score
      topCategory = category
    }
  }
  return topCategory ? CATEGORY_TYPES[topCategory] : RATIONAL_TYPE
}

/**
 * イベントの測定結果一式から最終的なドパガキ度・タイプ・犯行記録を組み立てる。
 * ランダムな加点は一切行わず、同じ行動なら同じ評価になるようにする。
 */
export function computeDopagakiResult(outcomes: EventOutcome[]): DopagakiResult {
  const percent = Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length)
  const categoryAverages = computeCategoryAverages(outcomes)
  const type = determineType(percent, categoryAverages)
  const crimeRecords = outcomes
    .filter((o) => o.crimeText)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((o) => o.crimeText!)
  const comment = pick(getResultComments(percent))

  const isFirstPlay = getPlayCount() === 0
  const bestLowBefore = getBestLowPercent()
  const isNewLow = updateBestLowPercent(percent)
  saveFirstPercentIfAbsent(percent)
  incrementPlayCount()

  return {
    percent,
    type,
    comment,
    crimeRecords,
    categoryAverages,
    isFirstPlay,
    isNewLow,
    bestLowPercent: isNewLow ? percent : bestLowBefore,
    playCount: getPlayCount(),
  }
}
