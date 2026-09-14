import { useEffect, useRef } from 'react'
import { randInt } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generate() {
  let left = randInt(3, 9)
  let right = randInt(3, 9)
  while (left === right) right = randInt(3, 9)
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
    <QuestionShell instruction="多い方！">
      <div className="flex w-full max-w-xs gap-3">
        {[left, right].map((count, side) => (
          <button
            key={side}
            onPointerDown={() => finish((side === 0 ? left > right : right > left))}
            className="flex h-28 flex-1 flex-wrap content-center items-center justify-center gap-1 rounded-2xl bg-white/10 p-3 active:scale-95"
          >
            {Array.from({ length: count }).map((_, i) => (
              <span key={i} className="h-3 w-3 rounded-full bg-fuchsia-400" />
            ))}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const MoreSideQuestionModule: QuestionModule = {
  id: 'moreSide',
  baseTargetTimeMs: 1800,
  generate,
  Component,
}
