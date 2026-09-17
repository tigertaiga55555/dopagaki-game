import { getNearMissComment } from '../config/messagesV4'
import { NORMAL_TYPES, TYPE_THRESHOLDS, getOverdriveTitle } from '../config/resultTypesV4'
import { getBestPercent, getPlayCount, incrementPlayCount, updateBestPercent } from '../utils/storage'
import type { RushFinishPayload } from './useRushGame'
import type { FinalTrialFinishPayload } from './useFinalTrial'
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
  'goWait',
  'skipWait',
  'spotChange',
  'clearNotifications',
  'sequenceTap',
  'findTarget',
  'flashSpot',
  'colorWord',
  'notifRush',
])

function computeSpeedStats(stats: PlayStats): { avgRatio: number; avgMs: number; count: number } {
  const samples = stats.reactionSamples.filter((s) => SPEED_TYPES.has(s.type))
  if (samples.length === 0) return { avgRatio: 1, avgMs: Infinity, count: 0 }
  const avgRatio = samples.reduce((sum, s) => sum + s.reactionMs / s.targetTimeMs, 0) / samples.length
  const avgMs = samples.reduce((sum, s) => sum + s.reactionMs, 0) / samples.length
  return { avgRatio, avgMs, count: samples.length }
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
  const { avgRatio, avgMs, count } = computeSpeedStats(stats)
  const repeatTapAcc = typeAccuracy(stats, 'repeatTap')
  const repeatTapCount = stats.typeStats.repeatTap?.total ?? 0
  const swipeAcc = typeAccuracy(stats, 'swipe')
  const swipeCount = stats.typeStats.swipe?.total ?? 0
  const noPressFailRate = stats.noPressTotal > 0 ? stats.noPressFails / stats.noPressTotal : 0

  // 待てない型: 「押すな」を実際に何度も押した、またはGO/SKIPのフライングや指定回数オーバーが
  // 積み重なった場合。最も納得感のある判定なので最優先。
  const impulseEvents = stats.earlyPressCount + stats.overPressCount
  if (
    (stats.noPressTotal >= TYPE_THRESHOLDS.impatient.minNoPressTotal && noPressFailRate >= TYPE_THRESHOLDS.impatient.minFailRate) ||
    impulseEvents >= TYPE_THRESHOLDS.impatient.minImpulseEvents
  ) {
    return NORMAL_TYPES.impatient
  }
  // 刺激処理マシーン: サンプル数が十分な上で正答率・速度の両方が突出している場合のみ。
  if (
    count >= TYPE_THRESHOLDS.minSamplesForSpecialType &&
    accuracy >= TYPE_THRESHOLDS.machine.minAccuracy &&
    avgRatio <= TYPE_THRESHOLDS.machine.maxAvgRatio
  ) {
    return NORMAL_TYPES.machine
  }
  // 連打中毒型 / 高速フリック型: そのタイプの出題を複数回こなし、かつ高精度だった場合のみ。
  if (
    repeatTapCount >= TYPE_THRESHOLDS.repeatTap.minSamples &&
    repeatTapAcc !== null &&
    repeatTapAcc >= TYPE_THRESHOLDS.repeatTap.minAccuracy &&
    repeatTapAcc >= (swipeAcc ?? 0)
  ) {
    return NORMAL_TYPES.repeatTap
  }
  if (swipeCount >= TYPE_THRESHOLDS.swipe.minSamples && swipeAcc !== null && swipeAcc >= TYPE_THRESHOLDS.swipe.minAccuracy) {
    return NORMAL_TYPES.swipe
  }
  // 脳直高速処理型: 比率・絶対反応時間(ms)・正答率・サンプル数の4条件すべてを満たす場合のみ。
  if (
    count >= TYPE_THRESHOLDS.minSamplesForSpecialType &&
    avgRatio <= TYPE_THRESHOLDS.speed.maxAvgRatio &&
    avgMs <= TYPE_THRESHOLDS.speed.maxAvgReactionMs &&
    accuracy >= TYPE_THRESHOLDS.speed.minAccuracy
  ) {
    return NORMAL_TYPES.speed
  }
  if (finalPercent < TYPE_THRESHOLDS.noviceMaxPercent) return NORMAL_TYPES.novice
  return NORMAL_TYPES.balanced
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
  if (stats.earlyPressCount > 0) {
    candidates.push({ text: `GOやSKIPを待てずに${stats.earlyPressCount}回フライングしました`, weight: 55 + stats.earlyPressCount * 6 })
  }
  if (stats.overPressCount > 0) {
    candidates.push({ text: `指定回数を${stats.overPressCount}回オーバーして押しました`, weight: 50 + stats.overPressCount * 5 })
  }
  if (stats.stopAt100Samples.length > 0) {
    const worst = stats.stopAt100Samples.reduce((a, b) => (b.diff > a.diff ? b : a))
    if (worst.diff > 0) candidates.push({ text: `100で止めろ→${worst.stopped}で停止しました`, weight: 30 + worst.diff })
  }
  if (stats.notificationClearSamples.length > 0) {
    const fastest = stats.notificationClearSamples.reduce((a, b) => (b.ms < a.ms ? b : a))
    candidates.push({ text: `赤い通知${fastest.count}個を${(fastest.ms / 1000).toFixed(2)}秒で全消し`, weight: 25 })
  }
  if (stats.sequenceTapSamples.length > 0) {
    const fastest = stats.sequenceTapSamples.reduce((a, b) => (b.ms < a.ms ? b : a))
    candidates.push({ text: `1→4を${(fastest.ms / 1000).toFixed(2)}秒で処理`, weight: 25 })
  }
  if (stats.findTargetSamples.length > 0) {
    const fastest = stats.findTargetSamples.reduce((a, b) => (b.ms < a.ms ? b : a))
    candidates.push({ text: `${fastest.icon}を${(fastest.ms / 1000).toFixed(2)}秒で発見`, weight: 25 })
  }
  if (stats.releaseZoneOverMs.length > 0) {
    const worst = Math.max(...stats.releaseZoneOverMs)
    candidates.push({ text: `緑ゾーンを${worst}msオーバー`, weight: 25 })
  }
  if (stats.shortVideoSamples.length > 0) {
    const fastest = stats.shortVideoSamples.reduce((a, b) => (b.ms < a.ms ? b : a))
    candidates.push({ text: `ショート動画3本を${(fastest.ms / 1000).toFixed(2)}秒でスキップ`, weight: 25 })
  }
  if (stats.colorWordFooledCount > 0) {
    candidates.push({ text: `文字の色に${stats.colorWordFooledCount}回騙されました`, weight: 45 + stats.colorWordFooledCount * 6 })
  }
  if (stats.notifRushSamples.length > 0) {
    const fastest = stats.notifRushSamples.reduce((a, b) => (b.ms < a.ms ? b : a))
    candidates.push({ text: `通知${fastest.count}個を${(fastest.ms / 1000).toFixed(2)}秒で全消し`, weight: 25 })
  }
  if (stats.rapidStopRedTaps > 0) {
    candidates.push({ text: `STOP中に${stats.rapidStopRedTaps}回押しました`, weight: 55 + stats.rapidStopRedTaps * 6 })
  }

  candidates.sort((a, b) => b.weight - a.weight)
  return candidates.slice(0, 2).map((c) => c.text)
}

function buildComment(percent: number): string {
  const nearMiss = getNearMissComment(percent)
  if (nearMiss) return nearMiss
  if (percent > 100) return '見てはいけないものを\n見た気がする。'
  if (percent >= 100) return '本当に100％とった……？'
  if (percent >= 90) return 'かなり刺激に強い。'
  if (percent >= 75) return 'なかなかのドパガキ度。'
  if (percent >= 50) return 'まずまずの滑り出し。'
  return 'まだ本気を出していないはず。'
}

/**
 * Ver.5.0: FINAL DOPA TRIAL専用のコメント。120は「途中失敗」ではなく「これから挑む」トリガー値のため、trialsCleared=0（Q1で即MISS）でも「挑んだ」ことを称える文にする。
 * 結果画面追加修正: ResultCard側でwhitespace-pre-lineを効かせているため、CSSの機械的な
 * 自動折返し任せにせず、助詞・句読点が行頭に来ない・括弧が単独行にならない自然な位置へ
 * 改行を明示的に埋め込む（実機390px幅で確認済み）。
 */
function buildFinalTrialComment(trialsCleared: number, cleared200: boolean): string {
  if (cleared200) return '一度もミスなく、\n完全にゲームを攻略した。'
  if (trialsCleared === 0) return 'FINAL DOPA TRIALの\n扉を開けた、\nその先で力尽きた。'
  return `FINAL DOPA TRIAL\n${trialsCleared} / 16 まで到達し、\nそこで力尽きた。`
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

/**
 * Ver.5.0: FINAL DOPA TRIAL（120%到達後）の結果を計算する。通常のcomputeFinalResult()とは
 * スコア域が完全に別（120〜200、rawScore式は使わない）なため専用関数として分離する。
 * statsは120%到達までにcomputeFinalResult側と同じPlayStatsを引き継いで使う
 * （犯行記録・最大COMBO・最速反応・正答率は通常プレイぶんの実績をそのまま表示する）。
 */
export function computeFinalTrialResult(payload: FinalTrialFinishPayload, stats: PlayStats): FinalResultV4 {
  const { finalPercent, trialsCleared, cleared200 } = payload
  const type = getOverdriveTitle(finalPercent)
  const crimeRecords = buildCrimeRecords(stats)
  const comment = buildFinalTrialComment(trialsCleared, cleared200)

  const isFirstPlay = getPlayCount() === 0
  const bestBefore = getBestPercent()
  const isNewBest = updateBestPercent(finalPercent)
  incrementPlayCount()

  return {
    percent: finalPercent,
    rawPercent: finalPercent,
    overdriveActive: true,
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
    finalTrial: { trialsCleared, cleared200 },
  }
}
