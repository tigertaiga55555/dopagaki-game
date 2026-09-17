import { useEffect, useRef } from 'react'
import { TIMING_SAFETY } from '../config/timingConfig'
import { randInt, shuffle } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generate() {
  const a = randInt(2, 9)
  const b = randInt(2, 9)
  const answer = a + b
  const wrongSet = new Set<number>()
  while (wrongSet.size < 3) {
    const w = answer + randInt(-4, 4)
    if (w > 0 && w !== answer) wrongSet.add(w)
  }
  const options = shuffle([answer, ...wrongSet])
  return { a, b, answer, options }
}

function Component({ spec, onResult }: QuestionComponentProps) {
  const { a, b, answer, options } = spec.data as { a: number; b: number; answer: number; options: number[] }
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
    <QuestionShell sub="計算した答えを押せ" instruction={`${a} ＋ ${b} ＝ ？`}>
      <div className="grid grid-cols-2 gap-4">
        {options.map((n) => (
          <button
            key={n}
            onPointerDown={() => finish(n === answer)}
            className="flex h-16 w-20 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white active:scale-90"
          >
            {n}
          </button>
        ))}
      </div>
    </QuestionShell>
  )
}

export const MathQuestionModule: QuestionModule = {
  id: 'simpleMath',
  category: 'reaction',
  baseTargetTimeMs: 2200,
  generate,
  Component,
  computeMinTargetTimeMs: () => TIMING_SAFETY.simpleMath.minTimeMs,
}
