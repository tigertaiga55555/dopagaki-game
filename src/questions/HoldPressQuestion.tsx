import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generate() {
  return { requiredMs: randInt(500, 900) }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { requiredMs } = data as { requiredMs: number }
  return requiredMs + TIMING_SAFETY.hold.reactionBufferMs + TIMING_SAFETY.hold.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { requiredMs } = spec.data as { requiredMs: number }
  const [holding, setHolding] = useState(false)
  const [fill, setFill] = useState(0)
  const questionStartRef = useRef(performance.now())
  const holdStartRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - questionStartRef.current })
  }

  function handleDown() {
    if (doneRef.current) return
    setHolding(true)
    holdStartRef.current = performance.now()
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

  function handleUp() {
    if (doneRef.current) return
    if (holdStartRef.current === null) return
    finish(false)
  }

  return (
    <QuestionShell instruction="HOLD">
      <button
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
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
  baseTargetTimeMs: 1500,
  generate,
  Component,
  computeMinTargetTimeMs,
}
