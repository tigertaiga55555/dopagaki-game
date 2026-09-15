import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randFloat, randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/** 「100で止めろ」：高速で増える数字を見ながらギリギリまで攻める、というドパガキの刺激追求そのもの。 */
function generate() {
  return { startValue: randInt(15, 35), rate: randFloat(55, 75) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { startValue, rate } = data as { startValue: number; rate: number }
  const timeToHundredMs = ((100 - startValue) / rate) * 1000
  return timeToHundredMs + TIMING_SAFETY.stopAt100.reactionBufferMs + TIMING_SAFETY.stopAt100.safetyMarginMs
}

/**
 * Ver.4.3: 「100でSTOP！」だと成功範囲が伝わらず、内部条件と表示が一致していなかった。
 * 画面表示（GOOD_RANGEの幅から動的に組み立てる「98〜102でSTOP！」）と
 * 実際の成功判定を完全に一致させる。
 */
const GOOD_RANGE = 2

function judgeStop(value: number): { tier: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'; correct: boolean } {
  const diff = Math.abs(value - 100)
  if (diff === 0) return { tier: 'PERFECT', correct: true }
  if (diff === 1) return { tier: 'GREAT', correct: true }
  if (diff <= GOOD_RANGE) return { tier: 'GOOD', correct: true }
  return { tier: 'MISS', correct: false }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { startValue, rate } = spec.data as { startValue: number; rate: number }
  const [display, setDisplay] = useState(startValue)
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    function tick() {
      if (doneRef.current) return
      const elapsedSec = (performance.now() - startRef.current) / 1000
      setDisplay(Math.round(startValue + rate * elapsedSec))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    const failTimer = setTimeout(() => finish(startValue + Math.round(rate * (spec.targetTimeMs / 1000))), spec.targetTimeMs)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      clearTimeout(failTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(stoppedAtValue: number) {
    if (doneRef.current) return
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const { correct, tier } = judgeStop(stoppedAtValue)
    onResult({
      correct,
      reactionMs: 0,
      tierOverride: tier,
      meta: { stoppedAtValue },
    })
  }

  function handleStop() {
    if (doneRef.current) return
    finish(display)
  }

  return (
    <QuestionShell instruction={`${100 - GOOD_RANGE}〜${100 + GOOD_RANGE}でSTOP！`}>
      <button
        onPointerDown={handleStop}
        className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-cyan-400 to-blue-600 text-3xl font-black tabular-nums text-white active:scale-95"
      >
        {display}
      </button>
    </QuestionShell>
  )
}

export const StopAt100QuestionModule: QuestionModule = {
  id: 'stopAt100',
  category: 'timing',
  baseTargetTimeMs: 1900,
  generate,
  Component,
  computeMinTargetTimeMs,
}
