import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { getCurrentStageIndex } from '../engine/difficultyStage'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * Ver.4.5: 「連打→急停止」を独立した「信号連打」ゲームへ再設計。
 * 緑（連打してよい）→赤（止まれ）→緑→赤、の固定4フェーズ（3回切替）で構成する。
 * 数学的に「緑始まり・赤終わり」を保証するには切替回数が奇数である必要があるため、
 * 指示書の「2〜4回程度」の中で唯一きれいに収まる3回切替（4フェーズ）に固定した。
 * 赤フェーズ中は1回でもタップしたら即MISS。最後の赤フェーズを最後まで
 * 静かに待てて、かつ緑フェーズで十分に連打できていた場合のみ成功になる。
 */

/** 緑フェーズで最低限必要な合計タップ数（連打していないのに成功、を防ぐ） */
const MIN_TOTAL_TAPS = 4
/** タップ間隔の評価基準（この間隔以下ならPERFECT級） */
const REFERENCE_INTERVAL_MS = 220

type Phase = { color: 'green' | 'red'; durationMs: number }

/** ゲーム進行度が進むほど、フェーズ長をわずかに短縮する（0=序盤そのまま、1=終盤で最大2割短縮） */
function stageSpeedFactor(): number {
  const stage = getCurrentStageIndex()
  return 1 - Math.min(1, stage / 5) * 0.2
}

function generate() {
  const factor = stageSpeedFactor()
  const phases: Phase[] = [
    { color: 'green', durationMs: Math.round(randInt(600, 900) * factor) },
    { color: 'red', durationMs: Math.round(randInt(450, 650) * factor) },
    { color: 'green', durationMs: Math.round(randInt(500, 800) * factor) },
    { color: 'red', durationMs: Math.round(randInt(450, 650) * factor) },
  ]
  return { phases }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { phases } = data as { phases: Phase[] }
  const total = phases.reduce((sum, p) => sum + p.durationMs, 0)
  return total + TIMING_SAFETY.rapidStop.safetyMarginMs
}

/** 緑フェーズでのタップ間隔から、PERFECT/GREAT/GOODを決める（MISSはこの関数の外で確定済み） */
function tierFromInterval(avgIntervalMs: number): 'PERFECT' | 'GREAT' | 'GOOD' {
  if (avgIntervalMs <= REFERENCE_INTERVAL_MS * 0.75) return 'PERFECT'
  if (avgIntervalMs <= REFERENCE_INTERVAL_MS * 1.3) return 'GREAT'
  return 'GOOD'
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { phases } = spec.data as { phases: Phase[] }
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [tapCount, setTapCount] = useState(0)
  const phaseIndexRef = useRef(0)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const greenTapTimestampsRef = useRef<number[][]>(phases.map(() => []))
  const totalGreenTapsRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    sfx.go()
    let cumulative = 0
    phases.forEach((phase, i) => {
      cumulative += phase.durationMs
      if (i === phases.length - 1) return
      const t = setTimeout(() => {
        phaseIndexRef.current = i + 1
        setPhaseIndex(i + 1)
        if (phases[i + 1].color === 'green') sfx.go()
        else sfx.brake()
      }, cumulative)
      timersRef.current.push(t)
    })
    const finalTimer = setTimeout(() => {
      if (doneRef.current) return
      const totalTaps = totalGreenTapsRef.current
      if (totalTaps < MIN_TOTAL_TAPS) {
        finish(false)
        return
      }
      const intervals: number[] = []
      for (const arr of greenTapTimestampsRef.current) {
        for (let i = 1; i < arr.length; i++) intervals.push(arr[i] - arr[i - 1])
      }
      const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : REFERENCE_INTERVAL_MS * 2
      finish(true, tierFromInterval(avgInterval))
    }, cumulative)
    timersRef.current.push(finalTimer)

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, tierOverride?: 'PERFECT' | 'GREAT' | 'GOOD', redPhaseTap = false) {
    if (doneRef.current) return
    doneRef.current = true
    timersRef.current.forEach(clearTimeout)
    const total = phases.reduce((sum, p) => sum + p.durationMs, 0)
    if (!correct) {
      onResult({
        correct: false,
        reactionMs: performance.now() - startRef.current,
        meta: redPhaseTap ? { redPhaseTap: true } : undefined,
      })
      return
    }
    onResult({
      correct: true,
      reactionMs: performance.now() - startRef.current,
      ratioWindowMs: total,
      tierOverride,
    })
  }

  function handleTap() {
    if (doneRef.current) return
    const phase = phases[phaseIndexRef.current]
    if (phase.color === 'red') {
      finish(false, undefined, true)
      return
    }
    const now = performance.now()
    greenTapTimestampsRef.current[phaseIndexRef.current].push(now)
    totalGreenTapsRef.current += 1
    setTapCount((c) => c + 1)
    sfx.tap()
  }

  const isRed = phases[phaseIndex].color === 'red'

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-4 text-center select-none">
      <div
        className={`flex items-center gap-3 rounded-full border-2 px-4 py-1.5 text-sm font-black tracking-wide transition-colors ${
          isRed ? 'border-red-400/70 bg-red-500/10' : 'border-emerald-300/70 bg-emerald-500/10'
        }`}
      >
        <span className={isRed ? 'opacity-40' : 'text-emerald-300'}>🟢 連打</span>
        <span className="text-white/30">｜</span>
        <span className={isRed ? 'text-red-300' : 'opacity-40'}>🔴 STOP</span>
      </div>
      <p className={`text-4xl font-black ${isRed ? 'text-red-400' : 'text-emerald-300'}`}>{isRed ? 'STOP！' : '連打！'}</p>
      <button
        onPointerDown={handleTap}
        className={`signal-pulse flex h-32 w-32 items-center justify-center rounded-full text-3xl font-black text-white active:scale-95 ${
          isRed ? 'signal-red-glow bg-gradient-to-b from-red-500 to-rose-700' : 'signal-green-glow bg-gradient-to-b from-emerald-400 to-green-600'
        }`}
      >
        {isRed ? 'STOP' : tapCount}
      </button>
    </div>
  )
}

export const RapidStopQuestionModule: QuestionModule = {
  id: 'rapidStop',
  category: 'rapid',
  baseTargetTimeMs: 2400,
  generate,
  Component,
  computeMinTargetTimeMs,
}
