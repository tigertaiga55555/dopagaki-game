import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generate() {
  let left = randInt(36, 90)
  let right = randInt(36, 90)
  while (Math.abs(left - right) < 20) right = randInt(36, 90)
  return { left, right }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { left, right } = spec.data as { left: number; right: number }
  const startRef = useRef(performance.now())
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => finish(false), spec.targetTimeMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    onResult({ correct, reactionMs: performance.now() - startRef.current })
  }

  return (
    <QuestionShell instruction="大きい丸を押せ！">
      <div className="flex w-full max-w-xs items-center justify-center gap-6">
        {[left, right].map((size, side) => (
          <button
            key={side}
            onPointerDown={() => finish(side === 0 ? left > right : right > left)}
            className="flex h-28 flex-1 items-center justify-center active:scale-95"
          >
            <span
              className="rounded-full bg-gradient-to-b from-fuchsia-400 to-purple-500"
              style={{ width: size, height: size }}
            />
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const BiggerShapeQuestionModule: QuestionModule = {
  id: 'biggerShape',
  category: 'reaction',
  baseTargetTimeMs: 1500,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.reactionMinMs.biggerShape,
}
