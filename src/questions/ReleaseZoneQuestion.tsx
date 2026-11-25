import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * 「ゾーンで離せ！」：HOLDの派生。押し続けるとゲージが進み、枠で囲まれたゾーン内で
 * 指を離せば成功。早すぎても（ゾーン前）、通り過ぎても（ゾーン後）MISS。
 *
 * Ver.6 Phase 1: 旧実装はゾーンを緑色の塗りつぶしのみで示していたため、色識別が
 * 実質的に必要になっていた（色の正解条件化は禁止）。白い太枠＋斜めストライプ柄という、
 * 色を一切使わない形でゾーンの位置を示すよう変更した。ゲージ本体の進捗バー色は
 * 正解条件に関与しない純粋な演出のため、装飾としてそのまま残している。
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
  /** HoldPressQuestionと同じ理由（マルチタッチでのholdStartRef上書き／他指の指離しでの誤中断を防ぐ）。 */
  const pointerIdRef = useRef<number | null>(null)

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
    pointerIdRef.current = null
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

  function handleDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (doneRef.current || holdStartRef.current !== null) return
    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
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

  function handleRelease(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.pointerId !== pointerIdRef.current) return
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
    <QuestionShell instruction="枠の中で離せ！">
      <div className="flex flex-col items-center gap-4">
        {/* HoldPressQuestionと同じ根本原因（指のわずかな動きをブラウザがジェスチャーと
            誤認しpointercancelを誤発火させる）に対する修正。touch-action:noneで
            このボタン上のブラウザ側ジェスチャー認識自体を無効化する。 */}
        <button
          onPointerDown={handleDown}
          onPointerUp={handleRelease}
          onPointerCancel={handleRelease}
          className="flex h-28 w-28 touch-none items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/70 select-none active:scale-95"
        >
          {holding ? '' : 'HOLD'}
        </button>
        <div className="relative h-5 w-64 overflow-hidden rounded-full bg-white/10">
          {/* ゾーンの位置は白い太枠＋斜めストライプ柄のみで示す（色に依存しない） */}
          <div
            className="absolute inset-y-0 rounded-sm border-2 border-white"
            style={{
              left: `${zoneStartPct}%`,
              width: `${zoneEndPct - zoneStartPct}%`,
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 3px, transparent 3px, transparent 7px)',
            }}
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
