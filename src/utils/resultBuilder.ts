import { GAME_CONFIG } from '../config/gameConfig'
import { getRank } from '../config/rankConfig'
import { getResultComments, greedComment, NEAR_BEST_COMMENT } from '../config/messages'
import { pick } from '../engine/random'
import { getBestPoint, updateBestPoint } from './storage'
import type { GameResult } from '../types'

export function computeDopagakiPercent(point: number): number {
  const { dopagakiPercentCap, dopagakiPercentMin, dopagakiPercentMax } = GAME_CONFIG
  const ratio = Math.min(1, point / dopagakiPercentCap)
  const percent = Math.round(100 * (1 - ratio))
  return Math.min(dopagakiPercentMax, Math.max(dopagakiPercentMin, percent))
}

export function buildGreedComment(finalPoint: number, maxPoint: number): string {
  const gap = maxPoint - finalPoint
  const { greedRatioThreshold, greedPointThreshold } = GAME_CONFIG
  const isGreedy = gap >= greedPointThreshold && gap / Math.max(1, maxPoint) >= greedRatioThreshold
  return isGreedy ? greedComment(gap) : NEAR_BEST_COMMENT
}

export function buildGameResult(finalPoint: number, maxPoint: number, isAuto: boolean): GameResult {
  const bestBefore = getBestPoint()
  const isNewBest = updateBestPoint(finalPoint)
  const rank = getRank(finalPoint)
  const dopagakiPercent = computeDopagakiPercent(finalPoint)
  const comment = pick(getResultComments(rank.tier))
  const greed = buildGreedComment(finalPoint, maxPoint)

  return {
    finalPoint,
    maxPoint,
    rank,
    dopagakiPercent,
    isAuto,
    isNewBest,
    bestPoint: isNewBest ? finalPoint : bestBefore,
    comment,
    greedComment: greed,
  }
}
