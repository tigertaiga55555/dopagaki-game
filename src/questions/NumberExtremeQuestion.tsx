import { useEffect, useRef } from 'react'
import { randInt, shuffle } from '../engine/random'
import { QuestionShell } from './QuestionShell'
import type { QuestionComponentProps, QuestionModule } from '../types'

function generateNumbers() {
  const numbers = new Set<number>()
  while (numbers.size < 4) numbers.add(randInt(1, 99))
  return shuffle([...numbers])
}

function makeModule(mode: 'max' | 'min'): QuestionModule {
  function generate() {
    const numbers = generateNumbers()
    const target = mode === 'max' ? Math.max(...numbers) : Math.min(...numbers)
    return { numbers, target }
  }

  function Component({ spec, onResult }: QuestionComponentProps) {
    const { numbers, target } = spec.data as { numbers: number[]; target: number }
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
      <QuestionShell instruction={mode === 'max' ? '一番大きい！' : '一番小さい！'}>
        <div className="grid grid-cols-2 gap-4">
          {numbers.map((n, i) => (
            <button
              key={i}
              onPointerDown={() => finish(n === target)}
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-white active:scale-90"
            >
              {n}
            </button>
          ))}
        </div>
      </QuestionShell>
    )
  }

  return { id: mode === 'max' ? 'maxNumber' : 'minNumber', baseTargetTimeMs: 1600, generate, Component }
}

export const MaxNumberQuestionModule = makeModule('max')
export const MinNumberQuestionModule = makeModule('min')
