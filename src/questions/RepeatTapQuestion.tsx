import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { judgeByRatio } from '../config/scoreConfigV4'
import { randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/**
 * Ver.4.2: 「指定回数に到達した瞬間に自動成功」をやめ、
 * 「指定回数まで押す→停止確認時間に何も押さなければ成功、7回目を押した瞬間MISS」に変更。
 * 勢いで押しすぎるドパガキの衝動をそのままゲーム化する。
 */
function generate() {
  return { required: randInt(3, 7), stopConfirmMs: randInt(700, 900) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { required, stopConfirmMs } = data as { required: number; stopConfirmMs: number }
  return required * TIMING_SAFETY.repeatTap.perTapMs + TIMING_SAFETY.repeatTap.reactionBufferMs + stopConfirmMs + TIMING_SAFETY.repeatTap.stopSafetyMarginMs
}

type Phase = 'counting' | 'holding'

function Component({ spec, onResult }: QuestionComponentProps) {
  const { required, stopConfirmMs } = spec.data as { required: number; stopConfirmMs: number }
  const [count, setCount] = useState(0)
  const [phase, setPhase] = useState<Phase>('counting')
  const startRef = useRef(performance.now())
  const reachedAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => finish(false, 0), spec.targetTimeMs)
    return () => {
      clearTimeout(timer)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, extraTaps: number, reactionMsOverride?: number) {
    if (doneRef.current) return
    doneRef.current = true
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    const reactionMs = reactionMsOverride ?? performance.now() - startRef.current
    if (!correct) {
      onResult({ correct: false, reactionMs, meta: extraTaps > 0 ? { extraTaps } : undefined })
      return
    }
    const ratioWindowMs = required * TIMING_SAFETY.repeatTap.perTapMs + TIMING_SAFETY.repeatTap.reactionBufferMs
    const tier = judgeByRatio(reactionMs, ratioWindowMs)
    onResult({ correct: true, reactionMs, tierOverride: tier })
  }

  function handleTap() {
    if (doneRef.current) return

    if (phase === 'holding') {
      // 停止確認時間中に押した＝止まれなかった
      finish(false, 1)
      return
    }

    const next = count + 1
    if (next > required) {
      // 指定回数を超えて押した瞬間MISS
      finish(false, next - required)
      return
    }
    setCount(next)
    if (next === required) {
      reachedAtRef.current = performance.now()
      setPhase('holding')
      holdTimerRef.current = setTimeout(() => {
        finish(true, 0, (reachedAtRef.current ?? performance.now()) - startRef.current)
      }, stopConfirmMs)
    }
  }

  return (
    <QuestionShell instruction={phase === 'holding' ? '止まれ！' : `${required}回押せ！`}>
      <button
        onPointerDown={handleTap}
        className={`flex h-28 w-28 items-center justify-center rounded-full text-3xl font-black text-white active:scale-95 ${
          phase === 'holding' ? 'bg-gradient-to-b from-red-500 to-rose-600' : 'bg-gradient-to-b from-fuchsia-500 to-purple-600'
        }`}
      >
        {count}
      </button>
    </QuestionShell>
  )
}

export const RepeatTapQuestionModule: QuestionModule = {
  id: 'repeatTap',
  category: 'rapid',
  baseTargetTimeMs: 1800,
  generate,
  Component,
  computeMinTargetTimeMs,
}
