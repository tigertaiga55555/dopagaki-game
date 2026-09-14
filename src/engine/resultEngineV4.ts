import { getNearMissComment } from '../config/messagesV4'
import { NORMAL_TYPES, getOverdriveTitle } from '../config/resultTypesV4'
import { getBestPercent, getPlayCount, incrementPlayCount, updateBestPercent } from '../utils/storage'
import type { RushFinishPayload } from './useRushGame'
import type { DopagakiTypeDef, FinalResultV4, PlayStats, QuestionTypeId } from '../types'

const SPEED_TYPES = new Set<QuestionTypeId>([
  'color',
  'oddOneOut',
  'maxNumber',
  'minNumber',
  'differentOne',
  'sameOne',
  'moreSide',
  'biggerShape',
  'simpleMath',
])

function computeSpeedRatio(stats: PlayStats): number {
  const samples = stats.reactionSamples.filter((s) => SPEED_TYPES.has(s.type))
  if (samples.length === 0) return 1
  return samples.reduce((sum, s) => sum + s.reactionMs / s.targetTimeMs, 0) / samples.length
}

function typeAccuracy(stats: PlayStats, type: QuestionTypeId): number | null {
  const entry = stats.typeStats[type]
  if (!entry || entry.total === 0) return null
  return entry.correct / entry.total
}

function determineType(finalPercent: number, overdriveActive: boolean, stats: PlayStats): DopagakiTypeDef {
  if (overdriveActive) return getOverdriveTitle(finalPercent)
  if (finalPercent >= 100) return NORMAL_TYPES.complete

  const accuracy = stats.totalAnswered > 0 ? stats.correctCount / stats.totalAnswered : 0
  const speedRatio = computeSpeedRatio(stats)
  const repeatTapAcc = typeAccuracy(stats, 'repeatTap')
  const swipeAcc = typeAccuracy(stats, 'swipe')
  const noPressFailRate = stats.noPressTotal > 0 ? stats.noPressFails / stats.noPressTotal : 0

  if (stats.noPressTotal >= 2 && noPressFailRate >= 0.5) return NORMAL_TYPES.impatient
  if (accuracy >= 0.75 && speedRatio <= 0.5) return NORMAL_TYPES.machine
  if (repeatTapAcc !== null && repeatTapAcc >= 0.7 && (stats.typeStats.repeatTap?.total ?? 0) >= 2 && repeatTapAcc >= (swipeAcc ?? 0)) {
    return NORMAL_TYPES.repeatTap
  }
  if (swipeAcc !== null && swipeAcc >= 0.7 && (stats.typeStats.swipe?.total ?? 0) >= 2) return NORMAL_TYPES.swipe
  if (speedRatio <= 0.55) return NORMAL_TYPES.speed
  if (finalPercent < 40) return NORMAL_TYPES.novice
  return NORMAL_TYPES.speed
}

function buildCrimeRecords(stats: PlayStats): string[] {
  const candidates: { text: string; weight: number }[] = []

  if (stats.comboLostToNoPress > 0) {
    candidates.push({ text: `${stats.comboLostToNoPress}COMBOでフェイクに敗北`, weight: 90 })
  }
  if (stats.noPressTotal > 0 && stats.noPressFails > 0) {
    candidates.push({ text: `「押すな」を${stats.noPressTotal}回中${stats.noPressFails}回押しました`, weight: 70 + stats.noPressFails * 5 })
  }
  if (stats.maxTapsInOneSecond >= 4) {
    candidates.push({ text: `1秒で${stats.maxTapsInOneSecond}回タップ`, weight: 30 + stats.maxTapsInOneSecond })
  }
  if (stats.fastestReactionMs !== null) {
    candidates.push({ text: `最速反応 ${(stats.fastestReactionMs / 1000).toFixed(2)}秒`, weight: 40 })
  }
  if (stats.maxCombo >= 5) {
    candidates.push({ text: `最大COMBO ${stats.maxCombo}`, weight: 20 + stats.maxCombo })
  }

  candidates.sort((a, b) => b.weight - a.weight)
  return candidates.slice(0, 2).map((c) => c.text)
}

function buildComment(percent: number): string {
  const nearMiss = getNearMissComment(percent)
  if (nearMiss) return nearMiss
  if (percent > 100) return '見てはいけないものを見た気がする。'
  if (percent >= 100) return '本当に100％とった……？'
  if (percent >= 90) return 'かなり刺激に強い。'
  if (percent >= 75) return 'なかなかのドパガキ度。'
  if (percent >= 50) return 'まずまずの滑り出し。'
  return 'まだ本気を出していないはず。'
}

export function computeFinalResult(payload: RushFinishPayload): FinalResultV4 {
  const { finalPercent, overdriveActive, stats } = payload
  const type = determineType(finalPercent, overdriveActive, stats)
  const crimeRecords = buildCrimeRecords(stats)
  const comment = buildComment(finalPercent)

  const isFirstPlay = getPlayCount() === 0
  const bestBefore = getBestPercent()
  const isNewBest = updateBestPercent(finalPercent)
  incrementPlayCount()

  return {
    percent: finalPercent,
    rawPercent: payload.rawPercent,
    overdriveActive,
    type,
    comment,
    crimeRecords,
    maxCombo: stats.maxCombo,
    fastestReactionMs: stats.fastestReactionMs,
    accuracy: stats.totalAnswered > 0 ? stats.correctCount / stats.totalAnswered : 0,
    isFirstPlay,
    isNewBest,
    bestPercent: isNewBest ? finalPercent : bestBefore,
    playCount: getPlayCount(),
  }
}
