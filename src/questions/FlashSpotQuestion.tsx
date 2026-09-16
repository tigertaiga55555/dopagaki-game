import { useEffect, useRef, useState } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { sfx } from '../utils/sound'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

/** 「光ったやつ！」：4つの丸のうち1つだけ一瞬発光する。位置を覚えてタップする。 */
function generate() {
  const flashIndex = randInt(0, 3)
  const preDelayMs = randInt(300, 600)
  const flashDurationMs = randInt(300, 450)
  return { flashIndex, preDelayMs, flashDurationMs }
}

function computeMinTargetTimeMs(data: Record<string, unknown>) {
  const { preDelayMs, flashDurationMs } = data as { preDelayMs: number; flashDurationMs: number }
  return preDelayMs + flashDurationMs + TIMING_SAFETY.flashSpot.minReactionWindowMs + TIMING_SAFETY.flashSpot.safetyMarginMs
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { flashIndex, preDelayMs, flashDurationMs } = spec.data as {
    flashIndex: number
    preDelayMs: number
    flashDurationMs: number
  }
  const [flashed, setFlashed] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const startRef = useRef(performance.now())
  const flashedAtRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const flashOnTimer = setTimeout(() => {
      flashedAtRef.current = performance.now()
      setFlashed(true)
      setFlashing(true)
      sfx.flashTick()
    }, preDelayMs)
    const flashOffTimer = setTimeout(() => setFlashing(false), preDelayMs + flashDurationMs)
    const failTimer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => {
      clearTimeout(flashOnTimer)
      clearTimeout(flashOffTimer)
      clearTimeout(failTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean, earlyPress = false) {
    if (doneRef.current) return
    doneRef.current = true
    if (!correct) {
      onResult({ correct: false, reactionMs: performance.now() - startRef.current, meta: earlyPress ? { earlyPress: true } : undefined })
      return
    }
    const flashedAt = flashedAtRef.current ?? performance.now()
    const reactionMs = performance.now() - flashedAt
    const ratioWindowMs = spec.targetTimeMs - preDelayMs
    onResult({ correct: true, reactionMs, ratioWindowMs })
  }

  function handleTap(index: number) {
    if (doneRef.current) return
    if (!flashed) {
      finish(false, true)
      return
    }
    finish(index === flashIndex)
  }

  return (
    <QuestionShell instruction="光った丸を押せ！">
      <div className="grid grid-cols-2 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(i)}
            className={`h-20 w-20 rounded-full border-4 transition-all active:scale-90 ${
              flashing && i === flashIndex
                ? 'scale-110 border-amber-200 bg-amber-300 shadow-[0_0_35px_rgba(252,211,77,0.9)]'
                : 'border-white/10 bg-white/10'
            }`}
          />
        ))}
      </div>
    </QuestionShell>
  )
}

export const FlashSpotQuestionModule: QuestionModule = {
  id: 'flashSpot',
  category: 'visual',
  baseTargetTimeMs: 1500,
  generate,
  Component,
  computeMinTargetTimeMs,
}
