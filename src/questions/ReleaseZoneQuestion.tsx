import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * 「緑で離せ！」：HOLDの派生。押し続けるとゲージが進み、緑ゾーン内で指を離せば成功。
 * 早すぎても（緑ゾーン前）、通り過ぎても（緑ゾーン後）MISS。
 *
 * Ver.4.6の重要な修正：外側の汎用タイムアウトはマウント時にspec.targetTimeMsで一度だけ
 * セットされていたため、反応してから指を置くまでにわずかでも想定より時間がかかると、
 * 正しくゲージを進めている最中にタイムアウトが先に発火してMISSになるレースがあった
 * （Ver.4.3でHOLDに適用した修正と同種）。指を置いた瞬間、外側タイマーを
 * cycleMs基準で引き直すことでこれを防ぐ。
 */
function generate() {
  const cycleMs = randInt(1300, 1900)
  const zoneWidthPct = randInt(14, 20)
  const zoneStartPct = randInt(35, 80 - zoneWidthPct)
  return { cycleMs, zoneStartPct, zoneEndPct: zoneStartPct + zoneWidthPct }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { cycleMs } = data as { cycleMs: number }
  return cycleMs + TIMING_SAFETY.releaseZone.reactionBufferMs + TIMING_SAFETY.releaseZone.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { cycleMs, zoneStartPct, zoneEndPct } = spec.data as { cycleMs: number; zoneStartPct: number; zoneEndPct: number }
  const [fill, setFill] = useState(0)
  const [holding, setHolding] = useState(false)
  const holdStartRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const rafRef = useRef<number | undefined>(undefined)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopChargeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (stopChargeRef.current) stopChargeRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, releaseOffsetMs?: number) {
    if (doneRef.current) return
    doneRef.current = true
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (stopChargeRef.current) {
      stopChargeRef.current()
      stopChargeRef.current = null
    }
    if (correct) sfx.zoneRelease()
    // 判定品質はゾーン中心からのズレで評価する（中心で離せるほどPERFECTに近づく）
    const zoneCenterMs = ((zoneStartPct + zoneEndPct) / 2 / 100) * cycleMs
    const zoneHalfWidthMs = ((zoneEndPct - zoneStartPct) / 2 / 100) * cycleMs
    const actualMs = holdStartRef.current !== null ? performance.now() - holdStartRef.current : zoneCenterMs
    onResult({
      correct,
      reactionMs: Math.abs(actualMs - zoneCenterMs),
      ratioWindowMs: Math.max(1, zoneHalfWidthMs),
      meta: releaseOffsetMs !== undefined ? { releaseOffsetMs } : undefined,
    })
  }

  function handleDown() {
    if (doneRef.current) return
    setHolding(true)
    holdStartRef.current = performance.now()
    stopChargeRef.current = sfx.startHoldCharge(cycleMs)
    // 指を置いた瞬間、外側タイマーをcycleMs+安全マージン基準に引き直す。
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(() => finish(false), cycleMs + TIMING_SAFETY.releaseZone.safetyMarginMs)
    const tick = () => {
      if (doneRef.current || holdStartRef.current === null) return
      const held = performance.now() - holdStartRef.current
      const pct = Math.min(100, (held / cycleMs) * 100)
      setFill(pct)
      if (pct >= 100) {
        finish(false, Math.round(held - cycleMs))
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function handleRelease() {
    if (doneRef.current || holdStartRef.current === null) return
    const held = performance.now() - holdStartRef.current
    const pct = (held / cycleMs) * 100
    if (pct < zoneStartPct) {
      finish(false, Math.round(((zoneStartPct - pct) / 100) * cycleMs) * -1)
      return
    }
    if (pct > zoneEndPct) {
      finish(false, Math.round(((pct - zoneEndPct) / 100) * cycleMs))
      return
    }
    finish(true)
  }

  return (
    <QuestionShell instruction="緑で離せ！">
      <div className="flex flex-col items-center gap-4">
        <button
          onPointerDown={handleDown}
          onPointerUp={handleRelease}
          onPointerCancel={handleRelease}
          className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/70 active:scale-95"
        >
          {holding ? '' : 'HOLD'}
        </button>
        <div className="relative h-4 w-64 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 bg-emerald-500/60"
            style={{ left: `${zoneStartPct}%`, width: `${zoneEndPct - zoneStartPct}%` }}
          />
          <div className="absolute inset-y-0 left-0 bg-fuchsia-400" style={{ width: `${fill}%` }} />
        </div>
      </div>
    </QuestionShell>
  )
}

export const ReleaseZoneQuestionModule: QuestionModule = {
  id: 'releaseZone',
  category: 'timing',
  baseTargetTimeMs: 2200,
  generate,
  Component,
  computeMinTargetTimeMs,
}
