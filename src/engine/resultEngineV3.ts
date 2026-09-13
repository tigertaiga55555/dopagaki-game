import { CATEGORY_TYPES, HERMIT_TYPE, RATIONAL_TYPE, getResultComments } from '../config/messagesV3'
import { pick } from './random'
import {
  getFirstDopagaki,
  getLowestDopagaki,
  getBestGameScore,
  getPlayCount,
  incrementPlayCount,
  saveFirstDopagakiIfAbsent,
  updateBestGameScore,
  updateLowestDopagaki,
} from '../utils/storage'
import type { DiagnosticCategory, DiagnosticOutcome, FinalResult } from '../types'

function computeCategoryAverages(diagnostics: DiagnosticOutcome[]): Partial<Record<DiagnosticCategory, number>> {
  const sums = new Map<DiagnosticCategory, { total: number; weight: number }>()
  for (const d of diagnostics) {
    const weight = d.weight ?? 1
    const entry = sums.get(d.category) ?? { total: 0, weight: 0 }
    entry.total += d.score * weight
    entry.weight += weight
    sums.set(d.category, entry)
  }
  const averages: Partial<Record<DiagnosticCategory, number>> = {}
  for (const [category, { total, weight }] of sums) {
    if (weight > 0) averages[category] = total / weight
  }
  return averages
}

function determinePercent(diagnostics: DiagnosticOutcome[]): number {
  if (diagnostics.length === 0) return 0
  let totalWeight = 0
  let weightedSum = 0
  for (const d of diagnostics) {
    const weight = d.weight ?? 1
    weightedSum += d.score * weight
    totalWeight += weight
  }
  return Math.round(weightedSum / totalWeight)
}

function determineType(percent: number, categoryAverages: Partial<Record<DiagnosticCategory, number>>) {
  if (percent <= 15) return HERMIT_TYPE
  if (percent <= 30) return RATIONAL_TYPE

  let topCategory: DiagnosticCategory | null = null
  let topScore = -Infinity
  for (const [category, score] of Object.entries(categoryAverages) as [DiagnosticCategory, number][]) {
    if (score > topScore) {
      topScore = score
      topCategory = category
    }
  }
  return topCategory ? CATEGORY_TYPES[topCategory] : RATIONAL_TYPE
}

/**
 * GAME SCOREの合計とドパガキ診断結果一式から、最終結果を組み立てる。
 * GAME SCOREはドパガキ度の計算に一切含めない（表スコアと診断スコアの完全分離）。
 */
export function computeFinalResult(gameScore: number, diagnostics: DiagnosticOutcome[]): FinalResult {
  const percent = determinePercent(diagnostics)
  const categoryAverages = computeCategoryAverages(diagnostics)
  const type = determineType(percent, categoryAverages)
  const crimeRecords = diagnostics
    .filter((d) => d.crimeText)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((d) => d.crimeText!)
  const comment = pick(getResultComments(percent))

  const isFirstPlay = getPlayCount() === 0
  const firstDopagakiBefore = getFirstDopagaki()
  const lowestBefore = getLowestDopagaki()
  const bestScoreBefore = getBestGameScore()

  const isNewLowDopagaki = updateLowestDopagaki(percent)
  const isNewHighScore = updateBestGameScore(gameScore)
  saveFirstDopagakiIfAbsent(percent)
  incrementPlayCount()

  return {
    gameScore,
    dopagakiPercent: percent,
    type,
    comment,
    crimeRecords,
    isFirstPlay,
    isNewLowDopagaki,
    isNewHighScore,
    firstDopagaki: firstDopagakiBefore ?? percent,
    lowestDopagaki: isNewLowDopagaki ? percent : lowestBefore,
    bestGameScore: isNewHighScore ? gameScore : bestScoreBefore,
    playCount: getPlayCount(),
  }
}
