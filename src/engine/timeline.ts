import { GAME_CONFIG } from '../config/gameConfig'
import { FIRST_CRASH_MESSAGES, TAUNT_MESSAGES } from '../config/messages'
import * as templates from './eventTemplates'
import { pick, pickExcluding, randFloat, weightedPick } from './random'
import type { GameStep } from '../types'

type MidPhaseKind = keyof typeof GAME_CONFIG.midPhaseWeights

/** 進行度（0〜1）から、上昇系イベントの基準値（amplitude）を計算する */
function computeAmplitude(progress: number): number {
  const { startPoint, amplitudeCap } = GAME_CONFIG
  return startPoint + Math.min(1, progress) * (amplitudeCap - startPoint)
}

function runMidPhaseEvent(kind: MidPhaseKind, current: number, amplitude: number): GameStep[] {
  switch (kind) {
    case 'riseNormal':
      return templates.riseNormal(current, amplitude)
    case 'riseBig':
      return templates.riseBig(current, amplitude)
    case 'crash':
      return templates.crash(current, false)
    case 'crashSlow':
      return templates.crashSlow(current)
    case 'plateau':
      return templates.plateau(current)
    case 'crashRecover':
      return templates.crashRecover(current, amplitude)
    case 'fakePeak':
      return templates.fakePeak(current, amplitude)
    case 'inflation':
      return templates.inflation(current, amplitude)
    case 'fakeBonus':
      return templates.fakeBonus(current)
    case 'mysteryCountdown':
      return templates.mysteryCountdown(current)
    case 'flatBonus':
      return templates.flatBonus(current, amplitude)
    default:
      return templates.riseNormal(current, amplitude)
  }
}

/**
 * 1プレイぶんのポイント推移タイムラインを生成する。
 * 序盤は上昇のみ→中盤で必ず初めての暴落→その後はランダムイベントの組み合わせ→
 * 終盤は大きな上振れ/下振れが起きやすくなる、という構成（仕様書14章）。
 */
export function generateTimeline(): GameStep[] {
  const { maxDurationMs, firstCrashWindow, latePhaseStart, startPoint } = GAME_CONFIG
  const steps: GameStep[] = []
  let point = startPoint
  let elapsed = 0
  let firstCrashDone = false
  let hasTriggeredClimax = false

  const firstCrashAt = randFloat(firstCrashWindow[0], firstCrashWindow[1]) * maxDurationMs

  while (elapsed < maxDurationMs) {
    const progress = elapsed / maxDurationMs
    const amplitude = computeAmplitude(progress)
    let segment: GameStep[]

    if (progress < GAME_CONFIG.earlyPhaseEnd) {
      // 序盤：素直に上がっていくだけにして「待てば増える」と錯覚させる
      segment = templates.riseNormal(point, amplitude)
    } else if (!firstCrashDone && elapsed >= firstCrashAt) {
      segment = templates.crash(point, true)
      segment[0].message = pick(FIRST_CRASH_MESSAGES)
      firstCrashDone = true
    } else if (progress >= latePhaseStart && !hasTriggeredClimax) {
      // 終盤：一度だけ大勝負イベントを起こしやすくする
      hasTriggeredClimax = true
      if (Math.random() < GAME_CONFIG.climaxEventChance) {
        segment =
          Math.random() < GAME_CONFIG.climaxUpChance
            ? templates.inflation(point, amplitude)
            : templates.crash(point, false)
      } else {
        const kind = weightedPick(GAME_CONFIG.midPhaseWeights)
        segment = runMidPhaseEvent(kind, point, amplitude)
      }
    } else {
      const kind = weightedPick(GAME_CONFIG.midPhaseWeights)
      segment = runMidPhaseEvent(kind, point, amplitude)
    }

    for (const step of segment) {
      steps.push(step)
      point = step.point
      elapsed += step.duration
    }
  }

  return injectTaunts(steps)
}

/** メッセージが設定されていないステップに、確率であおりメッセージを差し込む */
function injectTaunts(steps: GameStep[]): GameStep[] {
  let lastMessage: string | undefined
  return steps.map((step) => {
    if (step.message) {
      lastMessage = step.message
      return step
    }
    if (Math.random() < GAME_CONFIG.tauntChancePerStep) {
      const message = pickExcluding(TAUNT_MESSAGES, lastMessage)
      lastMessage = message
      return { ...step, message }
    }
    lastMessage = undefined
    return step
  })
}
