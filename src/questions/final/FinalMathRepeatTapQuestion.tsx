import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../../config/timingConfig'
import { randInt } from '../../engine/random'
import { createResolveOnce } from '../../engine/resolveOnce'
import { QuestionShell } from '../QuestionShell'
import type { FinalQuestionComponentProps, FinalQuestionModule, FinalQuestionResult } from '../../types'

const MIN_TAP_INTERVAL_MS = TIMING_SAFETY.repeatTap.minTapIntervalMs

/**
 * FINAL DOPA TRIAL Q13〜Q15（高難度ミックスプール）：「計算の答えの回数だけタップ！」。
 * 通常のRepeatTapQuestion（回数を数字でそのまま提示）と違い、必要回数そのものを表示せず、
 * 計算して自分で導き出させる（数学＋反復操作の複合）。
 * MISSに至る状態遷移・安全マージンは通常のRepeatTapQuestionと同じ
 * INPUT→CONFIRM_STOPの状態機械をそのまま踏襲する（FINALは1MISS即終了のため特に重要）。
 */
function generate() {
  const a = randInt(2, 4)
  const b = randInt(1, 2)
  const required = a + b // 3〜6回に収める
  const stopConfirmMs = randInt(700, 900)
  return { a, b, required, stopConfirmMs }
}

function computeTargetTimeMs(data: Record<string, unknown>) {
  const { required, stopConfirmMs } = data as { required: number; stopConfirmMs: number }
  return required * TIMING_SAFETY.repeatTap.perTapMs + TIMING_SAFETY.repeatTap.reactionBufferMs + stopConfirmMs + TIMING_SAFETY.repeatTap.stopSafetyMarginMs
}

type Phase = 'INPUT' | 'CONFIRM_STOP'

function Component({ spec, onResult }: FinalQuestionComponentProps) {
  const { a, b, required, stopConfirmMs } = spec.data as { a: number; b: number; required: number; stopConfirmMs: number }
  const [count, setCount] = useState(0)
  const [uiPhase, setUiPhase] = useState<Phase>('INPUT')
  const phaseRef = useRef<Phase>('INPUT')
  const countRef = useRef(0)
  const startRef = useRef(performance.now())
  const lastTapAtRef = useRef(0)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guardRef = useRef<ReturnType<typeof createResolveOnce<FinalQuestionResult>> | null>(null)
  if (!guardRef.current) guardRef.current = createResolveOnce(onResult)

  useEffect(() => {
    failTimerRef.current = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (guardRef.current!.isResolved) return
    if (failTimerRef.current) clearTimeout(failTimerRef.current)
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    guardRef.current!.resolve({ correct, reactionMs: performance.now() - startRef.current })
  }

  function handleTap() {
    if (guardRef.current!.isResolved) return
    const now = performance.now()
    if (now - lastTapAtRef.current < MIN_TAP_INTERVAL_MS) return
    lastTapAtRef.current = now

    if (phaseRef.current === 'CONFIRM_STOP') {
      finish(false)
      return
    }

    const next = countRef.current + 1
    if (next > required) {
      finish(false)
      return
    }
    countRef.current = next
    setCount(next)
    if (next === required) {
      phaseRef.current = 'CONFIRM_STOP'
      setUiPhase('CONFIRM_STOP')
      if (failTimerRef.current) clearTimeout(failTimerRef.current)
      failTimerRef.current = setTimeout(() => finish(false), stopConfirmMs + TIMING_SAFETY.repeatTap.stopSafetyMarginMs)
      holdTimerRef.current = setTimeout(() => finish(true), stopConfirmMs)
    }
  }

  return (
    <QuestionShell
      sub={uiPhase === 'CONFIRM_STOP' ? '指を触れずに待て' : `${a} ＋ ${b} ＝ ？ 回タップせよ`}
      instruction={uiPhase === 'CONFIRM_STOP' ? '止まれ！' : '計算の答えの回数だけタップ！'}
    >
      <button
        onPointerDown={handleTap}
        className={`flex h-28 w-28 items-center justify-center rounded-full text-3xl font-black text-white active:scale-95 ${
          uiPhase === 'CONFIRM_STOP' ? 'bg-gradient-to-b from-red-500 to-rose-600' : 'bg-gradient-to-b from-fuchsia-500 to-purple-600'
        }`}
      >
        {count}
      </button>
    </QuestionShell>
  )
}

export const FinalMathRepeatTapModule: FinalQuestionModule = {
  id: 'finalMathRepeatTap',
  tags: ['math', 'inhibition'],
  tier: 'mixed',
  generate,
  computeTargetTimeMs,
  Component,
}
