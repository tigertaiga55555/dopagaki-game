import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generate() {
  return { requiredMs: randInt(500, 900) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { requiredMs } = data as { requiredMs: number }
  return requiredMs + TIMING_SAFETY.hold.reactionBufferMs + TIMING_SAFETY.hold.safetyMarginMs
}

/**
 * Ver.4.3で修正：外側の自動失敗タイマーは元々「問題表示からの固定時間」で発火していたため、
 * 反応してから指を置くまでの時間が想定より長いと、正しく持続して押しているのに
 * ゲージ完了直前でtimeout側が先に発火してMISSになる不具合があった。
 * 指を置いた瞬間にタイマーを requiredMs + completionSafetyMs で引き直すことで、
 * 一度保持を開始した後は必ず十分な時間内にSUCCESS判定が行われるようにする。
 */
function Component({ spec, onResult }: QuestionComponentProps) {
  const { requiredMs } = spec.data as { requiredMs: number }
  const [holding, setHolding] = useState(false)
  const [fill, setFill] = useState(0)
  const questionStartRef = useRef(performance.now())
  const holdStartRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const rafRef = useRef<number | undefined>(undefined)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopChargeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    failTimerRef.current = setTimeout(finishAsFailureUnlessComplete, spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // ゲーム終了などでHOLD未確定のままアンマウントされた場合、充填音を鳴らし続けないようにする
      if (stopChargeRef.current) stopChargeRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    if (stopChargeRef.current) {
      stopChargeRef.current()
      stopChargeRef.current = null
    }
    if (correct) sfx.holdComplete()
    onResult({ correct, reactionMs: performance.now() - questionStartRef.current })
  }

  /**
   * 「失敗扱いにしてよいか」を判定する共通処理。rAFのtickだけに完了判定を頼ると、
   * タブの状態や描画負荷でrAFが間引かれた場合に「必要時間はとっくに満たしているのに
   * 判定がそれより先に走ってMISSになる」レースが起こり得る。そのため、保持開始からの
   * 実経過時間を直接見て、満たしていれば必ず成功を優先する。呼び出し元はtick（rAF）、
   * pointerup/pointercancel、外側の安全弁タイマーの3箇所。
   */
  function finishAsFailureUnlessComplete() {
    if (doneRef.current) return
    if (holdStartRef.current !== null && performance.now() - holdStartRef.current >= requiredMs) {
      finish(true)
      return
    }
    finish(false)
  }

  function handleDown() {
    if (doneRef.current) return
    setHolding(true)
    holdStartRef.current = performance.now()
    stopChargeRef.current = sfx.startHoldCharge(requiredMs)

    // 保持を開始した瞬間、必要時間+完了安全余裕を確実に確保できるようdeadlineを引き直す。
    // これにより「必要時間を満たしたのにtimeoutが先に発火する」レースを構造的に防ぐ。
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    failTimerRef.current = setTimeout(finishAsFailureUnlessComplete, requiredMs + TIMING_SAFETY.hold.completionSafetyMs)

    const tick = () => {
      if (doneRef.current || holdStartRef.current === null) return
      const held = performance.now() - holdStartRef.current
      setFill(Math.min(100, (held / requiredMs) * 100))
      if (held >= requiredMs) {
        finish(true)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function handleRelease() {
    if (holdStartRef.current === null) return
    finishAsFailureUnlessComplete()
  }

  return (
    <QuestionShell sub="離すと失敗" instruction={'指を離さず\n長押し！'}>
      <button
        onPointerDown={handleDown}
        onPointerUp={handleRelease}
        onPointerCancel={handleRelease}
        className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-bold text-white/70 active:scale-95"
      >
        <span
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fuchsia-500 to-purple-500"
          style={{ height: `${fill}%` }}
        />
        <span className="relative z-10">{holding ? '' : 'HOLD'}</span>
      </button>
    </QuestionShell>
  )
}

export const HoldPressQuestionModule: QuestionModule = {
  id: 'holdPress',
  category: 'inhibition',
  baseTargetTimeMs: 1500,
  generate,
  Component,
  computeMinTargetTimeMs,
}
